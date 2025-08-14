self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("fixmyroom-cache-v1").then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/dashboard.html",
        "/login.html",
        "/manifest.json",
        "/img/icon-192.png",
        "/img/icon-512.png",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
