import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const splashSource = readFileSync(
  new URL("../client/src/components/AppSplash.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("Splash screen Fallinity", () => {
  it("mostra immediatamente l’icona ufficiale prima del bootstrap React", () => {
    expect(indexHtml).toContain('id="fallinity-static-splash"');
    expect(indexHtml).toContain("fallinity-app-icon-192_3ee5c98d.png");
    expect(indexHtml).toContain('aria-busy="true"');
    expect(indexHtml).toContain('rel="preload" as="image"');
    expect(indexHtml).toContain("Avvio non completato");
    expect(indexHtml).toContain("Riprova");
  });

  it("usa lo splash React globale prima dei controller e delle route", () => {
    expect(appSource).toContain("<AppSplash />");
    expect(appSource.indexOf("<AppSplash />")).toBeLessThan(appSource.indexOf("<PWAController />"));
    expect(appSource.indexOf("<AppSplash />")).toBeLessThan(appSource.indexOf("<Router />"));
  });

  it("attende caricamento autenticazione e window load con limiti sicuri", () => {
    expect(splashSource).toContain("const { loading } = useAuth()");
    expect(splashSource).toContain('document.readyState === "complete"');
    expect(splashSource).toContain("MIN_VISIBLE_MS");
    expect(splashSource).toContain("MAX_WAIT_MS");
    expect(splashSource).toContain('dataset.appReady = "true"');
  });

  it("non mostra un secondo splash quando l’app è avviata in modalità standalone", () => {
    expect(splashSource).toContain('window.matchMedia("(display-mode: standalone)")');
    expect(splashSource).toContain('standalone ? "hidden" : "visible"');
    expect(indexHtml).toContain("@media(display-mode:standalone)");
    expect(indexHtml).toContain('window.matchMedia("(display-mode: standalone)")');
  });

  it("espone stato accessibile e supporta la riduzione del movimento", () => {
    expect(splashSource).toContain('role="status"');
    expect(splashSource).toContain('aria-live="polite"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain('.fallinity-splash[data-state="leaving"]');
  });

  it("non memorizza i moduli Vite di sviluppo nella cache PWA", () => {
    const serviceWorker = readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8");
    expect(serviceWorker).toContain('url.pathname.startsWith("/src/")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/@")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/.vite/")');
  });
});
