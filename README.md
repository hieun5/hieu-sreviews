# hieuâ€™s reviews

A shared food journal for Hieu, Ky-An, Vinh, Nick, and Mai-Han. Record restaurants, repeat visits, compare current scores, explore analytics, request recommendations, and generate grounded review summaries when enough reviews and a model are available.

## Stack and requirements

- Node.js **24 LTS**, npm 11 or later. Versions are pinned in `package.json` and `package-lock.json`.
- Next.js App Router, React, TypeScript, Tailwind CSS.
- Neon PostgreSQL, Drizzle ORM and checked-in SQL migrations, Zod, Decimal.js, Recharts.
- Python 3.12 and Flask for the private recommendation service; pinned requirements live in `api/requirements.txt`.
- A Neon database is required for places, visits, and analytics. A build does not need database credentials. Without a connection, the app shows an explicit setup state rather than sample data or invented statistics.

ESLint 9 is pinned because the current stable React/accessibility/import plugins in Nextâ€™s lint configuration still require it; ESLint 10 would produce incompatible peer dependencies. Recheck those peers before upgrading the linter.

On Windows PowerShell, use `npm.cmd` if the execution policy prevents `npm.ps1` from running. Changing the machine execution policy is unnecessary.

## 1. Install and configure Neon

```sh
npm ci
```

Create a Neon PostgreSQL project, or connect Neon through the Vercel Marketplace. In the Neon consoleâ€™s connection dialog, copy the **pooled PostgreSQL connection string** for the application. Do not use an HTTP URL as `DATABASE_URL`.

Copy `.env.example` to `.env.local` and set:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-POOLED-HOST/DATABASE?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@YOUR-DIRECT-HOST/DATABASE?sslmode=require
APP_TIME_ZONE=America/Los_Angeles
```

`DATABASE_URL_UNPOOLED` is optional; migration/seed scripts prefer it when supplied. The runtime uses Neon's HTTP driver; migrations and seeds use a single PostgreSQL connection with transactional migration support. Scripts load `.env.local` through `@next/env`.

Use separate databases or Neon branches for development, preview, and production. Do not point previews at the production database. Keep all database variables server-only, never `NEXT_PUBLIC_*`, and never commit `.env.local`.

Visit dates are calendar dates, not timestamps. The shared group timezone defaults to America/Los_Angeles; server validation rejects dates after today in that zone. The database also rejects dates beyond the current UTC day. Use the default timezone or another timezone on or behind UTC to keep these bounds consistent. To support a timezone ahead of UTC, update the database date constraint in a new migration together with the application setting.

Official references: [Neon connection setup](https://neon.com/docs/connect/connect-from-any-app), [Drizzleâ€™s Neon driver](https://orm.drizzle.team/docs/connect-neon), [Neon on Vercel](https://vercel.com/marketplace/neon).

## 2. Apply migrations and seed profiles

```sh
npm run db:migrate
npm run db:seed
```

The migrations under `drizzle/` create profiles, restaurants, visits, recommendation runs/attendees/results/feedback/visit links, foreign keys, range/text/currency constraints, provider identity indexes, normalized manual-duplicate lookup indexes, cuisine lookup, and ordered history indexes. Migrations are transactional and tracked by Drizzle. Run these commands against the intended environment before serving the app. They are deliberately **not** part of the build or a request handler.

`db:seed` upserts only the predefined profiles and is safe to repeat. Change names, initials, or avatar color tokens in **`src/config/profiles.ts`**, keeping IDs stable, then run it again. Existing restaurants and visits are preserved. Removing a selectable profile does not delete its historical records. There is no profile-creation interface.

For schema changes:

```sh
npm run db:generate
# Review the generated SQL and snapshot, then commit both.
npm run db:migrate
```

Use version-controlled migrations rather than `drizzle-kit push`. See [Drizzle migrations](https://orm.drizzle.team/docs/migrations).

Optional, explicitly fictional demo data for a **disposable development database only**:

```sh
npm run db:seed:demo
```

This separate, idempotent command adds places and reviews marked `[DEMO â€” FICTIONAL]`. It is never run automatically. Do not seed demo records into your personal production journal.

## 3. Run locally

```sh
npm run dev
# Open http://localhost:3000
```

Choose a profile at â€œWhoâ€™s reviewing?â€. The `journal_profile` cookie remembers the selection for one year and is HttpOnly, SameSite=Lax, and Secure in production. Missing or invalid selections redirect to `/profiles`. Switch Profile is always available in the header.

**Profiles are shared selections, not secured accounts.** Anyone with access can select any friend. Edit/delete controls and server checks follow the selected profile only as a convenience; they do not establish ownership or verify identity. This app has no passwords, registration, or OAuth. Keep that access model in mind when choosing who can reach the deployment.

### Directory and visits

- Search the groupâ€™s saved places by name, address, category, or type.
- Add a restaurant/cafÃ© manually. Normalized name **and** address matches trigger a duplicate warning with links to existing records and an explicit â€œdifferent placeâ€ confirmation. This is a potential-duplicate check, not an assertion that addresses or business names are identical.
- `src/lib/place-provider.ts` defines the external search adapter. No provider is configured, no external requests are made, and no mock results are returned. A future adapter must implement its providerâ€™s attribution, caching, and permitted-storage rules before being enabled.
- Visit rating: 1â€“10 inclusive. A restaurant, selected profile, rating, and valid non-future date are required. Reviews allow 2,000 characters; order descriptions allow 300.
- Spending is optional, nonnegative, USD per person, with at most two fractional digits. It is stored as PostgreSQL `numeric(12,2)` and passed as decimal strings, never floating-point money. Empty spending is `NULL`; a recorded zero is a real value.
- A return visit creates a new record. Edit corrects an existing record and preserves creation time. Delete requires a browser confirmation and recalculates current scores from remaining records.

### Current ratings and analytics

`src/lib/ratings.ts` is the shared source of truth used by Home, Places, restaurant details, and server analytics:

1. For every restaurant/reviewer pair, choose the latest visit by `visit_date DESC`, then creation instant DESC, then stable unique ID DESC.
2. Group place averages use **one current score per reviewer**, regardless of how often that reviewer returned.
3. Missing ratings never count as zero. No ratings means no average. Scores display to one decimal; intermediate aggregates are not rounded to display precision. Decimal arithmetic precedes chart-only number conversion.
4. Group agreement is population standard deviation and requires at least two recorded current scores. A lower deviation means closer scores.
5. For a date-filtered current-rating chart, first select the latest visit on or before the end date, then keep that visit only when it is within the selected range. Never substitute an older in-range visit. The UI explains this rule.

Leaderboard and cuisine metrics use current ratings. Friend comparison averages each friendâ€™s current restaurant scores; friends may have reviewed different places. The timeline instead averages **all historical visits on each date**, including return visits. Counts distinguish reviewers, current scores, and historical visits. Places with multiple cuisine tags contribute to each relevant tag. Spending summaries include only recorded amounts from historical visits within the filters; the sum represents per-person amounts, not restaurant receipts or the groupâ€™s total bill.

Analytics calculations run on the server (`src/lib/analytics.ts`); Recharts receives only aggregates. Equivalent tables expose chart values and counts for keyboard/screen-reader users. No missing ratings, spending, prices, images, hours, or availability are fabricated.

The analytics page reads the reporting API, which returns tested SQL aggregates and metadata. Restaurant and visit mutations use the journal API; server-rendered directory and detail reads still use the repository. See [journal APIs](docs/backend-api.md) and [reporting APIs](docs/backend-reporting-api.md) for contracts.

### Recommendation backend

Our Favorites ranks saved places using attendees' current ratings, coverage and disagreement; revisits are allowed. Something New uses cuisine preferences and candidate metadata and excludes all places already logged by the group. No provider is configured, so live discovery returns an explicit unavailable state with no substitute results. Scores are preference indices from 0â€“100, never actual or predicted ratings.

See [recommendation API, scoring and setup](docs/backend-recommendations.md) for Python environment creation, the two server-only environment variables, endpoints, persistence, provider attribution/storage gates and deployment details. Start Python separately with `npm run dev:recommender`; export the shared secret into that process's environment. The runner does not load `.env.local`. Next.js loads its own `.env.local` normally.

The UI now uses the restaurant/visit contracts for writes, the reporting API for analytics, and the persisted recommendation and grounded-summary APIs for the new feature panels. Summary behavior and the manual factual-support checklist are in [review summaries](docs/backend-review-summaries.md). Current deployment variables and manual Vercel steps are in [Vercel deployment](docs/vercel-deployment.md).

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:python
npm run test:recommendations:e2e
npm run build
```

Tests cover deterministic latest selection, return visits, deletion fallback, missing ratings, group weighting, population deviation, date boundaries, validation, decimal spending, analytics filters, recommendation scoring/filtering/cold starts, idempotent runs, feedback/visit-link persistence, actual SQL migration application, constraints, indexes, and idempotent seeding. Database integration tests use **PGlite PostgreSQL** in memory with the committed migrations; no Neon credentials or network are needed, and there is no PGlite application fallback. The recommendation E2E uses a real Python HTTP process over loopback and a disposable PostgreSQL fixture database.

After a production build, `npm start` and (in another terminal) `npm run test:smoke` check HTTP redirects, profile forms/cookies, profile switching, and the main routes. The smoke command expects a production server at `http://127.0.0.1:3000` (override with `SMOKE_BASE_URL`). It does not substitute for the browser acceptance or live database checks below.

Manual browser acceptance with a configured disposable Neon branch:

1. Open `/` without a cookie â†’ select Hieu.
2. Add a manual restaurant â†’ repeat the name/address and inspect the duplicate warning.
3. Log an earlier visit with score 6, then a later visit with score 9.
4. Confirm current score 9, one reviewer, two visits; inspect Analytics and its range filters.
5. Edit the later visit to score 8 â†’ verify recalculation. Cancel a deletion â†’ confirm no change. Delete it â†’ current score returns to 6.
6. Switch to another profile â†’ add a score of 10 â†’ group average becomes 8 with two reviewers. Verify controls are only shown for the selected profile.
7. Test no-data filters and keyboard focus. Invalid inputs should show helpful errors.

### Verification in this workspace

See `docs/release-1-verification.md` for checks actually run and setup-dependent checks. Do not equate an offline PostgreSQL test with a verified Neon connection.

`npm audit --omit=dev` has no findings at implementation time. A full audit flags upstream development-tool dependencies in Drizzle Kit and Nextâ€™s ESLint tooling (esbuild/braces chains); no compatible stable fix is currently offered. These tools are not runtime dependencies. Do not apply the suggested major downgrades or use `npm audit fix --force`; review upstream stable releases before updating the lockfile.

## Vercel deployment

Deployment is intentionally manual. Follow [the current environment-variable and Preview checklist](docs/vercel-deployment.md); it covers the web and private Python Services, Neon migrations/seeding, recommender secrets, AI Gateway setup, and feature-specific unconfigured behavior. No cloud deployment has been performed.


