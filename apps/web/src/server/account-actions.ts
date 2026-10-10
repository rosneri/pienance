import type { Auth } from "@pienance/auth";
import { failed, succeeded, type Outcome } from "./outcome";

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface SignUpDetails extends Credentials {
  readonly name: string;
}

/**
 * Signing up, in and out through Better Auth's server API. In the web app the
 * nextCookies plugin turns the resulting session into cookies.
 */
export function accountActions(auth: Auth, headers: () => Promise<Headers>) {
  async function attempt<T>(run: () => Promise<T>): Promise<Outcome<null>> {
    try {
      await run();

      return succeeded(null);
    } catch (error) {
      return failed(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return {
    signUp(details: SignUpDetails): Promise<Outcome<null>> {
      return attempt(async () => auth.api.signUpEmail({ body: details, headers: await headers() }));
    },

    signIn(credentials: Credentials): Promise<Outcome<null>> {
      return attempt(async () =>
        auth.api.signInEmail({ body: credentials, headers: await headers() }),
      );
    },

    signOut(): Promise<Outcome<null>> {
      return attempt(async () => auth.api.signOut({ headers: await headers() }));
    },
  };
}

export type AccountActions = ReturnType<typeof accountActions>;
