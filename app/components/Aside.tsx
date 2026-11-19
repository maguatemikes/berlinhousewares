import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useId} from 'react';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  const asideRef = useRef<HTMLElement>(null);

  // Modal focus management (additive — does not change open/close logic):
  // on open, move focus into the drawer and trap Tab inside it; on close,
  // restore focus to whatever was focused before (usually the trigger). This
  // makes the custom dialog behave like a native <dialog> for keyboard/SR users.
  const FOCUSABLE =
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  useEffect(() => {
    if (!expanded) return;
    const abortController = new AbortController();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = asideRef.current;

    // Move focus into the drawer (first focusable control).
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    document.addEventListener(
      'keydown',
      function handler(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          close();
          return;
        }
        if (event.key !== 'Tab' || !panel) return;
        const f = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      },
      {signal: abortController.signal},
    );

    return () => {
      abortController.abort();
      // Restore focus to the element that opened the drawer.
      previouslyFocused?.focus();
    };
  }, [close, expanded]);

  return (
    <div
      aria-modal
      className={`overlay !z-[100] !bg-black/40 ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button
        className="close-outside"
        onClick={close}
        aria-label="Close"
        tabIndex={-1}
      />
      <aside ref={asideRef} className="flex flex-col !shadow-2xl">
        <header className="flex shrink-0 items-center justify-between !border-black/10 px-5">
          <h3
            id={id}
            className="text-lg font-extrabold uppercase tracking-tight text-ink"
          >
            {heading}
          </h3>
          <button
            className="close reset grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-mint"
            onClick={close}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <main className="min-h-0 flex-1 !m-0 overflow-hidden">{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
