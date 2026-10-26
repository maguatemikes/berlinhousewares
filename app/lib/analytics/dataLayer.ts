/**
 * GA4 standard-ecommerce dataLayer helpers.
 *
 * The storefront pushes ONE GA4-shaped event per action; a single GTM container
 * (`PUBLIC_GTM_ID`) fans each push out to both the GA4 tag and the Meta Pixel
 * tag, so there are no Meta-specific pushes here — Meta's `content_ids` /
 * `contents` are mapped from `ecommerce.items` inside GTM.
 *
 * `purchase` is intentionally ABSENT: checkout is Shopify-hosted, so the
 * purchase event must come from a Shopify Web Pixel in checkout, never the
 * storefront (mixing the two would double-count).
 *
 * Every item carries `item_id` anchored on the numeric variant id — the one id
 * present in every event path (PDP, cart, checkout) — so GA4 and Meta can match
 * the same product across events. `item_sku` / `item_product_id` ride along so a
 * GTM variable can remap `content_ids` to whichever field the Meta catalog feed
 * is keyed on.
 */

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/** Custom analytics event key for checkout intent (PDP "Buy it now" + the
 *  cart's "Proceed to Checkout"). Publish AND subscribe by this exact string —
 *  Hydrogen's `AnalyticsEvent.CUSTOM_EVENT` is only the `custom_` prefix, not a
 *  catch-all, so dispatch is by exact key match. */
export const BEGIN_CHECKOUT_EVENT = 'custom_begin_checkout' as const;

export type DLItem = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_variant?: string;
  item_category?: string;
  item_sku?: string;
  item_product_id?: string;
  price?: number;
  quantity?: number;
  index?: number;
  item_list_id?: string;
  item_list_name?: string;
};

export type DLEcommerce = {
  currency?: string;
  value?: number;
  items: DLItem[];
};

/** Numeric id from a Shopify gid: `gid://shopify/ProductVariant/4324` → `4324`.
 *  Falls back to the raw value when it isn't a gid. */
export function numericId(gid?: string | null): string {
  if (!gid) return '';
  const m = /\/(\d+)(?:\?|$)/.exec(gid);
  return m ? m[1] : gid;
}

function num(amount?: string | number | null): number | undefined {
  if (amount == null) return undefined;
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  return Number.isFinite(n) ? n : undefined;
}

/** GA4 "clear then push": null the previous `ecommerce` object so fields from
 *  the last event never bleed into this one, then push the event. */
export function pushEcommerce(event: string, ecommerce: DLEcommerce) {
  if (typeof window === 'undefined') return;
  const dl = (window.dataLayer = window.dataLayer || []);
  dl.push({ecommerce: null});
  dl.push({event, ecommerce});
}

/** Push a non-ecommerce event (e.g. `page_view`, `search`). */
export function pushEvent(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  (window.dataLayer = window.dataLayer || []).push({event, ...data});
}

/** The signed-in customer's identity, as read from the Customer Account API. */
export type AnalyticsCustomer = {
  firstName?: string | null;
  lastName?: string | null;
  emailAddress?: {emailAddress?: string | null} | null;
  phoneNumber?: {phoneNumber?: string | null} | null;
} | null;

/**
 * Push a `user_data` object for Meta/GA advanced matching + CAPI. This is NOT an
 * event — it's persistent context a GTM Data Layer Variable reads at tag-fire
 * time (`user_data.email`, `user_data.phone`, …). Only call it for a signed-in
 * customer who has consented; the GTM-side Meta template hashes the values, so we
 * push lightly-normalized plaintext (lowercased/trimmed email). No PII lands in a
 * URL — it stays in the in-page dataLayer.
 */
export function pushUserData(customer: AnalyticsCustomer) {
  if (typeof window === 'undefined' || !customer) return;
  const email = customer.emailAddress?.emailAddress;
  const phone = customer.phoneNumber?.phoneNumber;
  const user_data = {
    email: email ? String(email).trim().toLowerCase() : undefined,
    phone: phone || undefined,
    first_name: customer.firstName || undefined,
    last_name: customer.lastName || undefined,
  };
  // Nothing to match on → don't push an empty object.
  if (!user_data.email && !user_data.phone && !user_data.first_name) return;
  (window.dataLayer = window.dataLayer || []).push({user_data});
}

// --- item builders -------------------------------------------------------

/** The shape of a Hydrogen `ProductViewPayload` product (also what the PDP Buy-
 *  it-now handler constructs). Structural, to avoid importing Hydrogen internals. */
export type AnalyticsProduct = {
  id: string; // product gid
  title: string;
  price: string | number;
  currencyCode?: string | null; // from the variant's price; drives the event currency
  vendor?: string;
  variantId: string; // variant gid
  variantTitle?: string;
  quantity?: number;
  sku?: string | null;
  productType?: string;
};

export function itemFromProduct(p: AnalyticsProduct, index?: number): DLItem {
  return {
    item_id: numericId(p.variantId),
    item_name: p.title,
    item_brand: p.vendor || undefined,
    item_variant: p.variantTitle || undefined,
    item_category: p.productType || undefined,
    item_sku: p.sku || undefined,
    item_product_id: numericId(p.id) || undefined,
    price: num(p.price),
    quantity: p.quantity ?? 1,
    index,
  };
}

/** Structural cart-line shape (a subset of Hydrogen's `CartLine`). */
export type AnalyticsCartLine = {
  quantity?: number;
  cost?: {
    amountPerQuantity?: {amount?: string} | null;
    totalAmount?: {amount?: string} | null;
  } | null;
  merchandise?: {
    id?: string;
    title?: string;
    sku?: string | null;
    price?: {amount?: string; currencyCode?: string} | null;
    product?: {id?: string; title?: string; vendor?: string} | null;
  } | null;
};

export function itemFromCartLine(line: AnalyticsCartLine, index?: number): DLItem {
  const v = line.merchandise;
  return {
    item_id: numericId(v?.id),
    item_name: v?.product?.title,
    item_brand: v?.product?.vendor || undefined,
    item_variant: v?.title || undefined,
    item_sku: v?.sku || undefined,
    item_product_id: numericId(v?.product?.id) || undefined,
    price: num(line.cost?.amountPerQuantity?.amount) ?? num(v?.price?.amount),
    quantity: line.quantity ?? 1,
    index,
  };
}

/** Structural cart shape (subset of Hydrogen's `CartReturn`). */
export type AnalyticsCart = {
  cost?: {subtotalAmount?: {amount?: string; currencyCode?: string} | null} | null;
  lines?: {nodes?: AnalyticsCartLine[]} | null;
} | null;

/** Build `{currency, value, items}` from a full cart (view_cart / begin_checkout). */
export function ecommerceFromCart(cart: AnalyticsCart): DLEcommerce {
  const lines = cart?.lines?.nodes ?? [];
  const items = lines.map((l, i) => itemFromCartLine(l, i));
  return {
    currency:
      cart?.cost?.subtotalAmount?.currencyCode ||
      lines[0]?.merchandise?.price?.currencyCode ||
      undefined,
    value:
      num(cart?.cost?.subtotalAmount?.amount) ??
      items.reduce((sum, it) => sum + (it.price ?? 0) * (it.quantity ?? 1), 0),
    items,
  };
}
