/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

/**
 * App environment — previously provided by `@shopify/oxygen-workers-types` on
 * Workers. Declared locally for the Node runtime (values come from process.env
 * / the root-only .env). Field set + requiredness mirrors Hydrogen's
 * `HydrogenEnv` so `createHydrogenContext(env)` and `getShopAnalytics` typecheck.
 */
declare global {
  interface Env {
    NODE_ENV?: string;
    // Required by Hydrogen (HydrogenEnv)
    SESSION_SECRET: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
    PUBLIC_CHECKOUT_DOMAIN: string;
    SHOP_ID: string;
    // Google Tag Manager container id (e.g. GTM-XXXXXXX). Optional: when unset,
    // the GTM snippet + dataLayer bridge are no-ops.
    PUBLIC_GTM_ID?: string;
    // Berlin-specific (ResaleOS / Admin / seller-sync gate)
    PRIVATE_RESALEOS_API_KEY?: string;
    PRIVATE_ADMIN_API_TOKEN?: string;
    PRIVATE_ADMIN_CLIENT_ID?: string;
    PRIVATE_ADMIN_CLIENT_SECRET?: string;
    PRIVATE_SYNC_SECRET?: string;
  }
}
