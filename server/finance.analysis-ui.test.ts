import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analysisSource = readFileSync(
  new URL("../client/src/pages/finanza/Analisi.tsx", import.meta.url),
  "utf8",
);
const movementsSource = readFileSync(
  new URL("../client/src/pages/finanza/ListaMovimenti.tsx", import.meta.url),
  "utf8",
);

describe("Analisi finanziaria — contratto UI", () => {
  it("espone periodo corrente, confronto personalizzabile e granularità mensile/annuale", () => {
    expect(analysisSource).toContain("analytics.overview.useQuery");
    expect(analysisSource).toContain("Confronta da");
    expect(analysisSource).toContain("Confronta a");
    expect(analysisSource).toContain("Andamento mensile");
    expect(analysisSource).toContain("Andamento annuale");
  });

  it("mostra le date Custom solo nell’editor dedicato e le applica con Seleziona", () => {
    expect(analysisSource).toContain("customEditorOpen &&");
    expect(analysisSource).toContain("Periodo Custom");
    expect(analysisSource).toContain("selezionaCustom");
    expect(analysisSource).toContain("setDataInizio(customInizio)");
    expect(analysisSource).toContain("setDataFine(customFine)");
  });

  it("apre Confronta in un pannello con valori draft, Indietro e Seleziona", () => {
    expect(analysisSource).toContain("Confronta periodi");
    expect(analysisSource).toContain("draftConfrontoInizio");
    expect(analysisSource).toContain("draftConfrontoFine");
    expect(analysisSource).toContain("selezionaConfronto");
    expect(analysisSource).toContain("Indietro");
    expect(analysisSource.match(/Seleziona/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("valida gli intervalli prima di aggiornare l’analisi", () => {
    expect(analysisSource).toContain("intervalloValido");
    expect(analysisSource).toContain('role="alert"');
    expect(analysisSource).toContain("I dati cambieranno solo dopo la conferma");
  });

  it("mostra KPI, grafici, dimensioni e insight finanziari", () => {
    expect(analysisSource).toContain("Sintesi del periodo");
    expect(analysisSource).toContain("Andamento: {nomeDirezione.toLowerCase()}");
    expect(analysisSource).toContain("Composizione delle {tipoGrafico}");
    expect(analysisSource).toContain("Confronta dimensioni");
    expect(analysisSource).toContain("Lettura rapida dei dati");
  });

  it("permette di isolare entrate, uscite o tutti i dati nell’analisi", () => {
    expect(analysisSource).toContain('type Direzione = "tutto" | "entrate" | "uscite"');
    expect(analysisSource).toContain('setDirezione(value)');
    expect(analysisSource).toContain('aria-label="Direzione dei dati"');
    expect(analysisSource).toContain("Separa entrate e uscite in tutti i grafici e confronti.");
    expect(analysisSource).toContain("direzione,");
    expect(analysisSource).toContain('direzione === "tutto" && <Area');
  });

  it("non annida anchor nel link di ritorno", () => {
    expect(analysisSource).not.toMatch(/<Link[^>]*>\s*<a[\s>]/s);
  });
});

describe("Lista Movimenti — contratto filtri UI", () => {
  it("espone filtri combinabili e chip singolarmente rimovibili", () => {
    expect(movementsSource).toContain("Cliente o fornitore");
    expect(movementsSource).toContain("Centro di costo");
    expect(movementsSource).toContain('aria-label="Filtri attivi"');
    expect(movementsSource).toContain("Rimuovi filtro");
    expect(movementsSource).toContain("Azzera tutti");
  });

  it("mantiene ricerca, tab e azzeramento completo", () => {
    expect(movementsSource).toContain("Descrizione, fornitore, centro, sottocategoria...");
    expect(movementsSource).toContain('value="entrate"');
    expect(movementsSource).toContain('value="uscite"');
    expect(movementsSource).toContain("Azzera ricerca e filtri");
  });
});
