import { storagePut } from "../../storage";
import { inventoryRepository } from "../inventory/repository";
import type { ActorContext } from "../_core";
import { financeRepository } from "./repository";
import { invoiceRepository, type RigaConfermaPreparata } from "./invoice.repository";
import {
  buildInvoiceDocumentHash,
  decodeInvoiceBase64,
  FATTURA_XML_PARSER_VERSION,
  normalizeInvoiceDescription,
  parseFatturaPaXml,
  type AvvisoFattura,
} from "./invoice-xml";
import { buildClassificationRuleKey, classifyInvoiceLines } from "./invoice-classification";
import type { AcquisisciFatturaXmlInput, ConfermaFatturaAcquisitaInput } from "./validators";

const ACCEPTED_XML_MIME = new Set(["application/xml", "text/xml", "application/octet-stream", ""]);

function financialDocumentType(tipoDocumento: string | null) {
  if (tipoDocumento === "TD04") return "nota_credito_ricevuta";
  if (tipoDocumento === "TD06") return "parcella";
  return "fattura_acquisto";
}

function publicDetail(detail: NonNullable<Awaited<ReturnType<typeof invoiceRepository.getDetail>>>) {
  return {
    id: detail.acquisition.id,
    stato: detail.acquisition.stato,
    nomeFile: detail.acquisition.nomeFile,
    numeroDocumento: detail.acquisition.numeroDocumento,
    dataDocumento: String(detail.acquisition.dataDocumento),
    valuta: detail.acquisition.valuta,
    tipoDocumento: detail.acquisition.tipoDocumento,
    fornitore: {
      ragioneSociale: detail.acquisition.fornitoreRagioneSociale,
      partitaIva: detail.acquisition.fornitorePartitaIva,
      codiceFiscale: detail.acquisition.fornitoreCodiceFiscale,
      indirizzo: detail.acquisition.fornitoreIndirizzo,
      email: detail.acquisition.fornitoreEmail,
      iban: detail.acquisition.fornitoreIban,
      soggettoId: detail.acquisition.soggettoId,
    },
    imponibile: detail.acquisition.imponibile,
    importoIva: detail.acquisition.importoIva,
    totale: detail.acquisition.totale,
    ritenute: detail.acquisition.ritenute,
    altriImporti: detail.acquisition.altriImporti,
    metodoPagamento: detail.acquisition.metodoPagamento,
    condizioniPagamento: detail.acquisition.condizioniPagamento,
    riepiloghiIva: (detail.acquisition.riepiloghiIvaJson ?? []) as Array<Record<string, unknown>>,
    scadenze: (detail.acquisition.scadenzeJson ?? []) as Array<{ dataScadenza: string; importo: number; iban: string | null; modalitaPagamento: string | null }>,
    avvisi: (detail.acquisition.avvisiJson ?? []) as AvvisoFattura[],
    aiUsata: detail.acquisition.aiUsata,
    duplicatoDocumentoId: detail.acquisition.duplicatoDocumentoId,
    documentoFinanziarioId: detail.acquisition.documentoFinanziarioId,
    righe: detail.lines.map((line) => ({
      id: line.id,
      numeroLinea: line.numeroLinea,
      codiceArticolo: line.codiceArticolo,
      descrizione: line.descrizione,
      quantita: line.quantita,
      unitaMisura: line.unitaMisura,
      prezzoUnitario: line.prezzoUnitario,
      totaleLinea: line.totaleLinea,
      aliquotaIva: line.aliquotaIva,
      naturaIva: line.naturaIva,
      categoriaId: line.categoriaId,
      centroCostoId: line.centroCostoId,
      destinazione: line.destinazione,
      fonteClassificazione: line.fonteClassificazione,
      confidenza: line.confidenza,
      aggiornaMagazzino: line.aggiornaMagazzino,
      prodottoId: line.prodottoId,
      creaProdotto: line.creaProdotto,
      nomeProdotto: line.nomeProdotto,
    })),
  };
}

function allocateEconomicAmounts(total: number, lineTotals: number[]): number[] {
  if (lineTotals.length === 1) return [total];
  const denominator = lineTotals.reduce((sum, value) => sum + value, 0);
  if (!denominator) {
    const base = Math.floor(total / lineTotals.length);
    return lineTotals.map((_, index) => index === lineTotals.length - 1 ? total - base * (lineTotals.length - 1) : base);
  }
  let allocated = 0;
  return lineTotals.map((value, index) => {
    if (index === lineTotals.length - 1) return total - allocated;
    const amount = Math.round((total * value) / denominator);
    allocated += amount;
    return amount;
  });
}

export const invoiceService = {
  async acquire(actor: ActorContext, input: AcquisisciFatturaXmlInput) {
    if (!input.nomeFile.toLowerCase().endsWith(".xml")) throw new Error("Seleziona una fattura elettronica in formato XML");
    const mimeType = input.mimeType.toLowerCase();
    if (!ACCEPTED_XML_MIME.has(mimeType)) throw new Error("Il tipo di file non è riconosciuto come XML");

    const decoded = decodeInvoiceBase64(input.contenutoBase64, input.dimensione);
    const parsed = parseFatturaPaXml(decoded.xml);
    const existing = await invoiceRepository.findByFileHash(actor.companyId, decoded.hashFile);
    if (existing) {
      const detail = await invoiceRepository.getDetail(actor.companyId, existing.id);
      if (!detail) throw new Error("L’acquisizione esistente non è più disponibile");
      return { ...publicDetail(detail), riutilizzata: true };
    }

    const [supplier, duplicate, rules, categories, centers, products] = await Promise.all([
      invoiceRepository.findSupplier(actor.companyId, parsed.fornitore.partitaIva, parsed.fornitore.codiceFiscale),
      invoiceRepository.findDuplicate(actor.companyId, {
        partitaIva: parsed.fornitore.partitaIva,
        codiceFiscale: parsed.fornitore.codiceFiscale,
        numero: parsed.numeroDocumento,
        data: parsed.dataDocumento,
        totale: parsed.totale,
      }),
      invoiceRepository.listLearningRules(actor.companyId, parsed.fornitore.partitaIva),
      financeRepository.listCategorie(actor.companyId, "uscita"),
      financeRepository.listCentriCosto(actor.companyId),
      inventoryRepository.listProdotti(actor.companyId),
    ]);
    if (!categories.length) throw new Error("Configura almeno una sottocategoria di uscita in Finanza prima di acquisire la fattura");

    const classification = await classifyInvoiceLines({
      partitaIva: parsed.fornitore.partitaIva,
      lines: parsed.righe,
      rules: rules as any,
      categories: categories as any,
      centers: centers as any,
      products: products as any,
    });
    const warnings = [...parsed.avvisi];
    if (duplicate) {
      warnings.unshift({
        codice: "possibile_duplicato",
        severita: "alta",
        messaggio: `Possibile duplicato del documento ${duplicate.codiceInterno ?? duplicate.numero ?? "già registrato"}.`,
      });
    }
    const uncertainCount = classification.lines.filter((line) => line.confidenza < 70).length;
    if (uncertainCount) {
      warnings.push({
        codice: "classificazione_incerta",
        severita: "attenzione",
        messaggio: `${uncertainCount} ${uncertainCount === 1 ? "riga richiede" : "righe richiedono"} un controllo della classificazione.`,
      });
    }

    const year = parsed.dataDocumento.slice(0, 4);
    const safeStem = input.nomeFile.replace(/\.xml$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "fattura";
    const stored = await storagePut(
      `fatture-xml/${actor.companyId}/${year}/${safeStem}-${decoded.hashFile.slice(0, 12)}.xml`,
      decoded.buffer,
      "application/xml",
    );
    const hashDocumento = buildInvoiceDocumentHash(parsed);
    const { id } = await invoiceRepository.insertAcquisition(actor, {
      stato: "da_verificare",
      nomeFile: input.nomeFile,
      mimeType: "application/xml",
      dimensione: decoded.buffer.length,
      fileKey: stored.key,
      fileUrl: stored.url,
      hashFile: decoded.hashFile,
      hashDocumento,
      parserVersion: FATTURA_XML_PARSER_VERSION,
      versioneFatturaPa: parsed.versioneFatturaPa,
      progressivoInvio: parsed.progressivoInvio,
      tipoDocumento: parsed.tipoDocumento,
      numeroDocumento: parsed.numeroDocumento,
      dataDocumento: parsed.dataDocumento,
      valuta: parsed.valuta,
      fornitoreRagioneSociale: parsed.fornitore.ragioneSociale,
      fornitorePartitaIva: parsed.fornitore.partitaIva,
      fornitoreCodiceFiscale: parsed.fornitore.codiceFiscale,
      fornitoreIndirizzo: parsed.fornitore.indirizzo,
      fornitoreEmail: parsed.fornitore.email,
      fornitoreIban: parsed.fornitore.iban,
      soggettoId: supplier?.id,
      imponibile: parsed.imponibile,
      importoIva: parsed.importoIva,
      totale: parsed.totale,
      ritenute: parsed.ritenute,
      altriImporti: parsed.altriImporti,
      metodoPagamento: parsed.metodoPagamento,
      condizioniPagamento: parsed.condizioniPagamento,
      riepiloghiIvaJson: parsed.riepiloghiIva,
      scadenzeJson: parsed.scadenze,
      avvisiJson: warnings,
      aiUsata: classification.aiUsed,
      duplicatoDocumentoId: duplicate?.id,
    }, classification.lines.map((line) => ({
      numeroLinea: line.numeroLinea,
      codiceArticolo: line.codiceArticolo,
      descrizione: line.descrizione,
      quantita: line.quantita,
      unitaMisura: line.unitaMisura,
      prezzoUnitario: line.prezzoUnitario,
      totaleLinea: line.totaleLinea,
      aliquotaIva: line.aliquotaIva,
      naturaIva: line.naturaIva,
      categoriaId: line.categoriaId,
      centroCostoId: line.centroCostoId,
      destinazione: line.destinazione,
      fonteClassificazione: line.fonteClassificazione,
      confidenza: line.confidenza,
      aggiornaMagazzino: false,
      prodottoId: line.prodottoId,
      creaProdotto: false,
      nomeProdotto: line.nomeProdotto,
    })));
    const detail = await invoiceRepository.getDetail(actor.companyId, id);
    if (!detail) throw new Error("La fattura è stata acquisita ma non è possibile aprire la revisione");
    return { ...publicDetail(detail), riutilizzata: false };
  },

  async detail(companyId: string, id: string) {
    const detail = await invoiceRepository.getDetail(companyId, id);
    return detail ? publicDetail(detail) : null;
  },

  async confirm(actor: ActorContext, input: ConfermaFatturaAcquisitaInput) {
    const detail = await invoiceRepository.getDetail(actor.companyId, input.acquisizioneId);
    if (!detail) throw new Error("Fattura acquisita non trovata");
    if (detail.acquisition.documentoFinanziarioId) {
      return { documentoId: detail.acquisition.documentoFinanziarioId, giaRegistrata: true, movimentiMagazzino: 0 };
    }

    const duplicate = await invoiceRepository.findDuplicate(actor.companyId, {
      partitaIva: detail.acquisition.fornitorePartitaIva,
      codiceFiscale: detail.acquisition.fornitoreCodiceFiscale,
      numero: detail.acquisition.numeroDocumento,
      data: String(detail.acquisition.dataDocumento),
      totale: detail.acquisition.totale,
    });
    if (duplicate && !input.confermaDuplicato) {
      throw new Error(`POSSIBILE_DUPLICATO: esiste già ${duplicate.codiceInterno ?? duplicate.numero ?? "un documento corrispondente"}`);
    }

    const [categories, centers, relations] = await Promise.all([
      financeRepository.listCategorie(actor.companyId, "uscita"),
      financeRepository.listCentriCosto(actor.companyId),
      financeRepository.listCategoriaCentroRelations(actor.companyId),
    ]);
    const validCategories = new Map(categories.map((category) => [category.id, category]));
    const validCenters = new Map(centers.map((center) => [center.id, center]));
    const allowed = new Set(relations.map((relation) => `${relation.categoriaCentroId}:${relation.sottocategoriaId}`));
    const validatePair = (categoriaId: string, centroCostoId: string | null | undefined) => {
      const category = validCategories.get(categoriaId);
      if (!category || category.attivo === false) throw new Error("Una sottocategoria selezionata non è valida per questa azienda");
      if (!centroCostoId) return;
      const center = validCenters.get(centroCostoId);
      if (!center || center.attivo === false) throw new Error("Un centro di costo selezionato non è valido per questa azienda");
      if (!center.categoriaCentroId || !allowed.has(`${center.categoriaCentroId}:${categoriaId}`)) {
        throw new Error("La sottocategoria non è collegata alla categoria del centro di costo selezionato");
      }
    };
    validatePair(input.categoriaId, input.centroCostoId);

    const persistedLines = new Map(detail.lines.map((line) => [line.id, line]));
    if (input.righe.length !== detail.lines.length || new Set(input.righe.map((line) => line.rigaId)).size !== detail.lines.length) {
      throw new Error("Conferma tutte le righe della fattura prima di registrare");
    }
    const lineTotals = input.righe.map((line) => {
      const persisted = persistedLines.get(line.rigaId);
      if (!persisted) throw new Error("Una riga non appartiene alla fattura acquisita");
      validatePair(line.categoriaId, line.centroCostoId);
      if (line.aggiornaMagazzino && !line.prodottoId && !line.creaProdotto) {
        throw new Error(`Seleziona o crea un prodotto per la riga “${persisted.descrizione}”`);
      }
      if (line.creaProdotto && !line.nomeProdotto?.trim()) {
        throw new Error(`Inserisci il nome del nuovo prodotto per la riga “${persisted.descrizione}”`);
      }
      return persisted.totaleLinea;
    });
    const economicAmounts = allocateEconomicAmounts(detail.acquisition.totale, lineTotals);

    const deadlineTotal = input.scadenze.reduce((sum, deadline) => sum + deadline.importo, 0);
    if (Math.abs(deadlineTotal - detail.acquisition.totale) > 2) {
      throw new Error("La somma delle scadenze deve corrispondere al totale della fattura");
    }
    for (const deadline of input.scadenze) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.dataScadenza)) throw new Error("Una scadenza contiene una data non valida");
    }
    if (input.dataCompetenza && !/^\d{4}-\d{2}-\d{2}$/.test(input.dataCompetenza)) {
      throw new Error("La data di competenza non è valida");
    }

    const preparedLines: RigaConfermaPreparata[] = input.righe.map((line, index) => {
      const persisted = persistedLines.get(line.rigaId)!;
      return {
        rigaId: line.rigaId,
        categoriaId: line.categoriaId,
        centroCostoId: line.centroCostoId ?? null,
        destinazione: line.destinazione,
        aggiornaMagazzino: line.aggiornaMagazzino,
        prodottoId: line.prodottoId ?? null,
        creaProdotto: line.creaProdotto,
        nomeProdotto: line.nomeProdotto ?? null,
        quantita: persisted.quantita,
        unitaMisura: persisted.unitaMisura,
        codiceArticolo: persisted.codiceArticolo,
        descrizione: persisted.descrizione,
        prezzoUnitario: persisted.prezzoUnitario,
        importoEconomico: economicAmounts[index],
        chiaveRegola: buildClassificationRuleKey(detail.acquisition.fornitorePartitaIva, persisted.codiceArticolo, persisted.descrizione),
        descrizioneNormalizzata: normalizeInvoiceDescription(persisted.descrizione),
      };
    });

    const dominantVat = ((detail.acquisition.riepiloghiIvaJson ?? []) as Array<{ aliquotaIva?: number; imponibile?: number }>)
      .slice().sort((a, b) => Math.abs(b.imponibile ?? 0) - Math.abs(a.imponibile ?? 0))[0]?.aliquotaIva ?? 0;
    return invoiceRepository.confirm(actor, {
      acquisizioneId: input.acquisizioneId,
      soggettoId: input.soggettoId ?? detail.acquisition.soggettoId ?? null,
      categoriaId: input.categoriaId,
      centroCostoId: input.centroCostoId ?? null,
      dataCompetenza: input.dataCompetenza ?? String(detail.acquisition.dataDocumento),
      descrizione: input.descrizione?.trim() || `Fattura ${detail.acquisition.numeroDocumento} — ${detail.acquisition.fornitoreRagioneSociale}`,
      note: input.note?.trim() || null,
      aliquotaIvaPrevalente: dominantVat,
      tipoDocumentoFinanziario: financialDocumentType(detail.acquisition.tipoDocumento),
      confermaDuplicato: input.confermaDuplicato,
      scadenze: input.scadenze,
      righe: preparedLines,
    });
  },
};
