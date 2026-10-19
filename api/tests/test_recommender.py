import copy
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from recommender.engine import recommend
from recommender.validation import ValidationError
from index import create_app

SECRET = "test-only-recommendation-secret-123456789"


def candidate(key="a", **changes):
    return dict({"key": key, "restaurantId": key, "provider": None, "providerPlaceId": None, "normalizedKey": "normalized:" + key,
                 "kind": "restaurant", "cuisines": ["Noodles"], "priceTier": None, "distanceMeters": None, "openNow": None}, **changes)


def payload(mode="favorites"):
    return {"mode": mode, "attendees": ["hieu", "nick"],
            "ratings": [{"restaurantId": "a", "profileId": "hieu", "rating": "10"}, {"restaurantId": "a", "profileId": "nick", "rating": "6"}],
            "places": [{"restaurantId": "a", "cuisines": ["Noodles"]}], "candidates": [candidate()],
            "excluded": {"restaurantIds": [], "providerKeys": [], "normalizedKeys": []},
            "filters": {"cuisine": None, "kind": None, "maxPriceTier": None, "maxDistanceMeters": None, "openNowOnly": False}, "limit": 10}


class EngineTests(unittest.TestCase):
    def test_documented_favorite_formula(self):
        result = recommend(payload())
        self.assertEqual(result["results"][0]["preferenceScore"], "80.000000")
        self.assertEqual(result["results"][0]["metrics"]["observedMean"], "8")
        self.assertEqual(result["results"][0]["metrics"]["disagreement"], "2")
        self.assertEqual(result["scoreKind"], "preference-index")

    def test_only_attendee_ratings_are_votes(self):
        data = payload()
        data["ratings"].append({"restaurantId": "a", "profileId": "vinh", "rating": "1"})
        self.assertEqual(recommend(data)["results"][0]["preferenceScore"], "80.000000")

    def test_sparse_favorite_does_not_impute_zero_or_perfect_agreement(self):
        data = payload()
        data["ratings"] = data["ratings"][:1]
        row = recommend(data)["results"][0]
        self.assertEqual(row["preferenceScore"], "85.000000")
        self.assertEqual(row["metrics"]["coverage"], "0.5")
        self.assertIsNone(row["metrics"]["disagreement"])
        self.assertIn("limited-agreement", [item["code"] for item in row["explanations"]])

    def test_favorite_cold_start_has_no_fabricated_results(self):
        data = payload()
        data["ratings"] = []
        result = recommend(data)
        self.assertEqual(result["results"], [])
        self.assertEqual(result["counts"]["rejectionReasons"], {"no-attendee-ratings": 1})

    def test_new_formula_smooths_cuisine_preferences_and_discloses_prior(self):
        data = payload("new")
        data["candidates"] = [candidate("new", restaurantId=None, provider="test", providerPlaceId="new")]
        row = recommend(data)["results"][0]
        self.assertEqual(row["metrics"]["preferenceAttendeeCount"], 2)
        self.assertIsNone(row["metrics"]["observedMean"])
        self.assertEqual(row["preferenceScore"], "63.657407")

    def test_new_cold_start_is_explicit_neutral_preference_not_a_rating(self):
        data = payload("new")
        data["ratings"] = []
        row = recommend(data)["results"][0]
        self.assertEqual(row["preferenceScore"], "41.250000")
        self.assertEqual(row["metrics"]["cuisineAffinity"], "0.5")
        self.assertEqual(row["metrics"]["coldStartAttendeeCount"], 2)
        self.assertIn("neutral-prior", [item["code"] for item in row["explanations"]])

    def test_duplicate_tags_do_not_weight_preferences_twice(self):
        data = payload("new")
        baseline = recommend(data)
        data["places"][0]["cuisines"] *= 2
        data["candidates"][0]["cuisines"] *= 2
        self.assertEqual(recommend(data), baseline)

    def test_order_independence_and_stable_candidate_id_ties(self):
        data = payload("new")
        data["candidates"] = [candidate("z"), candidate("b"), candidate("a")]
        baseline = recommend(data)
        data["ratings"].reverse()
        data["candidates"].reverse()
        data["attendees"].reverse()
        self.assertEqual(recommend(data), baseline)
        self.assertEqual([row["candidateKey"] for row in baseline["results"]], ["a", "b", "z"])

    def test_all_three_logged_identity_checks(self):
        for field, value in [("restaurantIds", "a"), ("normalizedKeys", "normalized:a")]:
            data = payload("new")
            data["excluded"][field] = [value]
            self.assertEqual(recommend(data)["results"], [])
        data = payload("new")
        data["candidates"] = [candidate("external", restaurantId=None, provider="test", providerPlaceId="id:1")]
        data["excluded"]["providerKeys"] = ['["test","id:1"]']
        self.assertEqual(recommend(data)["counts"]["rejectionReasons"], {"already-logged": 1})

    def test_hard_filters_precede_scoring_and_unknown_metadata_fails_closed(self):
        cases = [({"cuisine": "Other"}, "cuisine"), ({"kind": "cafe"}, "kind"), ({"maxPriceTier": 2}, "unknown-price"),
                 ({"maxDistanceMeters": 100}, "unknown-distance"), ({"openNowOnly": True}, "unknown-hours")]
        for filters, reason in cases:
            data = payload()
            data["filters"].update(filters)
            self.assertEqual(recommend(data)["counts"]["rejectionReasons"], {reason: 1})

    def test_known_price_distance_and_closed_filters(self):
        for changes, filters, reason in [({"priceTier": 4}, {"maxPriceTier": 2}, "price"),
                                         ({"distanceMeters": 200}, {"maxDistanceMeters": 100}, "distance"),
                                         ({"openNow": False}, {"openNowOnly": True}, "closed")]:
            data = payload()
            data["candidates"] = [candidate(**changes)]
            data["filters"].update(filters)
            self.assertEqual(recommend(data)["counts"]["rejectionReasons"], {reason: 1})

    def test_limits_and_counts_do_not_hide_eligible_candidates(self):
        data = payload("new")
        data["candidates"] = [candidate("a"), candidate("b")]
        data["limit"] = 1
        result = recommend(data)
        self.assertEqual(result["counts"], {"candidateCount": 2, "eligibleCount": 2, "rankedCount": 1, "excludedCount": 0, "rejectionReasons": {}})

    def test_request_not_mutated_and_no_scoring_io(self):
        data = payload()
        original = copy.deepcopy(data)
        with patch("builtins.open", side_effect=AssertionError("Scoring file I/O")), patch("socket.socket", side_effect=AssertionError("Scoring network I/O")):
            self.assertEqual(recommend(data), recommend(data))
        self.assertEqual(data, original)

    def test_fresh_interpreter_cold_start_is_deterministic(self):
        data = payload("new")
        command = [sys.executable, "-c", "import json,sys; from recommender.engine import recommend; print(json.dumps(recommend(json.load(sys.stdin)), sort_keys=True))"]
        result = subprocess.run(command, input=json.dumps(data), capture_output=True, text=True, cwd=Path(__file__).resolve().parents[1], check=True, timeout=10)
        self.assertEqual(json.loads(result.stdout), recommend(data))

    def test_strict_validation_blocks_duplicate_scores_and_attendees(self):
        for change in [lambda p: p["ratings"].append(p["ratings"][0]), lambda p: p["attendees"].append("hieu"), lambda p: p["candidates"].append(p["candidates"][0]),
                       lambda p: p.update(unexpected=True), lambda p: p["ratings"][0].update(restaurantId={}), lambda p: p["ratings"][0].update(rating="NaN"),
                       lambda p: p.update(limit=True), lambda p: p.update(limit=1.0), lambda p: p["filters"].update(maxPriceTier=1.5), lambda p: p.update(attendees=[])]:
            data = payload()
            change(data)
            with self.assertRaises(ValidationError):
                recommend(data)


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"RECOMMENDER_SHARED_SECRET": SECRET})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = create_app().test_client()
        self.headers = {"Authorization": "Bearer " + SECRET}

    def test_requires_service_secret_before_input_processing(self):
        response = self.client.post("/score", json={})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json["error"]["code"], "UNAUTHORIZED")
        with patch.dict(os.environ, {"RECOMMENDER_SHARED_SECRET": ""}):
            self.assertEqual(self.client.post("/score", json={}, headers=self.headers).status_code, 503)

    def test_real_wsgi_scoring_and_cold_app_instances(self):
        response = self.client.post("/score", json=payload(), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        self.assertEqual(response.json["data"], recommend(payload()))
        self.assertEqual(create_app().test_client().post("/score", json=payload(), headers=self.headers).json, response.json)

    def test_json_validation_errors_are_consistent(self):
        self.assertEqual(self.client.post("/score", json={}, headers=self.headers).status_code, 422)
        floating_limit = payload()
        floating_limit["limit"] = 1.0
        self.assertEqual(self.client.post("/score", json=floating_limit, headers=self.headers).status_code, 422)
        for body in ["{", '{"mode":NaN}', '{"mode":"new","mode":"favorites"}']:
            response = self.client.post("/score", data=body, content_type="application/json", headers=self.headers)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json["error"]["fieldErrors"], {})
        self.assertEqual(self.client.post("/score", data="plain", headers=self.headers).status_code, 415)

    def test_oversized_and_unsupported_requests(self):
        self.assertEqual(self.client.post("/score", data="x" * 2_000_001, content_type="application/json", headers=self.headers).status_code, 413)
        self.assertEqual(self.client.get("/score", headers=self.headers).status_code, 405)
        self.assertEqual(self.client.get("/unknown", headers=self.headers).status_code, 404)


if __name__ == "__main__":
    unittest.main()
