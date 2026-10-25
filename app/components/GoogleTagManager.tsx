import {useEffect} from 'react';
import {useRouteLoaderData} from 'react-router';
import {useAnalytics, AnalyticsEvent} from '@shopify/hydrogen';
import type {RootLoader} from '~/root';
import {
  pushEcommerce,
  pushEvent,
  pushUserData,
  itemFromProduct,
  itemFromCartLine,
  ecommerceFromCart,
  BEGIN_CHECKOUT_EVENT,
  type AnalyticsProduct,
  type AnalyticsCart,
  type AnalyticsCartLine,
  type AnalyticsCustomer,
} from '~/lib/analytics/dataLayer';

/**
 * Native Hydrogen → GA4 dataLayer bridge.
 *
 * Subscribes to the standard Shopify analytics events published by
 * `Analytics.Provider` (and the `Analytics.*View` components already on the
 * routes) and translates each into one GA4 ecommerce `dataLayer` push. A single
 * GTM container then fires BOTH the GA4 tag and the Meta Pixel tag off the same
 * push — see `app/lib/analytics/dataLayer.ts`.
 *
 * Every push is gated on `canTrack()` (Shopify Customer Privacy consent), so
 * this honours the storefront's consent configuration natively.
 *
 * Mounted once, inside `<Analytics.Provider>` (see `app/root.tsx`). Renders
 * nothing — the GTM snippet itself lives in the document shell (`Layout`).
 */
export function GoogleTagManager() {
  const {subscribe, canTrack, shop} = useAnalytics();
  const shopCurrency = shop?.currency;
  const rootData = useRouteLoaderData<RootLoader>('root');
  const customer = rootData?.customer;

  // user_data for Meta/GA advanced matching + CAPI. The signed-in customer is a
  // deferred loader value, so resolve it, then push once consent allows. Only a
  // logged-in, consented customer contributes PII; anonymous visitors are matched
  // by the GTM-side external_id cookie instead.
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    Promise.resolve(customer)
      .then((c) => {
        if (cancelled || !c) return;
        try {
          if (!canTrack()) return;
        } catch {
          return;
        }
        pushUserData(c as AnalyticsCustomer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  useEffect(() => {
    const allowed = () => {
      try {
        return canTrack();
      } catch {
        // If the Customer Privacy SDK isn't ready yet, don't track.
        return false;
      }
    };

    // page_view — fires on every route (incl. client-side navigations). Configure
    // the GA4 config tag to send page_view on THIS event and disable GA4
    // enhanced-measurement page views, so SPA navigations aren't double-counted.
    subscribe(AnalyticsEvent.PAGE_VIEWED, (payload) => {
      if (!allowed()) return;
      pushEvent('page_view', {
        page_location: payload?.url,
        page_title: typeof document !== 'undefined' ? document.title : undefined,
      });
    });

    // view_item — PDP. Full item data (incl. sku) comes from Analytics.ProductView.
    subscribe(AnalyticsEvent.PRODUCT_VIEWED, (payload) => {
      if (!allowed()) return;
      const products = (payload?.products ?? []) as AnalyticsProduct[];
      if (!products.length) return;
      const items = products.map((p, i) => itemFromProduct(p, i));
      pushEcommerce('view_item', {
        currency: shopCurrency,
        value: items.reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0),
        items,
      });
    });

    // view_item_list — collection. The native collection_viewed payload carries
    // only {id, handle} (no product list), so this records the list view with
    // its id/name; populating items is a follow-up (needs a custom event with
    // the product list, or select_item on card clicks).
    subscribe(AnalyticsEvent.COLLECTION_VIEWED, (payload) => {
      if (!allowed()) return;
      const c = payload?.collection;
      if (!c) return;
      pushEvent('view_item_list', {
        ecommerce: {
          item_list_id: c.handle,
          item_list_name: c.handle,
          items: [],
        },
      });
    });

    // search — results page. Fire the GA4 `search` event with the term.
    subscribe(AnalyticsEvent.SEARCH_VIEWED, (payload) => {
      if (!allowed()) return;
      if (!payload?.searchTerm) return;
      pushEvent('search', {search_term: payload.searchTerm});
    });

    // view_cart — bag opened / cart page.
    subscribe(AnalyticsEvent.CART_VIEWED, (payload) => {
      if (!allowed()) return;
      pushEcommerce('view_cart', ecommerceFromCart(payload?.cart as AnalyticsCart));
    });

    // add_to_cart — Provider auto-emits this by diffing the cart. `currentLine`
    // is the line that was added/increased.
    subscribe(AnalyticsEvent.PRODUCT_ADD_TO_CART, (payload) => {
      if (!allowed()) return;
      const line = payload?.currentLine as AnalyticsCartLine | undefined;
      if (!line) return;
      const item = itemFromCartLine(line);
      pushEcommerce('add_to_cart', {
        currency: currencyOfLine(line),
        value: (item.price ?? 0) * (item.quantity ?? 1),
        items: [item],
      });
    });

    // remove_from_cart — `prevLine` is the line that was removed/decreased.
    subscribe(AnalyticsEvent.PRODUCT_REMOVED_FROM_CART, (payload) => {
      if (!allowed()) return;
      const line = payload?.prevLine as AnalyticsCartLine | undefined;
      if (!line) return;
      const item = itemFromCartLine(line);
      pushEcommerce('remove_from_cart', {
        currency: currencyOfLine(line),
        value: (item.price ?? 0) * (item.quantity ?? 1),
        items: [item],
      });
    });

    // begin_checkout — a custom event (subscribe by its exact key, since
    // AnalyticsEvent.CUSTOM_EVENT is only the "custom_" prefix). Published by the
    // cart's "Proceed to Checkout" button (payload.cart) and the PDP "Buy it now"
    // button (payload.products). Maps to GA4 begin_checkout / Meta InitiateCheckout.
    subscribe(BEGIN_CHECKOUT_EVENT, (payload) => {
      if (!allowed()) return;
      if (payload?.cart) {
        pushEcommerce('begin_checkout', ecommerceFromCart(payload.cart as AnalyticsCart));
        return;
      }
      const products = (payload?.products ?? []) as AnalyticsProduct[];
      if (!products.length) return;
      const items = products.map((p, i) => itemFromProduct(p, i));
      pushEcommerce('begin_checkout', {
        currency: shopCurrency,
        value: items.reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0),
        items,
      });
    });
    // Subscriptions are registered once; `subscribe`/`canTrack`/`shop` are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function currencyOfLine(line?: AnalyticsCartLine): string | undefined {
  return line?.merchandise?.price?.currencyCode || undefined;
}

/**
 * The GTM container bootstrap, as an inline `<script>` body. The CSP nonce is
 * set on the `gtm.js` script GTM injects; GTM then propagates that nonce to the
 * GA4 / Meta tags it injects in turn, so the whole chain satisfies the
 * nonce-based CSP without `'unsafe-inline'`.
 */
export function gtmSnippet(gtmId: string, nonce?: string): string {
  const setNonce = nonce ? `j.setAttribute('nonce','${nonce}');` : '';
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;${setNonce}f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
}
