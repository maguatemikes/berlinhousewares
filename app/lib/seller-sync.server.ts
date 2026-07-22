/**
 * Cron-callable seller sweep (no Hydrogen route context needed).
 *
 * Light mode by design: finds products with NO custom.seller link and links
 * just those — the common case is "nothing to do" (one cheap Storefront query,
 * ~100ms, zero writes). Grouping key: ResaleOS consignor.accountId via SKU,
 * vendor as fallback — same rules as /admin/sync-sellers and the (retired)
 * webhook receiver.
 *
 * Invoked by the `scheduled` handler in server.ts (see wrangler.toml
 * [triggers] crons) and testable on demand via /admin/sync-sellers?...&cron=1.
 */
import {sellerHandle} from '~/lib/sellers';
import {getConsignorForSku} from '~/lib/resaleos.server';
import {
  hasAdminToken,
  ensureSeller,
  setProductSeller,
  type AdminEnv,
} from '~/lib/shopify-admin.server';

export type SellerSyncSummary = {
  ok: boolean;
  reason?: string;
  checked: number;
  unlinked: number;
  linked: number;
  createdSellers: number;
  errors: string[];
};

type SyncEnv = AdminEnv & {
  PUBLIC_STORE_DOMAIN: string;
  PUBLIC_STOREFRONT_API_TOKEN: string;
};

// Plain-string query (NOT #graphql-tagged — this file bypasses codegen since
// it runs outside the Hydrogen storefront client).
const UNLINKED_SCAN_QUERY = `
  query CronSellerScan {
    # Newest first: unlinked products are always recent, so they stay inside
    # the scan window no matter how large the catalog grows.
    products(first: 250, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        title
        vendor
        variants(first: 1) { nodes { sku } }
        metafield(namespace: "custom", key: "seller") { value }
      }
    }
  }
`;

export async function runSellerSync(env: SyncEnv): Promise<SellerSyncSummary> {
  const summary: SellerSyncSummary = {
    ok: true,
    checked: 0,
    unlinked: 0,
    linked: 0,
    createdSellers: 0,
    errors: [],
  };

  if (!hasAdminToken(env)) {
    return {...summary, ok: false, reason: 'admin credentials not configured'};
  }

  // Read the catalog via the public Storefront API.
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query: UNLINKED_SCAN_QUERY}),
    },
  );
  if (!res.ok) {
    return {...summary, ok: false, reason: `storefront query ${res.status}`};
  }
  const json = (await res.json()) as {
    data?: {
      products?: {
        nodes?: Array<{
          id: string;
          title: string;
          vendor: string | null;
          variants?: {nodes?: Array<{sku: string | null}>};
          metafield?: {value: string} | null;
        }>;
      };
    };
  };

  const nodes = json.data?.products?.nodes ?? [];
  summary.checked = nodes.length;

  const pending = nodes.filter((n) => !n.metafield?.value);
  summary.unlinked = pending.length;
  if (pending.length === 0) return summary; // the usual case — nothing to do

  for (const p of pending) {
    try {
      const consignor = await getConsignorForSku(
        env,
        p.variants?.nodes?.[0]?.sku,
      );
      const vendor = (p.vendor ?? '').trim();

      let slug: string;
      let displayName: string;
      if (consignor) {
        slug = sellerHandle(consignor.accountId);
        displayName = consignor.name ?? `Seller ${consignor.accountId}`;
      } else if (vendor) {
        slug = sellerHandle(vendor);
        displayName = vendor;
      } else {
        continue; // no consignor and no vendor → stays unassigned
      }
      if (!slug) continue;

      const {id: sellerId, created} = await ensureSeller(env, {
        slug,
        displayName,
      });
      if (created) summary.createdSellers += 1;
      await setProductSeller(env, p.id, sellerId);
      summary.linked += 1;
    } catch (e) {
      summary.errors.push(`${p.title}: ${(e as Error).message}`);
    }
  }

  if (summary.errors.length) summary.ok = false;
  return summary;
}
