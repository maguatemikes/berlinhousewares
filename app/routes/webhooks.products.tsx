import type {Route} from './+types/webhooks.products';
import {sellerHandle} from '~/lib/sellers';
import {
  hasAdminToken,
  ensureSeller,
  setProductSeller,
  type AdminEnv,
} from '~/lib/shopify-admin.server';
import {getConsignorForSku} from '~/lib/resaleos.server';

/**
 * Shopify webhook receiver — the automatic trigger for the seller automation.
 *
 * Subscribe the `berlin-resale` app to `products/create` + `products/update`
 * pointing at:  https://<worker-domain>/webhooks/products
 *
 * Every product that lands in Shopify (ResaleOS sync, manual add, any channel)
 * fires this; we verify Shopify's HMAC signature, then run the SAME logic as
 * /admin/sync-sellers for just that product: ensure the seller entry exists,
 * link the product. Idempotent — Shopify's retries are safe.
 *
 * Native-first notes: verification uses the platform Web Crypto API (no deps);
 * the endpoint is a plain React Router action; all writing reuses
 * app/lib/shopify-admin.server.ts.
 */

// Webhooks are signed with the app's client secret (HMAC-SHA256 of the raw
// body, base64). Verify BEFORE parsing/acting — anyone can POST to this URL.
async function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const digest = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // Constant-time compare
  if (digest.length !== hmacHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) {
    diff |= digest.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  }
  return diff === 0;
}

export async function action({request, context}: Route.ActionArgs) {
  const env = context.env as AdminEnv;

  if (!hasAdminToken(env) || !env.PRIVATE_ADMIN_CLIENT_SECRET) {
    // Not configured — acknowledge so Shopify doesn't retry forever.
    return new Response('Webhook not configured', {status: 200});
  }

  const rawBody = await request.text();
  const valid = await verifyShopifyHmac(
    rawBody,
    request.headers.get('X-Shopify-Hmac-Sha256'),
    env.PRIVATE_ADMIN_CLIENT_SECRET,
  );
  if (!valid) {
    return new Response('Invalid signature', {status: 401});
  }

  const topic = request.headers.get('X-Shopify-Topic') ?? '';
  if (topic !== 'products/create' && topic !== 'products/update') {
    return new Response(`Ignored topic: ${topic}`, {status: 200});
  }

  const product = JSON.parse(rawBody) as {
    admin_graphql_api_id?: string;
    title?: string;
    vendor?: string;
    variants?: Array<{sku?: string | null}>;
  };

  const productGid = product.admin_graphql_api_id;
  if (!productGid) {
    return new Response('No product id — nothing to link', {status: 200});
  }

  // Prefer the TRUE seller identity: ResaleOS consignor.accountId (looked up
  // via SKU = resaleosId). Same consignor, any brand → one store. Fall back to
  // the vendor string only when ResaleOS doesn't know the product.
  const consignor = await getConsignorForSku(env, product.variants?.[0]?.sku);
  const vendor = (product.vendor ?? '').trim();

  let slug: string;
  let displayName: string;
  if (consignor) {
    slug = sellerHandle(consignor.accountId);
    displayName = consignor.name ?? `Seller ${consignor.accountId}`;
  } else if (vendor) {
    slug = sellerHandle(vendor);
    displayName = vendor;
  } else {
    return new Response('No consignor or vendor — nothing to link', {
      status: 200,
    });
  }
  if (!slug) return new Response('Unusable seller key', {status: 200});

  try {
    const {id: sellerId, created} = await ensureSeller(env, {
      slug,
      displayName,
    });
    await setProductSeller(env, productGid, sellerId);
    return new Response(
      `${created ? 'Created seller and linked' : 'Linked'} "${product.title}" → ${slug}`,
      {status: 200},
    );
  } catch (e) {
    // 500 → Shopify retries with backoff; safe because we're idempotent.
    console.error('[webhooks.products]', (e as Error).message);
    return new Response('Seller link failed', {status: 500});
  }
}

// Webhooks are POST-only; browsers hitting this URL get a 405.
export async function loader() {
  return new Response('Method not allowed', {status: 405});
}
