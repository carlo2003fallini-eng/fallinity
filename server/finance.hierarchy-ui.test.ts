import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nuovoMovimento = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimento.tsx", import.meta.url), "utf8");
const modificaMovimento = readFileSync(new URL("../client/src/components/finance/MovimentoActions.tsx", import.meta.url), "utf8");
const listaMovimenti = readFileSync(new URL("../client/src/pages/finanza/ListaMovimenti.tsx", import.meta.url), "utf8");
const analisi = readFileSync(new URL("../client/src/pages/finanza/Analisi.tsx", import.meta.url), "utf8");
const centri = readFileSync(new URL("../client/src/pages/finanza/ImpostazioniCentriCosto.tsx", import.meta.url), "utf8");
const sottocategorie = readFileSync(new URL("../client/src/pages/finanza/ImpostazioniCategorie.tsx", import.meta.url), "utf8");

describe("Finance — contratto UI gerarchia classificazione", () => {
  it("ordina Centro di costo prima di Sottocategoria e filtra la query", () => {
    expect(nuovoMovimento.indexOf("Centro di costo *")).toBeLessThan(nuovoMovimento.indexOf('label="Sottocategoria *"'));
    expect(nuovoMovimento).toContain("centroCostoId: centroCostoId || undefined");
    expect(nuovoMovimento).toContain("Nessuna sottocategoria correlata");
  });

  it("applica la stessa correlazione alla modifica dei movimenti", () => {
    expect(modificaMovimento).toContain("centroCostoId: selectedCenterId");
    expect(modificaMovimento).toContain('label="Sottocategoria *"');
    expect(modificaMovimento).toContain("categoriaId: \"\"");
  });

  it("gestisce categorie dei centri e relazioni nelle Impostazioni", () => {
    expect(centri).toContain("Categorie dei centri");
    expect(centri).toContain("categoriaCentroId");
    expect(sottocategorie).toContain("Categorie dei centri collegate");
    expect(sottocategorie).toContain("categoriaCentroIds");
  });

  it("espone filtri gerarchici in Lista e Analisi", () => {
    expect(listaMovimenti).toContain("Categoria del centro");
    expect(listaMovimenti).toContain("Sottocategoria");
    expect(analisi).toContain("Categorie dei centri");
    expect(analisi).toContain("Sottocategorie");
    for (const source of [listaMovimenti, analisi]) expect(source).toContain("categoriaCentroId");
    expect(analisi).toContain("Categorie centri");
  });
});
