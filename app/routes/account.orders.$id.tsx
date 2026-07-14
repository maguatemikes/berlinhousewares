import {Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/account.orders.$id';
import {Money, Image} from '@shopify/hydrogen';
import type {
  OrderLineItemFullFragment,
  OrderQuery,
} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

export async function loader({params, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const {data, errors}: {data: OrderQuery; errors?: Array<{message: string}>} =
    await customerAccount.query(CUSTOMER_ORDER_QUERY, {
      variables: {
        orderId,
        language: customerAccount.i18n.language,
      },
    });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2'
      ? (firstDiscount as Extract<
          typeof firstDiscount,
          {__typename: 'MoneyV2'}
        >)
      : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? (
          firstDiscount as Extract<
            typeof firstDiscount,
            {__typename: 'PricingPercentageValue'}
          >
        ).percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData<typeof loader>();
  const hasDiscount = !!((discountValue && discountValue.amount) ||
    discountPercentage);

  return (
    <div>
      <Link
        to="/account/orders"
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        ← Back to orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">Order {order.name}</h2>
        <span className="inline-flex items-center rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-brand-700">
          {fulfillmentStatus}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Placed on {new Date(order.processedAt!).toDateString()}
      </p>
      {order.confirmationNumber && (
        <p className="text-sm text-muted">
          Confirmation: {order.confirmationNumber}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="divide-y divide-black/10 rounded-2xl border border-black/10">
            {lineItems.map((lineItem, lineItemIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="rounded-2xl border border-black/10 p-5">
            {hasDiscount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Discounts</span>
                <span className="font-semibold text-brand-700">
                  {discountPercentage ? (
                    <span>-{discountPercentage}% OFF</span>
                  ) : (
                    discountValue && <Money data={discountValue!} />
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <Money data={order.subtotal!} />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Tax</span>
              <Money data={order.totalTax!} />
            </div>
            <div className="mt-2 flex justify-between border-t border-black/10 pt-3 text-base font-bold text-ink">
              <span>Total</span>
              <Money data={order.totalPrice!} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Shipping Address
            </h3>
            {order?.shippingAddress ? (
              <address className="text-sm not-italic text-muted">
                <p>{order.shippingAddress.name}</p>
                {order.shippingAddress.formatted ? (
                  <p>{order.shippingAddress.formatted}</p>
                ) : (
                  ''
                )}
                {order.shippingAddress.formattedArea ? (
                  <p>{order.shippingAddress.formattedArea}</p>
                ) : (
                  ''
                )}
              </address>
            ) : (
              <p className="text-sm text-muted">No shipping address defined</p>
            )}
          </div>

          <a
            target="_blank"
            href={order.statusPageUrl}
            rel="noreferrer"
            className="btn btn-dark !px-5 !py-2.5 text-sm"
          >
            View Order Status →
          </a>
        </div>
      </div>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  return (
    <div
      key={lineItem.id}
      className="flex items-center justify-between gap-4 p-4"
    >
      <div className="flex min-w-0 items-center gap-4">
        {lineItem?.image && (
          <Image
            data={lineItem.image}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-xl bg-mint object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-ink">{lineItem.title}</p>
          {lineItem.variantTitle && (
            <p className="text-sm text-muted">{lineItem.variantTitle}</p>
          )}
          <p className="text-sm text-muted">Qty {lineItem.quantity}</p>
        </div>
      </div>
      <div className="shrink-0 font-semibold text-ink">
        <Money data={lineItem.price!} />
      </div>
    </div>
  );
}
