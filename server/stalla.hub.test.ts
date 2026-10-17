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
      backgroundImage: "/manus-storage/dati-latte_4397cbdd.jpg",
    });
  });

  it("mantiene una griglia 2×3 di card fotografiche compatte, accessibili e riconoscibili", () => {
    expect(stallaSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(stallaSource).toContain("aspect-[1.1/1]");
    expect(stallaSource).toContain("backgroundImage: `linear-gradient(180deg");
    expect(stallaSource).toContain("top-[46%]");
    expect(stallaSource).toContain("size-14");
    expect(stallaSource).toContain("bottom-3 text-xl font-bold");
    expect(stallaSource).toContain("backdrop-blur-md");
    expect(stallaSource).toContain("focus-visible:ring-2 focus-visible:ring-primary");
    expect(stallaSource).toContain("Apri {area.title}");
  });

  it("usa sei sfondi archiviati, luminosi e distinti", () => {
    expect(STALLA_AREAS.map((area) => area.backgroundImage)).toEqual([
      "/manus-storage/dati-latte_4397cbdd.jpg",
      "/manus-storage/riproduzione_f9519393.jpg",
      "/manus-storage/vitelli_6ad392af.jpg",
      "/manus-storage/gruppi_d0c23dac.jpg",
      "/manus-storage/sanita_d6a481e8.jpg",
      "/manus-storage/alimentazione_aeaf1205.jpg",
    ]);
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
    expect(sectionSource).toContain("<GruppiTab />");
    expect(sectionSource).toContain("<AnimaliTab />");
    expect(sectionSource).toContain("trpc.stalla.stats.useQuery");
    expect(sectionSource).toContain("trpc.stalla.zoppie.useQuery");
    expect(sectionSource).toContain("I dati compariranno qui appena verranno registrati o collegati.");
    expect(sectionSource).not.toContain("Dati di esempio");
  });
});
