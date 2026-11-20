import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const clientRoot = new URL("../client/src/", import.meta.url);
const readClient = (file: string) => readFileSync(new URL(file, clientRoot), "utf8");
const hubSource = readClient("pages/alimentazione/Alimentazione.tsx");
const routesSource = readClient("App.tsx");
const serviceWorker = readFileSync(
  new URL("../client/public/sw.js", import.meta.url),
  "utf8"
);

const areas = [
  {
    path: "razioni",
    title: "Razioni",
    image: /^\/manus-storage\/feeding-ref100-razioni_[0-9a-f]+\.jpg$/,
  },
  {
    path: "distribuzione",
    title: "Distribuzione e consumi",
    image: /^\/manus-storage\/feeding-ref100-distribuzione_[0-9a-f]+\.jpg$/,
  },
  {
    path: "alimenti",
    title: "Alimenti e analisi alimenti",
    image: /^\/manus-storage\/feeding-ref100-alimenti_[0-9a-f]+\.jpg$/,
  },
  {
    path: "analisi",
    title: "Analisi",
    image: /^\/manus-storage\/feeding-ref100-analisi_[0-9a-f]+\.jpg$/,
  },
] as const;

const imageEntries = [...hubSource.matchAll(
  /path:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?image:\s*"([^"]+)"/g
)].map(([, path, title, image]) => ({ path, title, image }));

const imagePaths = areas.map(({ path }) =>
  hubSource.match(
    new RegExp(
      `path:\\s*"${path}"[\\s\\S]*?image:\\s*"([^\"]+)"`,
      "m"
    )
  )?.[1]
);

describe("Hub Alimentazione — sfondi visuali Fase 100", () => {
  it("associa quattro immagini JPG pubbliche, distinte e semanticamente corrette alle aree", () => {
    expect(imageEntries).toHaveLength(4);
    expect(new Set(imagePaths).size).toBe(4);

    for (const [index, area] of areas.entries()) {
      expect(imagePaths[index]).toMatch(area.image);
      expect(imagePaths[index]).toContain(`feeding-ref100-${area.path}_`);
      expect(imagePaths[index]).toMatch(/\.jpg$/);
    }
  });

  it("conserva titoli, percorsi operativi e ordine dell’hub", () => {
    expect(imageEntries.map(({ path, title }) => ({ path, title }))).toEqual(
      areas.map(({ path, title }) => ({ path, title }))
    );
    expect(routesSource).toContain('<Route path="/alimentazione/razioni" component={Razioni} />');
    expect(routesSource).toContain('<Route path="/alimentazione/distribuzione" component={Distribuzione} />');
    expect(routesSource).toContain('<Route path="/alimentazione/alimenti" component={Alimenti} />');
    expect(routesSource).toContain('<Route path="/alimentazione/analisi" component={AnalisiAlimentazione} />');
    expect(routesSource).toContain('<Route path="/alimentazione" component={Alimentazione} />');
  });

  it("preserva griglia a due colonne, dimensione minima, icone e leggibilità del testo sull’overlay", () => {
    expect(hubSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(hubSource).toContain("min-h-[180px]");
    expect(hubSource).toContain("size-12");
    expect(hubSource).toContain("<a.icon size={26} />");
    expect(hubSource).toContain("text-lg font-semibold leading-snug text-white");
    expect(hubSource).toContain('textShadow: "0 2px 12px #000"');
    expect(hubSource).toMatch(/backgroundImage:\s*`linear-gradient\([^`]+\),url\(\$\{a\.image\}\)`/);
    expect(hubSource).toContain('backgroundSize: "cover"');
    expect(hubSource).toContain('backgroundPosition: "center"');
  });

  it("mantiene riepilogo, API dati e contenuto testuale senza dedurre un Menù operatore", () => {
    expect(hubSource).toContain("const q = useFeed();");
    expect(hubSource).toContain("const s = q.data?.summary;");
    expect(hubSource).toContain('<FeedStatus query={q} />');
    expect(hubSource).toContain('aria-label="Situazione alimentare aziendale"');
    expect(hubSource).toMatch(/>\s*Situazione alimentare\s*<\/h2>/);
    expect(hubSource).toContain("s.coverage");
    expect(hubSource).not.toContain("Menù operatore");
    expect(hubSource).not.toContain("Menu operatore");
  });
});

describe("Hub Alimentazione — whitelist PWA Fase 100", () => {
  it("precarica gli stessi quattro nuovi asset pubblici con cacheversion dedicata", () => {
    expect(serviceWorker).toContain("fase-100-alimentazione-sfondi");
    for (const area of areas) {
      const imageName = serviceWorker.match(
        new RegExp(`feeding-ref100-${area.path}_[0-9a-f]+\\.jpg`)
      )?.[0];
      expect(imageName).toBeTruthy();
      expect(serviceWorker).toContain(`/manus-storage/${imageName}`);
    }
  });
});
