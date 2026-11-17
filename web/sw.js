// Service worker mínimo: permite mostrar avisos del sistema también en el celular.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window" }).then((c) => (c[0] ? c[0].focus() : self.clients.openWindow("./")))); });
