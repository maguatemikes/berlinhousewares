/**
 * Dev-only in-memory store for uploaded design files. Used ONLY when the R2
 * binding (DESIGNS) isn't available (i.e. `npm run dev`, where mini-oxygen
 * doesn't simulate R2). In production R2 is used and this is never touched.
 *
 * Lives in one module so api.upload-design (writer) and designs.$ (reader)
 * share the same Map within the dev process.
 */
export const memDesigns = new Map<
  string,
  {bytes: Uint8Array; contentType: string}
>();
