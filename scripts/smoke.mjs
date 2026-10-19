import assert from "node:assert/strict";

// HTTP checks against an already-running production server. This is not a
// substitute for browser acceptance or a live Neon connection test.
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const request = (path, options = {}) => {
  const headers = new Headers(options.headers);
  if (options.method === "POST") headers.set("origin", new URL(base).origin);
  return fetch(new URL(path, base), {
    redirect: "manual",
    ...options,
    headers,
  });
};

const root = await request("/");
assert.equal(root.status, 307);
assert.equal(root.headers.get("location"), "/profiles");
console.log("PASS: missing profile redirects to selection");

const invalid = await request("/places", {
  headers: { cookie: "journal_profile=unknown" },
});
assert.equal(invalid.status, 307);
assert.equal(invalid.headers.get("location"), "/profiles");
console.log("PASS: invalid profile redirects to selection");

const selection = await request("/profiles");
assert.equal(selection.status, 200);
const html = await selection.text();
for (const name of ["Hieu", "Ky-An", "Vinh", "Nick", "Mai-Han"])
  assert.ok(html.includes(name));
assert.ok(html.includes("not secured accounts"));
console.log(
  "PASS: all configured profiles and shared-selection explanation render",
);

const actionName = html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
assert.ok(
  actionName,
  "Profile form must expose a progressively enhanced server action",
);
const form = new FormData();
form.set(actionName, "");
form.set("profileId", "hieu");
const selected = await request("/profiles", { method: "POST", body: form });
assert.equal(selected.status, 303);
const selectedCookie = selected.headers.get("set-cookie") || "";
assert.match(selectedCookie, /journal_profile=hieu/);
assert.match(selectedCookie, /HttpOnly/i);
assert.match(selectedCookie, /SameSite=lax/i);
assert.match(selectedCookie, /Secure/i);
assert.equal(selected.headers.get("location"), "/");
console.log(
  "PASS: selecting Hieu sets the production cookie and redirects home",
);

for (const path of ["/", "/places", "/analytics", "/places/new"]) {
  const response = await request(path, {
    headers: { cookie: "journal_profile=hieu" },
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes("Hieu"));
  assert.ok(body.includes("Switch Profile"));
  console.log(`PASS: ${path} renders with the selected profile`);
}

const switchForm = new FormData();
switchForm.set(actionName, "");
switchForm.set("profileId", "mai-han");
const switched = await request("/profiles", {
  method: "POST",
  body: switchForm,
  headers: { cookie: "journal_profile=hieu" },
});
assert.equal(switched.status, 303);
assert.match(
  switched.headers.get("set-cookie") || "",
  /journal_profile=mai-han/,
);
const homeAfterSwitch = await request("/", {
  headers: { cookie: "journal_profile=mai-han" },
});
assert.ok((await homeAfterSwitch.text()).includes("Hey, Mai-Han"));
console.log("PASS: switching to Mai-Han updates the cookie and home content");
