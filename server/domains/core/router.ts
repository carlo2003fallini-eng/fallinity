import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { coreService } from "./service";
import { listContattiInput, createContattoInput, deleteContattoInput } from "./validators";

/** COMPANY — azienda attiva */
export const companyRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return coreService.currentCompany(actor.companyId);
  }),
});

/** AZIENDA — contatti (dipendenti/fornitori/clienti) */
export const aziendaRouter = router({
  list: protectedProcedure.input(listContattiInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return coreService.listContatti(actor.companyId, input?.tipo);
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return coreService.contattiStats(actor.companyId);
  }),
  create: protectedProcedure.input(createContattoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return coreService.createContatto(actor, input);
  }),
  delete: protectedProcedure.input(deleteContattoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return coreService.removeContatto(actor, input.id);
  }),
});

/** DASHBOARD — KPI globali Home */
export const dashboardRouter = router({
  kpi: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return coreService.dashboardKpi(actor.companyId);
  }),
  chartData: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return coreService.chartData(actor.companyId);
  }),
  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return coreService.recentActivity(actor.companyId);
  }),
});
