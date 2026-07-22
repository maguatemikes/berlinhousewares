import type {Route} from './+types/admin.run-seller-sync';
import {runSellerSync} from '~/lib/seller-sync.server';
import type {AdminEnv} from '~/lib/shopify-admin.server';

/**
 * Resource route (no UI): runs the EXACT function the cron trigger runs — the
 * light sweep that links only products missing custom.seller — and returns its
 * summary as JSON. Gated by the same PRIVATE_SYNC_SECRET as /admin/sync-sellers.
 *
 *   /admin/run-seller-sync?key=<PRIVATE_SYNC_SECRET>
 *
 * Use to test the cron behavior on demand instead of waiting for the schedule.
 */
export async function loader({context, request}: Route.LoaderArgs) {
  const env = context.env as AdminEnv & {
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
  };

  const key = new URL(request.url).searchParams.get('key');
  if (!env.PRIVATE_SYNC_SECRET || key !== env.PRIVATE_SYNC_SECRET) {
    throw new Response('Not found', {status: 404});
  }

  const summary = await runSellerSync(env);
  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });
}
