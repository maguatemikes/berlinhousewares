# Berlin Houseware — Design System

The single source of truth for how this storefront looks and is built. **Read
this before creating or editing any page, route, or UI component** so new work
stays visually and structurally consistent with the rest of the site.

Brand: **Berlin Houseware** — a Shopify Hydrogen storefront for **ecommerce +
consignment** (new goods and verified pre-loved homeware). Aesthetic: Nike /
Off-White influence — bold, lots of whitespace, pill buttons — recolored to a
**light-green** palette.

---

## 1. Stack & architecture

- **Hydrogen** on **React Router 7 (Remix)** — full SSR. Keep the standard
  Hydrogen data patterns (loaders, `useOptimisticVariant`, `getProductOptions`,
  `CartForm`, `Analytics`). Don't replace them with client-only state.
- **Tailwind v4** (CSS-first). Tokens live in `app/styles/tailwind.css` under
  `@theme`; they auto-generate utilities (`bg-brand-500`, `text-ink`, …).
- **Font: Inter**, self-hosted via `@fontsource/inter` (weights 400–800).
- Checkout is **Shopify-hosted** (`cart.checkoutUrl`) — never build a custom
  checkout.

### CSS cascade (important)

`reset.css` is wrapped in `@layer base`; `app.css` in `@layer components`; our
tokens/primitives are in `@theme` / `@layer components` / `@layer utilities`.
Because Tailwind's `utilities` layer sits above `base`/`components`, **Tailwind
utility classes always win** — style with utilities directly, **no `!important`
needed**. (If you ever add global element rules, keep them inside a layer or
they'll override every utility.)

---

## 2. Design tokens

### Color (from `@theme` in `app/styles/tailwind.css`)

| Token | Value | Use |
|---|---|---|
| `ink` | `#101410` | Primary text, dark surfaces, dark buttons |
| `paper` | `#ffffff` | Default background |
| `muted` | `#6b7280` | Secondary text |
| `brand-50…900` | light-green scale | Accents; **500 `#37ad57`** is the primary brand green |
| `mint` `#eef8ef` / `mint-deep` `#e0f2e4` | soft green surfaces | Section bands, image tiles, hover fills |

Accent usage: brand green for eyebrows, active/hover states, badges, the "Sale"
nav item, promo tiles, focus rings. Dark text stays `ink`. Section backgrounds
**alternate** `paper` / `mint`.

### Typography (type scale — never override globally)

- Font: `--font-sans` / `--font-display` = Inter.
- Headings are **UPPERCASE, `font-extrabold`, `tracking-tight`**.
- Scale: eyebrow **12px** → body **16px** → section `h2` **`text-3xl md:text-4xl`**
  → hero `h1` **`text-5xl md:text-8xl`**.
- `.eyebrow` utility = uppercase, `tracking-[0.14em]`, bold, 12px, usually
  `text-brand-700` (or `text-brand-400` on dark).

### Radius

Pills `rounded-full` (buttons, chips, swatches). Cards/tiles `rounded-2xl`
(products) / `rounded-3xl` (large tiles, gallery, hero image). Small thumbs
`rounded-xl`.

---

## 3. Layout primitives (reuse these — don't reinvent)

- **`.ui-container`** — page gutter: `max-width: 90rem`, centered,
  `padding-inline` 1.25rem (2.5rem ≥768px). Every full-width section nests one.
- **Section pattern** — every content section is a **full-width `<section>`
  (optional bg) containing an inner container** with the standard rhythm:
  ```tsx
  <section className="bg-paper"> {/* or bg-mint */}
    <div className="ui-container py-16 md:py-24">…</div>
  </section>
  ```
  On the homepage this is the `Section` + `SectionHead` helpers
  (`app/routes/_index.tsx`). **Do not** put `ui-container` directly on a
  `<section>` — that breaks full-width backgrounds and vertical rhythm.
- **Vertical rhythm**: content sections `py-16 md:py-24`; thin utility strips
  `py-8`. Section headers: eyebrow + `h2` + optional right-aligned CTA link.

---

## 4. Components & patterns

### Buttons (`@layer components` in `tailwind.css`)

All buttons are **pills** (`.btn` = inline-flex, `rounded-full`, weight 600,
subtle active scale). Variants:

- `.btn-dark` — ink bg, white text; **hovers to brand green**. Primary CTA.
- `.btn-brand` — brand-500 bg, dark-green text. Bright CTA.
- `.btn-outline` — 1.5px ink border, fills ink on hover. Secondary.
- `.btn-ghost` — translucent white, for use over imagery.

### Cards & tiles

- Product card (`ProductItem`): `rounded-2xl` mint image tile, `group-hover`
  image zoom, hover wishlist heart + "View product" bar, title / "Berlin
  Houseware" subtitle / brand-green price.
- Collection/category tiles: `rounded-3xl`, image with dark gradient scrim,
  white uppercase title bottom-left.

### Header (`app/components/Header.tsx`)

Nike/Off-White structure, three tiers, `sticky top-0 z-50`:
1. **Utility bar** (`#f5f5f5`): left tagline, right links (Find a Store · Help ·
   Join Us · Sign In).
2. **Main bar**: `berlinhouseware` wordmark logo (green "houseware"), centered
   category nav, search pill (`#f5f5f5`, → `/search`), favorites heart, bag +
   count badge.
3. **Mega-menu** dropdowns on hover (full-width, columns + promo tile).

Nav hover affordance = animated **green underline** (`after:` element). Links do
**not** get a text-decoration underline on hover (that global rule was removed).

### Footer

Dark (`ink`) multi-column: `berlinhouseware` wordmark + blurb + socials, static
link columns, dynamic Shopify policy menu, bottom bar.

### Product detail page

Two equal columns. Left: `ProductGallery` (vertical thumbnail rail capped at
**4 visible then scroll**, scrollbar hidden via `.no-scrollbar`; main 4:5 image;
prev/next arrows). Right: title + rating, price, installments line, **Select
Color** (round swatches) / **Select Size** (boxes) / **Quantity** stepper,
**Add to cart (outline) + Buy it now (dark)**, trust line, and
**Description / Shipping & Returns / Details** accordions (`<details>`).

Variant selection is **URL-driven** (`?Color=…&Size=…`) so it's SSR-shareable —
keep it that way; only quantity is local state.

### Forms

Inputs: `rounded-2xl` (or `rounded-full` for search), `border-black/15`, focus
`border-brand-500`. Labels `text-sm font-semibold`. Validation errors
`text-red-600`. See `app/routes/consign.tsx` for the reference form + server
`action` pattern.

### Icons & imagery

**Icons are for functional UI affordances only** — search, cart, menu, chevrons/
arrows, form-field states, social links. Inline SVG, `viewBox="0 0 24 24"`,
`stroke="currentColor" strokeWidth="2"`, round caps/joins. No icon libraries.

**Do not use decorative / illustrative icons as content or imagery.** Category
tiles, feature tiles, collection cards, and the hero use **real photography**
(Shopify collection/product images, or bundled assets in `public/`). If an image
isn't available yet, fall back to a **branded color / gradient tile with a text
label** — never a placeholder icon. Photographic content always beats icon
illustrations for this brand.

### Utilities

- `.no-scrollbar` — scrollable but scrollbar hidden (all engines).
- `.eyebrow` — small uppercase label.

---

## 5. Do / Don't

**Do**
- Reuse `.ui-container`, the Section pattern, `.btn-*`, `.eyebrow`, and existing
  components before writing new markup.
- Keep the alternating paper/mint bands and `py-16 md:py-24` rhythm.
- Uppercase, extrabold, tracking-tight headings; green accents; pill buttons.
- Preserve standard Hydrogen data flow and URL-driven variant state.

**Don't**
- Use decorative/illustrative **icons as content or imagery** — category/feature
  tiles and hero use **real photos** (with a branded color-tile fallback, never a
  placeholder icon). Icons are for functional UI only.
- Add `!important` (the layer setup makes it unnecessary).
- Put `ui-container` on a `<section>` element itself.
- Introduce new fonts, non-green accent colors, or square/hard-cornered buttons.
- Add global element CSS rules outside a `@layer`.
- Build custom checkout or move variant selection into React state.

---

_When in doubt, open an existing route/component that already does the thing and
match it. Consistency > cleverness._
