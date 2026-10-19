# UI progress

Updated: October 18, 2026.

## Current status

The playful journal UI uses compact layouts, character avatars, food doodles, and short labels. API integration is complete for restaurant and visit mutations, analytics, recommendation runs/feedback, and restaurant review summaries. Restaurant directory/detail reads remain server-rendered through the existing repository. Profiles are shared selections, not secured accounts.

- Restaurant create uses the shared API and duplicate-match confirmation. Visit create/edit/delete use the shared schemas, integer cents, common errors, and API rating recalculation. Repeat visits are preserved.
- Analytics uses the reporting API. Personal/group, restaurant, cuisine, and date filters map to the API contract; missing values remain null and count metadata is displayed.
- Recommendations use persisted runs and feedback. Attendee choices follow the selected shared profile; Something New reports unavailable when no provider is configured. Preference indexes are labeled as such, never as ratings.
- Restaurant details can request a grounded summary. The panel handles too few reviews, missing model configuration, provider errors, and citations linked to the supporting visits.
- No application-level fake data fallback is used. The demo seed is an explicit command restricted to disposable development databases.

## Contracts and ownership

Read `docs/backend-api.md`, `docs/backend-reporting-api.md`, `docs/backend-recommendations.md`, and `docs/backend-review-summaries.md` for schemas and endpoint semantics. UI code consumes contracts without modifying them. Client code does not read server secrets. `DATABASE_URL`, recommender credentials, and AI Gateway credentials are read only in server modules/actions.

UI owns page/layout/CSS/components/client adapters/public assets and this file. Backend owns API/server/database/contracts/Python/migrations and backend documentation. Backend alone owns dependency manifests, lockfiles, TS/Next/deployment configuration. No dependency request is pending. No deployment or commit was made.

## Verification

- `npm test`: 198 tests passed across 11 suites.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `npm run test:python`: 19 tests passed after rerunning outside the Windows sandbox, which initially denied the isolated interpreter access to its installed base Python.
- `node tests/backend/http-smoke.mjs`: 46 API checks passed with the database explicitly unconfigured.
- `npm run test:smoke` against the rebuilt production server: passed missing/invalid profile redirects, all five profile choices, shared-profile disclosure, Hieu selection and secure cookie attributes, main page routes, and switching to Mai-Han.
- `npm audit --omit=dev`: zero runtime dependency findings. No server-only environment variable names were found in built public assets.
- Browser inventory is empty and the in-app browser is unavailable. No browser interaction or visual QA is claimed.

## Remaining setup

No Neon database, live restaurant provider, Vercel recommender binding/secret, or AI Gateway credentials are configured. Therefore actual Neon CRUD, external discovery, cloud service-to-service calls, and model output remain unverified. PGlite/database/API tests cover persistence and calculations; HTTP checks cover the explicit unconfigured database state. Run browser acceptance against a disposable Neon branch and configured services before deployment. See `docs/vercel-deployment.md` for manual steps and environment variables.
