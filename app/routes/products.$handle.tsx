import {useState} from 'react';
import {redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
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
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
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
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

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

  // Build the gallery: current variant image first, then remaining product images
  const galleryImages = (() => {
    const out: Array<{
      id?: string | null;
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    }> = [];
    const seen = new Set<string>();
    if (selectedVariant?.image?.url) {
      out.push(selectedVariant.image);
      seen.add(selectedVariant.image.url);
    }
    for (const node of product.images?.nodes ?? []) {
      if (node?.url && !seen.has(node.url)) {
        out.push(node);
        seen.add(node.url);
      }
    }
    return out;
  })();

  return (
    <div className="ui-container py-8 md:py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <ProductGallery images={galleryImages} title={title} />
        </div>

        {/* Product info */}
        <div className="lg:py-2">
          {product.vendor && (
            <span className="eyebrow text-brand-700">{product.vendor}</span>
          )}
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-tight md:text-4xl">
              {title}
            </h1>
            <Rating value={5.0} />
          </div>

          <div className="mt-3">
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
                delivery in 3–5 business days. 30-day returns on unused items in
                original condition. Consignment pieces are final sale unless
                faulty.
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
          </div>
        </div>
      </div>
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
    </div>
  );
}

function Rating({value}: {value: number}) {
  return (
    <span className="mt-1 flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-500" aria-hidden="true">
        <path
          d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"
          fill="currentColor"
        />
      </svg>
      {value.toFixed(1)}
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
    <p className="mt-3 text-sm text-muted">
      Pay in 4 interest-free installments of{' '}
      <Money as="span" data={per} className="font-semibold text-ink" /> with{' '}
      <span className="font-semibold text-brand-700">Shop Pay</span>.
    </p>
  );
}

function TrustLine() {
  return (
    <p className="mt-5 flex items-center gap-2 text-xs text-muted">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-600" aria-hidden="true">
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
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-b border-black/10" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-base font-semibold text-ink">
        {title}
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
