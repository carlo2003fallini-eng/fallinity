import { describe, expect, it } from "vitest";
import { matchesWork, type WorkFilters } from "../client/src/pages/officina/filters";
const filters: WorkFilters = { ricerca: "", mezzo: "tutti", stato: "tutti", priorita: "tutte", tipo: "tutti", periodo: "tutti", da: "", a: "", operatore: "tutti" };
const work = { codice: "INT-1", nomeMezzo: "822 Fendt", macchinaId: "mezzo-a", descrizione: "Cambio filtro", stato: "in_corso", priorita: "alta", tipo: "manutenzione", dataPianificata: "2026-11-10T12:00:00", operatore: "Mario" };
const now = new Date("2026-11-16T12:00:00");
describe("Officina F96 — filtri mobile interventi", () => {
  it.each([
    [{ ricerca: "822" }, true], [{ ricerca: "filtro" }, true], [{ ricerca: "inesistente" }, false],
    [{ mezzo: "mezzo-a" }, true], [{ mezzo: "mezzo-b" }, false], [{ stato: "aperti" }, true],
    [{ stato: "completato" }, false], [{ priorita: "alta" }, true], [{ priorita: "bassa" }, false],
    [{ tipo: "riparazione" }, false], [{ tipo: "manutenzione" }, true], [{ periodo: "ritardo" }, true],
    [{ periodo: "oggi" }, false], [{ periodo: "mese" }, true],
    [{ periodo: "personalizzato", da: "2026-11-01", a: "2026-11-10" }, true],
    [{ periodo: "personalizzato", da: "2026-11-11", a: "2026-11-16" }, false],
    [{ operatore: "Mario" }, true], [{ operatore: "Lucia" }, false],
  ] as [Partial<WorkFilters>, boolean][]) ("applica %j senza duplicare gli elenchi", (patch, expected) => {
    expect(matchesWork(work, { ...filters, ...patch }, now)).toBe(expected);
  });
  it("esclude gli interventi completati dalla vista aperti e ritardo", () => {
    const completed = { ...work, stato: "completato", dataCompletamento: "2026-11-16T11:00:00" };
    expect(matchesWork(completed, { ...filters, stato: "aperti" }, now)).toBe(false);
    expect(matchesWork(completed, { ...filters, periodo: "ritardo" }, now)).toBe(false);
    expect(matchesWork(completed, { ...filters, periodo: "oggi" }, now)).toBe(true);
  });
  it("Straordinari resta lo stato storico e la tipologia è un filtro indipendente", () => {
    expect(matchesWork({ ...work, stato: "straordinario", tipo: "riparazione" }, { ...filters, stato: "straordinario", tipo: "riparazione" }, now)).toBe(true);
    expect(matchesWork({ ...work, stato: "in_corso", tipo: "straordinario" }, { ...filters, stato: "straordinario" }, now)).toBe(false);
  });
});
