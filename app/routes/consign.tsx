import type {Route} from './+types/consign';

/**
 * Consignor signup/management lives in the ResaleOS portal — we link out to it
 * rather than collecting submissions here, so there's a single source of truth.
 *
 * The QR at `public/consignor-portal-qr.svg` encodes this same URL. If it
 * changes, regenerate the QR too:
 *   npx qrcode -o public/consignor-portal-qr.svg "<new url>"
 */
const PORTAL_REGISTER_URL =
  'https://www.resaleos.co/s/powered-by/portal/register';

/** Single source of truth for the Seller FAQ — rendered on the page and emitted
 *  as FAQPage structured data (JSON-LD) for SEO rich results. */
const FAQS = [
  {
    q: 'Does Berlin Houseware sell new homeware too?',
    a: 'Yes. Berlin Houseware is a curated marketplace for both new and verified pre-loved homeware, listed side by side. When you consign, your pieces appear right alongside our new collection — reaching buyers already shopping the store, not tucked away in a separate secondhand section.',
  },
  {
    q: 'What homeware can I consign?',
    a: 'We accept quality homeware in good, working condition — kitchen and dining, décor, lighting, glassware, ceramics, textiles, small furniture, and home accessories. Designer, vintage, and gently used everyday pieces are all welcome. Every submission is inspected and authenticated before it goes live next to our new arrivals.',
  },
  {
    q: 'Can I consign brand-new or unused items?',
    a: 'Absolutely. Many of our consignors sell new, unused, or open-box homeware — duplicate gifts, wrong-size pieces, or overstock. New and pre-loved list together, so there’s no separate process; just note the condition when you submit an item in the seller portal.',
  },
  {
    q: 'How is my item priced?',
    a: 'We price each item based on brand, condition, and current demand, benchmarked against comparable new and pre-loved listings so it sells without leaving money on the table. You can suggest an asking price in the seller portal, and we’ll confirm a fair market value before it’s listed.',
  },
  {
    q: 'Are there any fees to consign?',
    a: 'No listing fees, ever. There’s nothing to pay upfront — we only take a share once your item actually sells, and you keep up to 80% of the final sale price. Inspection, professional photography, pricing, and shipping are all included.',
  },
  {
    q: 'How long does it take to sell?',
    a: 'Most in-demand homeware sells within the first few weeks, though timing depends on category, price, and season. You can follow views and offers on every listing live in your seller dashboard, and we actively market standout pieces to the right buyers.',
  },
  {
    q: 'When and how do I get paid?',
    a: 'As soon as your item sells you can cash out to your bank or take store credit — paid fast, with no waiting on a payout cycle. Track every sale, payout, and your running balance any time in your seller dashboard.',
  },
  {
    q: 'What if my item does not sell?',
    a: 'After 60 days you can have unsold items returned to you free of charge, relist them at an adjusted price, or donate them to our sustainability partners so they stay out of landfill. The choice is always yours.',
  },
  {
    q: 'How do I get started as a consignor?',
    a: 'Create a free seller account in the consignor portal, add a few photos and details, and send your items in or drop them off. Our team reviews every submission within 48 hours — then we handle photography, pricing, listing, and shipping from there.',
  },
];

/**
 * Physical locations shown on the consignment page — inspired by the vendor
 * pages of multi-store consignors (e.g. staintons.com/become-a-vendor): sellers
 * see the real spaces (and foot traffic) their pieces reach, plus where they can
 * hand items over instead of shipping.
 *
 * ⚠️ PLACEHOLDER DATA — replace `address`, `hours`, and `mapsUrl` with the real
 * store details before this ships. Leave `mapsUrl` empty to hide the directions
 * link. Add/remove entries freely; the grid reflows.
 */
const LOCATIONS: Array<{
  name: string;
  address: string[];
  hours: string;
  dropOff?: boolean;
  mapsUrl?: string;
}> = [
  {
    name: 'Berlin Houseware',
    address: ['41 Clementon Rd', 'Berlin, NJ 08009'],
    // ⚠️ TODO: confirm real opening hours (placeholder below).
    hours: '[Add opening hours]',
    dropOff: true,
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=41+Clementon+Rd%2C+Berlin%2C+NJ+08009',
  },
];

/**
 * "Why sell with us" value props — the content adapted from a classic vendor
 * "Why Us?" grid, reworded for a new + pre-loved homeware marketplace. Rendered
 * with the site's consistent brand-check affordance (NOT a different decorative
 * icon per item — see docs/design-system.md: icons are functional-only).
 */
const WHY_US = [
  {
    t: 'Real marketing muscle',
    d: 'We photograph every piece and actively promote it to buyers already shopping the store.',
  },
  {
    t: 'Fully managed',
    d: 'Inspection, pricing, listing, and shipping — all handled for you, start to finish.',
  },
  {
    t: 'A real team behind you',
    d: 'Every submission is reviewed by our team within 48 hours — no guesswork, no bots.',
  },
  {
    t: 'Sells year-round',
    d: 'New and pre-loved list side by side, so demand never waits for a season.',
  },
  {
    t: 'A trusted name',
    d: 'Every item is inspected and authenticated before it goes live next to our new arrivals.',
  },
  {
    t: 'Effortless listing',
    d: 'Snap, submit, and track everything from one simple seller portal.',
  },
  {
    t: 'A growing community',
    d: 'Join a marketplace of sellers reaching real buyers every day.',
  },
  {
    t: 'Showcased beautifully',
    d: 'Your pieces sit right alongside our new collection — never a hidden secondhand aisle.',
  },
];

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Sell & Consign Homeware | Berlin Houseware — New & Pre-Loved'},
    {
      name: 'description',
      content:
        'Consign with Berlin Houseware, the curated marketplace for new and verified pre-loved homeware. We photograph, price, list, and ship your items to buyers shopping our new collection — earn up to 80% when they sell, with no listing fees.',
    },
    {
      name: 'keywords',
      content:
        'consign homeware, sell homeware online, homeware consignment, new and pre-loved homeware, pre-loved home décor, sell furniture, home consignment store, Berlin Houseware',
    },
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {'@type': 'Answer', text: f.a},
        })),
      },
    },
  ];
};

export default function Consign() {
  return (
    <div className="bg-paper">
      <ConsignHero />
      <WhySellWithUs />
      <HowItWorks />
      <Locations />
      <PayoutTiers />

      {/* Consignor portal CTA */}
      <section id="submit" className="bg-mint">
        <div className="ui-container grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="eyebrow text-brand-700">Start selling</span>
            <h2 className="mt-3 text-4xl font-extrabold uppercase leading-tight tracking-tight md:text-5xl">
              Create your seller account
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Consignors manage everything in our seller portal — submit items,
              track what sells, and cash out. Create an account to get started;
              our team reviews every submission within 48 hours.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                'No listing fees — ever',
                'Free inspection & fair pricing',
                'Track your sales, cash out or store credit',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 text-brand-600">
                    <svg viewBox="0 0 24 24" className="h-5 w-5">
                      <path
                        d="m5 13 4 4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <PortalCard />
        </div>
      </section>

      <Faq />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function ConsignHero() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div
        className="pointer-events-none absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-brand-600/40 blur-3xl"
        aria-hidden="true"
      />
      <div className="ui-container relative py-20 md:py-28">
        <span className="eyebrow text-brand-400">New &amp; pre-loved · Consignment</span>
        <h1 className="mt-4 max-w-3xl text-5xl font-extrabold uppercase leading-[0.95] tracking-tight md:text-7xl">
          Sell your homeware where{' '}
          <span className="text-brand-400">buyers already shop.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70">
          Berlin Houseware is the curated marketplace for new and verified
          pre-loved homeware — listed side by side. Send the pieces you no longer
          use; we photograph, price, list, and ship them to buyers browsing our
          new collection. You just get paid — up to 80% when it sells.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#submit" className="btn btn-brand">
            Start selling
          </a>
          <a href="#how" className="btn btn-ghost">
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      t: 'Snap & send',
      d: 'Create your seller account, add a few photos and details — or drop it off. That’s your part.',
    },
    {
      n: '02',
      t: 'We price & list',
      d: 'We inspect, photograph, price it fairly, and put it in front of the right buyers.',
    },
    {
      n: '03',
      t: 'It sells',
      d: 'Follow every sale live in your seller dashboard — no guesswork.',
    },
    {
      n: '04',
      t: 'Get paid',
      d: 'Cash out or take store credit — paid fast, up to 80% of the sale.',
    },
  ];
  return (
    <section id="how" className="ui-container py-16">
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow text-brand-700">The process</span>
        <h2 className="mt-3 text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
          How consignment works
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-3xl bg-mint p-6 transition-colors hover:bg-mint-deep"
          >
            <span className="text-3xl font-extrabold text-brand-600">
              {s.n}
            </span>
            <h3 className="mt-3 text-xl font-bold uppercase">{s.t}</h3>
            <p className="mt-2 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhySellWithUs() {
  return (
    <section className="bg-mint">
      <div className="ui-container py-16 md:py-24">
        <div className="mb-12 max-w-2xl">
          <span className="eyebrow text-brand-700">Why sell with us</span>
          <h2 className="mt-3 text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
            Why Berlin Houseware?
          </h2>
          <p className="mt-4 max-w-xl text-muted">
            More than a place to offload what you no longer use — a fully managed,
            year-round marketplace that puts your pieces in front of real buyers.
          </p>
        </div>

        <div className="grid border-t border-black/10 sm:grid-cols-2">
          {WHY_US.map((b, i) => (
            <div
              key={b.t}
              className="group flex gap-5 border-b border-black/10 py-7 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:pr-10 sm:even:border-l sm:even:border-black/10 sm:even:pl-10"
            >
              <span className="w-8 shrink-0 text-2xl font-extrabold leading-none tabular-nums text-brand-600/25 transition-colors duration-200 group-hover:text-brand-600">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[15px] font-bold uppercase tracking-tight text-ink">
                  {b.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Locations() {
  return (
    <section className="bg-mint">
      <div className="ui-container grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div className="max-w-xl">
          <span className="eyebrow text-brand-700">Where your pieces sell</span>
          <h2 className="mt-3 text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
            Real spaces, real foot traffic
          </h2>
          <p className="mt-4 text-muted">
            Your consigned homeware doesn’t just sit in a listing — it reaches
            buyers browsing our store in person. Prefer to hand items over rather
            than ship? Drop them off at the location on the right.
          </p>
          <p className="mt-6 text-sm text-muted">
            Not nearby?{' '}
            <a
              href="#submit"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Create a seller account
            </a>{' '}
            and ship your items in — we cover it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {LOCATIONS.map((loc) => (
            <div
              key={loc.name}
              className="flex flex-col rounded-3xl bg-paper p-6 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint text-brand-700"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                {loc.dropOff ? (
                  <span className="rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">
                    Drop-off
                  </span>
                ) : null}
              </div>

              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                {loc.name}
              </h3>

              <address className="mt-2 not-italic text-sm leading-relaxed text-muted">
                {loc.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>

              <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-brand-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {loc.hours}
              </p>

              {loc.mapsUrl ? (
                <a
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline mt-5 !py-2 text-sm"
                >
                  Get directions
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" />
                  </svg>
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PayoutTiers() {
  const tiers = [
    {price: 'Under $50', payout: '60%'},
    {price: '$50 – $150', payout: '70%'},
    {price: 'Over $150', payout: '80%'},
  ];
  return (
    <section className="ui-container pb-4">
      <div className="grid gap-4 rounded-3xl bg-brand-700 p-8 text-white md:grid-cols-3 md:p-10">
        {tiers.map((t) => (
          <div key={t.price} className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide">
              {t.price}
            </p>
            <p className="mt-1 text-5xl font-extrabold">{t.payout}</p>
            <p className="text-sm">your payout</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="bg-paper">
      <div className="ui-container grid gap-10 py-16 md:py-24 lg:grid-cols-[0.85fr_1.65fr] lg:gap-16">
        {/* Left rail — heading + intro, balances the accordion column */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <span className="eyebrow text-brand-700">Questions</span>
          <h2 className="mt-3 text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
            Seller FAQ
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            Everything you need to know about consigning your homeware with
            Berlin Houseware — what we accept, how pricing and payouts work,
            timelines, and what happens to items that don’t sell. Your pieces
            list side by side with our new collection, so they reach buyers from
            day one.
          </p>
          <a href="#submit" className="btn btn-dark mt-6 !py-2 text-sm">
            Create a seller account
          </a>
        </div>

        {/* Accordion — fills the inner width */}
        <div className="divide-y divide-black/10 border-t border-black/10">
          {FAQS.map((f) => (
            <details key={f.q} className="accordion group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-bold text-ink">
                {f.q}
                <span className="shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-180">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
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
                </span>
              </summary>
              <p className="max-w-2xl pb-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalCard() {
  return (
    <div className="flex flex-col justify-center rounded-3xl bg-paper p-8 text-center shadow-sm ring-1 ring-black/5 md:p-10">
      <span className="eyebrow text-brand-700">Consignor portal</span>
      <h3 className="mt-3 text-2xl font-extrabold uppercase tracking-tight">
        Register to consign
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
        Create your consignor account to submit items, follow every sale, and
        cash out — all in one place.
      </p>

      <a
        href={PORTAL_REGISTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-dark mx-auto mt-8"
      >
        Create seller account
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>

      <p className="mt-3 text-xs text-muted">
        Opens our seller portal in a new tab.
      </p>

      <div className="mt-8 border-t border-black/10 pt-6">
        <img
          src="/consignor-portal-qr.svg"
          alt="QR code that opens the Berlin Houseware consignor portal"
          width="144"
          height="144"
          className="mx-auto h-36 w-36 rounded-2xl ring-1 ring-black/5"
        />
        <p className="mt-3 text-xs text-muted">
          Or scan to sign up and log in from your phone
        </p>
      </div>
    </div>
  );
}

