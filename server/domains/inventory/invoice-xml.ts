import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { decodeInvoiceBase64, parseFatturaPaXml } from "../finance/invoice-xml";
import type { InvoiceLine, WarehouseInvoice } from "../../../shared/inventory-invoice/types";

const asArray = <T>(v: T | T[] | undefined): T[] => v == null ? [] : Array.isArray(v) ? v : [v];
const txt = (v: unknown) => v == null ? "" : String(v).trim();
function number(v: unknown, label: string, nullable = false): number | null {
  if (!txt(v)) return nullable ? null : 0;
  const n = Number(txt(v).replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 20_000_000) throw new Error(`${label}: valore non valido o troppo grande`);
  return n;
}
function cents(v: unknown, label: string) { return Math.round((number(v, label) ?? 0) * 100); }
function day(value: unknown, label: string) {
  const s = txt(value); const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(`${label}: data non valida`);
  return s;
}
export function invoiceLineKind(name: string, quantity: number | null, amount: number, itemType = ""): InvoiceLine["kind"] {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (amount < 0 || itemType === "SC" || /\bsconto\b|abbuono/.test(n)) return "sconto";
  if (/trasporto|spedizione|spese accessorie|imballaggio a perdere/.test(n)) return "accessorio";
  if (/manodopera|mano d.opera|prestazione|riparazione esterna|servizio|consulenza|ore officina/.test(n)) return "servizio";
  if (quantity == null || quantity <= 0 || amount <= 0) return "incerto";
  return "materiale";
}

/** Il lettore fiscale esistente resta invariato. Questo adattatore conserva tutti gli identificativi e anche servizi/sconti. */
export function parseWarehouseInvoiceXml(xml: string, sourceHash = createHash("sha256").update(xml).digest("hex")): WarehouseInvoice {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Dichiarazioni XML non consentite");
  const fiscal = parseFatturaPaXml(xml);
  const root = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, processEntities: false }).parse(xml).FatturaElettronica;
  const body = asArray(root.FatturaElettronicaBody)[0] as any;
  const details = asArray(body.DatiBeniServizi?.DettaglioLinee) as any[];
  if (details.length > 500) throw new Error("La fattura contiene più di 500 righe");
  const vatCountry = txt(root.FatturaElettronicaHeader?.CedentePrestatore?.DatiAnagrafici?.IdFiscaleIVA?.IdPaese).toUpperCase();
  const supplierKey = fiscal.fornitore.partitaIva ? `${vatCountry || "IT"}:${fiscal.fornitore.partitaIva}` : fiscal.fornitore.codiceFiscale ? `CF:${fiscal.fornitore.codiceFiscale}` : `NOME:${fiscal.fornitore.ragioneSociale.toUpperCase().replace(/\s+/g, " ")}`;
  // L'identità non dipende dagli importi o dal nome del file: una copia modificata non diventa una seconda fattura.
  const id = createHash("sha256").update(`${supplierKey}|${fiscal.numeroDocumento.toUpperCase().replace(/\s+/g, "")}|${fiscal.dataDocumento}|${fiscal.tipoDocumento || "TD01"}`).digest("hex");
  const ddts = (asArray(body.DatiGenerali?.DatiDDT) as any[]).map(d => ({ number: txt(d.NumeroDDT), date: day(d.DataDDT, "Data DDT"), lineNumbers: asArray(d.RiferimentoNumeroLinea).map(n => Number(n)) })).filter(d => d.number);
  const numbers = new Set<number>();
  const lines: InvoiceLine[] = details.map((line, index) => {
    const numberLine = Number(line.NumeroLinea ?? index + 1);
    if (!Number.isSafeInteger(numberLine) || numberLine <= 0 || numbers.has(numberLine)) throw new Error("Numeri di riga mancanti, duplicati o non validi");
    numbers.add(numberLine);
    const name = txt(line.Descrizione) || `Riga ${numberLine}`;
    const qty = number(line.Quantita, `Quantità riga ${numberLine}`, true);
    const total = cents(line.PrezzoTotale, `Totale riga ${numberLine}`);
    const codes = (asArray(line.CodiceArticolo) as any[]).map(c => ({ type: txt(c.CodiceTipo), value: txt(c.CodiceValore) })).filter(c => c.value);
    const adjustments = (asArray(line.ScontoMaggiorazione) as any[]).map(a => ({ type: txt(a.Tipo) === "MG" ? "MG" as const : "SC" as const, percent: number(a.Percentuale, "Sconto percentuale", true), amountCents: txt(a.Importo) ? cents(a.Importo, "Sconto importo") : null }));
    return { id: `${id}:${numberLine}`, number: numberLine, name, quantity: qty, unit: txt(line.UnitaMisura) || null, unitPriceCents: cents(line.PrezzoUnitario, `Prezzo riga ${numberLine}`), totalCents: total, vatRate: Math.round((number(line.AliquotaIVA, "Aliquota IVA") ?? 0) * 100), codes, adjustments, ddtRefs: ddts.filter(d => !d.lineNumbers.length || d.lineNumbers.includes(numberLine)).map(d => `${d.number} · ${d.date}`), kind: invoiceLineKind(name, qty, total, txt(line.TipoCessionePrestazione)) };
  });
  return { id, sourceHash, number: fiscal.numeroDocumento, date: fiscal.dataDocumento, currency: fiscal.valuta, type: fiscal.tipoDocumento || "TD01", supplierKey, supplierName: fiscal.fornitore.ragioneSociale, supplierVat: fiscal.fornitore.partitaIva, totalCents: fiscal.totale, ddts, orderRefs: (asArray(body.DatiGenerali?.DatiOrdineAcquisto) as any[]).map(o => txt(o.IdDocumento)).filter(Boolean), lines };
}
export function parseWarehouseInvoiceFile(input: { nomeFile: string; contenutoBase64: string; dimensione: number }): WarehouseInvoice {
  if (!input.nomeFile.toLowerCase().endsWith(".xml")) throw new Error("Seleziona un file XML FatturaPA ordinario");
  const { xml, hashFile } = decodeInvoiceBase64(input.contenutoBase64, input.dimensione);
  return parseWarehouseInvoiceXml(xml, hashFile);
}
export function redactInvoiceEconomics(invoice: WarehouseInvoice): WarehouseInvoice {
  return { ...invoice, totalCents: 0, lines: invoice.lines.map(l => ({ ...l, unitPriceCents: 0, totalCents: 0, vatRate: 0, adjustments: [] })) };
}
