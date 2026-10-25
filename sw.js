// Sigara Sipariş servis çalışanı. Uygulamada değişiklik yaptığında CACHE adındaki sürümü artır (v1 -> v2).
var CACHE = "sigara-siparis-v4";
var SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);

  // Sayfa: önce internet (güncel hali gelsin), olmazsa kayıtlı kopya
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r).then(function (res) {
        var cp = res.clone();
        caches.open(CACHE).then(function (c) { c.put("./", cp); });
        return res;
      }).catch(function () { return caches.match("./"); })
    );
    return;
  }

  // Aynı siteden dosyalar ve Firebase kod dosyaları: kayıtlıyı göster, arkadan güncelle
  var isFirebaseJs = /(^|\.)gstatic\.com$/.test(u.hostname) && u.pathname.indexOf("/firebasejs/") === 0;
  var isFirebaseCdn = u.hostname === "cdn.jsdelivr.net" && u.pathname.indexOf("/npm/firebase@") === 0;
  if (u.origin === location.origin || isFirebaseJs || isFirebaseCdn) {
    e.respondWith(
      caches.match(r).then(function (hit) {
        var net = fetch(r).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) {
            var cp = res.clone();
            caches.open(CACHE).then(function (c) { c.put(r, cp); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
  // Diğer her şey (Firebase veritabanı ve giriş istekleri) doğrudan internete gider
});
