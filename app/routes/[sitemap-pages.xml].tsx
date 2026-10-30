import type {Route} from './+types/[sitemap-pages.xml]';
import {getSellerDirectory} from '~/lib/sellers.server';

/**
 * Custom sitemap for routes Shopify's auto sitemap (`/sitemap.xml`) doesn't know
 * about — the homepage and our own Hydrogen routes (consign, the seller
 * directory, and every seller storefront). Referenced from `[robots.txt].tsx`
 * and submitted in Search Console alongside `sitemap.xml`.
 *
 * Seller URLs are pulled live from the directory, so this auto-updates as
 * sellers appear — no manual list to maintain.
 */

// Static custom routes not covered by Shopify's content sitemap.
const STATIC_PATHS = ['/', '/consign', '/sellers', '/collections/all', '/pages/about'];

export async function loader({
  request,
  context: {storefront},
}: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;

  let sellerPaths: string[] = [];
  try {
    const sellers = await getSellerDirectory(storefront);
    sellerPaths = sellers.map((s) => `/sellers/${s.handle}`);
  } catch {
    // If the seller scan fails, still emit the static routes.
  }

  const now = new Date().toISOString();
  const paths = [...STATIC_PATHS, ...sellerPaths];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths
      .map(
        (p) =>
          `  <url><loc>${origin}${p}</loc><lastmod>${now}</lastmod></url>`,
      )
      .join('\n') +
    `\n</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}
