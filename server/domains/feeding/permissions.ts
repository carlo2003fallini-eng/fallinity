import { TRPCError } from "@trpc/server";
import { moduleMatches } from "../../../shared/access";
import { protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import { accessService } from "../access/service";
import { accessRepository } from "../access/repository";
import type { FeedingPermissions } from "../../../shared/feeding/types";
export function feedingPermissions(
  profile: {
    isCompanyAdmin: boolean;
    roleCode: string;
    modules: readonly string[];
  },
  edits: readonly string[],
  companyId = "",
  userId = 0
): FeedingPermissions {
  const match = (items: readonly string[], key: string) =>
    items.some(m => moduleMatches(m as any, key));
  const view = ["azienda.stalla.alimentazione", "azienda.alimentazione"].some(
    k => match(profile.modules, k)
  );
  const edit = ["azienda.stalla.alimentazione", "azienda.alimentazione"].some(
    k => match(edits, k)
  );
  const operator = ["operator", "operatore"].includes(profile.roleCode);
  return {
    companyId,
    userId,
    canView: profile.isCompanyAdmin || view,
    canOperate:
      profile.isCompanyAdmin || (edit && profile.roleCode !== "viewer"),
    canManage:
      profile.isCompanyAdmin ||
      (edit && !operator && profile.roleCode !== "viewer"),
    canNir:
      profile.isCompanyAdmin ||
      (edit && !operator && profile.roleCode !== "viewer"),
    canSeeCosts:
      profile.isCompanyAdmin ||
      ["finanza.movimenti", "finanza.kpi", "finanza.report"].some(k =>
        match(profile.modules, k)
      ),
  };
}
export function stripFeedingCosts<T>(value: T): T {
  if (value == null || typeof value !== "object" || value instanceof Date)
    return value;
  if (Array.isArray(value)) return value.map(stripFeedingCosts) as T;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      (/cost|costo|prezzo|price|revenue|ricavo|iofc|economic|valore|importo|profit|spesa/i.test(
        k
      ) ||
        k === "ai") &&
      !/^canSeeCosts$/.test(k)
        ? null
        : stripFeedingCosts(v),
    ])
  ) as T;
}
export const feedingProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const actor = await getActor(ctx);
    const [profile, perms] = await Promise.all([
      accessService.profile(actor, ctx.user!),
      accessRepository.getPermissions(actor.companyId, actor.userId),
    ]);
    const feedingAccess = feedingPermissions(
      profile,
      perms.filter(p => p.canEdit).map(p => p.moduleKey),
      actor.companyId,
      actor.userId
    );
    feedingAccess.userUuid = actor.userUuid;
    if (!feedingAccess.canView)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Non hai accesso all’Alimentazione dell’azienda attiva.",
      });
    const result = await next({ ctx: { ...ctx, actor, feedingAccess } });
    return result.ok && !feedingAccess.canSeeCosts
      ? { ...result, data: stripFeedingCosts(result.data) }
      : result;
  }
);
export function requireFeeding(
  p: FeedingPermissions,
  key: "canOperate" | "canManage" | "canNir" | "canSeeCosts"
) {
  if (!p[key])
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Non hai il permesso richiesto per questa operazione Alimentazione.",
    });
}
