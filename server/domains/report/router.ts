import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { reportService } from "./service";

/** REPORT (Enterprise Metrics) — Router */
export const reportRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return reportService.summary(actor.companyId);
  }),
  finanza: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return reportService.finanza(actor.companyId);
  }),
  operativo: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return reportService.operativo(actor.companyId);
  }),
});
