import {Link} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
import {
  urlWithTrackingParams,
  type PredictiveSearchReturn,
} from '~/lib/search';
import {SEARCH_EVENT} from '~/lib/analytics/dataLayer';

type PredictiveSearchItems = PredictiveSearchReturn['result']['items'];

/** Small magnifier glyph, shared by the search inputs + suggestion rows. */
export function SearchGlyph({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * Branded predictive-search results, shared by the desktop header flyout and the
 * mobile search drawer so both stay identical: suggested queries + live products
 * (thumbnail / title / price) + collections, with a dark "View all" CTA. Purely
 * presentational — the caller owns the fetcher, the surrounding panel, and what
 * happens on navigate (`onClose`) and on choosing a term (`onSelectQuery`).
 */
export function PredictiveResults({
  items,
  total,
  term,
  loading,
  onClose,
  onSelectQuery,
}: {
  items: PredictiveSearchItems;
  total: number;
  term: string;
  loading: boolean;
  onClose: () => void;
  onSelectQuery: (text: string) => void;
}) {
  const {publish} = useAnalytics();
  const products = items.products.slice(0, 5);
  const collections = items.collections.slice(0, 3);
  const queries = items.queries.filter(Boolean).slice(0, 5);

  // A predictive result (product/collection) was selected → a search happened,
  // but this path navigates straight to the item without visiting /search, so
  // fire the native SEARCH_VIEWED ourselves (GTM/Meta/Shopify then count it).
  // The suggestion rows + "View all" go through onSelectQuery → /search, which
  // already fires SEARCH_VIEWED, so this never double-counts. Covers mouse and
  // keyboard (the result is an <a>, so Enter triggers its onClick too).
  function onSelectResult() {
    const t = term?.trim();
    if (t) {
      try {
        publish(SEARCH_EVENT, {search_term: t});
      } catch {
        /* analytics must never block navigation */
      }
    }
    onClose();
  }

  if (total === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        {loading ? 'Searching…' : <>No results for “{term}”</>}
      </p>
    );
  }

  return (
    <div className="p-2">
      {queries.length > 0 && (
        <div className="mb-1">
          <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Suggestions
          </p>
          {queries.map((q) =>
            q ? (
              <button
                key={q.text}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectQuery(q.text)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-mint"
              >
                <SearchGlyph className="h-4 w-4 shrink-0 text-muted" />
                <span className="truncate">{q.text}</span>
              </button>
            ) : null,
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="mb-1">
          <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Products
          </p>
          {products.map((product) => {
            const url = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });
            const variant = product.selectedOrFirstAvailableVariant;
            const image = variant?.image;
            const price = variant?.price;
            return (
              <Link
                key={product.id}
                to={url}
                onClick={onSelectResult}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-mint"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-mint">
                  {image && (
                    <Image
                      data={image}
                      aspectRatio="1/1"
                      sizes="44px"
                      className="h-11 w-11 object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {product.title}
                  </span>
                  {price && (
                    <span className="block text-xs font-semibold text-brand-700">
                      <Money data={price} />
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {collections.length > 0 && (
        <div className="mb-1">
          <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Collections
          </p>
          {collections.map((collection) => {
            const url = urlWithTrackingParams({
              baseUrl: `/collections/${collection.handle}`,
              trackingParams: collection.trackingParameters,
              term,
            });
            return (
              <Link
                key={collection.id}
                to={url}
                onClick={onSelectResult}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-ink transition-colors hover:bg-mint"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-mint">
                  {collection.image && (
                    <Image
                      data={collection.image}
                      aspectRatio="1/1"
                      sizes="44px"
                      className="h-11 w-11 object-cover"
                    />
                  )}
                </span>
                <span className="truncate">{collection.title}</span>
              </Link>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelectQuery(term)}
        className="mt-1 flex w-full items-center justify-between rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <span>View all results for “{term}”</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
