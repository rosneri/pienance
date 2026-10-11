import { createAuth, ownerOf, type Auth } from "@pienance/auth";
import { InMemoryPieRepository, noAdvice, pienance } from "@pienance/core";
import { startTestDatabase, type TestDatabase } from "@pienance/db/testing";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountActions } from "./account-actions";
import { pieActions } from "./pie-actions";

const baseURL = "http://localhost:3000";

let database: TestDatabase;

let auth: Auth;

beforeAll(async () => {
  database = await startTestDatabase();
  auth = createAuth({
    database: prismaAdapter(database.prisma, { provider: "postgresql" }),
    secret: "test-secret-that-is-at-least-32-characters-long",
    baseURL,
  });
});

afterAll(async () => {
  await database.stop();
});

const accounts = () => accountActions(auth, async () => new Headers());

/** Signs up through the HTTP API and returns the session cookies, as a browser would hold them. */
async function browserSignUp(email: string): Promise<Headers> {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery", name: email }),
    }),
  );

  const cookie = response.headers
    .getSetCookie()
    .map((set) => set.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

describe("account actions", () => {
  it("signs up, then signs in", async () => {
    const details = { name: "Ada", email: "ada@example.com", password: "correct horse battery" };

    expect(await accounts().signUp(details)).toEqual({ ok: true, value: null });
    expect(await accounts().signIn(details)).toEqual({ ok: true, value: null });
  });

  it("explains a refused sign-in", async () => {
    const outcome = await accounts().signIn({ email: "nobody@example.com", password: "whatever1" });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? "" : outcome.error).toMatch(/invalid email or password/i);
  });

  it("refuses an email that is already taken", async () => {
    const details = {
      name: "Grace",
      email: "grace@example.com",
      password: "correct horse battery",
    };

    await accounts().signUp(details);

    expect((await accounts().signUp(details)).ok).toBe(false);
  });

  it("signs out harmlessly even without a session", async () => {
    expect(await accounts().signOut()).toEqual({ ok: true, value: null });
  });
});

describe("signed-in pies (auth + pie actions + Postgres users)", () => {
  it("gives each signed-in person their own pie", async () => {
    const app = pienance({
      pies: new InMemoryPieRepository(),
      advisor: noAdvice,
      newId: () => crypto.randomUUID(),
      now: () => new Date(),
    });

    const as = (session: Headers) =>
      pieActions({
        app,
        owner: () => ownerOf(auth, session),
        refresh: () => undefined,
        track: () => undefined,
      });

    const alan = await browserSignUp("alan@example.com");
    const joan = await browserSignUp("joan@example.com");

    await as(alan).bakePie({ monthlyIncome: "2000", currency: "GBP" });

    expect((await as(alan).readPie())?.currency).toBe("GBP");
    expect(await as(joan).readPie()).toBeNull();
    expect(await as(new Headers()).readPie()).toBeNull();
  });
});
