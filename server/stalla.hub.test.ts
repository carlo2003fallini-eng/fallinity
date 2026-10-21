import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STALLA_AREAS } from "../client/src/lib/stallaAreas";

const root = new URL("../client/src/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), "utf8");
const stallaSource = read("pages/Stalla.tsx");
const sectionSource = read("pages/stalla/StallaSection.tsx");
const routesSource = read("App.tsx");

describe("Hub Stalla — griglia illustrata", () => {
  it("espone esattamente le sei aree principali nell’ordine richiesto", () => {
    expect(STALLA_AREAS.map((area) => area.id)).toEqual([
      "dati-latte",
      "riproduzione",
      "vitelli",
      "gruppi",
      "sanita",
      "alimentazione",
    ]);
    expect(STALLA_AREAS.every((area) => area.tabs.length > 0)).toBe(true);
  });

  it("presenta l’area latte con il nome più ampio Dati stalla, senza cambiare il percorso operativo", () => {
    expect(STALLA_AREAS.find((area) => area.id === "dati-latte")).toMatchObject({
      id: "dati-latte",
      title: "Dati stalla",
      backgroundImage: "/manus-storage/dati-stalla-dashboard_e7198686.jpg",
      backgroundPosition: "center",
      visualDescription: "Mucca da latte a sinistra e computer con grafici di produzione sulla destra.",
    });
  });

  it("usa le stesse dimensioni, tipografia, icone e contrasto della griglia Azienda", () => {
    expect(stallaSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(stallaSource).toContain("min-h-[180px]");
    expect(stallaSource).toContain('minHeight: "11.25rem"');
    expect(stallaSource).toContain("size-12");
    expect(stallaSource).toContain("<Icon size={26} strokeWidth={1.85} />");
    expect(stallaSource).toContain("text-lg font-semibold tracking-tight");
    expect(stallaSource).toContain("backgroundPosition: area.backgroundPosition");
    expect(stallaSource).toContain("oklch(0.055 0.01 145 / .90)");
    expect(stallaSource).toContain("focus-visible:ring-2 focus-visible:ring-primary");
    expect(stallaSource).toContain("area.visualDescription ? `Apri ${area.title}. ${area.visualDescription}`");
  });

  it("usa sei sfondi distinti e semanticamente coerenti con le sezioni della Stalla", () => {
    expect(STALLA_AREAS.map((area) => area.backgroundImage)).toEqual([
      "/manus-storage/dati-stalla-dashboard_e7198686.jpg",
      "/manus-storage/riproduzione_e5015a4c.jpg",
      "/manus-storage/vitelli_fb9a167e.jpg",
      "/manus-storage/gruppi_81c45d0c.jpg",
      "/manus-storage/sanita_9ab86209.jpg",
      "/manus-storage/alimentazione_71b16042.jpg",
    ]);
    expect(STALLA_AREAS.every((area) => Boolean(area.backgroundPosition))).toBe(true);
  });

  it("mantiene l’header Stalla essenziale, senza testi introduttivi superflui", () => {
    expect(stallaSource).toContain(">Stalla</h1>");
    expect(stallaSource).toMatch(/Azienda\s*<\/button>/);
    expect(stallaSource).not.toContain("Gestione zootecnica");
    expect(stallaSource).not.toContain("I dati della mandria, organizzati per lavorare in modo semplice e veloce.");
  });
});

describe("Hub Stalla — sezioni interne", () => {
  it("registra una route dedicata e conserva la pagina Stalla come hub", () => {
    expect(routesSource).toContain('<Route path="/stalla/:sectionId">{({ sectionId }) => <StallaSection sectionId={sectionId} />}</Route>');
    expect(routesSource).toContain('<Route path="/stalla" component={Stalla} />');
  });

  it("fornisce tab iconici e riusa i dati esistenti senza inventare valori", () => {
    expect(sectionSource).toContain("aria-label={`Sezioni ${area.title}`}");
    expect(sectionSource).toContain("<Icon size={16}");
    expect(sectionSource).toContain('<GruppiTab onBack={() => setLocation("/stalla")} onOpenAllAnimals={() => setLocation("/stalla/animali")} />');
    expect(sectionSource).toContain("<AnimaliTab />");
    expect(sectionSource).toContain("trpc.stalla.stats.useQuery");
    expect(sectionSource).toContain("trpc.stalla.zoppie.useQuery");
    expect(sectionSource).toContain("I dati compariranno qui appena verranno registrati o collegati.");
    expect(sectionSource).not.toContain("Dati di esempio");
  });
});
