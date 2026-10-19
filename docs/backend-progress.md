# Backend progress

Updated: October 18, 2026.

## Current prompt and decisions

Implement deterministic Python recommendations, a private Vercel-compatible scoring endpoint, Next.js orchestration, recommendation run/attendee/ranking/feedback/confirmed-visit persistence, provider boundaries, tests and deployment documentation.

The user confirmed: **exclude logged places only from Something New; Favorites can revisit them.** Prior to the separate UI integration prompt, no AI generation or recommendation UI was added; the current integration status is recorded in the update below.

## Ownership and coordination

- Read repository instructions/files and docs/ui-progress.md before work; revisited progress and integration notes during final checks. No repository AGENTS.md was found during instruction inspection.
- Backend owns API routes, src/server, src/db, src/contracts, Python, migrations/seeds, environment examples and backend documentation. Backend exclusively manages dependencies, package/lock files and deployment/TypeScript/Next configuration.
- UI owns pages, root layout/CSS, components, src/lib/client, public and docs/ui-progress.md. None were edited by this session. Legacy helpers/actions and generic tests were also left unchanged; existing rating/date/normalization helpers are imported.
- Read the UI's integration requests. Existing cuisine filters, historical-profile IDs, reporting labels/nullability and integer-cent boundaries remain supported. No dependency request file or pending dependency requests exist. The UI owner confirmed no edits or requests were pending.
- Coordinated the shared .next slot before type generation/build. UI explicitly released it. Final build and HTTP checks completed; the temporary production server stopped and the slot was returned. No conflicting source edits or outstanding checks blocked by concurrent work were found.
- Shared the recommendation contract draft and final documentation with the UI owner. UI integration awaits its own user prompt. README backend/setup/deployment updates were announced before editing.
- No commits, deployments, stashes, reverts or cleanup of the other session's changes. All project files remain untracked in the pre-existing unborn repository; no clean Git diff is available.

## Completed

- Independently testable Python validation, hard filters, Decimal scoring and generic numerical explanations. No scoring I/O, clock, randomness, mutable global state or model calls.
- Favorites uses attendees' canonical current ratings, coverage and population disagreement. Missing votes remain missing; one vote uses a disclosed neutral agreement prior; no votes produce no ranked candidate.
- Something New uses smoothed cuisine preferences, evidence coverage and metadata completeness. Excludes the entire group's historical logged identities, including nonattendees and archived profiles, by saved ID, provider ID and normalized name/address tuple.
- Scores are versioned preference indices from 0 to 100, not actual/predicted ratings. Stable sorting and six-decimal half-up rounding are documented. Counts distinguish candidates, eligible before limit, returned and excluded, with rejection reasons.
- Strict public request/response contracts, explicit defaults/limits/nulls, immutable attendees, common errors, ISO timestamps and shared pagination. Repeated visits are reduced with existing canonical current-rating logic before Python input.
- Server-to-server scoring uses a server-only shared secret, no-store, redirect rejection, timeout, response validation and sanitized errors. Python validates independently, rejects duplicate/nonfinite JSON, enforces size/array bounds and checks the secret before input processing.
- Five tables persist runs, attendees, ranked results, each attendee's current selection/dismissal, and confirmed visit links. Atomic CTE writes work with Neon's HTTP driver. Idempotency keys reuse outcomes and prevent duplicate runs; interrupted pending workers expire honestly instead of silently rescoring new inputs.
- Feedback checks selected attendee, run/result membership and completed state. Confirmed links require a selected result, matching attendee/restaurant/provider, a visit recorded after the run and an appropriate calendar date. Visit locking and composite foreign keys protect selection/link integrity. Visit deletion cascades links; identity/date corrections invalidate links through a migration trigger, including legacy writes.
- Provider discovery/details/retention interface is ready, but no actual provider is configured. New persists unavailable/discovery-unconfigured with no fake or journal substitute. Enabling a provider requires verified attribution and permissions for retained identifiers and derived scores. Listing metadata is ephemeral and refreshed on later reads; unavailable details remain explicit.
- Vercel Services configuration declares public Next.js web and private Flask Python scoring with a URL binding and shared secret. Official current deployment guidance checked; configuration uses services, not the older experimental format. Services is Beta. Python is pinned to 3.12 for deployment.
- README, environment example and detailed API/scoring/provider/deployment documentation updated. No real secret or external credentials were written.

## Endpoints and UI handoff

- POST/GET /api/recommendations/runs
- GET /api/recommendations/runs/{id}
- GET /api/recommendations/runs/{id}/attendees
- GET /api/recommendations/runs/{id}/results
- GET/POST /api/recommendations/runs/{id}/feedback
- GET/POST /api/recommendations/runs/{id}/visits

See [recommendation backend](backend-recommendations.md) and src/contracts/recommendations.ts for exact schemas, deterministic formulas, filters, statuses, idempotency and feedback rules. Existing [journal APIs](backend-api.md) and [reporting APIs](backend-reporting-api.md) remain available.

UI must label preference indices honestly, preserve nullable evidence, render unavailable/failed outcomes, show attribution on provider details, and reuse requestId after an uncertain transport result. Journal result display includes live restaurant summaries; stored run metrics are historical snapshots. Profiles remain shared selections, **not authentication**. No browser API wiring is claimed.

## Changed files in this prompt

Added:

- api/.gitignore, api/.python-version, api/requirements.txt, api/run.mjs, api/index.py
- api/recommender/**init**.py, validation.py, filters.py, engine.py, explanations.py
- api/tests/test_recommender.py
- src/contracts/recommendations.ts
- src/server/recommendation-provider.ts, recommendation-client.ts, recommendation-repository.ts, recommendation-api.ts
- src/app/api/recommendations/runs/route.ts and [id]/route.ts, [id]/attendees/route.ts, [id]/results/route.ts, [id]/feedback/route.ts, [id]/visits/route.ts
- drizzle/0002_redundant_preak.sql, drizzle/0003_tearful_slipstream.sql and their meta snapshots
- tests/backend/recommendations.test.ts, recommendation-config.test.ts, recommendation-e2e.ts
- docs/backend-recommendations.md

Modified:

- src/contracts/journal.ts (recommendation error codes and optional persisted-run error detail)
- src/db/schema.ts and drizzle/meta/_journal.json (recommendation persistence)
- src/server/runtime.ts (runtime composition)
- tests/backend/journal-api.test.ts (optional duplicate-detail typing), routes.test.ts and http-smoke.mjs (recommendation route coverage)
- package.json (Python runner/test scripts only; npm dependencies and lockfile unchanged)
- vercel.json, .env.example, README.md, docs/backend-api.md, docs/backend-progress.md

An ignored api/.venv was created for local Python verification. No existing environment in another project was modified. Schema generation's index ordering was reviewed/corrected before composite foreign keys; the visit-link invalidation trigger is an intentional manual migration addition.

## Verification actually performed

| Check                            | Result                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm test                         | **184 tests passed across nine suites**: all 158 prior tests plus 24 recommendation and two configuration tests.                                                                                                                                                                                                                    |
| PostgreSQL persistence           | Committed migrations applied to disposable PGlite PostgreSQL. Tests cover atomic rollback, identity/foreign-key constraints, request retries/concurrency, current-score input, group-wide exclusion inputs, unavailable/failed/empty outcomes, feedback, confirmed links, deletion/identity-change cleanup and interrupted workers. |
| npm run test:python              | **19 tests passed**, with additional table-driven cases: documented formulas, sparse/cold data, attendee-only votes, duplicate tags, stable ties/order, hard filters, all three logged identity exclusions, count limits, no scoring I/O/mutation, fresh interpreter, strict input and HTTP secret/JSON/size/method validation.     |
| npm run test:recommendations:e2e | Passed using real private Python HTTP, Next.js server orchestration and disposable PostgreSQL: actual ranking, persisted runs/results, New exclusion, feedback and confirmed visit. Test-only provider fixtures explicitly supplied; no live provider claims.                                                                       |
| npm run lint                     | Passed with zero warnings.                                                                                                                                                                                                                                                                                                          |
| npm run typecheck                | Passed, including generated recommendation route types.                                                                                                                                                                                                                                                                             |
| npm run build                    | Passed after the final contract/display/visit-lock changes, including all six new recommendation routes and stable UI source. The later Python-only validation regression fix does not affect this Next build.                                                                                                                      |
| Production API HTTP smoke        | **45 checks passed** on the final production build at port 3101, including recommendation selection, invalid writes, method/OPTIONS behavior and explicit missing-database responses. Only reads and deliberately invalid writes; no journal data changed.                                                                          |
| Existing production HTTP smoke   | Passed profile selection/cookies/switching and page routes on the same final build.                                                                                                                                                                                                                                                 |
| Formatting                       | New/modified backend TS/JS/JSON and documentation checked with installed Prettier. Python tests pass; no Python formatter/linter configured.                                                                                                                                                                                        |

All discovered backend failures were corrected and relevant checks rerun: migration FK/index ordering, display union parsing, correlated list counts, canonical request hashing, unused imports and preserving live summary fields. The Python integer-limit validation regression was also covered and corrected. No failure is attributed to the UI session and no check remains blocked by concurrent work.

## Environment limits and remaining setup

- No Neon credentials are configured. Actual PostgreSQL SQL/persistence was tested with PGlite; successful live Neon runtime and migrations remain unverified. No external database was modified.
- No restaurant provider is configured. Actual live discovery, attribution and any specific provider's permitted storage remain unverified; production returns an explicit unavailable state.
- No Vercel deployment or cloud service binding/cold start was performed. Official Python/Services guidance was checked October 18, 2026; Services Beta configuration is prepared, not cloud-verified. See documentation for official references and preview verification.
- The available local interpreter is Python 3.15.0. Tests used an isolated environment with pinned dependencies; the deployment's pinned Python 3.12 runtime was not locally available. Python initially required approved execution outside the sandbox to access its installed base interpreter. This was an environment restriction, not a failing Python test.
- PowerShell blocks npm.ps1 here; npm.cmd runs the same scripts successfully without changing execution policy.
- Before use: apply migrations and seed profiles on the intended Neon branch; configure identical server-only shared secrets in web/Python and the private service URL binding (or local URL). Local Python needs the secret explicitly exported; its runner does not read .env.local.
- Profiles are not authenticated. Feedback and visit links establish selected-profile consistency only. Browser recommendation integration remains outside this backend prompt.

## Prior completed backend work

Restaurant/visit CRUD, duplicate detection/provider uniqueness, canonical ratings and dashboard/analytics endpoints were completed in earlier prompts. Their behavior and integration notes remain documented in backend-api.md and backend-reporting-api.md. This prompt extends them without modifying UI-owned files or legacy actions/helpers.

## Grounded review summaries and advanced analytics (current prompt)

Implemented `POST /api/restaurants/{id}/summary`, a server-only configurable Vercel AI Gateway adapter, a unique-key generation reservation/cache, citation/schema validation, strict source rechecks, and a PostgreSQL invalidation trigger. The input requirement is three nonblank review texts across two profiles; source selection is capped at the 30 most recent by visit date, creation timestamp, then stable ID. Summary responses contain only claims and validated source IDs. Review text is explicitly framed as untrusted evidence. Numeric statistics remain SQL/application calculations. API errors distinguish missing model configuration, timeout, provider failure, stale sources, and malformed/unsupported output.

Added recommendation activity fields to analytics: selected/dismissed feedback counts, unique selections with linked visits, filtered linked visit/profile counts, and nullable selection rate. Feedback uses run-created local day in report timezone; linked visits share inclusive visit-date and personal/group/restaurant/cuisine filtering. Existing current-rating agreement uses SQL population standard deviation only with at least two current reviewers. Spending aggregates already excluded missing amounts, retained recorded zeroes, and returned null instead of zero where no recorded values exist; reporting fixtures continue to verify those rules.

Added `docs/backend-review-summaries.md` with endpoint semantics and the manual factual-support evaluation checklist. Synthetic manual evaluations are explicitly separate from real review content and production usage.

Changed backend-owned files: summary and analytics contracts; summary table/migration and invalidation trigger; model adapter, summary repository/API, reporting SQL/API/runtime, route handler, tests and test alias, `.env.example`, `package.json`/lockfile (`ai@7.0.143`), and backend docs. No UI-owned files were modified.

### Verification actually performed for this prompt

- `npm test`: **196 tests passed in 10 suites**, including summary thresholds, source selection, citation validation, cache keys, invalidation, concurrent generation/source mutation, provider configuration/retry/error mapping/output validation, recommendation analytics filters, agreement, and spending null/zero behavior.
- `npm run typecheck`: passed, including Next route types for the summary endpoint.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed; `/api/restaurants/[id]/summary` appears as a dynamic route.
- Production HTTP smoke: **46 checks passed**, including summary route method handling. The database was unconfigured, so live database CRUD was not exercised.
- `npm audit --omit=dev`: **zero runtime dependency vulnerabilities**.
- No AI Gateway credential is configured, so live provider output and manual factual support have not been evaluated. The checklist is in `docs/backend-review-summaries.md`; synthetic results are not presented as real usage.
- PGlite applied migrations and exercised SQL/trigger behavior. Live Neon migration/runtime remains unverified; there is no UI integration conflict.

## October 18, 2026 UI integration and verification update

The UI session is paused; the current integration prompt authorized cross-boundary fixes. Restaurant/visit forms, analytics, persisted recommendation feedback, and grounded-summary panels are now wired to the published contracts. `docs/ui-progress.md` records the UI details. The app has no runtime fixture fallback: the only demo data path is the explicit development-only `db:seed:demo` command; missing database/provider/model configuration produces honest setup/unavailable states.

Verification: `npm test` passed 198 tests across 11 suites; `npm run lint`, `npm run typecheck`, `npm run test:python` (19 tests), `npm run build`, and `npm audit --omit=dev` (zero runtime findings) passed. Backend production HTTP smoke passed 46 checks with the database unconfigured. Profile-switch smoke is being rerun after rebuilding the source disclosure. No browser surface is available; live Neon, external provider, Vercel service binding, recommender secret, and AI Gateway behavior remain unverified. No deployment was performed. See `docs/vercel-deployment.md` for manual setup.

Python test execution initially hit Windows sandbox access denial for its isolated interpreter's base Python. The same `npm run test:python` command was rerun with approved unsandboxed execution and passed all 19 tests. The rebuilt production server also passed the profile selection/switch smoke; it is stopped. Browser verification remains unavailable.


## October 18, 2026 Neon and Vercel deployment

Neon production was initialized for project `quiet-band-41101117` / organization `org-fancy-sea-24821602`, production branch, PostgreSQL 18 in AWS us-west-2. The `neon.ts` policy already matched the branch; `neon deploy` reported no changes. `npm run db:migrate` and `npm run db:seed` completed against Neon production. The seed preserved existing restaurants and visits.

Created and deployed Vercel project `hieu-sreviews` with Services framework, Next.js web and private Python recommender. Production URL: https://hieu-sreviews.vercel.app. Deployment `6y27RiqrX71sGk8YCQ83eVGoLtGi` reached Ready and was aliased to the production URL. Production server configuration includes the pooled Neon `DATABASE_URL`, `APP_TIME_ZONE`, and a generated server-only recommendation secret; the private binding supplies the recommender URL. No AI model or external restaurant provider credentials were available.

Verification: authenticated Vercel CLI requests returned the application and dashboard API data backed by Neon. Local production E2E exercised profile selection/switching, restaurant creation/search/duplicate response, repeat visits, rating edits and deletion fallback, filtered analytics, and honest AI-summary unavailability; all temporary data was cleaned. `npm test` passed 198 tests, lint and typecheck passed, Python tests passed (19), production build passed, and `npm audit --omit=dev` reported zero runtime vulnerabilities. The Vercel remote build reported 9 development dependency audit findings (4 moderate, 5 high). Browser automation was unavailable. Live recommendation service-to-service scoring and AI/provider integrations remain unverified against external credentials.

Vercel Authentication is enabled on the production deployment. This prevents general public access; profile selection is not authentication. Do not disable protection without an explicit access-policy decision because the shared journal permits reads and writes. Deployment instructions and required environment variables are documented in `docs/vercel-deployment.md`.
