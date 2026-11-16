import { describe, expect, it } from "vitest";
import { fleetPermissions, withoutCosts } from "./domains/fleet/permissions";
import { eRicambio, normalizzaProdottoRicambio, statoGiacenza } from "./domains/fleet/parts";
import { costruisciCatalogoOperatore } from "./domains/fleet/operator";
import { costiCompletamento } from "./domains/fleet/completion";
import { completaInterventoInput, confermaPrelievoInput, createRicambioInput } from "./domains/fleet/validators";

describe("F96 — permessi Officina", () => {
  it.each([
    { name: "amministratore aziendale", admin: true, role: "viewer", modules: [], edit: [], expected: [true, true, true] },
    { name: "viewer non modifica anche con permesso edit", admin: false, role: "viewer", modules: ["azienda.officina"], edit: ["azienda.officina"], expected: [true, false, false] },
    { name: "operatore con sola visualizzazione", admin: false, role: "operator", modules: ["azienda.officina"], edit: [], expected: [true, false, false] },
    { name: "operatore con edit esplicito", admin: false, role: "operator", modules: ["azienda.officina"], edit: ["azienda.officina"], expected: [true, true, false] },
    { name: "manager non ottiene edit dal solo ruolo", admin: false, role: "manager", modules: ["azienda.officina"], edit: [], expected: [true, false, false] },
    { name: "edit Magazzino non concede edit Officina", admin: false, role: "operator", modules: ["azienda.officina", "azienda.magazzino"], edit: ["azienda.magazzino"], expected: [true, false, false] },
    { name: "Magazzino non concede visualizzazione Officina", admin: false, role: "operator", modules: ["azienda.magazzino"], edit: ["azienda.magazzino"], expected: [false, false, false] },
    { name: "viewer con Finanza vede costi ma non modifica", admin: false, role: "viewer", modules: ["azienda.officina", "finanza.movimenti"], edit: ["azienda.officina"], expected: [true, false, true] },
    { name: "Finanza senza Officina non concede accesso operativo", admin: false, role: "operator", modules: ["finanza.kpi"], edit: [], expected: [false, false, true] },
    { name: "reintegrazione non concede accesso ai costi", admin: false, role: "operator", modules: ["azienda.officina", "finanza.reintegrazione"], edit: [], expected: [true, false, false] },
    { name: "modulo padre e discendente rispettano moduleMatches", admin: false, role: "operator", modules: ["azienda"], edit: ["azienda.officina.materiali"], expected: [true, true, false] },
    { name: "prefissi non gerarchici non concedono accesso", admin: false, role: "operator", modules: ["azienda.officinax"], edit: ["azienda.officinax"], expected: [false, false, false] },
  ])("$name", ({ admin, role, modules, edit, expected }) => {
    const result = fleetPermissions({ isCompanyAdmin: admin, roleCode: role, modules }, edit);
    expect(result).toEqual({ canView: expected[0], canEdit: expected[1], canSeeCosts: expected[2] });
  });

  it.each(["finanza.movimenti", "finanza.kpi", "finanza.report", "finanza"])("%s autorizza la visualizzazione dei costi, non l'edit", (module) => {
    expect(fleetPermissions({ isCompanyAdmin: false, roleCode: "viewer", modules: ["azienda.officina", module] }, []))
      .toEqual({ canView: true, canEdit: false, canSeeCosts: true });
  });
});

describe("F96 — withoutCosts ricorsivo e non mutante", () => {
  it("oscura costi di dettaglio, catalogo, storico e snapshot a qualsiasi profondità", () => {
    const date = new Date("2026-01-02T12:00:00Z");
    const source = {
      id: "intervento-test", costoFinale: 94, prezzoUnitario: "12.00", importo: 9400, valoreMagazzino: 60, totale: 94,
      createdAt: date, quantita: 3, prontoPerCompletamento: true, note: null,
      storico: [{ costoRicambi: 24, costoManodopera: 70, oreLavoro: 2, materiali: [
        { nome: "Filtro", quantitaUtilizzata: "2.00", costoUnitario: 12, totale: 24 },
      ] }],
      catalogo: { articoli: [{ prezzoListino: 18, costoMedio: 12, quantitaDisponibile: 3 }],
        profondita: [[{ IMPORTOResiduo: 5, COSTOTotale: 4, ValoreMagazzinoStimato: 9, nome: "test" }], null, 0, false, "test"] },
    };
    const result = withoutCosts(source);
    expect(result).toEqual({
      id: "intervento-test", costoFinale: null, prezzoUnitario: null, importo: null, valoreMagazzino: null, totale: null,
      createdAt: date, quantita: 3, prontoPerCompletamento: true, note: null,
      storico: [{ costoRicambi: null, costoManodopera: null, oreLavoro: 2, materiali: [
        { nome: "Filtro", quantitaUtilizzata: "2.00", costoUnitario: null, totale: null },
      ] }],
      catalogo: { articoli: [{ prezzoListino: null, costoMedio: null, quantitaDisponibile: 3 }],
        profondita: [[{ IMPORTOResiduo: null, COSTOTotale: null, ValoreMagazzinoStimato: null, nome: "test" }], null, 0, false, "test"] },
    });
    expect(result.createdAt).toBe(date);
    expect(result).not.toBe(source);
    expect(result.storico).not.toBe(source.storico);
    expect(source.costoFinale).toBe(94);
    expect(source.storico[0].materiali[0].costoUnitario).toBe(12);
    expect(source.catalogo.profondita[0]).toEqual([{ IMPORTOResiduo: 5, COSTOTotale: 4, ValoreMagazzinoStimato: 9, nome: "test" }]);
  });

  it.each([null, undefined, 0, 12, false, true, "test"])("preserva il valore primitivo %s", (value) => {
    expect(withoutCosts(value)).toBe(value);
  });

  it("preserva Date, array vuoti e oggetti vuoti", () => {
    const date = new Date();
    expect(withoutCosts(date)).toBe(date);
    expect(withoutCosts([])).toEqual([]);
    expect(withoutCosts({})).toEqual({});
  });
});

describe("F96 — criterio condiviso ricambi e giacenza", () => {
  it.each([
    [{ categoria: "Ricambi", nome: "Filtro" }, true],
    [{ categoria: "PEZZI DI RICAMBIO", nome: "Filtro" }, true],
    [{ sottocategoria: "Ricambio motore", nome: "Filtro" }, true],
    [{ nome: "Kit ricambio pompa" }, true],
    [{ reparto: "Motore", nome: "Filtro olio", categoria: "Altro" }, true],
    [{ famiglia: "Filtri", nome: "Filtro olio", categoria: "Altro" }, true],
    [{ categoria: "Mangimi", nome: "Mais", reparto: null, famiglia: null }, false],
    [{ categoria: "Lubrificanti", nome: "Olio", reparto: "", famiglia: "" }, false],
    [{}, false],
  ])("classifica %j come ricambio=%s", (product, expected) => {
    expect(eRicambio(product)).toBe(expected);
  });

  it.each([
    [-1, 2, "non_disponibile"], [0, 0, "non_disponibile"], [0, 3, "non_disponibile"],
    [1, 2, "sotto_scorta"], [2, 2, "sotto_scorta"], [0.125, 0.25, "sotto_scorta"],
    [3, 2, "disponibile"], [1, 0, "disponibile"], [0.25, 0, "disponibile"],
  ] as const)("giacenza %s / soglia %s: %s", (quantity, threshold, expected) => {
    expect(statoGiacenza(quantity, threshold)).toBe(expected);
  });

  it("normalizza il prodotto condiviso senza perdere metadata o modificare la fonte", () => {
    const product = { id: "test-part", nome: "Filtro", quantita: "0.125", quantitaMinima: "0.250", prezzoUnitario: "12.50",
      reparto: "Motore", famiglia: "Filtri", sottocategoria: "Olio", categoria: null, fornitore: "Fornitore test", statoOrdine: "ordinato" };
    expect(normalizzaProdottoRicambio(product)).toEqual({ ...product, source: "magazzino", quantitaDisponibile: "0.125",
      sogliaMinima: "0.250", costoMedio: "12.50", categoria: "Ricambi", statoScorta: "sotto_scorta" });
    expect(product.categoria).toBeNull();
    expect(normalizzaProdottoRicambio({ nome: "Ricambio", quantita: 0 }).costoMedio).toBeNull();
  });

  it("esclude dal catalogo esauriti, negativi e articoli non Officina anche se disponibili", () => {
    const parts = [
      { id: "available", nome: "Filtro", reparto: "Motore", famiglia: "Filtri", quantita: "1.000", prezzoUnitario: "12" },
      { id: "empty", nome: "Ricambio vuoto", reparto: "Idraulica", famiglia: "Pompe", quantita: "0" },
      { id: "negative", nome: "Ricambio negativo", quantita: "-1" },
      { id: "feed", nome: "Mais", categoria: "Mangimi", quantita: "50" },
    ];
    const result = costruisciCatalogoOperatore([], parts, []);
    expect(result.articoli.map((row) => row.id)).toEqual(["available"]);
    expect(result.articoli[0]).toMatchObject({ quantitaDisponibile: 1, costoUnitario: 12 });
    expect(result.reparti).toEqual([{ nome: "Motore", famiglie: [{ nome: "Filtri", sottocategorie: [] }] }]);
    expect(parts[1].quantita).toBe("0");
  });
});

describe("F96 — costiCompletamento", () => {
  it.each([
    [24, 0, 2, 35, 24, 70, 94],
    [24, 7, 0, 35, 31, 0, 31],
    [0, 20, 1.5, 40, 20, 60, 80],
    [0, 0, 0, 35, 0, 0, 0],
    [12.5, 2.5, 0.5, 15, 15, 7.5, 22.5],
    [24, 0, 3, 0, 24, 0, 24],
  ])("prelevati=%s extra=%s ore=%s tariffa=%s", (old, extra, hours, rate, parts, labor, final) => {
    expect(costiCompletamento(old, extra, hours, rate)).toEqual({ costoRicambi: parts, costoManodopera: labor, costoFinale: final });
  });
});

describe("F96 — validatori dei nuovi flussi", () => {
  it("completamento senza ricambi extra produce array vuoto e zero ore", () => {
    expect(completaInterventoInput.parse({ id: "test-work" })).toEqual({ id: "test-work", oreLavoro: 0, ricambiUtilizzati: [] });
  });

  it("accetta identificatore della riga storica e prodotto condiviso nel completamento", () => {
    expect(completaInterventoInput.parse({ id: "test-work", oreLavoro: 0, costoOrario: 0,
      ricambiUtilizzati: [{ rigaId: "test-row", prodottoId: "test-product", quantitaUtilizzata: 1.5, costoUnitario: 0 }] }).ricambiUtilizzati[0])
      .toMatchObject({ rigaId: "test-row", prodottoId: "test-product", quantitaUtilizzata: 1.5 });
  });

  it("nuovo ricambio ammette famiglie personalizzate e giacenza iniziale zero", () => {
    expect(createRicambioInput.parse({ nome: "Filtro", categoria: "Famiglia F96 personalizzata" }))
      .toMatchObject({ categoria: "Famiglia F96 personalizzata", quantitaDisponibile: 0, sogliaMinima: 0 });
  });

  it.each([-1, NaN, Infinity])("rifiuta costi/ore negativi o non finiti: %s", (value) => {
    expect(completaInterventoInput.safeParse({ id: "test", oreLavoro: value }).success).toBe(false);
    expect(completaInterventoInput.safeParse({ id: "test", costoOrario: value }).success).toBe(false);
    expect(createRicambioInput.safeParse({ nome: "test", quantitaDisponibile: value }).success).toBe(false);
    expect(createRicambioInput.safeParse({ nome: "test", costoMedio: value }).success).toBe(false);
  });

  it.each([0, -1, 10001, NaN, Infinity])("prelievo rifiuta quantità non consentita: %s", (quantity) => {
    expect(confermaPrelievoInput.safeParse({ idempotencyKey: "f96-test-key", macchinaId: "test-machine",
      righe: [{ ricambioId: "test-product", quantita: quantity }] }).success).toBe(false);
  });

  it("prelievo richiede una chiave idempotente valida e almeno una riga", () => {
    expect(confermaPrelievoInput.safeParse({ idempotencyKey: "short", macchinaId: "test", righe: [{ ricambioId: "test", quantita: 1 }] }).success).toBe(false);
    expect(confermaPrelievoInput.safeParse({ idempotencyKey: "x".repeat(81), macchinaId: "test", righe: [{ ricambioId: "test", quantita: 1 }] }).success).toBe(false);
    expect(confermaPrelievoInput.safeParse({ idempotencyKey: "f96-test-key", macchinaId: "test", righe: [] }).success).toBe(false);
  });
});
