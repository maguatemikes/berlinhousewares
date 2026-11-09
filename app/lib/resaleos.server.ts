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

/**
 * List consignor accounts from ResaleOS (/accounts). Used to refresh seller
 * store names directly, without a per-product scan.
 */
export async function getConsignors(
  env: ResaleosEnv,
): Promise<Array<{accountId: string; name: string}>> {
  const key = env.PRIVATE_RESALEOS_API_KEY;
  if (!key) return [];
  const res = await fetch(`${API_BASE}/accounts?limit=250`, {
    headers: {Authorization: `Bearer ${key}`},
  });
  if (!res.ok) return [];
  const json = (await res.json()) as
    | Array<Record<string, unknown>>
    | {accounts?: Array<Record<string, unknown>>};
  const rows = Array.isArray(json) ? json : (json.accounts ?? []);
  const out: Array<{accountId: string; name: string}> = [];
  for (const a of rows) {
    const accountId = (a.accountId as string) || '';
    const types = (a.accountTypes as string[]) || [];
    if (!accountId) continue;
    if (types.length && !types.includes('consignor')) continue;
    out.push({
      accountId,
      name:
        (a.name as string) ||
        (a.companyName as string) ||
        `Seller ${accountId}`,
    });
  }
  return out;
}

/**
 * Build a map of **Shopify product numeric id → consignor** for the WHOLE
 * ResaleOS catalogue, in one paginated pass. This is the join the scheduled
 * reconcile sweep uses: it reads each product's Shopify id from
 * `channels[shopify].externalId` (stripping any `-variantId` tail so a
 * variant-composite id still resolves to its product) and its `consignor`.
 *
 * Products with no consignor, or no Shopify channel, are simply absent from the
 * map — the sweep then leaves those Shopify products untouched (never links them
 * to a brand store).
 */
export async function getConsignorMapByShopifyProductId(
  env: ResaleosEnv,
): Promise<Map<string, Consignor>> {
  const map = new Map<string, Consignor>();
  const key = env.PRIVATE_RESALEOS_API_KEY;
  if (!key) return map;
  for (let page = 1; page <= 40; page++) {
    const res = await fetch(`${API_BASE}/products?limit=250&page=${page}`, {
      headers: {Authorization: `Bearer ${key}`},
    });
    if (!res.ok) break;
    const json = (await res.json()) as {
      products?: Array<{
        consignor?: {accountId?: string | null; name?: string | null} | null;
        channels?: Array<{platform?: string; externalId?: string | null}>;
      }>;
      pagination?: {totalPages?: number};
    };
    const products = json.products ?? [];
    for (const p of products) {
      const c = p.consignor;
      if (!c?.accountId) continue;
      const shop = (p.channels ?? []).find(
        (ch) => ch.platform === 'shopify' && ch.externalId,
      );
      if (!shop?.externalId) continue;
      // externalId is either "15478630613144" or "15478630613144-6775…"
      // (product-variant composite) — the product id is the part before "-".
      const productId = String(shop.externalId).split('-')[0];
      if (productId) {
        map.set(productId, {accountId: c.accountId, name: c.name ?? null});
      }
    }
    const totalPages = json.pagination?.totalPages ?? 1;
    if (page >= totalPages || products.length === 0) break;
  }
  return map;
}

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
