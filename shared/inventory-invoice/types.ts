/** Contratti riutilizzabili dal Magazzino: importi in centesimi, quantità nell'UM dell'articolo. */
export type InvoiceCode = { type: string; value: string };
export type InvoiceLine = {
  id: string; number: number; name: string; quantity: number | null; unit: string | null;
  unitPriceCents: number; totalCents: number; vatRate: number; codes: InvoiceCode[];
  adjustments: Array<{ type: "SC" | "MG"; percent: number | null; amountCents: number | null }>;
  ddtRefs: string[]; kind: "materiale" | "servizio" | "accessorio" | "sconto" | "incerto";
};
export type WarehouseInvoice = {
  id: string; sourceHash: string; number: string; date: string; currency: string; type: string;
  supplierKey: string; supplierName: string; supplierVat: string | null; totalCents: number;
  ddts: Array<{ number: string; date: string; lineNumbers: number[] }>; orderRefs: string[]; lines: InvoiceLine[];
};
export type Classification = { categoria: string; reparto: string; famiglia: string; sottocategoria: string };
export type ImportProduct = Classification & { id: string; nome: string; codice: string; description: string; unit: string; quantity: number; valuationUnitCents: number; lastPurchaseCents: number | null; identifiers: string[] };
export type SupplierAlias = { id: string; supplierKey: string; supplierName: string; code: string; productId: string; invoiceUnit: string; productUnit: string; factor: number; active: boolean; confirmedAt: string };
export type ReviewRow = Classification & {
  lineId: string; productId: string | null; createNew: boolean; name: string; unit: string;
  factor: number | null; receiveQuantity: number; physicalQuantity: number | null;
  included: boolean; verified: boolean; matchStatus: "riconosciuto" | "nuovo" | "verifica" | "escluso";
  matchReason: string; candidateIds: string[]; receivedQuantity: number; linkedMovementIds: string[];
};
export type InvoiceReview = { invoice: WarehouseInvoice; mode: "acquisto" | "inventario"; rows: ReviewRow[]; financeRegistered: boolean; paid: boolean };
export type StockMovement = { id: string; productId: string; delta: number; kind: "carico" | "rettifica" | "scarico" | "reso" | "annullamento"; invoiceId: string | null; lineId: string | null; reference: string; unitCostCents: number; quantityBefore: number; quantityAfter: number; date: string; linkedQuantity: number };
export type PurchasePrice = { id: string; productId: string; supplierKey: string; supplierName: string; invoiceId: string; lineId: string; date: string; quantity: number; unitPriceCents: number; adjustments: InvoiceLine["adjustments"] };
export type ImportAudit = { id: string; date: string; action: string; reference: string; details: string };
export type DemoState = { version: 1; companyScope: string; products: ImportProduct[]; reviews: InvoiceReview[]; aliases: SupplierAlias[]; movements: StockMovement[]; prices: PurchasePrice[]; audit: ImportAudit[]; operations: string[]; machine: { id: string; name: string; materialCostCents: number }; financeExpensesCents: number };
export type MatchResult = { status: ReviewRow["matchStatus"]; productId: string | null; reason: string; candidateIds: string[]; factor: number | null };
export type ImportConfirmation = { operationId: string; invoiceId: string; receiptConfirmed: boolean; rows: ReviewRow[]; expectedStock?: Record<string, number> };
