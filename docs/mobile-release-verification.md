# Mobile release verification — October 30, 2026

The mobile journal update is deployed to [hieu-sreviews.vercel.app](https://hieu-sreviews.vercel.app). Scope was phone testing, fixes discovered during that testing, and deployment of the existing update.

## Deploy result

| Field | Result |
| --- | --- |
| Target / status | Production / READY |
| Project / team | `hieu-sreviews` / `hieu-nguyen4` |
| Deployment | `dpl_2udp59C7y7C56FUT7DFXBUALHiKC` |
| Immutable URL | `https://hieu-sreviews-8ymvj8j4c-hieu-nguyen4.vercel.app` |
| Source | Local working tree based on `f043e77`; no new commit or push |
| Framework | Next.js 16.4.2 web service and existing private Flask service |
| Remote build | 48 seconds; 47 seconds reported post-build |
| Release method | Staged with production configuration using `--skip-domain`, tested, then promoted |
| Access | Existing Vercel Authentication protection retained |

The public alias was inspected after promotion and resolves to this deployment. Authenticated HTTP checks and the browser filter flow were repeated on the production domain. No database migrations, access-policy changes, or new product features were introduced in this release step.

## Browser checks actually performed

Chrome DevTools responsive mode was controlled through Computer Use. These are desktop browser emulation checks, not physical-device or Safari/WebKit tests.

The [phone preview guide](phone-preview.md) describes same-Wi-Fi development access and physical-device acceptance.

| Check | Evidence / result |
| --- | --- |
| Profile selection | Five profile cards fit at 320px; selecting Hieu opened the journal |
| Dashboard widths | Visually inspected at 320, 375, 390, and 430px; header, cards, search, and navigation fit |
| Landscape | Dashboard inspected at 844 × 390px; header navigation and place grid fit |
| Search | Opened search at 320px and submitted an existing place name; matching result rendered |
| Add-place form | At 320px, inspected place inputs, wrapping price choices, rating grid, date, review, spending, and save/cancel controls |
| Rating interaction | Selected quick rating 9 and observed the numeric input and selected mood update |
| Navigation clearance | Save/cancel controls remained above bottom navigation at the end of the form |
| Analytics | Shortcut reached the stacked panel; filters fit at 320px |
| Filter regression | With search active, filter submission retained the analytics position on the corrected staged build and live production domain |
| Recommendations | Inspected the page, attendee choices, and filters at 390px; did not create a recommendation run |

Testing found one focus bug: a search query caused the search input to autofocus on page hydration, scrolling away from analytics after filter submission. Search now receives automatic focus only when the user explicitly opens it. The corrected component passed lint and typecheck, and its remote production build and browser regression check passed.

## HTTP and persistence checks

Authenticated Vercel CLI requests used a phone user agent. The final staged deployment and production domain both passed:

- Profile page, profile-selection POST, redirect, and HttpOnly/Secure/SameSite=Lax cookie checks.
- Home, expanded search, add-place, recommendations, and personal-analytics page responses.
- Viewport, browser-zoom availability, navigation markup, search form, rating controls, and analytics anchors.
- Legacy Places and Analytics routes' streamed redirects to Home. Next.js can return these as HTTP 200 plus a refresh meta tag; the check handles this documented behavior.

Before the focus-only correction, the first staged build also passed live persistence checks: combined addressless place/visit creation, saved detail rendering, rating correction, and filtered analytics recalculation. The test record had a unique `[PHONE RELEASE TEST]` name. Cleanup verified its ID and name before deleting only that place and its one visit, and a subsequent GET returned 404. Existing journal entries were preserved.

All 202 tests passed on the final source. Lint, typecheck, changed-component formatting, and diff whitespace checks passed. The final remote build compiled both existing services successfully.

`.vercelignore` now excludes local credentials, agent settings, caches, virtual environments, and test output. The deployment dry run confirmed those exclusions. No browser authentication state or credentials were exported as artifacts.

## Post-deploy observability and limits

- Runtime error/fatal scan for the promoted deployment returned zero records in the inspected 15-minute window. This is a bounded log check, not continuous monitoring.
- Browser console inspection showed five warnings for unrecognized Permissions-Policy features, with no application JavaScript exception in the inspected final page.
- External log drains were not inspected; the installed CLI has no first-class `drains` command. No monitoring integration was added.
- Physical iPhone/Android behavior, Safari/WebKit, software-keyboard resizing, actual safe-area hardware, and cellular-device access were not tested. Existing Vercel sign-in protection applies on phones too.
