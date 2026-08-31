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

  it("mostra KPI, grafici, dimensioni e insight finanziari", () => {
    expect(analysisSource).toContain("Sintesi del periodo");
    expect(analysisSource).toContain("Andamento entrate, uscite e risultato");
    expect(analysisSource).toContain("Composizione delle uscite");
    expect(analysisSource).toContain("Confronta dimensioni");
    expect(analysisSource).toContain("Lettura rapida dei dati");
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
    expect(movementsSource).toContain("Descrizione, fornitore, categoria...");
    expect(movementsSource).toContain('value="entrate"');
    expect(movementsSource).toContain('value="uscite"');
    expect(movementsSource).toContain("Azzera ricerca e filtri");
  });
});
