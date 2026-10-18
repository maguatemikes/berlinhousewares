/**
 * Node/Express entry — replaces the Cloudflare Worker `server.ts` at runtime.
 *
 * The request logic is a faithful port of the old Worker `fetch` handler: it
 * builds the Hydrogen context, delegates to Hydrogen's `createRequestHandler`
 * (which internally runs React Router), commits the session cookie when pending,
 * and falls back to `storefrontRedirect` on 404 — all verbatim. Only the wrapper
 * changes: Express adapts Node req/res <-> web Request/Response and `env` comes
 * from `process.env`.
 *
 * The `scheduled` cron export is gone (Node has no cron trigger); the seller
 * sweep runs via host cron hitting /admin/sync-sellers (see deploy cron).
 */
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import express from 'express';
import compression from 'compression';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';

// ── Node/undici compat ─────────────────────────────────────────────────────
// undici requires `duplex: "half"` whenever a Request/fetch carries a (stream)
// body. Hydrogen's Storefront-API/MCP request *forwarding* builds such requests
// without it — fine on Workers, throws on Node. Inject it globally so forwarded
// POSTs work under Node.
{
  const NativeRequest = globalThis.Request;
  // @ts-expect-error - augmenting the global Request constructor
  globalThis.Request = class extends NativeRequest {
    constructor(input: any, init?: any) {
      if (init && init.body != null && init.duplex === undefined) {
        init = {...init, duplex: "half"};
      }
      super(input, init);
    }
  };
  const nativeFetch = globalThis.fetch;
  // @ts-expect-error - wrapping global fetch
  globalThis.fetch = (input: any, init?: any) => {
    if (init && init.body != null && init.duplex === undefined) {
      init = {...init, duplex: "half"};
    }
    return nativeFetch(input, init);
  };
}

import {existsSync} from 'node:fs';

const PORT = Number(process.env.PORT) || 3000;
const MODE = process.env.NODE_ENV ?? 'production';

// react-router build output dir depends on config (hydrogenPreset -> dist).
// Detect at boot so this works whether it lands in dist/ or build/.
const BUILD_DIR = existsSync('dist/server/index.js') ? 'dist' : 'build';
const CLIENT_DIR = `${BUILD_DIR}/client`;

// The React Router server build. Imported via a runtime URL so `tsc`/typecheck
// doesn't require the (generated) file to exist, and so it is not bundled.
const serverBuild = (await import(
  new URL(`../${BUILD_DIR}/server/index.js`, import.meta.url).href
)) as unknown as Parameters<typeof createRequestHandler>[0]['build'];

const app = express();

// Behind host nginx (TLS terminated there). Trust the proxy so req.protocol
// reflects X-Forwarded-Proto -> canonical/OG URLs stay absolute https.
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(compression());

// Static assets from the client build. Hashed assets are immutable.
app.use(
  '/assets',
  express.static(`${CLIENT_DIR}/assets`, {immutable: true, maxAge: '1y'}),
);
app.use(express.static(CLIENT_DIR, {maxAge: '1h'}));

app.use(async (req, res) => {
  const request = toWebRequest(req);
  try {
    const context = await createHydrogenRouterContext(
      request,
      process.env as unknown as Env,
    );

    const handleRequest = createRequestHandler({
      build: serverBuild,
      mode: MODE,
      getLoadContext: () => context,
    });

    let response = await handleRequest(request);

    if (context.session.isPending) {
      response.headers.set('Set-Cookie', await context.session.commit());
    }

    if (response.status === 404) {
      response = await storefrontRedirect({
        request,
        response,
        storefront: context.storefront,
      });
    }

    await sendWebResponse(res, response);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send('An unexpected error occurred');
    }
  }
});

app.listen(PORT, () => {
  console.log(`[berlin] listening on http://127.0.0.1:${PORT} (${MODE})`);
});

/** Express request -> web Request (WHATWG). */
function toWebRequest(req: express.Request): Request {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(url, {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // Required by Node/undici when streaming a request body.
    ...(hasBody ? {duplex: 'half'} : {}),
  } as RequestInit);
}

/** Web Response -> Express response (streams body, preserves multiple cookies). */
async function sendWebResponse(
  res: express.Response,
  webResponse: Response,
): Promise<void> {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.append(key, value);
  });
  const setCookies =
    (webResponse.headers as Headers & {getSetCookie?: () => string[]})
      .getSetCookie?.() ?? [];
  for (const cookie of setCookies) res.append('Set-Cookie', cookie);

  if (webResponse.body) {
    await pipeline(Readable.fromWeb(webResponse.body as never), res);
  } else {
    res.end();
  }
}
