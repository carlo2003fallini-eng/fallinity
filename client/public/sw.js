// Fallinity FEOS — Service Worker minimale
// Fallinity PWA: viene memorizzata soltanto la shell dell'app.
// API, autenticazione e file utente restano sempre network-only.
const buildVersion = new URL(self.location.href).searchParams.get("v") || "dev";
const safeVersion = buildVersion.replace(/[^a-zA-Z0-9_-]/g, "-");
const SHELL_CACHE = `fallinity-shell-${safeVersion}`;
const RUNTIME_CACHE = `fallinity-runtime-${safeVersion}`;
const FALLINITY_CACHE_PREFIX = "fallinity-";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.ico"];
const PUBLIC_BRAND_ASSETS = new Set(["/manus-storage/fallinity-logo_8c31d682.png"]);

const OFFLINE_HTML = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0f0a"><title>Fallinity offline</title><style>body{margin:0;background:#070b07;color:#f3f5f3;font:16px system-ui;min-height:100vh;display:grid;place-items:center}.box{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.4rem}p{color:#a4aca4;line-height:1.5}button{border:0;border-radius:12px;background:#4ade80;color:#071108;font-weight:700;padding:.8rem 1.2rem}</style></head><body><main class="box"><h1>Fallinity è offline</h1><p>L'interfaccia non è ancora disponibile su questo dispositivo. Riconnettiti almeno una volta per scaricare l'ultima versione.</p><button onclick="location.reload()">Riprova</button></main></body></html>`;

function isSensitiveRequest(url) {
  return url.pathname.startsWith("/api")
    || url.pathname.startsWith("/trpc")
    || url.pathname.startsWith("/oauth")
    || url.pathname.startsWith("/api/oauth")
    || url.pathname.startsWith("/__manus__")
    || (url.pathname.startsWith("/manus-storage/") && !PUBLIC_BRAND_ASSETS.has(url.pathname))
    || url.pathname === "/sw.js";
}

function isCacheableResponse(response) {
  return response && response.ok && response.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(FALLINITY_CACHE_PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    const urls = event.data.urls
      .map((value) => {
        try { return new URL(value, self.location.origin); } catch { return null; }
      })
      .filter((url) => url && url.origin === self.location.origin && !isSensitiveRequest(url));
    event.waitUntil(caches.open(RUNTIME_CACHE).then(async (cache) => {
      await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url.href, { credentials: "same-origin" });
          if (isCacheableResponse(response)) await cache.put(url.href, response);
        } catch {
          // L'asset potrà essere memorizzato al prossimo caricamento online.
        }
      }));
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: true }) || await caches.match("/");
          return cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        })
    );
    return;
  }

  const cacheableDestinations = new Set(["script", "style", "image", "font", "manifest"]);
  if (!cacheableDestinations.has(req.destination)) return;

  event.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((response) => {
      if (isCacheableResponse(response)) {
        const copy = response.clone();
        event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)));
      }
      return response;
    }).catch(() => cached || Response.error());
    return cached || network;
  }));
});
