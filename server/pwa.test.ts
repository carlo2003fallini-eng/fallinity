import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { clearOfflineDraft, loadOfflineDraft, offlineDraftKey, saveOfflineDraft } from "../client/src/lib/offlineDraft";

const manifest = JSON.parse(readFileSync(new URL("../client/public/manifest.webmanifest", import.meta.url), "utf8"));
const serviceWorker = readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8");
const pwaClient = readFileSync(new URL("../client/src/lib/pwa.ts", import.meta.url), "utf8");
const pwaController = readFileSync(new URL("../client/src/components/PWAController.tsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../client/src/_core/hooks/useAuth.ts", import.meta.url), "utf8");
const movementSource = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimento.tsx", import.meta.url), "utf8");

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe("Fallinity PWA — installazione", () => {
  it("espone un manifest completo per avvio standalone", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("it");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any maskable" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any maskable" }),
    ]));
    expect(manifest.shortcuts).toHaveLength(2);
  });

  it("gestisce prompt Android, istruzioni iOS e installazione completata", () => {
    expect(pwaController).toContain("beforeinstallprompt");
    expect(pwaController).toContain("appinstalled");
    expect(pwaController).toContain("Aggiungi alla schermata Home");
    expect(pwaController).toContain("Installa app");
    expect(pwaController).toContain("display-mode: standalone");
  });
});

describe("Fallinity PWA — cache e aggiornamenti", () => {
  it("versiona shell e runtime usando la versione della pubblicazione", () => {
    expect(serviceWorker).toContain("new URL(self.location.href).searchParams.get");
    expect(serviceWorker).toContain("fallinity-shell-");
    expect(serviceWorker).toContain("fallinity-runtime-");
    expect(pwaClient).toContain("/__manus__/version.json");
    expect(pwaClient).toContain("cache: \"no-store\"");
  });

  it("mantiene API, autenticazione e file utente fuori dalla cache", () => {
    for (const path of ["/api", "/trpc", "/oauth", "/__manus__", "/manus-storage/"]) {
      expect(serviceWorker).toContain(path);
    }
    expect(serviceWorker).toContain("isSensitiveRequest(url)");
  });

  it("fornisce shell e fallback di navigazione offline", () => {
    expect(serviceWorker).toContain("APP_SHELL");
    expect(serviceWorker).toContain("req.mode === \"navigate\"");
    expect(serviceWorker).toContain("OFFLINE_HTML");
    expect(serviceWorker).toContain("CACHE_URLS");
  });

  it("richiede conferma prima di attivare una nuova versione", () => {
    expect(serviceWorker).toContain("SKIP_WAITING");
    expect(pwaController).toContain("Aggiornamento disponibile");
    expect(pwaController).toContain("Aggiorna ora");
    expect(pwaController).toContain("controllerchange");
  });
});

describe("Fallinity PWA — bozze e sicurezza offline", () => {
  it("isola la chiave bozza per ambito, utente e azienda", () => {
    expect(offlineDraftKey("nuovo-movimento", 12, "company-a")).toBe("fallinity:draft:nuovo-movimento:12:company-a");
    expect(offlineDraftKey("nuovo-movimento", 12, "company-b")).not.toBe(offlineDraftKey("nuovo-movimento", 12, "company-a"));
  });

  it("salva, ricarica, scade e cancella una bozza", () => {
    const storage = memoryStorage();
    const key = offlineDraftKey("nuovo-movimento", 12, "company-a");
    const stored = saveOfflineDraft(storage, key, { importo: "25,00" }, 1_000);
    expect(loadOfflineDraft<{ importo: string }>(storage, key, stored.savedAt + 500)?.data.importo).toBe("25,00");
    expect(loadOfflineDraft(storage, key, stored.savedAt + 1_001)).toBeNull();
    saveOfflineDraft(storage, key, { importo: "10,00" });
    clearOfflineDraft(storage, key);
    expect(storage.removeItem).toHaveBeenCalledWith(key);
  });

  it("non accoda automaticamente mutation finanziarie senza rete", () => {
    expect(mainSource).toContain('networkMode: "always"');
    expect(movementSource).toContain("if (!navigator.onLine)");
    expect(movementSource.indexOf("if (!navigator.onLine)")).toBeLessThan(movementSource.indexOf("createMutation.mutate({"));
    expect(movementSource).toContain("non è stato inviato");
  });

  it("ripristina l’ultimo utente solo offline e lo rimuove al logout", () => {
    expect(authSource).toContain("!online ? cachedUser : null");
    expect(authSource).toContain("localStorage.removeItem(CACHED_USER_KEY)");
    expect(pwaController).toContain("Modalità offline");
  });
});
