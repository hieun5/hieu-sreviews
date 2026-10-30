# UI progress

Updated: October 30, 2026.

## Current status

The playful journal UI uses compact layouts, character avatars, food doodles, and short labels. API integration is complete for restaurant and visit mutations, analytics, recommendation runs/feedback, and restaurant review summaries. Restaurant directory/detail reads remain server-rendered through the existing repository. Profiles are shared selections, not secured accounts.

- Adding a place also records the selected profile's first visit in one atomic API request. The form omits the address field; later repeat visits can still be logged separately. Visit edit/delete use shared schemas, integer cents, common errors, and API rating recalculation.
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

## October 18, 2026 combined place and first-visit flow

The add-place page now collects place name/type/categories/price tier and the first visit's rating/date/review/order/spending together. It does not show an address field. `POST /api/places/with-visit` saves both records atomically and routes to the created restaurant. Regression tests cover complete creation and rollback if the visit insert fails.

Verification: `npm test` passed 201 tests; lint, typecheck, and production build passed. A temporary local production-build request created an addressless place and first visit in Neon, verified the saved fields, then removed the rows. Migration `0005_lively_squadron_sinister.sql` is applied to Neon production. The new app code has not been deployed, and browser automation is unavailable.

## October 18, 2026 remove place from the Places tab

Removed the dashboard's redundant “Log a visit” shortcut; adding a place already records its first visit. The place detail page keeps repeat visits available as “Log another visit.” Place cards show an X remove control on hover or keyboard focus (always visible on touch screens), and the control appears only on the Places tab. Browser confirmation names the place and, when present, explains that every visit, rating, review, spending entry, and saved recommendation result will be permanently deleted. API errors remain visible on the card.

Verification: full `npm test` passed (202 tests), lint and typecheck passed, and `npm run build` passed. No browser visual check, live Neon deletion, or deployment was performed.

Follow-up: local production-build API verification successfully removed a temporary Neon place with one visit. The user's localhost dev server briefly emitted a blank 500 during a concurrent production build and then returned the expected JSON 404 for a nonexistent place. The remove control now surfaces the actual client-side error if a response cannot be read. No browser interaction was available.

## October 19, 2026 single-page journal dashboard

The home page now combines the full saved-place list and recent visits with a right-side analytics panel. The panel shows current average, visit/place/reviewer counts, top places, cuisine favorites, and expandable rating history, friend comparison, spending, and recommendation activity; group/personal views and the existing date/place/cuisine filters work inline. The Places and Analytics navigation tabs were removed, and their old routes redirect to the dashboard. A square magnifying-glass button opens an inline saved-restaurant search; no visible search label was added. Recommendations and add-place flows remain available.

Verification: `npm test` passed (202 tests), lint and typecheck passed, and the running localhost page returned HTTP 200 with the analytics panel, saved places, and search control present and the Places/Analytics nav labels absent. Browser visual inspection and a new production build were not run.

The dashboard place cards now omit the address row when no address is stored, no longer show the upper-right arrow, and use three columns on desktop, two on tablet, and one on narrow mobile screens. Lint/typecheck passed and the localhost page still returned HTTP 200 with the obsolete address placeholder absent.

Place-card borders now follow the group's current-rating color: low ratings use the warm red tint, mid ratings use amber/green, high ratings use green, favorites use purple, and unrated places keep the neutral border. Place details hide the address line and pin icon when the address is blank. Lint and typecheck passed; localhost detail returned HTTP 200 without “Address not added.”

## October 30, 2026 phone layout and local preview

Phone screens now use fixed Home/Recommendations navigation with icons and safe-area spacing, while wider screens keep the header navigation. Main content and scroll padding reserve room for the phone navigation. The page header puts actions on a separate row; opening restaurant search gives it a full-width row and a search keyboard hint.

The dashboard has a View analytics anchor when its columns stack. Analytics scope, apply, and reset links return to the analytics panel, preserving its position after filtering. Fixed an implicit extra grid column in the sidebar filters. Forms use smaller outer padding, readable 16px phone input text, wrapping action buttons, and rating shortcuts that keep at least 44px width as space permits. Navigation, place removal, visit edit/delete, and attendee choices have larger touch targets. Long headings and visit text wrap, and browser zoom remains enabled. No dependency or database changes were needed.

Verification: all 202 tests passed; lint, typecheck, production build, formatting of changed source files, and diff whitespace checks passed. Production HTTP requests with a phone user agent returned 200 for profiles, home, expanded search, add-place, recommendations, and personal analytics, with the viewport, navigation, search, analytics anchors, and compiled styles present. No populated place detail was available for that HTTP check. These checks confirm responses and markup, not rendered layout.

The development preview is started with this computer's actual LAN IPv4 hostname. LAN HTTP checks verified profile selection, a development cookie without the HTTPS-only production flag, the selected-profile dashboard, and 21 JavaScript/CSS asset responses with the LAN origin and referer. The [phone preview guide](phone-preview.md) explains same-Wi-Fi testing and the visual/device acceptance checklist. The sandbox initially blocked the LAN-address lookup; an approved read outside the sandbox provided the address. Existing firewall settings were not changed.

The initial pass could not complete visual testing because Computer Use could not confidently determine Chrome's URL. The follow-up release verification below supersedes that initial visual/deployment status.

## October 30, 2026 phone testing and production deployment

Chrome responsive testing verified profile selection, dashboard/search/cards/navigation at 320/375/390/430px, the 320px add-place form and quick-rating interaction, analytics filters, recommendation controls, and the 844 × 390px landscape dashboard. Browser testing found that search autofocus scrolled away from analytics after applying filters. The search now takes automatic focus only when explicitly opened by the user; the corrected filter flow was verified on the staged build and production URL.

Deployment `dpl_2udp59C7y7C56FUT7DFXBUALHiKC` was staged, checked, and promoted to https://hieu-sreviews.vercel.app. Existing Vercel sign-in protection remains enabled. All 202 tests, lint, typecheck, formatting, production build, hosted HTTP checks, and temporary-record persistence/cleanup checks passed. The final runtime error/fatal scan returned zero records in its inspected window. No physical phone or software-keyboard check is claimed. See [mobile release verification](mobile-release-verification.md) for the full evidence and limits.

## Remaining setup and acceptance

Neon production and the protected Vercel deployment are documented in `docs/vercel-deployment.md`; the dashboard and phone update is deployed. Actual iPhone/Android, Safari/WebKit, software-keyboard, and cellular checks remain outside the completed desktop emulation coverage. A live restaurant provider and AI summary model still need configuration, and external recommendation scoring needs its own verification; those features were outside this release's scope.
