import {useEffect, useState} from 'react';
import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/sellers._index';
import {getSellerDirectory} from '~/lib/sellers.server';

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Sellers — Berlin Houseware'},
    {
      name: 'description',
      content:
        'Browse the consignors selling on Berlin Houseware — each with their own store.',
    },
  ];
};

export async function loader({context}: Route.LoaderArgs) {
  const sellers = await getSellerDirectory(context.storefront);
  return {sellers};
}

export default function SellersIndex() {
  const {sellers} = useLoaderData<typeof loader>();

  return (
    <div className="bg-paper">
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

      <div className="ui-container py-16 md:py-24">
        {sellers.length === 0 ? (
          <div className="rounded-3xl bg-mint px-6 py-16 text-center">
            <p className="text-lg font-bold text-ink">No sellers yet</p>
            <p className="mt-1 text-sm text-muted">
              Sellers appear here once their products are listed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sellers.map((s) => (
              <Link
                key={s.handle}
                to={`/sellers/${s.handle}`}
                prefetch="intent"
                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-ink"
              >
                {/* Product showcase: auto-rotating slideshow of the seller's
                    pieces (crossfade + slide dots), branded tile fallback */}
                <CardSlideshow
                  images={s.previewImages}
                  name={s.name}
                  initial={s.initial}
                />

                {/* Soft scrim for depth; the glass panel carries readability */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                  aria-hidden="true"
                />

                {/* Overlaid content on a blended frosted strip — edge-to-edge,
                    tint + blur fade out toward the top so there's no hard seam */}
                <div className="absolute inset-x-0 bottom-0">
                  {/* Glass layer kept CHILDLESS — the blur+fade mask must never
                      apply to the text, which renders sharp on top */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/30 to-black/5 backdrop-blur-xl [mask-image:linear-gradient(to_top,black_70%,transparent)]"
                    aria-hidden="true"
                  />
                  <div className="relative p-5 pt-8">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-lg font-extrabold uppercase tracking-tight text-white">
                      {s.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {s.productCount} {s.productCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-sm text-white/75">
                    {s.bio ||
                      'Verified pre-loved pieces, inspected and authenticated by Berlin Houseware.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3"
                          aria-hidden="true"
                        >
                          <path
                            d="m5 13 4 4L19 7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Verified
                      </span>
                    )}
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      Consignor
                    </span>
                  </div>

                    <span className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-ink transition-colors group-hover:bg-brand-700 group-hover:text-white">
                      Visit store
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
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
