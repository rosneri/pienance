/** Who is sending: a session (30 minutes of inactivity ends it) and a long-lived anonymous id. */
export interface Identity {
  readonly sessionId: string;
  readonly anonymousId: string;
}

/** The part of Web Storage this needs, so tests can hand in a Map-backed one. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

const sessionKey = "pienance.session";

const anonymousKey = "pienance.anonymous";

const sessionIdleMs = 30 * 60 * 1000;

function read(store: KeyValueStore | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: KeyValueStore | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the ids just last as long as the page.
  }
}

export class IdentityKeeper {
  readonly #session: KeyValueStore | null;
  readonly #local: KeyValueStore | null;
  readonly #newId: () => string;
  #current: { sessionId: string; anonymousId: string; seenAt: number } | null = null;

  constructor(session: KeyValueStore | null, local: KeyValueStore | null, newId: () => string) {
    this.#session = session;
    this.#local = local;
    this.#newId = newId;
  }

  /** The identity at `now`, starting a new session after a long pause. */
  at(now: number): Identity {
    this.#current ??= this.#restore();

    const fresh = this.#current && now - this.#current.seenAt < sessionIdleMs;
    const anonymousId = this.#current?.anonymousId ?? this.#newId();
    const sessionId = fresh && this.#current ? this.#current.sessionId : this.#newId();

    this.#current = { sessionId, anonymousId, seenAt: now };
    write(this.#session, sessionKey, `${sessionId} ${now}`);
    write(this.#local, anonymousKey, anonymousId);

    return { sessionId, anonymousId };
  }

  #restore(): { sessionId: string; anonymousId: string; seenAt: number } | null {
    const anonymousId = read(this.#local, anonymousKey);
    const [sessionId, seenAt] = (read(this.#session, sessionKey) ?? "").split(" ");

    if (!anonymousId || !sessionId || !seenAt) return null;

    return { sessionId, anonymousId, seenAt: Number(seenAt) };
  }
}
