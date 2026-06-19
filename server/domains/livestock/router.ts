import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { livestockService } from "./service";
import { addAnimaleInput, eseguiTrattamentoInput, addZoppiaInput } from "./validators";

/** LIVESTOCK (Stalla) — Router */
export const stallaRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.list(actor.companyId);
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.stats(actor.companyId);
  }),
  zoppie: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.zoppie(actor.companyId);
  }),
  add: protectedProcedure.input(addAnimaleInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.addAnimale(actor, input);
  }),
  addZoppia: protectedProcedure.input(addZoppiaInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.addZoppia(actor, input);
  }),
  eseguiTrattamento: protectedProcedure.input(eseguiTrattamentoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.eseguiTrattamento(actor, input.animaleId);
  }),
});
