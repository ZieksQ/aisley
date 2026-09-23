import type { Plugin } from 'vite'

/** Cache only the built public application shell; never API responses or account data. */
export function receivingOfflinePlugin(): Plugin {
  return {
    name: 'receiving-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((name) => /\.(js|css)$/.test(name))
      const version = assets.join('|').split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0)
      this.emitFile({ type: 'asset', fileName: 'receiving-sw.js', source: `
const CACHE = 'aisley-receiving-shell-${version}';
const ASSETS = ${JSON.stringify(assets.map((name) => `/${name}`))};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', ...ASSETS])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('aisley-receiving-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(event.request)) || fetch(event.request)));
  } else if (event.request.mode === 'navigate' && ['/receive-at-hub', '/inbound-linehaul'].includes(url.pathname) && url.searchParams.has('trip')) {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then((cache) => cache.match('/'))));
  }
});
` })
    },
  }
}
