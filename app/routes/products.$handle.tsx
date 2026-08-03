import {Suspense, useEffect, useState} from 'react';
import {
  Await,
  Link,
  redirect,
  useLoaderData,
  useRevalidator,
} from 'react-router';
import type {Route} from './+types/products.$handle';
import {sellerHandle} from '~/lib/sellers';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  Money,
} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {RelatedProductFragment} from 'storefrontapi.generated';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {ProductItem} from '~/components/ProductItem';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {siteOrigin} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data, matches}) => {
  const product = data?.product;
  if (!product) {
    return [{title: 'Product | Berlin Houseware'}];
  }

  const variant = product.selectedOrFirstAvailableVariant;
  const title = product.seo?.title || `${product.title} | Berlin Houseware`;
  const description = (
    product.seo?.description ||
    product.description ||
    `Shop ${product.title} at Berlin Houseware — new & pre-loved streetwear.`
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const image = variant?.image?.url || product.images?.nodes?.[0]?.url;
  const url = `${siteOrigin(matches)}/products/${product.handle}`;

  return [
    {title},
    {name: 'description', content: description},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:type', content: 'product'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: url},
    ...(image ? [{property: 'og:image', content: image}] : []),
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    ...(image ? [{name: 'twitter:image', content: image}] : []),
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description,
        image: image ? [image] : undefined,
        brand: {'@type': 'Brand', name: product.vendor || 'Berlin Houseware'},
        sku: variant?.sku || undefined,
        offers: variant?.price
          ? {
              '@type': 'Offer',
              priceCurrency: variant.price.currencyCode,
              price: variant.price.amount,
              availability: variant.availableForSale
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              url,
            }
          : undefined,
      },
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  const {storefront} = context;
  const {handle} = params;

  // "You may also like" — Shopify's NATIVE recommendation engine only (the same
  // one the Search & Discovery app tunes), fetched below the fold so it never
  // blocks TTFB. `productRecommendations(intent: RELATED)` is algorithm-driven:
  // every item it returns is genuinely related, so we show exactly those and
  // nothing else. When it returns nothing (thin order history / uncategorized
  // product), the row simply hides — we never pad with unrelated best-sellers.
  const recommendations = handle
    ? storefront
        .query(PRODUCT_RECOMMENDATIONS_QUERY, {
          variables: {handle},
          cache: storefront.CacheLong(),
        })
        .then((data) => data?.recommended ?? [])
        .catch(() => [])
    : Promise.resolve([]);

  return {recommendations};
}

export default function Product() {
  const {product, recommendations} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;

  // Quantity is shared so the displayed price reflects the selected amount.
  const [quantity, setQuantity] = useState(1);

  // Seller state for the eyebrow: linked → link; fresh + unlinked → "syncing".
  const sellerRef = product.seller?.reference;
  const SYNC_WINDOW_MS = 15 * 60 * 1000;
  const sellerSyncing =
    !sellerRef &&
    Boolean(
      product.createdAt &&
      Date.now() - new Date(product.createdAt).getTime() < SYNC_WINDOW_MS,
    );

  // While "Seller syncing…" shows, quietly re-fetch route data every 20s so
  // the state flips to the seller link on its own when the sweep lands —
  // no manual refresh. Stops once linked, when the window lapses, or when
  // the tab is hidden.
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!sellerSyncing) return;
    const id = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        revalidator.state === 'idle'
      ) {
        void revalidator.revalidate();
      }
    }, 20_000);
    return () => clearInterval(id);
  }, [sellerSyncing, revalidator]);
  const unitPrice = selectedVariant?.price;
  const unitCompareAt = selectedVariant?.compareAtPrice;
  const lineTotal: MoneyV2 | undefined = unitPrice
    ? {
        amount: (Number(unitPrice.amount) * quantity).toFixed(2),
        currencyCode: unitPrice.currencyCode,
      }
    : undefined;
  const compareTotal: MoneyV2 | null = unitCompareAt
    ? {
        amount: (Number(unitCompareAt.amount) * quantity).toFixed(2),
        currencyCode: unitCompareAt.currencyCode,
      }
    : null;

  // Build the gallery in a STABLE order (product images as-is) so switching
  // variants doesn't reshuffle the thumbnails. The selected variant's image stays
  // in its natural position — ProductGallery highlights it and slides the rail to
  // it via `activeImageUrl`, instead of hoisting it to the top on every swatch
  // change. If the variant's image isn't among the product images, it's appended
  // so it's still shown.
  const galleryImages = (() => {
    const out: Array<{
      id?: string | null;
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    }> = [];
    const seen = new Set<string>();
    for (const node of product.images?.nodes ?? []) {
      if (node?.url && !seen.has(node.url)) {
        out.push(node);
        seen.add(node.url);
      }
    }
    if (selectedVariant?.image?.url && !seen.has(selectedVariant.image.url)) {
      out.push(selectedVariant.image);
    }
    return out;
  })();

  return (
    <>
      <div className="ui-container py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-12">
          {/* Gallery */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery
              images={galleryImages}
              title={title}
              activeImageUrl={selectedVariant?.image?.url}
            />
          </div>

          {/* Product info */}
          <div className="lg:py-2">
            {/* Eyebrow = SELLER slot only (brand lives under the title).
              linked → link · fresh+unlinked → syncing (self-refreshing) ·
              old+unlinked → nothing. State computed above with the poller. */}
            {sellerRef ? (
              <Link
                to={`/sellers/${sellerHandle(
                  sellerRef.slug?.value?.trim() || sellerRef.handle,
                )}`}
                prefetch="intent"
                className="eyebrow text-brand-700 underline-offset-4 transition-colors hover:text-brand-800 hover:underline"
              >
                {sellerRef.displayName?.value?.trim() || product.vendor}
              </Link>
            ) : sellerSyncing ? (
              <span className="eyebrow animate-pulse text-muted">
                Seller syncing…
              </span>
            ) : null}
            <h1 className="mt-2 text-3xl font-extrabold uppercase leading-tight tracking-tight md:text-4xl">
              {title}
            </h1>
            {/* Brand under the title — the vendor's only home (the eyebrow is
              seller-only now). Hidden when it's just the store-default vendor. */}
            {product.vendor &&
              !product.vendor.toLowerCase().includes('berlinhouseware') && (
                <p className="mt-1 text-sm text-muted">
                  Brand: {product.vendor}
                </p>
              )}

            <div className="mt-4">
              <ProductPrice price={lineTotal} compareAtPrice={compareTotal} />
              {quantity > 1 && unitPrice && (
                <p className="mt-1 text-sm text-muted">
                  {quantity} × <Money as="span" data={unitPrice} />
                </p>
              )}
            </div>

            <Installments price={selectedVariant?.price} />

            <div className="mt-8">
              <ProductForm
                productOptions={productOptions}
                selectedVariant={selectedVariant}
                quantity={quantity}
                setQuantity={setQuantity}
              />
            </div>

            <TrustLine />

            <div className="mt-8 border-t border-black/10">
              <Accordion title="Description" defaultOpen>
                <div
                  className="prose max-w-none text-sm text-muted [&_a]:text-brand-700 [&_a]:underline"
                  dangerouslySetInnerHTML={{__html: descriptionHtml}}
                />
              </Accordion>
              <Accordion title="Shipping & Returns">
                <p className="text-sm text-muted">
                  Free carbon-neutral shipping on orders over $75. Standard
                  delivery in 3–5 business days. 30-day returns on unused items
                  in original condition. Consignment pieces are final sale
                  unless faulty.
                </p>
              </Accordion>
              <Accordion title="Details">
                <ul className="space-y-1 text-sm text-muted">
                  <li>Verified authentic — inspected by our team</li>
                  {product.vendor && <li>Brand: {product.vendor}</li>}
                  {selectedVariant?.sku && <li>SKU: {selectedVariant.sku}</li>}
                  <li>Ships from Berlin Houseware</li>
                </ul>
              </Accordion>
              <Accordion title="Reviews (373)" meta={<Stars />}>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-extrabold leading-none text-ink">
                    5.0
                  </div>
                  <div>
                    <Stars />
                    <p className="mt-1 text-xs text-muted">
                      Based on 373 verified reviews
                    </p>
                  </div>
                </div>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {/* "You may also like" — deferred so it streams in after the detail. */}
      <Suspense fallback={null}>
        <Await resolve={recommendations} errorElement={null}>
          {(items) => <RelatedProducts items={items} currentId={product.id} />}
        </Await>
      </Suspense>

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </>
  );
}

/**
 * "You may also like" row. Drops the product being viewed and caps at 4 cards;
 * renders nothing when there's nothing to show (keeps the page clean on a thin
 * catalog rather than leaving an empty band).
 */
function RelatedProducts({
  items,
  currentId,
}: {
  items: RelatedProductFragment[];
  currentId: string;
}) {
  const list = items.filter((p) => p.id !== currentId).slice(0, 4);
  if (list.length === 0) return null;

  return (
    <section className="bg-mint">
      <div className="ui-container py-16 md:py-24">
        <div className="mb-10">
          <span className="eyebrow text-brand-700">More to love</span>
          <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-ink md:text-4xl">
            You may also like
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {list.map((p) => (
            <ProductItem key={p.id} product={p} loading="lazy" />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stars({count = 5}: {count?: number}) {
  return (
    <span
      className="flex items-center gap-0.5 text-brand-500"
      aria-label={`${count} out of 5 stars`}
    >
      {Array.from({length: 5}).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"
            fill={i < count ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ))}
    </span>
  );
}

function Installments({price}: {price?: MoneyV2}) {
  if (!price) return null;
  const per: MoneyV2 = {
    amount: (Number(price.amount) / 4).toFixed(2),
    currencyCode: price.currencyCode,
  };
  return (
    <p className="mt-2 text-sm text-muted">
      Pay in 4 interest-free installments of{' '}
      <Money as="span" data={per} className="font-semibold text-ink" /> with{' '}
      <span className="font-semibold text-brand-700">Shop Pay</span>.
    </p>
  );
}

function TrustLine() {
  return (
    <p className="mt-6 flex items-center gap-2 text-xs text-muted">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 text-brand-600"
        aria-hidden="true"
      >
        <path
          d="m5 13 4 4L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Free carbon-neutral shipping over $75 · 30-day returns · Verified
      authentic
    </p>
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
  meta,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  meta?: React.ReactNode;
}) {
  return (
    <details
      className="accordion group border-b border-black/10"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-base font-semibold text-ink">
        <span>{title}</span>
        <span className="flex items-center gap-3">
          {meta}
          <span className="text-brand-600 transition-transform group-open:rotate-180">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="m6 9 6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    createdAt
    handle
    descriptionHtml
    description
    images(first: 12) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
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
        }
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

// Card shape for the "You may also like" grid — matches what <ProductItem> reads.
const RELATED_PRODUCT_FRAGMENT = `#graphql
  fragment RelatedProduct on Product {
    id
    title
    handle
    vendor
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
` as const;

// Native Shopify recommendation engine (tuned by the Search & Discovery app).
const PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    recommended: productRecommendations(productHandle: $handle, intent: RELATED) {
      ...RelatedProduct
    }
  }
  ${RELATED_PRODUCT_FRAGMENT}
` as const;
