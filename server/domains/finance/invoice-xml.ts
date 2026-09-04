import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const FATTURA_XML_MAX_BYTES = 5 * 1024 * 1024;
export const FATTURA_XML_PARSER_VERSION = "fatturapa-1.0";

export type AvvisoFattura = {
  codice: "dati_mancanti" | "scadenza_mancante" | "scadenza_vicina" | "importi_non_allineati" | "importo_anomalo" | "classificazione_incerta" | "possibile_duplicato";
  severita: "info" | "attenzione" | "alta";
  messaggio: string;
};

export type RigaFatturaXml = {
  numeroLinea: number;
  codiceArticolo: string | null;
  descrizione: string;
  quantita: string | null;
  unitaMisura: string | null;
  prezzoUnitario: number;
  totaleLinea: number;
  aliquotaIva: number;
  naturaIva: string | null;
};

export type ParsedFatturaXml = {
  versioneFatturaPa: string | null;
  progressivoInvio: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string;
  dataDocumento: string;
  valuta: string;
  fornitore: {
    ragioneSociale: string;
    partitaIva: string | null;
    codiceFiscale: string | null;
    indirizzo: string | null;
    email: string | null;
    iban: string | null;
  };
  imponibile: number;
  importoIva: number;
  totale: number;
  ritenute: number;
  altriImporti: number;
  aliquotaIvaPrevalente: number;
  metodoPagamento: string | null;
  condizioniPagamento: string | null;
  riepiloghiIva: Array<{ aliquotaIva: number; imponibile: number; importoIva: number; naturaIva: string | null }>;
  scadenze: Array<{ dataScadenza: string; importo: number; iban: string | null; modalitaPagamento: string | null }>;
  righe: RigaFatturaXml[];
  avvisi: AvvisoFattura[];
};

function arrayOf<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function toDecimal(value: unknown, field: string, required = false): number {
  const raw = text(value).replace(",", ".");
  if (!raw && !required) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Il campo ${field} contiene un importo non valido`);
  return parsed;
}

function toCents(value: unknown, field: string, required = false): number {
  const cents = Math.round(toDecimal(value, field, required) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 2_000_000_000) {
    throw new Error(`Il campo ${field} supera i limiti gestibili`);
  }
  return cents;
}

function toRate(value: unknown): number {
  return Math.round(toDecimal(value, "Aliquota IVA") * 100);
}

function isoDate(value: unknown, field: string): string {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`Il campo ${field} non contiene una data valida`);
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new Error(`Il campo ${field} non contiene una data valida`);
  }
  return raw;
}

function normalizeVat(value: unknown): string | null {
  const normalized = text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || null;
}

function decodeXml(buffer: Buffer): string {
  const prefix = buffer.subarray(0, 240).toString("ascii");
  const declared = prefix.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
  const encoding = declared === "iso-8859-1" || declared === "latin1" ? "windows-1252" : declared;
  try {
    return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw new Error(`Codifica XML non supportata: ${declared}`);
  }
}

function supplierName(anagrafica: any): string {
  const denominazione = text(anagrafica?.Denominazione);
  if (denominazione) return denominazione;
  const persona = [text(anagrafica?.Nome), text(anagrafica?.Cognome)].filter(Boolean).join(" ");
  if (persona) return persona;
  throw new Error("La fattura non contiene la ragione sociale del fornitore");
}

function supplierAddress(sede: any): string | null {
  const strada = [text(sede?.Indirizzo), text(sede?.NumeroCivico)].filter(Boolean).join(" ");
  const localita = [text(sede?.CAP), text(sede?.Comune), text(sede?.Provincia)].filter(Boolean).join(" ");
  const parts = [strada, localita, text(sede?.Nazione)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function lineCode(codici: unknown): string | null {
  const primo = arrayOf(codici as any)[0];
  return optionalText(primo?.CodiceValore);
}

function extractInvoiceRoot(parsed: Record<string, any>): any {
  const root = parsed.FatturaElettronica;
  if (root) return root;
  if (parsed.FatturaElettronicaSemplificata) {
    throw new Error("La fattura semplificata non è ancora supportata: esporta il formato FatturaPA ordinario");
  }
  throw new Error("Il file non contiene una fattura elettronica italiana valida");
}

export function decodeInvoiceBase64(contenutoBase64: string, dimensioneDichiarata: number): { buffer: Buffer; xml: string; hashFile: string } {
  if (contenutoBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(contenutoBase64)) {
    throw new Error("Il file ricevuto non contiene dati Base64 validi");
  }
  const buffer = Buffer.from(contenutoBase64, "base64");
  if (!buffer.length || buffer.length !== dimensioneDichiarata) throw new Error("Il file ricevuto è incompleto o danneggiato");
  if (buffer.length > FATTURA_XML_MAX_BYTES) throw new Error("Il file XML supera il limite di 5 MB");
  const xml = decodeXml(buffer);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Il file XML contiene dichiarazioni non consentite");
  if (!xml.trimStart().startsWith("<")) throw new Error("Il file selezionato non è un XML valido");
  return { buffer, xml, hashFile: createHash("sha256").update(buffer).digest("hex") };
}

export function buildInvoiceDocumentHash(parsed: Pick<ParsedFatturaXml, "fornitore" | "numeroDocumento" | "dataDocumento" | "totale">): string {
  const vat = parsed.fornitore.partitaIva ?? parsed.fornitore.codiceFiscale ?? "senza-id";
  const number = parsed.numeroDocumento.toUpperCase().replace(/\s+/g, "");
  return createHash("sha256").update(`${vat}|${number}|${parsed.dataDocumento}|${parsed.totale}`).digest("hex");
}

export function normalizeInvoiceDescription(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 255);
}

export function parseFatturaPaXml(xml: string, today = new Date()): ParsedFatturaXml {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const line = typeof validation === "object" ? validation.err?.line : undefined;
    throw new Error(`XML non valido${line ? ` alla riga ${line}` : ""}`);
  }

  let parsed: Record<string, any>;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: false,
    }).parse(xml) as Record<string, any>;
  } catch {
    throw new Error("Non è stato possibile leggere la struttura della fattura XML");
  }

  const root = extractInvoiceRoot(parsed);
  const bodies = arrayOf(root.FatturaElettronicaBody);
  if (!bodies.length) throw new Error("La fattura non contiene il corpo del documento");
  if (bodies.length > 1) throw new Error("Il file contiene più fatture: caricale separatamente per poterle verificare una alla volta");

  const header = root.FatturaElettronicaHeader ?? {};
  const body: any = bodies[0];
  const supplierData = header.CedentePrestatore?.DatiAnagrafici ?? {};
  const supplierOffice = header.CedentePrestatore?.Sede ?? {};
  const general = body.DatiGenerali?.DatiGeneraliDocumento ?? {};
  const goods = body.DatiBeniServizi ?? {};
  const summaries = arrayOf(goods.DatiRiepilogo as any);
  const details = arrayOf(goods.DettaglioLinee as any);
  if (!details.length) throw new Error("La fattura non contiene righe di beni o servizi");
  if (details.length > 500) throw new Error("La fattura contiene più di 500 righe e non può essere acquisita in un’unica operazione");

  const righe: RigaFatturaXml[] = details.map((item: any, index) => ({
    numeroLinea: Math.max(1, Math.trunc(toDecimal(item.NumeroLinea, "Numero linea", false) || index + 1)),
    codiceArticolo: lineCode(item.CodiceArticolo),
    descrizione: text(item.Descrizione) || `Riga ${index + 1}`,
    quantita: optionalText(item.Quantita),
    unitaMisura: optionalText(item.UnitaMisura),
    prezzoUnitario: toCents(item.PrezzoUnitario, `Prezzo unitario riga ${index + 1}`, true),
    totaleLinea: toCents(item.PrezzoTotale, `Totale riga ${index + 1}`, true),
    aliquotaIva: toRate(item.AliquotaIVA),
    naturaIva: optionalText(item.Natura),
  }));

  const riepiloghiIva = summaries.map((item: any) => ({
    aliquotaIva: toRate(item.AliquotaIVA),
    imponibile: toCents(item.ImponibileImporto, "Imponibile riepilogo IVA", true),
    importoIva: toCents(item.Imposta, "Imposta riepilogo IVA", true),
    naturaIva: optionalText(item.Natura),
  }));
  const imponibile = riepiloghiIva.length
    ? riepiloghiIva.reduce((sum, item) => sum + item.imponibile, 0)
    : righe.reduce((sum, item) => sum + item.totaleLinea, 0);
  const importoIva = riepiloghiIva.reduce((sum, item) => sum + item.importoIva, 0);
  const ritenute = arrayOf(general.DatiRitenuta as any).reduce((sum, item: any) => sum + toCents(item.ImportoRitenuta, "Ritenuta"), 0);
  const contributi = arrayOf(general.DatiCassaPrevidenziale as any).reduce((sum, item: any) => sum + toCents(item.ImportoContributoCassa, "Contributo previdenziale"), 0);
  const bollo = toCents(general.DatiBollo?.ImportoBollo, "Imposta di bollo");
  const arrotondamento = toCents(general.Arrotondamento, "Arrotondamento");
  const altriImporti = contributi + bollo + arrotondamento;
  const totale = general.ImportoTotaleDocumento !== undefined
    ? toCents(general.ImportoTotaleDocumento, "Totale documento", true)
    : imponibile + importoIva + altriImporti - ritenute;
  if (totale <= 0) throw new Error("La fattura deve avere un totale positivo");

  const paymentNodes = arrayOf(body.DatiPagamento as any);
  const paymentDetails = paymentNodes.flatMap((node: any) => arrayOf(node.DettaglioPagamento as any));
  const condizioniPagamento = optionalText(paymentNodes[0]?.CondizioniPagamento);
  const scadenze = paymentDetails.map((item: any) => ({
    dataScadenza: isoDate(item.DataScadenzaPagamento ?? general.Data, "Data scadenza"),
    importo: toCents(item.ImportoPagamento, "Importo scadenza", true),
    iban: optionalText(item.IBAN),
    modalitaPagamento: optionalText(item.ModalitaPagamento),
  })).filter((item) => item.importo > 0);
  const fornitoreIban = scadenze.find((item) => item.iban)?.iban ?? null;

  const fornitore = {
    ragioneSociale: supplierName(supplierData.Anagrafica),
    partitaIva: normalizeVat(supplierData.IdFiscaleIVA?.IdCodice),
    codiceFiscale: normalizeVat(supplierData.CodiceFiscale),
    indirizzo: supplierAddress(supplierOffice),
    email: optionalText(header.CedentePrestatore?.Contatti?.Email),
    iban: fornitoreIban,
  };
  const numeroDocumento = text(general.Numero);
  if (!numeroDocumento) throw new Error("La fattura non contiene il numero documento");
  const dataDocumento = isoDate(general.Data, "Data documento");

  const avvisi: AvvisoFattura[] = [];
  if (!fornitore.partitaIva && !fornitore.codiceFiscale) {
    avvisi.push({ codice: "dati_mancanti", severita: "alta", messaggio: "Manca partita IVA o codice fiscale del fornitore." });
  }
  if (!scadenze.length) {
    avvisi.push({ codice: "scadenza_mancante", severita: "attenzione", messaggio: "Nessuna scadenza presente: è stata proposta la data del documento." });
    scadenze.push({ dataScadenza: dataDocumento, importo: totale, iban: fornitoreIban, modalitaPagamento: null });
  }
  const sumDeadlines = scadenze.reduce((sum, item) => sum + item.importo, 0);
  if (Math.abs(sumDeadlines - totale) > 2) {
    avvisi.push({ codice: "importi_non_allineati", severita: "attenzione", messaggio: "Le scadenze XML non coincidono con il totale: controlla gli importi prima di registrare." });
  }
  const expectedTotal = imponibile + importoIva + altriImporti - ritenute;
  if (Math.abs(expectedTotal - totale) > 2) {
    avvisi.push({ codice: "importi_non_allineati", severita: "attenzione", messaggio: "Il totale documento differisce dalla somma dei riepiloghi fiscali: verifica ritenute, bollo o arrotondamenti." });
  }
  if (totale >= 100_000_00) {
    avvisi.push({ codice: "importo_anomalo", severita: "attenzione", messaggio: "Importo elevato: è consigliato un controllo aggiuntivo prima della registrazione." });
  }
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (scadenze.some((item) => {
    const days = (new Date(`${item.dataScadenza}T00:00:00Z`).getTime() - todayDay) / 86_400_000;
    return days >= 0 && days <= 7;
  })) {
    avvisi.push({ codice: "scadenza_vicina", severita: "info", messaggio: "Una scadenza cade entro i prossimi 7 giorni." });
  }

  const dominant = riepiloghiIva
    .slice()
    .sort((a, b) => Math.abs(b.imponibile) - Math.abs(a.imponibile))[0]?.aliquotaIva ?? 0;
  return {
    versioneFatturaPa: optionalText(root.versione),
    progressivoInvio: optionalText(header.DatiTrasmissione?.ProgressivoInvio),
    tipoDocumento: optionalText(general.TipoDocumento),
    numeroDocumento,
    dataDocumento,
    valuta: text(general.Divisa).toUpperCase() || "EUR",
    fornitore,
    imponibile,
    importoIva,
    totale,
    ritenute,
    altriImporti,
    aliquotaIvaPrevalente: dominant,
    metodoPagamento: scadenze.find((item) => item.modalitaPagamento)?.modalitaPagamento ?? null,
    condizioniPagamento,
    riepiloghiIva,
    scadenze,
    righe,
    avvisi,
  };
}
