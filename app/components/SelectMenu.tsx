import {useEffect, useRef, useState} from 'react';

export type SelectOption = {value: string; label: string};

/**
 * Modern, accessible single-select dropdown — the house replacement for the
 * native `<select>` (whose popup is a browser-native, unstyleable modal).
 *
 * Reduced-corner trigger + a floating `role="listbox"` panel styled to the
 * design system (white, hairline border, soft shadow, mint active/hover, a
 * brand-green check on the selected row). Closes on outside-click and Escape.
 *
 * Controlled: pass `value` + `onChange`. Options are `{value, label}`.
 */
export function SelectMenu({
  label,
  value,
  options,
  onChange,
  align = 'right',
  ariaLabel,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  align?: 'left' | 'right';
  ariaLabel?: string;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-2 text-sm">
      {label ? <span className="whitespace-nowrap text-muted">{label}</span> : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        className="inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white py-2 pl-4 pr-3 font-semibold text-ink transition-colors hover:border-black/30 focus:border-brand-500 focus:outline-none"
      >
        <span>{current?.label}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
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
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={ariaLabel ?? label ?? 'Options'}
          className={`absolute top-full z-20 mt-2 min-w-[13rem] overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o) => {
            const active = o.value === current?.value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    active
                      ? 'bg-mint font-semibold text-ink'
                      : 'text-ink hover:bg-mint'
                  }`}
                >
                  {o.label}
                  {active ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 text-brand-700"
                      aria-hidden="true"
                    >
                      <path
                        d="m5 13 4 4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
