import { describe, expect, it } from "vitest";
import { changeAlias, initialDemoState } from "../shared/inventory-invoice/engine";

function setup() {
  const state = initialDemoState("demo-alias-test");
  const p = state.products[0];
  state.products.push({ ...p, id: "alternate", nome: "Filtro alternativo", codice: "ALT" });
  state.aliases.push({ id: "old", supplierKey: "IT:FORNITORE", supplierName: "Fornitore simulato", code: "FO822", productId: p.id, invoiceUnit: "PZ", productUnit: p.unit, factor: 1, active: true, confirmedAt: "2026-11-01T00:00:00Z" });
  return state;
}
describe("Correzioni associazioni — solo demo con audit", () => {
  it("conserva la versione precedente, non modifica giacenze/costi e aggiunge audit", () => {
    const state = setup();
    const next = changeAlias(state, { aliasId: "old", productId: "alternate", invoiceUnit: "CONF", factor: 10, reason: "Identità e confezione verificate", operationId: "fix1" });
    expect(state.aliases[0].active).toBe(true);
    expect(next.aliases[0].active).toBe(false);
    expect(next.aliases.filter(a => a.active)).toEqual([expect.objectContaining({ productId: "alternate", invoiceUnit: "CONF", factor: 10 })]);
    expect(next.products).toEqual(state.products);
    expect(next.movements).toEqual(state.movements);
    expect(next.prices).toEqual(state.prices);
    expect(next.financeExpensesCents).toBe(state.financeExpensesCents);
    expect(next.machine).toEqual(state.machine);
    expect(next.audit.at(-1)?.action).toBe("alias_corretto");
  });
  it("rifiuta correzioni senza motivo o con fattore incompatibile, senza modificare lo stato", () => {
    const state = setup(); const original = structuredClone(state);
    expect(() => changeAlias(state, { aliasId: "old", productId: "alternate", invoiceUnit: "PZ", factor: 10, reason: "Correzione", operationId: "bad" })).toThrow();
    expect(() => changeAlias(state, { aliasId: "old", productId: "alternate", invoiceUnit: "CONF", factor: 10, reason: "", operationId: "bad2" })).toThrow();
    expect(state).toEqual(original);
  });
});
