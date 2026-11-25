const CACHE = 'agentic-sheets-static-df5d7f9765a1c2a8404af6e4';
const ASSETS = ["./index.html","./app.mjs","./styles.css","./record-views.mjs","./core.mjs","./schema.mjs","./formula.mjs","./storage.mjs","./manifest.webmanifest","./shared-ui-profile.css","./floating-panel.js","./panel-section.js","./collection-layout.js","./skills-commands.js","./toolbar-icons.js","./icons.json","./floating-panel.mjs","./LICENSE","./LICENSE.design-system","./LICENSE.base","./artifact-manifest.json"];
const PACKED = {"browser-data-view.js":"f0c90cd00f262b9ea72ccf15beda01fe1ff63ca8d8d41f98c9eb4d581ccace0b","browser-data-view.css":"57218f6fd311491d4a8614716542825689f373932fa69b89dbcc8a7f9c607f85"};
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
