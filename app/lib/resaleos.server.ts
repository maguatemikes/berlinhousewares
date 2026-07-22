/**
 * ResaleOS API client (server-only) — resolves a Shopify product to its true
 * consignor. Join key: Shopify variant SKU (base, before any `-N` variant
 * suffix) = ResaleOS `resaleosId`.
 *
 * Used by the seller automation to key stores on `consignor.accountId` instead
 * of the brand string — one consignor, many brands, still ONE store.
 * (docs/seller-storefront-plan.md §2)
 */

declare global {
  interface Env {
    PRIVATE_RESALEOS_API_KEY?: string;
  }
}

const API_BASE = 'https://www.resaleos.co/api/v1';

export type Consignor = {accountId: string; name: string | null};

type ResaleosEnv = {PRIVATE_RESALEOS_API_KEY?: string};

// In-memory per-worker cache — one ResaleOS lookup per resaleosId per instance.
const cache = new Map<string, Consignor | null>();

export function hasResaleosKey(env: ResaleosEnv): boolean {
  return Boolean(env.PRIVATE_RESALEOS_API_KEY);
}

/**
 * Look up the consignor for a Shopify SKU. Returns null when the key isn't
 * configured, the product isn't known to ResaleOS, or it has no consignor —
 * callers fall back to vendor-keyed grouping in that case.
 */
export async function getConsignorForSku(
  env: ResaleosEnv,
  sku: string | null | undefined,
): Promise<Consignor | null> {
  const key = env.PRIVATE_RESALEOS_API_KEY;
  if (!key || !sku) return null;

  // "191805-2" → resaleosId "191805"
  const resaleosId = sku.trim().split('-')[0];
  if (!resaleosId) return null;

  if (cache.has(resaleosId)) return cache.get(resaleosId) ?? null;

  try {
    const res = await fetch(`${API_BASE}/products/${resaleosId}`, {
      headers: {Authorization: `Bearer ${key}`},
    });
    if (!res.ok) {
      cache.set(resaleosId, null);
      return null;
    }
    const json = (await res.json()) as {
      product?: {consignor?: {accountId?: string | null; name?: string | null}};
    };
    const c = json.product?.consignor;
    const consignor: Consignor | null = c?.accountId
      ? {accountId: c.accountId, name: c.name ?? null}
      : null;
    cache.set(resaleosId, consignor);
    return consignor;
  } catch {
    // Network hiccup — don't cache, let a later call retry.
    return null;
  }
}
