import { startTestDatabase, type TestDatabase } from "@pienance/db/testing";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createLocalJWKSet, decodeJwt, jwtVerify, type JSONWebKeySet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, ownerOf, viewerOf, type Auth } from "./auth";

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

async function signUp(email: string, password = "correct horse battery", extra = {}) {
  return request("/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name: email.split("@")[0], ...extra }),
  });
}

async function signIn(email: string, password = "correct horse battery") {
  return request("/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
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

  describe("roles", () => {
    it("makes every new user a member", async () => {
      const viewer = await viewerOf(auth, cookiesOf(await signUp("mary@example.com")));

      const stored = await database.prisma.user.findUnique({
        where: { email: "mary@example.com" },
      });

      expect(viewer?.role).toBe("member");
      expect(stored?.role).toBe("member");
    });

    it("never lets sign-up choose a role", async () => {
      const response = await signUp("mallory@example.com", "correct horse battery", {
        role: "admin",
      });

      const stored = await database.prisma.user.findUnique({
        where: { email: "mallory@example.com" },
      });

      expect(stored?.role ?? "member").toBe("member");
      expect(response.ok ? (await viewerOf(auth, cookiesOf(response)))?.role : "member").toBe(
        "member",
      );
    });

    it("never lets a user promote themselves", async () => {
      const session = cookiesOf(await signUp("eve@example.com"));

      await request("/update-user", {
        method: "POST",
        headers: new Headers([...session, ["content-type", "application/json"]]),
        body: JSON.stringify({ role: "admin" }),
      });

      const stored = await database.prisma.user.findUnique({ where: { email: "eve@example.com" } });

      expect(stored?.role).toBe("member");
    });

    it("reads a role granted in the database at the next sign-in", async () => {
      await signUp("barbara@example.com");
      await database.prisma.user.update({
        where: { email: "barbara@example.com" },
        data: { role: "admin" },
      });

      const viewer = await viewerOf(auth, cookiesOf(await signIn("barbara@example.com")));

      expect(viewer?.role).toBe("admin");
    });

    it("knows no viewer without a session", async () => {
      expect(await viewerOf(auth, new Headers())).toBeNull();
    });
  });
});
