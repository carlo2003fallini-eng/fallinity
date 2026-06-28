import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { fleetService } from "./service";
import {
  createMacchinaInput,
  updateMacchinaInput,
  deleteMacchinaInput,
  macchinaDetailInput,
  addDocumentoInput,
  deleteDocumentoInput,
  listInterventiInput,
  createInterventoInput,
  updateStatoInterventoInput,
  completaInterventoInput,
  deleteInterventoInput,
  listRicambiInput,
  createRicambioInput,
  updateRicambioInput,
  deleteRicambioInput,
  adjustRicambioInput,
} from "./validators";
import { z } from "zod";

/**
 * FLEET (Officina) — Router
 * Struttura nidificata: officina.dashboard, officina.macchine.*, officina.interventi.*,
 * officina.ricambi.*. Mantiene compatibilità con le procedure usate dal frontend.
 */
export const officinaRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return fleetService.dashboard(actor.companyId);
  }),

  preparaOrdine: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return fleetService.preparaOrdine(actor.companyId);
  }),

  macchine: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return fleetService.listMacchine(actor.companyId);
    }),
    detail: protectedProcedure.input(macchinaDetailInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.macchinaDetail(actor.companyId, input.id);
    }),
    create: protectedProcedure.input(createMacchinaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.createMacchina(actor, input);
    }),
    update: protectedProcedure.input(updateMacchinaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateMacchina(actor, input);
    }),
    delete: protectedProcedure.input(deleteMacchinaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeMacchina(actor, input.id);
    }),
    addDocumento: protectedProcedure.input(addDocumentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.addDocumento(actor, input);
    }),
    deleteDocumento: protectedProcedure.input(deleteDocumentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeDocumento(actor, input.id);
    }),
  }),

  interventi: router({
    list: protectedProcedure.input(listInterventiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.listInterventi(actor.companyId, input);
    }),
    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.interventoDetail(actor.companyId, input.id);
    }),
    create: protectedProcedure.input(createInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.createIntervento(actor, input);
    }),
    updateStato: protectedProcedure.input(updateStatoInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateStatoIntervento(actor, input.id, input.stato);
    }),
    completa: protectedProcedure.input(completaInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.completaIntervento(actor, input);
    }),
    delete: protectedProcedure.input(deleteInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeIntervento(actor, input.id);
    }),
  }),

  ricambi: router({
    list: protectedProcedure.input(listRicambiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.listRicambi(actor.companyId, input);
    }),
    create: protectedProcedure.input(createRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.createRicambio(actor, input);
    }),
    update: protectedProcedure.input(updateRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateRicambio(actor, input);
    }),
    adjust: protectedProcedure.input(adjustRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.adjustRicambio(actor, input.id, input.delta);
    }),
    delete: protectedProcedure.input(deleteRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeRicambio(actor, input.id);
    }),
  }),
});
