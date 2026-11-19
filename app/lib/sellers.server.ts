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
  bio: string | null; // plain text extracted from the rich-text field
  productCount: number;
  previewImages: Array<{url: string; altText: string | null}>;
};

export type SellerDetail = SellerSummary & {
  products: SellerProduct[];
};

export type SellerSort = 'default' | 'price-asc' | 'price-desc' | 'title';

function initialOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(c) ? c : '•';
}

/**
 * Metaobject rich-text fields store a JSON AST ({type:'root',children:[…]}).
 * Extract readable plain text; pass plain strings through unchanged.
 */
function richTextToPlain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return trimmed || null;
  try {
    const walk = (node: {value?: string; children?: unknown[]}): string =>
      [node.value ?? '', ...(node.children ?? []).map((c) => walk(c as never))]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const text = walk(JSON.parse(trimmed) as never);
    return text || null;
  } catch {
    return null;
  }
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
  const byHandle = new Map<string, Scanned>();

  // Paginate the WHOLE catalog (not just the first 250) so every seller — and an
  // accurate per-seller count — is represented, no matter where their products
  // sit in the catalog.
  let cursor: string | null = null;
  do {
    const {products} = (await storefront.query(SELLER_SCAN_QUERY, {
      variables: {cursor},
      cache: storefront.CacheShort(),
    })) as unknown as {
      products: {
        pageInfo: {hasNextPage: boolean; endCursor: string | null};
        nodes: Array<{
          id: string;
          handle: string;
          title: string;
          vendor: string;
          featuredImage: {
            id?: string | null;
            altText?: string | null;
            url: string;
            width?: number | null;
            height?: number | null;
          } | null;
          priceRange: {
            minVariantPrice: {amount: string; currencyCode: string};
            maxVariantPrice: {amount: string; currencyCode: string};
          };
          seller?: {
            reference?: {
              handle: string;
              slug?: {value?: string | null} | null;
              displayName?: {value?: string | null} | null;
              bio?: {value?: string | null} | null;
              verified?: {value?: string | null} | null;
              logo?: {
                reference?: {
                  image?: {url: string; altText?: string | null} | null;
                } | null;
              } | null;
            } | null;
          } | null;
        }>;
      };
    };

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

    cursor = products.pageInfo?.hasNextPage ? products.pageInfo.endCursor : null;
  } while (cursor);

  return byHandle;
}

function toSummary(s: Scanned): SellerSummary {
  return {
    handle: s.handle,
    name: s.name,
    initial: initialOf(s.name),
    logoUrl: s.logoUrl,
    verified: s.verified,
    bio: richTextToPlain(s.bio),
    productCount: s.products.length,
    previewImages: s.products
      .filter((p) => p.featuredImage?.url)
      .slice(0, 5)
      .map((p) => ({
        url: p.featuredImage!.url,
        altText: p.featuredImage!.altText,
      })),
  };
}

/**
 * Consignor store handles are the ResaleOS account ID, e.g. "a-840975".
 * Brand-fallback stores (e.g. "all-bath") don't match this, so the directory
 * lists only real consignor stores. (Brand links stay intact but hidden here;
 * as products are reassigned to a consignor they appear automatically.)
 */
const CONSIGNOR_HANDLE = /^a-\d+$/;

/** All consignor sellers (that have at least one product), alphabetical by name. */
export async function getSellerDirectory(
  storefront: Storefront,
): Promise<SellerSummary[]> {
  const map = await scanSellers(storefront);
  return [...map.values()]
    .filter((s) => CONSIGNOR_HANDLE.test(s.handle))
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

  return {...toSummary(s), products};
}

/* ──────────────────────────────────────────────────────────────────────────
 * Paginated, Shopify-SOURCED seller page (replaces the whole-catalog scan for
 * the seller DETAIL route). Products come from the Storefront `search` filtered
 * by the `seller-<handle>` tag the sweep stamps — so the list and the count are
 * exactly what's live on the storefront (never phantom ResaleOS-only items), and
 * it paginates natively via <Pagination>. Seller identity comes from the `seller`
 * metaobject in the same request.
 * ────────────────────────────────────────────────────────────────────────── */

export type SellerPageProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  featuredImage: {
    id: string | null;
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  priceRange: {
    minVariantPrice: {amount: string; currencyCode: string};
    maxVariantPrice: {amount: string; currencyCode: string};
  };
};

export type SellerPage = {
  handle: string;
  name: string;
  initial: string;
  logoUrl: string | null;
  verified: boolean;
  bio: string | null;
  productCount: number;
  products: {
    nodes: SellerPageProduct[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

// The grid uses the `products(query:)` connection (reliable + fresh; `search`
// lags its index badly right after bulk tag writes). ProductSortKeys: null =
// default order, PRICE for the two price directions.
const SELLER_SORT_MAP: Record<string, {sortKey: string | null; reverse: boolean}> =
  {
    default: {sortKey: null, reverse: false},
    'price-asc': {sortKey: 'PRICE', reverse: false},
    'price-desc': {sortKey: 'PRICE', reverse: true},
  };

/**
 * One seller's page: identity (metaobject) + a paginated, tag-filtered product
 * connection ready for <Pagination>. `paginationVariables` come from Hydrogen's
 * `getPaginationVariables`; `term` is the optional in-store search term.
 */
export async function getSellerPage(
  storefront: Storefront,
  handle: string,
  {
    sort,
    term,
    paginationVariables,
  }: {
    sort: SellerSort;
    term?: string;
    paginationVariables: Record<string, unknown>;
  },
): Promise<SellerPage | null> {
  const {sortKey, reverse} = SELLER_SORT_MAP[sort] ?? SELLER_SORT_MAP.default;

  // search() honours a `tag:` scope in the QUERY STRING (its `productFilters`
  // `tag` input is silently ignored on this store), so we filter by the seller
  // tag there and append the optional in-store search term after it.
  const text = term?.trim();
  const searchQuery = text
    ? `tag:seller-${handle} ${text}`
    : `tag:seller-${handle}`;

  const data = (await storefront.query(SELLER_PAGE_QUERY, {
    variables: {
      handle,
      query: searchQuery,
      sortKey,
      reverse,
      ...paginationVariables,
    },
    cache: storefront.CacheShort(),
  })) as unknown as {
    metaobject: {
      name?: {value: string | null} | null;
      bio?: {value: string | null} | null;
      verified?: {value: string | null} | null;
      logo?: {
        reference?: {image?: {url: string; altText: string | null} | null} | null;
      } | null;
    } | null;
    // `count` (search) is best-effort — its index lags bulk writes, so callers
    // treat 0 as "unknown" rather than showing "(0)" over a full grid.
    count: {totalCount: number} | null;
    products: {
      nodes: SellerPageProduct[];
      pageInfo: SellerPage['products']['pageInfo'];
    };
  };

  if (!data.metaobject) return null; // unknown seller → 404
  const name = data.metaobject.name?.value?.trim() || handle;

  return {
    handle,
    name,
    initial: initialOf(name),
    logoUrl: data.metaobject.logo?.reference?.image?.url ?? null,
    verified: data.metaobject.verified?.value === 'true',
    bio: richTextToPlain(data.metaobject.bio?.value),
    productCount: data.count?.totalCount ?? 0,
    products: {nodes: data.products.nodes, pageInfo: data.products.pageInfo},
  };
}

const SELLER_PAGE_QUERY = `#graphql
  query SellerPage(
    $handle: String!
    $query: String!
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    metaobject(handle: {type: "seller", handle: $handle}) {
      name: field(key: "display_name") { value }
      bio: field(key: "bio") { value }
      verified: field(key: "verified") { value }
      logo: field(key: "logo") {
        reference {
          ... on MediaImage { image { url altText } }
        }
      }
    }
    # Best-effort count (search index lags bulk writes; treated as optional).
    count: search(query: $query, types: [PRODUCT], first: 1) {
      totalCount
    }
    # Grid: the products(query:) connection — reliable filter + cursor pagination.
    products(
      query: $query
      sortKey: $sortKey
      reverse: $reverse
      first: $first
      last: $last
      before: $startCursor
      after: $endCursor
    ) {
      nodes {
        id
        handle
        title
        vendor
        featuredImage { id url altText width height }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
` as const;

const SELLER_SCAN_QUERY = `#graphql
  query SellerScan($country: CountryCode, $language: LanguageCode, $cursor: String)
  @inContext(country: $country, language: $language) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
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
