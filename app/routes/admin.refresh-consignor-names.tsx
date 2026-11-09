import {useLoaderData} from 'react-router';
import type {Route} from './+types/admin.refresh-consignor-names';
import {sellerHandle} from '~/lib/sellers';
import {hasAdminToken, ensureSeller, type AdminEnv} from '~/lib/shopify-admin.server';
import {getConsignors} from '~/lib/resaleos.server';

/**
 * Fast seller-name refresh. Pulls the consignor list from ResaleOS (/accounts)
 * and refreshes each seller metaobject's display_name to the real name — no
 * per-product scan (so it doesn't time out). ensureSeller only overwrites an
 * auto-placeholder ("Seller A-…"), never a hand-edited name.
 *
 *   /admin/refresh-consignor-names?key=<PRIVATE_SYNC_SECRET>
 */
export const meta: Route.MetaFunction = () => [{title: 'Refresh consignor names'}];

export async function loader({context, request}: Route.LoaderArgs) {
  const env = context.env as AdminEnv & {PRIVATE_RESALEOS_API_KEY?: string};
  const key = new URL(request.url).searchParams.get('key');
  if (!env.PRIVATE_SYNC_SECRET || key !== env.PRIVATE_SYNC_SECRET) {
    throw new Response('Not found', {status: 404});
  }
  if (!hasAdminToken(env)) {
    return {configured: false as const, log: []};
  }

  const consignors = await getConsignors(env);
  const log: string[] = [];
  for (const c of consignors) {
    const slug = sellerHandle(c.accountId);
    if (!slug) continue;
    try {
      const {created} = await ensureSeller(env, {slug, displayName: c.name});
      log.push(`${created ? 'CREATED' : 'refreshed'} ${slug} → "${c.name}"`);
    } catch (e) {
      log.push(`ERROR ${slug}: ${(e as Error).message}`);
    }
  }
  return {configured: true as const, log};
}

export default function RefreshConsignorNames() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="ui-container py-16">
      <h1 className="text-2xl font-extrabold uppercase tracking-tight">
        Refresh consignor names
      </h1>
      {!data.configured ? (
        <p className="mt-3 text-muted">Admin credentials not configured.</p>
      ) : (
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-white">
          {data.log.join('\n') || 'No consignors returned.'}
        </pre>
      )}
    </div>
  );
}
