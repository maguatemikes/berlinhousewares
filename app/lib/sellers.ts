/**
 * Client-safe seller helpers (no server-only imports), so both the loader
 * (sellers.server.ts) and UI components (PDP, product cards) share ONE slug
 * definition. Keep the vendor→handle rule here as the single source of truth.
 */

/** URL-safe slug for a vendor name (the `/sellers/{handle}` segment). */
export function sellerHandle(vendor: string): string {
  return vendor
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
