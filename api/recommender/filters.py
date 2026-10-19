"""Hard constraints run before scoring. Unknown required metadata fails closed."""
import json


def rejection(candidate, filters, excluded):
    if candidate["restaurantId"] in excluded["restaurantIds"]:
        return "already-logged"
    provider_key = json.dumps([candidate["provider"], candidate["providerPlaceId"]], separators=(",", ":"), ensure_ascii=False)
    if candidate["provider"] and provider_key in excluded["providerKeys"]:
        return "already-logged"
    if candidate["normalizedKey"] in excluded["normalizedKeys"]:
        return "already-logged"
    if filters["cuisine"] and filters["cuisine"] not in set(candidate["cuisines"]):
        return "cuisine"
    if filters["kind"] and candidate["kind"] != filters["kind"]:
        return "kind"
    if filters["maxPriceTier"] is not None:
        if candidate["priceTier"] is None:
            return "unknown-price"
        if candidate["priceTier"] > filters["maxPriceTier"]:
            return "price"
    if filters["maxDistanceMeters"] is not None:
        if candidate["distanceMeters"] is None:
            return "unknown-distance"
        if candidate["distanceMeters"] > filters["maxDistanceMeters"]:
            return "distance"
    if filters["openNowOnly"] and candidate["openNow"] is not True:
        return "unknown-hours" if candidate["openNow"] is None else "closed"
    return None
