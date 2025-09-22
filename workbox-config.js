/* global module, process */
const clientsClaim = process.env.SW_CLIENTS_CLAIM === 'true';
const skipWaiting = process.env.SW_SKIP_WAITING === 'true';

module.exports = {
  mode: 'production',
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,svg,png,webp,ico,woff2,ttf}'],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8 MB
  swDest: 'dist/service-worker.js',
  clientsClaim, // controlled by env
  skipWaiting, // controlled by env
  // Optional: for multipage/offline navigation, uncomment:
  navigateFallback: 'index.html',

  runtimeCaching: [
    // Same-origin non-precached requests (extra safety)
    {
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'runtime-same-origin' },
    },
    // Google Fonts
    {
      urlPattern: ({ url }) =>
        url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'google-fonts' },
    },
    // gstatic SDKs
    {
      urlPattern: ({ url }) => url.origin === 'https://www.gstatic.com',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'gstatic' },
    },
    // Avoid caching Firebase auth endpoints
    {
      urlPattern: ({ url }) =>
        url.origin === 'https://www.googleapis.com' && url.pathname.startsWith('/identitytoolkit/'),
      handler: 'NetworkOnly',
    },
  ],
};
