# Dashboard and analytics API

Shared schemas/types: `src/contracts/reporting.ts`. These endpoints use the existing `journal_profile` cookie, common JSON error envelope, no-store headers, and honest missing-database errors documented in `backend-api.md`. Selection is a shared convenience, not authentication.

## Endpoints and filters

| Endpoint             | Returned data                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/dashboard` | Counts, current-score average, recent visits with restaurant/profile labels, personal recently reviewed places with latest visit and current summary, filter options, metadata. |
| `GET /api/analytics` | Counts, current-score average, current restaurant leaderboard, historical daily timeline, friend comparison, cuisine preferences, recorded spending, filter options, metadata.  |

Both return `{ "data": { ... } }`. Both accept the same filters:

| Query          | Behavior                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`         | `group` (default) or `personal`.                                                                                                                                                                                                              |
| `profileId`    | Only valid with `view=personal`; defaults to the selected cookie profile. Can reference any profile retained in the database, including an archived friend. Group requests with this parameter are rejected rather than silently ignoring it. |
| `restaurantId` | UUID for one saved restaurant. Missing IDs return `404 NOT_FOUND`.                                                                                                                                                                            |
| `cuisine`      | Exact, case-sensitive stored tag; combines with restaurant/profile/date filters. Unknown tags produce an honest empty result.                                                                                                                 |
| `start`, `end` | Optional ISO calendar dates, inclusive. Start must not follow end. Empty/invalid dates are rejected; omit unused parameters. Future ranges are allowed and can be empty.                                                                      |
| `recentLimit`  | Dashboard only: default 6, range 1–50. Applies separately to both recent lists.                                                                                                                                                               |

Unknown/repeated query fields and invalid scopes/dates/limits return `400 INVALID_QUERY` with field errors. A missing viewed profile returns `404 NOT_FOUND`. A missing/invalid selected cookie returns `401 PROFILE_REQUIRED`, even if a viewed profile is supplied.

The current UI query names `profile` and `restaurant` must be mapped to `profileId` and `restaurantId` in a future client adapter. This backend prompt does not modify UI forms or legacy reads/actions.

## Date and rating semantics

Current metrics first choose one visit per restaurant/profile **on or before end**, ordered by visit date descending, creation instant descending (including PostgreSQL microseconds), then UUID descending. Only after selection do they require a visit date on or after start and a non-null rating. An older rating is never substituted for a latest missing rating. Restaurant/profile/cuisine restrictions apply consistently before selection.

Historical metrics include every visit whose date falls inside the inclusive range, including repeat visits and multiple visits on one day. They are not averages of current scores. With no bounds, the complete stored history is used. Missing ratings/spending never become zero.

Both endpoints share one SQL CTE definition for filtered places, historical visits, ranked visits, current scores and counts. All values in a response come from a **single PostgreSQL statement/snapshot**. SQL numeric arithmetic retains 80 fractional digits for rating aggregates; JSON aggregates are decimal strings, normalized without rounding to display precision. Individual visit ratings remain JSON numbers. Population standard deviation requires at least two current scores.

SQL parity tests compare results with the existing `src/lib/ratings.ts` / `src/lib/analytics.ts` calculations, including rounding-boundary precision. No legacy helper or UI calculation was changed.

## Counts and metadata

| Count                            | Meaning                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `savedRestaurantCount`           | Saved directory places matching only restaurant/cuisine filters. Independent of dates and reviewer, including unreviewed places. |
| `visitedRestaurantCount`         | Distinct places with historical visits in the selected reviewer/date range.                                                      |
| `historicalVisitCount`           | All visits in that range.                                                                                                        |
| `historicalReviewerCount`        | Distinct people with historical visits in that range.                                                                            |
| `currentScoreCount`              | Recorded latest scores passing the current-rating date rule; one per person/place.                                               |
| `currentReviewerCount`           | Distinct people contributing those current scores.                                                                               |
| `currentlyRatedRestaurantCount`  | Distinct places contributing current scores.                                                                                     |
| `personalVisitCount`             | Historical visits for the personal section's profile within the filters.                                                         |
| `personalVisitedRestaurantCount` | Distinct historical places for that profile within the filters.                                                                  |

`currentAverage` averages current **person/place scores**; each place can contribute several friends' scores. It is not an unweighted average of leaderboard restaurant averages. Each restaurant leaderboard average gives each reviewing person one vote.

`meta` echoes effective filters (unused fields are null), selectedProfileId, personalProfileId, application timezone/today, and machine-readable metric semantics. In group view the personal dashboard section uses the selected cookie profile; in personal view it uses the viewed profile. This is explicit in `personalProfileId`.

`filterOptions` contains all saved restaurant references, distinct cuisine tags, and database profile references including archived people. These lists deliberately do not shrink with filters, so an empty result does not erase the controls needed to change filters. They are view options, not an authentication/profile-selection API.

Counts can legitimately be zero. Missing averages/deviations/spending remain null. New API consumers should preserve these distinctions in labels, charts and accessible tables.

Analytics also reports recommendation activity: selected and dismissed feedback counts, unique selections with at least one linked visit, filtered linked visit count, linked profile count, and nullable linked-selection percentage. Feedback is counted once per feedback row; linked visits are counted independently, so multiple links cannot multiply selection totals. Feedback is date-filtered by recommendation-run creation day in the report timezone; linked visits use the same inclusive visit-date, profile, restaurant, and cuisine filters as other visit analytics. These semantics are included in `meta.semantics.recommendationActivity`.

## Dashboard lists

`recentVisits` and `recentlyReviewedPlaces` each return `{ data, limit, total, hasMore }`. Totals are independent of the list limit. These are bounded previews, not complete paginated visit history; `/api/visits` supplies that history.

- Recent visits are historical visits in scope, ordered by visit date/creation instant/ID descending. Each includes the ordinary visit DTO, an embedded restaurant DTO and a profile reference; money is integer cents.
- Personal places contain **one latest personal scored visit per restaurant**, with the same end-then-start rule. A return visit never creates an additional place row. Each item includes the restaurant, latestVisit, and currentRating average/agreement/reviewerCount/visitCount for the effective report scope. In group view that summary is the group's; in personal view it is the viewed person's.
- Sorting uses that personal visit's date/creation instant/ID, not a friend's more recent visit or the date the restaurant was saved.

## Analytics series

- `leaderboard`: only places with current scores; descending numeric average, then name and stable restaurant ID. Each row has average, agreement, reviewerCount and historical visitCount.
- `timeline`: ascending visit date; daily historical rating average plus visitCount, ratedVisitCount, distinct reviewerCount and distinct restaurantCount. Multiple return visits on a day all count. Days without visits are omitted, rather than invented zero points. A day containing only missing imported ratings has a null average.
- `comparison`: stable profile IDs and names, current placeCount, current average, historical visitCount. All database friends appear in group view, including null-average rows for friends without scores; personal view contains only the viewed friend. Friends may have reviewed different sets of places. Identical display names do not merge people.
- `cuisines`: distinct restaurant/tag memberships are established before joins. Repeated tags on a place never duplicate scores or visits. A place with several different tags contributes to each relevant tag, so category counts must not be summed into group totals. Each row provides average, current scoreCount, distinct reviewerCount/current restaurantCount, and historical visitCount. Tags without current scores retain a null average.
- `spending`: historical recordedVisitCount, USD totalCents and averageCents; missing amounts are excluded, recorded zero is included. Average is rounded half up to the nearest integer cent (`averageRounding` states the policy); totals remain exact. These are per-person recorded amounts, not receipts or a total group bill. Values must fit JSON-safe integers; unsafe aggregates fail validation instead of silently losing precision.

Analytics series and filter options are complete for this small journal; there are no hidden top-N cuts. Dashboard preview truncation is explicit. SQL independently aggregates current, historical and cuisine memberships before joining, avoiding many-to-many row inflation.

## Verification and handoff

Backend SQL tests apply the committed migrations to PGlite PostgreSQL and exercise return visits, category duplicates, equal display names, as-of cutoffs, precision, microsecond/ID ordering, deletion fallback, archived profiles, nulls, recorded zero, filters and empty datasets. A controlled test temporarily permits a null rating to verify defensive imported-data behavior; production migration/API rating requirements remain unchanged.

The analytics page consumes this API server-side, maps the UI's `profile` and `restaurant` query names to `profileId` and `restaurantId`, formats cents only at display time, preserves null people/categories, and shows recommendation activity. Existing restaurant/visit contracts and exact cuisine/archived profile support remain intact.

The UI integration maps filter names and preserves nullable friend/cuisine rows. Live database-driven browser verification still requires a configured disposable Neon branch.

Live Neon verification requires a configured disposable database. PostgreSQL integration results do not establish Neon connectivity or browser integration.

Implementation references: [PostgreSQL window functions](https://www.postgresql.org/docs/current/tutorial-window.html), [PostgreSQL aggregates](https://www.postgresql.org/docs/current/functions-aggregate.html).
