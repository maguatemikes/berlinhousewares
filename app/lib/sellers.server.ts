/**
 * Seller-storefront data layer — Phase 2 model (docs/seller-storefront-plan.md).
 *
 * Sellers are now grouped by the **`custom.seller` product metafield**, which
 * references a Shopify **`seller` metaobject**. This is the rename-proof design:
 *   • store URL  = the metaobject's `slug` field   (stable — set once, never edited)
 *   • store name = the metaobject's `display_name`  (editable — rename anytime)
 *   • grouping   = the metaobject reference          (never the vendor string)
 *
 * A seller can rename their store (edit display_name) or a product's brand can be
 * misspelled — neither moves products, because grouping keys on the metaobject,
 * not on any text field.
 *
 * Everything the seller routes need goes through THIS file; the routes and the
 * returned shapes stay stable. In production the `custom.seller` metafield is set
 * automatically by the ResaleOS webhook (keyed on consignor.accountId); here it's
 * assigned by hand in Shopify admin for testing.
 */
import type {Storefront} from '@shopify/hydrogen';
import {sellerHandle} from '~/lib/sellers';

export {sellerHandle};

export type SellerProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  featuredImage: {
    id: string | null;
    altText: string | null;
    url: string;
    width: number | null;
    height: number | null;
  } | null;
  priceRange: {
    minVariantPrice: {amount: string; currencyCode: string};
    maxVariantPrice: {amount: string; currencyCode: string};
  };
};

export type SellerSummary = {
  handle: string; // stable URL key (metaobject slug, or slugified name fallback)
  name: string; // display_name (editable)
  initial: string;
  logoUrl: string | null;
  verified: boolean;
  productCount: number;
  previewImages: Array<{url: string; altText: string | null}>;
};

export type SellerDetail = SellerSummary & {
  bio: string | null;
  products: SellerProduct[];
};

export type SellerSort = 'default' | 'price-asc' | 'price-desc' | 'title';

function initialOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(c) ? c : '•';
}

type Scanned = {
  handle: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  bio: string | null;
  products: SellerProduct[];
};

/**
 * Single catalog scan: read each product's custom.seller reference and bucket
 * products by their seller metaobject. Products with no seller are skipped
 * (the "unassigned" case). Cached short so admin edits (renames, new tags)
 * show up quickly during testing.
 *
 * NOTE: caps at the first 250 products — fine at current scale. When the catalog
 * grows past that, this becomes a paginated crawl or a metafield-filtered query.
 */
async function scanSellers(storefront: Storefront): Promise<Map<string, Scanned>> {
  const {products} = await storefront.query(SELLER_SCAN_QUERY, {
    cache: storefront.CacheShort(),
  });

  const byHandle = new Map<string, Scanned>();

  for (const p of products.nodes) {
    const ref = p.seller?.reference;
    if (!ref) continue; // unassigned product → not in any store

    const slug = ref.slug?.value?.trim();
    const name = ref.displayName?.value?.trim() || ref.handle;
    // Stable URL key: the slug field if set, else slugify the metaobject handle.
    const handle = slug ? sellerHandle(slug) : sellerHandle(ref.handle);
    if (!handle) continue;

    const entry: Scanned =
      byHandle.get(handle) ??
      ({
        handle,
        name,
        logoUrl: ref.logo?.reference?.image?.url ?? null,
        verified: ref.verified?.value === 'true',
        bio: ref.bio?.value ?? null,
        products: [],
      } satisfies Scanned);

    entry.products.push({
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      featuredImage: p.featuredImage
        ? {
            id: p.featuredImage.id ?? null,
            altText: p.featuredImage.altText ?? null,
            url: p.featuredImage.url,
            width: p.featuredImage.width ?? null,
            height: p.featuredImage.height ?? null,
          }
        : null,
      priceRange: p.priceRange,
    });

    byHandle.set(handle, entry);
  }

  return byHandle;
}

function toSummary(s: Scanned): SellerSummary {
  return {
    handle: s.handle,
    name: s.name,
    initial: initialOf(s.name),
    logoUrl: s.logoUrl,
    verified: s.verified,
    productCount: s.products.length,
    previewImages: s.products
      .filter((p) => p.featuredImage?.url)
      .slice(0, 3)
      .map((p) => ({
        url: p.featuredImage!.url,
        altText: p.featuredImage!.altText,
      })),
  };
}

/** All sellers (that have at least one tagged product), alphabetical by name. */
export async function getSellerDirectory(
  storefront: Storefront,
): Promise<SellerSummary[]> {
  const map = await scanSellers(storefront);
  return [...map.values()]
    .map(toSummary)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One seller by handle, with products sorted per the UI choice. */
export async function getSeller(
  storefront: Storefront,
  handle: string,
  sort: SellerSort = 'default',
): Promise<SellerDetail | null> {
  const map = await scanSellers(storefront);
  const s = map.get(handle);
  if (!s) return null;

  const products = [...s.products];
  if (sort === 'price-asc' || sort === 'price-desc') {
    products.sort((a, b) => {
      const d =
        Number(a.priceRange.minVariantPrice.amount) -
        Number(b.priceRange.minVariantPrice.amount);
      return sort === 'price-asc' ? d : -d;
    });
  } else if (sort === 'title') {
    products.sort((a, b) => a.title.localeCompare(b.title));
  }

  return {...toSummary(s), bio: s.bio, products};
}

const SELLER_SCAN_QUERY = `#graphql
  query SellerScan($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 250) {
      nodes {
        id
        handle
        title
        vendor
        featuredImage {
          id
          altText
          url
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        seller: metafield(namespace: "custom", key: "seller") {
          reference {
            ... on Metaobject {
              handle
              slug: field(key: "slug") {
                value
              }
              displayName: field(key: "display_name") {
                value
              }
              bio: field(key: "bio") {
                value
              }
              verified: field(key: "verified") {
                value
              }
              logo: field(key: "logo") {
                reference {
                  ... on MediaImage {
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
` as const;
