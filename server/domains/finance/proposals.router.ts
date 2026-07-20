import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { proposalsService } from "./proposals.service";
import {
  listProposalsInput,
  convertToPaymentInput,
  convertToDocumentInput,
  linkProposalInput,
  ignoreProposalInput,
  retryProposalInput,
  updateSettingsInput,
  originStatusInput,
} from "./proposals.validators";
import { z } from "zod";

/**
 * FINANCE — Proposals Router
 * Gestione proposte finanziarie generate dai moduli operativi.
 */
export const proposalsRouter = router({
  // ── Lista proposte con filtri ──
  list: protectedProcedure.input(listProposalsInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.list(actor.companyId, input);
  }),

  // ── Dettaglio proposta ──
  detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.detail(actor.companyId, input.id);
  }),

  // ── Conteggio per stato (per badge/tab) ──
  counts: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return proposalsService.countByStato(actor.companyId);
  }),

  // ── Converti in pagamento immediato ──
  convertToPayment: protectedProcedure.input(convertToPaymentInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.convertToPayment(actor, input);
  }),

  // ── Converti in documento con scadenza ──
  convertToDocument: protectedProcedure.input(convertToDocumentInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.convertToDocument(actor, input);
  }),

  // ── Collega a documento esistente ──
  link: protectedProcedure.input(linkProposalInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.linkToDocument(actor, input);
  }),

  // ── Ignora proposta ──
  ignore: protectedProcedure.input(ignoreProposalInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.ignore(actor, input);
  }),

  // ── Riprova proposta in errore ──
  retry: protectedProcedure.input(retryProposalInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.retry(actor, input.proposalId);
  }),

  // ── Stato finanziario di un'entità (per moduli operativi) ──
  originStatus: protectedProcedure.input(originStatusInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return proposalsService.getOriginStatus(actor.companyId, input);
  }),

  // ── Impostazioni integrazione ──
  settings: {
    list: protectedProcedure.query(async ({ ctx }) => {
      const actor = await getActor(ctx);
      return proposalsService.listSettings(actor.companyId);
    }),
    get: protectedProcedure.input(z.object({ modulo: z.string() })).query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return proposalsService.getSettings(actor.companyId, input.modulo);
    }),
    update: protectedProcedure.input(updateSettingsInput).mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return proposalsService.updateSettings(actor, input);
    }),
  },
});
