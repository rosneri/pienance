import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/pienance";

/** Better Auth's endpoints: sign-up, sign-in, session, /token (JWT) and /jwks. */
export function GET(request: Request): Promise<Response> {
  return toNextJsHandler(auth()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return toNextJsHandler(auth()).POST(request);
}
