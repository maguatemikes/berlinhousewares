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

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Consign With Berlin Houseware — Sell Your Homeware'},
    {
      name: 'description',
      content:
        'Your clutter is someone’s find. Sell the homeware you no longer use — we photograph, price, list, and ship it. Earn up to 80%.',
    },
  ];
};

export default function Consign() {
  return (
    <div className="bg-paper">
      <ConsignHero />
      <HowItWorks />
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
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                    <svg viewBox="0 0 24 24" className="h-4 w-4">
                      <path
                        d="m5 13 4 4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
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
        <span className="eyebrow text-brand-400">Consignment</span>
        <h1 className="mt-4 max-w-3xl text-5xl font-extrabold uppercase leading-[0.95] tracking-tight md:text-7xl">
          Your clutter is <span className="text-brand-400">someone&apos;s find.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70">
          Sell the homeware you no longer use. Snap a photo — we photograph,
          price, list, and ship it. You just get paid. Earn up to 80% when it
          sells.
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
  const faqs = [
    {
      q: 'What can I consign?',
      a: 'Quality homeware in good condition — kitchen and dining, décor, lighting, glassware, small furniture, and home accessories. Everything is inspected before listing.',
    },
    {
      q: 'How is my item priced?',
      a: 'We price based on brand, condition, and current demand. You can suggest an asking price when you submit an item in the seller portal.',
    },
    {
      q: 'When and how do I get paid?',
      a: 'Once your item sells, cash out or take store credit — paid fast. You can track every sale and your balance in your seller dashboard.',
    },
    {
      q: 'What if my item does not sell?',
      a: 'After 60 days you can have it returned free of charge or donate it to our sustainability partners.',
    },
  ];
  return (
    <section className="ui-container py-16">
      <h2 className="mb-8 text-3xl font-extrabold uppercase tracking-tight md:text-4xl">
        Seller FAQ
      </h2>
      <div className="mx-auto max-w-3xl divide-y divide-black/10">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
              {f.q}
              <span className="text-brand-600 transition-transform group-open:rotate-45">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-muted">{f.a}</p>
          </details>
        ))}
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

