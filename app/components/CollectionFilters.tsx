import {useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router';

/** A facet returned by the Storefront API (`productFilters` / `filters`). */
export type Facet = {
  id: string;
  label: string;
  type: string; // 'LIST' | 'PRICE_RANGE' | 'BOOLEAN'
  values: Array<{
    id: string;
    label: string;
    count: number;
    input: string; // JSON string, e.g. {"available":true}
  }>;
};

/** Shared helpers for reading/writing filter state in the URL. */
function useFilterState() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeInputs = searchParams.getAll('filter');

  function commit(mutate: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(searchParams);
    mutate(p);
    // reset pagination whenever filters/sort change
    ['cursor', 'startCursor', 'endCursor', 'direction'].forEach((k) =>
      p.delete(k),
    );
    navigate(`?${p.toString()}`, {preventScrollReset: true});
  }

  return {searchParams, activeInputs, commit};
}

/* -------------------------------------------------------------------------- */
/* Filter panel (sidebar or drawer body)                                       */
/* -------------------------------------------------------------------------- */
export function CollectionFilters({facets}: {facets: Facet[]}) {
  const {searchParams, activeInputs, commit} = useFilterState();

  const toggle = (input: string) =>
    commit((p) => {
      const current = p.getAll('filter');
      p.delete('filter');
      const next = current.includes(input)
        ? current.filter((c) => c !== input)
        : [...current, input];
      next.forEach((v) => p.append('filter', v));
    });

  const setPrice = (min: string, max: string) =>
    commit((p) => {
      min ? p.set('minPrice', min) : p.delete('minPrice');
      max ? p.set('maxPrice', max) : p.delete('maxPrice');
    });

  return (
    <div className="border-t border-black/10">
      {facets.map((facet) => {
        if (facet.type === 'PRICE_RANGE') {
          return (
            <FilterSection key={facet.id} label="Price">
              <PriceBody
                min={searchParams.get('minPrice') ?? ''}
                max={searchParams.get('maxPrice') ?? ''}
                onApply={setPrice}
              />
            </FilterSection>
          );
        }
        const values = facet.values.filter(
          (v) => v.count > 0 || activeInputs.includes(v.input),
        );
        if (!values.length) return null;
        return (
          <FilterSection key={facet.id} label={facet.label}>
            <div className="space-y-2">
              {values.map((v) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={activeInputs.includes(v.input)}
                    onChange={() => toggle(v.input)}
                    className="!m-0 h-4 w-4 shrink-0 rounded !border-black/25 accent-brand-600"
                  />
                  <span className="flex-1 text-ink">{v.label}</span>
                  <span className="text-xs text-muted">{v.count}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        );
      })}
    </div>
  );
}

/** Collapsible filter group with a +/− toggle (Macy's-style). */
function FilterSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group border-b border-black/10"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-bold uppercase tracking-wide text-ink">
        {label}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        >
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

function PriceBody({
  min,
  max,
  onApply,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Min"
          value={lo}
          onChange={(e) => setLo(e.target.value)}
          className="!m-0 w-full rounded-xl !border-black/15 bg-white px-3 py-2 text-sm text-ink focus:!border-brand-500"
        />
        <span className="text-muted">–</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Max"
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          className="!m-0 w-full rounded-xl !border-black/15 bg-white px-3 py-2 text-sm text-ink focus:!border-brand-500"
        />
      </div>
      <button
        type="button"
        onClick={() => onApply(lo, hi)}
        className="btn btn-outline mt-3 w-full !py-2 text-sm"
      >
        Apply
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sort menu                                                                   */
/* -------------------------------------------------------------------------- */
export const SORT_OPTIONS = [
  {value: '', label: 'Featured'},
  {value: 'price-asc', label: 'Price: Low to High'},
  {value: 'price-desc', label: 'Price: High to Low'},
];

export function SortMenu() {
  const {searchParams, commit} = useFilterState();
  const value = searchParams.get('sort') ?? '';
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">Sort</span>
      <select
        value={value}
        onChange={(e) =>
          commit((p) =>
            e.target.value ? p.set('sort', e.target.value) : p.delete('sort'),
          )
        }
        className="!m-0 rounded-full !border-black/15 bg-white py-2 pl-4 pr-8 text-sm font-semibold text-ink focus:!border-brand-500"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Active filter chips + clear all                                             */
/* -------------------------------------------------------------------------- */
export function ActiveFilterChips({facets}: {facets: Facet[]}) {
  const {searchParams, activeInputs, commit} = useFilterState();

  // input JSON string -> human label
  const labelFor = (input: string) => {
    for (const f of facets) {
      const v = f.values.find((val) => val.input === input);
      if (v) return v.label;
    }
    return 'Filter';
  };

  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const hasPrice = !!(minPrice || maxPrice);
  const hasAny = activeInputs.length > 0 || hasPrice;
  if (!hasAny) return null;

  const removeInput = (input: string) =>
    commit((p) => {
      const rest = p.getAll('filter').filter((c) => c !== input);
      p.delete('filter');
      rest.forEach((v) => p.append('filter', v));
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeInputs.map((input) => (
        <Chip key={input} onRemove={() => removeInput(input)}>
          {labelFor(input)}
        </Chip>
      ))}
      {hasPrice && (
        <Chip
          onRemove={() =>
            commit((p) => {
              p.delete('minPrice');
              p.delete('maxPrice');
            })
          }
        >
          {minPrice || '0'} – {maxPrice || '∞'}
        </Chip>
      )}
      <button
        type="button"
        onClick={() =>
          commit((p) => {
            p.delete('filter');
            p.delete('minPrice');
            p.delete('maxPrice');
          })
        }
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

function Chip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-sm font-medium text-ink">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="text-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}
