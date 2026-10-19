"""Deterministic Decimal scoring; inputs/outputs only, no clocks, network, or state."""
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP, localcontext

from .explanations import explain
from .filters import rejection
from .validation import validate

VERSION = "recommendations-v1"


def as_text(value):
    return None if value is None else format(value, "f").rstrip("0").rstrip(".") if "." in format(value, "f") else format(value, "f")


def preferences(payload):
    tags = {place["restaurantId"]: set(place["cuisines"]) for place in payload["places"]}
    by_cuisine = defaultdict(list)
    rated_profiles = set()
    for rating in sorted(payload["ratings"], key=lambda item: (item["profileId"], item["restaurantId"])):
        rated_profiles.add(rating["profileId"])
        for tag in tags[rating["restaurantId"]]:
            by_cuisine[(rating["profileId"], tag)].append((Decimal(rating["rating"]) - 1) / 9)
    return by_cuisine, rated_profiles


def score_favorite(candidate, payload, rated_profiles):
    values = [Decimal(row["rating"]) for row in sorted(payload["ratings"], key=lambda item: (item["profileId"], item["restaurantId"])) if row["restaurantId"] == candidate["restaurantId"] and row["profileId"] in payload["attendees"]]
    if not values:
        return None
    mean = sum(values) / len(values)
    coverage = Decimal(len(values)) / len(payload["attendees"])
    deviation = (sum((value - mean) ** 2 for value in values) / len(values)).sqrt() if len(values) >= 2 else None
    agreement = 1 - deviation / Decimal("4.5") if deviation is not None else Decimal("0.5")
    score = 70 * (mean - 1) / 9 + 20 * coverage + 10 * agreement
    return score, {"coverage": as_text(coverage), "observedMean": as_text(mean), "disagreement": as_text(deviation), "cuisineAffinity": None, "ratedAttendeeCount": len(values), "preferenceAttendeeCount": 0, "coldStartAttendeeCount": len(set(payload["attendees"]) - rated_profiles), "metadataKnownCount": 0}


def score_new(candidate, payload, cuisine_preferences, rated_profiles):
    tags = sorted(set(candidate["cuisines"]))
    affinities, evidence_count = [], 0
    for attendee in sorted(payload["attendees"]):
        values = []
        known = False
        for tag in tags:
            evidence = cuisine_preferences[(attendee, tag)]
            values.append((sum(evidence) + 2 * Decimal("0.5")) / (len(evidence) + 2))
            known = known or bool(evidence)
        affinities.append(sum(values) / len(values) if values else Decimal("0.5"))
        evidence_count += int(known)
    affinity = sum(affinities) / len(affinities)
    coverage = Decimal(evidence_count) / len(payload["attendees"])
    known_fields = int(bool(tags)) + sum(candidate[field] is not None for field in ("priceTier", "distanceMeters", "openNow"))
    score = 80 * affinity + 15 * coverage + 5 * Decimal(known_fields) / 4
    return score, {"coverage": as_text(coverage), "observedMean": None, "disagreement": None, "cuisineAffinity": as_text(affinity), "ratedAttendeeCount": 0, "preferenceAttendeeCount": evidence_count, "coldStartAttendeeCount": len(set(payload["attendees"]) - rated_profiles), "metadataKnownCount": known_fields}


def recommend(payload):
    validate(payload)
    with localcontext() as context:
        context.prec = 80
        cuisine_preferences, rated_profiles = preferences(payload)
        excluded = {key: set(values) for key, values in payload["excluded"].items()}
        results, reasons = [], Counter()
        for candidate in sorted(payload["candidates"], key=lambda item: item["key"]):
            reason = rejection(candidate, payload["filters"], excluded)
            if reason:
                reasons[reason] += 1
                continue
            scored = score_favorite(candidate, payload, rated_profiles) if payload["mode"] == "favorites" else score_new(candidate, payload, cuisine_preferences, rated_profiles)
            if scored is None:
                reasons["no-attendee-ratings"] += 1
                continue
            score, metrics = scored
            score = max(Decimal(0), min(Decimal(100), score)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
            results.append({"candidateKey": candidate["key"], "preferenceScore": str(score), "metrics": metrics, "explanations": explain(payload["mode"], metrics, len(payload["attendees"]))})
        results.sort(key=lambda item: (-Decimal(item["preferenceScore"]), item["candidateKey"]))
        eligible = len(results)
        results = [dict(item, rank=index + 1) for index, item in enumerate(results[:payload["limit"]])]
        return {"algorithmVersion": VERSION, "scoreKind": "preference-index", "results": results, "counts": {"candidateCount": len(payload["candidates"]), "eligibleCount": eligible, "rankedCount": len(results), "excludedCount": sum(reasons.values()), "rejectionReasons": dict(sorted(reasons.items()))}}
