# UI progress

Updated: November 2, 2026.

## November 2, 2026 — direct copy and reliable meal drafts

Removed the profile introduction, shared-profile disclaimer, and home tagline at the user’s request. Keep the interface direct and written for the existing friend group; reviewer selection remains unchanged.

Meal tickets now preserve an unfinished review on this device, including its reviewer, existing/new-place choice, exact rating, note, date, order, spending, and new-place details. A recovery banner explicitly offers to continue as the original reviewer, so recovering a draft cannot silently post it under the currently selected friend. Home and new-place drafts use separate keys. Drafts expire after seven days; malformed/version-incompatible values are ignored, and blocked/full browser storage does not prevent logging. A pending save is locked synchronously and stays locked after success while navigation completes. Drafts clear only after a confirmed successful API response or explicit discard.

Verification: 216 tests across 12 suites, lint, typecheck, production build, production profile/page smoke, and 46 API HTTP smoke checks passed. Browser checks on the production preview verified immediate client-navigation recovery, refresh recovery, restoration of the original reviewer and every optional field (including an 8.25 rating and zero spending), failure-safe draft retention, and discard surviving a reload without recreating the draft. Phone/desktop home and phone profile captures are in `.impeccable/review/meal-logging/`. The temporary local test draft was discarded; no restaurant or review records were created. The checkout has no database connection, so live CRUD and success-path draft clearing were not exercised end to end.

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

## November 2, 2026 reviews database connection

Connected the local meal-ticket preview on port 3100 to the existing `hieusreviews` Neon project (`quiet-band-41101117`), production branch. The journal retains all five profiles, four places, four reviews, and six existing migrations. No seeding, schema change, or production review mutation was needed. Private `.env.local` holds the pooled application connection, direct migration connection, and `America/Los_Angeles` timezone; its permissions are 0600 and both it and `.neon` are ignored by Git. Connection secrets were not printed or added to source files.

Write verification ran on an isolated copy of production, `review-connection-check-20261102`: atomic place/first-review creation, decimal ratings, zero spending, persisted edits, repeat-visit rating recalculation, rating fallback after deletion, and fixture cleanup passed. Browser testing confirmed save → detail → refresh → edit → persisted score, and clearing the saved form's draft. The existing unfinished `food` draft was preserved using the separate new-place form for verification. All test fixtures were removed, then the temporary branch was deleted after switching the local preview back to production.

Final production checks were read-only: all 46 API HTTP smoke checks and the profile/page smoke suite passed. Browser refresh displayed existing shared reviews, and the unfinished draft remained intact. See `.impeccable/review/database-connected.png` for the connected preview. This connection work did not deploy the redesigned application or change existing hosted environment configuration.

## November 2, 2026 phone rating targets

At widths up to 600px, quick ratings now use two rows of five with 8px gaps, 48px-tall buttons and 16px numerals. Decimal entry is 76×48px. The shared rating picker styling applies to meal logging and visit forms. Desktop retains its single row.

Production build and CSS formatting passed. Browser measurements at 320/375/390/430/600px confirmed two rows, minimum button width 44.8px, 48px target heights, and no horizontal overflow. At 1280px, the original single row and 44px button height remain. The 390px screenshot is `.impeccable/review/phone-ratings.png`. No draft or review was changed. Viewport overrides were reset. Physical-device touch/keyboard behavior was not tested; no deployment was made.

## November 2, 2026 friend-review shortcuts and summary readiness

Friends’ entries in the shared VisitList now link directly to a new review for their saved place. The route names the selected place, starts with blank score/text, and presents the five-friend picker. Switching profiles preserves the form instead of navigating to profile selection. New submissions are guarded against repeat clicks while pending and remain locked after success until navigation; editing an existing review retains its original reviewer.

Summary readiness now explains the current written-review count and distinct-friend count, with a link to add a review. The displayed eligibility set matches the backend’s most recent 30 nonempty written reviews. Pending generation and errors are announced; summary requests have a synchronous duplicate guard. Citations use formatted dates. An updated review history resets a displayed summary. Existing grounded-generation, source validation, invalidation, and caching contracts remain intact.

All 216 tests, lint, typecheck, production build, profile/page smoke checks and 46 read-only HTTP API checks passed. Browser checks followed a friend’s link to the correct place, verified a blank score/note, entered unsaved decimal score/text, switched reviewer and confirmed both values remained, then restored Nick and canceled. No actual review or existing draft was changed. Mobile at 390px showed summary readiness and the friend shortcut with no overflow; screenshot: `.impeccable/review/review-summary-phone.png`.

Vercel CLI sign-in completed. A server-only AI Gateway credential is stored in ignored `.env.local` with 0600 permissions, a $1 total nonrenewing usage limit and 90-day expiration. The live model catalog confirmed `google/gemini-2.5-flash-lite`. Generation is configured locally, but a synthetic request was rejected with HTTP 403 because Vercel requires a payment method. No generated summary, purchase, billing change, hosted environment update or deployment is claimed. User billing action and a successful live generation check remain pending. No synthetic review records were inserted.

## November 2, 2026 review-button cleanup

Feed invitations now appear once per place and only when the selected profile has no review of that place anywhere in the full journal. Filtered and shortened feeds receive the complete visit history for this decision. Place history no longer repeats the invitation beneath each friend's entry. The place header retains one main review action, changing to “Review another visit” after the first review; own-review Edit/Delete controls remain. Removed duplicate add-review links from the summary and empty ratings sections, plus the Journal header’s redundant Log a meal action; global Add review and contextual empty-journal recovery remain available.

Eight regression cases cover duplicate friend entries, personal reviews outside the visible feed, separate places, retained editing, and single place-page actions for empty, friend-only, and already-reviewed states. All 224 tests across 13 suites, lint, production build with TypeScript checking, profile/page smoke checks, and diff whitespace checks passed. Live browser inspection confirmed one place action, no repeated invitations after Nick’s review, and the global Add review route on Journal. Phone inspection at 390px showed no horizontal overflow; viewport reset afterward. Screenshots: `.impeccable/review/review-buttons-cleanup.png` and `review-buttons-cleanup-phone.png`. No review, draft, profile selection, AI configuration, or database row was changed during this cleanup; no deployment was made.

## November 3, 2026 remove unfinished review summaries

Removed the written-review summary panel and its client component at the user's request. Place details now proceed from current ratings and score explanation to the original visits, without a disabled Summarize reviews button, eligibility counts or AI setup messages. PRODUCT.md records that the feature should stay out of the interface until ready and requested again. Existing backend contracts and data were not removed.

Typecheck, all eight existing review-action regression cases, page lint, formatting and diff whitespace checks passed. Live localhost browser verification on the current place confirmed zero summary buttons/headings and visible ratings, visits and review controls. Screenshot: `.impeccable/review/summaries-removed.png`. No review, draft or profile was changed. The development server remains running on port 3100; no deployment was made.

## November 3, 2026 three saved-place picks

Restored Food stats as the fourth main/bottom navigation item and removed the duplicate phone-header stats link. Removed spending and recommendation activity from More insights, and optional preference controls plus the requested explanatory paragraph from Pick a place.

User-selected behavior: saved places only, up to three attendee-based suggestions, with group-rating fallback for missing personal history. The page now requests Favorites with limit three, disables attendee changes during generation, guards repeated submits synchronously, links results to place details, shows rounded match indices and the run's attendee names, and collapses successful saved-place history. The private Python scorer is configured locally on port 8001, using ignored environment configuration; its v2 fallback behavior and backward-compatible history handling are documented in backend-recommendations.md. `npm run dev:recommender` loads local environment configuration automatically.

Verification: 224 JavaScript tests and 21 Python tests passed, including no-history and partial-history fallback regressions. Typecheck, lint and production build passed. A real Hieu recommendation run through the browser completed and returned three saved places, persisted as a normal recommendation run. No visits, ratings, drafts or profile selections were changed. A separate synthetic direct-scorer request returned v2/group-fallback without database persistence. Mobile inspection at 390px verified the four navigation items, no horizontal overflow, and absence of removed insight sections; viewport reset. Screenshot: `.impeccable/review/pick-three-final.png`. Next dev and the local scorer remain running. No deployment or provider/AI service is required for this local flow.

## November 3, 2026 simplify picks and increase result limit

Each pick now displays only its rank, linked saved-place name, and rounded match score. Removed addresses, explanations, Select/Dismiss controls, past-run UI and its initial history request. New requests allow up to ten saved-place results and show fewer naturally when fewer are eligible. Pending runs can still be checked directly without a history panel.

Typecheck, component lint and diff whitespace checks passed. A real browser run returned the four currently available saved places, with exactly the requested three fields per pick and no Past picks section. Screenshot: `.impeccable/review/simple-ten-picks.png`. No ratings or visits were changed.

## November 3, 2026 discard unfinished reviews on exit

At the user's request, meal forms no longer autosave or recover unfinished reviews. Removed the persistence hook, recovery banner and draft status/discard controls. Existing legacy draft keys are cleared on form mount. React Activity cleanup resets form state when leaving, while browser back-forward-cache returns reload the page to prevent recovery of unsaved inputs. Repeat-visit/edit forms reset their native inputs and rating state on exit. Failed submissions retain values only while the form remains open.

Typecheck, changed-component lint, eight review-action regression cases and whitespace checks passed. Browser verification entered unsaved place/decimal score/note, navigated to Journal, returned with Back, and refreshed: all fields were empty and no recovery banner appeared. A repeat-visit form also returned with an empty score/note after Cancel and Back. No test review was submitted and no saved visit was changed. Screenshot: `.impeccable/review/discard-on-exit.png`.

## November 3, 2026 Impeccable polish

Polished the Journal and shared form details while preserving the meal-ticket design and the user's removed copy. Journal search now has its existing labeled input inside the shared icon/search wrapper, stays on one row on phones, preserves query through Everyone/Your reviews changes, and provides Clear without resetting scope. Dates and analytics evidence metadata use readable 12px text; singular reviewer/visit/place counts are corrected. Empty rating feedback no longer reserves a blank text row.

Changing recommendation attendees clears outdated results and errors; pending searches use the existing icon with a reduced-motion-aware spinner. Optional order/date/spending validation in both meal and visit forms now links each error paragraph to its input. New-place address/cuisine errors also expose invalid state and error associations. Existing discard-on-exit behavior is preserved.

Verification: all 226 tests across 13 suites, lint, typecheck, production build and whitespace checks passed. Two new regressions cover query preservation across scope changes and scope preservation when clearing search. Browser navigation verified both behaviors. At 320/390/768/1280px, the search input/button remain on one row with no horizontal overflow; viewport reset. Screenshot: `.impeccable/review/journal-polished-phone.png`. No review, recommendation run or profile was changed, and no deployment was made. The latest critique snapshot read was `2026-11-04T00-05-53Z__src-app-journal-page-tsx.md`; its draft issue was superseded by the user's discard-on-exit decision, and its remaining attendee-refresh and field-error issues are addressed by this pass.
