import type {Route} from './+types/api.upload-design';
import {memDesigns} from '~/lib/design-store.server';

/**
 * Backend receiver for a finished design. The editor POSTs the exported PNG
 * (data URL) here; we store it in R2 (binding DESIGNS) and return a public URL
 * served by app/routes/designs.$.tsx. That URL is what rides in the cart
 * line-item attribute onto the Shopify order.
 *
 * If R2 isn't bound (not configured yet), we still confirm receipt so the flow
 * is provable — the image genuinely reached the backend.
 */
// Minimal shape of the KV namespace binding we use.
type DesignKV = {
  put(
    key: string,
    value: ArrayBuffer | string,
    opts?: {metadata?: {contentType?: string}},
  ): Promise<void>;
};

declare global {
  interface Env {
    // KV namespace for finished design/print files (optional until configured).
    DESIGNS?: DesignKV;
  }
}

function dataUrlToBytes(dataUrl: string): {bytes: Uint8Array; contentType: string} {
  const [meta, b64] = dataUrl.split(',');
  const contentType = /data:(.*?);base64/.exec(meta)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return {bytes, contentType};
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({error: 'Method not allowed'}, {status: 405});
  }

  const {image, filename} = (await request.json()) as {
    image?: string;
    filename?: string;
  };
  if (!image?.startsWith('data:image/')) {
    return Response.json({error: 'No image'}, {status: 400});
  }

  const {bytes, contentType} = dataUrlToBytes(image);
  const safe = (filename || 'design.png').replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;

  const env = context.env as {DESIGNS?: DesignKV};
  const origin = new URL(request.url).origin;

  // Store in KV when available.
  if (env.DESIGNS) {
    await env.DESIGNS.put(key, bytes.buffer as ArrayBuffer, {
      metadata: {contentType},
    });
    return Response.json({
      stored: true,
      url: `${origin}/designs/${key}`,
      bytes: bytes.byteLength,
    });
  }

  // Dev fallback (no R2 binding, e.g. `npm run dev`): keep it in memory so the
  // serve route can return it and the demo works end-to-end.
  memDesigns.set(key, {bytes, contentType});
  return Response.json({
    stored: true,
    dev: true,
    url: `${origin}/designs/${key}`,
    bytes: bytes.byteLength,
  });
}
