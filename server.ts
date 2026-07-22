import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';

/**
 * Export a fetch handler in module format.
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },

  /**
   * Cron trigger (wrangler.toml [triggers]) — the seller sweep. Links any
   * products missing their custom.seller reference; the usual run finds
   * nothing to do and exits after one cheap query.
   */
  async scheduled(
    _controller: unknown,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<void> {
    const {runSellerSync} = await import('~/lib/seller-sync.server');
    executionContext.waitUntil(
      runSellerSync(env as Parameters<typeof runSellerSync>[0])
        .then((summary) =>
          console.log('[seller-sync cron]', JSON.stringify(summary)),
        )
        .catch((e) =>
          console.error('[seller-sync cron] failed:', (e as Error).message),
        ),
    );
  },
};
