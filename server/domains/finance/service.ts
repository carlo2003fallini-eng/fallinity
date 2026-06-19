import type { ActorContext } from "../_core";
import { financeRepository as repo } from "./repository";
import type { CreateTransazioneInput } from "./validators";

/**
 * FINANCE — Service
 * Logica di business del dominio finanziario. Orchestra il repository,
 * applica conversioni e calcola gli indicatori derivati (utile, ROI).
 */

export const financeService = {
  list(companyId: string, tipo?: "entrata" | "uscita") {
    return repo.listTransazioni(companyId, tipo);
  },

  async summary(companyId: string) {
    const { entrate, uscite } = await repo.sumEntrateUscite(companyId);
    const utile = entrate - uscite;
    const roi = uscite > 0 ? (utile / uscite) * 100 : 0;
    return { entrate, uscite, utile, roi };
  },

  byCategoria(companyId: string) {
    return repo.byCategoria(companyId);
  },

  monthlySeries(companyId: string) {
    return repo.monthlySeries(companyId);
  },

  create(actor: ActorContext, input: CreateTransazioneInput) {
    return repo.insertTransazione(actor, { ...input, importo: String(input.importo) });
  },

  remove(actor: ActorContext, id: string) {
    return repo.softDeleteTransazione(actor, id);
  },

  /** Indicatori per dashboard/report (utile netto + ROI con etichette estese). */
  async reportSummary(companyId: string) {
    const { entrate, uscite } = await repo.sumEntrateUscite(companyId);
    return {
      entrateTotali: entrate,
      usciteTotali: uscite,
      utileNetto: entrate - uscite,
      roi: uscite > 0 ? ((entrate - uscite) / uscite) * 100 : 0,
    };
  },
};
