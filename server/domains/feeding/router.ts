import { z } from "zod";
import { router } from "../../_core/trpc";
import { feedingProcedure as p, requireFeeding } from "./permissions";
import { feedingService as s, loadFeedingData } from "./service";
import { feedingOperations as o } from "./operations";
import { feedingAnalytics } from "./analytics";
import * as n from "./nutrition";
import {
  nirParamsSchema,
  comparisonSideSchema,
} from "../../../shared/feeding/math";
const id = z.string().min(1).max(100),
  text = z.string().trim().max(2000),
  at = z.number().finite().int().min(946684800000).max(4102444800000),
  yes = z.literal(true),
  qty = z.number().finite().min(0.001).max(1e9),
  opt = text.nullish();
export const alimentazioneRouter = router({
  data: p
    .input(z.object({ scope: id.optional() }).optional())
    .query(({ ctx, input }) => {
      if (input?.scope && input.scope !== ctx.actor.companyId)
        throw new Error("Azienda cambiata: aggiorna la schermata");
      return loadFeedingData(ctx.actor, ctx.feedingAccess);
    }),
  saveRecipe: p
    .input(
      z.object({
        recipeId: id.optional(),
        groupId: id,
        nome: z.string().trim().min(1).max(255),
        ingredients: z
          .array(
            z.object({
              productId: id,
              kgPerHead: qty,
              order: z.number().int().min(0).max(200),
              note: opt,
            })
          )
          .min(1)
          .max(100),
        responsible: opt,
        note: opt,
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canManage");
      return s.saveRecipe(ctx.actor, input as any);
    }),
  activateRecipe: p
    .input(z.object({ id, validFrom: at.optional(), confirm: yes }))
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canManage");
      return s.activateRecipe(ctx.actor, input);
    }),
  archiveRecipe: p
    .input(z.object({ id, confirm: yes }))
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canManage");
      return s.archiveRecipe(ctx.actor, input);
    }),
  configureFrequency: p
    .input(
      z.object({
        groupId: id,
        runsPerDay: z.number().finite().min(0.1).max(12),
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canManage");
      return s.configureFrequency(ctx.actor, input);
    }),
  savePreferences: p
    .input(
      z.object({
        scopeType: z.enum(["azienda", "gruppo", "operatore"]),
        scopeId: id.optional(),
        value: z.record(z.string(), z.unknown()),
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(
        ctx.feedingAccess,
        input.scopeType === "operatore" ? "canOperate" : "canManage"
      );
      if (JSON.stringify(input.value).length > 12000)
        throw new Error("Configurazione troppo estesa");
      return s.savePreferences(ctx.actor, input);
    }),
  saveContainer: p
    .input(
      z.object({
        id: id.optional(),
        nome: z.string().trim().min(1).max(255),
        kg: qty,
        groupId: id.nullish(),
        recipeId: id.nullish(),
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      return s.saveContainer(ctx.actor, input, ctx.feedingAccess.canManage);
    }),
  saveDraft: p
    .input(
      z.object({ groupId: id, recipeId: id, draft: z.unknown(), confirm: yes })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      if (JSON.stringify(input.draft).length > 30000)
        throw new Error("Bozza troppo estesa");
      return s.saveDraft(ctx.actor, input);
    }),
  confirmLoad: p
    .input(
      z.object({
        key: id,
        draftId: id.optional(),
        groupId: id,
        recipeId: id,
        at,
        ingredients: z
          .array(z.object({ productId: id, actualKg: qty }))
          .min(1)
          .max(100),
        leftoverId: id.nullish(),
        reusedKg: z.number().finite().min(0).max(1e8).optional(),
        compatibleReuse: z.boolean().optional(),
        acknowledgeOverlap: z.boolean().optional(),
        note: opt,
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      return o.confirmLoad(ctx.actor, input);
    }),
  distribute: p
    .input(
      z.object({
        key: id,
        runId: id,
        groupId: id,
        kg: qty,
        at,
        authorizeOtherGroup: z.boolean().optional(),
        note: opt,
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      return o.distribute(ctx.actor, input);
    }),
  registerLeftover: p
    .input(
      z.object({
        key: id,
        distributionId: id,
        at,
        method: z.enum(["nessuno", "kg", "contenitore"]),
        kg: z.number().finite().min(0).max(1e9).optional(),
        containerId: id.nullish(),
        containerCount: qty.optional(),
        destination: z.enum(["rimosso", "scartato", "riutilizzo"]),
        compositionKnown: z.boolean().optional(),
        compatibleReuse: z.boolean().optional(),
        note: opt,
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      return o.registerLeftover(ctx.actor, input);
    }),
  rectifyLoad: p
    .input(
      z.object({
        key: id,
        runId: id,
        reason: z.string().trim().min(5).max(2000),
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canManage");
      return o.rectifyLoad(ctx.actor, input);
    }),
  saveNir: p.input(n.nirInputSchema).mutation(({ ctx, input }) => {
    requireFeeding(ctx.feedingAccess, "canNir");
    return n.saveNir(ctx.actor, input);
  }),
  activateNir: p
    .input(z.object({ id, confirm: yes }))
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canNir");
      return n.activateNir(ctx.actor, input.id);
    }),
  uploadNirDocument: p
    .input(
      z.object({
        productId: id,
        name: z.string().max(255),
        mime: z.enum([
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ]),
        base64: z.string().max(7200000),
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canNir");
      return n.uploadNirDocument(ctx.actor, input);
    }),
  extractNir: p
    .input(
      z.object({ productId: id, documentKey: z.string().min(1).max(1000) })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canNir");
      return n.extractNir(ctx.actor, input);
    }),
  documentNir: p
    .input(z.object({ id }))
    .query(({ ctx, input }) => n.documentNir(ctx.actor, input.id)),
  saveComparison: p
    .input(n.comparisonInputSchema)
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canNir");
      return n.saveComparison(ctx.actor, input);
    }),
  analytics: p
    .input(
      z.object({
        from: at,
        to: at,
        groupId: id.nullish(),
        lactatingOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.from > input.to) throw new Error("Intervallo non valido");
      return feedingAnalytics(
        await loadFeedingData(ctx.actor, ctx.feedingAccess),
        input
      );
    }),
  intelligence: p
    .input(n.intelligenceInputSchema)
    .mutation(({ ctx, input }) =>
      n.intelligence(ctx.actor, input, ctx.feedingAccess)
    ),
  saveMilkRecord: p
    .input(
      z.object({
        groupId: id,
        at,
        milkKg: z.number().finite().min(0).max(1e7),
        fat: z.number().finite().min(0).max(15).nullish(),
        protein: z.number().finite().min(0).max(15).nullish(),
        pricePerKg: z.number().finite().min(0).max(50).nullish(),
        priceSource: opt,
        source: opt,
        confirm: yes,
      })
    )
    .mutation(({ ctx, input }) => {
      requireFeeding(ctx.feedingAccess, "canOperate");
      if (input.pricePerKg != null)
        requireFeeding(ctx.feedingAccess, "canSeeCosts");
      return s.saveMilkRecord(ctx.actor, input as any);
    }),
});
