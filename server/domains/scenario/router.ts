import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import * as service from "./service";
import {
  createScenarioSchema,
  addIpotesiSchema,
  addIpotesiBatchSchema,
  calcolaSchema,
  confrontaSchema,
  listScenariSchema,
  deleteScenarioSchema,
  updateIpotesiSchema,
  removeIpotesiSchema,
} from "./validators";
import { z } from "zod";

export const scenarioRouter = router({
  list: protectedProcedure
    .input(listScenariSchema.optional())
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.listScenari(actor, input?.stato);
    }),

  detail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.detailScenario(actor, input.id);
    }),

  create: protectedProcedure
    .input(createScenarioSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createScenario(actor, input);
    }),

  addIpotesi: protectedProcedure
    .input(addIpotesiSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.addIpotesi(actor, input);
    }),

  addIpotesiBatch: protectedProcedure
    .input(addIpotesiBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.addIpotesiBatch(actor, input.scenarioId, input.ipotesi);
    }),

  updateIpotesi: protectedProcedure
    .input(updateIpotesiSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.updateIpotesi(actor, input.id, { valoreIpotesi: input.valoreIpotesi, note: input.note });
    }),

  removeIpotesi: protectedProcedure
    .input(removeIpotesiSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.removeIpotesi(actor, input.id);
    }),

  calcola: protectedProcedure
    .input(calcolaSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.calcolaImpatto(actor, input.scenarioId);
    }),

  confronta: protectedProcedure
    .input(confrontaSchema)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.confrontaScenari(actor, input.scenarioIds);
    }),

  delete: protectedProcedure
    .input(deleteScenarioSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.deleteScenario(actor, input.id);
    }),

  archivia: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.archiviaScenario(actor, input.id);
    }),

  variabiliMeta: protectedProcedure
    .query(() => service.getVariabiliMeta()),
});
