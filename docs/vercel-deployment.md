# Vercel deployment

The application is deployed to Vercel as project `hieu-sreviews` with two services: the Next.js web app and a private Python recommendation scorer. The production URL is https://hieu-sreviews.vercel.app. The recommender has no public rewrite; the web service reaches it through the `RECOMMENDER_URL` service binding and also authenticates with `RECOMMENDER_SHARED_SECRET`.

The production deployment is currently protected by Vercel Authentication. Anyone outside the Vercel team needs authorized access before the app will load. Profile selection is not authentication; changing the deployment to public would allow anyone with the URL to read and change the shared journal. Choose the access policy before inviting friends.

Production setup completed October 18, 2026:

- Neon project `quiet-band-41101117`, organization `org-fancy-sea-24821602`, production branch, PostgreSQL 18 in AWS us-west-2. The branch was already compliant with `neon.ts`; `neon deploy` reported no changes and pulled its connection variables locally.
- Applied database migrations and seeded the two starter profiles against Neon production. Seeding preserved existing visits and restaurants.
- Vercel production environment has server-only `DATABASE_URL`, `APP_TIME_ZONE`, and a generated `RECOMMENDER_SHARED_SECRET`; the private service binding supplies `RECOMMENDER_URL`. AI summary credentials and restaurant-provider credentials are not configured, so those features return their documented unavailable states.
- Production deployment `6y27RiqrX71sGk8YCQ83eVGoLtGi` is Ready at https://hieu-sreviews.vercel.app. Authenticated Vercel CLI requests verified the app response and `/api/dashboard` data from Neon. A local end-to-end flow also verified profile switching, restaurant search/create/duplicate detection, repeat visits, edit/delete rating fallback, analytics filters, and graceful summary unavailability. Temporary test data was removed.
- `npm test` (198 tests), lint, typecheck, Python tests (19), production build, and `npm audit --omit=dev` all passed. Browser automation was unavailable. Remote build logs reported 9 development dependency audit findings (4 moderate, 5 high); runtime dependencies have no reported vulnerabilities.

Vercel's current Services feature uses the `services` key and is in Beta on all plans. Enable the **Services** framework for the project and check that the feature is available to the account before attempting a preview. The current `vercel.json` uses `services`, not the legacy `experimentalServices` configuration. Vercel's Python runtime supports WSGI apps; the recommender service is rooted at `api/`, exposes `index:app`, and pins Python 3.12 in `api/.python-version`. The web runtime is pinned to Node 24.x in `package.json`.

## Environment variables

Set values in Vercel Project Settings → Environment Variables for each environment that will use them. Keep secrets server-side: never add `NEXT_PUBLIC_` to these names. Use a separate Neon branch/database and recommendation secret for Preview.

| Variable                    | Web service                          | Recommender service | Required / purpose                                                                                                         |
| --------------------------- | ------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Yes                                  | No                  | Neon pooled PostgreSQL URL for app requests.                                                                               |
| `DATABASE_URL_UNPOOLED`     | Migration shell only                 | No                  | Optional direct Neon URL; database scripts prefer it for migrations/seeding, otherwise use `DATABASE_URL`.                 |
| `APP_TIME_ZONE`             | Yes                                  | No                  | Shared calendar timezone; defaults to `America/Los_Angeles`.                                                               |
| `RECOMMENDER_SHARED_SECRET` | Yes                                  | Yes                 | Same randomly generated value in both services, at least 32 characters. Needed for authenticated server-to-server scoring. |
| `RECOMMENDER_URL`           | Injected by binding                  | No                  | Do not set manually in Vercel. The `web` service binding targets `recommender` and injects this URL.                       |
| `AI_SUMMARY_MODEL`          | Yes                                  | No                  | Gateway model identifier; required to enable grounded summaries.                                                           |
| `AI_GATEWAY_API_KEY`        | Yes, unless Vercel OIDC is available | No                  | Optional server-side AI Gateway credential. Do not expose it to browser code.                                              |
| `AI_SUMMARY_TIMEOUT_MS`     | Optional                             | No                  | Summary call timeout; defaults to 12000 and is clamped to 1000–30000.                                                      |
| `AI_SUMMARY_MAX_RETRIES`    | Optional                             | No                  | Transient retry count; defaults to 2 and is clamped to 0–2.                                                                |

Restaurant provider discovery has no adapter or provider configuration in this release. External saved-place search, Something New discovery and provider-backed recommendations remain explicitly unavailable until a provider with compatible attribution/storage terms is implemented.

## Preview and maintenance checklist

1. Create a separate Neon Preview branch and set its `DATABASE_URL` and `APP_TIME_ZONE` on the web service. Do not store a production URL in Preview.
2. Generate a high-entropy recommendation secret (for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`) and add it as `RECOMMENDER_SHARED_SECRET` to both `web` and `recommender` for Preview. Keep the auto-injected `RECOMMENDER_URL`; a project-level override can take precedence and break the binding.
3. Run reviewed migrations and profile seed against Preview from a trusted shell: `npm run db:migrate` then `npm run db:seed`. `DATABASE_URL_UNPOOLED` is preferred by these scripts. They are not run automatically during build or request handling. Do not run the demo seed against Production.
4. Verify Preview's web and Python service builds, confirm the private binding, test rejection of a wrong shared secret, and run the browser acceptance flow against its disposable database. Keep production deployment protection enabled until the shared-profile access policy is decided.
5. To enable AI summaries, set `AI_SUMMARY_MODEL` on web and either set `AI_GATEWAY_API_KEY` or confirm the deployment can authenticate to AI Gateway with Vercel OIDC. Without those credentials, the application displays the unconfigured state.
6. Review deployment and function logs. Do not promote Preview changes until migrations, secrets, database connectivity, recommendation behavior, and any enabled AI summaries have been verified.

For local Vercel-aware setup, link the project and pull only the Development environment using the official CLI workflow, or use `vercel dev` to test service bindings locally. `.env.local` and downloaded values must stay out of version control. Never paste environment values into logs or browser requests.

The production deployment and Neon connection were verified. Live Python recommendation scoring, AI Gateway generation, and provider permissions still require environment credentials and their own end-to-end checks.

Official guidance checked October 18, 2026: [Vercel Services overview](https://vercel.com/docs/services), [Service configuration](https://vercel.com/docs/services/config-reference), [service bindings and routing](https://vercel.com/docs/services/routing), [Python runtime](https://vercel.com/docs/functions/runtimes/python), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [environment variables](https://vercel.com/docs/environment-variables), [AI Gateway providers and OIDC](https://ai-sdk.dev/docs/getting-started/choosing-a-provider).
