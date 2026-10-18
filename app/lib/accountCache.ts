/**
 * Client-side, in-memory cache for the slow, uncacheable Customer Account API.
 *
 * The Customer Account API responses are sent `no-store` (they hold personal
 * data), so every entry into `/account` otherwise pays a fresh round-trip. This
 * module lets a route's `clientLoader` paint instantly from a short-lived
 * per-tab memory cache instead.
 *
 * Why caching personal data here is safe:
 *  - **Memory only** — a plain `Map`, never localStorage/sessionStorage/disk.
 *    It evaporates on tab close or reload, inheriting the loader's `no-store`
 *    privacy posture. Nothing is ever persisted.
 *  - **Client only** — this module must only be imported from a `clientLoader`
 *    / `clientAction`, never a server loader. A server-side singleton `Map`
 *    would be shared across requests and could leak one customer's data to
 *    another; a per-tab browser `Map` cannot.
 *  - **Cleared on logout** (see app/routes/account_.logout.tsx) and after any
 *    profile/address mutation, so a different customer on a shared device — or
 *    the same customer right after an edit — never sees stale data.
 *  - **Short 60s TTL** bounds how stale any value can ever be.
 */

type Entry = {value: unknown; expires: number};

const TTL_MS = 60_000;
const store = new Map<string, Entry>();

/** Returns the cached value for `key`, or `undefined` if absent/expired. */
export function getCached<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

/** Stores `value` under `key` with the module TTL, and returns it unchanged. */
export function setCached<T>(key: string, value: T): T {
  store.set(key, {value, expires: Date.now() + TTL_MS});
  return value;
}

/** Drops everything — call on logout and after any account mutation. */
export function clearAccountCache(): void {
  store.clear();
}
