import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const groupsSource = readFileSync(new URL("../client/src/pages/stalla/GruppiTab.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../client/src/pages/stalla/GruppoDetail.tsx", import.meta.url), "utf8");
const wizardSource = readFileSync(new URL("../client/src/pages/stalla/AggiungiAnimaliWizard.tsx", import.meta.url), "utf8");
const sectionSource = readFileSync(new URL("../client/src/pages/stalla/StallaSection.tsx", import.meta.url), "utf8");

/** Contratti UI verificabili della dashboard Gruppi: no dati fittizi nel flusso reale. */
describe("Pagina Gruppi Stalla — dashboard avanzata", () => {
  it("usa dati reali e separa gruppi manuali e automatici", () => {
    expect(groupsSource).toContain("trpc.stalla.gruppi.list.useQuery(undefined)");
    expect(groupsSource).toContain('label="Manuali"');
    expect(groupsSource).toContain('label="Automatici"');
    expect(groupsSource).toContain('gruppo.tipoGestione === mode');
    expect(groupsSource).not.toContain("Lattazione: 156");
  });

  it("mantiene Gruppi pulita, cerca il singolo animale e offre un solo accesso riconoscibile alla mandria", () => {
    expect(groupsSource).toContain("Cerca animale…");
    expect(groupsSource).toContain("Cerca animale per matricola o numero aziendale");
    expect(groupsSource).toContain("trpc.stalla.ricerca.useQuery");
    expect(groupsSource).toContain(">Tutti gli animali</span>");
    expect(groupsSource).toContain("Visualizza e cerca nell’intera mandria");
    expect(groupsSource).not.toContain("Cerca gruppo...");
    expect(groupsSource).toContain(">Filtri</span>");
    expect(groupsSource).toContain(">Legenda</span>");
    expect(groupsSource).toContain("Nuovo");
  });

  it("presenta card a due colonne e collega il dettaglio routato", () => {
    expect(groupsSource).toContain('className="grid grid-cols-2 gap-3" aria-label="Elenco gruppi"');
    expect(groupsSource).toContain("GROUP_BACKGROUND");
    expect(groupsSource).toContain("categoriaGruppo(group.tipologia)");
    expect(groupsSource).toContain("onOpenDetail?.(group.id)");
    expect(sectionSource).toContain('setLocation(`/stalla/gruppi/${groupId}`)');
    expect(detailSource).toContain("AggiungiAnimaliWizard");
    expect(detailSource).toContain("Archivia gruppo");
  });

  it("usa un wizard esplicito a tre passi prima di modificare gli animali", () => {
    expect(wizardSource).toContain('step === "origins"');
    expect(wizardSource).toContain('step === "review"');
    expect(wizardSource).toContain("Capacità massima superata");
    expect(wizardSource).toContain("idempotencyKey");
    expect(wizardSource).toContain("Conferma aggiunta di");
  });
});
