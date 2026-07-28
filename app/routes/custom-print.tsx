import {useState} from 'react';
import {Link, useLoaderData, useNavigate} from 'react-router';
import {CartForm, Money} from '@shopify/hydrogen';
import type {Route} from './+types/custom-print';

/**
 * Custom-print PDP — now backed by the REAL Shopify product
 * `custom-print-solid-bandana` (title, price, Color variants + per-variant
 * photos). Structure follows a print-on-demand PDP; "Start designing" opens the
 * Fabric.js studio with the chosen variant. Adding to cart there uploads the
 * design to the backend and references the real variant + design file.
 */
const HANDLE = 'custom-print-solid-bandana';

export const meta: Route.MetaFunction = ({data}) => [
  {title: `${data?.product?.title ?? 'Custom Bandana'} — Berlin Houseware`},
];

export async function loader({context}: Route.LoaderArgs) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: HANDLE},
  });
  if (!product) throw new Response('Product not found', {status: 404});
  return {product};
}

function Stars({n = 4.6}: {n?: number}) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-600">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4">
          <path
            d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z"
            fill={i + 1 <= Math.round(n) ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export default function CustomPrint() {
  const {product} = useLoaderData<typeof loader>();
  const variants = product.variants.nodes;
  const [variant, setVariant] = useState(variants[0]);
  const [printType, setPrintType] = useState<'DTG' | 'DTF'>('DTG');
  const [technique, setTechnique] = useState<'Printing' | 'Embroidery'>(
    'Printing',
  );
  const [tab, setTab] = useState<'Description' | 'Shipping' | 'Care'>(
    'Description',
  );
  const navigate = useNavigate();
  const colorName =
    variant.selectedOptions.find((o) => o.name === 'Color')?.value ??
    variant.title;
  const mainImage = variant.image?.url ?? product.images.nodes[0]?.url;

  function startDesigning() {
    navigate(`/custom-print/design?variant=${encodeURIComponent(variant.id)}`);
  }

  return (
    <div className="bg-paper">
      {/* Breadcrumb */}
      <div className="ui-container pt-6 text-sm text-muted">
        <Link to="/" className="hover:text-ink">
          Home
        </Link>{' '}
        / <span className="text-ink">Custom</span> /{' '}
        <span className="text-ink">{product.title}</span>
      </div>

      {/* Hero: gallery + configurator */}
      <div className="ui-container grid gap-10 py-8 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="flex gap-4">
          <div className="flex flex-col gap-3">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariant(v)}
                aria-label={v.title}
                className={`h-16 w-16 overflow-hidden rounded-xl bg-mint ring-1 transition ${
                  variant.id === v.id
                    ? 'ring-2 ring-ink'
                    : 'ring-black/10 hover:ring-black/30'
                }`}
              >
                {v.image?.url && (
                  <img
                    src={`${v.image.url}${v.image.url.includes('?') ? '&' : '?'}width=120`}
                    alt={v.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-hidden rounded-3xl bg-mint ring-1 ring-black/5">
            {mainImage && (
              <img
                src={`${mainImage}${mainImage.includes('?') ? '&' : '?'}width=900`}
                alt={product.title}
                className="aspect-square w-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={startDesigning}
              className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-ink"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
                <path
                  d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Design
            </button>
          </div>
        </div>

        {/* Configurator */}
        <div>
          <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-tight md:text-4xl">
            {product.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Stars n={4.6} />
            <span className="text-muted">4.6 · 128 reviews</span>
          </div>
          <div className="mt-4 text-2xl font-extrabold">
            <Money data={variant.price} as="span" />
          </div>

          {/* Technique */}
          <div className="mt-7">
            <p className="mb-2 text-sm font-semibold">Technique</p>
            <div className="inline-flex rounded-full bg-mint p-1">
              {(['Printing', 'Embroidery'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => t === 'Printing' && setTechnique(t)}
                  disabled={t === 'Embroidery'}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    technique === t
                      ? 'bg-paper text-ink shadow-sm'
                      : 'text-muted disabled:opacity-40'
                  }`}
                >
                  {t}
                  {t === 'Embroidery' && ' · soon'}
                </button>
              ))}
            </div>
          </div>

          {/* Print type */}
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">Print type</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  {id: 'DTG', label: 'DTG printing', desc: 'Soft, full-color'},
                  {id: 'DTF', label: 'DTF transfer', desc: 'Vivid, durable'},
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPrintType(o.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    printType === o.id
                      ? 'border-ink ring-1 ring-ink'
                      : 'border-black/15 hover:border-ink'
                  }`}
                >
                  <span className="block text-sm font-bold">{o.label}</span>
                  <span className="text-xs text-muted">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color (variants) */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Color</p>
              <p className="text-sm text-muted">{colorName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v)}
                  aria-label={v.title}
                  className={`h-11 w-11 overflow-hidden rounded-full ring-offset-2 transition ${
                    variant.id === v.id
                      ? 'ring-2 ring-ink'
                      : 'ring-1 ring-black/15 hover:ring-black/40'
                  }`}
                >
                  {v.image?.url && (
                    <img
                      src={`${v.image.url}${v.image.url.includes('?') ? '&' : '?'}width=80`}
                      alt={v.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={startDesigning}
            className="btn btn-dark mt-8 w-full"
          >
            Start designing
          </button>

          {/* Direct add — plain bandana, no design required */}
          <CartForm
            route="/cart"
            action={CartForm.ACTIONS.LinesAdd}
            inputs={{lines: [{merchandiseId: variant.id, quantity: 1}]}}
          >
            {(fetcher) => (
              <button
                type="submit"
                disabled={
                  !variant.availableForSale || fetcher.state !== 'idle'
                }
                className="btn btn-outline mt-3 w-full disabled:opacity-50"
              >
                {fetcher.state !== 'idle'
                  ? 'Adding…'
                  : variant.availableForSale
                    ? 'Add to cart — no design'
                    : 'Sold out'}
              </button>
            )}
          </CartForm>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Printed to order · verified quality · carbon-neutral shipping
          </p>
        </div>
      </div>

      {/* Feature strip */}
      <section className="bg-mint">
        <div className="ui-container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {t: 'Customization', items: ['Upload artwork', 'Add custom text', 'Position freely']},
            {t: 'Use it as', items: ['Headwrap', 'Neck scarf', 'Pocket square']},
            {t: 'Material', items: ['100% cotton', '55 × 55 cm', 'Lightweight']},
            {t: 'Quality', items: ['Printed to order', 'Inspected', 'Durable']},
          ].map((f) => (
            <div key={f.t}>
              <h3 className="text-sm font-bold uppercase tracking-wide">{f.t}</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {f.items.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Description tabs */}
      <section className="bg-paper">
        <div className="ui-container py-14">
          <div className="flex gap-6 border-b border-black/10">
            {(['Description', 'Shipping', 'Care'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition ${
                  tab === t
                    ? 'border-ink text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
            {tab === 'Description' && (
              <div
                dangerouslySetInnerHTML={{__html: product.descriptionHtml}}
              />
            )}
            {tab === 'Shipping' && (
              <p>
                Printed to order and shipped in 3–5 business days, carbon-neutral,
                with tracking on every order.
              </p>
            )}
            {tab === 'Care' && (
              <p>
                Machine wash cold inside-out, tumble dry low, do not iron directly
                on the print.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-mint">
        <div className="ui-container py-14">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight">
            Customer reviews
          </h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-[240px_1fr]">
            <div>
              <p className="text-5xl font-extrabold">4.6</p>
              <div className="mt-1">
                <Stars n={4.6} />
              </div>
              <p className="mt-1 text-sm text-muted">Based on 128 reviews</p>
              <div className="mt-5 space-y-2">
                {([['Print quality', 94], ['Fabric', 88], ['Value', 91]] as const).map(
                  ([label, pct]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-muted">{label}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <span
                          className="block h-full rounded-full bg-brand-500"
                          style={{width: `${pct}%`}}
                        />
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="space-y-5">
              {[
                {name: 'Alex G.', r: 5, body: 'Print is crisp and the cotton feels great. Wore it as a headwrap all summer.'},
                {name: 'Priya S.', r: 4, body: 'Loved placing my own artwork exactly where I wanted it. Colors came out vivid.'},
              ].map((rev) => (
                <div key={rev.name} className="rounded-2xl bg-paper p-5 ring-1 ring-black/5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-ink">{rev.name}</p>
                    <Stars n={rev.r} />
                  </div>
                  <p className="mt-2 text-sm text-muted">{rev.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const PRODUCT_QUERY = `#graphql
  query CustomBandana(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      descriptionHtml
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      options {
        name
        optionValues {
          name
        }
      }
      images(first: 6) {
        nodes {
          url
          altText
        }
      }
      variants(first: 20) {
        nodes {
          id
          title
          availableForSale
          image {
            url
            altText
          }
          price {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
` as const;
