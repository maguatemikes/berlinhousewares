import {useEffect, useMemo, useState} from 'react';
import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/sellers._index';
import {getSellerDirectory, type SellerSummary} from '~/lib/sellers.server';
import {SelectMenu} from '~/components/SelectMenu';
import {siteOrigin, socialMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({matches}) => {
  const title = 'Sellers — Berlin Houseware';
  const description =
    'Browse the consignors selling on Berlin Houseware — each with their own store.';
  return [
    {title},
    {name: 'description', content: description},
    ...socialMeta({title, description, url: `${siteOrigin(matches)}/sellers`}),
  ];
};

export async function loader({context}: Route.LoaderArgs) {
  const sellers = await getSellerDirectory(context.storefront);
  return {sellers};
}

// Sort options for the <SelectMenu> — mirrors the shop's SortMenu pattern.
const SELLER_SORT = [
  {value: 'featured', label: 'Featured'},
  {value: 'name-asc', label: 'Name: A–Z'},
  {value: 'name-desc', label: 'Name: Z–A'},
  {value: 'items-desc', label: 'Most items'},
  {value: 'items-asc', label: 'Fewest items'},
];

// Sellers shown per "page" before "Load more" (client-side, mirrors the shop grid).
const PAGE_SIZE = 8;

export default function SellersIndex() {
  const {sellers} = useLoaderData<typeof loader>();

  // Client-side filter/sort state — operates purely on the already-loaded list.
  // No loader round-trip, no data-layer/analytics impact.
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const q = query.trim().toLowerCase();
  const verifiedCount = useMemo(
    () => sellers.filter((s) => s.verified).length,
    [sellers],
  );

  const filtered = useMemo(() => {
    const list = sellers.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) &&
        (!verifiedOnly || s.verified),
    );
    switch (sort) {
      case 'name-asc':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return [...list].sort((a, b) => b.name.localeCompare(a.name));
      case 'items-desc':
        return [...list].sort((a, b) => b.productCount - a.productCount);
      case 'items-asc':
        return [...list].sort((a, b) => a.productCount - b.productCount);
      default:
        return list; // featured = as returned
    }
  }, [sellers, q, verifiedOnly, sort]);

  // Reset to the first page whenever the filter/sort changes.
  useEffect(() => setVisible(PAGE_SIZE), [q, verifiedOnly, sort]);
  const shown = filtered.slice(0, visible);

  const hasActive = Boolean(q) || verifiedOnly;
  const clearAll = () => {
    setQuery('');
    setVerifiedOnly(false);
  };

  const sidebar = (
    <SellerFilters
      query={query}
      setQuery={setQuery}
      verifiedOnly={verifiedOnly}
      setVerifiedOnly={setVerifiedOnly}
      verifiedCount={verifiedCount}
    />
  );

  return (
    <div className="bg-paper">
      {/* Hero band */}
      <div className="bg-mint">
        <div className="ui-container py-12">
          <span className="eyebrow text-brand-700">Consignors</span>
          <h1 className="mt-3 text-4xl font-extrabold uppercase tracking-tight md:text-6xl">
            Sellers
          </h1>
          <p className="mt-4 max-w-2xl text-muted">
            Every seller has their own store. Follow the ones you love and shop
            their pieces.
          </p>
        </div>
      </div>

      {/* Shop-style layout: Filters sidebar + results */}
      <div className="ui-container flex flex-col gap-8 py-10 lg:flex-row">
        {/* Desktop sidebar (a div, not <aside> — the global aside rule is for drawers) */}
        <div className="hidden lg:block lg:w-60 lg:shrink-0">
          <div className="sticky top-28">
            <p className="mb-5 text-sm font-bold uppercase tracking-wide text-ink">
              Filters
            </p>
            {sidebar}
          </div>
        </div>

        {/* Results */}
        <div id="sellers-results" className="min-w-0 flex-1 scroll-mt-32">
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
            <p className="hidden text-sm text-muted sm:block">
              {filtered.length} {filtered.length === 1 ? 'seller' : 'sellers'}
            </p>
            <div className="ml-auto">
              <SelectMenu
                label="Sort"
                ariaLabel="Sort sellers"
                value={sort}
                options={SELLER_SORT}
                onChange={setSort}
              />
            </div>
          </div>

          {/* Active filter chips */}
          {hasActive && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {q && <Chip onRemove={() => setQuery('')}>“{query.trim()}”</Chip>}
              {verifiedOnly && (
                <Chip onRemove={() => setVerifiedOnly(false)}>Verified</Chip>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-3xl bg-mint px-6 py-16 text-center">
              <p className="text-lg font-bold text-ink">
                {sellers.length === 0
                  ? 'No sellers yet'
                  : 'No sellers match your filters'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {sellers.length === 0
                  ? 'Sellers appear here once their products are listed.'
                  : 'Try removing a filter or clearing them all.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((s) => (
                  <SellerCard key={s.handle} s={s} />
                ))}
              </div>
              <div className="mt-8 flex flex-col items-center gap-3 border-t border-black/10 pt-6">
                <p className="text-sm text-muted">
                  Showing {shown.length} of {filtered.length}{' '}
                  {filtered.length === 1 ? 'seller' : 'sellers'}
                </p>
                {visible < filtered.length && (
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="btn btn-dark !py-2.5 text-sm"
                  >
                    Load more
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer (mirrors the shop's) */}
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
            <div className="flex-1 overflow-y-auto px-5 py-5">{sidebar}</div>
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/** Filter panel — search + verified. Rendered in both the desktop sidebar and
 *  the mobile drawer, styled to match CollectionFilters (FilterSection look). */
function SellerFilters({
  query,
  setQuery,
  verifiedOnly,
  setVerifiedOnly,
  verifiedCount,
}: {
  query: string;
  setQuery: (v: string) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (updater: (v: boolean) => boolean) => void;
  verifiedCount: number;
}) {
  return (
    <div className="border-t border-black/10">
      {/* Search */}
      <div className="py-4">
        <p className="mb-2.5 text-sm font-bold uppercase tracking-wide text-ink">
          Search
        </p>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Seller name…"
            aria-label="Search sellers by name"
            className="w-full rounded-2xl border border-black/15 bg-paper py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition-colors focus:border-brand-500"
          />
        </div>
      </div>

      {/* Verified facet — collapsible section like the shop's */}
      <details className="group border-t border-black/10" open>
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-bold uppercase tracking-wide text-ink">
          Seller
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          >
            <path
              d="m6 9 6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="pb-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={() => setVerifiedOnly((v) => !v)}
              className="!m-0 h-4 w-4 shrink-0 rounded !border-black/25 accent-brand-600"
            />
            <span className="flex-1 text-ink">Verified only</span>
            <span className="text-xs text-muted">{verifiedCount}</span>
          </label>
        </div>
      </details>
    </div>
  );
}

/** Removable active-filter chip — matches CollectionFilters' Chip. */
function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-mint px-3 py-1 text-sm font-medium text-ink">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/** Seller card — unchanged visual (product slideshow + glass panel). */
function SellerCard({s}: {s: SellerSummary}) {
  return (
    <Link
      to={`/sellers/${s.handle}`}
      prefetch="intent"
      className="group relative block aspect-[4/5] overflow-hidden rounded-md bg-ink"
    >
      <CardSlideshow images={s.previewImages} name={s.name} initial={s.initial} />

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0">
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/30 to-black/5 backdrop-blur-xl [mask-image:linear-gradient(to_top,black_70%,transparent)]"
          aria-hidden="true"
        />
        <div className="relative p-5 pt-8">
          <h3 className="truncate text-lg font-extrabold uppercase tracking-tight text-white">
            {s.name}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {s.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 text-brand-400"
                  aria-hidden="true"
                >
                  <path
                    d="m5 13 4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Verified
              </span>
            )}
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
              Consignor
            </span>
            <span className="ml-auto text-[11px] font-medium tabular-nums text-white/60">
              {s.productCount} {s.productCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-white/70">
            {s.bio ||
              'Verified pre-loved pieces, inspected and authenticated by Berlin Houseware.'}
          </p>

          <span className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-white text-sm font-semibold text-ink transition-colors group-hover:bg-brand-700 group-hover:text-white">
            Visit store
          </span>
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/** Auto-rotating product showcase inside a seller card. Crossfades through the
 *  seller's product photos every few seconds with slide dots; single image
 *  renders static; no images → branded initial tile (per design system). */
function CardSlideshow({
  images,
  name,
  initial,
}: {
  images: Array<{url: string; altText: string | null}>;
  name: string;
  initial: string;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    // No visibility guard needed — browsers throttle hidden-tab timers natively.
    const id = setInterval(
      () => setActive((a) => (a + 1) % images.length),
      3500,
    );
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-700 to-ink">
        <span className="text-7xl font-extrabold text-white/25">{initial}</span>
      </div>
    );
  }

  return (
    <>
      {images.map((img, i) => (
        <img
          key={`${img.url}-${i}`}
          src={`${img.url}${img.url.includes('?') ? '&' : '?'}width=800`}
          alt={img.altText || name}
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 group-hover:scale-105 ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      {images.length > 1 && (
        <div
          className="absolute right-4 top-4 z-10 flex gap-1.5"
          aria-hidden="true"
        >
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
