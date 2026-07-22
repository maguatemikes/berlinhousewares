/**
 * Shopify Admin API client (server-only) — the WRITE side of the seller
 * automation. The Storefront API can only read; creating metaobject entries and
 * setting product metafields require the Admin API.
 *
 * Needs a custom-app Admin token with scopes: write_metaobjects, write_products,
 * read_products — provided as the `PRIVATE_ADMIN_API_TOKEN` secret (never commit).
 *
 * Used by app/routes/admin.sync-sellers.tsx (Phase 2, docs/seller-storefront-plan.md).
 */

declare global {
  // Augment the Hydrogen Env with the Admin credentials (all optional so builds
  // pass without them — the sync route degrades to a "not configured" message).
  interface Env {
    PRIVATE_ADMIN_API_TOKEN?: string;
    PRIVATE_ADMIN_CLIENT_ID?: string;
    PRIVATE_ADMIN_CLIENT_SECRET?: string;
    /** Gate for /admin/sync-sellers — without a matching ?key= the route 404s. */
    PRIVATE_SYNC_SECRET?: string;
  }
}

const ADMIN_API_VERSION = '2025-01';

export type AdminEnv = {
  PUBLIC_STORE_DOMAIN: string;
  /** Classic custom-app token (`shpat_…`) — used directly if present. */
  PRIVATE_ADMIN_API_TOKEN?: string;
  /** New Dev-Dashboard app credentials — exchanged for a token at runtime. */
  PRIVATE_ADMIN_CLIENT_ID?: string;
  PRIVATE_ADMIN_CLIENT_SECRET?: string;
  /** ResaleOS API key — lets the automation resolve SKU → consignor.accountId. */
  PRIVATE_RESALEOS_API_KEY?: string;
  /** Gate for /admin/sync-sellers. */
  PRIVATE_SYNC_SECRET?: string;
};

export function hasAdminToken(env: AdminEnv): boolean {
  return Boolean(
    env.PRIVATE_ADMIN_API_TOKEN ||
      (env.PRIVATE_ADMIN_CLIENT_ID && env.PRIVATE_ADMIN_CLIENT_SECRET),
  );
}

// Client-credentials tokens are short-lived — cache per worker instance and
// refresh a minute before expiry.
let cachedToken: {token: string; expiresAt: number} | null = null;

async function getAdminToken(env: AdminEnv): Promise<string> {
  if (env.PRIVATE_ADMIN_API_TOKEN) return env.PRIVATE_ADMIN_API_TOKEN;

  const id = env.PRIVATE_ADMIN_CLIENT_ID;
  const secret = env.PRIVATE_ADMIN_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Admin API credentials are not set');

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: id,
        client_secret: secret,
        grant_type: 'client_credentials',
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Admin token exchange failed (${res.status}): ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {access_token: string; expires_in?: number};
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function adminGraphQL<T = Record<string, unknown>>(
  env: AdminEnv,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminToken(env);

  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    },
  );

  const json = (await res.json()) as {data?: T; errors?: unknown};
  if (json.errors) {
    throw new Error(`Admin API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

/**
 * Get a seller metaobject by its stable handle, or create it if missing.
 * On an existing seller we DO NOT touch display_name — so re-running the sync
 * never clobbers a name the seller (or you) has edited. New sellers are seeded
 * with the placeholder name and set ACTIVE so the Storefront can read them.
 */
export async function ensureSeller(
  env: AdminEnv,
  {slug, displayName}: {slug: string; displayName: string},
): Promise<{id: string; created: boolean}> {
  const existing = await adminGraphQL<{
    metaobjectByHandle: {id: string} | null;
  }>(env, METAOBJECT_BY_HANDLE, {
    handle: {type: 'seller', handle: slug},
  });

  if (existing.metaobjectByHandle?.id) {
    return {id: existing.metaobjectByHandle.id, created: false};
  }

  const created = await adminGraphQL<{
    metaobjectCreate: {
      metaobject: {id: string} | null;
      userErrors: Array<{field: string[]; message: string}>;
    };
  }>(env, METAOBJECT_CREATE, {
    metaobject: {
      type: 'seller',
      handle: slug,
      capabilities: {publishable: {status: 'ACTIVE'}},
      fields: [
        {key: 'slug', value: slug},
        {key: 'display_name', value: displayName},
      ],
    },
  });

  const errs = created.metaobjectCreate.userErrors;
  if (errs?.length) throw new Error(JSON.stringify(errs));
  const id = created.metaobjectCreate.metaobject?.id;
  if (!id) throw new Error('metaobjectCreate returned no id');
  return {id, created: true};
}

/** Set a product's custom.seller metafield → a seller metaobject. */
export async function setProductSeller(
  env: AdminEnv,
  productId: string,
  metaobjectId: string,
): Promise<void> {
  const data = await adminGraphQL<{
    metafieldsSet: {
      userErrors: Array<{field: string[]; message: string}>;
    };
  }>(env, METAFIELDS_SET, {
    metafields: [
      {
        ownerId: productId,
        namespace: 'custom',
        key: 'seller',
        type: 'metaobject_reference',
        value: metaobjectId,
      },
    ],
  });

  const errs = data.metafieldsSet.userErrors;
  if (errs?.length) throw new Error(JSON.stringify(errs));
}

// NOTE: these are Admin API operations — intentionally NOT tagged `#graphql`
// so Hydrogen's Storefront codegen skips them (they'd fail Storefront-schema
// validation). Responses are typed via the adminGraphQL<T> generic instead.
const METAOBJECT_BY_HANDLE = `
  query SellerByHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) { id }
  }
`;

const METAOBJECT_CREATE = `
  mutation CreateSeller($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const METAFIELDS_SET = `
  mutation SetProductSeller($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;
