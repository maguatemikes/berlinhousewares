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
import {runSellerSync} from '~/lib/seller-sync.server';

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
// Dev is opted into with the `--dev` flag (see the npm "dev" script) — kept
// flag-based so it's cross-platform (no `NODE_ENV=` prefix). Everything else
// is production.
const DEV =
  process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const MODE = DEV ? 'development' : (process.env.NODE_ENV ?? 'production');

type HandlerBuild = Parameters<typeof createRequestHandler>[0]['build'];

const app = express();

// Behind host nginx (TLS terminated there). Trust the proxy so req.protocol
// reflects X-Forwarded-Proto -> canonical/OG URLs stay absolute https.
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(compression());

// DEV: Vite in middleware mode provides HMR and loads the server build fresh on
// each request (the react-router virtual module), on the SAME Node runtime as
// prod. PROD: serve the built client assets and import the compiled server build
// once. This dev/prod split is the standard React Router custom-server setup;
// nothing here changes the `react-router build` output or the deploy.
let getBuild: () => Promise<HandlerBuild> | HandlerBuild;
let viteDevServer:
  | Awaited<ReturnType<typeof import('vite').createServer>>
  | undefined;

if (DEV) {
  const {createServer} = await import('vite');
  viteDevServer = await createServer({
    server: {middlewareMode: true},
    appType: 'custom',
  });
  app.use(viteDevServer.middlewares);
  getBuild = () =>
    viteDevServer!.ssrLoadModule(
      'virtual:react-router/server-build',
    ) as Promise<HandlerBuild>;
} else {
  // react-router build output dir depends on config (hydrogenPreset -> dist).
  const BUILD_DIR = existsSync('dist/server/index.js') ? 'dist' : 'build';
  const CLIENT_DIR = `${BUILD_DIR}/client`;
  app.use(
    '/assets',
    express.static(`${CLIENT_DIR}/assets`, {immutable: true, maxAge: '1y'}),
  );
  app.use(express.static(CLIENT_DIR, {maxAge: '1h'}));
  // Imported via a runtime URL so typecheck doesn't need the generated file.
  const serverBuild = (await import(
    new URL(`../${BUILD_DIR}/server/index.js`, import.meta.url).href
  )) as unknown as HandlerBuild;
  getBuild = () => serverBuild;
}

app.use(async (req, res) => {
  const request = toWebRequest(req);
  try {
    const context = await createHydrogenRouterContext(
      request,
      process.env as unknown as Env,
    );

    const handleRequest = createRequestHandler({
      build: getBuild as unknown as HandlerBuild,
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
    // In dev, rewrite the stack to point at the original source.
    if (DEV && error instanceof Error) viteDevServer?.ssrFixStacktrace(error);
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send('An unexpected error occurred');
    }
  }
});

app.listen(PORT, () => {
  console.log(`[berlin] listening on http://127.0.0.1:${PORT} (${MODE})`);
});

// ── Scheduled seller reconcile ──────────────────────────────────────────────
// Replaces the old Cloudflare cron. Every 5 min, make each product's
// custom.seller match its ResaleOS consignor — WRITES ONLY ON CHANGE, so a quiet
// tick is a few cheap reads and zero writes. New registrations / re-assignments
// show on the seller pages within ~5 min with no manual step.
//
// Prod only: in dev, run it on demand via /admin/run-seller-sync?key=… (same fn).
if (!DEV) {
  const SWEEP_MS = 5 * 60_000;
  let sweeping = false; // never let two runs overlap
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      const s = await runSellerSync(process.env as unknown as Parameters<typeof runSellerSync>[0]);
      // Stay quiet on no-op ticks; log only when something changed or failed.
      if (s.linked || s.createdSellers || !s.ok) {
        console.log(
          `[berlin] seller sweep: checked=${s.checked} linked=${s.linked} ` +
            `created=${s.createdSellers} unchanged=${s.unchanged} ok=${s.ok}` +
            (s.reason ? ` reason=${s.reason}` : '') +
            (s.errors.length ? ` errors=${s.errors.length}` : ''),
        );
      }
    } catch (e) {
      console.error('[berlin] seller sweep error:', e);
    } finally {
      sweeping = false;
    }
  };
  setInterval(sweep, SWEEP_MS).unref?.();
  setTimeout(sweep, 30_000).unref?.(); // first pass ~30s after boot
  console.log('[berlin] seller reconcile scheduled every 5 min');
}

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
