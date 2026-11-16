import { describe, expect, it } from "vitest";
import { costruisciCatalogoOperatore } from "./domains/fleet/operator";

describe("Menù operatore Officina", () => {
  it("mostra solo mezzi dell’azienda e reparti/famiglie con giacenza", () => {
    const result = costruisciCatalogoOperatore(
      [
        { id: "m1", categoria: "Trattori", nome: "Claas piccolo", stato: "operativo" },
        { id: "m2", categoria: "Rimorchi", nome: "Rimorchio 1", stato: "operativo" },
      ],
      [
        { id: "r1", codice: "F-5", nome: "Fusibile 5 A", categoria: "Pezzi di ricambio", reparto: "Elettronica ed elettrico", famiglia: "Fusibili", sottocategoria: "Piccoli", quantita: "2", prezzoUnitario: "2" },
        { id: "r2", codice: "F-10", nome: "Fusibile 10 A", categoria: "Pezzi di ricambio", reparto: "Elettronica ed elettrico", famiglia: "Fusibili", sottocategoria: "Medi", quantita: "0", prezzoUnitario: "2" },
        { id: "r3", codice: "FILTRO", nome: "Filtro olio", categoria: "Pezzi di ricambio", reparto: null, famiglia: null, sottocategoria: null, quantita: "1", prezzoUnitario: "40" },
      ],
      [],
    );

    expect(result.categorie).toHaveLength(2);
    expect(result.categorie.flatMap((category) => category.mezzi).map((m) => m.nome)).toContain("Claas piccolo");
    expect(result.articoli.map((a) => a.nome)).toEqual(expect.arrayContaining(["Filtro olio", "Fusibile 5 A"]));
    expect(result.reparti.find((r) => r.nome === "Elettronica ed elettrico")?.famiglie[0].sottocategorie).toEqual(["Piccoli"]);
    expect(result.reparti.every((r) => r.famiglie.length > 0)).toBe(true);
  });

  it("preserva interventi aperti già associati al mezzo selezionato", () => {
    const result = costruisciCatalogoOperatore(
      [{ id: "m1", categoria: "Trattori", nome: "Claas piccolo", stato: "operativo" }],
      [{ id: "r1", categoria: "Pezzi di ricambio", nome: "Fusibile", quantita: "1", prezzoUnitario: "2" }],
      [{ id: "i1", macchinaId: "m1", stato: "in_corso", descrizione: "Impianto luci" }],
    );
    expect(result.interventiAperti).toEqual([{ id: "i1", macchinaId: "m1", stato: "in_corso", descrizione: "Impianto luci" }]);
  });
});
