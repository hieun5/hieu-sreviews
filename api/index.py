"""Private Vercel WSGI endpoint. Scoring modules have no Flask dependency."""
import hmac
import json
import os
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from recommender.engine import recommend
from recommender.validation import ValidationError


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 2_000_000

    def error(code, message, status, fields=None):
        return jsonify(error={"code": code, "message": message, "fieldErrors": fields or {}}), status

    @app.before_request
    def authorize():
        secret = os.environ.get("RECOMMENDER_SHARED_SECRET", "")
        if len(secret) < 32:
            return error("RECOMMENDER_UNCONFIGURED", "Recommendation service is not configured.", 503)
        supplied = request.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode(), ("Bearer " + secret).encode()):
            return error("UNAUTHORIZED", "Service authorization is required.", 401)

    @app.after_request
    def no_store(response):
        response.headers["Cache-Control"] = "private, no-store"
        return response

    @app.post("/score")
    def score():
        if request.mimetype != "application/json":
            return error("UNSUPPORTED_MEDIA_TYPE", "Send application/json.", 415)
        try:
            # Reject non-standard NaN/Infinity and duplicate JSON object keys.
            def pairs(items):
                result = {}
                for key, value in items:
                    if key in result:
                        raise ValueError("Repeated field")
                    result[key] = value
                return result

            payload = json.loads(request.get_data(), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite number")), object_pairs_hook=pairs)
        except (ValueError, UnicodeDecodeError):
            return error("INVALID_JSON", "Send valid JSON without duplicate fields.", 400)
        try:
            return jsonify(data=recommend(payload))
        except ValidationError as invalid:
            return error("VALIDATION_ERROR", "Check the request fields.", 422, invalid.field_errors)

    @app.errorhandler(HTTPException)
    def http_error(exc):
        codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "PAYLOAD_TOO_LARGE"}
        return error(codes.get(exc.code, "INVALID_REQUEST"), "Request could not be processed.", exc.code)

    @app.errorhandler(Exception)
    def unexpected(_exc):
        # No request bodies, provider content, or secrets enter logs.
        return error("INTERNAL_ERROR", "Recommendation scoring failed.", 500)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8001")), debug=False)
