import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({ profile: "hieu" as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "journal_profile" && selection.profile
        ? { value: selection.profile }
        : undefined,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../src/db";
import * as restaurants from "../../src/app/api/restaurants/route";
import * as restaurant from "../../src/app/api/restaurants/[id]/route";
import * as visits from "../../src/app/api/visits/route";
import * as visit from "../../src/app/api/visits/[id]/route";
import * as search from "../../src/app/api/places/search/route";
import * as dashboard from "../../src/app/api/dashboard/route";
import * as analytics from "../../src/app/api/analytics/route";
import * as recommendationRuns from "../../src/app/api/recommendations/runs/route";
import * as recommendationRun from "../../src/app/api/recommendations/runs/[id]/route";
import * as recommendationFeedback from "../../src/app/api/recommendations/runs/[id]/feedback/route";
import * as recommendationVisits from "../../src/app/api/recommendations/runs/[id]/visits/route";
import * as recommendationAttendees from "../../src/app/api/recommendations/runs/[id]/attendees/route";
import * as recommendationResults from "../../src/app/api/recommendations/runs/[id]/results/route";
import {
  apiErrorSchema,
  externalSearchResponseSchema,
} from "../../src/contracts/journal";

const id = "10000000-0000-4000-8000-000000000001";
const context = () => ({ params: Promise.resolve({ id }) });
const request = (path: string, method = "GET", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const mutations = () => [
  () =>
    recommendationRuns.POST(
      request("/api/recommendations/runs", "POST", {
        requestId: id,
        mode: "favorites",
        attendees: ["hieu"],
      }),
    ),
  () =>
    recommendationFeedback.POST(
      request(`/api/recommendations/runs/${id}/feedback`, "POST", {
        resultId: id,
        choice: "selected",
      }),
      context(),
    ),
  () =>
    recommendationVisits.POST(
      request(`/api/recommendations/runs/${id}/visits`, "POST", {
        resultId: id,
        visitId: id,
      }),
      context(),
    ),
  () =>
    restaurants.POST(
      request("/api/restaurants", "POST", {
        name: "Moon",
        address: "123 Main",
      }),
    ),
  () =>
    visits.POST(
      request("/api/visits", "POST", {
        restaurantId: id,
        rating: 8.04,
        visitDate: "2020-01-01",
      }),
    ),
  () =>
    visit.PATCH(
      request(`/api/visits/${id}`, "PATCH", { rating: 6 }),
      context(),
    ),
  () => visit.DELETE(request(`/api/visits/${id}`, "DELETE"), context()),
];
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = apiErrorSchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("DATABASE_URL", undefined);
  selection.profile = "hieu";
  vi.mocked(getDb).mockReset();
});

describe("actual Next.js route exports and runtime composition", () => {
  it("reads the existing profile cookie and returns JSON selection errors for every journal route", async () => {
    for (const profile of [undefined, "invalid"]) {
      selection.profile = profile;
      const responses = await Promise.all([
        restaurants.GET(request("/api/restaurants")),
        restaurant.GET(request(`/api/restaurants/${id}`), context()),
        visits.GET(request("/api/visits")),
        visit.GET(request(`/api/visits/${id}`), context()),
        search.GET(request("/api/places/search?q=coffee")),
        dashboard.GET(request("/api/dashboard")),
        analytics.GET(request("/api/analytics")),
        recommendationRuns.GET(request("/api/recommendations/runs")),
        recommendationRun.GET(
          request(`/api/recommendations/runs/${id}`),
          context(),
        ),
        recommendationFeedback.GET(
          request(`/api/recommendations/runs/${id}/feedback`),
          context(),
        ),
        recommendationVisits.GET(
          request(`/api/recommendations/runs/${id}/visits`),
          context(),
        ),
        recommendationAttendees.GET(
          request(`/api/recommendations/runs/${id}/attendees`),
          context(),
        ),
        recommendationResults.GET(
          request(`/api/recommendations/runs/${id}/results`),
          context(),
        ),
        ...mutations().map((run) => run()),
      ]);
      for (const response of responses)
        await error(response, 401, "PROFILE_REQUIRED");
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns explicit missing-database errors for real data routes without creating a client", async () => {
    const responses = await Promise.all([
      restaurants.GET(request("/api/restaurants")),
      restaurant.GET(request(`/api/restaurants/${id}`), context()),
      visits.GET(request("/api/visits")),
      visit.GET(request(`/api/visits/${id}`), context()),
      dashboard.GET(request("/api/dashboard")),
      analytics.GET(request("/api/analytics")),
      recommendationRuns.GET(request("/api/recommendations/runs")),
      recommendationRun.GET(
        request(`/api/recommendations/runs/${id}`),
        context(),
      ),
      recommendationFeedback.GET(
        request(`/api/recommendations/runs/${id}/feedback`),
        context(),
      ),
      recommendationVisits.GET(
        request(`/api/recommendations/runs/${id}/visits`),
        context(),
      ),
      recommendationAttendees.GET(
        request(`/api/recommendations/runs/${id}/attendees`),
        context(),
      ),
      recommendationResults.GET(
        request(`/api/recommendations/runs/${id}/results`),
        context(),
      ),
      ...mutations().map((run) => run()),
    ]);
    for (const response of responses)
      await error(response, 503, "DATABASE_UNCONFIGURED");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("keeps external configuration independent from database setup", async () => {
    const response = await search.GET(request("/api/places/search?q=coffee"));
    expect(response.status).toBe(200);
    expect(
      externalSearchResponseSchema.parse(await response.json()).status,
    ).toBe("unconfigured");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("awaits dynamic parameters and validates IDs before database access", async () => {
    const invalid = { params: Promise.resolve({ id: "bad-id" }) };
    await error(
      await restaurant.GET(request("/api/restaurants/bad-id"), invalid),
      400,
      "INVALID_ID",
    );
    await error(
      await visit.GET(request("/api/visits/bad-id"), invalid),
      400,
      "INVALID_ID",
    );
    await error(
      await visit.PATCH(
        request("/api/visits/bad-id", "PATCH", { rating: 8 }),
        invalid,
      ),
      400,
      "INVALID_ID",
    );
    await error(
      await visit.DELETE(request("/api/visits/bad-id", "DELETE"), invalid),
      400,
      "INVALID_ID",
    );
    expect(getDb).not.toHaveBeenCalled();
  });

  it("provides consistent unsupported-method errors and accurate OPTIONS headers", async () => {
    const routes = [
      {
        reject: restaurants.PUT,
        options: restaurants.OPTIONS,
        allow: "GET, HEAD, POST, OPTIONS",
      },
      {
        reject: restaurant.POST,
        options: restaurant.OPTIONS,
        allow: "GET, HEAD, OPTIONS",
      },
      {
        reject: visits.PUT,
        options: visits.OPTIONS,
        allow: "GET, HEAD, POST, OPTIONS",
      },
      {
        reject: visit.PUT,
        options: visit.OPTIONS,
        allow: "GET, HEAD, PATCH, DELETE, OPTIONS",
      },
      {
        reject: search.POST,
        options: search.OPTIONS,
        allow: "GET, HEAD, OPTIONS",
      },
      {
        reject: dashboard.POST,
        options: dashboard.OPTIONS,
        allow: "GET, HEAD, OPTIONS",
      },
      {
        reject: analytics.POST,
        options: analytics.OPTIONS,
        allow: "GET, HEAD, OPTIONS",
      },
    ];
    for (const route of routes) {
      const response = route.reject();
      expect(response.headers.get("allow")).toBe(route.allow);
      await error(response, 405, "METHOD_NOT_ALLOWED");
      const options = route.options();
      expect(options.status).toBe(204);
      expect(options.headers.get("allow")).toBe(route.allow);
      expect(await options.text()).toBe("");
    }
  });

  it("sanitizes database and unexpected failures without logging secrets", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://private:secret@db.example/database",
      );
      vi.mocked(getDb).mockImplementationOnce(() => {
        throw new DrizzleQueryError(
          "private SQL",
          ["private input"],
          new Error("private connection details"),
        );
      });
      const unavailable = await error(
        await restaurants.GET(request("/api/restaurants")),
        503,
        "DATABASE_UNAVAILABLE",
      );
      expect(JSON.stringify(unavailable)).not.toMatch(/private|secret|SQL/);
      vi.mocked(getDb).mockImplementationOnce(() => {
        throw new Error("private internal details");
      });
      const unexpected = await error(
        await restaurants.GET(request("/api/restaurants")),
        500,
        "INTERNAL_ERROR",
      );
      expect(JSON.stringify(unexpected)).not.toContain("private");
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|secret|SQL/);
    } finally {
      log.mockRestore();
    }
  });
});
