"""Explanations use numeric evidence, never provider names or cached listing text."""


def explain(mode, metrics, attendee_count):
    if mode == "favorites":
        messages = [{"code": "observed-ratings", "message": f"{metrics['ratedAttendeeCount']} of {attendee_count} friends coming have rated this place."}]
        if metrics["ratedAttendeeCount"] < attendee_count:
            messages.append({"code": "group-fallback", "message": f"Uses the group’s current ratings for {attendee_count - metrics['ratedAttendeeCount']} friends who haven’t rated this place yet."})
        if metrics["disagreement"] is None:
            messages.append({"code": "limited-agreement", "message": "Fewer than two attendees have rated this place, so agreement is unknown."})
    else:
        messages = [{"code": "cuisine-preferences", "message": f"{metrics['preferenceAttendeeCount']} of {attendee_count} attendees have current scores for a matching cuisine. This is a preference estimate, not a predicted rating."}]
        if metrics["preferenceAttendeeCount"] < attendee_count:
            messages.append({"code": "neutral-prior", "message": "Missing cuisine evidence uses an explicit neutral prior, not an invented personal rating."})
    if metrics["coldStartAttendeeCount"]:
        messages.append({"code": "cold-start", "message": f"{metrics['coldStartAttendeeCount']} attendees have no current ratings in the journal."})
    return messages
