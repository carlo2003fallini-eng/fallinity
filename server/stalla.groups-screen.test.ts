import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const groupsSource = readFileSync(new URL("../client/src/pages/stalla/GruppiTab.tsx", import.meta.url), "utf8");
const sectionSource = readFileSync(new URL("../client/src/pages/stalla/StallaSection.tsx", import.meta.url), "utf8");

describe("Pagina Gruppi Stalla — mobile", () => {
  it("usa dati reali e non inventa consistenze di mandria", () => {
    expect(groupsSource).toContain("trpc.stalla.gruppi.list.useQuery(undefined)");
    expect(groupsSource).toContain("Number(gruppo.nAnimali ?? 0)");
    expect(groupsSource).toContain("{g.nAnimali}");
    expect(groupsSource).not.toContain("Lattazione: 156");
    expect(groupsSource).not.toContain("Asciutta: 78");
  });

  it("replica i controlli essenziali del riferimento in modo interattivo", () => {
    expect(groupsSource).toContain(">Gruppi</h1>");
    expect(groupsSource).toContain('placeholder="Cerca gruppo..."');
    expect(groupsSource).toContain(">Filtri</span>");
    expect(groupsSource).toContain(">Legenda</span>");
    expect(groupsSource).toContain("<Plus className=");
    expect(groupsSource).toContain("Nuovo");
    expect(groupsSource).toContain("setFiltriAperti");
    expect(groupsSource).toContain("setLegendaAperta");
  });

  it("presenta una griglia fotografica a due colonne con stato, animali e avvisi", () => {
    expect(groupsSource).toContain('className="grid grid-cols-2 gap-3" aria-label="Elenco gruppi"');
    expect(groupsSource).toContain("GROUP_BACKGROUND");
    expect(groupsSource).toContain("statoGruppo(g.tipologia)");
    expect(groupsSource).toContain("<Beef className=");
    expect(groupsSource).toContain("<AlertTriangle className=");
    expect(groupsSource).toContain("focus-visible:ring-2 focus-visible:ring-primary");
  });

  it("apre Gruppi in una vista dedicata e mantiene il ritorno alla Stalla", () => {
    expect(sectionSource).toContain('area.id === "gruppi" && activeTab === "gruppi"');
    expect(sectionSource).toContain('<GruppiTab onBack={() => setLocation("/stalla")} />');
    expect(groupsSource).toContain("onBack?: () => void");
  });
});
