import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// ─── DOMINI (architettura a domini: router/service/repository/validators) ──────
import { companyRouter, aziendaRouter, dashboardRouter } from "./domains/core/router";
import { finanzaRouter } from "./domains/finance/router";
import { campiRouter } from "./domains/crop/router";
import { magazzinoRouter } from "./domains/inventory/router";
import { officinaRouter } from "./domains/fleet/router";
import { stallaRouter } from "./domains/livestock/router";
import { reintegrazioneRouter } from "./domains/reinvestment/router";
import { calendarioRouter } from "./domains/calendar/router";
import { reportRouter } from "./domains/report/router";
import { aiRouter } from "./domains/ai/router";
import { scenarioRouter } from "./domains/scenario/router";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * FALLINITY FEOS — APP ROUTER (orchestratore)
 * ──────────────────────────────────────────────────────────────────────────────
 * Questo file è volutamente sottile: compone i router di dominio. La logica vive
 * in server/domains/<dominio>/ secondo il pattern router → service → repository,
 * con i validators (zod) come contratti di input.
 *
 * auth resta inline perché manipola direttamente i cookie di sessione gestiti dal
 * framework (_core), non è un dominio di business.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  company: companyRouter,
  azienda: aziendaRouter,
  dashboard: dashboardRouter,
  finanza: finanzaRouter,
  campi: campiRouter,
  magazzino: magazzinoRouter,
  officina: officinaRouter,
  stalla: stallaRouter,
  reintegrazione: reintegrazioneRouter,
  calendario: calendarioRouter,
  report: reportRouter,
  ai: aiRouter,
  scenario: scenarioRouter,
});

export type AppRouter = typeof appRouter;
