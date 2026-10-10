import { describe, expect, it } from "vitest";
import { databaseUrlFrom } from "./database-url";

describe("databaseUrlFrom", () => {
  it("prefers DATABASE_URL", () => {
    expect(databaseUrlFrom({ DATABASE_URL: "postgres://a", POSTGRES_URL: "postgres://b" })).toBe(
      "postgres://a",
    );
  });

  it("falls back to the other names Vercel integrations use", () => {
    expect(databaseUrlFrom({ POSTGRES_URL: "postgresql://b" })).toBe("postgresql://b");
  });

  it("skips connection strings a Postgres driver cannot use", () => {
    expect(
      databaseUrlFrom({
        DATABASE_URL: "prisma+postgres://accelerate",
        POSTGRES_URL: "postgres://c",
      }),
    ).toBe("postgres://c");
  });

  it("finds nothing in an empty environment", () => {
    expect(databaseUrlFrom({})).toBeUndefined();
  });
});
