/**
 * Workbox runtime caching strategies for next-pwa.
 * Read-side: stale-while-revalidate caches keep online UX snappy; the
 * IndexedDB mirror (M2) is the source of truth offline.
 * Write-side: all POST/PATCH/DELETE bypass the SW — the app-level
 * mutation queue (M3) owns durability and idempotency.
 *
 * Plain JS (.mjs) so it can be imported directly by next.config.mjs.
 */

const ONE_MINUTE = 60;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

/** @type {import('next-pwa').RuntimeCaching[]} */
export const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts-webfonts",
      expiration: { maxEntries: 10, maxAgeSeconds: ONE_YEAR },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|webmanifest)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "static-image-assets",
      expiration: { maxEntries: 64, maxAgeSeconds: ONE_MONTH },
    },
  },
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "next-static",
      expiration: { maxEntries: 200, maxAgeSeconds: ONE_MONTH },
    },
  },
  {
    urlPattern: /\/api\/auth\/.*/i,
    handler: "NetworkOnly",
  },
  {
    urlPattern: /\/api\/conflicts\/.*/i,
    handler: "NetworkOnly",
  },
  {
    urlPattern: /\/api\/lend-safety.*/i,
    handler: "NetworkOnly",
  },
  {
    urlPattern: /\/api\/transactions\/transfer.*/i,
    handler: "NetworkOnly",
  },
  {
    urlPattern: /\/api\/reports\/.*/i,
    handler: "StaleWhileRevalidate",
    method: "GET",
    options: {
      cacheName: "api-reports",
      expiration: { maxEntries: 30, maxAgeSeconds: 5 * ONE_MINUTE },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: /\/api\/transactions(\?.*)?$/i,
    handler: "StaleWhileRevalidate",
    method: "GET",
    options: {
      cacheName: "api-transactions",
      expiration: { maxEntries: 100, maxAgeSeconds: 10 * ONE_MINUTE },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: /\/api\/(receivables|split-bills|obligations).*/i,
    handler: "StaleWhileRevalidate",
    method: "GET",
    options: {
      cacheName: "api-ledger",
      expiration: { maxEntries: 50, maxAgeSeconds: 15 * ONE_MINUTE },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: /\/api\/(accounts|categories|counterparties|settings|budgets|recurring|holdings).*/i,
    handler: "StaleWhileRevalidate",
    method: "GET",
    options: {
      cacheName: "api-entities",
      expiration: { maxEntries: 50, maxAgeSeconds: ONE_HOUR },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: ({ request, url }) =>
      request.destination === "document" && url.origin === self.location.origin,
    handler: "NetworkFirst",
    options: {
      cacheName: "html-pages",
      networkTimeoutSeconds: 3,
      expiration: { maxEntries: 20, maxAgeSeconds: ONE_DAY },
      cacheableResponse: { statuses: [200] },
    },
  },
];
