export const PWA_UPDATE_EVENT = "fallinity:pwa-update";

type VersionPayload = {
  version?: string;
  timestamp?: number;
};

async function getBuildVersion(): Promise<string> {
  try {
    const response = await fetch(`/__manus__/version.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return "dev";
    const payload = (await response.json()) as VersionPayload;
    return payload.version || String(payload.timestamp || "dev");
  } catch {
    return "offline";
  }
}

function notifyUpdate(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT, { detail: registration }));
}

function watchRegistration(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) notifyUpdate(registration);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) notifyUpdate(registration);
    });
  });
}

function warmLoadedAssets(registration: ServiceWorkerRegistration) {
  const worker = registration.active;
  if (!worker) return;
  const urls = performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((resourceUrl) => {
      const url = new URL(resourceUrl, window.location.origin);
      return url.origin === window.location.origin && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/__manus__") && !url.pathname.startsWith("/manus-storage/");
    });
  worker.postMessage({ type: "CACHE_URLS", urls: Array.from(new Set(urls)) });
}

export async function registerFallinityPWA() {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;

  try {
    let currentVersion = await getBuildVersion();
    let registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(currentVersion)}`, { scope: "/" });
    watchRegistration(registration);
    const readyRegistration = await navigator.serviceWorker.ready;
    warmLoadedAssets(readyRegistration);

    const refreshRegistration = async () => {
      if (!navigator.onLine) return;
      const nextVersion = await getBuildVersion();
      if (nextVersion !== currentVersion && nextVersion !== "offline") {
        registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(nextVersion)}`, { scope: "/" });
        currentVersion = nextVersion;
        watchRegistration(registration);
      } else {
        await registration.update();
      }
    };

    window.setInterval(refreshRegistration, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshRegistration();
    });
    window.addEventListener("online", () => void refreshRegistration());
    console.info("[Fallinity PWA] Service worker registrato:", registration.scope);
  } catch (error) {
    console.warn("[Fallinity PWA] Registrazione non disponibile:", error);
  }
}
