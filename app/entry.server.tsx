import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
// Node has no 'react-dom/server' edge export; the browser build provides
// renderToReadableStream (web streams) and runs under Node 18+ and on edge.
import {renderToReadableStream} from 'react-dom/server.browser';
import {
  createContentSecurityPolicy,
  type HydrogenRouterContextProvider,
} from '@shopify/hydrogen';
import type {EntryContext} from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const checkoutDomain = context.env.PUBLIC_CHECKOUT_DOMAIN;
  const storeDomain = context.env.PUBLIC_STORE_DOMAIN;

  // NOTE: `createContentSecurityPolicy` REPLACES a directive when we pass it
  // (it's `Object.assign(defaults, ours)`, not a merge), and Hydrogen has no
  // default `script-src` / `img-src` / `frame-src` — those normally fall back
  // to `default-src` (which includes cdn.shopify.com + shopify.com). So any
  // directive we set here must re-list Shopify's own hosts, or we'd break the
  // Shopify consent-tracking / perf-kit scripts, analytics beacons, and frames.
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {checkoutDomain, storeDomain},
    // Shopify defaults (via default-src) + GTM/GA4 + Meta Pixel loaders.
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://www.googletagmanager.com',
      'https://connect.facebook.net',
    ],
    // Hero phone's hot-linked stock imagery + Shopify CDN + the GA4/GTM/Meta
    // tracking pixels (Meta's fbevents fires a facebook.com/tr image GET).
    imgSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://images.unsplash.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://www.facebook.com',
      'data:',
    ],
    // Hydrogen's default connect-src (self, cdn.shopify.com, monorail analytics,
    // + the shop domains) PLUS GA4 beacons / GTM config / Meta XHRs.
    connectSrc: [
      "'self'",
      'https://cdn.shopify.com/',
      'https://monorail-edge.shopifysvc.com',
      ...(checkoutDomain ? [`https://${checkoutDomain}`] : []),
      ...(storeDomain ? [`https://${storeDomain}`] : []),
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://connect.facebook.net',
      'https://www.facebook.com',
    ],
    // Shopify frames (Shop Pay etc., via default-src hosts) + the GTM <noscript>
    // fallback iframe.
    frameSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://www.googletagmanager.com',
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
