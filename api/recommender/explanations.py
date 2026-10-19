"""Explanations use numeric evidence, never provider names or cached listing text."""


def explain(mode, metrics, attendee_count):
    if mode == "favorites":
        messages = [{"code": "observed-ratings", "message": f"Based on {metrics['ratedAttendeeCount']} of {attendee_count} attendees' current scores; this preference index is not a restaurant rating."}]
        if metrics["disagreement"] is None:
            messages.append({"code": "limited-agreement", "message": "Only one attendee has a current score here, so disagreement is unknown."})
    else:
        messages = [{"code": "cuisine-preferences", "message": f"{metrics['preferenceAttendeeCount']} of {attendee_count} attendees have current scores for a matching cuisine. This is a preference estimate, not a predicted rating."}]
        if metrics["preferenceAttendeeCount"] < attendee_count:
            messages.append({"code": "neutral-prior", "message": "Missing cuisine evidence uses an explicit neutral prior, not an invented personal rating."})
    if metrics["coldStartAttendeeCount"]:
        messages.append({"code": "cold-start", "message": f"{metrics['coldStartAttendeeCount']} attendees have no current ratings in the journal."})
    return messages
