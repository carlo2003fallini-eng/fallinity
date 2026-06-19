import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { inventoryService } from "./service";
import {
  movimentiInput,
  createProdottoInput,
  movimentoInput,
  deleteProdottoInput,
} from "./validators";

/** INVENTORY (Magazzino) — Router */
export const magazzinoRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return inventoryService.list(actor.companyId);
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return inventoryService.stats(actor.companyId);
  }),
  movimenti: protectedProcedure.input(movimentiInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return inventoryService.movimenti(actor.companyId, input.prodottoId);
  }),
  create: protectedProcedure.input(createProdottoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return inventoryService.create(actor, input);
  }),
  movimento: protectedProcedure.input(movimentoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return inventoryService.registraMovimento(actor, input);
  }),
  delete: protectedProcedure.input(deleteProdottoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return inventoryService.remove(actor, input.id);
  }),
});
