import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { calendarService } from "./service";
import {
  listEventiInput,
  createEventoInput,
  toggleCompletatoInput,
  deleteEventoInput,
} from "./validators";

/** CALENDAR (Calendario) — Router */
export const calendarioRouter = router({
  list: protectedProcedure.input(listEventiInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return calendarService.list(actor.companyId, input?.anno, input?.mese);
  }),
  today: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return calendarService.today(actor.companyId);
  }),
  create: protectedProcedure.input(createEventoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return calendarService.create(actor, input);
  }),
  toggleCompletato: protectedProcedure.input(toggleCompletatoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return calendarService.toggleCompletato(actor, input.id, input.completato);
  }),
  delete: protectedProcedure.input(deleteEventoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return calendarService.remove(actor, input.id);
  }),
});
