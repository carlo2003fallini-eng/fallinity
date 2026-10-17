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
      backgroundImage: "/manus-storage/dati-stalla_2ce93fdf.jpg",
    });
  });

  it("mantiene una griglia 2×3 con simboli luminosi e titoli aumentati del 10%", () => {
    expect(stallaSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(stallaSource).toContain("aspect-[1.5/1]");
    expect(stallaSource).toContain("backgroundImage: `radial-gradient(ellipse");
    expect(stallaSource).toContain("top-[29%]");
    expect(stallaSource).toContain("size-[3.4rem]");
    expect(stallaSource).toContain("size={32}");
    expect(stallaSource).toContain("const CARD_TITLE_BASE_REM = 1.25");
    expect(stallaSource).toContain("const CARD_TITLE_SCALE = 1.1");
    expect(stallaSource).toContain("const CARD_TITLE_REM = CARD_TITLE_BASE_REM * CARD_TITLE_SCALE");
    expect(stallaSource).toContain("fontSize: `${CARD_TITLE_REM}rem`");
    expect(stallaSource).toContain("0 0 22px ${area.color}88");
    expect(stallaSource).toContain("focus-visible:ring-2 focus-visible:ring-primary");
    expect(stallaSource).toContain("Apri {area.title}");
  });

  it("usa i sei sfondi distinti forniti dall’utente con trattamento scurito", () => {
    expect(STALLA_AREAS.map((area) => area.backgroundImage)).toEqual([
      "/manus-storage/dati-stalla_2ce93fdf.jpg",
      "/manus-storage/riproduzione_b0303e90.jpg",
      "/manus-storage/vitelli_31e8ae12.jpg",
      "/manus-storage/gruppi_10fe41ef.jpg",
      "/manus-storage/sanita_266962fc.jpg",
      "/manus-storage/alimentazione_ae1c4a7e.jpg",
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
