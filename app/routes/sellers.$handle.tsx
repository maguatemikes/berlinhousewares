import {useState} from 'react';
import {Link, useLoaderData, useSearchParams} from 'react-router';
import type {Route} from './+types/sellers.$handle';
import {ProductItem} from '~/components/ProductItem';
import {getSeller, type SellerSort} from '~/lib/sellers.server';

export const meta: Route.MetaFunction = ({data}) => {
  const name = data?.seller?.name;
  return [
    {title: name ? `${name} — Berlin Houseware` : 'Seller — Berlin Houseware'},
    {
      name: 'description',
      content: name
        ? `Shop ${name}'s store on Berlin Houseware — ${data?.seller?.productCount} products.`
        : 'Seller store on Berlin Houseware.',
    },
  ];
}

export async function loader({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  if (!handle) {
    throw new Response('Not found', {status: 404});
  }

  const sort = (new URL(request.url).searchParams.get('sort') ||
    'default') as SellerSort;

  const seller = await getSeller(context.storefront, handle, sort);
  if (!seller) {
    throw new Response(`Seller ${handle} not found`, {status: 404});
  }

  return {seller};
}

const TABS = ['Products', 'About', 'Policies'] as const;
type Tab = (typeof TABS)[number];

export default function SellerStore() {
  const {seller} = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<Tab>('Products');

  return (
    <div className="bg-paper">
      {/* Banner strip */}
      <div className="h-32 w-full bg-ink md:h-40" aria-hidden="true" />

      <div className="ui-container">
        {/* Seller identity card — pulled up over the banner */}
        <div className="-mt-16 rounded-3xl bg-paper p-6 shadow-sm ring-1 ring-black/5 md:-mt-20 md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-ink text-3xl font-extrabold text-white md:h-24 md:w-24">
              {seller.initial}
            </span>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
                {seller.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {seller.productCount}{' '}
                  {seller.productCount === 1 ? 'product' : 'products'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-brand-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  Verified consignor
                </span>
              </div>
            </div>

            <div className="flex gap-2 sm:ml-auto">
              <Link to="/sellers" className="btn btn-outline !px-4 !py-2 text-sm">
                All sellers
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-2xl bg-mint p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t === 'Products' ? `Products (${seller.productCount})` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="ui-container py-10 md:py-14">
        {tab === 'Products' && <ProductsTab seller={seller} />}
        {tab === 'About' && <AboutTab name={seller.name} />}
        {tab === 'Policies' && <PoliciesTab />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function ProductsTab({
  seller,
}: {
  seller: Awaited<ReturnType<typeof getSeller>>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  if (!seller) return null;

  const sort = searchParams.get('sort') || 'default';
  const products = q
    ? seller.products.filter((p) =>
        p.title.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : seller.products;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="m20 20-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            aria-label="Search this seller's products"
            className="!mt-0 !mb-0 w-full rounded-full !border-black/15 bg-white py-2.5 pl-11 pr-4 text-sm text-ink outline-none focus:!border-brand-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Sort by</span>
          <select
            value={sort}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value === 'default') next.delete('sort');
              else next.set('sort', e.target.value);
              setSearchParams(next, {preventScrollReset: true});
            }}
            className="!mt-0 !mb-0 rounded-full !border-black/15 bg-white py-2.5 pl-4 pr-8 text-sm font-medium text-ink outline-none focus:!border-brand-500"
          >
            <option value="default">Default</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl bg-mint px-6 py-16 text-center">
          <p className="text-lg font-bold text-ink">No products found</p>
          <p className="mt-1 text-sm text-muted">
            {q ? 'Try a different search.' : 'This seller has no products yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, i) => (
            <ProductItem
              key={product.id}
              // SellerProduct is structurally a Shopify product card; cast to the
              // component's prop union (same fields it reads at runtime).
              product={product as Parameters<typeof ProductItem>[0]['product']}
              loading={i < 8 ? 'eager' : 'lazy'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AboutTab({name}: {name: string}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-extrabold uppercase tracking-tight">
        About {name}
      </h2>
      <p className="mt-4 text-muted">
        {name} is a verified consignor on Berlin Houseware. Every item is
        inspected and authenticated before it&apos;s listed.
      </p>
      <p className="mt-3 text-sm text-muted">
        Seller profiles (bio, logo, member since) will appear here once sellers
        complete their portal profile.
      </p>
    </div>
  );
}

function PoliciesTab() {
  const policies = [
    {
      t: 'Shipping',
      d: 'Items ship within 2 business days. Tracking is provided on every order.',
    },
    {
      t: 'Returns',
      d: 'Returns accepted within 14 days if the item is not as described.',
    },
    {
      t: 'Authenticity',
      d: 'Every piece is inspected and authenticated by Berlin Houseware before listing.',
    },
  ];
  return (
    <div className="mx-auto max-w-2xl divide-y divide-black/10">
      {policies.map((p) => (
        <div key={p.t} className="py-5">
          <h3 className="text-lg font-bold uppercase tracking-tight">{p.t}</h3>
          <p className="mt-2 text-muted">{p.d}</p>
        </div>
      ))}
    </div>
  );
}
