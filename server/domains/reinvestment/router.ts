import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { reinvestmentService } from "./service";
import { addFondoInput, pagaRataInput, rateInput } from "./validators";

/** REINVESTMENT (Reintegrazione) — Router */
export const reintegrazioneRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return reinvestmentService.list(actor.companyId);
  }),
  totale: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return reinvestmentService.totale(actor.companyId);
  }),
  rate: protectedProcedure.input(rateInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return reinvestmentService.rate(actor.companyId, input.fondoId);
  }),
  add: protectedProcedure.input(addFondoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return reinvestmentService.add(actor, input);
  }),
  pagaRata: protectedProcedure.input(pagaRataInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return reinvestmentService.pagaRata(actor, input.fondoId, input.importo);
  }),
});
