import { financeRepository as repo } from "./repository";
import { invoiceRepository } from "./invoice.repository";
import type { ActorContext } from "../_core";
import type { CreateMovimentoInput, UpdateMovimentoInput, RegistraPagamentoInput, CreaRateInput, CreaRicorrenzaInput } from "./validators";
import {
  CATEGORIE_USCITE_DEFAULT,
  CATEGORIE_ENTRATE_DEFAULT,
  CENTRI_COSTO_DEFAULT,
  METODI_PAGAMENTO_DEFAULT,
  FREQUENZA_MESI,
} from "./types";

async function validaClassificazione(actor: ActorContext, tipo: "entrata" | "uscita", centroCostoId: string | null | undefined, sottocategoriaId: string) {
  const sottocategoria = await repo.getCategoria(actor.companyId, sottocategoriaId);
  if (!sottocategoria || sottocategoria.attivo === false) throw new Error("Sottocategoria non valida o archiviata");
  if (sottocategoria.tipo !== "entrambi" && sottocategoria.tipo !== tipo) {
    throw new Error(`La sottocategoria selezionata non è utilizzabile per una ${tipo}`);
  }
  if (!centroCostoId) return;
  const centro = await repo.getCentroCosto(actor.companyId, centroCostoId);
  if (!centro || centro.attivo === false) throw new Error("Centro di costo non valido o archiviato");
  if (!centro.categoriaCentroId) throw new Error("Il centro di costo non ha una categoria associata");
  const consentita = await repo.isSottocategoriaAllowed(actor.companyId, centro.categoriaCentroId, sottocategoriaId);
  if (!consentita) {
    const relazioni = await repo.listCategoriaCentroRelations(actor.companyId);
    const configurata = relazioni.some((relazione) => relazione.sottocategoriaId === sottocategoriaId);
    if (!configurata) {
      await repo.replaceCategoriaCentroRelations(actor, sottocategoriaId, [centro.categoriaCentroId]);
      return;
    }
  }
  if (!consentita) throw new Error("La sottocategoria non è correlata alla categoria del centro di costo selezionato");
}

/**
 * FINANCE — Service
 * Logica di business: calcolo IVA, gestione saldo conti, workflow stati,
 * registrazioni economiche automatiche, seed dati iniziali.
 */
export const financeService = {
  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY (retrocompatibilità dashboard)
  // ══════════════════════════════════════════════════════════════════════════
  async list(companyId: string, tipo?: "entrata" | "uscita") {
    return repo.listTransazioni(companyId, tipo);
  },
  async summary(companyId: string) {
    const { entrate, uscite } = await repo.sumEntrateUscite(companyId);
    return { entrate, uscite, saldo: entrate - uscite };
  },
  async byCategoria(companyId: string) {
    return repo.byCategoria(companyId);
  },
  async create(actor: ActorContext, data: Record<string, unknown>) {
    return repo.insertTransazione(actor, data);
  },
  async remove(actor: ActorContext, id: string) {
    return repo.softDeleteTransazione(actor, id);
  },
  /** Indicatori per dashboard/report */
  async reportSummary(companyId: string) {
    const { entrate, uscite } = await repo.sumEntrateUscite(companyId);
    return {
      entrateTotali: entrate,
      usciteTotali: uscite,
      utileNetto: entrate - uscite,
      roi: uscite > 0 ? ((entrate - uscite) / uscite) * 100 : 0,
    };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORIE
  // ══════════════════════════════════════════════════════════════════════════
  async listCategorie(companyId: string, tipo?: string, centroCostoId?: string, categoriaCentroId?: string) {
    const [categorie, relazioni] = await Promise.all([
      repo.listCategorie(companyId, tipo, centroCostoId, categoriaCentroId),
      repo.listCategoriaCentroRelations(companyId),
    ]);
    return categorie.map((categoria) => ({
      ...categoria,
      categoriaCentroIds: relazioni.filter((relazione) => relazione.sottocategoriaId === categoria.id).map((relazione) => relazione.categoriaCentroId),
    }));
  },
  async createCategoria(actor: ActorContext, data: Record<string, unknown>) {
    const { categoriaCentroIds = [], ...categoria } = data as Record<string, unknown> & { categoriaCentroIds?: string[] };
    for (const categoriaCentroId of categoriaCentroIds) {
      if (!await repo.getCategoriaCentro(actor.companyId, categoriaCentroId)) throw new Error("Categoria del centro non valida");
    }
    const codice = (data.codice as string) || `CAT-${Date.now().toString(36).toUpperCase()}`;
    const result = await repo.insertCategoria(actor, { ...categoria, codice });
    if (categoriaCentroIds.length) await repo.replaceCategoriaCentroRelations(actor, result.id, categoriaCentroIds);
    return result;
  },
  async updateCategoria(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const { categoriaCentroIds, ...categoria } = data as Record<string, unknown> & { categoriaCentroIds?: string[] };
    await repo.updateCategoria(actor, id, categoria);
    if (categoriaCentroIds) await repo.replaceCategoriaCentroRelations(actor, id, categoriaCentroIds);
    return { success: true };
  },
  async listCategorieCentri(companyId: string) {
    return repo.listCategorieCentri(companyId);
  },
  async createCategoriaCentro(actor: ActorContext, data: Record<string, unknown>) {
    const codice = (data.codice as string) || `CC-${Date.now().toString(36).toUpperCase()}`;
    return repo.insertCategoriaCentro(actor, { ...data, codice });
  },
  async updateCategoriaCentro(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateCategoriaCentro(actor, id, data);
  },
  async replaceCategoriaCentroSottocategorie(actor: ActorContext, categoriaCentroId: string, sottocategoriaIds: string[]) {
    const categoriaCentro = await repo.getCategoriaCentro(actor.companyId, categoriaCentroId);
    if (!categoriaCentro || categoriaCentro.attivo === false) throw new Error("Categoria del centro non valida o archiviata");

    const idsUnivoci = Array.from(new Set(sottocategoriaIds));
    const sottocategorie = await Promise.all(idsUnivoci.map((id) => repo.getCategoria(actor.companyId, id)));
    if (sottocategorie.some((item) => !item || item.attivo === false)) {
      throw new Error("Una o più sottocategorie non sono valide o appartengono a un'altra azienda");
    }

    const relazioniPrima = (await repo.listCategoriaCentroRelations(actor.companyId))
      .filter((relazione) => relazione.categoriaCentroId === categoriaCentroId)
      .map((relazione) => relazione.sottocategoriaId);
    const prima = new Set(relazioniPrima);
    const dopo = new Set(idsUnivoci);

    await repo.replaceSottocategorieForCategoriaCentro(actor, categoriaCentroId, idsUnivoci);

    return {
      categoriaCentroId,
      totale: idsUnivoci.length,
      aggiunte: idsUnivoci.filter((id) => !prima.has(id)),
      rimosse: relazioniPrima.filter((id) => !dopo.has(id)),
    };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CENTRI DI COSTO
  // ══════════════════════════════════════════════════════════════════════════
  async listCentriCosto(companyId: string) {
    const [centri, categorie] = await Promise.all([
      repo.listCentriCosto(companyId),
      repo.listCategorieCentri(companyId),
    ]);
    const nomiCategorie = new Map(categorie.map((categoria) => [categoria.id, categoria.nome]));
    return centri.map((centro) => ({ ...centro, categoriaCentroNome: centro.categoriaCentroId ? nomiCategorie.get(centro.categoriaCentroId) ?? null : null }));
  },
  async createCentroCosto(actor: ActorContext, data: Record<string, unknown>) {
    let categoriaCentroId = data.categoriaCentroId ? String(data.categoriaCentroId) : "";
    if (categoriaCentroId && !await repo.getCategoriaCentro(actor.companyId, categoriaCentroId)) throw new Error("Categoria del centro non valida");
    if (!categoriaCentroId) {
      const categoria = await this.createCategoriaCentro(actor, {
        nome: String(data.nome),
        codice: `CC-${Date.now().toString(36).toUpperCase()}`,
        descrizione: "Creata automaticamente con il centro di costo",
        colore: data.colore,
      });
      categoriaCentroId = categoria.id;
    }
    const codice = (data.codice as string) || `CDC-${Date.now().toString(36).toUpperCase()}`;
    return repo.insertCentroCosto(actor, { ...data, categoriaCentroId, codice });
  },
  async updateCentroCosto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    if (data.categoriaCentroId && !await repo.getCategoriaCentro(actor.companyId, String(data.categoriaCentroId))) throw new Error("Categoria del centro non valida");
    return repo.updateCentroCosto(actor, id, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOGGETTI
  // ══════════════════════════════════════════════════════════════════════════
  async listSoggetti(companyId: string, tipologia?: string, search?: string) {
    return repo.listSoggetti(companyId, tipologia, search);
  },
  async createSoggetto(actor: ActorContext, data: Record<string, unknown>) {
    return repo.insertSoggetto(actor, data);
  },
  async updateSoggetto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateSoggetto(actor, id, data);
  },
  async deleteSoggetto(actor: ActorContext, id: string) {
    return repo.softDeleteSoggetto(actor, id);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONTI
  // ══════════════════════════════════════════════════════════════════════════
  async listConti(companyId: string) {
    return repo.listConti(companyId);
  },
  async createConto(actor: ActorContext, data: Record<string, unknown>) {
    return repo.insertConto(actor, data);
  },
  async updateConto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateConto(actor, id, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // METODI DI PAGAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  async listMetodi(companyId: string) {
    return repo.listMetodi(companyId);
  },
  async createMetodo(actor: ActorContext, nome: string) {
    return repo.insertMetodo(actor, nome);
  },
  async updateMetodo(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateMetodo(actor, id, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MOVIMENTI (core business)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Calcolo IVA con arrotondamento ai centesimi.
   * Input: imponibile in centesimi, aliquota in centesimi (2200 = 22%).
   * Output: { imponibile, importoIva, totale } in centesimi.
   */
  calcolaIva(imponibile: number, aliquotaIva: number): { imponibile: number; importoIva: number; totale: number } {
    const iva = Math.round((imponibile * aliquotaIva) / 10000);
    return { imponibile, importoIva: iva, totale: imponibile + iva };
  },

  /**
   * Calcola imponibile da totale IVA inclusa.
   */
  scorporaIva(totale: number, aliquotaIva: number): { imponibile: number; importoIva: number; totale: number } {
    const imponibile = Math.round((totale * 10000) / (10000 + aliquotaIva));
    const iva = totale - imponibile;
    return { imponibile, importoIva: iva, totale };
  },

  /**
   * Crea un nuovo movimento finanziario.
   * Gestisce due workflow:
   * 1. "pagato_subito" → crea documento + pagamento + movimento cassa + aggiorna saldo
   * 2. "documento" → crea documento + scadenza (saldo invariato finché non si registra il pagamento)
   */
  async creaMovimento(actor: ActorContext, input: CreateMovimentoInput) {
    await validaClassificazione(actor, input.tipo, input.centroCostoId, input.categoriaId);
    // 1. Crea il documento finanziario
    const statoIniziale = input.tipoRegistrazione === "pagato_subito"
      ? (input.tipo === "entrata" ? "incassato" : "pagato")
      : "registrato";

    // Genera codice interno sequenziale
    const count = await repo.countDocumenti(actor.companyId, input.tipo);
    const prefix = input.tipo === "entrata" ? "DOC-ENT" : "DOC-USC";
    const codiceInterno = `${prefix}-${String(count + 1).padStart(6, "0")}`;

    // Calcola residuo iniziale
    const residuoIniziale = input.tipoRegistrazione === "pagato_subito" ? 0 : input.totale;
    const totalePagatoIniziale = input.tipoRegistrazione === "pagato_subito" ? input.totale : 0;

    const docData = {
      tipo: input.tipo,
      tipoRegistrazione: input.tipoRegistrazione,
      tipoDocumento: input.tipoDocumento ?? "generico",
      numero: input.numero,
      codiceInterno,
      dataDocumento: input.dataDocumento,
      soggettoId: input.soggettoId,
      categoriaId: input.categoriaId,
      centroCostoId: input.centroCostoId,
      imponibile: input.imponibile,
      aliquotaIva: input.aliquotaIva,
      importoIva: input.importoIva,
      totale: input.totale,
      totalePagato: totalePagatoIniziale,
      residuo: residuoIniziale,
      valuta: (input as any).valuta ?? "EUR",
      dataCompetenza: input.dataCompetenza ?? input.dataDocumento,
      descrizione: input.descrizione,
      note: input.note,
      stato: statoIniziale,
      riferimentoEsterno: input.riferimentoEsterno,
      originModule: input.originModule,
      originEntityType: input.originEntityType,
      originEntityId: input.originEntityId,
      contoId: input.contoId,
      metodoId: input.metodoId,
    };

    const { id: documentoId } = await repo.insertDocumento(actor, docData);

    // 2. Registrazione economica (competenza)
    await repo.insertRegistrazione(actor, {
      documentoId,
      categoriaId: input.categoriaId,
      centroCostoId: input.centroCostoId,
      tipo: input.tipo === "entrata" ? "ricavo" : "costo",
      importo: input.totale,
      dataCompetenza: input.dataCompetenza ?? input.dataDocumento,
      descrizione: input.descrizione,
    });

    // 3. Workflow specifico
    if (input.tipoRegistrazione === "pagato_subito") {
      if (!input.contoId) throw new Error("contoId obbligatorio per pagato_subito");
      // Crea pagamento
      const { id: pagamentoId } = await repo.insertPagamento(actor, {
        documentoId,
        contoId: input.contoId,
        metodoId: input.metodoId,
        importo: input.totale,
        data: input.dataDocumento,
        stato: "confermato",
      });
      // Aggiorna saldo conto
      const conto = await repo.getConto(actor.companyId, input.contoId);
      if (conto) {
        const saldoPrecedente = conto.saldoAttuale;
        const delta = input.tipo === "entrata" ? input.totale : -input.totale;
        const saldoDopo = saldoPrecedente + delta;
        await repo.updateSaldoConto(actor.companyId, input.contoId, saldoDopo);
        // Crea movimento cassa
        await repo.insertMovimentoCassa(actor, {
          contoId: input.contoId,
          tipo: input.tipo,
          importo: input.totale,
          data: input.dataDocumento,
          saldoPrecedente,
          saldoDopo,
          descrizione: input.descrizione,
          documentoId,
          pagamentoId,
          stato: "confermato",
        });
      }
    } else if (input.tipoRegistrazione === "documento") {
      // Crea scadenza con residuo
      const dataScadenza = input.dataScadenza ?? input.dataDocumento;
      await repo.insertScadenza(actor, {
        documentoId,
        importo: input.totale,
        importoPagato: 0,
        residuo: input.totale,
        dataScadenza,
        numero: 1,
        totaleRate: 1,
        stato: "aperta",
      });
    }

    return { documentoId, stato: statoIniziale };
  },

  /**
   * Lista movimenti (documenti) con filtri.
   */
  async listMovimenti(companyId: string, filters?: Record<string, unknown>) {
    return repo.listDocumenti(companyId, filters as any);
  },

  async ultimoMovimentoPerSoggetto(companyId: string, soggettoId: string, tipo: "entrata" | "uscita") {
    const [doc, ultimoPagamento] = await Promise.all([
      repo.getLastDocumentoForSubject(companyId, soggettoId, tipo),
      repo.getLastPaymentForSubject(companyId, soggettoId, tipo),
    ]);
    if (!doc) return null;
    return {
      id: doc.id,
      soggettoId: doc.soggettoId,
      tipo: doc.tipo,
      categoriaId: doc.categoriaId,
      centroCostoId: doc.centroCostoId,
      contoId: ultimoPagamento?.contoId ?? doc.contoId ?? null,
      metodoId: ultimoPagamento?.metodoId ?? doc.metodoId ?? null,
      dataDocumento: doc.dataDocumento,
      createdAt: doc.createdAt,
    };
  },

  /**
   * Dettaglio movimento con scadenze e pagamenti.
   */
  async dettaglioMovimento(companyId: string, id: string) {
    const doc = await repo.getDocumento(companyId, id);
    if (!doc) return null;
    const scadenze = await repo.listScadenze(companyId, id);
    const pagamenti = await repo.listPagamenti(companyId, id);
    const allegati = await repo.listAllegati(companyId, id);
    return { ...doc, scadenze, pagamenti, allegati };
  },

  /**
   * Modifica un movimento e riallinea registrazione economica e scadenza.
   * Gli importi non sono modificabili dopo un pagamento/incasso: in quel caso
   * restano modificabili solo classificazione, descrizione, note e riferimenti.
   */
  async modificaMovimento(actor: ActorContext, id: string, input: Omit<UpdateMovimentoInput, "id">) {
    const doc = await repo.getDocumento(actor.companyId, id);
    if (!doc) throw new Error("Movimento non trovato");
    if (doc.stato === "annullato") throw new Error("Un movimento annullato non può essere modificato");

    const pagamenti = await repo.listPagamenti(actor.companyId, id);
    const pagamentiConfermati = pagamenti.filter((pagamento) => pagamento.stato === "confermato");
    const scadenze = await repo.listScadenze(actor.companyId, id);
    const campiFinanziari: Array<keyof Omit<UpdateMovimentoInput, "id">> = [
      "tipo", "imponibile", "aliquotaIva", "importoIva", "totale",
    ];
    const modificaImporti = campiFinanziari.some((campo) => input[campo] !== undefined);

    if (modificaImporti && pagamentiConfermati.length > 0) {
      throw new Error("Gli importi non sono modificabili dopo un pagamento o un incasso. Elimina il movimento per creare lo storno, poi registralo nuovamente.");
    }
    if ((modificaImporti || input.dataScadenza !== undefined) && scadenze.length > 1) {
      throw new Error("Il movimento ha più rate: modifica prima le singole scadenze dal dettaglio");
    }

    const tipo = input.tipo ?? doc.tipo;
    const centroCostoId = input.centroCostoId !== undefined ? input.centroCostoId : doc.centroCostoId;
    const sottocategoriaId = input.categoriaId ?? doc.categoriaId;
    await validaClassificazione(actor, tipo, centroCostoId, sottocategoriaId);
    const totale = input.totale ?? doc.totale;
    const imponibile = input.imponibile ?? doc.imponibile;
    const aliquotaIva = input.aliquotaIva ?? doc.aliquotaIva;
    const importoIva = input.importoIva ?? doc.importoIva;

    if (imponibile + importoIva !== totale) {
      throw new Error("Imponibile e IVA devono corrispondere al totale");
    }
    if (totale < doc.totalePagato) {
      throw new Error("Il totale non può essere inferiore all’importo già regolato");
    }

    const documento: Record<string, unknown> = {};
    const campiDocumento = [
      "tipo", "imponibile", "aliquotaIva", "importoIva", "totale",
      "dataDocumento", "dataCompetenza", "categoriaId", "centroCostoId",
      "soggettoId", "tipoDocumento", "numero", "descrizione", "note",
      "riferimentoEsterno",
    ] as const;
    for (const campo of campiDocumento) {
      if (input[campo] !== undefined) documento[campo] = input[campo];
    }
    if (modificaImporti) {
      documento.residuo = totale - doc.totalePagato;
      documento.stato = doc.totalePagato > 0 ? "parzialmente_regolato" : "registrato";
    }

    const registrazione = {
      categoriaId: input.categoriaId ?? doc.categoriaId,
      centroCostoId: input.centroCostoId !== undefined ? input.centroCostoId : doc.centroCostoId,
      tipo: tipo === "entrata" ? "ricavo" : "costo",
      importo: totale,
      dataCompetenza: input.dataCompetenza ?? input.dataDocumento ?? doc.dataCompetenza ?? doc.dataDocumento,
      descrizione: input.descrizione !== undefined ? input.descrizione : doc.descrizione,
    };

    let scadenza: Record<string, unknown> | undefined;
    if (scadenze.length === 1 && (modificaImporti || input.dataScadenza !== undefined)) {
      const dataScadenza = input.dataScadenza ?? String(scadenze[0].dataScadenza);
      const residuo = totale - doc.totalePagato;
      scadenza = {
        importo: totale,
        importoPagato: doc.totalePagato,
        residuo,
        dataScadenza,
        stato: residuo === 0
          ? (tipo === "entrata" ? "incassata" : "pagata")
          : dataScadenza < new Date().toISOString().slice(0, 10) ? "scaduta" : "aperta",
      };
    }

    await repo.updateMovimentoCompleto(actor, id, { documento, registrazione, scadenza });
    return this.dettaglioMovimento(actor.companyId, id);
  },

  /**
   * Annulla un movimento (soft: cambia stato, non elimina).
   * Se era pagato_subito, storna il saldo del conto.
   */
  async annullaMovimento(actor: ActorContext, id: string, motivo?: string) {
    const doc = await repo.getDocumento(actor.companyId, id);
    if (!doc) throw new Error("Documento non trovato");
    if (doc.stato === "annullato") throw new Error("Già annullato");

    // Se era pagato/incassato, storna il saldo
    if (doc.stato === "pagato" || doc.stato === "incassato") {
      if (doc.contoId) {
        const conto = await repo.getConto(actor.companyId, doc.contoId);
        if (conto) {
          const delta = doc.tipo === "entrata" ? -doc.totale : doc.totale;
          const nuovoSaldo = conto.saldoAttuale + delta;
          await repo.updateSaldoConto(actor.companyId, doc.contoId, nuovoSaldo);
          // Movimento cassa di storno
          await repo.insertMovimentoCassa(actor, {
            contoId: doc.contoId,
            tipo: doc.tipo === "entrata" ? "uscita" : "entrata",
            importo: doc.totale,
            data: new Date().toISOString().split("T")[0],
            saldoPrecedente: conto.saldoAttuale,
            saldoDopo: nuovoSaldo,
            descrizione: `Storno: ${motivo ?? "annullamento"}`,
            documentoId: id,
            stato: "confermato",
          });
        }
      }
    }

    await repo.updateDocumento(actor, id, { stato: "annullato", note: motivo ? `[ANNULLATO] ${motivo}` : "[ANNULLATO]" });
    return { success: true };
  },

  /** Elimina logicamente un movimento e storna in modo atomico gli importi regolati. */
  async deleteMovimento(actor: ActorContext, id: string, motivo?: string) {
    const doc = await repo.getDocumento(actor.companyId, id);
    if (!doc) throw new Error("Movimento non trovato");
    return repo.eliminaMovimentoCompleto(actor, id, motivo);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ALLEGATI
  // ══════════════════════════════════════════════════════════════════════════
  async addAllegato(actor: ActorContext, documentoId: string, data: Record<string, unknown>) {
    return repo.insertAllegato(actor, { ...data, documentoId });
  },
  async removeAllegato(actor: ActorContext, id: string) {
    return repo.softDeleteAllegato(actor, id);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FASE 2 — Pagamenti parziali, scadenze, rate, ricorrenze
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Registra un pagamento/incasso (parziale o totale) su un documento.
   * Aggiorna: scadenza (se collegata), documento (totalePagato, residuo, stato), conto (saldo), movimento cassa.
   */
  async registraPagamento(actor: ActorContext, input: RegistraPagamentoInput) {
    const doc = await repo.getDocumento(actor.companyId, input.documentoId);
    if (!doc) throw new Error("Documento non trovato");
    if (doc.stato === "annullato") throw new Error("Non puoi pagare un documento annullato");
    if (doc.stato === "pagato" || doc.stato === "incassato") throw new Error("Documento già completamente regolato");
    if (input.importo > (doc.residuo ?? doc.totale)) throw new Error("Importo superiore al residuo");

    // 1. Crea record pagamento
    const { id: pagamentoId } = await repo.insertPagamento(actor, {
      documentoId: input.documentoId,
      scadenzaId: input.scadenzaId,
      contoId: input.contoId,
      metodoId: input.metodoId,
      importo: input.importo,
      data: input.data,
      riferimento: input.riferimento,
      note: input.note,
      stato: "confermato",
    });

    // 2. Aggiorna scadenza (se collegata)
    if (input.scadenzaId) {
      const scad = await repo.getScadenza(actor.companyId, input.scadenzaId);
      if (scad) {
        const nuovoPagato = (scad.importoPagato ?? 0) + input.importo;
        const nuovoResiduo = scad.importo - nuovoPagato;
        const nuovoStato = nuovoResiduo <= 0
          ? (doc.tipo === "entrata" ? "incassata" : "pagata")
          : "parzialmente_pagata";
        await repo.updateScadenza(actor, input.scadenzaId, {
          importoPagato: nuovoPagato,
          residuo: Math.max(0, nuovoResiduo),
          stato: nuovoStato,
        });
      }
    }

    // 3. Aggiorna documento (totalePagato, residuo, stato)
    const nuovoTotalePagato = (doc.totalePagato ?? 0) + input.importo;
    const nuovoResiduo = doc.totale - nuovoTotalePagato;
    let nuovoStato: string;
    if (nuovoResiduo <= 0) {
      nuovoStato = doc.tipo === "entrata" ? "incassato" : "pagato";
    } else {
      nuovoStato = "parzialmente_regolato";
    }
    await repo.updateDocumento(actor, input.documentoId, {
      totalePagato: nuovoTotalePagato,
      residuo: Math.max(0, nuovoResiduo),
      stato: nuovoStato,
    });
    if (nuovoResiduo <= 0) await invoiceRepository.updateStatusForDocument(actor, input.documentoId, "pagata");

    // 4. Aggiorna saldo conto + crea movimento cassa
    const conto = await repo.getConto(actor.companyId, input.contoId);
    if (conto) {
      const saldoPrecedente = conto.saldoAttuale;
      const delta = doc.tipo === "entrata" ? input.importo : -input.importo;
      const saldoDopo = saldoPrecedente + delta;
      await repo.updateSaldoConto(actor.companyId, input.contoId, saldoDopo);
      await repo.insertMovimentoCassa(actor, {
        contoId: input.contoId,
        tipo: doc.tipo,
        importo: input.importo,
        data: input.data,
        saldoPrecedente,
        saldoDopo,
        descrizione: `Pagamento ${doc.codiceInterno ?? doc.id}`,
        documentoId: input.documentoId,
        pagamentoId,
        stato: "confermato",
      });
    }

    return { pagamentoId, nuovoStato, residuo: Math.max(0, nuovoResiduo) };
  },

  /**
   * Annulla un pagamento (storno). Ripristina residuo documento e scadenza, storna saldo conto.
   */
  async annullaPagamento(actor: ActorContext, pagamentoId: string, motivo?: string) {
    const pag = await repo.getPagamento(actor.companyId, pagamentoId);
    if (!pag) throw new Error("Pagamento non trovato");
    if (pag.stato === "annullato") throw new Error("Pagamento già annullato");

    // 1. Annulla il pagamento
    await repo.updatePagamento(actor, pagamentoId, { stato: "annullato" });

    // 2. Ripristina documento
    const doc = await repo.getDocumento(actor.companyId, pag.documentoId);
    if (doc) {
      const nuovoTotalePagato = Math.max(0, (doc.totalePagato ?? 0) - pag.importo);
      const nuovoResiduo = doc.totale - nuovoTotalePagato;
      const nuovoStato = nuovoTotalePagato === 0 ? "registrato" : "parzialmente_regolato";
      await repo.updateDocumento(actor, pag.documentoId, {
        totalePagato: nuovoTotalePagato,
        residuo: nuovoResiduo,
        stato: nuovoStato,
      });
      await invoiceRepository.updateStatusForDocument(actor, pag.documentoId, "registrata");
    }

    // 3. Ripristina scadenza
    if (pag.scadenzaId) {
      const scad = await repo.getScadenza(actor.companyId, pag.scadenzaId);
      if (scad) {
        const nuovoPagato = Math.max(0, (scad.importoPagato ?? 0) - pag.importo);
        const nuovoResiduo = scad.importo - nuovoPagato;
        const nuovoStato = nuovoPagato === 0 ? "aperta" : "parzialmente_pagata";
        await repo.updateScadenza(actor, pag.scadenzaId, {
          importoPagato: nuovoPagato,
          residuo: nuovoResiduo,
          stato: nuovoStato,
        });
      }
    }

    // 4. Storna saldo conto
    const conto = await repo.getConto(actor.companyId, pag.contoId);
    if (conto && doc) {
      const saldoPrecedente = conto.saldoAttuale;
      const delta = doc.tipo === "entrata" ? -pag.importo : pag.importo;
      const saldoDopo = saldoPrecedente + delta;
      await repo.updateSaldoConto(actor.companyId, pag.contoId, saldoDopo);
      await repo.insertMovimentoCassa(actor, {
        contoId: pag.contoId,
        tipo: doc.tipo === "entrata" ? "uscita" : "entrata",
        importo: pag.importo,
        data: new Date().toISOString().split("T")[0],
        saldoPrecedente,
        saldoDopo,
        descrizione: `Storno pagamento: ${motivo ?? "annullamento"}`,
        documentoId: pag.documentoId,
        stato: "confermato",
      });
    }

    return { success: true };
  },

  /**
   * Crea una singola scadenza per un documento.
   */
  async creaScadenza(actor: ActorContext, documentoId: string, importo: number, dataScadenza: string, note?: string) {
    const doc = await repo.getDocumento(actor.companyId, documentoId);
    if (!doc) throw new Error("Documento non trovato");
    // Conta scadenze esistenti
    const existing = await repo.listScadenze(actor.companyId, documentoId);
    const numero = existing.length + 1;
    return repo.insertScadenza(actor, {
      documentoId,
      importo,
      importoPagato: 0,
      residuo: importo,
      dataScadenza,
      numero,
      totaleRate: numero,
      note,
      stato: "aperta",
    });
  },

  /**
   * Crea rate automatiche (split uniforme) per un documento.
   * Cancella le scadenze precedenti (se in stato aperta) e ne crea di nuove.
   */
  async creaRate(actor: ActorContext, input: CreaRateInput) {
    const doc = await repo.getDocumento(actor.companyId, input.documentoId);
    if (!doc) throw new Error("Documento non trovato");
    if (doc.stato === "annullato" || doc.stato === "pagato" || doc.stato === "incassato") {
      throw new Error("Non puoi creare rate per un documento chiuso");
    }

    // Annulla scadenze aperte esistenti
    await repo.annullaScadenzeDocumento(actor, input.documentoId);

    // Calcola importo per rata (arrotondamento centesimi)
    const residuo = doc.residuo ?? doc.totale;
    const importoRata = Math.floor(residuo / input.numeroRate);
    const resto = residuo - (importoRata * input.numeroRate);

    const mesiOffset = FREQUENZA_MESI[input.frequenza as keyof typeof FREQUENZA_MESI] ?? 1;
    const scadenzeCreate: string[] = [];

    for (let i = 0; i < input.numeroRate; i++) {
      const dataBase = new Date(input.dataInizio);
      dataBase.setMonth(dataBase.getMonth() + (i * mesiOffset));
      const dataScadenza = dataBase.toISOString().split("T")[0];
      // L'ultima rata assorbe il resto dell'arrotondamento
      const importo = i === input.numeroRate - 1 ? importoRata + resto : importoRata;
      const { id } = await repo.insertScadenza(actor, {
        documentoId: input.documentoId,
        importo,
        importoPagato: 0,
        residuo: importo,
        dataScadenza,
        numero: i + 1,
        totaleRate: input.numeroRate,
        stato: "aperta",
      });
      scadenzeCreate.push(id);
    }

    return { scadenzeCreate, numeroRate: input.numeroRate };
  },

  /**
   * Crea scadenze personalizzate (importi liberi).
   */
  async creaScadenzePersonalizzate(actor: ActorContext, documentoId: string, scadenze: Array<{ importo: number; dataScadenza: string; note?: string }>) {
    const doc = await repo.getDocumento(actor.companyId, documentoId);
    if (!doc) throw new Error("Documento non trovato");

    // Annulla scadenze aperte esistenti
    await repo.annullaScadenzeDocumento(actor, documentoId);

    const totaleRate = scadenze.length;
    const ids: string[] = [];
    for (let i = 0; i < scadenze.length; i++) {
      const s = scadenze[i];
      const { id } = await repo.insertScadenza(actor, {
        documentoId,
        importo: s.importo,
        importoPagato: 0,
        residuo: s.importo,
        dataScadenza: s.dataScadenza,
        numero: i + 1,
        totaleRate,
        note: s.note,
        stato: "aperta",
      });
      ids.push(id);
    }
    return { ids, totaleRate };
  },

  /**
   * Crea una ricorrenza finanziaria.
   */
  async creaRicorrenza(actor: ActorContext, input: CreaRicorrenzaInput) {
    return repo.insertRicorrenza(actor, {
      nome: input.nome,
      tipo: input.tipo,
      tipoDocumento: input.tipoDocumento,
      soggettoId: input.soggettoId,
      categoriaId: input.categoriaId,
      centroCostoId: input.centroCostoId,
      imponibile: input.imponibile,
      aliquotaIva: input.aliquotaIva,
      importoIva: input.importoIva,
      totale: input.totale,
      descrizione: input.descrizione,
      frequenza: input.frequenza,
      giorno: input.giorno,
      prossimaEmissione: input.prossimaEmissione,
      dataFine: input.dataFine,
      attiva: true,
      creaScadenza: input.creaScadenza,
      creaPagamento: input.creaPagamento,
      contoId: input.contoId,
      metodoId: input.metodoId,
    });
  },

  /**
   * Aggiorna una ricorrenza.
   */
  async updateRicorrenza(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateRicorrenza(actor, id, data);
  },

  /**
   * Disattiva una ricorrenza.
   */
  async disattivaRicorrenza(actor: ActorContext, id: string) {
    return repo.updateRicorrenza(actor, id, { attiva: false });
  },

  /**
   * Elimina (soft) una ricorrenza.
   */
  async deleteRicorrenza(actor: ActorContext, id: string) {
    return repo.softDeleteRicorrenza(actor, id);
  },

  /**
   * Lista ricorrenze.
   */
  async listRicorrenze(companyId: string, attiva?: boolean) {
    return repo.listRicorrenze(companyId, attiva);
  },

  /**
   * Emetti documento da ricorrenza (chiamato dal heartbeat o manualmente).
   */
  async emettiDaRicorrenza(actor: ActorContext, ricorrenzaId: string) {
    const ric = await repo.getRicorrenza(actor.companyId, ricorrenzaId);
    if (!ric || !ric.attiva) throw new Error("Ricorrenza non trovata o disattivata");

    // Crea il movimento
    const result = await this.creaMovimento(actor, {
      tipo: ric.tipo as "entrata" | "uscita",
      tipoRegistrazione: ric.creaPagamento ? "pagato_subito" : "documento",
      tipoDocumento: ric.tipoDocumento ?? "generico",
      soggettoId: ric.soggettoId ?? undefined,
      categoriaId: ric.categoriaId,
      centroCostoId: ric.centroCostoId ?? undefined,
      imponibile: ric.imponibile,
      aliquotaIva: ric.aliquotaIva,
      importoIva: ric.importoIva,
      totale: ric.totale,
      dataDocumento: typeof ric.prossimaEmissione === "string" ? ric.prossimaEmissione : (ric.prossimaEmissione as Date).toISOString().split("T")[0],
      dataScadenza: typeof ric.prossimaEmissione === "string" ? ric.prossimaEmissione : (ric.prossimaEmissione as Date).toISOString().split("T")[0],
      descrizione: ric.descrizione ?? ric.nome,
      contoId: ric.contoId ?? undefined,
      metodoId: ric.metodoId ?? undefined,
    });

    // Aggiorna ricorrenzaId sul documento
    await repo.updateDocumento(actor, result.documentoId, { ricorrenzaId });

    // Calcola prossima emissione
    const mesi = FREQUENZA_MESI[ric.frequenza as keyof typeof FREQUENZA_MESI] ?? 1;
    const prossima = new Date(ric.prossimaEmissione);
    prossima.setMonth(prossima.getMonth() + mesi);
    const prossimaStr = prossima.toISOString().split("T")[0];

    // Se dataFine e prossima > dataFine → disattiva
    const dataFineStr = ric.dataFine ? (typeof ric.dataFine === "string" ? ric.dataFine : (ric.dataFine as Date).toISOString().split("T")[0]) : null;
    if (dataFineStr && prossimaStr > dataFineStr) {
      const ultimaStr = typeof ric.prossimaEmissione === "string" ? ric.prossimaEmissione : (ric.prossimaEmissione as Date).toISOString().split("T")[0];
      await repo.updateRicorrenza(actor, ricorrenzaId, { attiva: false, ultimaEmissione: ultimaStr });
    } else {
      const ultimaStr2 = typeof ric.prossimaEmissione === "string" ? ric.prossimaEmissione : (ric.prossimaEmissione as Date).toISOString().split("T")[0];
      await repo.updateRicorrenza(actor, ricorrenzaId, { prossimaEmissione: prossimaStr, ultimaEmissione: ultimaStr2 });
    }

    return { documentoId: result.documentoId, prossimaEmissione: prossimaStr };
  },

  /**
   * Lista scadenze con filtri avanzati.
   */
  async listScadenze(companyId: string, filters?: { stato?: string; documentoId?: string; dataInizio?: string; dataFine?: string; limit?: number }) {
    return repo.listScadenzeAvanzate(companyId, filters);
  },

  /**
   * Lista crediti (documenti entrata con residuo > 0).
   */
  async listCrediti(companyId: string, limit = 50) {
    return repo.listCrediti(companyId, limit);
  },

  /**
   * Lista debiti (documenti uscita con residuo > 0).
   */
  async listDebiti(companyId: string, limit = 50) {
    return repo.listDebiti(companyId, limit);
  },

  /**
   * Somma crediti e debiti residui.
   */
  async sumResidui(companyId: string) {
    return repo.sumResidui(companyId);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SEED — Categorie e centri di costo iniziali
  // ══════════════════════════════════════════════════════════════════════════
  async seedDatiIniziali(actor: ActorContext) {
    // Controlla se le categorie predefinite sono già presenti (per codice)
    const existingCat = await repo.listCategorie(actor.companyId);
    const existingCodes = new Set((existingCat as any[]).map((c: any) => c.codice));

    let inserted = 0;

    // Categorie uscite — inserisci solo quelle mancanti
    for (const cat of CATEGORIE_USCITE_DEFAULT) {
      if (!existingCodes.has(cat.codice)) {
        await repo.insertCategoria(actor, { ...cat, tipo: "uscita", attivo: true, ordine: 0 });
        inserted++;
      }
    }
    // Categorie entrate — inserisci solo quelle mancanti
    for (const cat of CATEGORIE_ENTRATE_DEFAULT) {
      if (!existingCodes.has(cat.codice)) {
        await repo.insertCategoria(actor, { ...cat, tipo: "entrata", attivo: true, ordine: 0 });
        inserted++;
      }
    }

    // Centri di costo — inserisci solo quelli mancanti
    const existingCdc = await repo.listCentriCosto(actor.companyId);
    const existingCdcCodes = new Set((existingCdc as any[]).map((c: any) => c.codice));
    for (const cdc of CENTRI_COSTO_DEFAULT) {
      if (!existingCdcCodes.has(cdc.codice)) {
        await this.createCentroCosto(actor, { ...cdc, attivo: true });
        inserted++;
      }
    }

    // Collega le sottocategorie ancora prive di relazioni alle categorie dei
    // centri più pertinenti. Non sovrascrive mai configurazioni già esistenti.
    const [categorieAggiornate, centriAggiornati, relazioni] = await Promise.all([
      repo.listCategorie(actor.companyId),
      this.listCentriCosto(actor.companyId),
      repo.listCategoriaCentroRelations(actor.companyId),
    ]);
    const categorieGiaCollegate = new Set(relazioni.map((relazione) => relazione.sottocategoriaId));
    const paroleChiave: Array<{ termini: string[]; centri: string[] }> = [
      { termini: ["alimentazione", "mangim"], centri: ["alimentazione", "stalla"] },
      { termini: ["farmac", "veterin", "sanità"], centri: ["sanità animale", "stalla"] },
      { termini: ["carbur", "manutenzione", "ricamb"], centri: ["officina", "macchinari"] },
      { termini: ["sement", "concim", "coltur", "pac", "contoter"], centri: ["campi"] },
      { termini: ["latte"], centri: ["produzione latte", "stalla"] },
      { termini: ["animal"], centri: ["stalla"] },
      { termini: ["energia"], centri: ["energia"] },
      { termini: ["personale"], centri: ["personale"] },
      { termini: ["invest", "leasing", "mutu"], centri: ["investimenti"] },
      { termini: ["amministr", "assicura", "impost", "consul"], centri: ["amministrazione"] },
    ];
    for (const sottocategoria of categorieAggiornate) {
      if (categorieGiaCollegate.has(sottocategoria.id)) continue;
      const nome = sottocategoria.nome.toLowerCase();
      const regola = paroleChiave.find((item) => item.termini.some((termine) => nome.includes(termine)));
      const nomiTarget = regola?.centri ?? ["altro"];
      const categoriaCentroIds = (centriAggiornati as any[])
        .filter((centro) => nomiTarget.includes(String(centro.nome).toLowerCase()))
        .map((centro) => centro.categoriaCentroId)
        .filter(Boolean);
      if (categoriaCentroIds.length) await repo.replaceCategoriaCentroRelations(actor, sottocategoria.id, categoriaCentroIds);
    }

    // Metodi di pagamento — inserisci solo quelli mancanti
    const existingMetodi = await repo.listMetodi(actor.companyId);
    const existingMetodiNomi = new Set((existingMetodi as any[]).map((m: any) => m.nome));
    for (const nome of METODI_PAGAMENTO_DEFAULT) {
      if (!existingMetodiNomi.has(nome)) {
        await repo.insertMetodo(actor, nome);
        inserted++;
      }
    }

    if (inserted === 0) return { seeded: false, message: "Dati già presenti" };
    return { seeded: true, message: `${inserted} elementi predefiniti creati` };
  },
};
