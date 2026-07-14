import {type Dispatch, type SetStateAction} from 'react';
import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

export function ProductForm({
  productOptions,
  selectedVariant,
  quantity,
  setQuantity,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  quantity: number;
  setQuantity: Dispatch<SetStateAction<number>>;
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const available = Boolean(selectedVariant?.availableForSale);

  const lines = selectedVariant
    ? [{merchandiseId: selectedVariant.id, quantity, selectedVariant}]
    : [];

  return (
    <div>
      {productOptions.map((option) => {
        if (option.optionValues.length === 1) return null;

        const isColor = option.optionValues.some(
          (v) => v.swatch && (v.swatch.color || v.swatch.image),
        );

        return (
          <div className="mb-6" key={option.name}>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Select {option.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available: valueAvailable,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                const commonProps = {
                  key: option.name + name,
                  title: name,
                  'aria-label': name,
                };

                const content = isColor ? (
                  <ColorSwatch swatch={swatch} name={name} selected={selected} />
                ) : (
                  <SizeBox name={name} selected={selected} />
                );

                if (isDifferentProduct) {
                  return (
                    <Link
                      {...commonProps}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{opacity: valueAvailable ? 1 : 0.35}}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    {...commonProps}
                    type="button"
                    disabled={!exists}
                    style={{opacity: valueAvailable ? 1 : 0.35}}
                    onClick={() => {
                      if (!selected) {
                        void navigate(`?${variantUriQuery}`, {
                          replace: true,
                          preventScrollReset: true,
                        });
                      }
                    }}
                    className="disabled:cursor-not-allowed"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Quantity */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-ink">Quantity</h3>
        <div className="inline-flex items-center rounded-full border border-black/15">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-mint disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="w-10 text-center text-sm font-semibold tabular-nums">
            {String(quantity).padStart(2, '0')}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-mint"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AddToCartButton
          className="btn btn-outline w-full disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!available}
          onClick={() => open('cart')}
          lines={lines}
        >
          {available ? 'Add to cart' : 'Sold out'}
        </AddToCartButton>
        <AddToCartButton
          className="btn btn-dark w-full disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!available}
          redirectTo="checkout"
          lines={lines}
        >
          Buy it now
        </AddToCartButton>
      </div>
    </div>
  );
}

function ColorSwatch({
  swatch,
  name,
  selected,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
  selected: boolean;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-full transition ${
        selected ? 'ring-2 ring-ink ring-offset-2' : 'ring-1 ring-black/10'
      }`}
    >
      <span
        className="block h-7 w-7 overflow-hidden rounded-full bg-cover bg-center"
        style={{
          backgroundColor: color || '#e5e7eb',
          backgroundImage: image ? `url(${image})` : undefined,
        }}
      >
        <span className="sr-only">{name}</span>
      </span>
    </span>
  );
}

function SizeBox({name, selected}: {name: string; selected: boolean}) {
  return (
    <span
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
        selected
          ? 'border-ink bg-ink text-white'
          : 'border-black/15 bg-white text-ink hover:border-ink'
      }`}
    >
      {name}
    </span>
  );
}
