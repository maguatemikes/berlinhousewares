import {Form, useActionData, useNavigation} from 'react-router';
import type {Route} from './+types/consign';

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

type ActionResponse = {
  ok: boolean;
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

export async function action({request}: Route.ActionArgs) {
  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? '').trim();

  const values = {
    name: get('name'),
    email: get('email'),
    category: get('category'),
    brand: get('brand'),
    itemTitle: get('itemTitle'),
    condition: get('condition'),
    price: get('price'),
    description: get('description'),
  };

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = 'Please tell us your name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email))
    errors.email = 'Enter a valid email address.';
  if (!values.itemTitle) errors.itemTitle = 'What are you selling?';
  if (!values.category) errors.category = 'Pick a category.';
  if (!values.condition) errors.condition = 'Select the condition.';
  if (values.price && Number.isNaN(Number(values.price)))
    errors.price = 'Price must be a number.';

  if (Object.keys(errors).length) {
    return {ok: false, errors, values} satisfies ActionResponse;
  }

  // In production this would create a Shopify metaobject / draft submission
  // or hand off to a consignment app. Here we accept and confirm the request.
  return {ok: true} satisfies ActionResponse;
}

export default function Consign() {
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state !== 'idle';
  const errors: Record<string, string> = data?.errors ?? {};
  const values: Record<string, string> = data?.values ?? {};

  return (
    <div className="bg-paper">
      <ConsignHero />
      <HowItWorks />
      <PayoutTiers />

      {/* Submission form */}
      <section id="submit" className="bg-mint py-16">
        <div className="ui-container grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="eyebrow text-brand-700">Start selling</span>
            <h2 className="mt-3 text-4xl font-extrabold uppercase leading-tight tracking-tight md:text-5xl">
              Submit an item
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Tell us what you&apos;ve got. Our team reviews every submission
              within 48 hours and sends a prepaid shipping label once approved.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                'No listing fees — ever',
                'Free inspection & fair pricing',
                'Track your sales, cash out or store credit',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500 text-[#06210f]">
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

          <div className="rounded-3xl bg-paper p-6 shadow-sm ring-1 ring-black/5 md:p-8">
            {data?.ok ? (
              <SuccessCard />
            ) : (
              <Form method="post" className="!max-w-none space-y-4" replace>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    name="name"
                    defaultValue={values.name}
                    error={errors.name}
                    placeholder="Alex Green"
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    defaultValue={values.email}
                    error={errors.email}
                    placeholder="you@email.com"
                  />
                </div>
                <Field
                  label="Item title"
                  name="itemTitle"
                  defaultValue={values.itemTitle}
                  error={errors.itemTitle}
                  placeholder="Stoneware dinner set — 12 piece"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Category"
                    name="category"
                    defaultValue={values.category}
                    error={errors.category}
                    options={[
                      'Kitchen & Dining',
                      'Décor',
                      'Lighting',
                      'Glassware & Ceramics',
                      'Small Furniture',
                      'Home Accessories',
                    ]}
                  />
                  <Field
                    label="Brand"
                    name="brand"
                    defaultValue={values.brand}
                    placeholder="e.g. HAY, IKEA, vintage"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Condition"
                    name="condition"
                    defaultValue={values.condition}
                    error={errors.condition}
                    options={[
                      'New with tags',
                      'Like new',
                      'Gently used',
                      'Well loved',
                    ]}
                  />
                  <Field
                    label="Asking price (USD)"
                    name="price"
                    type="text"
                    inputMode="decimal"
                    defaultValue={values.price}
                    error={errors.price}
                    placeholder="120"
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="mb-1 block text-sm font-semibold text-ink"
                  >
                    Description{' '}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    defaultValue={values.description}
                    placeholder="Size, colorway, flaws, story…"
                    className="!mt-0 !mb-0 w-full rounded-2xl !border-black/15 bg-white px-4 py-3 text-sm text-ink outline-none focus:!border-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-dark w-full disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit for review'}
                </button>
                <p className="text-center text-xs text-muted">
                  By submitting you agree to Berlin Houseware&apos;s consignment
                  terms.
                </p>
              </Form>
            )}
          </div>
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
      d: 'Send a few photos and details — or drop it off. That’s your part.',
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
      <div className="grid gap-4 rounded-3xl bg-brand-500 p-8 text-[#06210f] md:grid-cols-3 md:p-10">
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
      a: 'We price based on brand, condition, and current demand. You can suggest an asking price on the form.',
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

function SuccessCard() {
  return (
    <div className="grid place-items-center gap-4 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-500 text-[#06210f]">
        <svg viewBox="0 0 24 24" className="h-8 w-8">
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
      <h3 className="text-2xl font-extrabold uppercase">Submission received</h3>
      <p className="max-w-sm text-muted">
        Thanks! Our team will review your item and email you within 48 hours
        with next steps and a prepaid shipping label.
      </p>
      <a href="/collections" className="btn btn-outline mt-2">
        Keep shopping
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                 */
/* -------------------------------------------------------------------------- */
function Field({
  label,
  name,
  error,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: 'decimal' | 'text';
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={`!mt-0 !mb-0 w-full rounded-2xl bg-white px-4 py-3 text-sm text-ink outline-none focus:!border-brand-500 ${
          error ? '!border-red-500' : '!border-black/15'
        }`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  name,
  error,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  error?: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue || ''}
        className={`!mt-0 !mb-0 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-ink outline-none focus:!border-brand-500 ${
          error ? '!border-red-500' : '!border-black/15'
        }`}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
