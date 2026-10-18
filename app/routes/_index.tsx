import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useEffect, useRef, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  RecommendedProductsQuery,
  HomeCollectionsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {siteOrigin} from '~/lib/seo';

// Hero photo on the Shopify CDN (1672×941). Rendered responsively via Hydrogen
// <Image> below, and reused as the homepage social-share image (og:image).
const HERO_IMAGE =
  'https://cdn.shopify.com/s/files/1/0716/2609/6792/files/hero.png';

export const meta: Route.MetaFunction = ({matches}) => {
  const title = 'Berlin Houseware — New & Pre-Loved Homeware';
  const description =
    'Shop new and verified pre-loved homeware at Berlin Houseware — a curated marketplace for kitchen, dining, décor, and lighting. Buy, sell, and consign quality pieces.';
  const origin = siteOrigin(matches);
  const url = `${origin}/`;
  return [
    {title},
    {name: 'description', content: description},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:type', content: 'website'},
    {property: 'og:site_name', content: 'Berlin Houseware'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: url},
    {property: 'og:image', content: HERO_IMAGE},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    {name: 'twitter:image', content: HERO_IMAGE},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Berlin Houseware',
        url,
        description,
      },
    },
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Berlin Houseware',
        url,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    },
  ];
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
      <Hero />
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
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */
function Hero() {
  // The Shop CTA always opens the full catalog, not a featured collection.
  const shopTo = '/collections/all';
  return (
    <section className="relative isolate w-full overflow-hidden">
      {/* Flat-lay backdrop (shared with the myResale portal) + dark gradient so
          white copy stays readable — darker on the left (text) than the right. */}
      <img
        src="/hero-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/35"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-transparent to-black/20"
      />

      <div className="ui-container grid items-center gap-8 pt-12 sm:gap-10 sm:pt-14 md:min-h-[85vh] md:grid-cols-2 md:gap-8 md:py-0">
        {/* Copy */}
        <div className="max-w-xl">
          <span className="eyebrow text-brand-300">
            New Drops · Verified Pre-Loved
          </span>
          <h1 className="mt-4 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-white md:text-7xl">
            New &amp;
            <br />
            Pre‑Loved
          </h1>
          <p className="mt-4 text-lg font-semibold text-brand-300 md:text-xl">
            Buy, sell &amp; consign — one marketplace.
          </p>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
            Two ways to shop, one marketplace you can trust. Browse brand-new
            drops right next to verified pre-loved finds — every secondhand
            piece is hand-inspected and authenticated before it&apos;s listed.
            Got pieces of your own? Consign them in minutes: we handle the
            photos, listing, and shipping, and you keep up to 80% when they
            sell.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to={shopTo}
              className="btn bg-coral text-white hover:bg-coral-dark"
            >
              Shop
            </Link>
            <Link
              to="/consign"
              className="btn border-white/60 text-white hover:bg-white/10"
            >
              Start selling
            </Link>
          </div>
        </div>

        {/* Hand holding phone — the screen runs a live product slider. The PNG's
            screen is opaque white and nothing overlaps the screen front, so the
            slider sits ON TOP of it, clipped to the screen rect (measured from
            the asset: left 10.4% / top 2.3% / 45.8% × 73.9%). */}
        <div className="self-end">
          <div
            className="relative mx-auto w-full max-w-[460px] md:ml-auto md:max-w-[560px]"
            style={{aspectRatio: '1162 / 1500'}}
          >
            <div
              className="absolute z-20 overflow-hidden bg-white"
              style={{
                left: '10.4%',
                top: '2.3%',
                width: '45.8%',
                height: '73.9%',
                borderRadius: '16px',
              }}
            >
              <PhoneProductCards cards={HERO_CARDS} />
            </div>

            <img
              src="/hero-phone.png"
              alt="Shop Berlin Houseware from your phone"
              className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none object-contain"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type HeroCard = {
  category: string;
  title: string;
  img: string;
};

/** Broad, recognizable category product photos (hot-linked stock imagery) for
 *  the decorative phone mock-up — deliberately NOT the real catalog, so the
 *  hero reads as a generic storefront. Clean white-ground shots across the
 *  headline categories; cohesive regardless of the live inventory. */
const heroImg = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=480&q=75&auto=format`;

const HERO_CARDS: HeroCard[] = [
  {
    category: 'Footwear',
    title: 'Sneakers',
    img: heroImg('1600185365926-3a2ce3cdb9eb'),
  },
  {
    category: 'Accessories',
    title: 'Baseball Cap',
    img: heroImg('1588850561407-ed78c282e89b'),
  },
  {
    category: 'Apparel',
    title: 'T‑Shirt',
    img: heroImg('1620799139507-2a76f79a2f4d'),
  },
  {
    category: 'Footwear',
    title: 'Running Shoes',
    img: heroImg('1491553895911-0055eca6402d'),
  },
  {
    category: 'Accessories',
    title: 'Dad Cap',
    img: heroImg('1521369909029-2afed882baee'),
  },
  {
    category: 'Footwear',
    title: 'Court Sneakers',
    img: heroImg('1595950653106-6c9ebd614d3a'),
  },
];

/** A mini mobile product page inside the phone screen (mirrors a real PDP):
 *  header, a product image + option rows, and the brand's two actions. Slides
 *  horizontally through the products (seamless forward loop). Illustrative. */
// Fixed design canvas for the mock; scaled to the real phone-screen size so it
// renders identically at every viewport (the screen rect's aspect is ≈0.48).
const PHONE_DESIGN_W = 240;
const PHONE_DESIGN_H = 500;

function PhoneProductCards({cards}: {cards: HeroCard[]}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);

  // Auto-advance. The index runs one PAST the end onto a duplicate of the first
  // slide, so the motion is always forward — never a reverse snap-back.
  useEffect(() => {
    if (cards.length <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = setInterval(() => setI((a) => a + 1), 3200);
    return () => clearInterval(id);
  }, [cards.length]);

  // Seamless loop: once the duplicate (index === cards.length) has slid in, jump
  // back to the real first slide with the transition OFF, then re-enable it.
  useEffect(() => {
    if (i === cards.length) {
      const t = setTimeout(() => {
        setAnimate(false);
        setI(0);
      }, 700);
      return () => clearTimeout(t);
    }
    if (!animate) {
      const r = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(r);
    }
  }, [i, animate, cards.length]);

  // Scale the design canvas to the measured screen width (keeps the mock legible
  // and overflow-free from desktop down to the smallest phone viewport).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PHONE_DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!cards.length) return null;
  // Duplicate the first slide at the end for the always-forward seamless loop.
  // Carry explicit stable keys so the clone has its own identity (no index key).
  const slides = [
    ...cards.map((card) => ({card, key: card.title})),
    {card: cards[0], key: `${cards[0].title}__loop`},
  ];
  const activeDot = i % cards.length;
  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden bg-paper"
      aria-hidden="true"
    >
      <div
        className="flex flex-col bg-paper"
        style={{
          width: PHONE_DESIGN_W,
          height: PHONE_DESIGN_H,
          transform: `scale(${scale || 1})`,
          transformOrigin: 'top left',
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {/* Header — menu · wordmark · bag */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3 text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="text-[10px] font-bold lowercase leading-none text-ink">
              berlin<span className="text-brand-700">houseware</span>
            </span>
          </div>
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="20" r="1.2" />
            <circle cx="17.5" cy="20" r="1.2" />
            <path d="M2.5 3.5h2.2l2.1 11a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.25L20.8 7H6" />
          </svg>
        </div>

        {/* Product slider — the phone swipes through products with a smooth,
          always-forward slide (cubic-bezier ease, seamless loop). */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`flex h-full ${
              animate
                ? 'transition-transform duration-[700ms] ease-[cubic-bezier(0.76,0,0.24,1)]'
                : ''
            }`}
            style={{transform: `translateX(-${i * 100}%)`}}
          >
            {slides.map(({card: c, key}) => (
              <div
                key={key}
                className="flex h-full w-full shrink-0 flex-col px-3 pb-3 pt-2"
              >
                {/* Product image — a 1:1 tile, full content width so its edges
                  line up with the text column below (balanced) */}
                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-md bg-white">
                  <img
                    src={c.img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
                    {cards.map((dotCard, d) => (
                      <span
                        key={dotCard.title}
                        className={`h-1 w-1 rounded-full ${d === activeDot ? 'bg-white shadow' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Title block — directly under the image */}
                <div className="mt-2 shrink-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Shop › {c.category}
                  </p>
                  <p className="mt-0.5 truncate text-[18px] font-extrabold leading-tight tracking-tight text-ink">
                    {c.title}
                  </p>
                </div>

                {/* Options — grouped right under the title */}
                <div className="mt-2 shrink-0 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 text-[10px] font-bold uppercase tracking-wide text-ink">
                      Color
                    </span>
                    <span className="h-4 w-4 rounded-full bg-ink ring-1 ring-black/10" />
                    <span className="h-4 w-4 rounded-full bg-brand-500 ring-1 ring-black/10" />
                    <span className="h-4 w-4 rounded-full bg-[#c9b8a8] ring-1 ring-black/10" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 text-[10px] font-bold uppercase tracking-wide text-ink">
                      Size
                    </span>
                    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-black/15 px-2.5 text-[11px] font-semibold text-ink">
                      M
                      <svg
                        viewBox="0 0 24 24"
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 text-[10px] font-bold uppercase tracking-wide text-ink">
                      Qty
                    </span>
                    <span className="inline-flex h-6 items-center overflow-hidden rounded-md border border-black/15 text-[11px] font-semibold text-ink">
                      <span className="grid h-full w-6 place-items-center">
                        −
                      </span>
                      <span className="grid h-full w-7 place-items-center border-x border-black/10 tabular-nums">
                        1
                      </span>
                      <span className="grid h-full w-6 place-items-center">
                        +
                      </span>
                    </span>
                  </div>
                </div>

                {/* CTAs — the brand's two actions: Shop now (primary) over Consign */}
                <div className="mt-auto shrink-0 space-y-1.5 pt-2">
                  <div className="flex h-7 w-full items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-paper">
                    Shop now
                  </div>
                  <div className="flex h-7 w-full items-center justify-center rounded-md border border-ink/30 text-[11px] font-semibold text-ink">
                    Consign
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
        <svg
          viewBox="0 0 24 24"
          className={svg}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
        <svg
          viewBox="0 0 24 24"
          className={svg}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l7 2.5v5.5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V5.5L12 3z" />
          <path d="m9 11.5 2 2 4-4" />
        </svg>
      ),
    },
    {
      t: 'Easy 30-day returns',
      d: 'On unworn items',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className={svg}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 9A8 8 0 1 1 3.2 13.2" />
          <path d="M3 4.5V9h4.5" />
        </svg>
      ),
    },
    {
      t: 'Earn as you sell',
      d: 'Up to 80% payout',
      icon: (
        <svg
          viewBox="0 0 24 24"
          className={svg}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
  const tiles = collections.slice(0, 8);

  return (
    <Section className="bg-paper">
      <SectionHead
        eyebrow="Browse"
        title="Shop by category"
        cta={{label: 'View all', to: '/collections'}}
      />

      {tiles.length ? (
        // Real Shopify collections (with imagery) — uniform 1:1 square tiles
        // that tile cleanly as more categories are added.
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tiles.map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.handle}`}
              className="group relative aspect-square overflow-hidden rounded-3xl bg-mint-deep"
            >
              {c.image && (
                <Image
                  data={c.image}
                  sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 640px) 25vw, 33vw"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  alt={c.image.altText || c.title}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <h3 className="absolute bottom-0 left-0 p-3 text-sm font-extrabold uppercase leading-tight text-white sm:text-base">
                {c.title}
              </h3>
            </Link>
          ))}
        </div>
      ) : (
        // Fallback: branded category tiles (shown until Shopify collections
        // exist — real ones replace these automatically). Photo-first: drop
        // images in public/categories/<slug>.jpg; a branded gradient shows
        // until then (no placeholder icons).
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {SHOP_CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              to="/collections/all"
              className="group relative aspect-square overflow-hidden rounded-3xl bg-mint-deep"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-mint-deep via-brand-100 to-brand-200" />
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{
                  backgroundImage: `url(/categories/${cat.slug}.jpg?v=2)`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <h3 className="absolute bottom-0 left-0 p-3 text-sm font-extrabold uppercase leading-tight text-white sm:text-base">
                {cat.name}
              </h3>
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
    {
      n: '01',
      t: 'Snap it',
      d: 'Send a few photos of the homeware you no longer use.',
    },
    {
      n: '02',
      t: 'We sell it',
      d: 'We inspect, price, list, and ship it for you.',
    },
    {
      n: '03',
      t: 'You get paid',
      d: 'Earn up to 80% — cash out or store credit.',
    },
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
    <section className="bg-brand-700">
      <div className="ui-container flex flex-col items-center gap-5 py-16 text-center text-white md:py-24">
        <span className="eyebrow text-white/75">Buy · Sell · Consign</span>
        <h2 className="max-w-2xl text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
          First dibs on new arrivals &amp; pre-loved finds.
        </h2>
        <p className="max-w-xl text-sm text-white/85 md:text-base">
          Join the list for early access to fresh drops, newly verified
          pre-loved pieces, and restock alerts — plus tips for consigning your
          own.
        </p>
        <form
          className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            aria-label="Email address"
            className="!mt-0 !mb-0 w-full flex-1 rounded-pill !border-white/25 bg-white px-5 py-3 text-ink"
          />
          <button type="submit" className="btn btn-dark">
            Join the list
          </button>
        </form>
        <p className="text-xs text-white/80">
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
    collections(first: 8, sortKey: UPDATED_AT, reverse: true) {
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
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 8, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
