const CACHE = 'agentic-sheets-static-3d63001a1d295ced7d60809c';
const ASSETS = ["./index.html","./app.mjs","./styles.css","./record-views.mjs","./core.mjs","./schema.mjs","./formula.mjs","./storage.mjs","./manifest.webmanifest","./shared-ui-profile.css","./floating-panel.js","./panel-section.js","./collection-layout.js","./skills-commands.js","./toolbar-icons.js","./icons.json","./floating-panel.mjs","./LICENSE","./LICENSE.design-system","./LICENSE.base","./artifact-manifest.json"];
const PACKED = {"browser-data-view.js":"d7e077e6a765fe0bb9453d94637717046d453b2ecd9b3c01cb6c5bf23a09ae31","browser-data-view.css":"bc1f7f82de43ef90214ad8d624653133068221cb259e36724699772fa36f64cb"};
const scope = new URL(self.registration.scope);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    for (const [name, expected] of Object.entries(PACKED)) {
      const response = await fetch(new URL(name + '.gz', scope), { cache: 'reload', redirect: 'error' });
      if (!response.ok) throw new Error('Record view unavailable: ' + name);
      const body = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
      if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== expected)
        throw new Error('Record view integrity failure: ' + name);
      await cache.put(new URL(name, scope), new Response(body, { headers: {
        'Content-Type': name.endsWith('.css') ? 'text/css' : 'text/javascript',
      } }));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('agentic-sheets-static-') && name !== CACHE)
    .map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const navigation = request.mode === 'navigate' && [scope.pathname, `${scope.pathname}index.html`].includes(url.pathname);
    return (await cache.match(navigation ? new URL('index.html', scope).href : request)) ?? fetch(request);
  }));
});
