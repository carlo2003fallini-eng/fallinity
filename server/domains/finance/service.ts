import { financeRepository as repo } from "./repository";
import type { ActorContext } from "../_core";
import type { CreateMovimentoInput } from "./validators";
import {
  CATEGORIE_USCITE_DEFAULT,
  CATEGORIE_ENTRATE_DEFAULT,
  CENTRI_COSTO_DEFAULT,
  METODI_PAGAMENTO_DEFAULT,
} from "./types";

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
  async listCategorie(companyId: string, tipo?: string) {
    return repo.listCategorie(companyId, tipo);
  },
  async createCategoria(actor: ActorContext, data: Record<string, unknown>) {
    const codice = (data.codice as string) || `CAT-${Date.now().toString(36).toUpperCase()}`;
    return repo.insertCategoria(actor, { ...data, codice });
  },
  async updateCategoria(actor: ActorContext, id: string, data: Record<string, unknown>) {
    return repo.updateCategoria(actor, id, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CENTRI DI COSTO
  // ══════════════════════════════════════════════════════════════════════════
  async listCentriCosto(companyId: string) {
    return repo.listCentriCosto(companyId);
  },
  async createCentroCosto(actor: ActorContext, data: Record<string, unknown>) {
    const codice = (data.codice as string) || `CDC-${Date.now().toString(36).toUpperCase()}`;
    return repo.insertCentroCosto(actor, { ...data, codice });
  },
  async updateCentroCosto(actor: ActorContext, id: string, data: Record<string, unknown>) {
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
    // 1. Crea il documento finanziario
    const statoIniziale = input.tipoRegistrazione === "pagato_subito"
      ? (input.tipo === "entrata" ? "incassato" : "pagato")
      : "registrato";

    const docData = {
      tipo: input.tipo,
      tipoRegistrazione: input.tipoRegistrazione,
      tipoDocumento: input.tipoDocumento ?? "generico",
      numero: input.numero,
      dataDocumento: input.dataDocumento,
      soggettoId: input.soggettoId,
      categoriaId: input.categoriaId,
      centroCostoId: input.centroCostoId,
      imponibile: input.imponibile,
      aliquotaIva: input.aliquotaIva,
      importoIva: input.importoIva,
      totale: input.totale,
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
      // Crea scadenza
      const dataScadenza = input.dataScadenza ?? input.dataDocumento;
      await repo.insertScadenza(actor, {
        documentoId,
        importo: input.totale,
        dataScadenza,
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

  /**
   * Elimina (soft delete) un movimento in bozza.
   */
  async deleteMovimento(actor: ActorContext, id: string) {
    const doc = await repo.getDocumento(actor.companyId, id);
    if (!doc) throw new Error("Documento non trovato");
    if (doc.stato !== "bozza" && doc.stato !== "registrato") {
      throw new Error("Solo documenti in bozza o registrati possono essere eliminati. Usa annulla per documenti pagati.");
    }
    return repo.softDeleteDocumento(actor, id);
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
  // SEED — Categorie e centri di costo iniziali
  // ══════════════════════════════════════════════════════════════════════════
  async seedDatiIniziali(actor: ActorContext) {
    // Controlla se già seedato
    const existingCat = await repo.listCategorie(actor.companyId);
    if (existingCat.length > 0) return { seeded: false, message: "Dati già presenti" };

    // Categorie uscite
    for (const cat of CATEGORIE_USCITE_DEFAULT) {
      await repo.insertCategoria(actor, { ...cat, tipo: "uscita", attivo: true, ordine: 0 });
    }
    // Categorie entrate
    for (const cat of CATEGORIE_ENTRATE_DEFAULT) {
      await repo.insertCategoria(actor, { ...cat, tipo: "entrata", attivo: true, ordine: 0 });
    }
    // Centri di costo
    for (const cdc of CENTRI_COSTO_DEFAULT) {
      await repo.insertCentroCosto(actor, { ...cdc, attivo: true });
    }
    // Metodi di pagamento
    for (const nome of METODI_PAGAMENTO_DEFAULT) {
      await repo.insertMetodo(actor, nome);
    }

    return { seeded: true, message: "Categorie, centri di costo e metodi creati" };
  },
};
