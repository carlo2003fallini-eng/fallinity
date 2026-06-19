import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { fleetService } from "./service";
import {
  createMacchinaInput,
  deleteMacchinaInput,
  listInterventiInput,
  createInterventoInput,
  updateStatoInterventoInput,
} from "./validators";

/**
 * FLEET (Officina) — Router
 * Mantiene la struttura nidificata esistente (officina.macchine.*, officina.interventi.*)
 * per non rompere il frontend, e aggiunge officina.dashboard per i KPI premium.
 */
export const officinaRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return fleetService.dashboard(actor.companyId);
  }),
  macchine: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return fleetService.listMacchine(actor.companyId);
    }),
    create: protectedProcedure.input(createMacchinaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.createMacchina(actor, input);
    }),
    delete: protectedProcedure.input(deleteMacchinaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeMacchina(actor, input.id);
    }),
  }),
  interventi: router({
    list: protectedProcedure.input(listInterventiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.listInterventi(actor.companyId, input?.macchinaId);
    }),
    create: protectedProcedure.input(createInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.createIntervento(actor, input);
    }),
    updateStato: protectedProcedure.input(updateStatoInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateStatoIntervento(actor, input.id, input.stato);
    }),
  }),
});
