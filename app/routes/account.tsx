import {
  data as remixData,
  Outlet,
  useLoaderData,
  useNavigation,
  type ShouldRevalidateFunction,
} from 'react-router';
import type {Route} from './+types/account';
import type {CustomerFragment} from 'customer-accountapi.generated';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {getCached, setCached} from '~/lib/accountCache';
import {AccountSkeleton} from '~/components/AccountUI';

// Reuse the already-loaded customer profile on plain navigations; only re-fetch
// it after a mutation (address / profile change). This removes one uncached
// Customer Account API round-trip per navigation, so the account section feels
// snappy instead of waiting on the customer query every time.
export const shouldRevalidate: ShouldRevalidateFunction = ({formMethod}) =>
  Boolean(formMethod && formMethod !== 'GET');

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

type AccountLoaderData = {customer: CustomerFragment};

// Client-side read-through cache over the slow, uncacheable customer query.
// A cache hit paints the account section instantly instead of waiting on a
// Customer Account API round-trip; a miss falls through to the server loader
// and seeds the cache. `hydrate = true` makes this run on first load too, where
// `serverLoader()` returns the SSR data (no extra request) and seeds the cache.
// The cache is invalidated on logout and after any profile/address mutation
// (see clientAction in those routes), so edits never show stale data.
export async function clientLoader({serverLoader}: Route.ClientLoaderArgs) {
  const cached = getCached<AccountLoaderData>('customer');
  if (cached) return cached;
  const fresh = (await serverLoader()) as AccountLoaderData;
  return setCached('customer', fresh);
}
clientLoader.hydrate = true as const;

/**
 * Account layout — a full-width shell for the consolidated overview dashboard
 * (orders + account details + saved addresses live on one page; see
 * account.orders._index). The customer profile is shared with child routes via
 * Outlet context. Order detail / profile / address routes render here too.
 */
export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  // Show a skeleton while a route's loader is fetching (a link/GET navigation to
  // an /account route) — not for form submits, which have their own button
  // pending states. Gives navigation instant feedback instead of a dead beat.
  const isTabLoading =
    navigation.state === 'loading' &&
    navigation.formMethod == null &&
    (navigation.location?.pathname?.startsWith('/account') ?? false);

  return (
    <section className="bg-[#f2f5f1]">
      <div className="ui-container py-8 md:py-10">
        <main
          className="mx-auto min-w-0 max-w-[1180px]"
          aria-busy={isTabLoading}
        >
          {isTabLoading ? (
            <AccountSkeleton />
          ) : (
            <Outlet context={{customer}} />
          )}
        </main>
      </div>
    </section>
  );
}
