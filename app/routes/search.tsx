import {useState} from 'react';
import {useLoaderData} from 'react-router';
import {getPaginationVariables, Pagination, Analytics} from '@shopify/hydrogen';
import type {Route} from './+types/search';
import {ProductItem} from '~/components/ProductItem';
import {
  CollectionFilters,
  SortMenu,
  ActiveFilterChips,
  useFilterPending,
  type Facet,
} from '~/components/CollectionFilters';
import {GridPending} from '~/components/GridPending';
import {
  type RegularSearchReturn,
  type PredictiveSearchReturn,
  getEmptyPredictiveSearchResult,
} from '~/lib/search';
import type {
  RegularSearchQuery,
  PredictiveSearchQuery,
  ProductItemFragment,
} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = ({location}) => {
  const term = new URLSearchParams(location.search).get('q');
  return [
    {
      title: term
        ? `Search: ${term} — Berlin Houseware`
        : 'Search — Berlin Houseware',
    },
  ];
};

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const isPredictive = url.searchParams.has('predictive');
  const searchPromise: Promise<PredictiveSearchReturn | RegularSearchReturn> =
    isPredictive
      ? predictiveSearch({request, context})
      : regularSearch({request, context});

  searchPromise.catch((error: Error) => {
    console.error(error);
    return {term: '', result: null, error: error.message};
  });

  return await searchPromise;
}

/**
 * Renders the /search route
 */
export default function SearchPage() {
  const data = useLoaderData<typeof loader>();
  // Hooks must run before the predictive early-return below.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pending = useFilterPending();

  if (data.type === 'predictive') return null;

  const {term, result, error} = data;
  const search = result?.search ?? null;
  const facets = (search?.productFilters ?? []) as Facet[];
  const total = result?.total ?? 0;

  return (
    <div className="bg-paper">
      <div className="ui-container py-8 md:py-10">
        {/* Compact heading — inside the filter page, not a full-width band */}
        <div className="mb-8">
          <span className="eyebrow text-brand-700">Search</span>
          <h1 className="mt-2 text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
            {term ? <>Results for “{term}”</> : 'Search'}
          </h1>
          {term && (
            <p className="mt-2 text-sm text-muted">
              {total} {total === 1 ? 'style' : 'styles'} for “{term}”
            </p>
          )}
        </div>

        {error && <p className="mb-6 text-sm text-red-600">{error}</p>}

        {!term ? (
          <p className="py-10 text-muted">Type a search term to see results.</p>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row">
          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:w-60 lg:shrink-0">
            <div className="sticky top-28 flex max-h-[calc(100vh-8rem)] flex-col">
              <p className="mb-5 shrink-0 text-sm font-bold uppercase tracking-wide text-ink">
                Filters
              </p>
              <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pr-4 pb-4">
                <CollectionFilters facets={facets} />
              </div>
            </div>
          </div>

          {/* Results */}
          <div id="collection-results" className="min-w-0 flex-1 scroll-mt-32">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="btn btn-outline !px-4 !py-2 text-sm lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    d="M4 6h16M7 12h10M10 18h4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Filters
              </button>
              <div className="ml-auto">
                <SortMenu />
              </div>
            </div>

            <div className="mb-5">
              <ActiveFilterChips facets={facets} />
            </div>

            <GridPending pending={pending}>
              {search && search.nodes.length ? (
                <Pagination connection={search}>
                  {({nodes, isLoading, PreviousLink, NextLink}) => (
                    <div>
                      <div className="mb-6 flex justify-center empty:mb-0">
                        <PreviousLink className="btn btn-outline !py-2 text-sm">
                          {isLoading ? 'Loading…' : '↑ Load previous'}
                        </PreviousLink>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
                        {nodes.map((node, i) => (
                          <ProductItem
                            key={(node as {id: string}).id}
                            product={node as unknown as ProductItemFragment}
                            loading={i < 6 ? 'eager' : 'lazy'}
                          />
                        ))}
                      </div>
                      <div className="mt-8 flex flex-col items-center gap-3 border-t border-black/10 pt-6">
                        <p className="text-sm text-muted">
                          Showing {nodes.length}{' '}
                          {nodes.length === 1 ? 'product' : 'products'}
                        </p>
                        <NextLink className="btn btn-dark !py-2.5 text-sm">
                          {isLoading ? 'Loading…' : 'Load more'}
                        </NextLink>
                      </div>
                    </div>
                  )}
                </Pagination>
              ) : (
                <div className="rounded-3xl bg-mint px-6 py-16 text-center">
                  <p className="text-lg font-bold text-ink">
                    No results for “{term}”
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Try a different term, or remove a filter.
                  </p>
                </div>
              )}
            </GridPending>
          </div>
        </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <p className="text-lg font-extrabold uppercase tracking-tight">
                Filters
              </p>
              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-mint"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <CollectionFilters facets={facets} />
            </div>
            <div className="border-t border-black/10 p-4">
              <button
                onClick={() => setFiltersOpen(false)}
                className="btn btn-dark w-full"
              >
                View results
              </button>
            </div>
          </div>
        </div>
      )}

      <Analytics.SearchView data={{searchTerm: term, searchResults: result}} />
    </div>
  );
}

/**
 * Regular search query and fragments
 * (adjust as needed)
 */
const SEARCH_GRID_PRODUCT_FRAGMENT = `#graphql
  fragment SearchGridProduct on Product {
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
    selectedOrFirstAvailableVariant {
      id
      availableForSale
    }
    seller: metafield(namespace: "custom", key: "seller") {
      reference {
        ... on Metaobject {
          handle
          slug: field(key: "slug") {
            value
          }
        }
      }
    }
  }
` as const;

// Product-only, faceted search — mirrors the collection PLP so /search reuses
// the same filter sidebar, sort, chips, and product grid.
// https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
    $productFilters: [ProductFilter!]
    $sortKey: SearchSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    search(
      query: $term,
      types: [PRODUCT],
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      productFilters: $productFilters,
      sortKey: $sortKey,
      reverse: $reverse,
      unavailableProducts: HIDE,
    ) {
      totalCount
      nodes {
        ...on Product {
          ...SearchGridProduct
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      productFilters {
        id
        label
        type
        values {
          id
          label
          count
          input
        }
      }
    }
  }
  ${SEARCH_GRID_PRODUCT_FRAGMENT}
` as const;

/**
 * Regular search fetcher
 */
async function regularSearch({
  request,
  context,
}: Pick<
  Route.LoaderArgs,
  'request' | 'context'
>): Promise<RegularSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '');
  const paginationVariables = getPaginationVariables(request, {pageBy: 12});

  if (!term) {
    return {type: 'regular', term: '', result: {total: 0, search: null}};
  }

  // Faceted product filters from the URL — same scheme as the collection pages.
  const productFilters: Array<Record<string, unknown>> = [];
  for (const f of url.searchParams.getAll('filter')) {
    try {
      productFilters.push(JSON.parse(f) as Record<string, unknown>);
    } catch {
      // ignore malformed filter params
    }
  }
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  if (minPrice || maxPrice) {
    productFilters.push({
      price: {
        min: minPrice ? Number(minPrice) : 0,
        ...(maxPrice ? {max: Number(maxPrice)} : {}),
      },
    });
  }

  const sort = url.searchParams.get('sort') || '';
  let sortKey: 'RELEVANCE' | 'PRICE' = 'RELEVANCE';
  let reverse = false;
  if (sort === 'price-asc') {
    sortKey = 'PRICE';
  } else if (sort === 'price-desc') {
    sortKey = 'PRICE';
    reverse = true;
  }

  const {
    errors,
    search,
  }: {errors?: Array<{message: string}>} & RegularSearchQuery =
    await storefront.query(SEARCH_QUERY, {
      variables: {
        ...paginationVariables,
        term,
        productFilters,
        sortKey,
        reverse,
      },
    });

  const error = errors
    ? errors.map(({message}) => message).join(', ')
    : undefined;

  return {
    type: 'regular',
    term,
    error,
    result: {total: search?.totalCount ?? 0, search},
  };
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
    }
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

/**
 * Predictive search fetcher
 */
async function predictiveSearch({
  request,
  context,
}: Pick<
  Route.ActionArgs,
  'request' | 'context'
>): Promise<PredictiveSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 10);
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  // Predictively search articles, collections, pages, products, and queries (suggestions)
  const {
    predictiveSearch: items,
    errors,
  }: PredictiveSearchQuery & {errors?: Array<{message: string}>} =
    await storefront.query(PREDICTIVE_SEARCH_QUERY, {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    });

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: {message: string}) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  const total = Object.values(items).reduce(
    (acc: number, item: Array<unknown>) => acc + item.length,
    0,
  );

  return {type, term, result: {items, total}};
}
