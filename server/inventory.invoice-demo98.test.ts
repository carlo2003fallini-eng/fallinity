import { describe, expect, it } from "vitest";
import type { DemoState, ImportProduct, InvoiceLine, ReviewRow, WarehouseInvoice } from "../shared/inventory-invoice/types";
import {
  initialDemoState, addInvoiceToDemo, confirmDemoImport, registerDemoFinance,
  payDemoInvoice, recordDemoDelivery, linkDemoDelivery, withdrawDemoPart, returnDemoPart,
} from "../shared/inventory-invoice/engine";

// Punto 21: nessun fixture esterno, database o dato aziendale reale.
const COMPANY = "fixture-only-company-98";
const FILTER = "fixture-filter-822";
const FUSE = "fixture-fuse-10a";
const classification = { categoria: "Ricambi", reparto: "Officina", famiglia: "Filtri", sottocategoria: "Olio" };
function product(id = FILTER, overrides: Partial<ImportProduct> = {}): ImportProduct {
  return { id, nome: "Filtro olio Fendt 822", codice: "OEM-822", description: "Filtro olio per modello 822", unit: "PZ", quantity: 0, valuationUnitCents: 4000, lastPurchaseCents: 4000, identifiers: ["OEM-822"], ...classification, ...overrides };
}
function state(quantity = 0): DemoState {
  const result = initialDemoState(COMPANY);
  result.products = [product(FILTER, { quantity }), product(FUSE, { nome: "Fusibile mini 10 A", codice: "FUSE-10", identifiers: ["FUSE-10"], valuationUnitCents: 100, lastPurchaseCents: 100, famiglia: "Elettronica", sottocategoria: "Fusibili" })];
  result.reviews = []; result.aliases = []; result.movements = []; result.prices = [];
  result.audit = []; result.operations = []; result.financeExpensesCents = 0;
  result.machine.materialCostCents = 0;
  return result;
}
function invoice(id: string, overrides: Partial<WarehouseInvoice> = {}, lineOverrides: Partial<InvoiceLine> = {}): WarehouseInvoice {
  const line: InvoiceLine = { id: `${id}:1`, number: 1, name: "CART. FILTRO OLIO FENDT 822", quantity: 10, unit: "PZ", unitPriceCents: 4000, totalCents: 40000, vatRate: 0, codes: [{ type: "SKU", value: "FO822" }], adjustments: [], ddtRefs: [], kind: "materiale", ...lineOverrides };
  return { id, sourceHash: `simulated-hash-${id}`, number: id, date: "2026-11-01", currency: "EUR", type: "TD01", supplierKey: "IT:00000000098", supplierName: "Fornitore simulato A", supplierVat: "00000000098", totalCents: line.totalCents, ddts: [], orderRefs: [], lines: [line], ...overrides };
}
function review(s: DemoState, id: string) {
  const result = s.reviews.find(r => r.invoice.id === id);
  if (!result) throw new Error(`Revisione fixture non trovata: ${id}`);
  return result;
}
function stock(s: DemoState, id = FILTER) {
  const result = s.products.find(p => p.id === id);
  if (!result) throw new Error(`Articolo fixture non trovato: ${id}`);
  return result;
}
// Si parte sempre dalle vere righe di revisione, non da DTO di staging inventati.
function rows(s: DemoState, id: string, patches: Partial<ReviewRow> = {}, productId = FILTER): ReviewRow[] {
  return review(s, id).rows.map(row => ({ ...row, ...classification, productId, createNew: false, included: true, verified: true, factor: 1, unit: "PZ", ...patches }));
}
function confirm(s: DemoState, id: string, quantity: number, operationId = `${id}-receive`): DemoState {
  return confirmDemoImport(s, { invoiceId: id, operationId, receiptConfirmed: true, rows: rows(s, id, { receiveQuantity: quantity }) });
}
function rejectsAtomically(s: DemoState, operation: () => unknown) {
  const before = structuredClone(s);
  expect(operation).toThrow();
  expect(s).toEqual(before);
}
function replayWithoutSideEffects(s: DemoState, operation: () => DemoState) {
  const before = structuredClone(s);
  let result = s;
  try { result = operation(); } catch { /* Rifiuto oppure risposta idempotente: entrambi non devono modificare nulla. */ }
  expect(s).toEqual(before);
  expect(result).toEqual(before);
}

describe("Demo fatture 98 — simulazioni obbligatorie punto 21", () => {
  it("mantiene lo scope della demo ed isola due stati aziendali", () => {
    const a = state(); const b = initialDemoState("other-fixture-company");
    const updated = confirm(addInvoiceToDemo(a, invoice("scope"), "acquisto"), "scope", 3);
    expect(updated.companyScope).toBe(COMPANY);
    expect(a.products.find(p => p.id === FILTER)?.quantity).toBe(0);
    expect(b.companyScope).toBe("other-fixture-company");
    expect(b.reviews.some(r => r.invoice.id === "scope")).toBe(false);
  });

  it("carica solo materiali e mantiene manodopera, trasporto e sconto nella fattura finanziaria", () => {
    const base = invoice("mixed");
    base.lines.push(
      { ...base.lines[0], id: "mixed:2", number: 2, name: "Manodopera officina", kind: "servizio", quantity: 2, unit: "ORE", codes: [], totalCents: 8000 },
      { ...base.lines[0], id: "mixed:3", number: 3, name: "Trasporto", kind: "accessorio", quantity: 1, codes: [], totalCents: 2000 },
      { ...base.lines[0], id: "mixed:4", number: 4, name: "Sconto", kind: "sconto", quantity: 1, codes: [], totalCents: -1000 },
    );
    base.totalCents = 49000;
    const pending = addInvoiceToDemo(state(), base, "acquisto");
    expect(stock(pending).quantity).toBe(0);
    expect(review(pending, "mixed").rows.slice(1).every(row => !row.included)).toBe(true);
    const staged = review(pending, "mixed").rows.map((row, index) => index === 0
      ? { ...rows(pending, "mixed")[0], receiveQuantity: 10 }
      : { ...row, included: false, verified: true });
    const imported = confirmDemoImport(pending, { invoiceId: "mixed", operationId: "mixed-confirm", receiptConfirmed: true, rows: staged });
    expect(stock(imported).quantity).toBe(10);
    expect(imported.movements.filter(m => m.invoiceId === "mixed")).toHaveLength(1);
    const financed = registerDemoFinance(imported, "mixed");
    expect(financed.financeExpensesCents).toBe(49000);
    expect(review(financed, "mixed").invoice.lines).toHaveLength(4);
  });

  it("non unisce automaticamente nomi simili privi di codici o verifica umana", () => {
    const s = addInvoiceToDemo(state(2), invoice("similar", {}, { name: "Filtro olio Fendt 822", codes: [] }), "acquisto");
    const row = review(s, "similar").rows[0];
    expect(row.matchStatus).not.toBe("riconosciuto");
    expect(row.verified).toBe(false);
    expect(stock(s).quantity).toBe(2);
    expect(s.aliases).toHaveLength(0);
    const pending = confirmDemoImport(s, { invoiceId: "similar", operationId: "no-human", receiptConfirmed: true, rows: [{ ...row, included: true, receiveQuantity: 3 }] });
    expect(stock(pending).quantity).toBe(2);
    expect(pending.movements).toHaveLength(0);
    expect(pending.aliases).toHaveLength(0);
    expect(review(pending, "similar").rows[0].verified).toBe(false);
  });

  it("mantiene ambigui modelli differenti, anche con descrizioni molto simili", () => {
    const initial = state();
    initial.products.push(product("fixture-filter-724", { nome: "Filtro olio Fendt 724", codice: "OEM-724", identifiers: ["OEM-724"], description: "Filtro olio modello 724" }));
    const s = addInvoiceToDemo(initial, invoice("ambiguous", {}, { name: "Filtro olio Fendt 724 / 822 da verificare", codes: [] }), "acquisto");
    expect(review(s, "ambiguous").rows[0]).toMatchObject({ verified: false });
    expect(review(s, "ambiguous").rows[0].matchStatus).not.toBe("riconosciuto");
    expect(s.movements).toHaveLength(0);
    expect(s.products).toHaveLength(3);
  });

  it("memorizza il codice fornitore solo dopo conferma e riconosce la seconda fattura", () => {
    const first = addInvoiceToDemo(state(), invoice("alias-first"), "acquisto");
    expect(first.aliases).toHaveLength(0);
    const confirmed = confirm(first, "alias-first", 10);
    expect(confirmed.aliases).toContainEqual(expect.objectContaining({ supplierKey: "IT:00000000098", code: "FO822", productId: FILTER, active: true, factor: 1 }));
    const second = addInvoiceToDemo(confirmed, invoice("alias-second", {}, { name: "CARTUCCIA OLIO MOT. 822" }), "acquisto");
    expect(review(second, "alias-second").rows[0]).toMatchObject({ productId: FILTER, matchStatus: "riconosciuto", factor: 1 });
    expect(stock(second).quantity).toBe(10);
  });

  it("lo stesso codice commerciale di fornitori diversi non identifica lo stesso articolo", () => {
    let s = confirm(addInvoiceToDemo(state(), invoice("supplier-a"), "acquisto"), "supplier-a", 10);
    const b = invoice("supplier-b", { supplierKey: "IT:00000000099", supplierName: "Fornitore simulato B", supplierVat: "00000000099" }, { name: "Fusibile mini 10 A", unitPriceCents: 100, totalCents: 1000 });
    s = addInvoiceToDemo(s, b, "acquisto");
    expect(review(s, "supplier-b").rows[0].matchStatus).not.toBe("riconosciuto");
    s = confirmDemoImport(s, { invoiceId: b.id, operationId: "supplier-b-confirm", receiptConfirmed: true, rows: rows(s, b.id, { receiveQuantity: 10, famiglia: "Elettronica", sottocategoria: "Fusibili" }, FUSE) });
    expect(s.aliases.filter(a => a.code === "FO822").map(a => [a.supplierKey, a.productId])).toEqual(expect.arrayContaining([["IT:00000000098", FILTER], ["IT:00000000099", FUSE]]));
    const next = addInvoiceToDemo(s, invoice("supplier-b-next", { supplierKey: b.supplierKey, supplierName: b.supplierName, supplierVat: b.supplierVat }, { name: "Fusibile mini 10 A" }), "acquisto");
    expect(review(next, "supplier-b-next").rows[0].productId).toBe(FUSE);
  });

  it("crea un nuovo articolo solo dopo revisione esplicita e conserva la classificazione", () => {
    const s = addInvoiceToDemo(state(), invoice("new-part", {}, { name: "Sensore pressione olio", codes: [{ type: "SKU", value: "SENS-98" }], quantity: 2, totalCents: 8000 }), "acquisto");
    expect(s.products).toHaveLength(2);
    const staged = review(s, "new-part").rows.map(row => ({ ...row, productId: null, createNew: true, included: true, verified: true, factor: 1, receiveQuantity: 2, unit: "PZ", name: "Sensore pressione olio", ...classification, famiglia: "Elettronica", sottocategoria: "Sensori" }));
    const result = confirmDemoImport(s, { invoiceId: "new-part", operationId: "create-new", receiptConfirmed: true, rows: staged });
    expect(result.products).toHaveLength(3);
    expect(result.products.find(p => p.nome === "Sensore pressione olio")).toMatchObject({ quantity: 2, famiglia: "Elettronica", sottocategoria: "Sensori" });
  });

  it("riceve 6 + 4 = 10, mantiene il residuo e impedisce sovraricezione e doppio tap", () => {
    const initial = addInvoiceToDemo(state(), invoice("partial"), "acquisto");
    const six = confirm(initial, "partial", 6, "partial-six");
    expect(stock(six).quantity).toBe(6);
    expect(review(six, "partial").rows[0].receivedQuantity).toBe(6);
    replayWithoutSideEffects(six, () => confirm(six, "partial", 6, "partial-six"));
    rejectsAtomically(six, () => confirm(six, "partial", 5, "too-many"));
    const ten = confirm(six, "partial", 4, "partial-four");
    expect(stock(ten).quantity).toBe(10);
    expect(review(ten, "partial").rows[0].receivedQuantity).toBe(10);
    expect(ten.movements.filter(m => m.invoiceId === "partial").reduce((sum, m) => sum + m.delta, 0)).toBe(10);
    rejectsAtomically(ten, () => confirm(ten, "partial", 1, "eleventh"));
  });

  it("blocca la stessa fattura anche cambiando sourceHash e impedisce un secondo carico", () => {
    const s = confirm(addInvoiceToDemo(state(), invoice("duplicate"), "acquisto"), "duplicate", 10);
    rejectsAtomically(s, () => addInvoiceToDemo(s, invoice("duplicate", { sourceHash: "changed-copy-hash" }), "acquisto"));
    expect(stock(s).quantity).toBe(10);
    expect(s.reviews).toHaveLength(1);
  });

  it.each([0, 2])("inventario iniziale: 20 storici diventano 7 fisici, non 20 né giacenza %i + 7", (existing) => {
    const s = addInvoiceToDemo(state(existing), invoice(`historical-${existing}`, { date: "2025-03-01" }, { quantity: 20, totalCents: 80000 }), "inventario");
    const result = confirmDemoImport(s, { invoiceId: `historical-${existing}`, operationId: `inventory-${existing}`, receiptConfirmed: true, rows: rows(s, `historical-${existing}`, { physicalQuantity: 7, receiveQuantity: 0 }) });
    expect(stock(result).quantity).toBe(7);
    expect(result.movements).toContainEqual(expect.objectContaining({ kind: "rettifica", quantityBefore: existing, quantityAfter: 7, delta: 7 - existing }));
    expect(result.financeExpensesCents).toBe(0);
  });

  it("DDT precaricato da 10: il collegamento fattura non carica altri 10", () => {
    const loaded = recordDemoDelivery(state(), { productId: FILTER, quantity: 10, reference: "DDT simulato 98", operationId: "delivery-10" });
    const movement = loaded.movements[loaded.movements.length - 1];
    const pending = addInvoiceToDemo(loaded, invoice("ddt-invoice"), "acquisto");
    review(pending, "ddt-invoice").rows = rows(pending, "ddt-invoice");
    const linked = linkDemoDelivery(pending, { invoiceId: "ddt-invoice", lineId: "ddt-invoice:1", movementId: movement.id, quantity: 10, operationId: "link-ddt" });
    expect(stock(linked).quantity).toBe(10);
    expect(linked.movements).toHaveLength(1);
    expect(review(linked, "ddt-invoice").rows[0]).toMatchObject({ receivedQuantity: 10, linkedMovementIds: [movement.id] });
    replayWithoutSideEffects(linked, () => linkDemoDelivery(linked, { invoiceId: "ddt-invoice", lineId: "ddt-invoice:1", movementId: movement.id, quantity: 10, operationId: "link-ddt" }));
    rejectsAtomically(linked, () => confirm(linked, "ddt-invoice", 10, "no-extra-10"));
  });

  it("collega più DDT e quantità parziali senza riutilizzare quantità già collegate", () => {
    let s = recordDemoDelivery(state(), { productId: FILTER, quantity: 6, reference: "DDT A", operationId: "ddt-a" });
    const a = s.movements[s.movements.length - 1].id;
    s = recordDemoDelivery(s, { productId: FILTER, quantity: 4, reference: "DDT B", operationId: "ddt-b" });
    const b = s.movements[s.movements.length - 1].id;
    s = addInvoiceToDemo(s, invoice("multi-ddt"), "acquisto");
    review(s, "multi-ddt").rows = rows(s, "multi-ddt");
    s = linkDemoDelivery(s, { invoiceId: "multi-ddt", lineId: "multi-ddt:1", movementId: a, quantity: 3, operationId: "link-a1" });
    s = linkDemoDelivery(s, { invoiceId: "multi-ddt", lineId: "multi-ddt:1", movementId: a, quantity: 3, operationId: "link-a2" });
    s = linkDemoDelivery(s, { invoiceId: "multi-ddt", lineId: "multi-ddt:1", movementId: b, quantity: 4, operationId: "link-b" });
    expect(stock(s).quantity).toBe(10);
    expect(s.movements).toHaveLength(2);
    expect(s.movements.map(m => m.linkedQuantity)).toEqual([6, 4]);
    expect(review(s, "multi-ddt").rows[0].receivedQuantity).toBe(10);
    expect(new Set(review(s, "multi-ddt").rows[0].linkedMovementIds)).toEqual(new Set([a, b]));
    rejectsAtomically(s, () => linkDemoDelivery(s, { invoiceId: "multi-ddt", lineId: "multi-ddt:1", movementId: a, quantity: 1, operationId: "reuse-ddt" }));
  });

  it("2 confezioni × fattore 10 = 20 pezzi e costo netto coerente dopo sconto", () => {
    const s = addInvoiceToDemo(state(), invoice("packs", {}, { name: "Fusibili mini 10 A — 2 confezioni da 10 pezzi", quantity: 2, unit: "CONF", unitPriceCents: 2000, totalCents: 3600, codes: [{ type: "SKU", value: "CONF-FUSE" }], adjustments: [{ type: "SC", percent: 10, amountCents: null }] }), "acquisto");
    // receiveQuantity resta nell'UM fattura (CONF); solo la movimentazione è nell'UM prodotto (PZ).
    const result = confirmDemoImport(s, { invoiceId: "packs", operationId: "receive-packs", receiptConfirmed: true, rows: rows(s, "packs", { factor: 10, receiveQuantity: 2, famiglia: "Elettronica", sottocategoria: "Fusibili" }, FUSE) });
    expect(stock(result, FUSE)).toMatchObject({ quantity: 20, unit: "PZ", lastPurchaseCents: 180 });
    expect(result.prices).toContainEqual(expect.objectContaining({ productId: FUSE, unitPriceCents: 180, quantity: 20, adjustments: [{ type: "SC", percent: 10, amountCents: null }] }));
    expect(result.aliases).toContainEqual(expect.objectContaining({ invoiceUnit: "CONF", productUnit: "PZ", factor: 10 }));
  });

  it("10 × 4000 cent: prelievo Fendt 822 costa 4000, restano 9 e le spese restano 40000", () => {
    const imported = confirm(addInvoiceToDemo(state(), invoice("finance"), "acquisto"), "finance", 10);
    const financed = registerDemoFinance(imported, "finance");
    expect(financed.financeExpensesCents).toBe(40000);
    expect(stock(financed).quantity * stock(financed).valuationUnitCents).toBe(40000);
    const used = withdrawDemoPart(financed, { productId: FILTER, quantity: 1, operationId: "use-on-822" });
    expect(stock(used).quantity).toBe(9);
    expect(stock(used).quantity * stock(used).valuationUnitCents).toBe(36000);
    expect(used.machine.materialCostCents).toBe(4000);
    expect(used.financeExpensesCents).toBe(40000);
    expect(used.movements).toContainEqual(expect.objectContaining({ productId: FILTER, kind: "scarico", delta: -1, unitCostCents: 4000 }));
    expect(registerDemoFinance(used, "finance").financeExpensesCents).toBe(40000);
    replayWithoutSideEffects(used, () => withdrawDemoPart(used, { productId: FILTER, quantity: 1, operationId: "use-on-822" }));
  });

  it("una fattura già registrata in Finanza non viene contabilizzata di nuovo dal carico", () => {
    const registered = registerDemoFinance(addInvoiceToDemo(state(), invoice("pre-finance"), "acquisto"), "pre-finance");
    const imported = confirm(registered, "pre-finance", 10);
    expect(imported.financeExpensesCents).toBe(40000);
    expect(registerDemoFinance(imported, "pre-finance").financeExpensesCents).toBe(40000);
  });

  it("nuovi prezzi non riscrivono il costo storico di un prelievo già attribuito al mezzo", () => {
    let s = confirm(addInvoiceToDemo(state(), invoice("old-price"), "acquisto"), "old-price", 10);
    s = withdrawDemoPart(s, { productId: FILTER, quantity: 1, operationId: "historical-use" });
    const oldMovement = structuredClone(s.movements.find(m => m.kind === "scarico"));
    const costBefore = s.machine.materialCostCents;
    s = confirm(addInvoiceToDemo(s, invoice("new-price", { date: "2026-11-15" }, { quantity: 5, unitPriceCents: 6000, totalCents: 30000 }), "acquisto"), "new-price", 5);
    expect(stock(s).lastPurchaseCents).toBe(6000);
    expect(s.machine.materialCostCents).toBe(costBefore);
    expect(s.movements.find(m => m.id === oldMovement?.id)).toEqual(oldMovement);
    expect(s.prices.filter(p => p.productId === FILTER).map(p => p.unitPriceCents)).toEqual([4000, 6000]);
  });

  it("pagamento separato dalla registrazione, senza nuovo carico o incremento delle spese", () => {
    const registered = registerDemoFinance(addInvoiceToDemo(state(), invoice("paid"), "acquisto"), "paid");
    expect(review(registered, "paid")).toMatchObject({ financeRegistered: true, paid: false });
    const paid = payDemoInvoice(registered, "paid");
    expect(review(paid, "paid")).toMatchObject({ financeRegistered: true, paid: true });
    expect(paid.financeExpensesCents).toBe(40000);
    expect(paid.movements).toEqual(registered.movements);
    expect(payDemoInvoice(paid, "paid").financeExpensesCents).toBe(40000);
  });

  it("richiede conferma fisica della ricezione e rende atomico un errore di seconda riga", () => {
    const inv = invoice("atomic");
    inv.lines.push({ ...inv.lines[0], id: "atomic:2", number: 2 });
    const s = addInvoiceToDemo(state(), inv, "acquisto");
    rejectsAtomically(s, () => confirmDemoImport(s, { invoiceId: "atomic", operationId: "no-receipt", receiptConfirmed: false, rows: rows(s, "atomic", { receiveQuantity: 3 }) }));
    const staged = rows(s, "atomic", { receiveQuantity: 3 });
    staged[1].receiveQuantity = Infinity;
    rejectsAtomically(s, () => confirmDemoImport(s, { invoiceId: "atomic", operationId: "bad-second-row", receiptConfirmed: true, rows: staged }));
    expect(s.movements).toHaveLength(0);
    expect(s.aliases).toHaveLength(0);
    expect(s.prices).toHaveLength(0);
    expect(s.operations).not.toContain("bad-second-row");
  });

  it("quantità zero mantiene la riga sospesa e non genera carichi, prezzi o alias", () => {
    const pending = addInvoiceToDemo(state(), invoice("zero-receipt"), "acquisto");
    const result = confirm(pending, "zero-receipt", 0);
    expect(stock(result).quantity).toBe(0);
    expect(result.movements).toHaveLength(0);
    expect(result.prices).toHaveLength(0);
    expect(result.aliases).toHaveLength(0);
    expect(review(result, "zero-receipt").rows[0].receivedQuantity).toBe(0);
  });

  it.each([-1, NaN, Infinity, -Infinity])("rifiuta quantità ricevuta negativa/non finita: %s", (quantity) => {
    const s = addInvoiceToDemo(state(), invoice("bad-quantity"), "acquisto");
    rejectsAtomically(s, () => confirm(s, "bad-quantity", quantity));
  });

  it.each([0, -1, NaN, Infinity])("rifiuta fattori di conversione non positivi/finiti: %s", (factor) => {
    const s = addInvoiceToDemo(state(), invoice("bad-factor"), "acquisto");
    rejectsAtomically(s, () => confirmDemoImport(s, { invoiceId: "bad-factor", operationId: "bad-factor", receiptConfirmed: true, rows: rows(s, "bad-factor", { receiveQuantity: 1, factor }) }));
  });

  it.each([0, -1, NaN, Infinity])("DDT, prelievo e reso rifiutano quantità non valide: %s", (quantity) => {
    const s = state(10);
    rejectsAtomically(s, () => recordDemoDelivery(s, { productId: FILTER, quantity, reference: "DDT", operationId: "bad-delivery" }));
    rejectsAtomically(s, () => withdrawDemoPart(s, { productId: FILTER, quantity, operationId: "bad-withdraw" }));
    rejectsAtomically(s, () => returnDemoPart(s, { productId: FILTER, quantity, reason: "Reso fisico simulato", operationId: "bad-return" }));
  });

  it("impedisce il prelievo oltre giacenza e rileva conflitto ottimistico di stock", () => {
    const s = addInvoiceToDemo(state(2), invoice("conflict"), "acquisto");
    rejectsAtomically(s, () => withdrawDemoPart(s, { productId: FILTER, quantity: 3, operationId: "underflow" }));
    rejectsAtomically(s, () => confirmDemoImport(s, { invoiceId: "conflict", operationId: "stale", receiptConfirmed: true, rows: rows(s, "conflict", { receiveQuantity: 3 }), expectedStock: { [FILTER]: 1 } }));
    expect(stock(confirmDemoImport(s, { invoiceId: "conflict", operationId: "fresh", receiptConfirmed: true, rows: rows(s, "conflict", { receiveQuantity: 3 }), expectedStock: { [FILTER]: 2 } })).quantity).toBe(5);
  });

  it("una nota di credito non provoca un reso automatico: il reso fisico è esplicito e non cancella l'audit", () => {
    const loaded = confirm(addInvoiceToDemo(state(), invoice("return-base"), "acquisto"), "return-base", 10);
    const originalMovements = structuredClone(loaded.movements);
    const originalAudit = structuredClone(loaded.audit);
    const pending = addInvoiceToDemo(loaded, invoice("credit-note", { type: "TD04", totalCents: -8000 }, { quantity: 2, totalCents: -8000, kind: "sconto" }), "acquisto");
    expect(stock(pending).quantity).toBe(10);
    expect(pending.movements).toEqual(originalMovements);
    const returned = returnDemoPart(pending, { productId: FILTER, quantity: 2, reason: "Restituzione fisica al fornitore", operationId: "physical-return" });
    expect(stock(returned).quantity).toBe(8);
    expect(returned.movements.slice(0, originalMovements.length)).toEqual(originalMovements);
    expect(returned.audit.slice(0, originalAudit.length)).toEqual(originalAudit);
    expect(returned.movements).toContainEqual(expect.objectContaining({ kind: "reso", productId: FILTER, delta: -2 }));
    expect(returned.audit.length).toBeGreaterThan(originalAudit.length);
    replayWithoutSideEffects(returned, () => returnDemoPart(returned, { productId: FILTER, quantity: 2, reason: "Restituzione fisica al fornitore", operationId: "physical-return" }));
    rejectsAtomically(returned, () => returnDemoPart(returned, { productId: FILTER, quantity: 1, reason: "", operationId: "no-reason" }));
  });
});
