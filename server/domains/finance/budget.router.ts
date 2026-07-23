import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";
import * as budgetService from "./budget.service";
import { createBudgetInput, updateBudgetInput, listBudgetsInput, budgetComparisonInput, budgetForecastInput } from "./budget.validators";
import { getActor } from "../_core";

export const budgetRouter = router({
  list: protectedProcedure
    .input(listBudgetsInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.listBudgets(actor.companyId, input);
    }),

  detail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.getBudget(actor.companyId, input.id);
    }),

  create: protectedProcedure
    .input(createBudgetInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.createBudget(actor.companyId, input, actor.userUuid);
    }),

  update: protectedProcedure
    .input(updateBudgetInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.updateBudget(actor.companyId, input, actor.userUuid);
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.archiveBudget(actor.companyId, input.id, actor.userUuid);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.deleteBudget(actor.companyId, input.id, actor.userUuid);
    }),

  comparison: protectedProcedure
    .input(budgetComparisonInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.getBudgetComparison(actor.companyId, input);
    }),

  forecast: protectedProcedure
    .input(budgetForecastInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return budgetService.getBudgetForecast(actor.companyId, input);
    }),

  alerts: protectedProcedure
    .query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return budgetService.getBudgetAlerts(actor.companyId);
    }),
});
