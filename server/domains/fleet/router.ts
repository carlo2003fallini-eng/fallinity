import { fleetProcedure as protectedProcedure } from "./permissions";
import { router } from "../../_core/trpc";
import { getActor } from "../_core";
import { fleetService } from "./service";
import { operatorService } from "./operator";
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
  setStatoOrdineRicambioInput,
  confermaPrelievoInput,
} from "./validators";
import { z } from "zod";

/**
 * FLEET (Officina) — Router
 * Struttura nidificata: officina.dashboard, officina.macchine.*, officina.interventi.*,
 * officina.ricambi.*. Mantiene compatibilità con le procedure usate dal frontend.
 */
export const officinaRouter = router({
  permessi: protectedProcedure.query(({ ctx }) => ctx.fleetAccess),
  operatore: router({
    catalogo: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return operatorService.catalogo(actor.companyId);
    }),
    confermaPrelievo: protectedProcedure.input(confermaPrelievoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return operatorService.confermaPrelievo(actor, input);
    }),
  }),
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
      return fleetService.createIntervento(actor, ctx.fleetAccess.canSeeCosts ? input : { ...input, costoOrario: undefined, costoPrevisto: undefined });
    }),
    updateStato: protectedProcedure.input(updateStatoInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateStatoIntervento(actor, input.id, input.stato);
    }),
    completa: protectedProcedure.input(completaInterventoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.completaIntervento(actor, ctx.fleetAccess.canSeeCosts ? input : { ...input, costoOrario: undefined, ricambiUtilizzati: input.ricambiUtilizzati.map((r) => ({ ...r, costoUnitario: undefined })) });
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
      return fleetService.createRicambio(actor, ctx.fleetAccess.canSeeCosts ? input : { ...input, costoMedio: undefined });
    }),
    update: protectedProcedure.input(updateRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.updateRicambio(actor, ctx.fleetAccess.canSeeCosts ? input : { ...input, costoMedio: undefined });
    }),
    adjust: protectedProcedure.input(adjustRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.adjustRicambio(actor, input.id, input.delta);
    }),
    setStatoOrdine: protectedProcedure.input(setStatoOrdineRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.setStatoOrdineRicambio(actor, input.id, input.statoOrdine);
    }),
    delete: protectedProcedure.input(deleteRicambioInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return fleetService.removeRicambio(actor, input.id);
    }),
  }),
});
