/* Beat Splicer offline worker: the app opens with no signal once it has been opened online.
   The page is fetched fresh when online (so updates arrive) and served from the cache when not;
   scripts, fonts and face models from the CDN are kept after their first use. */
const VERSION = "@VERSION@", SHELL = `shell-${VERSION}`, CDN = "cdn-v1";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {
      e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(SHELL).then(ca => ca.put("index.html", c)); return res; }).catch(() => caches.match("index.html")));
    } else e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(SHELL).then(ca => ca.put(r, c)); } return res; })));
    return;
  }
  if (/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)) {
    e.respondWith(caches.open(CDN).then(ca => ca.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === "opaque") ca.put(r, res.clone()); return res; }))));
  }
});
