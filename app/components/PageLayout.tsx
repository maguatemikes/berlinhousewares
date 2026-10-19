import {Await, useFetcher, useNavigate} from 'react-router';
import {Suspense, useEffect, useRef, useState} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside, useAside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu, type NavDepartment} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SEARCH_ENDPOINT} from '~/components/SearchFormPredictive';
import {PredictiveResults, SearchGlyph} from '~/components/PredictiveResults';
import {MicButton, useVoiceSearch} from '~/components/VoiceSearch';
import {
  getEmptyPredictiveSearchResult,
  type PredictiveSearchReturn,
} from '~/lib/search';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  departments: NavDepartment[];
  isLoggedIn: Promise<boolean>;
  customer: Promise<{firstName?: string | null; lastName?: string | null} | null>;
  publicStoreDomain: string;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  departments,
  isLoggedIn,
  customer,
  publicStoreDomain,
}: PageLayoutProps) {
  return (
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside />
      <MobileMenuAside
        header={header}
        departments={departments}
        publicStoreDomain={publicStoreDomain}
      />
      {header && (
        <Header
          header={header}
          departments={departments}
          cart={cart}
          isLoggedIn={isLoggedIn}
          customer={customer}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <main>{children}</main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="Shopping Cart">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

/**
 * Mobile search drawer — native Hydrogen predictive search sharing the same
 * branded results as the desktop header flyout (`PredictiveResults`). Enter and
 * the submit button both open the full `/search` page; `autoComplete="off"`
 * hides the browser's own history dropdown.
 */
function SearchAside() {
  const {type, close} = useAside();
  const fetcher = useFetcher<PredictiveSearchReturn>({key: 'search'});
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [term, setTerm] = useState('');

  const items =
    fetcher.data?.result?.items ?? getEmptyPredictiveSearchResult().items;
  const total = fetcher.data?.result?.total ?? 0;
  const loading = fetcher.state !== 'idle';

  // Focus the field each time the drawer opens.
  useEffect(() => {
    if (type !== 'search') return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [type]);

  const voice = useVoiceSearch({
    onResult: (text) => {
      setTerm(text);
      runPredictive(text);
      inputRef.current?.focus();
    },
    onInterim: (text) => setTerm(text),
  });

  function runPredictive(value: string) {
    void fetcher.submit(
      {q: value, limit: 6, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setTerm(value);
    if (value.trim()) runPredictive(value);
  }

  function closeAndReset() {
    setTerm('');
    close();
  }

  function goToSearch(value?: string) {
    const q = (value ?? term).trim();
    if (!q) return;
    closeAndReset();
    void navigate(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToSearch();
  }

  return (
    <Aside type="search" heading="SEARCH">
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-5 pb-3">
          <form
            role="search"
            onSubmit={onSubmit}
            className="flex h-11 items-center gap-2 rounded-2xl border-[0.5px] border-black/20 pl-4 pr-1 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-400/60"
          >
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={term}
              onChange={onChange}
              placeholder="What can we help you find?"
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 !m-0 !border-0 !bg-transparent !p-0 !text-sm !leading-none text-ink placeholder:text-muted focus:!outline-none"
            />
            {voice.supported && (
              <MicButton
                listening={voice.listening}
                onToggle={voice.toggle}
                className="h-9 w-9"
              />
            )}
            <button
              type="submit"
              aria-label="Search"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-mint hover:text-ink"
            >
              <SearchGlyph className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {term.trim() && (
            <PredictiveResults
              items={items}
              total={total}
              term={term}
              loading={loading}
              onClose={closeAndReset}
              onSelectQuery={(t) => goToSearch(t)}
            />
          )}
        </div>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  departments,
  publicStoreDomain,
}: {
  header: PageLayoutProps['header'];
  departments: PageLayoutProps['departments'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU">
        <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
          departments={departments}
        />
      </Aside>
    )
  );
}
