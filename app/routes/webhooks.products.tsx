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

// Webhooks are signed with HMAC-SHA256 of the raw body (base64). WHICH secret
// depends on how the subscription was created:
//   • App-config subscriptions → the app's client secret
//   • Admin "Settings → Notifications → Webhooks" → the STORE signing secret
// We accept either. Verify BEFORE parsing/acting — anyone can POST to this URL.
async function hmacBase64(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secrets: Array<string | undefined>,
): Promise<boolean> {
  if (!hmacHeader) return false;
  for (const secret of secrets) {
    if (!secret) continue;
    const digest = await hmacBase64(rawBody, secret);
    if (timingSafeEqual(digest, hmacHeader)) return true;
  }
  return false;
}

export async function action({request, context}: Route.ActionArgs) {
  const env = context.env as AdminEnv;

  const signingSecrets = [
    env.PRIVATE_ADMIN_CLIENT_SECRET,
    env.PRIVATE_WEBHOOK_SECRET,
  ];
  if (!hasAdminToken(env) || !signingSecrets.some(Boolean)) {
    // Not configured — acknowledge so Shopify doesn't retry forever.
    return new Response('Webhook not configured', {status: 200});
  }

  const rawBody = await request.text();
  const valid = await verifyShopifyHmac(
    rawBody,
    request.headers.get('X-Shopify-Hmac-Sha256'),
    signingSecrets,
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
    id?: number | string;
    title?: string;
    vendor?: string;
    variants?: Array<{sku?: string | null}>;
  };

  // Payload shape varies by webhook API version — fall back to the numeric id
  // (present in every variant) and build the gid from it.
  const productGid =
    product.admin_graphql_api_id ??
    (product.id ? `gid://shopify/Product/${product.id}` : null);
  if (!productGid) {
    console.log(`[webhooks.products] ${topic} "${product.title}": no product id`);
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
    console.log(
      `[webhooks.products] ${topic} "${product.title}": no consignor or vendor`,
    );
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
    console.log(
      `[webhooks.products] ${topic} "${product.title}": ${created ? 'created seller + ' : ''}linked → ${slug}`,
    );
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
