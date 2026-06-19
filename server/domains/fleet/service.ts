import type { ActorContext } from "../_core";
import { fleetRepository as repo } from "./repository";
import type { CreateMacchinaInput, CreateInterventoInput } from "./validators";

/** FLEET (Officina) — Service */
export const fleetService = {
  listMacchine(companyId: string) {
    return repo.listMacchine(companyId);
  },
  listInterventi(companyId: string, macchinaId?: string) {
    return repo.listInterventi(companyId, macchinaId);
  },

  /** KPI per la dashboard premium Officina. */
  async dashboard(companyId: string) {
    const [macchine, interventi] = await Promise.all([
      repo.listMacchine(companyId),
      repo.listInterventi(companyId),
    ]);
    const mezziFermi = macchine.filter((m) => m.stato === "fermo").length;
    const inManutenzione = macchine.filter((m) => m.stato === "manutenzione").length;
    const manutenzioniPianificate = interventi.filter((i) => i.stato === "pianificato").length;
    const interventiUrgenti = interventi.filter((i) => i.priorita === "alta" && i.stato !== "completato").length;
    return {
      totaleMezzi: macchine.length,
      mezziFermi,
      inManutenzione,
      manutenzioniPianificate,
      interventiUrgenti,
    };
  },

  createMacchina(actor: ActorContext, input: CreateMacchinaInput) {
    return repo.insertMacchina(actor, {
      ...input,
      oreTotali: input.oreTotali != null ? String(input.oreTotali) : "0",
    });
  },

  createIntervento(actor: ActorContext, input: CreateInterventoInput) {
    return repo.insertIntervento(actor, {
      ...input,
      costoManodopera: input.costoManodopera != null ? String(input.costoManodopera) : null,
      costoRicambi: input.costoRicambi != null ? String(input.costoRicambi) : null,
    });
  },

  updateStatoIntervento(actor: ActorContext, id: string, stato: "pianificato" | "in_corso" | "completato") {
    return repo.updateStatoIntervento(actor, id, stato);
  },

  removeMacchina(actor: ActorContext, id: string) {
    return repo.softDeleteMacchina(actor, id);
  },
};
