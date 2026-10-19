import assert from "node:assert/strict";

// Read-only and deliberately invalid writes: safe to run against a configured
// development journal without creating fictional restaurant or visit records.
const base = process.env.BACKEND_SMOKE_BASE_URL || "http://127.0.0.1:3101";
const id = "10000000-0000-4000-8000-000000000001";
const selected = { Cookie: "journal_profile=hieu" };
let checks = 0;

async function call(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    ...options,
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return response;
}

async function expectError(path, status, code, options = {}) {
  const response = await call(path, options);
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.equal(typeof body.error.fieldErrors, "object");
  checks++;
}

const routes = [
  "/api/recommendations/runs",
  `/api/recommendations/runs/${id}`,
  `/api/recommendations/runs/${id}/attendees`,
  `/api/recommendations/runs/${id}/results`,
  `/api/recommendations/runs/${id}/feedback`,
  `/api/recommendations/runs/${id}/visits`,
  "/api/dashboard",
  "/api/analytics",
  "/api/restaurants",
  `/api/restaurants/${id}`,
  "/api/visits",
  `/api/visits/${id}`,
  "/api/places/search?q=coffee",
];
for (const path of routes) await expectError(path, 401, "PROFILE_REQUIRED");
await expectError("/api/restaurants", 401, "PROFILE_REQUIRED", {
  headers: { Cookie: "journal_profile=invalid" },
});
await expectError("/api/restaurants?page=1&page=2", 400, "INVALID_QUERY", {
  headers: selected,
});
await expectError("/api/restaurants/not-an-id", 400, "INVALID_ID", {
  headers: selected,
});
await expectError("/api/restaurants", 422, "VALIDATION_ERROR", {
  method: "POST",
  headers: { ...selected, "Content-Type": "application/json" },
  body: "{}",
});
await expectError("/api/visits", 400, "INVALID_JSON", {
  method: "POST",
  headers: { ...selected, "Content-Type": "application/json" },
  body: "{",
});
await expectError("/api/visits", 422, "VALIDATION_ERROR", {
  method: "POST",
  headers: { ...selected, "Content-Type": "application/json" },
  body: JSON.stringify({
    restaurantId: id,
    rating: 11,
    visitDate: "2020-01-01",
  }),
});
await expectError(`/api/visits/${id}`, 422, "VALIDATION_ERROR", {
  method: "PATCH",
  headers: { ...selected, "Content-Type": "application/json" },
  body: JSON.stringify({ restaurantId: id }),
});
await expectError("/api/visits/not-an-id", 400, "INVALID_ID", {
  method: "DELETE",
  headers: selected,
});
await expectError("/api/restaurants", 405, "METHOD_NOT_ALLOWED", {
  method: "PUT",
  headers: selected,
});
await expectError(`/api/restaurants/${id}/summary`, 405, "METHOD_NOT_ALLOWED", {
  method: "GET",
  headers: selected,
});

let databaseConfigured = false;
for (const path of ["/api/restaurants?pageSize=1", "/api/visits?pageSize=1"]) {
  const response = await call(path, { headers: selected });
  const body = await response.json();
  if (response.status === 503) {
    assert.equal(body.error.code, "DATABASE_UNCONFIGURED");
  } else {
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.pagination.pageSize, 1);
    databaseConfigured = true;
  }
  checks++;
}

const external = await call("/api/places/search?q=coffee", {
  headers: selected,
});
assert.equal(external.status, 200);
assert.equal((await external.json()).status, "unconfigured");
checks++;

for (const path of ["/api/dashboard", "/api/analytics"]) {
  const response = await call(path, { headers: selected });
  const body = await response.json();
  if (response.status === 503)
    assert.equal(body.error.code, "DATABASE_UNCONFIGURED");
  else {
    assert.equal(response.status, 200);
    assert.equal(body.data.meta.filters.view, "group");
    assert.equal(typeof body.data.counts.historicalVisitCount, "number");
  }
  checks++;
}
const recommendationResponse = await call("/api/recommendations/runs", {
  headers: selected,
});
assert.ok([200, 503].includes(recommendationResponse.status));
const recommendations = await recommendationResponse.json();
if (recommendationResponse.status === 503)
  assert.equal(recommendations.error.code, "DATABASE_UNCONFIGURED");
else assert.ok(Array.isArray(recommendations.data));
checks++;
await expectError("/api/recommendations/runs", 422, "VALIDATION_ERROR", {
  method: "POST",
  headers: { ...selected, "Content-Type": "application/json" },
  body: "{}",
});
await expectError(
  "/api/analytics?view=group&profileId=hieu",
  400,
  "INVALID_QUERY",
  { headers: selected },
);
await expectError("/api/dashboard?recentLimit=0", 400, "INVALID_QUERY", {
  headers: selected,
});

for (const path of routes) {
  const response = await call(path, { method: "OPTIONS" });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("allow") || "", /GET/);
  assert.equal(await response.text(), "");
  checks++;
}
const head = await call("/api/restaurants", {
  method: "HEAD",
  headers: selected,
});
assert.equal(head.status, databaseConfigured ? 200 : 503);
assert.equal(await head.text(), "");
checks++;

console.log(
  `API HTTP smoke: ${checks} checks passed; database ${databaseConfigured ? "configured (read only)" : "unconfigured"}. Live database CRUD was not exercised.`,
);
