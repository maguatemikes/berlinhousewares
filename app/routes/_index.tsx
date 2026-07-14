import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
  HomeCollectionsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Berlin Houseware — New & Pre-Loved Homeware'}];
};

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(HOME_COLLECTIONS_QUERY),
  ]);

  return {
    collections: collections.nodes,
    featuredCollection: collections.nodes[0],
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      console.error(error);
      return null;
    });

  return {recommendedProducts};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="bg-paper">
      <Hero collection={data.featuredCollection} />
      <ValueProps />
      <CategoryTiles collections={data.collections} />
      <TrendingProducts products={data.recommendedProducts} />
      <ConsignBand />
      <NewsletterBand />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared layout primitives — one consistent section rhythm everywhere         */
/* -------------------------------------------------------------------------- */
function Section({
  children,
  className = '',
  bleed = false,
}: {
  children: React.ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section className={className}>
      <div className={bleed ? '' : 'ui-container py-16 md:py-24'}>
        {children}
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  cta,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  cta?: {label: string; to: string};
  tone?: 'default' | 'invert';
}) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4">
      <div>
        <span
          className={`eyebrow ${
            tone === 'invert' ? 'text-brand-400' : 'text-brand-700'
          }`}
        >
          {eyebrow}
        </span>
        <h2
          className={`mt-2 text-3xl font-extrabold uppercase tracking-tight md:text-4xl ${
            tone === 'invert' ? 'text-white' : 'text-ink'
          }`}
        >
          {title}
        </h2>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="hidden shrink-0 text-sm font-semibold text-brand-700 hover:underline sm:inline"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rotating headline word — cycles through product types                       */
/* -------------------------------------------------------------------------- */
const SELL_WORDS = [
  'Caps',
  'Bandanas',
  'Tees',
  'Sneakers',
  'Jackets',
  'Watches',
  'Anything',
];

function RotatingWord() {
  // Duplicate the first word at the end for a seamless, always-upward loop.
  const items = [...SELL_WORDS, SELL_WORDS[0]];
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setI((v) => v + 1), 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (i === SELL_WORDS.length) {
      // Landed on the duplicate word — after the slide, snap back to index 0
      // with no transition so the loop is seamless.
      const t = setTimeout(() => {
        setAnimate(false);
        setI(0);
      }, 600);
      return () => clearTimeout(t);
    }
    if (!animate) {
      const r = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(r);
    }
  }, [i, animate]);

  return (
    <span className="inline-block h-[1.3em] overflow-hidden align-bottom text-brand-600">
      <span
        className={`flex flex-col will-change-transform ${
          animate
            ? 'transition-transform duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
            : ''
        }`}
        style={{transform: `translateY(-${(i * 100) / items.length}%)`}}
      >
        {items.map((w, k) => (
          <span
            key={k}
            className={`flex h-[1.3em] items-center leading-none ${
              animate
                ? 'transition-opacity duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
                : ''
            } ${k === i ? 'opacity-100' : 'opacity-20'}`}
          >
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */
function Hero({collection}: {collection?: FeaturedCollectionFragment}) {
  const shopTo = collection
    ? `/collections/${collection.handle}`
    : '/collections';
  return (
    <section className="relative min-h-[75vh] w-full overflow-hidden bg-mint md:min-h-[85vh]">
      {/* Sage fallback — shows if public/hero.jpg is missing */}
      <div className="absolute inset-0 bg-gradient-to-br from-mint via-mint-deep to-brand-200" />
      {/* Hero photo — public/hero.png (anchored top-right so the model's head isn't cropped) */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{backgroundImage: 'url(/hero.png)', backgroundPosition: 'right top'}}
      />
      {/* Left wash keeps dark text legible over the negative space */}
      <div className="absolute inset-0 bg-gradient-to-r from-mint/95 via-mint/70 to-mint/30 md:via-mint/40 md:to-transparent" />

      {/* Left-aligned content, sitting in the sage negative space */}
      <div className="ui-container relative flex min-h-[75vh] items-center md:min-h-[85vh]">
        <div className="max-w-xl">
          <span className="eyebrow text-brand-700">
            New Drops · Verified Pre-Loved
          </span>
          <h1 className="mt-3 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight text-ink md:text-7xl">
            Buy &amp; Sell
            <br />
            <RotatingWord />
          </h1>
          <p className="mt-5 max-w-md text-base text-ink/70 md:text-lg">
            The marketplace for new and pre-loved. If it&apos;s good, someone
            wants it — shop the drop, or consign yours and get paid.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={shopTo} className="btn btn-dark">
              Shop
            </Link>
            <Link to="/consign" className="btn btn-outline">
              Start selling
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Value props                                                                 */
/* -------------------------------------------------------------------------- */
function ValueProps() {
  const svg = 'h-[18px] w-[18px]';
  const items = [
    {
      t: 'Free shipping',
      d: 'On orders over $75',
      icon: (
        <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6.5h10v9H3z" />
          <path d="M13 9.5h4l3 3v3h-7z" />
          <circle cx="7" cy="17.5" r="1.6" />
          <circle cx="17" cy="17.5" r="1.6" />
        </svg>
      ),
    },
    {
      t: 'Verified quality',
      d: 'Every consignment inspected',
      icon: (
        <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 2.5v5.5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V5.5L12 3z" />
          <path d="m9 11.5 2 2 4-4" />
        </svg>
      ),
    },
    {
      t: 'Easy 30-day returns',
      d: 'On unworn items',
      icon: (
        <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 9A8 8 0 1 1 3.2 13.2" />
          <path d="M3 4.5V9h4.5" />
        </svg>
      ),
    },
    {
      t: 'Earn as you sell',
      d: 'Up to 80% payout',
      icon: (
        <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 13 11 6l8 1 1 8-7 7-9-9z" />
          <circle cx="14.5" cy="9.5" r="1.4" />
        </svg>
      ),
    },
  ];
  return (
    <section className="border-y border-black/10 bg-paper">
      <div className="ui-container grid grid-cols-2 gap-y-6 py-7 md:grid-cols-4 md:gap-0 md:divide-x md:divide-black/10">
        {items.map((i) => (
          <div
            key={i.t}
            className="flex items-center gap-3.5 md:px-7 md:first:pl-0 md:last:pr-0"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint text-brand-700 ring-1 ring-brand-100">
              {i.icon}
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-ink">{i.t}</p>
              <p className="mt-0.5 text-xs leading-tight text-muted">{i.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Category tiles                                                              */
/* -------------------------------------------------------------------------- */
function CategoryTiles({
  collections,
}: {
  collections: HomeCollectionsQuery['collections']['nodes'];
}) {
  const tiles = collections.slice(0, 3);

  return (
    <Section className="bg-paper">
      <SectionHead
        eyebrow="Browse"
        title="Shop by category"
        cta={{label: 'View all', to: '/collections'}}
      />

      {tiles.length ? (
        // Real Shopify collections (with imagery)
        <div className="grid gap-4 md:grid-cols-3">
          {tiles.map((c, idx) => (
            <Link
              key={c.id}
              to={`/collections/${c.handle}`}
              className={`group relative overflow-hidden rounded-3xl bg-mint-deep ${
                idx === 0 ? 'md:row-span-2 md:min-h-[26rem]' : 'min-h-[16rem]'
              }`}
            >
              {c.image && (
                <Image
                  data={c.image}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  alt={c.image.altText || c.title}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl font-extrabold uppercase text-white">
                  {c.title}
                </h3>
                <span className="mt-3 inline-flex btn btn-ghost !px-4 !py-2 text-sm">
                  Shop now
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        // Fallback: branded category tiles (shown until Shopify collections
        // exist — real ones replace these automatically). Photo-first: drop
        // images in public/categories/<slug>.jpg; a branded gradient shows
        // until then (no placeholder icons).
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {SHOP_CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              to="/collections/all"
              className="group relative min-h-[16rem] overflow-hidden rounded-3xl bg-mint-deep"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-mint-deep via-brand-100 to-brand-200" />
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{backgroundImage: `url(/categories/${cat.slug}.jpg?v=2)`}}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="text-2xl font-extrabold uppercase text-white">
                  {cat.name}
                </h3>
                <span className="mt-3 inline-flex btn btn-ghost !px-4 !py-2 text-sm">
                  Shop now
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

const SHOP_CATEGORIES = [
  {name: 'Caps', slug: 'caps'},
  {name: 'Bandanas', slug: 'bandanas'},
  {name: 'Tees', slug: 'tees'},
  {name: 'Hoodies', slug: 'hoodies'},
  {name: 'Accessories', slug: 'accessories'},
  {name: 'Pre-Loved', slug: 'pre-loved'},
];

/* -------------------------------------------------------------------------- */
/* Trending products                                                           */
/* -------------------------------------------------------------------------- */
function TrendingProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <Section className="bg-mint">
      <SectionHead
        eyebrow="Trending now"
        title="Fresh on the shelf"
        cta={{label: 'Shop all', to: '/collections/all'}}
      />
      <Suspense fallback={<ProductGridSkeleton />}>
        <Await resolve={products}>
          {(response) => (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {response
                ? response.products.nodes.map((product, i) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      loading={i < 4 ? 'eager' : 'lazy'}
                    />
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
    </Section>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
      {Array.from({length: 8}).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-2xl bg-mint-deep" />
          <div className="mt-3 h-3 w-2/3 rounded bg-mint-deep" />
          <div className="mt-2 h-3 w-1/3 rounded bg-mint-deep" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Consignment band                                                            */
/* -------------------------------------------------------------------------- */
function ConsignBand() {
  const steps = [
    {n: '01', t: 'Snap it', d: 'Send a few photos of the homeware you no longer use.'},
    {n: '02', t: 'We sell it', d: 'We inspect, price, list, and ship it for you.'},
    {n: '03', t: 'You get paid', d: 'Earn up to 80% — cash out or store credit.'},
  ];
  return (
    <Section className="bg-paper">
      <div className="overflow-hidden rounded-3xl bg-ink text-white">
        <div className="grid gap-10 p-8 md:grid-cols-2 md:p-14">
          <div>
            <span className="eyebrow text-brand-400">Consignment</span>
            <h2 className="mt-3 text-4xl font-extrabold uppercase leading-tight tracking-tight md:text-5xl">
              Your clutter is
              <br />
              <span className="text-brand-400">someone&apos;s find.</span>
            </h2>
            <p className="mt-4 max-w-md text-white/70">
              Sell the homeware you no longer use. We handle the photos,
              pricing, listing, and shipping — you keep up to 80%.
            </p>
            <Link to="/consign" className="mt-8 inline-flex btn btn-brand">
              Start selling
            </Link>
          </div>
          <div className="grid gap-4 self-center">
            {steps.map((s) => (
              <div
                key={s.n}
                className="flex items-start gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
              >
                <span className="text-2xl font-extrabold text-brand-400">
                  {s.n}
                </span>
                <div>
                  <p className="text-lg font-bold">{s.t}</p>
                  <p className="text-sm text-white/60">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                   */
/* -------------------------------------------------------------------------- */
function NewsletterBand() {
  return (
    <section className="bg-brand-500">
      <div className="ui-container flex flex-col items-center gap-6 py-16 text-center text-[#06210f] md:py-24">
        <h2 className="max-w-2xl text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
          Join the movement. Get first access to drops.
        </h2>
        <form
          className="!max-w-none flex w-full max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            aria-label="Email address"
            className="!mt-0 !mb-0 w-full flex-1 rounded-pill !border-[#06210f]/20 bg-white px-5 py-3 text-ink"
          />
          <button type="submit" className="btn btn-dark">
            Sign up
          </button>
        </form>
        <p className="text-xs text-[#06210f]/70">
          By signing up you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                      */
/* -------------------------------------------------------------------------- */
const HOME_COLLECTIONS_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query HomeCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 6, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
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
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
