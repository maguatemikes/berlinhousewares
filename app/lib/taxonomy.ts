/**
 * Shopify Standard Product Taxonomy helpers — shared by the header nav
 * (`root.tsx`) and the homepage "Shop by category" section (`_index.tsx`) so the
 * vertical map lives in exactly one place.
 *
 * Category ids are hierarchical, `vertical-l1-l2-…` (e.g. `aa-1-4` = Apparel &
 * Accessories › Clothing › Dresses). The 2-letter prefix is the top-level
 * vertical (department). This is Shopify's fixed, public top-level list.
 */
export const TAXONOMY_VERTICALS: Record<string, string> = {
  aa: 'Apparel & Accessories',
  ae: 'Arts & Entertainment',
  ap: 'Animals & Pet Supplies',
  bi: 'Business & Industrial',
  bt: 'Baby & Toddler',
  bu: 'Bundles',
  co: 'Cameras & Optics',
  el: 'Electronics',
  fb: 'Food, Beverages & Tobacco',
  fr: 'Furniture',
  gc: 'Gift Cards',
  ha: 'Hardware',
  hb: 'Health & Beauty',
  hg: 'Home & Garden',
  lb: 'Luggage & Bags',
  ma: 'Mature',
  me: 'Media',
  na: 'Uncategorized',
  os: 'Office Supplies',
  pa: 'Product Add-Ons',
  rc: 'Religious & Ceremonial',
  se: 'Services',
  sg: 'Sporting Goods',
  so: 'Software',
  tg: 'Toys & Games',
  vp: 'Vehicles & Parts',
};

/** Link to the Shop page with a Storefront category filter pre-applied. */
export const shopFilterTo = (input: string) =>
  `/collections/all?filter=${encodeURIComponent(input)}`;

/** The top-level vertical prefix of a taxonomy category id (e.g. `aa-1-4` → `aa`). */
export const verticalOf = (categoryId: string): string =>
  categoryId.split('-')[0] || 'other';

/** Display name for a vertical prefix; unknown prefixes fall back to "More". */
export const verticalLabel = (vertical: string): string =>
  TAXONOMY_VERTICALS[vertical] ?? 'More';

/**
 * Link to a whole department (vertical). Filtering by the parent vertical id is
 * hierarchical, so it returns every product in the department.
 */
export const departmentFilterTo = (vertical: string): string =>
  vertical === 'other'
    ? '/collections/all'
    : shopFilterTo(JSON.stringify({category: {id: vertical}}));
