import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import * as service from "./service";
import {
  createLegalProfileInput,
  updateLegalProfileInput,
  createQualificationInput,
  updateQualificationInput,
  createTaxProfileInput,
  updateTaxProfileInput,
  createOpeningBalanceInput,
  createVatConfigInput,
  updateVatConfigInput,
  createVatEntryInput,
  vatPeriodActionInput,
  createCompanyWizardInput,
  vatEntriesFilterInput,
} from "./validators";

// ──────────────────────────────────────────────────────────────────────────────
// FISCAL DOMAIN — Router
// ──────────────────────────────────────────────────────────────────────────────

export const fiscalRouter = router({
  // ─── Summary ─────────────────────────────────────────────────────────────────
  summary: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getFiscalSummary(actor.companyId);
  }),

  // ─── Legal Profile ───────────────────────────────────────────────────────────
  legalProfiles: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getLegalProfiles(actor.companyId);
  }),

  activeLegalProfile: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getActiveLegalProfile(actor.companyId);
  }),

  createLegalProfile: protectedProcedure
    .input(createLegalProfileInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createLegalProfile(actor, input);
    }),

  updateLegalProfile: protectedProcedure
    .input(updateLegalProfileInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.updateLegalProfile(actor, input);
    }),

  // ─── Qualifications ────────────────────────────────────────────────────────
  qualifications: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getQualifications(actor.companyId);
  }),

  activeQualifications: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getActiveQualifications(actor.companyId);
  }),

  createQualification: protectedProcedure
    .input(createQualificationInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createQualification(actor, input);
    }),

  updateQualification: protectedProcedure
    .input(updateQualificationInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.updateQualification(actor, input);
    }),

  // ─── Tax Profiles ──────────────────────────────────────────────────────────
  taxProfiles: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getTaxProfiles(actor.companyId);
  }),

  activeTaxProfile: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getActiveTaxProfile(actor.companyId);
  }),

  createTaxProfile: protectedProcedure
    .input(createTaxProfileInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createTaxProfile(actor, input);
    }),

  updateTaxProfile: protectedProcedure
    .input(updateTaxProfileInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.updateTaxProfile(actor, input);
    }),

  // ─── Opening Balances ──────────────────────────────────────────────────────
  openingBalances: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getOpeningBalances(actor.companyId);
  }),

  latestOpeningBalance: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getLatestOpeningBalance(actor.companyId);
  }),

  createOpeningBalance: protectedProcedure
    .input(createOpeningBalanceInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createOpeningBalance(actor, input);
    }),

  // ─── VAT Configuration ─────────────────────────────────────────────────────
  vatConfigs: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getVatConfigs(actor.companyId);
  }),

  activeVatConfigs: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getActiveVatConfigs(actor.companyId);
  }),

  createVatConfig: protectedProcedure
    .input(createVatConfigInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createVatConfig(actor, input);
    }),

  updateVatConfig: protectedProcedure
    .input(updateVatConfigInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.updateVatConfig(actor, input);
    }),

  // ─── VAT Entries ───────────────────────────────────────────────────────────
  vatEntries: protectedProcedure
    .input(vatEntriesFilterInput.optional())
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.getVatEntries(actor.companyId, input ?? undefined);
    }),

  createVatEntry: protectedProcedure
    .input(createVatEntryInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createVatEntry(actor, input);
    }),

  // ─── VAT Periods ──────────────────────────────────────────────────────────
  vatPeriods: protectedProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.getVatPeriods(actor.companyId, input?.year);
    }),

  vatPeriodAction: protectedProcedure
    .input(vatPeriodActionInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.vatPeriodAction(actor, input);
    }),

  // ─── VAT Position ─────────────────────────────────────────────────────────
  vatPosition: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.calculateVatPosition(actor.companyId);
  }),

  // ─── VAT Alerts ───────────────────────────────────────────────────────────
  vatAlerts: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return service.getVatAlerts(actor.companyId);
  }),

  // ─── Wizard ────────────────────────────────────────────────────────────────
  createCompanyWizard: protectedProcedure
    .input(createCompanyWizardInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return service.createCompanyWithWizard(actor, input);
    }),
});
