import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { livestockService } from "./service";
import {
  addAnimaleInput, updateAnimaleInput, spostaGruppoInput,
  ricercaAnimaliInput, getAnimaleInput,
  createGruppoInput, updateGruppoInput, archiveGruppoInput,
  addZoppiaInput, eseguiTrattamentoInput, addEventoAnimaleInput,
  filtriGruppiInput, filtriAnimaliInput, spostaMultiploInput, anteprimaFattoriInput,
  createTrattamentoInput, getGruppoInput, disponibiliPerAggiuntaInput,
  anteprimaAggiuntaMultiplaInput, aggiungiMultiploInput,
  replaceGruppiPersonalizzatiInput, listMovimentiGruppoInput,
} from "./validators";

/** LIVESTOCK (Stalla) — Router */
export const stallaRouter = router({
  // ── Legacy (retrocompatibilità) ──
  list: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.list(actor.companyId);
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.stats(actor.companyId);
  }),
  zoppie: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return livestockService.zoppie(actor.companyId);
  }),
  add: protectedProcedure.input(addAnimaleInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.addAnimale(actor, input);
  }),
  addZoppia: protectedProcedure.input(addZoppiaInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.addZoppia(actor, input);
  }),
  eseguiTrattamento: protectedProcedure.input(eseguiTrattamentoInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.eseguiTrattamento(actor, input.animaleId);
  }),

  // ── Gruppi ──
  gruppi: router({
    list: protectedProcedure.input(filtriGruppiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.listGruppi(actor.companyId, input ?? undefined);
    }),
    detail: protectedProcedure.input(getGruppoInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.getGruppoDetail(actor.companyId, input.id);
    }),
    create: protectedProcedure.input(createGruppoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.createGruppo(actor, input);
    }),
    update: protectedProcedure.input(updateGruppoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.updateGruppo(actor, input);
    }),
    archive: protectedProcedure.input(archiveGruppoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.archiveGruppo(actor, input.id);
    }),
    movimenti: protectedProcedure.input(listMovimentiGruppoInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.listMovimentiGruppo(actor.companyId, input.id, input.limit);
    }),
  }),

  // ── Animali ──
  animali: router({
    list: protectedProcedure.input(filtriAnimaliInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.listAnimaliFiltrati(actor.companyId, input ?? undefined);
    }),
    create: protectedProcedure.input(addAnimaleInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.createAnimale(actor, input);
    }),
    update: protectedProcedure.input(updateAnimaleInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.updateAnimale(actor, input);
    }),
    spostaGruppo: protectedProcedure.input(spostaGruppoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.spostaGruppo(actor, input);
    }),
    spostaMultiplo: protectedProcedure.input(spostaMultiploInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.spostaMultiplo(actor, input);
    }),
    disponibiliPerAggiunta: protectedProcedure.input(disponibiliPerAggiuntaInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.disponibiliPerAggiunta(actor.companyId, input);
    }),
    anteprimaAggiuntaMultipla: protectedProcedure.input(anteprimaAggiuntaMultiplaInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.anteprimaAggiuntaMultipla(actor.companyId, input);
    }),
    aggiungiMultiplo: protectedProcedure.input(aggiungiMultiploInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.aggiungiMultiplo(actor, input);
    }),
    replaceGruppiPersonalizzati: protectedProcedure.input(replaceGruppiPersonalizzatiInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.replaceGruppiPersonalizzati(actor, input);
    }),
    scheda: protectedProcedure.input(getAnimaleInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.schedaAnimale(actor.companyId, input.id);
    }),
  }),

  // ── Ricerca universale ──
  ricerca: protectedProcedure.input(ricercaAnimaliInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.ricerca(actor.companyId, input.query);
  }),

  // ── Anteprima fattori ──
  anteprimaFattori: protectedProcedure.input(anteprimaFattoriInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.anteprimaFattori(actor.companyId, input);
  }),

  // ── Trattamenti ──
  trattamenti: router({
    create: protectedProcedure.input(createTrattamentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.createTrattamento(actor, input);
    }),
    list: protectedProcedure.input(getAnimaleInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return livestockService.listTrattamenti(actor.companyId, input.id);
    }),
  }),

  // ── Eventi ──
  addEvento: protectedProcedure.input(addEventoAnimaleInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return livestockService.addEvento(actor, input);
  }),
});
