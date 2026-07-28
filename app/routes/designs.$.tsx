import type {Route} from './+types/designs.$';
import {memDesigns} from '~/lib/design-store.server';

/**
 * Serves a stored design/print file from R2 (binding DESIGNS) at
 * /designs/<key>. This is the public URL returned by api.upload-design and
 * referenced in the order's line-item attribute.
 */
type DesignKV = {
  getWithMetadata(
    key: string,
    opts: {type: 'arrayBuffer'},
  ): Promise<{value: ArrayBuffer | null; metadata: {contentType?: string} | null}>;
};

export async function loader({params, context}: Route.LoaderArgs) {
  const key = params['*'];
  if (!key) throw new Response('Not found', {status: 404});
  const env = context.env as {DESIGNS?: DesignKV};

  const headers = new Headers();
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Production: KV.
  if (env.DESIGNS) {
    const {value, metadata} = await env.DESIGNS.getWithMetadata(key, {
      type: 'arrayBuffer',
    });
    if (!value) throw new Response('Not found', {status: 404});
    headers.set('Content-Type', metadata?.contentType ?? 'image/png');
    return new Response(value, {headers});
  }

  // Dev fallback: in-memory store.
  const mem = memDesigns.get(key);
  if (!mem) throw new Response('Not found', {status: 404});
  headers.set('Content-Type', mem.contentType);
  return new Response(mem.bytes as unknown as BodyInit, {headers});
}
