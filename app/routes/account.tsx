import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <section className="bg-paper">
      <div className="ui-container py-12 md:py-16">
        <p className="eyebrow text-brand-700">My Account</p>
        <h1 className="mt-1 text-3xl font-extrabold uppercase tracking-tight text-ink md:text-4xl">
          {heading}
        </h1>
        <AccountMenu />
        <div className="mt-8">
          <Outlet context={{customer}} />
        </div>
      </div>
    </section>
  );
}

function AccountMenu() {
  const tab = ({isActive}: {isActive: boolean}) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-ink text-white'
        : 'bg-[#f5f5f5] text-ink hover:bg-mint'
    }`;

  return (
    <nav
      role="navigation"
      className="mt-6 flex flex-wrap items-center gap-2 border-b border-black/10 pb-6"
    >
      <NavLink to="/account/orders" className={tab}>
        Orders
      </NavLink>
      <NavLink to="/account/profile" className={tab}>
        Profile
      </NavLink>
      <NavLink to="/account/addresses" className={tab}>
        Addresses
      </NavLink>
      <span className="ml-auto">
        <Logout />
      </span>
    </nav>
  );
}

function Logout() {
  return (
    <Form method="POST" action="/account/logout">
      <button type="submit" className="btn btn-outline !px-4 !py-2 text-sm">
        Sign out
      </button>
    </Form>
  );
}
