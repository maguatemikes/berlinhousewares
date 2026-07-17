import {Suspense, useEffect, useState} from 'react';
import {Await, Form, NavLink, Link, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

type HeaderCustomer = {firstName?: string | null; lastName?: string | null};

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  customer: Promise<HeaderCustomer | null>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

/* -------------------------------------------------------------------------- */
/* Nike-style navigation model                                                 */
/* -------------------------------------------------------------------------- */
type MegaColumn = {heading: string; links: {label: string; to: string}[]};
type NavItem = {
  title: string;
  to: string;
  accent?: boolean;
  mega?: {columns: MegaColumn[]; promo?: {label: string; sub: string; to: string}};
};

const SHOE_LINKS = [
  {label: 'All Shoes', to: '/collections/all'},
  {label: 'Lifestyle', to: '/collections'},
  {label: 'Running', to: '/collections'},
  {label: 'Training & Gym', to: '/collections'},
  {label: 'Sandals & Slides', to: '/collections'},
];
const CLOTHING_LINKS = [
  {label: 'All Clothing', to: '/collections/all'},
  {label: 'Tops & T-Shirts', to: '/collections'},
  {label: 'Hoodies & Sweatshirts', to: '/collections'},
  {label: 'Jackets', to: '/collections'},
  {label: 'Shorts', to: '/collections'},
];
const ACCESSORY_LINKS = [
  {label: 'Bags & Backpacks', to: '/collections'},
  {label: 'Socks', to: '/collections'},
  {label: 'Hats & Headwear', to: '/collections'},
  {label: 'Water Bottles', to: '/collections'},
];

function categoryMega(who: string): NavItem['mega'] {
  return {
    columns: [
      {
        heading: 'Featured',
        links: [
          {label: 'New Releases', to: '/collections/all'},
          {label: 'Best Sellers', to: '/collections'},
          {label: 'Shop All Sale', to: '/collections'},
          {label: 'Pre-Loved & Consignment', to: '/collections'},
        ],
      },
      {heading: 'Shoes', links: SHOE_LINKS},
      {heading: 'Clothing', links: CLOTHING_LINKS},
      {heading: 'Accessories', links: ACCESSORY_LINKS},
    ],
    promo: {
      label: `${who} — Spring Drop`,
      sub: 'Shop the newest arrivals',
      to: '/collections/all',
    },
  };
}

const NAV: NavItem[] = [
  {title: 'Shop', to: '/collections/all'},
  {title: 'Men', to: '/collections', mega: categoryMega('Men')},
  {title: 'Women', to: '/collections', mega: categoryMega('Women')},
  {title: 'Kids', to: '/collections', mega: categoryMega('Kids')},
  {title: 'Consign', to: '/consign'},
  {title: 'Sale', to: '/collections', accent: true},
];

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */
export function Header({header, customer, cart}: HeaderProps) {
  const {shop} = header;
  return (
    <div className="sticky top-0 z-50">
      <UtilityBar customer={customer} />

      <header className="relative border-b border-black/10 bg-paper">
        <div className="ui-container flex h-[60px] items-center justify-between gap-4">
          {/* Left: mobile toggle + logo */}
          <div className="flex items-center gap-2">
            <HeaderMenuMobileToggle />
            <NavLink
              prefetch="intent"
              to="/"
              end
              aria-label={`${shop.name || 'Berlin Houseware'} home`}
            >
              <Logo />
            </NavLink>
          </div>

          {/* Center: desktop nav with mega menus */}
          <nav
            className="hidden items-stretch gap-6 lg:flex"
            role="navigation"
            aria-label="Primary"
          >
            {NAV.map((item) => (
              <NavTop key={item.title} item={item} />
            ))}
          </nav>

          {/* Right: search + account + bag */}
          <div className="flex items-center gap-2">
            <SearchPill />
            <SearchToggle />
            <AccountToggle customer={customer} />
            <CartToggle cart={cart} />
          </div>
        </div>
      </header>

      <AnnouncementBar />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Utility bar                                                                 */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* Announcement bar — sits under the nav, retracts on scroll down             */
/* -------------------------------------------------------------------------- */
function AnnouncementBar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={collapsed}
      className={`overflow-hidden border-b border-black/5 bg-brand-600 text-white transition-[max-height] duration-200 ease-out ${
        collapsed ? 'max-h-0' : 'max-h-9'
      }`}
    >
      <div className="ui-container flex h-8 items-center justify-center gap-2 text-center text-xs font-semibold tracking-wide">
        <span>Free shipping on orders over $75</span>
        <span aria-hidden className="hidden opacity-60 sm:inline">
          •
        </span>
        <span className="hidden sm:inline">
          Buy &amp; sell verified pre-loved streetwear
        </span>
      </div>
    </div>
  );
}

const utilLinkClass = 'text-xs font-medium hover:text-brand-600';

function UtilItem({
  children,
  first,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <span className="flex items-center">
      {!first && <span className="mx-2 h-3 w-px bg-black/20" />}
      {children}
    </span>
  );
}

function UtilityBar({customer}: {customer: HeaderProps['customer']}) {
  return (
    <div className="hidden bg-[#f5f5f5] text-ink md:block">
      <div className="ui-container flex h-9 items-center justify-between">
        <span className="text-xs font-medium text-muted">
          Buy &amp; sell — new &amp; pre-loved streetwear
        </span>
        <nav className="flex items-center" aria-label="Utility">
          <UtilItem first>
            <NavLink to="/pages/about" prefetch="intent" className={utilLinkClass}>
              Find a Store
            </NavLink>
          </UtilItem>
          <UtilItem>
            <NavLink to="/policies" prefetch="intent" className={utilLinkClass}>
              Help
            </NavLink>
          </UtilItem>
          <Suspense fallback={<UtilSignedOut />}>
            <Await resolve={customer} errorElement={<UtilSignedOut />}>
              {(c) =>
                c ? <UtilSignedIn name={c.firstName ?? null} /> : <UtilSignedOut />
              }
            </Await>
          </Suspense>
        </nav>
      </div>
    </div>
  );
}

/** Signed-out utility links → native Customer Account API login. */
function UtilSignedOut() {
  return (
    <>
      <UtilItem>
        <NavLink to="/account/login" className={utilLinkClass}>
          Join Us
        </NavLink>
      </UtilItem>
      <UtilItem>
        <NavLink to="/account/login" className={utilLinkClass}>
          Sign In
        </NavLink>
      </UtilItem>
    </>
  );
}

/** Signed-in greeting + logout (POST to the native /account/logout route). */
function UtilSignedIn({name}: {name: string | null}) {
  return (
    <>
      <UtilItem>
        <NavLink
          to="/account"
          prefetch="intent"
          className={`${utilLinkClass} font-semibold text-brand-700`}
        >
          {name ? `Hi, ${name}` : 'My Account'}
        </NavLink>
      </UtilItem>
      <UtilItem>
        <Form method="post" action="/account/logout">
          <button type="submit" className={utilLinkClass}>
            Sign Out
          </button>
        </Form>
      </UtilItem>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Top nav item + mega menu                                                    */
/* -------------------------------------------------------------------------- */
function NavTop({item}: {item: NavItem}) {
  return (
    <div className="group flex items-stretch">
      <NavLink
        to={item.to}
        prefetch="intent"
        className={({isActive}) =>
          `relative flex items-center px-1 text-[15px] font-medium transition-colors ${
            item.accent ? 'text-brand-600' : 'text-ink'
          } after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-center after:scale-x-0 after:bg-brand-500 after:transition-transform group-hover:after:scale-x-100 ${
            isActive ? 'after:scale-x-100' : ''
          }`
        }
      >
        {item.title}
      </NavLink>

      {item.mega && (
        <div className="invisible absolute inset-x-0 top-full opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100">
          <div className="border-t border-black/10 bg-paper shadow-xl">
            <div className="ui-container grid grid-cols-5 gap-8 py-8">
              <div className="col-span-3 grid grid-cols-3 gap-8">
                {item.mega.columns.map((col) => (
                  <div key={col.heading}>
                    <h3 className="mb-3 text-sm font-bold text-ink">
                      {col.heading}
                    </h3>
                    <ul className="space-y-2">
                      {col.links.map((l) => (
                        <li key={l.label}>
                          <Link
                            to={l.to}
                            prefetch="intent"
                            className="text-sm text-muted transition-colors hover:text-ink"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {item.mega.promo && (
                <Link
                  to={item.mega.promo.to}
                  prefetch="intent"
                  className="col-span-2 flex flex-col justify-end overflow-hidden rounded-2xl bg-mint p-6 transition-colors hover:bg-mint-deep"
                >
                  <span className="eyebrow text-brand-700">Featured</span>
                  <span className="mt-1 text-xl font-extrabold uppercase leading-tight text-ink">
                    {item.mega.promo.label}
                  </span>
                  <span className="mt-1 text-sm text-muted">
                    {item.mega.promo.sub}
                  </span>
                  <span className="mt-4 inline-flex btn btn-dark !px-4 !py-2 text-sm self-start">
                    Shop now
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile menu (used by PageLayout MobileMenuAside)                            */
/* -------------------------------------------------------------------------- */
export function HeaderMenu({viewport}: {
  menu?: HeaderProps['header']['menu'];
  primaryDomainUrl?: string;
  viewport: Viewport;
  publicStoreDomain?: string;
}) {
  const {close} = useAside();
  if (viewport !== 'mobile') return null;

  return (
    <nav className="flex flex-col gap-1 p-2" role="navigation">
      <NavLink
        to="/"
        end
        onClick={close}
        prefetch="intent"
        className={mobileLinkClass}
      >
        Home
      </NavLink>
      {NAV.map((item) => (
        <NavLink
          key={item.title}
          to={item.to}
          onClick={close}
          prefetch="intent"
          className={`${mobileLinkClass} ${
            item.accent ? '!text-brand-600' : ''
          }`}
        >
          {item.title}
        </NavLink>
      ))}
    </nav>
  );
}

const mobileLinkClass =
  'block rounded-lg px-3 py-3 text-lg font-semibold text-ink hover:bg-mint';

/* -------------------------------------------------------------------------- */
/* Right-side controls                                                         */
/* -------------------------------------------------------------------------- */
function SearchPill() {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="hidden h-10 items-center gap-2 rounded-full bg-[#f5f5f5] px-4 focus-within:ring-2 focus-within:ring-brand-400 lg:flex"
    >
      <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
      <input
        type="search"
        name="q"
        placeholder="Search"
        aria-label="Search"
        className="w-28 !m-0 !border-0 !bg-transparent !p-0 !text-sm !leading-none text-ink placeholder:text-muted focus:!outline-none xl:w-40"
      />
    </form>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-mint lg:hidden"
      onClick={() => open('search')}
      aria-label="Search"
    >
      <SearchIcon className="h-5 w-5" />
    </button>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-mint lg:hidden"
      onClick={() => open('mobile')}
      aria-label="Open menu"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path
          d="M3 6h18M3 12h18M3 18h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** Account affordance in the main bar (visible on mobile, where the utility
 *  bar is hidden). Links to /account; shows a brand dot when signed in. */
function AccountToggle({customer}: {customer: HeaderProps['customer']}) {
  return (
    <Suspense fallback={<AccountLink loggedIn={false} />}>
      <Await resolve={customer} errorElement={<AccountLink loggedIn={false} />}>
        {(c) => <AccountLink loggedIn={Boolean(c)} />}
      </Await>
    </Suspense>
  );
}

function AccountLink({loggedIn}: {loggedIn: boolean}) {
  return (
    <NavLink
      to="/account"
      prefetch="intent"
      aria-label={loggedIn ? 'Your account' : 'Sign in'}
      className="relative grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-mint"
    >
      <PersonIcon />
      {loggedIn && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-paper" />
      )}
    </NavLink>
  );
}

function CartBadge({count}: {count: number}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      aria-label={`Bag, ${count} items`}
      className="relative grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-mint"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      <BagIcon />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */
function Logo() {
  return (
    <span className="text-2xl font-extrabold lowercase leading-none tracking-tight text-ink">
      berlin<span className="text-brand-600">houseware</span>
    </span>
  );
}

function SearchIcon({className}: {className?: string}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BagIcon() {
  return (
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
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
      <path d="M3 4h2l2.2 11.3a1.5 1.5 0 0 0 1.5 1.2h8a1.5 1.5 0 0 0 1.5-1.2L20 7.5H6" />
    </svg>
  );
}
