import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";
import * as replacementService from "./replacement.service";
import { createReplacementPlanInput, updateReplacementPlanInput, listReplacementPlansInput, updateValoreSostituzioneInput, createReplacementAccountInput, updateReplacementAccountInput, createAllocationInput, accantonamentoInput } from "./replacement.validators";
import { getActor } from "../_core";

export const replacementRouter = router({
  // ── Piani ──
  plans: router({
    list: protectedProcedure
      .input(listReplacementPlansInput)
      .query(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.listPlans(actor.companyId, input ?? undefined);
      }),

    detail: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.getPlan(actor.companyId, input.id);
      }),

    create: protectedProcedure
      .input(createReplacementPlanInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.createPlan(actor.companyId, input, actor.userUuid);
      }),

    update: protectedProcedure
      .input(updateReplacementPlanInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.updatePlan(actor.companyId, input, actor.userUuid);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.deletePlan(actor.companyId, input.id, actor.userUuid);
      }),

    updateValore: protectedProcedure
      .input(updateValoreSostituzioneInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.updateValoreSostituzione(actor.companyId, input, actor.userUuid);
      }),
  }),

  // ── Conti deposito ──
  accounts: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const actor = await getActor(ctx);
        return replacementService.listAccounts(actor.companyId);
      }),

    detail: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.getAccount(actor.companyId, input.id);
      }),

    create: protectedProcedure
      .input(createReplacementAccountInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.createAccount(actor.companyId, input, actor.userUuid);
      }),

    update: protectedProcedure
      .input(updateReplacementAccountInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.updateAccount(actor.companyId, input, actor.userUuid);
      }),
  }),

  // ── Allocazioni ──
  allocations: router({
    create: protectedProcedure
      .input(createAllocationInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.createAllocation(actor.companyId, input, actor.userUuid);
      }),

    update: protectedProcedure
      .input(z.object({ id: z.string(), importo: z.number().positive() }))
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return replacementService.updateAllocation(actor.companyId, input.id, input.importo, actor.userUuid);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return replacementService.deleteAllocation(input.id);
      }),
  }),

  // ── Accantonamento ──
  accrue: protectedProcedure
    .input(accantonamentoInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return replacementService.accantona(actor.companyId, input, actor.userUuid);
    }),

  // ── Dashboard ──
  dashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return replacementService.getDashboard(actor.companyId);
    }),
});
