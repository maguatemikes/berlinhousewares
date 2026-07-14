import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/account.orders._index';
import {useRef} from 'react';
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
  type OrderFilterParams,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';

type OrdersLoaderData = {
  customer: CustomerOrdersFragment;
  filters: OrderFilterParams;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  return {customer: data.customer, filters};
}

export default function Orders() {
  const {customer, filters} = useLoaderData<OrdersLoaderData>();
  const {orders} = customer;

  return (
    <div>
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

function OrdersTable({
  orders,
  filters,
}: {
  orders: CustomerOrdersFragment['orders'];
  filters: OrderFilterParams;
}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div aria-live="polite">
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders}>
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

function EmptyOrders({hasFilters = false}: {hasFilters?: boolean}) {
  return (
    <div className="py-12 text-center">
      {hasFilters ? (
        <>
          <p className="text-muted">No orders found matching your search.</p>
          <Link to="/account/orders" className="btn btn-dark mt-6">
            Clear filters
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted">You haven&apos;t placed any orders yet.</p>
          <Link to="/collections" className="btn btn-dark mt-6">
            Start shopping
          </Link>
        </>
      )}
    </div>
  );
}

function OrderSearchForm({
  currentFilters,
}: {
  currentFilters: OrderFilterParams;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mb-8 rounded-2xl border border-black/10 bg-[#f5f5f5] p-4"
      aria-label="Search orders"
    >
      <p className="eyebrow mb-3 text-brand-700">Filter orders</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={ORDER_FILTER_FIELDS.NAME}
            className="mb-1.5 block text-sm font-semibold text-ink"
          >
            Order #
          </label>
          <input
            id={ORDER_FILTER_FIELDS.NAME}
            type="search"
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder="Order #"
            aria-label="Order number"
            defaultValue={currentFilters.name || ''}
            className="w-full rounded-2xl border border-black/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            className="mb-1.5 block text-sm font-semibold text-ink"
          >
            Confirmation #
          </label>
          <input
            id={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            type="search"
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder="Confirmation #"
            aria-label="Confirmation number"
            defaultValue={currentFilters.confirmationNumber || ''}
            className="w-full rounded-2xl border border-black/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSearching}
            className="btn btn-dark !px-5 !py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching' : 'Search'}
          </button>
          {hasFilters && (
            <button
              type="button"
              disabled={isSearching}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
              className="btn btn-outline !px-5 !py-2.5 text-sm disabled:opacity-40"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-5 transition hover:border-black/25">
      <div>
        <Link
          to={`/account/orders/${btoa(order.id)}`}
          className="font-bold text-ink"
        >
          #{order.number}
        </Link>
        <p className="text-sm text-muted">
          {new Date(order.processedAt).toDateString()}
        </p>
        {order.confirmationNumber && (
          <p className="text-xs text-muted">
            Confirmation: {order.confirmationNumber}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-brand-700">
          {order.financialStatus}
        </span>
        {fulfillmentStatus && (
          <span className="inline-flex items-center rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-brand-700">
            {fulfillmentStatus}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Money data={order.totalPrice} className="font-semibold text-ink" />
        <Link
          to={`/account/orders/${btoa(order.id)}`}
          className="btn btn-outline !px-4 !py-2 text-sm"
        >
          View order
        </Link>
      </div>
    </div>
  );
}
