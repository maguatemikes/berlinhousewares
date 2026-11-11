import {useLoaderData, Link} from 'react-router';
import type {Route} from './+types/policies._index';
import type {PoliciesQuery, PolicyItemFragment} from 'storefrontapi.generated';

export async function loader({context}: Route.LoaderArgs) {
  const data: PoliciesQuery = await context.storefront.query(POLICIES_QUERY);

  const shopPolicies = data.shop;
  const policies: PolicyItemFragment[] = [
    shopPolicies?.privacyPolicy,
    shopPolicies?.shippingPolicy,
    shopPolicies?.termsOfService,
    shopPolicies?.refundPolicy,
    shopPolicies?.subscriptionPolicy,
  ].filter((policy): policy is PolicyItemFragment => policy != null);

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export const meta: Route.MetaFunction = () => [
  {title: 'Policies — Berlin Houseware'},
];

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();

  return (
    <div className="bg-paper">
      {/* Header band */}
      <section className="bg-mint">
        <div className="ui-container py-12 md:py-16">
          <span className="eyebrow text-brand-700">Legal</span>
          <h1 className="mt-3 text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
            Policies
          </h1>
        </div>
      </section>

      {/* List */}
      <div className="ui-container py-12 md:py-16">
        <ul className="max-w-2xl divide-y divide-black/10 border-t border-black/10">
          {policies.map((policy) => (
            <li key={policy.id}>
              <Link
                to={`/policies/${policy.handle}`}
                prefetch="intent"
                className="flex items-center justify-between gap-4 py-5 text-lg font-bold text-ink transition-colors hover:text-brand-700"
              >
                {policy.title}
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="m9 6 6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
` as const;
