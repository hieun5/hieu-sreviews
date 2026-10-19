import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../../src/db/schema";
import { seedProfiles } from "../../src/db/seed-profiles";
import { recommendationResponseSchema } from "../../src/contracts/recommendations";
import { todayInTimeZone } from "../../src/lib/dates";
import { createRecommendationApi } from "../../src/server/recommendation-api";
import { createRecommendationClient } from "../../src/server/recommendation-client";
import { createRecommendationRepository } from "../../src/server/recommendation-repository";

const apiRoot = fileURLToPath(new URL("../../api/", import.meta.url));
const localPython = path.join(
  apiRoot,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const python =
  process.env.PYTHON_EXECUTABLE ||
  (existsSync(localPython) ? localPython : "python");
const secret = randomBytes(32).toString("hex");
const port = await new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No local port");
    const available = address.port;
    server.close(() => resolve(available));
  });
});
const child = spawn(python, ["index.py"], {
  cwd: apiRoot,
  env: {
    ...process.env,
    PORT: String(port),
    RECOMMENDER_SHARED_SECRET: secret,
  },
  windowsHide: true,
  stdio: ["ignore", "ignore", "pipe"],
});
let startupError: unknown;
child.on("error", (error) => {
  startupError = error;
});
const client = new PGlite();
const db = drizzle(client, { schema });
try {
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError) throw startupError;
    try {
      ready =
        (
          await fetch(`${url}/score`, {
            method: "POST",
            signal: AbortSignal.timeout(500),
          })
        ).status === 401;
    } catch {
      /* Allow the cold interpreter to start. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(
    ready,
    "Python service did not start; check Python and api/requirements.txt",
  );
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedProfiles(db);
  const [restaurant] = await db
    .insert(schema.restaurants)
    .values({
      name: "Fictional E2E journal fixture",
      address: "Test fixture address",
      normalizedName: "fictional e2e journal fixture",
      normalizedAddress: "test fixture address",
      cuisines: ["Noodles"],
      provider: "test",
      providerPlaceId: "logged",
    })
    .returning();
  await db.insert(schema.visits).values([
    {
      restaurantId: restaurant.id,
      profileId: "hieu",
      rating: "10",
      visitDate: "2025-01-01",
    },
    {
      restaurantId: restaurant.id,
      profileId: "nick",
      rating: "6",
      visitDate: "2025-01-01",
    },
  ]);
  const repo = createRecommendationRepository(db);
  const api = createRecommendationApi({
    repository: () => repo,
    selectedProfile: async () => "hieu",
    scorer: () => createRecommendationClient({ url, secret }),
    provider: () => null,
    timeZone: () => "America/Los_Angeles",
    reportError: () => {},
  });
  const post = (body: unknown) =>
    new Request("http://localhost/api/recommendations/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const created = await api.create(
    post({
      requestId: randomUUID(),
      mode: "favorites",
      attendees: ["hieu", "nick"],
    }),
  );
  const runBody = await created.json();
  assert.equal(created.status, 201, JSON.stringify(runBody));
  const run = recommendationResponseSchema.parse(runBody).data;
  assert.equal(run.results[0].preferenceScore, "80.000000");
  assert.equal(run.results[0].metrics.observedMean, "8");
  const resultId = run.results[0].id;
  assert.equal(
    (await api.feedback(post({ resultId, choice: "selected" }), run.id)).status,
    200,
  );
  const [visit] = await db
    .insert(schema.visits)
    .values({
      restaurantId: restaurant.id,
      profileId: "hieu",
      rating: "9",
      visitDate: todayInTimeZone(),
    })
    .returning();
  const confirmation = await api.confirmVisit(
    post({ resultId, visitId: visit.id }),
    run.id,
  );
  assert.equal(confirmation.status, 200);
  assert.equal(
    recommendationResponseSchema.parse(await confirmation.json()).data
      .confirmedVisits.length,
    1,
  );

  const external = {
    provider: "test",
    providerPlaceId: "new",
    name: "Fictional external fixture",
    address: "External fixture address",
    kind: "restaurant" as const,
    cuisines: ["Noodles"],
    priceTier: 2,
    distanceMeters: 100,
    openNow: true,
    attribution: {
      text: "Test-only provider",
      url: "https://provider.test/attribution",
    },
  };
  const discovery = createRecommendationApi({
    repository: () => repo,
    selectedProfile: async () => "hieu",
    scorer: () => createRecommendationClient({ url, secret }),
    provider: () => ({
      name: "test",
      retention: {
        version: "test-only-policy",
        termsUrl: "https://provider.test/terms",
        permanentIdentifiers: true,
        derivedPreferenceScores: true,
      },
      discover: async () => [
        external,
        {
          ...external,
          providerPlaceId: "logged",
          name: "Renamed logged fixture",
        },
      ],
      getDetails: async () => external,
    }),
    timeZone: () => "America/Los_Angeles",
    reportError: () => {},
  });
  const next = await discovery.create(
    post({ requestId: randomUUID(), mode: "new", attendees: ["hieu"] }),
  );
  const nextBody = await next.json();
  assert.equal(next.status, 201, JSON.stringify(nextBody));
  const discovered = recommendationResponseSchema.parse(nextBody).data;
  assert.equal(discovered.results.length, 1);
  assert.equal(discovered.results[0].providerPlaceId, "new");
  assert.equal(discovered.counts?.rejectionReasons["already-logged"], 1);
  assert.equal((await db.select().from(schema.restaurants)).length, 1);
  console.log(
    "Recommendation E2E passed: Next.js service -> private Python HTTP -> PostgreSQL run/ranks, exclusions, feedback and confirmed visit link. Only disposable fixtures used.",
  );
} finally {
  if (child.pid && process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else child.kill("SIGTERM");
  await client.close();
}
