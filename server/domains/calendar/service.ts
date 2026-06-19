import type { ActorContext } from "../_core";
import { calendarRepository as repo } from "./repository";
import type { CreateEventoInput } from "./validators";

/** CALENDAR (Calendario) — Service */
export const calendarService = {
  list(companyId: string, anno?: number, mese?: number) {
    if (anno && mese) return repo.listByMonth(companyId, anno, mese);
    return repo.listAll(companyId);
  },

  today(companyId: string) {
    return repo.listToday(companyId);
  },

  create(actor: ActorContext, input: CreateEventoInput) {
    return repo.insert(actor, {
      titolo: input.titolo,
      descrizione: input.descrizione,
      tipo: input.tipo,
      dataInizio: new Date(input.data),
      tuttoIlGiorno: !input.ora,
      colore: input.priorita === "alta" ? "#f87171" : input.priorita === "normale" ? "#d4a843" : "#4ade80",
    });
  },

  toggleCompletato(actor: ActorContext, id: string, completato: boolean) {
    return repo.toggleCompletato(actor, id, completato);
  },

  remove(actor: ActorContext, id: string) {
    return repo.softDelete(actor, id);
  },
};
