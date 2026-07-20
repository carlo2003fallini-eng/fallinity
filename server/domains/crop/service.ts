import type { ActorContext } from "../_core";
import { cropRepository as repo } from "./repository";
import { proposalsService } from "../finance/proposals.service";
import type { CreateCampoInput, AddLavorazioneInput } from "./validators";

/** CROP (Campi) — Service */
export const cropService = {
  listCampi(companyId: string) {
    return repo.listCampi(companyId);
  },
  listLavorazioni(companyId: string, campoId: string) {
    return repo.listLavorazioni(companyId, campoId);
  },
  createCampo(actor: ActorContext, input: CreateCampoInput) {
    return repo.insertCampo(actor, { ...input, ettari: String(input.ettari) });
  },
  addLavorazione(actor: ActorContext, input: AddLavorazioneInput) {
    const result = repo.insertLavorazione(actor, {
      ...input,
      costo: input.costo != null ? String(input.costo) : null,
    });

    // Proposta finanziaria: se la lavorazione ha un costo (acquisto materiale esterno) → uscita.
    // Consumo materiale da magazzino = costo gestionale (no proposta).
    if (input.costo && input.costo > 0) {
      try {
        proposalsService.createOrGetProposal(actor, {
          tipo: "uscita",
          importo: Math.round(input.costo * 100), // centesimi
          descrizione: `Lavorazione ${input.tipo}${input.descrizione ? `: ${input.descrizione}` : ""} — Campo`,
          dataOrigine: input.data,
          originModule: "crop",
          originEntityType: "lavorazione",
          originEntityId: input.campoId,
          originEventType: `lavorazione_${input.data}`,
          originReference: input.tipo,
        });
      } catch { /* non bloccare */ }
    }

    return result;
  },
  removeCampo(actor: ActorContext, id: string) {
    return repo.softDeleteCampo(actor, id);
  },

  /** Vendita coltura → proposta entrata */
  async venditaColtura(actor: ActorContext, data: {
    campoId: string;
    importo: number;
    coltura: string;
    acquirente?: string;
    data: string;
    riferimento?: string;
  }) {
    try {
      if (data.importo > 0) {
        await proposalsService.createOrGetProposal(actor, {
          tipo: "entrata",
          importo: Math.round(data.importo * 100),
          descrizione: `Vendita ${data.coltura}${data.acquirente ? ` a ${data.acquirente}` : ""}`,
          dataOrigine: data.data,
          originModule: "crop",
          originEntityType: "vendita_coltura",
          originEntityId: data.riferimento ?? `${data.campoId}_${data.data}`,
          originEventType: "vendita_coltura",
          originReference: data.riferimento ?? data.coltura,
        });
      }
    } catch { /* non bloccare */ }
    return { success: true };
  },
};
