import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import { accessService } from "../access/service";
import { accessRepository } from "../access/repository";
import { moduleMatches } from "../../../shared/access";
import { feedingService, database, scope } from "./service";
import { livestockService } from "../livestock/service";
import {
  datiStallaRilevazioni,
  righeFattureAcquisite,
  acquisizioniFatture,
  documentiFinanziari,
  soggetti,
} from "../../../drizzle/schema";
import { kgFactor } from "../../../shared/feeding/math";
const milkProcedure = protectedProcedure.use(async ({ ctx, next, type }) => {
  const actor = await getActor(ctx);
  const [profile, perms] = await Promise.all([
    accessService.profile(actor, ctx.user!),
    accessRepository.getPermissions(actor.companyId, actor.userId),
  ]);
  const match = (ms: readonly string[], key: string) =>
    ms.some(m => moduleMatches(m as any, key));
  const keys = ["azienda.stalla.dati_latte", "azienda.stalla.alimentazione"];
  const canView =
    profile.isCompanyAdmin || keys.some(k => match(profile.modules, k));
  const canEdit =
    profile.isCompanyAdmin ||
    (profile.roleCode !== "viewer" &&
      keys.some(k =>
        match(
          perms.filter(p => p.canEdit).map(p => p.moduleKey),
          k
        )
      ));
  const canSeeCosts =
    profile.isCompanyAdmin ||
    ["finanza.kpi", "finanza.movimenti", "finanza.report"].some(k =>
      match(profile.modules, k)
    );
  if (!canView || (type === "mutation" && !canEdit))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accesso ai dati produttivi non autorizzato",
    });
  return next({ ctx: { ...ctx, actor, milkAccess: { canEdit, canSeeCosts } } });
});
export async function realMilkPrices(actor: { companyId: string }) {
  const db = await database();
  const lines = await db
    .select({
      line: righeFattureAcquisite,
      invoice: acquisizioniFatture,
      document: documentiFinanziari,
    })
    .from(righeFattureAcquisite)
    .innerJoin(
      acquisizioniFatture,
      and(
        eq(acquisizioniFatture.id, righeFattureAcquisite.acquisizioneId),
        eq(acquisizioniFatture.companyId, actor.companyId)
      )
    )
    .innerJoin(
      documentiFinanziari,
      and(
        eq(documentiFinanziari.id, acquisizioniFatture.documentoFinanziarioId),
        eq(documentiFinanziari.companyId, actor.companyId)
      )
    )
    .where(
      and(
        eq(righeFattureAcquisite.companyId, actor.companyId),
        isNull(righeFattureAcquisite.deletedAt),
        isNull(acquisizioniFatture.deletedAt),
        isNull(documentiFinanziari.deletedAt),
        eq(documentiFinanziari.tipo, "entrata")
      )
    );
  return lines
    .filter(
      v =>
        /\blatte\b/i.test(v.line.descrizione) &&
        v.line.quantita != null &&
        Number(v.line.quantita) > 0 &&
        kgFactor(v.line.unitaMisura) != null
    )
    .map(v => ({
      lineId: v.line.id,
      documentId: v.document.id,
      invoiceId: v.invoice.id,
      at: new Date(v.invoice.dataDocumento!).getTime(),
      pricePerKg:
        Number(v.line.prezzoUnitario) / 100 / kgFactor(v.line.unitaMisura)!,
      source: `Fattura vendita ${v.invoice.numeroDocumento} — riga ${v.line.numeroLinea}`,
    }))
    .sort((a, b) => b.at - a.at);
}
export const produzioneData = milkProcedure
  .input(z.object({ scope: z.string().optional() }).optional())
  .query(async ({ ctx, input }) => {
    if (input?.scope && input.scope !== ctx.actor.companyId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Azienda cambiata" });
    const db = await database();
    const [groups, records, prices] = await Promise.all([
      livestockService.listGruppi(ctx.actor.companyId),
      db
        .select()
        .from(datiStallaRilevazioni)
        .where(scope(datiStallaRilevazioni, ctx.actor)),
      ctx.milkAccess.canSeeCosts
        ? realMilkPrices(ctx.actor)
        : Promise.resolve([]),
    ]);
    return {
      groups: groups
        .filter(g => g.stato === "attivo")
        .map(g => ({
          id: g.id,
          nome: g.nome,
          nAnimali: g.nAnimali,
          inLattazione: g.inLattazione,
        })),
      records: records.map(r => ({
        ...r.payload,
        pricePerKg: ctx.milkAccess.canSeeCosts ? r.payload.pricePerKg : null,
        priceSource: ctx.milkAccess.canSeeCosts
          ? r.payload.priceSource
          : "Prezzo riservato",
      })),
      prices,
      permissions: ctx.milkAccess,
    };
  });
export const salvaProduzione = milkProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      at: z.number().finite().int(),
      milkKg: z.number().finite().min(0).max(1e7),
      fat: z.number().finite().min(0).max(15).nullish(),
      protein: z.number().finite().min(0).max(15).nullish(),
      pricePerKg: z.number().finite().min(0).max(50).nullish(),
      priceSource: z.string().max(1000).optional(),
      priceLineId: z.string().optional(),
      source: z.string().max(1000).optional(),
      confirm: z.literal(true),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.pricePerKg != null && !ctx.milkAccess.canSeeCosts)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Non sei autorizzato ai prezzi latte",
      });
    let price = input.pricePerKg,
      source = input.priceSource,
      priceDocumentId: string | undefined;
    if (input.priceLineId) {
      if (!ctx.milkAccess.canSeeCosts)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prezzi riservati",
        });
      const found = (await realMilkPrices(ctx.actor)).find(
        p => p.lineId === input.priceLineId
      );
      if (!found)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prezzo fattura non presente nell’azienda attiva",
        });
      price = found.pricePerKg;
      source = found.source;
      priceDocumentId = found.documentId;
    }
    return feedingService.saveMilkRecord(ctx.actor, {
      ...input,
      pricePerKg: price,
      priceSource: source,
      priceDocumentId,
    });
  });
