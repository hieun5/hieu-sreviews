import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  recommendationListResponseSchema,
  recommendationResponseSchema,
  type ScoredRecommendations,
  type ScoringInput,
} from "../../src/contracts/recommendations";
import { apiErrorSchema } from "../../src/contracts/journal";
import * as schema from "../../src/db/schema";
import { seedProfiles } from "../../src/db/seed-profiles";
import { todayInTimeZone } from "../../src/lib/dates";
import { ApiError } from "../../src/server/api-errors";
import { createRecommendationApi } from "../../src/server/recommendation-api";
import { createRecommendationClient } from "../../src/server/recommendation-client";
import { createRecommendationRepository } from "../../src/server/recommendation-repository";
import type { RecommendationProvider } from "../../src/server/recommendation-provider";

const client = new PGlite();
const db = drizzle(client, { schema });
const repository = createRecommendationRepository(db);
const placeA = "10000000-0000-4000-8000-000000000001";
const placeB = "10000000-0000-4000-8000-000000000002";
let selected: string | undefined = "hieu";
let configured = true;
let provider: RecommendationProvider | null = null;
const metrics = {
  coverage: "1",
  observedMean: "8",
  disagreement: null,
  cuisineAffinity: null,
  ratedAttendeeCount: 1,
  preferenceAttendeeCount: 0,
  coldStartAttendeeCount: 0,
  metadataKnownCount: 0,
};
const score = vi.fn(
  async (input: ScoringInput): Promise<ScoredRecommendations> => ({
    algorithmVersion: "recommendations-v1",
    scoreKind: "preference-index",
    results: input.candidates.length
      ? [
          {
            candidateKey: input.candidates[0].key,
            rank: 1,
            preferenceScore: "80.000000",
            metrics,
            explanations: [
              {
                code: "observed-ratings",
                message: "Fixture preference index; not a rating.",
              },
            ],
          },
        ]
      : [],
    counts: {
      candidateCount: input.candidates.length,
      eligibleCount: input.candidates.length ? 1 : 0,
      rankedCount: input.candidates.length ? 1 : 0,
      excludedCount: Math.max(0, input.candidates.length - 1),
      rejectionReasons: {},
    },
  }),
);
const reportError = vi.fn();
const api = createRecommendationApi({
  repository: () => repository,
  selectedProfile: async () => selected,
  scorer: () => ({ configured, score }),
  provider: () => provider,
  timeZone: () => "America/Los_Angeles",
  reportError,
});
const request = (method = "GET", body?: unknown) =>
  new Request("http://localhost/api/recommendations/runs", {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
const input = (overrides: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  mode: "favorites",
  attendees: ["hieu", "nick"],
  ...overrides,
});
async function read(response: Response, status = 200) {
  const body: unknown = await response.json();
  if (response.status !== status && reportError.mock.lastCall)
    throw reportError.mock.lastCall[0];
  expect(response.status, JSON.stringify(body)).toBe(status);
  return recommendationResponseSchema.parse(body).data;
}
async function failure(response: Response, status: number, code: string) {
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(status);
  expect(apiErrorSchema.parse(body).error.code).toBe(code);
  return body;
}
const create = async (overrides: Record<string, unknown> = {}) =>
  read(await api.create(request("POST", input(overrides))), 201);
const liveCandidate = {
  provider: "test",
  providerPlaceId: "external-1",
  name: "Provider business name",
  address: "Provider business address",
  kind: "restaurant" as const,
  cuisines: ["Noodles"],
  priceTier: 2,
  distanceMeters: 100,
  openNow: true,
  attribution: {
    text: "Test provider attribution",
    url: "https://provider.test/attribution",
  },
};
function testProvider(): RecommendationProvider {
  return {
    name: "test",
    retention: {
      version: "test-policy-v1",
      termsUrl: "https://provider.test/terms",
      permanentIdentifiers: true,
      derivedPreferenceScores: true,
    },
    discover: vi.fn().mockResolvedValue([liveCandidate]),
    getDetails: vi.fn().mockResolvedValue(liveCandidate),
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await db.delete(schema.recommendationRuns);
  await db.delete(schema.visits);
  await db.delete(schema.restaurants);
  await seedProfiles(db);
  await db.insert(schema.restaurants).values([
    {
      id: placeA,
      name: "Saved A",
      address: "A street",
      normalizedName: "saved a",
      normalizedAddress: "a street",
      cuisines: ["Noodles"],
      provider: "test",
      providerPlaceId: "logged",
    },
    {
      id: placeB,
      name: "Saved B",
      address: "B street",
      normalizedName: "saved b",
      normalizedAddress: "b street",
      cuisines: ["Coffee"],
    },
  ]);
  await db.insert(schema.visits).values([
    {
      restaurantId: placeA,
      profileId: "hieu",
      rating: "2",
      visitDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      restaurantId: placeA,
      profileId: "hieu",
      rating: "8",
      visitDate: "2025-02-01",
      createdAt: "2025-02-01T00:00:00Z",
    },
    {
      restaurantId: placeA,
      profileId: "nick",
      rating: "6",
      visitDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ]);
  selected = "hieu";
  configured = true;
  provider = null;
  score.mockClear();
  reportError.mockReset();
});

describe("recommendation PostgreSQL persistence and API orchestration", () => {
  it("persists a run, attendees and ranks, using shared current scores once per person/place", async () => {
    const run = await create();
    expect(run.status).toBe("completed");
    expect(run.attendees).toEqual(["hieu", "nick"]);
    expect(run.results[0]).toMatchObject({
      restaurantId: placeA,
      preferenceScore: "80.000000",
      display: {
        status: "available",
        source: "journal",
        restaurant: {
          currentRating: { average: "7", reviewerCount: 2, visitCount: 3 },
        },
      },
    });
    expect(run.scoreKind).toBe("preference-index");
    expect(run.scoreRange).toEqual({ min: 0, max: 100 });
    const sent = score.mock.calls[0][0];
    expect(sent.ratings.filter((row) => row.profileId === "hieu")).toEqual([
      { restaurantId: placeA, profileId: "hieu", rating: "8" },
    ]);
    expect((await read(await api.get(request(), run.id))).results[0].id).toBe(
      run.results[0].id,
    );
    for (const section of [
      "attendees",
      "results",
      "feedback",
      "confirmedVisits",
    ] as const) {
      const response = await api.projection(request(), run.id, section);
      expect(response.status).toBe(200);
      expect((await response.json()).meta.runId).toBe(run.id);
    }
  });

  it("reuses request IDs, including attendee reordering, and rejects changed payloads", async () => {
    const body = input();
    const first = await read(await api.create(request("POST", body)), 201);
    const second = await read(
      await api.create(
        request("POST", { ...body, attendees: ["nick", "hieu"] }),
      ),
    );
    expect(second.id).toBe(first.id);
    expect(score).toHaveBeenCalledTimes(1);
    await failure(
      await api.create(request("POST", { ...body, limit: 1 })),
      409,
      "IDEMPOTENCY_CONFLICT",
    );
    expect(await db.select().from(schema.recommendationRuns)).toHaveLength(1);
  });

  it("makes one durable pending run during concurrent retries", async () => {
    const body = input();
    const responses = await Promise.all([
      api.create(request("POST", body)),
      api.create(request("POST", body)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual(
      expect.arrayContaining([201]),
    );
    expect(score).toHaveBeenCalledTimes(1);
    expect(await db.select().from(schema.recommendationRuns)).toHaveLength(1);
  });

  it("returns explicit unavailable states for unconfigured discovery/scorer without fake results", async () => {
    const discovery = await create({ mode: "new" });
    expect(discovery).toMatchObject({
      status: "unavailable",
      reason: "discovery-unconfigured",
      results: [],
      counts: null,
    });
    configured = false;
    const favorites = await create();
    expect(favorites).toMatchObject({
      status: "unavailable",
      reason: "scorer-unconfigured",
      results: [],
      counts: null,
    });
    expect(score).not.toHaveBeenCalled();
  });

  it("rejects provider policies that do not permit durable references and derived scores", async () => {
    provider = testProvider();
    provider.retention.permanentIdentifiers = false;
    const run = await create({ mode: "new" });
    expect(run.reason).toBe("provider-storage-policy-unavailable");
    expect(provider.discover).not.toHaveBeenCalled();
  });

  it("passes all-group logged identities to discovery exclusion and never persists listing metadata", async () => {
    provider = testProvider();
    const run = await create({ mode: "new", attendees: ["vinh"] });
    const sent = score.mock.calls[0][0];
    expect(sent.excluded.restaurantIds).toEqual([placeA]);
    expect(sent.excluded.providerKeys).toEqual(['["test","logged"]']);
    expect(sent.excluded.normalizedKeys).toEqual(['["saved a","a street"]']);
    expect(run.results[0].display).toMatchObject({
      status: "available",
      source: "provider",
      candidate: { attribution: liveCandidate.attribution },
    });
    const saved = await db.select().from(schema.recommendationResults);
    const persisted = JSON.stringify(saved);
    for (const forbidden of [
      liveCandidate.name,
      liveCandidate.address,
      liveCandidate.attribution.text,
      liveCandidate.attribution.url,
      '"cuisines"',
      '"distanceMeters"',
      '"openNow"',
    ])
      expect(persisted).not.toContain(forbidden);
    expect(saved[0]).toMatchObject({
      provider: "test",
      providerPlaceId: "external-1",
      providerPolicyVersion: "test-policy-v1",
      restaurantId: null,
    });
    expect(await db.select().from(schema.restaurants)).toHaveLength(2);
    provider = null;
    expect(
      (await read(await api.get(request(), run.id))).results[0].display.status,
    ).toBe("unavailable");
  });

  it("stores failed runs and returns upstream errors rather than empty success", async () => {
    provider = testProvider();
    vi.mocked(provider.discover).mockRejectedValueOnce(
      new Error("private provider details"),
    );
    const response = await failure(
      await api.create(request("POST", input({ mode: "new" }))),
      502,
      "PROVIDER_UNAVAILABLE",
    );
    const run = await repository.getRun(response.error.details.runId);
    expect(run?.status).toBe("failed");
    expect(run?.results).toEqual([]);
  });

  it("persists scorer failure without replacing it with a fabricated ranking", async () => {
    score.mockRejectedValueOnce(
      new ApiError(502, "RECOMMENDER_UNAVAILABLE", "Scorer unavailable."),
    );
    const response = await failure(
      await api.create(request("POST", input())),
      502,
      "RECOMMENDER_UNAVAILABLE",
    );
    expect(
      (await repository.getRun(response.error.details.runId))?.status,
    ).toBe("failed");
    expect(await db.select().from(schema.recommendationResults)).toEqual([]);
  });

  it("stores empty rankings honestly", async () => {
    score.mockImplementationOnce(async (sent) => ({
      algorithmVersion: "recommendations-v1",
      scoreKind: "preference-index",
      results: [],
      counts: {
        candidateCount: sent.candidates.length,
        eligibleCount: 0,
        rankedCount: 0,
        excludedCount: sent.candidates.length,
        rejectionReasons: { "no-attendee-ratings": sent.candidates.length },
      },
    }));
    const run = await create({ attendees: ["vinh"] });
    expect(run.status).toBe("empty");
    expect(run.results).toEqual([]);
  });

  it("persists one selection per attendee and prevents cross-run/cross-profile feedback", async () => {
    const run = await create();
    const resultId = run.results[0].id;
    let changed = await read(
      await api.feedback(
        request("POST", { resultId, choice: "selected" }),
        run.id,
      ),
    );
    expect(changed.feedback[0].profileId).toBe("hieu");
    changed = await read(
      await api.feedback(
        request("POST", { resultId, choice: "dismissed" }),
        run.id,
      ),
    );
    expect(changed.feedback).toHaveLength(1);
    expect(changed.feedback[0].choice).toBe("dismissed");
    selected = "vinh";
    await failure(
      await api.feedback(
        request("POST", { resultId, choice: "selected" }),
        run.id,
      ),
      403,
      "NOT_ATTENDING",
    );
    selected = "hieu";
    const other = await create();
    await failure(
      await api.feedback(
        request("POST", { resultId, choice: "selected" }),
        other.id,
      ),
      404,
      "NOT_FOUND",
    );
  });

  it("confirms only a selected, matching, owned, post-run visit; deletion/identity correction clears links", async () => {
    const run = await create();
    const resultId = run.results[0].id;
    const [visit] = await db
      .insert(schema.visits)
      .values({
        restaurantId: placeA,
        profileId: "hieu",
        rating: "9",
        visitDate: todayInTimeZone(),
      })
      .returning();
    await failure(
      await api.confirmVisit(
        request("POST", { resultId, visitId: visit.id }),
        run.id,
      ),
      409,
      "INVALID_VISIT_LINK",
    );
    await read(
      await api.feedback(
        request("POST", { resultId, choice: "selected" }),
        run.id,
      ),
    );
    let confirmed = await read(
      await api.confirmVisit(
        request("POST", { resultId, visitId: visit.id }),
        run.id,
      ),
    );
    expect(confirmed.confirmedVisits).toHaveLength(1);
    confirmed = await read(
      await api.confirmVisit(
        request("POST", { resultId, visitId: visit.id }),
        run.id,
      ),
    );
    expect(confirmed.confirmedVisits).toHaveLength(1);
    await failure(
      await api.feedback(
        request("POST", { resultId, choice: "dismissed" }),
        run.id,
      ),
      409,
      "FEEDBACK_LOCKED",
    );
    await expect(
      db.update(schema.recommendationFeedback).set({ choice: "dismissed" }),
    ).rejects.toThrow();
    await db
      .update(schema.visits)
      .set({ visitDate: "2025-01-01" })
      .where(eq(schema.visits.id, visit.id));
    expect(
      (await read(await api.get(request(), run.id))).confirmedVisits,
    ).toEqual([]);
    await db
      .update(schema.visits)
      .set({ visitDate: todayInTimeZone() })
      .where(eq(schema.visits.id, visit.id));
    await read(
      await api.confirmVisit(
        request("POST", { resultId, visitId: visit.id }),
        run.id,
      ),
    );
    await db.delete(schema.visits).where(eq(schema.visits.id, visit.id));
    expect(
      (await read(await api.get(request(), run.id))).confirmedVisits,
    ).toEqual([]);
  });

  it("rejects historical, another person's and mismatched-restaurant visit links", async () => {
    const run = await create();
    const resultId = run.results[0].id;
    await read(
      await api.feedback(
        request("POST", { resultId, choice: "selected" }),
        run.id,
      ),
    );
    const old = (await db.select().from(schema.visits))[0];
    await failure(
      await api.confirmVisit(
        request("POST", { resultId, visitId: old.id }),
        run.id,
      ),
      409,
      "INVALID_VISIT_LINK",
    );
    for (const values of [
      { restaurantId: placeB, profileId: "hieu" },
      { restaurantId: placeA, profileId: "nick" },
    ]) {
      const [visit] = await db
        .insert(schema.visits)
        .values({ ...values, rating: "8", visitDate: todayInTimeZone() })
        .returning();
      await failure(
        await api.confirmVisit(
          request("POST", { resultId, visitId: visit.id }),
          run.id,
        ),
        409,
        "INVALID_VISIT_LINK",
      );
    }
  });

  it("lists durable run summaries with consistent pagination", async () => {
    await create();
    await create();
    const response = await api.list(
      new Request("http://localhost/api/recommendations/runs?pageSize=1"),
    );
    const data = recommendationListResponseSchema.parse(await response.json());
    expect(data.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      hasNextPage: true,
    });
    expect(data.data[0].resultCount).toBe(1);
  });

  it.each([
    { attendees: [] },
    { attendees: ["unknown"] },
    { attendees: ["hieu", "hieu"] },
    { mode: "unknown" },
    { limit: 0 },
    { filters: { maxPriceTier: 5 } },
    { providerCandidates: [] },
  ])("validates public requests %j", async (invalid) => {
    await failure(
      await api.create(request("POST", input(invalid))),
      422,
      "VALIDATION_ERROR",
    );
    expect(await db.select().from(schema.recommendationRuns)).toHaveLength(0);
  });

  it("enforces SQL result identity and atomic finish rollback", async () => {
    const body = {
      ...input(),
      query: "",
      limit: 10,
      filters: {
        cuisine: null,
        kind: null,
        maxPriceTier: null,
        maxDistanceMeters: null,
        openNowOnly: false,
      },
    } as Parameters<typeof repository.claim>[0];
    const claimed = await repository.claim(body, "hieu");
    await expect(
      db.insert(schema.recommendationResults).values({
        runId: claimed.id,
        rank: 1,
        preferenceScore: "50",
        restaurantId: null,
        provider: null,
        providerPlaceId: null,
        providerPolicyVersion: null,
        metrics,
        explanations: [],
      }),
    ).rejects.toThrow();
    const scored: ScoredRecommendations = {
      algorithmVersion: "recommendations-v1",
      scoreKind: "preference-index",
      results: [],
      counts: {
        candidateCount: 1,
        eligibleCount: 1,
        rankedCount: 1,
        excludedCount: 0,
        rejectionReasons: {},
      },
    };
    await expect(
      repository.finish(claimed.id, scored, [
        {
          candidateKey: "invalid",
          rank: 1,
          preferenceScore: "50",
          restaurantId: null,
          provider: null,
          providerPlaceId: null,
          providerPolicyVersion: null,
          metrics,
          explanations: [],
        },
      ]),
    ).rejects.toThrow();
    expect((await repository.getRun(claimed.id))?.status).toBe("pending");
  });

  it("expires interrupted workers on a cold retry without silently re-scoring changed inputs", async () => {
    const body = {
      ...input(),
      query: "",
      limit: 10,
      filters: {
        cuisine: null,
        kind: null,
        maxPriceTier: null,
        maxDistanceMeters: null,
        openNowOnly: false,
      },
    } as Parameters<typeof repository.claim>[0];
    const claimed = await repository.claim(body, "hieu");
    await db
      .update(schema.recommendationRuns)
      .set({ createdAt: "2025-01-01T00:00:00Z" })
      .where(eq(schema.recommendationRuns.id, claimed.id));
    const run = await read(await api.create(request("POST", body)));
    expect(run.status).toBe("failed");
    expect(run.reason).toBe("worker-interrupted");
    expect(score).not.toHaveBeenCalled();
  });
});

describe("private scoring client contract", () => {
  it("requires configuration and sends only a server-side bearer secret, with no redirects/cache", async () => {
    await expect(
      createRecommendationClient({}).score({} as ScoringInput),
    ).rejects.toMatchObject({ code: "RECOMMENDER_UNCONFIGURED" });
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          algorithmVersion: "recommendations-v1",
          scoreKind: "preference-index",
          results: [],
          counts: {
            candidateCount: 0,
            eligibleCount: 0,
            rankedCount: 0,
            excludedCount: 0,
            rejectionReasons: {},
          },
        },
      }),
    );
    await createRecommendationClient(
      {
        url: "https://private.example",
        secret: "test-only-secret-123456789123456789",
      },
      fetcher,
    ).score({ candidates: [], limit: 10 } as unknown as ScoringInput);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://private.example/score");
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: "Bearer test-only-secret-123456789123456789" },
    });
  });

  it("never turns failures, malformed or fabricated upstream results into recommendations", async () => {
    for (const response of [
      Response.json({ error: "private" }, { status: 500 }),
      Response.json({ data: {} }),
      Response.json({
        data: {
          algorithmVersion: "recommendations-v1",
          scoreKind: "preference-index",
          results: [{ candidateKey: "invented" }],
          counts: {},
        },
      }),
    ]) {
      const scorer = createRecommendationClient(
        {
          url: "https://private.example",
          secret: "test-only-secret-123456789123456789",
        },
        vi.fn().mockResolvedValue(response),
      );
      await expect(
        scorer.score({ candidates: [], limit: 10 } as unknown as ScoringInput),
      ).rejects.toMatchObject({ code: "RECOMMENDER_UNAVAILABLE" });
    }
  });
});
