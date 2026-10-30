/**
 * Read the public request origin exposed by the root loader, so route `meta`
 * functions can build **absolute** canonical / og:url values (Lighthouse and
 * social scrapers require absolute URLs — relative ones fail the SEO audit).
 *
 * Usage in a route meta:
 *   export const meta = ({data, matches}) => {
 *     const url = `${siteOrigin(matches)}/collections/all`;
 *     ...
 *   };
 *
 * Falls back to '' (relative) if the root data isn't available.
 */
export function siteOrigin(matches: ReadonlyArray<unknown>): string {
  const root = matches.find(
    (m): m is {id: string; data?: unknown} =>
      !!m &&
      typeof m === 'object' &&
      (m as {id?: unknown}).id === 'root',
  );
  const data = root?.data as {origin?: string} | undefined;
  return data?.origin ?? '';
}

/**
 * Default site-wide social-share image — the homepage hero. Used for og:image /
 * twitter:image on any page that doesn't supply its own, so links previewed on
 * Facebook, X, iMessage, Slack, etc. always show a branded image.
 */
export const SITE_SHARE_IMAGE =
  'https://cdn.shopify.com/s/files/1/0716/2609/6792/files/hero.png';

/**
 * Open Graph + Twitter-card meta descriptors for a page. Spread into a route's
 * `meta` return so every shared page gets a consistent title/description/url and
 * a share image (defaults to {@link SITE_SHARE_IMAGE}). React Router does not
 * merge parent→child meta, so each shareable route must emit these itself.
 */
export function socialMeta({
  title,
  description,
  url,
  image = SITE_SHARE_IMAGE,
  type = 'website',
}: {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: string;
}) {
  return [
    {property: 'og:type', content: type},
    {property: 'og:site_name', content: 'Berlin Houseware'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    ...(url ? [{property: 'og:url', content: url}] : []),
    {property: 'og:image', content: image},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    {name: 'twitter:image', content: image},
  ];
}
