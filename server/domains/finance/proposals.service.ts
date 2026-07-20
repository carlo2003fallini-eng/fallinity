import type { ActorContext } from "../_core";
import { proposalsRepository } from "./proposals.repository";
import { financeService } from "./service";
import type {
  CreateProposalInput,
  ConvertToPaymentInput,
  ConvertToDocumentInput,
  LinkProposalInput,
  IgnoreProposalInput,
  UpdateSettingsInput,
  ListProposalsInput,
  OriginStatusInput,
} from "./proposals.validators";

/**
 * FINANCE — Proposals Service
 * Logica di business per le proposte finanziarie generate dai moduli operativi.
 * 
 * Principi:
 * - Idempotenza: chiave unica (companyId + originModule + originEntityId + originEventType)
 * - Nessun doppio conteggio: costo gestionale ≠ costo finanziario
 * - Manodopera interna configurabile: gestionale/finanziario/escluso
 * - Conversione a pagamento immediato o documento con scadenza
 */
export const proposalsService = {
  // ══════════════════════════════════════════════════════════════════════════
  // CREAZIONE IDEMPOTENTE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Crea una proposta finanziaria o restituisce quella esistente (idempotente).
   * Chiamata dai servizi dei moduli operativi (fleet, inventory, livestock, crop, machinery).
   */
  async createOrGetProposal(actor: ActorContext, input: CreateProposalInput) {
    // Controlla se esiste già (idempotenza)
    const existing = await proposalsRepository.findByOrigin(
      actor.companyId,
      input.originModule,
      input.originEntityId,
      input.originEventType,
    );
    if (existing) {
      return { id: existing.id, created: false, proposal: existing };
    }

    // Applica defaults dalle impostazioni del modulo
    const settings = await proposalsRepository.getSettings(actor.companyId, input.originModule);
    const categoriaId = input.categoriaId || settings?.categoriaDefaultId || undefined;
    const centroCostoId = input.centroCostoId || settings?.centroCostoDefaultId || undefined;
    const soggettoId = input.soggettoId || settings?.soggettoDefaultId || undefined;

    // Verifica automazione: se "nessuna", non creare la proposta
    if (settings?.automazione === "nessuna") {
      return { id: null, created: false, proposal: null, skipped: true };
    }

    const { id } = await proposalsRepository.insert(actor, {
      tipo: input.tipo,
      importo: String(input.importo), // decimal as string
      imponibile: input.imponibile != null ? String(input.imponibile) : null,
      iva: input.iva != null ? String(input.iva) : null,
      descrizione: input.descrizione,
      dataOrigine: input.dataOrigine,
      categoriaId,
      centroCostoId,
      soggettoId,
      originModule: input.originModule,
      originEntityType: input.originEntityType,
      originEntityId: input.originEntityId,
      originEventType: input.originEventType,
      originReference: input.originReference,
      stato: "da_esaminare",
    });

    const proposal = await proposalsRepository.getById(actor.companyId, id);
    return { id, created: true, proposal };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONVERSIONE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Converte una proposta in pagamento immediato (pagato_subito).
   * Crea documento + pagamento + movimento cassa tramite financeService.creaMovimento.
   */
  async convertToPayment(actor: ActorContext, input: ConvertToPaymentInput) {
    const proposal = await proposalsRepository.getById(actor.companyId, input.proposalId);
    if (!proposal) throw new Error("Proposta non trovata");
    if (proposal.stato !== "da_esaminare" && proposal.stato !== "errore") {
      throw new Error(`Proposta non convertibile (stato: ${proposal.stato})`);
    }

    try {
      const importo = Math.round(Number(proposal.importo));
      const imponibile = proposal.imponibile ? Math.round(Number(proposal.imponibile)) : importo;
      const importoIva = proposal.iva ? Math.round(Number(proposal.iva)) : 0;

      const result = await financeService.creaMovimento(actor, {
        tipo: proposal.tipo as "entrata" | "uscita",
        tipoRegistrazione: "pagato_subito",
        imponibile,
        aliquotaIva: importoIva > 0 ? Math.round((importoIva / imponibile) * 10000) : 0,
        importoIva,
        totale: importo,
        dataDocumento: String(proposal.dataOrigine),
        categoriaId: input.categoriaId || proposal.categoriaId || "",
        centroCostoId: input.centroCostoId || proposal.centroCostoId || undefined,
        soggettoId: input.soggettoId || proposal.soggettoId || undefined,
        contoId: input.contoId,
        metodoId: input.metodoId,
        descrizione: proposal.descrizione || "",
        note: input.note,
        originModule: proposal.originModule,
        originEntityType: proposal.originEntityType,
        originEntityId: proposal.originEntityId,
      });

      // Aggiorna proposta
      await proposalsRepository.update(actor, input.proposalId, {
        stato: "convertita",
        documentoFinanziarioId: result.documentoId,
        reviewedAt: new Date(),
        reviewedBy: actor.userUuid,
      });

      return { success: true, documentoId: result.documentoId };
    } catch (err: any) {
      await proposalsRepository.update(actor, input.proposalId, {
        stato: "errore",
        errore: err.message || "Errore conversione",
      });
      throw err;
    }
  },

  /**
   * Converte una proposta in documento con scadenza.
   * Crea documento + scadenza tramite financeService.creaMovimento.
   */
  async convertToDocument(actor: ActorContext, input: ConvertToDocumentInput) {
    const proposal = await proposalsRepository.getById(actor.companyId, input.proposalId);
    if (!proposal) throw new Error("Proposta non trovata");
    if (proposal.stato !== "da_esaminare" && proposal.stato !== "errore") {
      throw new Error(`Proposta non convertibile (stato: ${proposal.stato})`);
    }

    try {
      const importo = Math.round(Number(proposal.importo));
      const imponibile = proposal.imponibile ? Math.round(Number(proposal.imponibile)) : importo;
      const importoIva = proposal.iva ? Math.round(Number(proposal.iva)) : 0;

      const result = await financeService.creaMovimento(actor, {
        tipo: proposal.tipo as "entrata" | "uscita",
        tipoRegistrazione: "documento",
        imponibile,
        aliquotaIva: importoIva > 0 ? Math.round((importoIva / imponibile) * 10000) : 0,
        importoIva,
        totale: importo,
        dataDocumento: String(proposal.dataOrigine),
        dataScadenza: input.dataScadenza,
        categoriaId: input.categoriaId || proposal.categoriaId || "",
        centroCostoId: input.centroCostoId || proposal.centroCostoId || undefined,
        soggettoId: input.soggettoId || proposal.soggettoId || undefined,
        tipoDocumento: input.tipoDocumento,
        numero: input.numero,
        descrizione: proposal.descrizione || "",
        note: input.note,
        originModule: proposal.originModule,
        originEntityType: proposal.originEntityType,
        originEntityId: proposal.originEntityId,
      });

      // Aggiorna proposta
      await proposalsRepository.update(actor, input.proposalId, {
        stato: "convertita",
        documentoFinanziarioId: result.documentoId,
        reviewedAt: new Date(),
        reviewedBy: actor.userUuid,
      });

      return { success: true, documentoId: result.documentoId };
    } catch (err: any) {
      await proposalsRepository.update(actor, input.proposalId, {
        stato: "errore",
        errore: err.message || "Errore conversione",
      });
      throw err;
    }
  },

  /**
   * Collega una proposta a un documento finanziario esistente.
   * Utile quando il documento è già stato creato manualmente.
   */
  async linkToDocument(actor: ActorContext, input: LinkProposalInput) {
    const proposal = await proposalsRepository.getById(actor.companyId, input.proposalId);
    if (!proposal) throw new Error("Proposta non trovata");
    if (proposal.stato !== "da_esaminare" && proposal.stato !== "errore") {
      throw new Error(`Proposta non collegabile (stato: ${proposal.stato})`);
    }

    await proposalsRepository.update(actor, input.proposalId, {
      stato: "collegata",
      documentoFinanziarioId: input.documentoFinanziarioId,
      reviewedAt: new Date(),
      reviewedBy: actor.userUuid,
    });

    return { success: true };
  },

  /**
   * Ignora una proposta con motivazione.
   */
  async ignore(actor: ActorContext, input: IgnoreProposalInput) {
    const proposal = await proposalsRepository.getById(actor.companyId, input.proposalId);
    if (!proposal) throw new Error("Proposta non trovata");
    if (proposal.stato !== "da_esaminare") {
      throw new Error(`Proposta non ignorabile (stato: ${proposal.stato})`);
    }

    await proposalsRepository.update(actor, input.proposalId, {
      stato: "ignorata",
      motivoIgnorato: input.motivo,
      reviewedAt: new Date(),
      reviewedBy: actor.userUuid,
    });

    return { success: true };
  },

  /**
   * Riprova una proposta in errore (reset a da_esaminare).
   */
  async retry(actor: ActorContext, proposalId: string) {
    const proposal = await proposalsRepository.getById(actor.companyId, proposalId);
    if (!proposal) throw new Error("Proposta non trovata");
    if (proposal.stato !== "errore") {
      throw new Error(`Solo proposte in errore possono essere riprovate (stato: ${proposal.stato})`);
    }

    await proposalsRepository.update(actor, proposalId, {
      stato: "da_esaminare",
      errore: null,
      reviewedAt: null,
      reviewedBy: null,
    });

    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // QUERY
  // ══════════════════════════════════════════════════════════════════════════

  /** Lista proposte con filtri */
  async list(companyId: string, input: ListProposalsInput) {
    return proposalsRepository.list(companyId, input);
  },

  /** Dettaglio proposta */
  async detail(companyId: string, id: string) {
    return proposalsRepository.getById(companyId, id);
  },

  /** Conta proposte per stato */
  async countByStato(companyId: string) {
    return proposalsRepository.countByStato(companyId);
  },

  /** Stato finanziario di un'entità di origine (per visualizzazione nei moduli) */
  async getOriginStatus(companyId: string, input: OriginStatusInput) {
    const proposals = await proposalsRepository.findByEntity(
      companyId,
      input.originModule,
      input.originEntityId,
    );
    if (proposals.length === 0) return { hasProposals: false, proposals: [] };

    return {
      hasProposals: true,
      proposals: proposals.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        importo: Number(p.importo),
        stato: p.stato,
        originEventType: p.originEventType,
        documentoFinanziarioId: p.documentoFinanziarioId,
        createdAt: p.createdAt,
      })),
    };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // IMPOSTAZIONI
  // ══════════════════════════════════════════════════════════════════════════

  /** Ottieni impostazioni per modulo */
  async getSettings(companyId: string, modulo: string) {
    return proposalsRepository.getSettings(companyId, modulo);
  },

  /** Lista tutte le impostazioni */
  async listSettings(companyId: string) {
    return proposalsRepository.listSettings(companyId);
  },

  /** Aggiorna impostazioni per modulo */
  async updateSettings(actor: ActorContext, input: UpdateSettingsInput) {
    const data: Record<string, unknown> = {};
    if (input.automazione !== undefined) data.automazione = input.automazione;
    if (input.categoriaDefaultId !== undefined) data.categoriaDefaultId = input.categoriaDefaultId;
    if (input.centroCostoDefaultId !== undefined) data.centroCostoDefaultId = input.centroCostoDefaultId;
    if (input.soggettoDefaultId !== undefined) data.soggettoDefaultId = input.soggettoDefaultId;
    if (input.manodoperaInternaMode !== undefined) data.manodoperaInternaMode = input.manodoperaInternaMode;

    return proposalsRepository.upsertSettings(actor, input.modulo, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER per moduli operativi
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Verifica se la manodopera interna deve generare un costo finanziario.
   * Restituisce true se la manodopera va inclusa come costo finanziario.
   */
  async isManodoperaFinanziaria(companyId: string, modulo: string): Promise<boolean> {
    const settings = await proposalsRepository.getSettings(companyId, modulo);
    return settings?.manodoperaInternaMode === "finanziario";
  },

  /**
   * Verifica se il modulo ha l'automazione attiva.
   */
  async isAutomationEnabled(companyId: string, modulo: string): Promise<boolean> {
    const settings = await proposalsRepository.getSettings(companyId, modulo);
    return settings?.automazione !== "nessuna";
  },
};
