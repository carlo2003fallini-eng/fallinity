import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { financeService } from "./service";
import {
  listTransazioniInput,
  createTransazioneInput,
  deleteTransazioneInput,
  createCategoriaInput,
  updateCategoriaInput,
  listCategorieInput,
  createCentroCostoInput,
  updateCentroCostoInput,
  createSoggettoInput,
  updateSoggettoInput,
  listSoggettiInput,
  createContoInput,
  updateContoInput,
  createMetodoInput,
  updateMetodoInput,
  createMovimentoInput,
  listMovimentiInput,
  annullaMovimentoInput,
  deleteMovimentoInput,
  seedInput,
  registraPagamentoInput,
  annullaPagamentoInput,
  creaRateInput,
  creaScadenzePersonalizzateInput,
  creaRicorrenzaInput,
  listScadenzeInput,
  listRicorrenzeInput,
} from "./validators";
import { z } from "zod";

/**
 * FINANCE — Router
 * Strato sottile: valida input, ricava l'attore, delega al service.
 */
export const finanzaRouter = router({
  // ── Legacy (dashboard) ──
  list: protectedProcedure.input(listTransazioniInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.list(actor.companyId, input?.tipo);
  }),
  summary: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.summary(actor.companyId);
  }),
  byCategoria: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.byCategoria(actor.companyId);
  }),
  create: protectedProcedure.input(createTransazioneInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.create(actor, input);
  }),
  delete: protectedProcedure.input(deleteTransazioneInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return financeService.remove(actor, input.id);
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // NUOVA FINANZA
  // ══════════════════════════════════════════════════════════════════════════

  // ── Categorie ──
  categorie: router({
    list: protectedProcedure.input(listCategorieInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listCategorie(actor.companyId, input?.tipo);
    }),
    create: protectedProcedure.input(createCategoriaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.createCategoria(actor, input);
    }),
    update: protectedProcedure.input(updateCategoriaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      const { id, ...data } = input;
      return financeService.updateCategoria(actor, id, data);
    }),
  }),

  // ── Centri di costo ──
  centriCosto: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return financeService.listCentriCosto(actor.companyId);
    }),
    create: protectedProcedure.input(createCentroCostoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.createCentroCosto(actor, input);
    }),
    update: protectedProcedure.input(updateCentroCostoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      const { id, ...data } = input;
      return financeService.updateCentroCosto(actor, id, data);
    }),
  }),

  // ── Soggetti ──
  soggetti: router({
    list: protectedProcedure.input(listSoggettiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listSoggetti(actor.companyId, input?.tipologia, input?.search);
    }),
    create: protectedProcedure.input(createSoggettoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.createSoggetto(actor, input);
    }),
    update: protectedProcedure.input(updateSoggettoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      const { id, ...data } = input;
      return financeService.updateSoggetto(actor, id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.deleteSoggetto(actor, input.id);
    }),
  }),

  // ── Conti ──
  conti: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return financeService.listConti(actor.companyId);
    }),
    create: protectedProcedure.input(createContoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.createConto(actor, input);
    }),
    update: protectedProcedure.input(updateContoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      const { id, ...data } = input;
      return financeService.updateConto(actor, id, data);
    }),
  }),

  // ── Metodi di pagamento ──
  metodi: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return financeService.listMetodi(actor.companyId);
    }),
    create: protectedProcedure.input(createMetodoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.createMetodo(actor, input.nome);
    }),
    update: protectedProcedure.input(updateMetodoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      const { id, ...data } = input;
      return financeService.updateMetodo(actor, id, data);
    }),
  }),

  // ── Movimenti (core) ──
  movimenti: router({
    list: protectedProcedure.input(listMovimentiInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listMovimenti(actor.companyId, input as any);
    }),
    create: protectedProcedure.input(createMovimentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.creaMovimento(actor, input);
    }),
    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.dettaglioMovimento(actor.companyId, input.id);
    }),
    annulla: protectedProcedure.input(annullaMovimentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.annullaMovimento(actor, input.id, input.motivo);
    }),
    delete: protectedProcedure.input(deleteMovimentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.deleteMovimento(actor, input.id);
    }),
  }),

  // ── Pagamenti (Fase 2) ──
  pagamenti: router({
    registra: protectedProcedure.input(registraPagamentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.registraPagamento(actor, input);
    }),
    annulla: protectedProcedure.input(annullaPagamentoInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.annullaPagamento(actor, input.id, input.motivo);
    }),
  }),

  // ── Scadenze (Fase 2) ──
  scadenze: router({
    list: protectedProcedure.input(listScadenzeInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listScadenze(actor.companyId, input as any);
    }),
    creaRate: protectedProcedure.input(creaRateInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.creaRate(actor, input);
    }),
    creaPersonalizzate: protectedProcedure.input(creaScadenzePersonalizzateInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.creaScadenzePersonalizzate(actor, input.documentoId, input.scadenze);
    }),
    creaSingola: protectedProcedure.input(z.object({
      documentoId: z.string(),
      importo: z.number().positive(),
      dataScadenza: z.string(),
      note: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.creaScadenza(actor, input.documentoId, input.importo, input.dataScadenza, input.note);
    }),
  }),

  // ── Crediti / Debiti (Fase 2) ──
  crediti: router({
    list: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listCrediti(actor.companyId, input?.limit);
    }),
  }),
  debiti: router({
    list: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listDebiti(actor.companyId, input?.limit);
    }),
  }),
  residui: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.sumResidui(actor.companyId);
  }),

  // ── Ricorrenze (Fase 2) ──
  ricorrenze: router({
    list: protectedProcedure.input(listRicorrenzeInput).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.listRicorrenze(actor.companyId, input?.attiva);
    }),
    create: protectedProcedure.input(creaRicorrenzaInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.creaRicorrenza(actor, input);
    }),
    update: protectedProcedure.input(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.updateRicorrenza(actor, input.id, input.data);
    }),
    disattiva: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.disattivaRicorrenza(actor, input.id);
    }),
    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.deleteRicorrenza(actor, input.id);
    }),
    emetti: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return financeService.emettiDaRicorrenza(actor, input.id);
    }),
  }),

  // ── Seed ──
  seed: protectedProcedure.input(seedInput).mutation(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return financeService.seedDatiIniziali(actor);
  }),
});
