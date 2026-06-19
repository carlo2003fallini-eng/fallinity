import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { cropService } from "./service";
import {
  lavorazioniInput,
  createCampoInput,
  addLavorazioneInput,
  deleteCampoInput,
} from "./validators";

/** CROP (Campi) — Router */
export const campiRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return cropService.listCampi(actor.companyId);
  }),
  lavorazioni: protectedProcedure.input(lavorazioniInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return cropService.listLavorazioni(actor.companyId, input.campoId);
  }),
  create: protectedProcedure.input(createCampoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return cropService.createCampo(actor, input);
  }),
  addLavorazione: protectedProcedure.input(addLavorazioneInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return cropService.addLavorazione(actor, input);
  }),
  delete: protectedProcedure.input(deleteCampoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return cropService.removeCampo(actor, input.id);
  }),
});
