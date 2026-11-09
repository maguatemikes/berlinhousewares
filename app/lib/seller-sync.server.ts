/**
 * Scheduled seller reconcile (no Hydrogen route context needed).
 *
 * Self-healing by design: it makes every Shopify product's `custom.seller` match
 * its TRUE owner — the ResaleOS `consignor.accountId` — and WRITES ONLY WHEN THEY
 * DIFFER. The common case is "nothing changed" → a few cheap reads, zero writes.
 *
 * Join key: ResaleOS `channels[shopify].externalId` → Shopify product id (NOT the
 * SKU — WFE SKUs are vendor codes, not the resaleosId). This catches new
 * registrations, re-assignments, and products wrongly left on an old brand store,
 * all in one pass — things a SKU-join / "unlinked-only" sweep could never fix.
 *
 * Products ResaleOS has no consignor for are left untouched (never forced onto a
 * brand store). Run by the in-process timer in server/index.ts (every 5 min) and
 * on demand via /admin/run-seller-sync?key=…
 */
import {sellerHandle} from '~/lib/sellers';
import {getConsignorMapByShopifyProductId} from '~/lib/resaleos.server';
import {
  hasAdminToken,
  ensureSeller,
  setProductSeller,
  type AdminEnv,
} from '~/lib/shopify-admin.server';

export type SellerSyncSummary = {
  ok: boolean;
  reason?: string;
  /** Shopify products scanned. */
  checked: number;
  /** Products whose seller needed to change (and were updated). */
  linked: number;
  /** New seller metaobjects created this run. */
  createdSellers: number;
  /** Products already correct — skipped (no write). */
  unchanged: number;
  errors: string[];
};

type SyncEnv = AdminEnv & {
  PUBLIC_STORE_DOMAIN: string;
  PUBLIC_STOREFRONT_API_TOKEN: string;
};

// Plain-string query (NOT #graphql-tagged — this file bypasses codegen since it
// runs outside the Hydrogen storefront client). Paginated so the whole catalog
// is reconciled, not just the newest 250.
const RECONCILE_QUERY = `
  query SellerReconcile($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        metafield(namespace: "custom", key: "seller") {
          reference { ... on Metaobject { handle } }
        }
      }
    }
  }
`;

type ProductNode = {
  id: string;
  title: string;
  metafield?: {reference?: {handle?: string} | null} | null;
};

export async function runSellerSync(env: SyncEnv): Promise<SellerSyncSummary> {
  const summary: SellerSyncSummary = {
    ok: true,
    checked: 0,
    linked: 0,
    createdSellers: 0,
    unchanged: 0,
    errors: [],
  };

  if (!hasAdminToken(env)) {
    return {...summary, ok: false, reason: 'admin credentials not configured'};
  }

  // One paginated pass over ResaleOS → {shopifyProductId → consignor}.
  const consignorMap = await getConsignorMapByShopifyProductId(env);
  if (consignorMap.size === 0) {
    return {...summary, ok: false, reason: 'no consignor map (ResaleOS key?)'};
  }

  // Cache seller metaobject ids resolved this run so we call ensureSeller once
  // per consignor, not once per product.
  const sellerIds = new Map<string, string>();

  let cursor: string | null = null;
  do {
    const res = await fetch(
      `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
        },
        body: JSON.stringify({query: RECONCILE_QUERY, variables: {cursor}}),
      },
    );
    if (!res.ok) {
      return {...summary, ok: false, reason: `storefront query ${res.status}`};
    }
    const json = (await res.json()) as {
      data?: {
        products?: {
          pageInfo?: {hasNextPage?: boolean; endCursor?: string | null};
          nodes?: ProductNode[];
        };
      };
    };

    const nodes = json.data?.products?.nodes ?? [];
    for (const p of nodes) {
      summary.checked += 1;

      const productId = p.id.split('/').pop() ?? '';
      const target = consignorMap.get(productId);
      if (!target) continue; // ResaleOS has no consignor for it → leave as-is

      const targetSlug = sellerHandle(target.accountId);
      if (!targetSlug) continue;

      const currentHandle = p.metafield?.reference?.handle ?? null;
      if (currentHandle === targetSlug) {
        summary.unchanged += 1;
        continue; // already correct → no write
      }

      try {
        let sellerId = sellerIds.get(targetSlug);
        if (!sellerId) {
          const {id, created} = await ensureSeller(env, {
            slug: targetSlug,
            displayName: target.name ?? `Seller ${target.accountId}`,
          });
          sellerId = id;
          sellerIds.set(targetSlug, id);
          if (created) summary.createdSellers += 1;
        }
        await setProductSeller(env, p.id, sellerId);
        summary.linked += 1;
      } catch (e) {
        summary.errors.push(`${p.title}: ${(e as Error).message}`);
      }
    }

    const pageInfo = json.data?.products?.pageInfo;
    cursor = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;
  } while (cursor);

  if (summary.errors.length) summary.ok = false;
  return summary;
}
