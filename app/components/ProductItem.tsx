import {Link} from 'react-router';
import {
  Image,
  Money,
  CartForm,
  type OptimisticCartLineInput,
} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  ShopProductFragment,
  RecommendedProductFragment,
  RelatedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {sellerHandle} from '~/lib/sellers';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';
import {
  useCartLine,
  useCartIsEmpty,
  type CartLineRef,
} from '~/components/CartLinesContext';

/**
 * Extra fields present only on the filter-page fragments (collection / shop):
 * a variant to add to cart, and the product's seller (for the "View store"
 * button). Cards fed by other fragments simply omit the action row.
 */
type CardExtras = {
  selectedOrFirstAvailableVariant?: {
    id: string;
    availableForSale: boolean;
  } | null;
  seller?: {
    reference?: {
      handle?: string | null;
      slug?: {value?: string | null} | null;
    } | null;
  } | null;
};

export function ProductItem({
  product,
  loading,
}: {
  product:
    | ShopProductFragment
    | ProductItemFragment
    | RecommendedProductFragment
    | RelatedProductFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;

  const extras = product as typeof product & CardExtras;
  const variant = extras.selectedOrFirstAvailableVariant ?? null;

  // Pass a selectedVariant on add so useOptimisticCart creates the optimistic
  // line immediately (it SKIPS the add without it) — the card morphs instantly,
  // without waiting on the cart drawer to resolve. Carries display fields so the
  // drawer's optimistic line looks right too.
  const optimisticVariant = variant
    ? ({
        id: variant.id,
        availableForSale: variant.availableForSale,
        image: image ?? undefined,
        price: product.priceRange.minVariantPrice,
        title: '',
        selectedOptions: [],
        product: {title: product.title, handle: product.handle},
      } as unknown as OptimisticCartLineInput['selectedVariant'])
    : null;

  const sellerSlug =
    extras.seller?.reference?.slug?.value ||
    extras.seller?.reference?.handle ||
    null;
  const storeHref = sellerSlug ? `/sellers/${sellerHandle(sellerSlug)}` : null;

  return (
    <div className="group relative block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-mint">
        {image ? (
          <Image
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 50vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-brand-600">
            <span className="text-sm font-bold lowercase">berlinhouseware</span>
          </div>
        )}

        {/* Wishlist */}
        <span className="absolute right-3 top-3 z-[2] grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow transition-opacity duration-200 group-hover:opacity-100">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className="mt-3 px-1">
        <h4 className="text-sm font-bold leading-snug text-ink">
          {product.title}
        </h4>
        <p className="text-xs text-muted">
          {product.vendor || 'Berlin Houseware'}
        </p>
        <div className="mt-1 text-sm font-bold text-brand-700">
          <Money data={product.priceRange.minVariantPrice} />
        </div>
      </div>

      {/* Whole-card link to the PDP — stretched beneath the action row, which
          sits above it (z-2) so its buttons capture their own clicks. */}
      <Link
        to={variantUrl}
        prefetch="intent"
        aria-label={product.title}
        className="absolute inset-0 z-[1]"
      />

      {variant ? (
        <div className="relative z-[2] mt-3 flex items-center gap-2 px-1">
          <CardCartControl
            variantId={variant.id}
            available={variant.availableForSale}
            selectedVariant={optimisticVariant}
          />
          {storeHref ? (
            <Link
              to={storeHref}
              prefetch="intent"
              aria-label="View store"
              className="grid aspect-square h-9 w-9 shrink-0 place-items-center rounded-2xl border border-black/15 text-ink transition-colors hover:border-black/30 hover:bg-mint"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 9h16M5 9l1-4h12l1 4M5 9v11h14V9M9 20v-6h6v6" />
              </svg>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Add-to-cart that morphs into a quantity stepper once the item is in cart. */
function CardCartControl({
  variantId,
  available,
  selectedVariant,
}: {
  variantId: string;
  available: boolean;
  selectedVariant: OptimisticCartLineInput['selectedVariant'] | null;
}) {
  const {open} = useAside();
  const cartIsEmpty = useCartIsEmpty();
  const line = useCartLine(variantId);
  if (line) return <CardQuantity line={line} />;
  if (!available) {
    return (
      <span className="flex h-9 flex-1 cursor-not-allowed items-center justify-center rounded-2xl border border-black/15 text-xs font-semibold text-muted">
        Sold out
      </span>
    );
  }
  return (
    <div className="morph-in flex-1">
      <AddToCartButton
        lines={[
          {merchandiseId: variantId, quantity: 1, selectedVariant},
        ]}
        onClick={() => {
          // Only slide the drawer in on the first add (when the cart is empty);
          // subsequent adds just morph the card without popping the drawer.
          if (cartIsEmpty) open('cart');
        }}
        className="btn bg-coral text-white hover:bg-coral-dark h-9 w-full !py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add to cart
      </AddToCartButton>
    </div>
  );
}

/** Inline qty stepper: trash (at 1) / minus · qty · plus — drives the cart line. */
function CardQuantity({line}: {line: CartLineRef}) {
  const {id, quantity, isOptimistic} = line;
  const key = `card-qty-${id}`;
  return (
    <div className="morph-in flex h-9 flex-1 items-center justify-between rounded-2xl border border-black/15 px-1">
      {quantity <= 1 ? (
        <CartForm
          route="/cart"
          action={CartForm.ACTIONS.LinesRemove}
          inputs={{lineIds: [id]}}
          fetcherKey={key}
        >
          <button
            type="submit"
            disabled={isOptimistic}
            aria-label="Remove from cart"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
            </svg>
          </button>
        </CartForm>
      ) : (
        <CartForm
          route="/cart"
          action={CartForm.ACTIONS.LinesUpdate}
          inputs={{lines: [{id, quantity: quantity - 1}]}}
          fetcherKey={key}
        >
          <button
            type="submit"
            disabled={isOptimistic}
            aria-label="Decrease quantity"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-mint disabled:cursor-wait disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </CartForm>
      )}
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums text-ink">
        {quantity}
      </span>
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.LinesUpdate}
        inputs={{lines: [{id, quantity: quantity + 1}]}}
        fetcherKey={key}
      >
        <button
          type="submit"
          disabled={isOptimistic}
          aria-label="Increase quantity"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-mint disabled:cursor-wait disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </CartForm>
    </div>
  );
}
