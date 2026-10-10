import { betterAuth, type BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";

export interface AuthSettings {
  /** A Better Auth database adapter, e.g. `prismaAdapter(prisma, { provider: "postgresql" })`. */
  readonly database: NonNullable<BetterAuthOptions["database"]>;
  /** Signs session cookies and JWTs. At least 32 random characters. */
  readonly secret: string;
  /** Where the app is served, e.g. "https://pienance.app". */
  readonly baseURL: string;
  /** Other origins allowed to call the auth endpoints, e.g. a deployment's other URLs. */
  readonly trustedOrigins?: readonly string[];
  /** Framework glue, e.g. Next.js's `nextCookies()`; it must come last. */
  readonly plugins?: NonNullable<BetterAuthOptions["plugins"]>;
}

/**
 * Pienance's identity: email and password accounts, sessions cached in a signed
 * JWT cookie, and the JWT plugin, which issues JWTs (GET /api/auth/token) and
 * publishes their keys (GET /api/auth/jwks) for API and native clients.
 */
export function createAuth(settings: AuthSettings) {
  return betterAuth({
    appName: "pienance",
    database: settings.database,
    secret: settings.secret,
    baseURL: settings.baseURL,
    trustedOrigins: [...(settings.trustedOrigins ?? [])],
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "jwt" },
    },
    plugins: [jwt(), ...(settings.plugins ?? [])],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** The signed-in user's id for a request, or null when nobody is signed in. */
export async function ownerOf(auth: Auth, headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });

  return session?.user.id ?? null;
}
