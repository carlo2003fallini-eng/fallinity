import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { financeService } from "./service";
import {
  listTransazioniInput,
  createTransazioneInput,
  deleteTransazioneInput,
} from "./validators";

/**
 * FINANCE — Router
 * Strato sottile: valida input, ricava l'attore, delega al service.
 * Nessuna logica di business o query qui.
 */
export const finanzaRouter = router({
  list: protectedProcedure.input(listTransazioniInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.list(actor.companyId, input?.tipo);
  }),
  summary: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.summary(actor.companyId);
  }),
  byCategoria: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.byCategoria(actor.companyId);
  }),
  create: protectedProcedure.input(createTransazioneInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.create(actor, input);
  }),
  delete: protectedProcedure.input(deleteTransazioneInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.remove(actor, input.id);
  }),
});
