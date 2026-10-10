/** Server actions never throw expected errors: the UI and agents get them as values. */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export function succeeded<T>(value: T): Outcome<T> {
  return { ok: true, value };
}

export function failed<T>(error: string): Outcome<T> {
  return { ok: false, error };
}
