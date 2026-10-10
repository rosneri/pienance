import { describe, expect, it } from "vitest";
import { authSecretFrom, baseUrlFrom, trustedOriginsFrom } from "@/environment";

describe("authSecretFrom", () => {
  it("uses BETTER_AUTH_SECRET when set", () => {
    expect(authSecretFrom({ BETTER_AUTH_SECRET: "set" }, "postgres://db")).toBe("set");
  });

  it("derives a stable secret from the database URL", () => {
    const secret = authSecretFrom({ NODE_ENV: "production" }, "postgres://db");

    expect(secret).toBe(authSecretFrom({}, "postgres://db"));
    expect(secret).not.toContain("postgres");
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(authSecretFrom({}, "postgres://other")).not.toBe(secret);
  });

  it("refuses to run production without any secret", () => {
    expect(() => authSecretFrom({ NODE_ENV: "production" }, undefined)).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("has a development fallback", () => {
    expect(authSecretFrom({ NODE_ENV: "development" }, undefined)).toMatch(/development/);
  });
});

describe("baseUrlFrom", () => {
  it.each([
    [
      { BETTER_AUTH_URL: "https://pienance.app", VERCEL_URL: "x.vercel.app" },
      "https://pienance.app",
    ],
    [
      {
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "pienance.vercel.app",
        VERCEL_URL: "x.vercel.app",
      },
      "https://pienance.vercel.app",
    ],
    [
      { VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "branch.vercel.app", VERCEL_URL: "x.vercel.app" },
      "https://branch.vercel.app",
    ],
    [{}, "http://localhost:3000"],
  ])("picks the public URL from %j", (env, url) => {
    expect(baseUrlFrom(env)).toBe(url);
  });
});

describe("trustedOriginsFrom", () => {
  it("trusts every URL of the deployment", () => {
    expect(
      trustedOriginsFrom({
        VERCEL_URL: "a.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "p.vercel.app",
      }),
    ).toEqual(["https://a.vercel.app", "https://p.vercel.app"]);
  });
});
