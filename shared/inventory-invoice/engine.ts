import type {
  Classification, DemoState, ImportConfirmation, ImportProduct, InvoiceLine,
  InvoiceReview, MatchResult, ReviewRow, StockMovement, WarehouseInvoice,
} from "./types";

/** Motore deterministico di sessione. Nessuna persistenza, API o dipendenza Node.
 * Quantità di ricezione/collegamento DDT nell'UM fattura; movimenti nell'UM prodotto.
 * La classificazione è un suggerimento tramite regole, NON una risposta IA.
 */
const DEMO_EPOCH = Date.UTC(2026, 10, 1);
const text = (value: string) => value.trim();
const codeKey = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} obbligatorio`);
  return value.trim();
}

function cents(value: number, label: string, signed = false): number {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) {
    throw new Error(`${label}: usare centesimi interi validi${signed ? "" : " non negativi"}`);
  }
  return value;
}

function quantity(value: number, label: string, positive = false): number {
  const milli = Math.round(value * 1000);
  if (!Number.isFinite(value) || !Number.isSafeInteger(milli)
      || Math.abs(value * 1000 - milli) > 0.000001
      || (positive ? value <= 0 : value < 0)) {
    throw new Error(`${label}: quantità ${positive ? "positiva" : "non negativa"}, finita, con massimo 3 decimali`);
  }
  return milli / 1000;
}

function factorValue(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    throw new Error("Confermare esplicitamente un fattore di conversione positivo");
  }
  return value;
}

function addQuantity(a: number, b: number): number {
  return quantity((Math.round(a * 1000) + Math.round(b * 1000)) / 1000, "Giacenza risultante");
}

function unitKey(value: string | null): string {
  const key = (value ?? "").trim().toLowerCase().replace(/\./g, "");
  const units: Record<string, string> = {
    pz: "pz", nr: "pz", n: "pz", pezzo: "pz", pezzi: "pz", pcs: "pz", pc: "pz",
    conf: "conf", confezione: "conf", confezioni: "conf",
    scatola: "scatola", scatole: "scatola", box: "scatola",
    l: "l", lt: "l", litro: "l", litri: "l",
    kg: "kg", chilogrammo: "kg", chilogrammi: "kg",
    m: "m", mt: "m", metro: "m", metri: "m",
  };
  return units[key] ?? key;
}

export function normalizeArticleName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).map((word) => ({ filt: "filtro", filtri: "filtro", cart: "cartuccia", mot: "motore" } as Record<string, string>)[word] ?? word)
    .join(" ");
}

function canonicalName(value: string): string {
  return normalizeArticleName(value).split(" ")
    .filter((word) => !["cartuccia", "motore", "per", "di", "da", "del", "della"].includes(word))
    .sort().join(" ");
}

function compatibleNumbers(a: string, b: string): boolean {
  const numbers = (v: string) => Array.from(new Set(normalizeArticleName(v).match(/\d+/g) ?? [])).sort();
  const left = numbers(a);
  const right = numbers(b);
  // Non confondere 822/824, 10 A/20 A o cuscinetti con dimensioni differenti.
  return !left.length || !right.length || left.join("|") === right.join("|");
}

function similarName(a: string, b: string): boolean {
  if (!compatibleNumbers(a, b)) return false;
  if (canonicalName(a) === canonicalName(b)) return true;
  const words = (s: string) => new Set(canonicalName(s).split(" ").filter(Boolean));
  const left = words(a);
  const right = words(b);
  const common = Array.from(left).filter((w) => right.has(w)).length;
  return common >= 2 && common / Math.max(left.size, right.size) >= 0.6;
}

function productIn(state: DemoState, id: string): ImportProduct {
  const product = state.products.find((entry) => entry.id === id);
  if (!product) throw new Error("Articolo non appartenente a questa sessione demo");
  quantity(product.quantity, "Giacenza articolo");
  cents(product.valuationUnitCents, "Costo di valorizzazione");
  return product;
}

function reviewIn(state: DemoState, id: string): InvoiceReview {
  const review = state.reviews.find((entry) => entry.invoice.id === id);
  if (!review) throw new Error("Fattura non appartenente a questa sessione demo");
  return review;
}

function assertState(state: DemoState): void {
  if (state.version !== 1) throw new Error("Versione della sessione demo non supportata");
  required(state.companyScope, "Ambito della sessione demo");
  cents(state.financeExpensesCents, "Totale spese", true);
  cents(state.machine.materialCostCents, "Costo materiali mezzo");
}

function stamp(state: DemoState): string {
  return new Date(DEMO_EPOCH + state.audit.length * 1000).toISOString();
}

function nextId(state: DemoState, kind: string): string {
  return `${encodeURIComponent(state.companyScope)}:${kind}:${state.audit.length + 1}:${state.products.length + state.movements.length + state.prices.length + state.aliases.length}`;
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(",")}}`;
}

/** operationId è globale alla sessione: stessa richiesta = replay, payload diverso = conflitto. */
function transaction(
  state: DemoState, operationId: string, action: string, reference: string,
  payload: unknown, apply: (draft: DemoState) => void,
): DemoState {
  assertState(state);
  required(operationId, "Identificativo operazione");
  const fingerprint = stableJson({ action, reference, payload });
  if (state.operations.includes(operationId)) {
    const entry = state.audit.find((audit) => {
      try { return JSON.parse(audit.details).operationId === operationId; } catch { return false; }
    });
    if (!entry || JSON.parse(entry.details).fingerprint !== fingerprint) {
      throw new Error("operationId già utilizzato per una richiesta differente");
    }
    return structuredClone(state);
  }
  // Le verifiche e le modifiche sono transazionali sul clone: nessun errore può alterare l'input.
  const draft = structuredClone(state);
  apply(draft);
  draft.audit.push({
    id: nextId(draft, "audit"), date: stamp(draft), action, reference,
    details: JSON.stringify({ operationId, fingerprint, payload }),
  });
  draft.operations.push(operationId);
  return draft;
}

export function initialDemoState(scope = "demo"): DemoState {
  required(scope, "Ambito demo");
  const prefix = encodeURIComponent(scope);
  return {
    version: 1, companyScope: scope,
    products: [{
      id: `${prefix}:product:filtro-822`, nome: "Filtro olio Fendt 822", codice: "FENDT-OIL-822",
      description: "Filtro olio Fendt 822", unit: "pz", quantity: 2,
      valuationUnitCents: 4000, lastPurchaseCents: null, identifiers: ["FENDT-OIL-822"],
      categoria: "Ricambi", reparto: "Motore", famiglia: "Filtri olio", sottocategoria: "",
    }],
    reviews: [], aliases: [], movements: [], prices: [], audit: [], operations: [],
    machine: { id: `${prefix}:machine:fendt-822`, name: "Fendt 822", materialCostCents: 0 },
    financeExpensesCents: 0,
  };
}

function excludedLine(line: InvoiceLine): boolean {
  return ["servizio", "accessorio", "sconto"].includes(line.kind) || line.totalCents < 0;
}

function supplierCodes(line: InvoiceLine): InvoiceLine["codes"] {
  return line.codes.filter((code) => !/OEM|EAN|GTIN|BARCODE|ORIGINALE|PRODUTTORE/i.test(code.type));
}

function conversion(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, product: ImportProduct): number | null {
  const invoiceUnit = unitKey(line.unit);
  const productUnit = unitKey(product.unit);
  if (!invoiceUnit || !productUnit) return null;
  const remembered = state.aliases.filter((alias) => alias.active
    && alias.supplierKey === invoice.supplierKey && alias.productId === product.id
    && supplierCodes(line).some((code) => codeKey(code.value) === codeKey(alias.code))
    && unitKey(alias.invoiceUnit) === invoiceUnit && unitKey(alias.productUnit) === productUnit);
  if (remembered.length) {
    const factors = Array.from(new Set(remembered.map((alias) => alias.factor)));
    return factors.length === 1 && Number.isFinite(factors[0]) && factors[0] > 0 ? factors[0] : null;
  }
  return invoiceUnit === productUnit ? 1 : null;
}

function resultFor(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, ids: string[], reason: string, trusted: boolean): MatchResult {
  const unique = Array.from(new Set(ids));
  const product = unique.length === 1 ? productIn(state, unique[0]) : null;
  const factor = product ? conversion(state, invoice, line, product) : null;
  const numericAnomaly = product !== null && !compatibleNumbers(line.name, product.nome);
  return {
    status: product && trusted && factor !== null && !numericAnomaly ? "riconosciuto" : "verifica",
    productId: product?.id ?? null, candidateIds: unique, factor,
    reason: `${reason}${numericAnomaly ? "; anomalia numeri/modello: verifica esplicita obbligatoria" : ""}${product && factor === null ? "; verificare UM e fattore esplicito" : ""}`,
  };
}

export function matchInvoiceLine(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine): MatchResult {
  assertState(state);
  if (excludedLine(line) || invoice.type === "TD04") {
    return { status: "escluso", productId: null, candidateIds: [], factor: null,
      reason: invoice.type === "TD04" ? "Nota di credito: nessun movimento fisico automatico" : "Riga non destinata alle scorte; resta nella fattura e in Finanza" };
  }
  const aliases = state.aliases.filter((alias) => alias.active && alias.supplierKey === invoice.supplierKey
    && supplierCodes(line).some((code) => codeKey(code.value) === codeKey(alias.code)));
  if (aliases.length) {
    return resultFor(state, invoice, line, aliases.map((alias) => alias.productId), "Codice fornitore confermato nella sessione demo", true);
  }
  const ids = state.products.filter((product) => line.codes.some((code) =>
    product.identifiers.some((identifier) => codeKey(identifier) === codeKey(code.value))
    || (/OEM|EAN|GTIN|BARCODE|ORIGINALE|PRODUTTORE/i.test(code.type) && codeKey(product.codice) === codeKey(code.value))));
  if (ids.length) {
    return resultFor(state, invoice, line, ids.map((product) => product.id), "Identificativo strutturato OEM/EAN/articolo", true);
  }
  const candidates = state.products.filter((product) => similarName(line.name, product.nome) || similarName(line.name, product.description));
  if (candidates.length) {
    return resultFor(state, invoice, line, candidates.map((product) => product.id), "Suggerimento deterministico per descrizione: verifica del proprietario obbligatoria, nessuna unione automatica", false);
  }
  return { status: "nuovo", productId: null, candidateIds: [],
    factor: unitKey(line.unit) ? 1 : null, reason: "Nuovo articolo proposto tramite regole; creazione solo alla conferma" };
}

function classification(state: DemoState, name: string): Classification {
  const normalized = normalizeArticleName(name);
  // Riutilizza prima le classificazioni dell'anagrafica della sessione.
  const relative = state.products.find((product) => normalizeArticleName(product.nome).split(" ")[0] === normalized.split(" ")[0]);
  if (relative) return { categoria: relative.categoria, reparto: relative.reparto, famiglia: relative.famiglia, sottocategoria: relative.sottocategoria };
  if (/fusibil|sensore|elettric/.test(normalized)) {
    return { categoria: "Ricambi", reparto: "Elettronica ed elettrico", famiglia: "Elettrico", sottocategoria: /fusibil/.test(normalized) ? "Fusibili" : "Sensori" };
  }
  if (/cuscinetto/.test(normalized)) return { categoria: "Ricambi", reparto: "Meccanica", famiglia: "Altro", sottocategoria: "Cuscinetti" };
  return { categoria: "Ricambi", reparto: "Meccanica", famiglia: "Altro", sottocategoria: "" };
}

function validateInvoice(invoice: WarehouseInvoice): void {
  required(invoice.id, "Identificativo fattura");
  required(invoice.sourceHash, "Impronta documento");
  required(invoice.number, "Numero fattura");
  required(invoice.supplierKey, "Identificativo fornitore");
  required(invoice.supplierName, "Fornitore");
  if (invoice.currency.toUpperCase() !== "EUR") throw new Error("La demo accetta esclusivamente importi EUR, senza conversioni implicite");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.date) || Number.isNaN(Date.parse(invoice.date))
      || new Date(invoice.date).toISOString().slice(0, 10) !== invoice.date) throw new Error("Data fattura non valida");
  cents(invoice.totalCents, "Totale fattura", invoice.type === "TD04");
  if (!invoice.lines.length || invoice.lines.length > 500) throw new Error("La fattura deve contenere da 1 a 500 righe");
  const ids = new Set<string>();
  for (const line of invoice.lines) {
    required(line.id, "Identificativo riga");
    required(line.name, "Descrizione riga");
    if (ids.has(line.id)) throw new Error("Identificativo riga duplicato nella fattura");
    ids.add(line.id);
    if (!Number.isSafeInteger(line.number) || line.number <= 0) throw new Error("Numero riga non valido");
    if (line.quantity !== null) quantity(line.quantity, "Quantità fattura");
    cents(line.unitPriceCents, "Prezzo unitario", true);
    cents(line.totalCents, "Totale riga", true);
    if (!Number.isFinite(line.vatRate) || line.vatRate < 0) throw new Error("Aliquota IVA non valida");
    for (const code of line.codes) required(code.value, "Codice articolo");
    for (const adjustment of line.adjustments) {
      if (adjustment.amountCents !== null) cents(adjustment.amountCents, "Sconto/maggiorazione");
      if (adjustment.percent !== null && (!Number.isFinite(adjustment.percent) || adjustment.percent < 0)) throw new Error("Percentuale sconto/maggiorazione non valida");
    }
  }
}

export function addInvoiceToDemo(state: DemoState, invoice: WarehouseInvoice, mode: InvoiceReview["mode"]): DemoState {
  assertState(state);
  validateInvoice(invoice);
  if (mode !== "acquisto" && mode !== "inventario") throw new Error("Modalità importazione non valida");
  const documentKey = (document: WarehouseInvoice) => `${document.supplierKey}|${codeKey(document.number)}|${document.date}|${document.type}`;
  if (state.reviews.some((review) => review.invoice.id === invoice.id || review.invoice.sourceHash === invoice.sourceHash
      || documentKey(review.invoice) === documentKey(invoice))) throw new Error("Fattura già acquisita: documento duplicato bloccato");
  return transaction(state, `document:${invoice.id}`, "fattura_importata", invoice.id, { invoice, mode }, (draft) => {
    const rows: ReviewRow[] = invoice.lines.map((line) => {
      const match = matchInvoiceLine(draft, invoice, line);
      const product = match.productId ? productIn(draft, match.productId) : null;
      return {
        ...classification(draft, line.name),
        ...(product ? { categoria: product.categoria, reparto: product.reparto, famiglia: product.famiglia, sottocategoria: product.sottocategoria } : {}),
        lineId: line.id, productId: match.productId, createNew: match.status === "nuovo",
        name: product?.nome ?? line.name, unit: product?.unit ?? (unitKey(line.unit) || "pz"),
        factor: match.factor, receiveQuantity: mode === "acquisto" && match.status !== "escluso" ? line.quantity ?? 0 : 0,
        physicalQuantity: null, included: match.status !== "escluso", verified: match.status === "riconosciuto" || match.status === "escluso",
        matchStatus: match.status, matchReason: match.reason, candidateIds: match.candidateIds,
        receivedQuantity: 0, linkedMovementIds: [],
      };
    });
    draft.reviews.push({ invoice: structuredClone(invoice), mode, rows, financeRegistered: false, paid: false });
  });
}

function movement(state: DemoState, product: ImportProduct, delta: number, fields: Pick<StockMovement, "kind" | "invoiceId" | "lineId" | "reference">): StockMovement {
  const before = product.quantity;
  const after = addQuantity(before, delta);
  const entry: StockMovement = {
    id: nextId(state, "movement"), productId: product.id, delta, ...fields,
    unitCostCents: product.valuationUnitCents, quantityBefore: before, quantityAfter: after,
    date: stamp(state), linkedQuantity: 0,
  };
  product.quantity = after;
  state.movements.push(entry);
  return entry;
}

function duplicateProducts(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, row: ReviewRow): ImportProduct[] {
  return state.products.filter((product) => canonicalName(product.nome) === canonicalName(row.name)
    || canonicalName(product.description) === canonicalName(line.name)
    || canonicalName(product.nome) === canonicalName(line.name)
    || line.codes.some((code) => product.identifiers.some((identifier) => codeKey(identifier) === codeKey(code.value))
      || (/OEM|EAN|GTIN|BARCODE|ORIGINALE|PRODUTTORE/i.test(code.type) && codeKey(product.codice) === codeKey(code.value)))
    || state.aliases.some((alias) => alias.active && alias.supplierKey === invoice.supplierKey && alias.productId === product.id
      && line.codes.some((code) => codeKey(code.value) === codeKey(alias.code))));
}

function rememberAliases(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, product: ImportProduct, factor: number): void {
  const invoiceUnit = required(line.unit ?? "", "UM fattura: correggere l'XML o confermare un'UM esplicita in revisione");
  for (const code of Array.from(new Set(supplierCodes(line).map((entry) => codeKey(entry.value))))) {
    const existing = state.aliases.filter((alias) => alias.active && alias.supplierKey === invoice.supplierKey && codeKey(alias.code) === code);
    if (existing.some((alias) => alias.productId !== product.id || unitKey(alias.invoiceUnit) !== unitKey(invoiceUnit)
      || unitKey(alias.productUnit) !== unitKey(product.unit) || alias.factor !== factor)) {
      throw new Error("Alias o conversione già confermati con dati differenti: usare la correzione esplicita dell'associazione");
    }
    if (!existing.length) state.aliases.push({
      id: nextId(state, "alias"), supplierKey: invoice.supplierKey, supplierName: invoice.supplierName,
      code, productId: product.id, invoiceUnit, productUnit: product.unit, factor,
      active: true, confirmedAt: stamp(state),
    });
  }
}

function checkConversion(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, row: ReviewRow, product: ImportProduct): number {
  if (unitKey(row.unit) !== unitKey(product.unit)) throw new Error("L'UM della revisione deve coincidere con l'UM del prodotto selezionato");
  const factor = factorValue(row.factor);
  if (unitKey(line.unit) && unitKey(line.unit) === unitKey(product.unit) && factor !== 1) throw new Error("Stessa UM: il fattore deve essere 1");
  const remembered = conversion(state, invoice, line, product);
  const aliases = state.aliases.filter((alias) => alias.active && alias.supplierKey === invoice.supplierKey
    && supplierCodes(line).some((code) => codeKey(code.value) === codeKey(alias.code)));
  if (aliases.length && aliases.some((alias) => alias.productId !== product.id || unitKey(alias.invoiceUnit) !== unitKey(line.unit)
      || unitKey(alias.productUnit) !== unitKey(product.unit) || alias.factor !== factor)) {
    throw new Error("Associazione/conversione in conflitto: correggere esplicitamente l'alias prima della conferma");
  }
  if (remembered !== null && aliases.length && factor !== remembered) throw new Error("Fattore diverso dalla conversione confermata");
  return factor;
}

function recordPrice(state: DemoState, invoice: WarehouseInvoice, line: InvoiceLine, product: ImportProduct, factor: number): void {
  if (line.quantity === null || line.quantity <= 0) throw new Error("Quantità fatturata positiva necessaria per il prezzo netto");
  const fullQuantity = quantity(line.quantity * factor, "Quantità fatturata convertita", true);
  const unitPriceCents = cents(Math.round(line.totalCents / fullQuantity), "Prezzo unitario netto");
  const existing = state.prices.find((price) => price.invoiceId === invoice.id && price.lineId === line.id);
  if (existing) {
    if (existing.productId !== product.id || existing.quantity !== fullQuantity || existing.unitPriceCents !== unitPriceCents) throw new Error("Informazioni economiche della riga già confermate con dati differenti");
    return;
  }
  const latest = state.prices.filter((price) => price.productId === product.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  state.prices.push({
    id: nextId(state, "price"), productId: product.id, supplierKey: invoice.supplierKey,
    supplierName: invoice.supplierName, invoiceId: invoice.id, lineId: line.id,
    date: invoice.date, quantity: fullQuantity, unitPriceCents, adjustments: structuredClone(line.adjustments),
  });
  if (!latest || invoice.date >= latest.date) product.lastPurchaseCents = unitPriceCents;
  // Criterio demo stabile: NON rivalutare l'intera giacenza a ogni acquisto.
  if (product.valuationUnitCents === 0) product.valuationUnitCents = unitPriceCents;
}

function expectedStock(state: DemoState, expected?: Record<string, number>): void {
  if (!expected) return;
  for (const [id, value] of Object.entries(expected)) {
    if (productIn(state, id).quantity !== quantity(value, "Giacenza attesa")) throw new Error("Conflitto di giacenza: ricaricare lo stato e verificare prima di confermare");
  }
}

function assertNoReassociation(old: ReviewRow, row: ReviewRow): void {
  if (old.receivedQuantity > 0 && (old.productId !== row.productId || old.factor !== row.factor || unitKey(old.unit) !== unitKey(row.unit))) {
    throw new Error("Riga già ricevuta: non è possibile cambiare articolo, UM o fattore");
  }
}

export function confirmDemoImport(state: DemoState, input: ImportConfirmation): DemoState {
  return transaction(state, input.operationId, "importazione_confermata", input.invoiceId, input, (draft) => {
    const review = reviewIn(draft, input.invoiceId);
    expectedStock(draft, input.expectedStock);
    const seen = new Set<string>();
    const inventoryTargets = new Map<string, { target: number; lineId: string }>();
    const created = new Set<string>();
    for (const submitted of input.rows) {
      if (seen.has(submitted.lineId)) throw new Error("Riga ripetuta nella conferma");
      seen.add(submitted.lineId);
      const position = review.rows.findIndex((entry) => entry.lineId === submitted.lineId);
      const line = review.invoice.lines.find((entry) => entry.id === submitted.lineId);
      if (position < 0 || !line) throw new Error("Riga non appartenente alla fattura della sessione demo");
      const old = review.rows[position];
      // Contatori e collegamenti sono gestiti dal motore, mai accettati dal client.
      const row: ReviewRow = { ...structuredClone(submitted), receivedQuantity: old.receivedQuantity, linkedMovementIds: [...old.linkedMovementIds] };
      quantity(row.receiveQuantity, "Quantità ricevuta");
      if (row.physicalQuantity !== null) quantity(row.physicalQuantity, "Quantità fisica");
      if (row.factor !== null) factorValue(row.factor);
      assertNoReassociation(old, row);
      if (row.productId) productIn(draft, row.productId);
      review.rows[position] = row;
      if (!row.verified || !row.included) continue;
      if (excludedLine(line) || review.invoice.type === "TD04") throw new Error("Servizi, trasporti, sconti e note di credito non generano scorte");
      if (review.mode === "inventario" && row.physicalQuantity === null) throw new Error("Inventario: quantità fisica obbligatoria, anche se pari a zero");
      if (review.mode === "acquisto" && row.receiveQuantity === 0) continue;
      if (review.mode === "acquisto" && input.receiptConfirmed !== true) throw new Error("Confermare l'avvenuta ricezione fisica della merce prima del carico");
      required(row.name, "Nome articolo");
      required(row.unit, "UM prodotto");
      required(row.categoria, "Categoria");
      required(row.reparto, "Reparto");
      required(row.famiglia, "Famiglia");
      if (row.createNew && row.productId) throw new Error("Scegliere un articolo esistente oppure crearne uno nuovo, non entrambi");
      let product: ImportProduct;
      if (row.createNew) {
        const duplicates = duplicateProducts(draft, review.invoice, line, row);
        if (duplicates.length && !(duplicates.length === 1 && created.has(duplicates[0].id))) {
          throw new Error(`Articolo già esistente: associare la riga a ${duplicates.map((entry) => entry.nome).join(", ")} invece di creare un doppione`);
        }
        if (duplicates.length) product = duplicates[0];
        else {
          const identifierCodes = line.codes.filter((code) => /OEM|EAN|GTIN|BARCODE|ORIGINALE|PRODUTTORE/i.test(code.type)).map((code) => codeKey(code.value));
          product = {
            id: nextId(draft, "product"), nome: text(row.name), description: line.name,
            codice: identifierCodes[0] ?? nextId(draft, "article-code"), unit: text(row.unit),
            quantity: 0, valuationUnitCents: 0, lastPurchaseCents: null, identifiers: Array.from(new Set(identifierCodes)),
            categoria: text(row.categoria), reparto: text(row.reparto), famiglia: text(row.famiglia), sottocategoria: text(row.sottocategoria),
          };
          draft.products.push(product);
          created.add(product.id);
        }
        row.productId = product.id;
        row.createNew = false;
      } else {
        if (!row.productId) throw new Error("Confermare un articolo esistente oppure la creazione di un nuovo articolo");
        product = productIn(draft, row.productId);
      }
      const factor = checkConversion(draft, review.invoice, line, row, product);
      if (line.quantity === null || line.quantity <= 0) throw new Error("Quantità fatturata positiva obbligatoria per l'importazione");
      if (review.mode === "acquisto" && addQuantity(old.receivedQuantity, row.receiveQuantity) > line.quantity) throw new Error("Quantità superiore al residuo ancora da ricevere");
      const converted = quantity(row.receiveQuantity * factor, "Quantità ricevuta convertita");
      rememberAliases(draft, review.invoice, line, product, factor);
      recordPrice(draft, review.invoice, line, product, factor);
      Object.assign(product, { categoria: text(row.categoria), reparto: text(row.reparto), famiglia: text(row.famiglia), sottocategoria: text(row.sottocategoria) });
      row.matchStatus = "riconosciuto";
      row.matchReason = "Associazione e classificazione confermate dal proprietario";
      row.candidateIds = [product.id];
      if (review.mode === "inventario") {
        const target = quantity(row.physicalQuantity!, "Giacenza fisica");
        const previous = inventoryTargets.get(product.id);
        if (previous && previous.target !== target) throw new Error("Articolo ripetuto nell'inventario: indicare un'unica quantità fisica coerente per tutte le righe");
        inventoryTargets.set(product.id, { target, lineId: previous?.lineId ?? line.id });
      } else {
        movement(draft, product, converted, { kind: "carico", invoiceId: review.invoice.id, lineId: line.id, reference: `Fattura ${review.invoice.number}` });
        row.receivedQuantity = addQuantity(old.receivedQuantity, row.receiveQuantity);
        row.receiveQuantity = addQuantity(line.quantity, -row.receivedQuantity);
      }
    }
    // Un solo target fisico per articolo, mai somma delle quantità storiche.
    for (const [productId, target] of Array.from(inventoryTargets.entries())) {
      const product = productIn(draft, productId);
      const delta = (Math.round(target.target * 1000) - Math.round(product.quantity * 1000)) / 1000;
      movement(draft, product, delta, { kind: "rettifica", invoiceId: review.invoice.id, lineId: target.lineId, reference: `Inventario fisico da fattura ${review.invoice.number}` });
    }
  });
}

export function registerDemoFinance(state: DemoState, invoiceId: string): DemoState {
  const review = reviewIn(state, invoiceId);
  if (review.mode === "inventario") throw new Error("L'inventario storico non registra una nuova spesa finanziaria");
  return transaction(state, `finance:${invoiceId}`, "fattura_registrata_finanza", invoiceId, { invoiceId }, (draft) => {
    const current = reviewIn(draft, invoiceId);
    if (current.financeRegistered) throw new Error("Fattura già registrata in Finanza");
    const amount = current.invoice.type === "TD04" ? -Math.abs(current.invoice.totalCents) : current.invoice.totalCents;
    draft.financeExpensesCents = cents(draft.financeExpensesCents + amount, "Totale spese", true);
    current.financeRegistered = true;
  });
}

export function payDemoInvoice(state: DemoState, invoiceId: string): DemoState {
  return transaction(state, `payment:${invoiceId}`, "pagamento_fattura", invoiceId, { invoiceId }, (draft) => {
    const review = reviewIn(draft, invoiceId);
    if (!review.financeRegistered) throw new Error("Registrare prima la fattura in Finanza: il pagamento è un'azione distinta");
    if (review.paid) throw new Error("Fattura già pagata");
    review.paid = true;
  });
}

export type DemoPartOperation = { productId: string; quantity: number; operationId: string; expectedStock?: Record<string, number> };
export type DemoDeliveryInput = DemoPartOperation & { reference: string };

/** Ricevimento fisico DDT: quantità nell'UM prodotto, stock aggiornato una sola volta. */
export function recordDemoDelivery(state: DemoState, input: DemoDeliveryInput): DemoState {
  return transaction(state, input.operationId, "ricezione_ddt", input.reference, input, (draft) => {
    expectedStock(draft, input.expectedStock);
    required(input.reference, "Riferimento DDT/ricezione");
    const product = productIn(draft, input.productId);
    const received = quantity(input.quantity, "Quantità DDT", true);
    movement(draft, product, received, { kind: "carico", invoiceId: null, lineId: null, reference: input.reference });
  });
}

export type DemoDeliveryLinkInput = {
  invoiceId: string; lineId: string; movementId: string; quantity: number; operationId: string;
};

/** quantità nell'UM FATTURA. linkedQuantity del movimento è invece nell'UM PRODOTTO.
 * Può collegare frazioni di un DDT a più righe/fatture, senza alcun nuovo carico.
 */
export function linkDemoDelivery(state: DemoState, input: DemoDeliveryLinkInput): DemoState {
  return transaction(state, input.operationId, "ddt_collegato_fattura", input.invoiceId, input, (draft) => {
    const review = reviewIn(draft, input.invoiceId);
    if (review.mode !== "acquisto" || review.invoice.type === "TD04") throw new Error("Collegamento DDT consentito soltanto per fatture di acquisto");
    const row = review.rows.find((entry) => entry.lineId === input.lineId);
    const line = review.invoice.lines.find((entry) => entry.id === input.lineId);
    if (!row || !line || !row.productId || !row.included || !row.verified || excludedLine(line)) throw new Error("Verificare prima l'associazione della riga a un articolo esistente");
    const product = productIn(draft, row.productId);
    const delivery = draft.movements.find((entry) => entry.id === input.movementId);
    if (!delivery || delivery.kind !== "carico" || delivery.invoiceId !== null || delivery.productId !== product.id || delivery.delta <= 0) {
      throw new Error("Movimento DDT non appartenente all'articolo di questa sessione oppure non collegabile");
    }
    const received = quantity(input.quantity, "Quantità da collegare nell'UM fattura", true);
    const factor = checkConversion(draft, review.invoice, line, row, product);
    const converted = quantity(received * factor, "Quantità DDT convertita", true);
    quantity(delivery.linkedQuantity, "Quantità DDT già collegata");
    if (addQuantity(delivery.linkedQuantity, converted) > delivery.delta) throw new Error("Quantità superiore al residuo non collegato del DDT");
    if (line.quantity === null || addQuantity(row.receivedQuantity, received) > line.quantity) throw new Error("Quantità superiore al residuo della riga fattura");
    rememberAliases(draft, review.invoice, line, product, factor);
    recordPrice(draft, review.invoice, line, product, factor);
    delivery.linkedQuantity = addQuantity(delivery.linkedQuantity, converted);
    row.receivedQuantity = addQuantity(row.receivedQuantity, received);
    row.receiveQuantity = addQuantity(line.quantity, -row.receivedQuantity);
    if (!row.linkedMovementIds.includes(delivery.id)) row.linkedMovementIds.push(delivery.id);
    row.matchStatus = "riconosciuto";
    row.matchReason = "Carico DDT già registrato e collegato: nessun secondo aumento di scorta";
  });
}

/** Lo snapshot di costo è quello stabile della valorizzazione, non l'ultimo prezzo. */
export function withdrawDemoPart(state: DemoState, input: DemoPartOperation): DemoState {
  return transaction(state, input.operationId, "prelievo_officina", input.productId, input, (draft) => {
    expectedStock(draft, input.expectedStock);
    const product = productIn(draft, input.productId);
    const withdrawn = quantity(input.quantity, "Quantità prelevata", true);
    if (withdrawn > product.quantity) throw new Error("Giacenza insufficiente per il prelievo");
    const snapshotCents = cents(Math.round(withdrawn * product.valuationUnitCents), "Costo materiali prelevati");
    const total = cents(draft.machine.materialCostCents + snapshotCents, "Costo materiali del mezzo");
    movement(draft, product, -withdrawn, { kind: "scarico", invoiceId: null, lineId: null, reference: `${draft.machine.id} · ${draft.machine.name} · ${input.operationId}` });
    draft.machine.materialCostCents = total;
    // Il movimento e l'audit costituiscono lo storico dell'intervento demo. Finanza invariata.
  });
}

/** Reso fisico al fornitore: scarica scorte, NON emette crediti né modifica costi mezzo.
 * Un eventuale rientro dall'Officina è un ricevimento esplicito, non una nota di credito.
 */
export function returnDemoPart(state: DemoState, input: DemoPartOperation & { reason: string }): DemoState {
  return transaction(state, input.operationId, "reso_fisico_fornitore", input.productId, input, (draft) => {
    expectedStock(draft, input.expectedStock);
    required(input.reason, "Motivo del reso fisico");
    const product = productIn(draft, input.productId);
    const returned = quantity(input.quantity, "Quantità restituita", true);
    if (returned > product.quantity) throw new Error("Giacenza insufficiente per il reso fisico");
    movement(draft, product, -returned, { kind: "reso", invoiceId: null, lineId: null, reference: input.reason });
  });
}

/** Correzione esplicita: preserva l'alias precedente disattivato, senza sovrascrivere lo storico. */
export function changeAlias(state: DemoState, input: {
  aliasId: string; productId: string; invoiceUnit: string; factor: number; reason: string; operationId: string;
}): DemoState {
  return transaction(state, input.operationId, "alias_corretto", input.aliasId, input, (draft) => {
    required(input.reason, "Motivo correzione alias");
    required(input.invoiceUnit, "UM fattura");
    const alias = draft.aliases.find((entry) => entry.id === input.aliasId && entry.active);
    if (!alias) throw new Error("Alias attivo non appartenente alla sessione demo");
    const product = productIn(draft, input.productId);
    const factor = factorValue(input.factor);
    if (unitKey(input.invoiceUnit) === unitKey(product.unit) && factor !== 1) throw new Error("Stessa UM: fattore obbligatoriamente 1");
    if (draft.aliases.some((entry) => entry.active && entry.id !== alias.id && entry.supplierKey === alias.supplierKey && codeKey(entry.code) === codeKey(alias.code))) throw new Error("Esistono più alias attivi per il medesimo codice: correggere il conflitto");
    alias.active = false;
    draft.aliases.push({ ...alias, id: nextId(draft, "alias"), productId: product.id, invoiceUnit: input.invoiceUnit,
      productUnit: product.unit, factor, active: true, confirmedAt: stamp(draft) });
  });
}
