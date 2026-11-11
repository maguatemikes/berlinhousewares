import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/policies.$handle';
import {type Shop} from '@shopify/hydrogen/storefront-api-types';

type SelectedPolicies = keyof Pick<
  Shop,
  'privacyPolicy' | 'shippingPolicy' | 'termsOfService' | 'refundPolicy'
>;

export const meta: Route.MetaFunction = ({data}) => {
  const title = data?.policy.title ?? 'Policy';
  return [{title: `${title} — Berlin Houseware`}];
};

export async function loader({params, context}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Response('No handle was passed in', {status: 404});
  }

  const policyName = params.handle.replace(
    /-([a-z])/g,
    (_: unknown, m1: string) => m1.toUpperCase(),
  ) as SelectedPolicies;

  const data = await context.storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyName];

  if (!policy) {
    throw new Response('Could not find the policy', {status: 404});
  }

  return {policy};
}

export default function Policy() {
  const {policy} = useLoaderData<typeof loader>();

  return (
    <div className="bg-paper">
      {/* Header band */}
      <section className="bg-mint">
        <div className="ui-container py-12 md:py-16">
          <Link
            to="/policies"
            className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            ← Back to policies
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
            {policy.title}
          </h1>
        </div>
      </section>

      {/* Body — Shopify policy HTML, styled to the site's prose scale */}
      <div className="ui-container py-12 md:py-16">
        <div
          className="max-w-2xl text-ink [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:tracking-tight [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_li]:leading-relaxed [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_ol]:text-muted [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ul]:text-muted"
          dangerouslySetInnerHTML={{__html: policy.body}}
        />
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Shop
const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
    }
  }
` as const;
