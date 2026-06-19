import type { ActorContext } from "../_core";
import { livestockRepository as repo } from "./repository";
import type { AddAnimaleInput, AddZoppiaInput } from "./validators";

/** LIVESTOCK (Stalla) — Service */
export const livestockService = {
  list(companyId: string) {
    return repo.listAnimali(companyId);
  },
  stats(companyId: string) {
    return repo.stats(companyId);
  },
  zoppie(companyId: string) {
    return repo.listZoppie(companyId);
  },
  addAnimale(actor: ActorContext, input: AddAnimaleInput) {
    return repo.insertAnimale(actor, input);
  },
  addZoppia(actor: ActorContext, input: AddZoppiaInput) {
    return repo.insertZoppia(actor, input);
  },
  eseguiTrattamento(actor: ActorContext, animaleId: string) {
    return repo.eseguiTrattamento(actor, animaleId);
  },
};
