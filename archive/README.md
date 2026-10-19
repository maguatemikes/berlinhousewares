# Archived Cloudflare Workers runtime files

Retired during the migration to a self-hosted Node/Express Docker app.
Kept for reference only — nothing here is on the runtime or build path.

- `server.ts.oxygen` — the old Worker entry (`fetch` + `scheduled` seller-sweep
  cron). Replaced by `server/index.ts` (Node/Express). The cron is now a host
  cron hitting `/admin/sync-sellers`.
- `wrangler.toml` — Workers config. Note the `[triggers] crons = ["*/10 * * * *"]`
  schedule and `SHOP_ID = "71626096792"`, both preserved in the new setup.

To redeploy to Cloudflare as an emergency rollback, restore these and
`npm i -D wrangler @shopify/mini-oxygen`.
