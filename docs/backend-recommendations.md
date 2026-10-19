# Recommendation backend

Implemented October 18, 2026. Shared JSON schemas are in `src/contracts/recommendations.ts`. The UI is not wired to these APIs. Recommendations are deterministic preference indices, not AI-generated reviews or predicted restaurant ratings.

The user confirmed that **Something New excludes places already logged by anyone in the group. Our Favorites can recommend revisits.** A saved place with no visits is not considered logged.

## Public API

All routes require the existing `journal_profile` cookie, use private/no-store responses, ISO timestamp strings, strict authoritative validation and the common error envelope. Profiles are shared selections, **not authentication**: anyone with deployment access can select another friend. Run history is shared. Selected-profile checks constrain feedback and visit links as a convenience, not proof of identity. Mutations reject an explicitly different Origin.

| Method     | Path                                           | Behavior                                                                                                                                           |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST       | `/api/recommendations/runs`                    | Create a run with immutable attendees, filters and ranked results.                                                                                 |
| GET        | `/api/recommendations/runs?page=1&pageSize=20` | Shared summaries, newest creation timestamp then ID first; maximum page size 100. Returns pagination total/hasNextPage and each run's resultCount. |
| GET        | `/api/recommendations/runs/{id}`               | Full run, results, feedback and confirmed visit links.                                                                                             |
| GET        | `/api/recommendations/runs/{id}/attendees`     | Immutable attendee IDs.                                                                                                                            |
| GET        | `/api/recommendations/runs/{id}/results`       | Ranked result records.                                                                                                                             |
| GET / POST | `/api/recommendations/runs/{id}/feedback`      | Read feedback; write the selected attendee's current choice.                                                                                       |
| GET / POST | `/api/recommendations/runs/{id}/visits`        | Read confirmed links; link an existing matching visit. Does not create a visit.                                                                    |

Projection GET responses have `{ data, meta: { runId, status, algorithmVersion, scoreKind, scoreRange } }`. Creation, individual retrieval and successful feedback/link writes return `{ data: run }`. Errors use `{ error: { code, message, fieldErrors } }`, optionally with `error.details.runId` after a failed run was persisted. Unknown fields, repeated query parameters, malformed IDs, invalid attendees and invalid filter values are rejected. Route handlers also implement explicit method errors and OPTIONS.

Example creation body (generate a fresh UUID for each intentional run):

```json
{
  "requestId": "7a58a338-978a-4bb2-94b1-4db174a204c8",
  "mode": "favorites",
  "attendees": ["hieu", "nick"],
  "filters": {
    "cuisine": null,
    "kind": null,
    "maxPriceTier": null,
    "maxDistanceMeters": null,
    "openNowOnly": false
  },
  "query": "",
  "limit": 10
}
```

`mode` is `favorites` or `new`. Choose 1â€“5 unique predefined, seeded attendees. The creator need not attend. Filters, query and limit have the defaults shown. Limit is 1â€“20. Query is at most 160 trimmed characters and applies only to Something New; a nonempty Favorites query is rejected. Price tier is an integer 1â€“4; distance is nonnegative meters, at most 20,000,000; cuisine is an exact case-sensitive tag of at most 60 characters; kind is `restaurant` or `cafe`.

`requestId` is an idempotency key. An identical canonical request from the same selected creator reuses the original run, including when attendee/property order differs. A different creator or changed payload returns 409 `IDEMPOTENCY_CONFLICT`. Fresh runs return 201 and Location; retries return 200, or 202 while the first worker is pending. Retry the same ID after a transport failure to discover its persisted outcome; use a new ID for an intentional rerun using fresh journal/provider data.

Statuses are `pending`, `completed`, `empty`, `unavailable`, `failed`. An unconfigured provider or scorer is a persisted `unavailable` outcome with an explicit reason and no results, not an empty successful search. Provider/worker failures persist `failed` and return a sanitized error. Reading/listing expires workers left pending for over two minutes as `failed` / `worker-interrupted`; the same ID never silently recomputes changed inputs. No background retry system is implied.

## Inputs and hard filters

Next.js chooses one current rating per restaurant/profile with the shared `currentRatings` helper: latest visit date, then microsecond creation timestamp, then stable ID descending. Only that latest visit's nonmissing rating contributes; a previous rating is not substituted for a missing latest rating. Python receives decimal strings and rejects duplicate restaurant/profile votes. Recommendations use full current history; dashboard date filters do not carry into this request, and unsupported date fields are rejected.

Favorites candidates are saved journal places; a candidate needs at least one current attendee rating. Something New requires live provider candidates. Its exclusion sets contain the entire group's historical logged restaurant IDs, provider identities, and normalized name/address tuples, including nonattendees, archived profiles and places whose latest rating is missing. Any identity match excludes the place. Normalization follows the journal's manual duplicate rules; it is a likely-identity check, not geospatial entity resolution.

Hard filters run before scoring in `api/recommender/filters.py`. Cuisine/kind match exactly. Price/distance must satisfy the selected maximum. Unknown price, distance or opening hours cannot satisfy a filter requiring that information; open-now-only excludes closed and unknown hours. Journal Favorites have no live distance/hours, so those filters can honestly produce no eligible results. Missing candidate metadata is never converted to a numeric zero or a claim that a business is open.

## Deterministic scoring: recommendations-v1

`api/recommender/engine.py` has no network, database, clock or persistent state. Validation, hard filters and templated explanations are separate modules. Decimal arithmetic uses precision 80. Scores are clamped to 0â€“100 and rounded half-up to six fractional places. Sort by that returned score descending, then stable candidate key ascending. Journal keys are UUIDs; external keys are serialized provider/ID tuples. Input ordering and repeated cuisine tags do not change the result.

**Our Favorites:** let N be attendee count, k the number with a current score for the candidate, Î¼ their mean, C = k/N, and Ïƒ their population standard deviation. For k â‰¥ 2, agreement G = 1 âˆ’ Ïƒ/4.5. With one score, Ïƒ remains null and G uses a disclosed neutral 0.5 prior. With no scores, reject the candidate.

```text
favorite preference index = 70 Ã— (Î¼ âˆ’ 1)/9 + 20 Ã— C + 10 Ã— G
```

Only attendees vote; missing attendees are not assigned a rating. For example, current scores 10 and 6 from two attendees give Î¼=8, Ïƒ=2, C=1 and preference index 80. A lone score 10 among two attendees gives 85 with limited agreement evidence. These weights deliberately reward liking, coverage and agreement; the index is not an average rating.

**Something New:** normalize each attendee's current score as x=(ratingâˆ’1)/9. For each attendee/cuisine, use distinct restaurant evidence with a neutral prior of two observations:

```text
cuisine affinity = (sum(x) + 2 Ã— 0.5) / (observation count + 2)
```

For a candidate, average that attendee's affinities across its distinct cuisine tags; no tags/evidence gives neutral 0.5. A is the mean across attendees. C is the fraction of attendees with at least one current score in a matching cuisine. M is the known fraction of four metadata fields: nonempty cuisine tags, price, distance and open/closed state. Known closed hours count as known metadata, but fail open-now-only.

```text
new-place preference index = 80 Ã— A + 15 Ã— C + 5 Ã— M
```

With no history and only cuisine metadata, this is 41.25; the explanation explicitly identifies the neutral cold start. This is a preference heuristic with metadata completeness as a small tie influence, not an estimated review score, business quality or availability guarantee. Attendees without evidence contribute a neutral prior, not a fabricated personal rating. Duplicate tags cannot increase a cuisine's weight; multiple distinct cuisine tags each receive the place's current score.

Every result includes `scoreKind: preference-index` at run/projection level, range 0â€“100, algorithmVersion, decimal-string preferenceScore, metrics and explanations. Metrics distinguish observedMean (Favorites only), disagreement (requires two votes), cuisineAffinity (New only), coverage, evidence counts, coldStartAttendeeCount and metadataKnownCount. Missing metrics stay null. Explanations use numeric evidence and generic text, never stored provider listing text.

Counts include unique input candidates, eligible before the result limit, returned ranked count, excluded count and rejection reasons. A candidate gets one rejection reason, in filter priority order. `eligibleCount > rankedCount` indicates truncation; excludedCount does not include eligible places omitted by the result limit.

## Persistence and feedback

Migrations `0002` and `0003` add runs, attendees, ranked results, feedback and confirmed visit links. Run/attendee insertion and run/ranking completion each use one atomic PostgreSQL CTE statement compatible with Neon's HTTP driver; incomplete rankings are rolled back. Unique request IDs prevent duplicate retry runs. Rank and candidate identity are unique within a run. Results store the preference snapshot; editing/deleting visits affects future runs, not past scores. Saved restaurant display data/currentRating are refreshed from the journal when read and can therefore differ from historical run metrics.

Feedback POST body is `{ "resultId": "UUID", "choice": "selected" }` or `dismissed`. Only a selected profile who is an attendee can write. There is one current choice per attendee/run; changing it replaces that choice until a visit is confirmed. Feedback is persisted for inspection, not used as hidden training or scoring input.

Visit-link POST body is `{ "resultId": "UUID", "visitId": "UUID" }`. It requires the attendee's selected result, their own existing visit, matching saved restaurant or provider identity, a visit created on/after the run timestamp, and a visit date on/after the run's calendar date in APP_TIME_ZONE. Create the actual visit through the journal first. The visit row is locked while the link is checked/inserted. A visit can link to only one run; identical retries are idempotent. Other matches return 409 `INVALID_VISIT_LINK`. A composite foreign key locks confirmed feedback to that selection even if requests race.

Deleting a visit cascades its link. A migration trigger removes links when the visit's restaurant, profile or calendar date changes, including through legacy Server Actions. Rating/text/spending corrections retain the link. Once all links for that attendee/run are removed, feedback can be changed again. The custom trigger and prerequisite index ordering are intentional reviewed SQL additions beyond Drizzle's generated snapshot.

## Provider boundary and permitted storage

No provider or credentials are configured. `getRecommendationProvider()` returns null, and New returns `unavailable` / `discovery-unconfigured`. There is no fallback to journal candidates or fixtures. Existing restaurant search remains explicitly unconfigured too.

`src/server/recommendation-provider.ts` defines discover/getDetails plus a versioned retention policy. Before registering a real adapter, verify its current official terms, attribution rules and permission to retain identifiers **and derived preference scores**. The gate requires both permissions plus an HTTPS terms reference; it does not grant permission. A provider that cannot permit these records needs a different persistence design before enablement.

Only provider name, place ID, policy version, rank, derived numeric metrics and generic explanations may be persisted. Listing names, addresses, cuisine/price/hours/distance metadata, photos and attribution payloads are not stored. Candidate listing data is ephemeral during creation; later reads fetch details/attribution anew with the same permitted policy version. A refresh failure returns display.status `unavailable` while preserving the historical preference record. The Recommendations page shows returned attribution whenever it renders provider details, and does not persist or cache provider payloads. Provider results never auto-import restaurants. No actual provider's storage compliance is claimed while the adapter is unconfigured.

## Local Python setup

Use Python 3.12 (deployment pin in `api/.python-version`), create an isolated environment and install pinned runtime requirements:

```sh
python -m venv api/.venv
# Windows
api/.venv/Scripts/python -m pip install -r api/requirements.txt
# macOS/Linux: api/.venv/bin/python -m pip install -r api/requirements.txt
```

Set RECOMMENDER_URL=http://127.0.0.1:8001 and a cryptographically random RECOMMENDER_SHARED_SECRET of at least 32 characters in `.env.local` for Next.js. Export the **same secret into the Python process environment** before `npm run dev:recommender`; this runner does not load `.env.local`. Never prefix it with NEXT_PUBLIC_. Start Next separately with `npm run dev`. The runner finds `api/.venv` or PYTHON_EXECUTABLE, otherwise `python`. Python's development server binds loopback, with debugging disabled.

Next posts to `/score` server-to-server with Bearer authorization, no cache, no redirects and a ten-second timeout. The Python WSGI app rejects missing/short configuration with 503 and invalid credentials with 401 before processing input; no credentials or upstream error bodies are returned/logged. It enforces a 2 MB JSON limit, strict fields, no nonfinite numbers/duplicate JSON keys, and bounded attendee/rating/candidate arrays. Large journals fail explicitly; input is never silently truncated. The scoring module can be tested without Flask or Vercel.

## Vercel configuration and verified guidance

Official guidance was checked October 18, 2026: [Python runtime](https://vercel.com/docs/functions/runtimes/python), [Services](https://vercel.com/docs/services), [service configuration](https://vercel.com/docs/services/config-reference). Python supports a WSGI `app` entrypoint and `.python-version`; combining Python with a frontend uses Services. Services is currently Beta. This repo uses the current `services` configuration rather than the older experimental format.

`vercel.json` declares web (Next.js at root) and recommender (Flask at api, index:app). Only web has a public rewrite. A service binding injects RECOMMENDER_URL into web; no public route exposes Python. The Python function has a 30-second duration cap and excludes tests/local environments from its bundle. Set the same server-only shared secret for both services in every intended Vercel environment; do not override the injected URL with a localhost value in Vercel. Configure Neon separately and apply migrations/seeds before testing. No database migration runs at build/request time.

The current configuration is prepared from the official reference and checked locally. No Vercel deployment/build, private cloud binding, production cold start or live Neon/provider request was exercised. Services Beta availability/configuration must be checked during the eventual preview deployment. Local Python tests ran on the available isolated Python 3.15 interpreter; the pinned Vercel Python 3.12 runtime was not available for a local test.

## Verification and integration handoff

Run `npm test`, `npm run test:python`, `npm run test:recommendations:e2e`, lint, typecheck and build. Tests apply committed migrations to disposable PGlite PostgreSQL. The E2E starts a real private Python HTTP process and calls the Next.js server module, verifying persisted rankings, exclusions, feedback and a confirmed visit. Provider candidates in tests are explicit fixtures; no production discovery fixtures exist. `tests/backend/http-smoke.mjs` verifies deployed Next route behavior without creating journal data.

The Recommendations page consumes the shared schemas, labels indices as preferences rather than ratings, shows unavailable/failed outcomes, renders provider attribution when configured, and records current-profile feedback for attendees. Attendees are immutable; create a new run to change them. Browser-triggered transport retries should reuse the same request ID; each intentional new run gets a fresh ID. Exact checks and remaining environment limits are recorded in [backend progress](backend-progress.md) and [UI progress](ui-progress.md).

