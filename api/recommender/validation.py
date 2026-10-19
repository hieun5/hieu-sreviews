"""Strict, bounded internal contract; never trusts the shared secret as validation."""
import re
from decimal import Decimal, InvalidOperation


class ValidationError(ValueError):
    def __init__(self, field, message):
        super().__init__(message)
        self.field_errors = {field: [message]}


def require(condition, field, message):
    if not condition:
        raise ValidationError(field, message)


def obj(value, fields, field):
    require(isinstance(value, dict) and set(value) == set(fields), field, "Supply exactly the documented fields.")


def text(value, field, maximum=100):
    require(isinstance(value, str) and 0 < len(value) <= maximum, field, "Supply a bounded nonempty string.")


def number(value, field, minimum, maximum, integer=False):
    require(type(value) in (int, float), field, "Supply a number.")
    require(not integer or type(value) is int, field, "Supply an integer.")
    require(minimum <= value <= maximum, field, "Number is outside the supported range.")


def validate(payload):
    obj(payload, ["mode", "attendees", "ratings", "places", "candidates", "excluded", "filters", "limit"], "_form")
    require(payload["mode"] in ("favorites", "new"), "mode", "Choose favorites or new.")
    attendees = payload["attendees"]
    require(isinstance(attendees, list) and 1 <= len(attendees) <= 5, "attendees", "Choose one to five attendees.")
    for item in attendees:
        text(item, "attendees")
    require(len(set(attendees)) == len(attendees), "attendees", "Attendees must be unique.")
    number(payload["limit"], "limit", 1, 20, integer=True)
    require(isinstance(payload["places"], list) and len(payload["places"]) <= 5000, "places", "Too many places.")
    place_ids = set()
    for place in payload["places"]:
        obj(place, ["restaurantId", "cuisines"], "places")
        text(place["restaurantId"], "places.restaurantId")
        require(place["restaurantId"] not in place_ids, "places", "Place IDs must be unique.")
        place_ids.add(place["restaurantId"])
        cuisines(place["cuisines"], "places.cuisines")
    require(isinstance(payload["ratings"], list) and len(payload["ratings"]) <= 25000, "ratings", "Too many current scores.")
    pairs = set()
    for rating in payload["ratings"]:
        obj(rating, ["restaurantId", "profileId", "rating"], "ratings")
        text(rating["restaurantId"], "ratings.restaurantId")
        text(rating["profileId"], "ratings.profileId")
        require(rating["restaurantId"] in place_ids, "ratings.restaurantId", "Current scores require a known place.")
        pair = (rating["restaurantId"], rating["profileId"])
        require(pair not in pairs, "ratings", "Supply one current score per person/place.")
        pairs.add(pair)
        value = rating["rating"]
        require(isinstance(value, str) and len(value) <= 32 and re.fullmatch(r"\d+(?:\.\d+)?", value) is not None, "ratings.rating", "Supply a decimal rating string.")
        try:
            valid = Decimal(1) <= Decimal(value) <= Decimal(10)
        except InvalidOperation:
            valid = False
        require(valid, "ratings.rating", "Ratings must be from 1 to 10.")
    require(isinstance(payload["candidates"], list) and len(payload["candidates"]) <= 1000, "candidates", "Too many candidates.")
    keys = set()
    for candidate in payload["candidates"]:
        obj(candidate, ["key", "restaurantId", "provider", "providerPlaceId", "normalizedKey", "kind", "cuisines", "priceTier", "distanceMeters", "openNow"], "candidates")
        text(candidate["key"], "candidates.key", 1000)
        require(candidate["key"] not in keys, "candidates", "Candidate keys must be unique.")
        keys.add(candidate["key"])
        text(candidate["normalizedKey"], "candidates.normalizedKey", 2000)
        require(candidate["kind"] in ("restaurant", "cafe"), "candidates.kind", "Unsupported place kind.")
        cuisines(candidate["cuisines"], "candidates.cuisines")
        for key, maximum in [("restaurantId", 100), ("provider", 80), ("providerPlaceId", 300)]:
            if candidate[key] is not None:
                text(candidate[key], "candidates." + key, maximum)
        require((candidate["provider"] is None) == (candidate["providerPlaceId"] is None), "candidates.provider", "Provider references must be paired.")
        require(candidate["restaurantId"] is not None or candidate["provider"] is not None, "candidates", "Supply a journal or provider identity.")
        if candidate["priceTier"] is not None:
            number(candidate["priceTier"], "candidates.priceTier", 1, 4, integer=True)
        if candidate["distanceMeters"] is not None:
            number(candidate["distanceMeters"], "candidates.distanceMeters", 0, 20_000_000)
        require(candidate["openNow"] is None or type(candidate["openNow"]) is bool, "candidates.openNow", "Supply true, false, or null.")
    obj(payload["excluded"], ["restaurantIds", "providerKeys", "normalizedKeys"], "excluded")
    for field, items in payload["excluded"].items():
        require(isinstance(items, list) and len(items) <= 5000, "excluded." + field, "Supply a bounded exclusion list.")
        for item in items:
            text(item, "excluded." + field, 2000)
    filters = payload["filters"]
    obj(filters, ["cuisine", "kind", "maxPriceTier", "maxDistanceMeters", "openNowOnly"], "filters")
    if filters["cuisine"] is not None:
        text(filters["cuisine"], "filters.cuisine", 60)
    require(filters["kind"] in (None, "restaurant", "cafe"), "filters.kind", "Unsupported place kind.")
    if filters["maxPriceTier"] is not None:
        number(filters["maxPriceTier"], "filters.maxPriceTier", 1, 4, integer=True)
    if filters["maxDistanceMeters"] is not None:
        number(filters["maxDistanceMeters"], "filters.maxDistanceMeters", 0, 20_000_000)
    require(type(filters["openNowOnly"]) is bool, "filters.openNowOnly", "Supply a boolean.")
    return payload


def cuisines(value, field):
    require(isinstance(value, list) and len(value) <= 8, field, "Supply up to eight cuisine tags.")
    for item in value:
        text(item, field, 60)
