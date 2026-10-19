import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("private Python deployment configuration", () => {
  it("uses current Services bindings without exposing Python through a public rewrite", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(config.services.web).toMatchObject({
      root: ".",
      framework: "nextjs",
      bindings: [
        {
          type: "service",
          service: "recommender",
          format: "url",
          env: "RECOMMENDER_URL",
        },
      ],
    });
    expect(config.services.recommender).toMatchObject({
      root: "api",
      framework: "flask",
      entrypoint: "index:app",
    });
    expect(config.rewrites).toEqual([
      { source: "/(.*)", destination: { service: "web" } },
    ]);
    expect(config).not.toHaveProperty("experimentalServices");
    expect(config).not.toHaveProperty("buildCommand");
    expect(config).not.toHaveProperty("framework");
    expect(readFileSync("api/.python-version", "utf8").trim()).toBe("3.12");
  });
  it("keeps example credentials empty and server-only", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toMatch(/^RECOMMENDER_SHARED_SECRET=\s*$/m);
    expect(example).not.toContain("NEXT_PUBLIC_RECOMMENDER");
  });
});
