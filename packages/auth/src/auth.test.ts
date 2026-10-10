import { startTestDatabase, type TestDatabase } from "@pienance/db/testing";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createLocalJWKSet, decodeJwt, jwtVerify, type JSONWebKeySet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, ownerOf, type Auth } from "./auth";

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

/** The cookies a response sets, ready to send back as a Cookie header. */
function cookiesOf(response: Response): Headers {
  const cookie = response.headers
    .getSetCookie()
    .map((set) => set.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return auth.handler(new Request(`${baseURL}/api/auth${path}`, init));
}

async function signUp(email: string, password = "correct horse battery") {
  return request("/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name: email.split("@")[0] }),
  });
}

describe("auth (Better Auth on Postgres)", () => {
  it("knows nobody without a session", async () => {
    expect(await ownerOf(auth, new Headers())).toBeNull();
  });

  it("signs up, stores the user and signs them in", async () => {
    const response = await signUp("ada@example.com");

    expect(response.status).toBe(200);

    const owner = await ownerOf(auth, cookiesOf(response));
    const stored = await database.prisma.user.findUnique({ where: { email: "ada@example.com" } });

    expect(owner).toBe(stored?.id);
  });

  it("caches the session in a signed JWT cookie", async () => {
    const response = await signUp("grace@example.com");

    const cached = response.headers
      .getSetCookie()
      .find((set) => set.startsWith("better-auth.session_data="));

    const token = cached?.split(";")[0]?.split("=")[1] ?? "";

    expect(token.split(".")).toHaveLength(3);
  });

  it("refuses a wrong password and accepts the right one", async () => {
    await signUp("alan@example.com");

    const wrong = await request("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alan@example.com", password: "not the password" }),
    });

    const right = await request("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alan@example.com", password: "correct horse battery" }),
    });

    expect(wrong.status).toBe(401);
    expect(right.status).toBe(200);
    expect(await ownerOf(auth, cookiesOf(right))).not.toBeNull();
  });

  it("refuses a password shorter than eight characters", async () => {
    const response = await signUp("short@example.com", "short");

    expect(response.status).toBe(400);
  });

  it("issues a JWT for the user, verifiable with the published JWKS", async () => {
    const session = cookiesOf(await signUp("katherine@example.com"));
    const owner = await ownerOf(auth, session);
    const { token } = await (await request("/token", { headers: session })).json();
    const keys: JSONWebKeySet = await (await request("/jwks")).json();
    const { payload } = await jwtVerify(token, createLocalJWKSet(keys), { issuer: baseURL });

    expect(payload.sub).toBe(owner);
    expect(decodeJwt(token).exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("signs out", async () => {
    const session = cookiesOf(await signUp("margaret@example.com"));

    await request("/sign-out", { method: "POST", headers: session });

    const fresh = new Headers(session);

    // The cached JWT cookie would still read as signed in until it expires; the session is gone.
    fresh.set(
      "cookie",
      (session.get("cookie") ?? "")
        .split("; ")
        .filter((cookie) => !cookie.startsWith("better-auth.session_data="))
        .join("; "),
    );

    expect(await ownerOf(auth, fresh)).toBeNull();
  });
});
