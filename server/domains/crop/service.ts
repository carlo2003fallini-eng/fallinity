import type { ActorContext } from "../_core";
import { cropRepository as repo } from "./repository";
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
    return repo.insertLavorazione(actor, {
      ...input,
      costo: input.costo != null ? String(input.costo) : null,
    });
  },
  removeCampo(actor: ActorContext, id: string) {
    return repo.softDeleteCampo(actor, id);
  },
};
