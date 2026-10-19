# Release 1 verification

Verified in the local Windows workspace on October 18, 2026. No deployment was performed and no remote repository changes were pushed.

## Passed

| Check                    | Result                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository inspection    | Local folder and `hieun5/hieu-sreviews` were empty; no repository instructions or existing source to preserve.                                                                                                                                              |
| Dependency resolution    | Exact versions locked; `npm ls --depth=0` succeeds with compatible peers. ESLint 9 is retained for the current Next lint plugin peers.                                                                                                                      |
| Lint                     | `npm run lint` passes with zero warnings.                                                                                                                                                                                                                   |
| Type checks              | `npm run typecheck` passes.                                                                                                                                                                                                                                 |
| Tests                    | `npm test`: **55 passing tests across four suites**.                                                                                                                                                                                                        |
| Production build         | `npm run build` succeeds with all Release 1 routes. No database credentials are needed to build.                                                                                                                                                            |
| Runtime dependency audit | `npm audit --omit=dev`: **zero findings**.                                                                                                                                                                                                                  |
| HTTP smoke checks        | `npm run test:smoke` against the local production server passes missing/invalid profile redirects, all five configured profile cards, shared-selection explanation, a real profile-form POST, cookie attributes, all main routes, and switching to Mai-Han. |

The tests apply the SQL migrations to PGlite PostgreSQL and verify migration re-runs, idempotent profile seeding, referential integrity, provider uniqueness, indexes, text/rating/currency/spending constraints, and actual database edits/deletions followed by current-score recalculation. Separate tests verify missing ratings, group weighting, historical/current date semantics, PostgreSQL timestamp microseconds, decimal precision near rounding boundaries, validation, empty data, and recorded-only spending.

A clean `npm ci` also succeeded before the final lint, type-check, test, and build runs.

HTTP smoke checks used the explicit **database-not-configured state**, not a populated database. They are protocol checks, not visual browser verification.

## Blocked or not performed

- **Live Neon connectivity, production migrations, and seeds:** no `DATABASE_URL` or `.env.local` was supplied. No external database was provisioned or modified. Set up Neon, apply migrations, and run the profile seed as described in the README.
- **Full browser acceptance and visual/accessibility QA:** computer-use inventory returned no browsers/apps, and creating an in-app browser returned “Browser is not available: iab”. The requested add-place → visit → revisit → analytics → edit/delete flow therefore remains unverified in a browser. Follow the README acceptance checklist against a disposable Neon branch.
- **Git remote/commit/push:** Git initialization succeeded, but the sandbox blocks writes to `.git/config` and `.git/FETCH_HEAD`. The GitHub remote could not be saved. Source files are present locally and uncommitted; connect the remote and commit/push from your normal shell. No global Git configuration was changed.
- **Deployment:** deliberately not attempted, as requested. `vercel.json` and manual deployment instructions are provided.

## Tooling notes

- The full npm audit reports **nine development-tool findings** (five high, four moderate) in upstream Next lint tooling and Drizzle Kit dependency chains. Runtime dependencies have zero findings. The audit currently suggests incompatible major downgrades; none were applied. Review upstream compatible stable updates before changing the lockfile.
- In this Windows sandbox, Drizzle Kit's bundled TypeScript loader fails when looking up the OS username (`uv_os_get_passwd`). SQL generation completed using a one-process fallback for that temporary-directory username lookup. No installed package, project script, or OS configuration was patched. The generated SQL and snapshots are included and pass the PostgreSQL integration tests. The normal `db:generate` command remains documented for the user's ordinary shell.

## Required setup

1. `npm ci` with Node.js 24 LTS.
2. Configure `.env.local` from `.env.example` with the Neon connection string(s).
3. Run `npm run db:migrate` and `npm run db:seed` against the intended database.
4. Run `npm run dev`, then complete the browser acceptance checklist.
5. Connect/push the Git repository and deploy manually in Vercel when ready.

Demo data is strictly opt-in through `db:seed:demo`; all demo records are clearly labeled fictional. No recommendations, AI features, external search provider, or fabricated live results are included.

## October 18, 2026 integration verification

This update supersedes the older feature-status and smoke claims above. The integrated UI now calls the restaurant/visit APIs for mutations, the reporting API for analytics, persisted recommendation APIs for runs/feedback, and the grounded-summary API from restaurant details. Runtime responses do not fall back to mock data. Demo seeding remains an explicit command for disposable development databases only.

Passed: 198 JavaScript tests across 11 suites; lint; typecheck; 19 Python tests; production build; zero runtime dependency audit findings; and 46 production HTTP checks against the database-unconfigured state. Profile-switch smoke is rerun after the shared-profile disclosure change. Browser verification is unavailable because no browser is exposed in this environment. Live Neon CRUD, provider discovery, Vercel service binding, recommendation secret, and AI Gateway calls remain unverified without credentials/configuration. No deployment was performed.
