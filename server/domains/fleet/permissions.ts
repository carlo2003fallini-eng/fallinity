import { TRPCError } from "@trpc/server";
import { moduleMatches } from "../../../shared/access";
import { protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import { accessService } from "../access/service";
import { accessRepository } from "../access/repository";

export function fleetPermissions(profile: { isCompanyAdmin: boolean; roleCode: string; modules: readonly string[] }, editableModules: readonly string[]) {
  const matches = (modules: readonly string[], required: string) => modules.some((m) => moduleMatches(m as any, required));
  return {
    canView: profile.isCompanyAdmin || matches(profile.modules, "azienda.officina"),
    canEdit: profile.isCompanyAdmin || (profile.roleCode !== "viewer" && matches(editableModules, "azienda.officina")),
    canSeeCosts: profile.isCompanyAdmin || ["finanza.movimenti", "finanza.kpi", "finanza.report"].some((m) => matches(profile.modules, m)),
  };
}

/** Anche chiamando direttamente tRPC, i costi riservati non arrivano al dispositivo. */
export function withoutCosts<T>(value: T): T {
  if (value instanceof Date || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(withoutCosts) as T;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
    /^(costo|prezzo|importo|valoreMagazzino)/i.test(key) || key === "totale" ? null : withoutCosts(v),
  ])) as T;
}

export const fleetProcedure = protectedProcedure.use(async ({ ctx, type, next }) => {
  const actor = await getActor(ctx);
  const [profile, permissions] = await Promise.all([
    accessService.profile(actor, ctx.user!), accessRepository.getPermissions(actor.companyId, actor.userId),
  ]);
  const fleetAccess = fleetPermissions(profile, permissions.filter((p) => p.canEdit).map((p) => p.moduleKey));
  if (!fleetAccess.canView || (type === "mutation" && !fleetAccess.canEdit)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Non hai i permessi necessari per questa operazione Officina." });
  }
  const result = await next({ ctx: { ...ctx, fleetAccess } });
  return result.ok && !fleetAccess.canSeeCosts ? { ...result, data: withoutCosts(result.data) } : result;
});
