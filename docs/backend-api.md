# Restaurant and visit API

Dashboard and analytics endpoints are documented separately in [Reporting API behavior](backend-reporting-api.md), with shared schemas in `src/contracts/reporting.ts`.

Contract source: `src/contracts/journal.ts`. The UI consumes these schemas without editing them. Restaurant and visit mutations are wired to these endpoints; legacy Server Actions remain available and use decimal-dollar strings. Server-rendered directory/detail reads still use the repository.

## Common conventions

- Every endpoint requires a valid predefined profile in the existing `journal_profile` cookie. Use the existing profile selector to set it. Missing/invalid selection returns `401 PROFILE_REQUIRED`, never an HTML redirect.
- **This is not authentication.** Anyone with journal access can select any friend. All profiles can read the shared journal; only the currently selected profile can update/delete that profile's visits. The profile ID for new visits comes from the cookie. Body-supplied profile IDs are rejected.
- JSON writes require `Content-Type: application/json`; bodies are limited to 16 KiB. Cross-origin browser writes are rejected. Requests and query objects reject unknown fields and repeated query parameters.
- Calendar dates are ISO `YYYY-MM-DD`; timestamps are ISO strings, retaining PostgreSQL fractional seconds. IDs are UUID strings. All monetary fields are integer **USD cents**, named `amountSpentCents`. `null` means unrecorded; `0` is a recorded zero. Maximum is `999999999999` cents, matching existing storage. Decimal.js converts cents to/from PostgreSQL `numeric(12,2)` exactly; no storage migration is needed.
- Ratings are JSON numbers from 1 through 10, including any decimal; there is no fixed increment (user confirmed). Summary averages/deviations are decimal strings or `null`, preserving precision before display. Ratings are calculated from stored decimal values before serialization.
- Collection responses: `{ "data": [], "pagination": { "page": 1, "pageSize": 20, "total": 0, "hasNextPage": false } }`. Default page size 20, maximum 100; page range 1â€“1000000. Pages beyond the end are empty. Offset pagination has stable sorting for an unchanged dataset; insertions/deletions between requests can move items between pages.
- Single records: `{ "data": { ... } }`. Creates return `201` with a `Location` header. Reads/updates/deletes return `200`. Responses use `Cache-Control: private, no-store`; successful writes invalidate the existing journal layout cache.
- Errors: `{ "error": { "code": "...", "message": "...", "fieldErrors": {} } }`. Validation errors map field paths to string arrays; object-level errors use `_form`. Duplicate errors may also include `error.details.duplicates`, an array of `{ id, name, address }`.
- Statuses: `400` invalid JSON/query/ID, `401` profile required, `403` wrong selected profile/origin, `404` missing resource, `409` duplicate/provider identity or unseeded profile, `413` oversized body, `415` wrong media type, `422` invalid body, `502` provider failure, `503` database unavailable/unconfigured, `500` unexpected failure. `405` errors use the same envelope. Framework `HEAD`/`OPTIONS` responses are bodyless HTTP responses.
- A missing database returns `503 DATABASE_UNCONFIGURED`. A query failure returns `503 DATABASE_UNAVAILABLE`; no sample data replaces either. Unrecognized internal errors return a sanitized `500`.

## Restaurants

| Method/path                 | Request                                                                    | Result                                                                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/restaurants`      | Optional `q`, `kind=restaurant\|cafe`, exact `cuisine`, `page`, `pageSize` | Saved places with current-rating summaries. Literal case-insensitive search covers name, address, kind and cuisine tags. The cuisine filter matches an entire stored tag, case-sensitively, and combines with other filters. Sort: normalized name ascending, then ID ascending. |
| `POST /api/restaurants`     | JSON below                                                                 | Created saved restaurant and empty summary.                                                                                                                                                                                                                                      |
| `GET /api/restaurants/{id}` | UUID                                                                       | Restaurant plus its current scores, group average, agreement, reviewer count and total historical visit count.                                                                                                                                                                   |
| `GET /api/places/search`    | Required `q`, optional `page`, `pageSize`                                  | Explicit provider configuration state and external results, separate from saved places.                                                                                                                                                                                          |

```json
{
  "name": "Cafe Moon",
  "address": "123 Main Street",
  "kind": "cafe",
  "cuisines": ["Coffee", "Brunch"],
  "priceTier": null,
  "provider": null,
  "providerPlaceId": null,
  "confirmDuplicate": false
}
```

Only name and address are required. Names allow 160 characters, addresses 300, cuisine arrays eight entries of up to 60 characters each; names/addresses must contain letters or numbers. Kind defaults to `restaurant`; price tier is optional `null` or 1â€“4. This listed price tier is separate from recorded spending.

Potential manual duplicates match **both** normalized name and normalized address, using the existing Unicode/accent/case/punctuation/whitespace normalization. `409 POSSIBLE_DUPLICATE` returns up to 20 saved matches. Open a returned ID, or explicitly resubmit with `confirmDuplicate: true` for a different place. This is an advisory lookup, not a unique constraint; simultaneous manual submissions can both pass the warning check.

Provider and providerPlaceId must both be present or both `null`. Provider names are trimmed and lowercased; IDs are trimmed and case-sensitive. A PostgreSQL unique index guarantees provider/ID uniqueness even for racing requests. `confirmDuplicate` cannot bypass it; conflicts return `409 PROVIDER_ID_CONFLICT`. Caller-supplied references are not a claim that a provider lookup verified the place. No provider is currently configured.

`src/server/place-provider.ts` defines `PlaceProviderAdapter`: paginated `search` and `getDetails`, with provider identity and attribution in every external result. Implement the provider's storage, attribution and caching rules before registration. External search does not persist results. Without an adapter, a valid search returns `200`:

```json
{
  "status": "unconfigured",
  "provider": null,
  "message": "External place search is not configured. Search saved places or create a manual entry.",
  "data": [],
  "pagination": { "page": 1, "pageSize": 20, "total": 0, "hasNextPage": false }
}
```

## Visits

| Method/path               | Request                                                                             | Result                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/visits`         | Optional `restaurantId`, configured `profileId`, `start`, `end`, `page`, `pageSize` | Historical visits, inclusive date filters. Sort: visit date, creation instant, ID, all descending.                                                           |
| `POST /api/visits`        | JSON below                                                                          | A new visit for the selected profile. Return visits create additional records.                                                                               |
| `GET /api/visits/{id}`    | UUID                                                                                | A visit visible to the shared journal, regardless of selected profile.                                                                                       |
| `PATCH /api/visits/{id}`  | One or more mutable fields below                                                    | Correct an existing visit belonging to the selected profile.                                                                                                 |
| `DELETE /api/visits/{id}` | UUID; no body                                                                       | `{ "data": { "id": "...", "restaurantId": "...", "deleted": true } }`. UI must obtain its normal browser deletion confirmation before calling this endpoint. |

```json
{
  "restaurantId": "10000000-0000-4000-8000-000000000001",
  "rating": 8.04,
  "visitDate": "2026-10-17",
  "reviewText": "Good coffee",
  "orderDescription": "Iced latte",
  "amountSpentCents": 650
}
```

Required: existing restaurant, rating, real non-future visit date. Date validation uses `APP_TIME_ZONE` (default America/Los_Angeles), with the existing database UTC bound as an additional constraint. Reviews allow 2000 characters; order descriptions allow 300. Optional text is trimmed and blank text becomes `null`. Optional spending defaults to `null`. Negative/fractional cents and decimal-dollar fields are rejected. The selected profile must have been seeded before creating a visit.

Response profile IDs are strings, so retained records remain readable after a profile is removed from the selectable configuration. Cookie selection and the optional profile query filter still validate against the configured profiles.

PATCH accepts only rating, visitDate, reviewText, orderDescription, amountSpentCents. Omitted fields remain unchanged; explicit `null` clears an optional field. Restaurant, profile, currency, creation timestamp and ID cannot be changed. Creation time is preserved; updatedAt advances. Currency is always USD. Read/delete of a missing visit returns `404`; repeated delete also returns `404`.

## Current ratings

`src/lib/ratings.ts` remains the shared calculation source used by both the existing UI and the new API serializers. API code does not implement a parallel scoring rule or persist averages.

1. For each restaurant/profile pair, select the latest visit by visit date descending, creation instant descending (including PostgreSQL microseconds), stable ID descending.
2. Give each person one current score per restaurant. Exclude missing scores from averages; no scores means `null`, not zero.
3. Compute averages with Decimal.js without rounding intermediates. Agreement is population standard deviation, available only for at least two reviewers.
4. Summaries use all history, independent of paginated visit lists. Deleting the latest visit naturally restores the previous current score; deleting all visits produces an empty summary.

## Handoff

Recommendation contracts, deterministic Python scoring, run/feedback persistence and configuration are documented in [recommendation backend](backend-recommendations.md). Dashboard/analytics behavior is documented in [reporting APIs](backend-reporting-api.md).

Grounded review summary behavior, cache invalidation, model configuration and manual factual-support checklist are documented in [review summaries](backend-review-summaries.md).

The UI now consumes the exported restaurant/visit schemas for writes, converts entered USD strings to exact integer cents at the client boundary, handles duplicate confirmation, and renders common API errors. Existing server-side page reads remain in place for directory/detail views; they do not substitute demo data when the database is missing. See `docs/ui-progress.md` for integrated flows and setup-dependent verification.

## Local checks

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. Backend tests are isolated under `tests/backend/`; `npm test -- tests/backend` runs just those suites.

After building, start a temporary production server with `npm start -- --port 3101`. In another terminal run `node tests/backend/http-smoke.mjs` (override `BACKEND_SMOKE_BASE_URL` to use another address). This HTTP check performs only reads and deliberately invalid writes, so it does not create fictional journal records. The default unconfigured-database environment verifies honest setup errors. Successful live CRUD still requires a configured disposable Neon database and browser integration; PGlite tests do not verify Neon connectivity.

Implementation references: [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Drizzle query filters](https://orm.drizzle.team/docs/operators), and [Drizzle conflict handling](https://orm.drizzle.team/docs/insert#on-conflict-do-nothing).


The October 18, 2026 UI integration update supersedes earlier notes above saying UI API wiring was pending. The current UI consumes restaurant/visit write contracts, analytics reporting, persisted recommendation feedback, and grounded summary responses. Server-rendered restaurant/place reads remain on the repository path.
