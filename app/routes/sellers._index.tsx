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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map((s) => (
              <Link
                key={s.handle}
                to={`/sellers/${s.handle}`}
                prefetch="intent"
                className="group flex flex-col overflow-hidden rounded-3xl bg-mint ring-1 ring-black/5 transition-colors hover:bg-mint-deep"
              >
                {/* Preview strip */}
                <div className="grid grid-cols-3 gap-px bg-black/5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square overflow-hidden bg-mint">
                      {s.previewImages[i] ? (
                        <img
                          src={s.previewImages[i].url}
                          alt={s.previewImages[i].altText || ''}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 p-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-lg font-extrabold text-white">
                    {s.initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{s.name}</p>
                    <p className="text-sm text-muted">
                      {s.productCount}{' '}
                      {s.productCount === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                  <span className="ml-auto text-brand-700 transition-transform group-hover:translate-x-0.5">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
