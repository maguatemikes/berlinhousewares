import {useLoaderData} from 'react-router';
import type {Route} from './+types/admin.sync-sellers';
import {sellerHandle} from '~/lib/sellers';
import {
  hasAdminToken,
  ensureSeller,
  setProductSeller,
  type AdminEnv,
} from '~/lib/shopify-admin.server';
import {getConsignorForSku} from '~/lib/resaleos.server';

/**
 * Phase 2 automation (TEST) — one-pass "create every seller entry + link every
 * product" sync. Keyed on `vendor` as a stand-in for ResaleOS `consignor.accountId`.
 *
 *   /admin/sync-sellers?key=<PRIVATE_SYNC_SECRET>          → DRY RUN
 *   /admin/sync-sellers?key=<PRIVATE_SYNC_SECRET>&apply=1  → APPLIES
 *
 * Gated by PRIVATE_SYNC_SECRET — without the matching ?key= the route 404s.
 * With the webhook live this is only a backfill/recovery tool. Idempotent:
 * re-running never duplicates sellers and never overwrites an edited
 * display_name (see ensureSeller).
 */
export const meta: Route.MetaFunction = () => [{title: 'Sync sellers'}];

export async function loader({context, request}: Route.LoaderArgs) {
  const env = context.env as AdminEnv;
  const url = new URL(request.url);

  // Gate: this route writes to the live store. Without a matching ?key= it
  // pretends not to exist. Set PRIVATE_SYNC_SECRET in the environment.
  const key = url.searchParams.get('key');
  if (!env.PRIVATE_SYNC_SECRET || key !== env.PRIVATE_SYNC_SECRET) {
    throw new Response('Not found', {status: 404});
  }

  if (!hasAdminToken(env)) {
    return {
      configured: false as const,
      apply: false,
      applyHref: null,
      sellers: [],
      log: [],
    };
  }

  const apply = url.searchParams.get('apply') === '1';

  // Read the catalog (Storefront). product.id is a gid usable as Admin ownerId.
  const {products} = await context.storefront.query(SYNC_PRODUCTS_QUERY);

  // Group products by their TRUE seller: ResaleOS consignor.accountId (via
  // SKU = resaleosId). Same consignor, any brand → one store. Vendor is only
  // the fallback for products ResaleOS doesn't know.
  const groups = new Map<
    string,
    {slug: string; name: string; products: Array<{id: string; title: string}>}
  >();
  for (const p of products.nodes) {
    const consignor = await getConsignorForSku(env, p.variants?.nodes?.[0]?.sku);
    const vendor = (p.vendor || '').trim();

    let slug: string;
    let name: string;
    if (consignor) {
      slug = sellerHandle(consignor.accountId);
      name = consignor.name ?? `Seller ${consignor.accountId}`;
    } else if (vendor) {
      slug = sellerHandle(vendor);
      name = vendor;
    } else {
      continue; // no consignor and no vendor → unassigned
    }
    if (!slug) continue;

    const g = groups.get(slug) ?? {slug, name, products: []};
    g.products.push({id: p.id, title: p.title});
    groups.set(slug, g);
  }

  const sellers = [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const log: string[] = [];

  if (apply) {
    for (const s of sellers) {
      try {
        const {id, created} = await ensureSeller(env, {
          slug: s.slug,
          displayName: s.name,
        });
        log.push(
          `${created ? 'CREATED' : 'exists '} seller "${s.name}" (${s.slug})`,
        );
        for (const p of s.products) {
          await setProductSeller(env, p.id, id);
          log.push(`  linked → ${p.title}`);
        }
      } catch (e) {
        log.push(`ERROR on "${s.name}": ${(e as Error).message}`);
      }
    }
  }

  return {
    configured: true as const,
    apply,
    applyHref: apply ? null : `?key=${encodeURIComponent(key)}&apply=1`,
    sellers: sellers.map((s) => ({
      slug: s.slug,
      name: s.name,
      productCount: s.products.length,
    })),
    log,
  };
}

export default function SyncSellers() {
  const data = useLoaderData<typeof loader>();

  if (!data.configured) {
    return (
      <div className="ui-container py-16">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight">
          Seller sync — not configured
        </h1>
        <p className="mt-3 text-muted">
          Set <code>PRIVATE_ADMIN_API_TOKEN</code> (a Shopify Admin API token with{' '}
          <code>write_metaobjects</code> + <code>write_products</code>) in your
          environment, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-container py-16">
      <h1 className="text-2xl font-extrabold uppercase tracking-tight">
        Seller sync {data.apply ? '— applied' : '— dry run'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {data.apply
          ? 'Changes were written to the store.'
          : 'Nothing was written. Add ?apply=1 to the URL to apply.'}
      </p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide">
        Sellers found ({data.sellers.length})
      </h2>
      <ul className="mt-3 divide-y divide-black/10 rounded-2xl bg-mint">
        {data.sellers.map((s) => (
          <li key={s.slug} className="flex justify-between px-4 py-2 text-sm">
            <span className="font-semibold text-ink">{s.name}</span>
            <span className="text-muted">
              /sellers/{s.slug} · {s.productCount} products
            </span>
          </li>
        ))}
      </ul>

      {data.apply && (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide">Log</h2>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-white">
            {data.log.join('\n')}
          </pre>
        </>
      )}

      {!data.apply && data.applyHref && (
        <a href={data.applyHref} className="btn btn-dark mt-8">
          Apply — create entries &amp; link products
        </a>
      )}
    </div>
  );
}

const SYNC_PRODUCTS_QUERY = `#graphql
  query SyncProducts($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 250) {
      nodes {
        id
        title
        vendor
        variants(first: 1) {
          nodes {
            sku
          }
        }
      }
    }
  }
` as const;
