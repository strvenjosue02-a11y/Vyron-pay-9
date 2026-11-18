// Guarda la página en el teléfono para que abra aunque la señal falle (casas en zonas remotas).
const CACHE = "refugio-v3";
const CORE = ["./", "index.html", "config.js", "img/fondo-port.jpg", "img/fondo-land.jpg", "img/foto-exterior.jpg", "img/foto-interior.jpg", "img/det-loft.jpg", "img/det-sala.jpg", "img/det-cocina.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre tarifas y fechas al día); si no hay señal, la copia guardada.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || url.hostname === "cdnjs.cloudflare.com";
  if (!mine) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
