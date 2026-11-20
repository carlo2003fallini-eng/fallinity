import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  gruppi,
  prodotti,
  feedingRecipes,
  feedingSettings,
  feedingContainers,
  feedingRuns,
  datiStallaRilevazioni,
} from "../../../drizzle/schema";
import { withCreate, withUpdate, newId, type ActorContext } from "../_core";
import { loadFeedingData, effectiveRecipe, isFeedProduct } from "./data";
import type {
  FeedRecipe,
  FeedRun,
  FeedSetting,
  FeedContainer,
  MilkRecord,
  RecipeInput,
} from "../../../shared/feeding/types";
export { loadFeedingData } from "./data";
export const scope = (t: any, a: ActorContext, id?: string) =>
  and(
    eq(t.companyId, a.companyId),
    isNull(t.deletedAt),
    id ? eq(t.id, id) : undefined
  );
export function confirmed(v: unknown) {
  if (v !== true)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "La registrazione richiede conferma esplicita.",
    });
}
export async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Database non disponibile",
    });
  return db;
}
export async function realGroup(a: ActorContext, id: string, db?: any) {
  db ??= await database();
  const [g] = await db
    .select()
    .from(gruppi)
    .where(scope(gruppi, a, id));
  if (!g || g.stato !== "attivo")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Gruppo non disponibile nell’azienda attiva",
    });
  return g;
}
export const feedingService = {
  async saveRecipe(a: ActorContext, input: RecipeInput) {
    confirmed(input.confirm);
    const db = await database();
    return db.transaction(async tx => {
      await tx.execute(
        sql`SELECT id FROM gruppi WHERE id=${input.groupId} AND companyId=${a.companyId} FOR UPDATE`
      );
      await realGroup(a, input.groupId, tx);
      const rs = await tx
        .select()
        .from(feedingRecipes)
        .where(
          and(
            scope(feedingRecipes, a),
            eq(feedingRecipes.groupId, input.groupId)
          )
        );
      const old = input.recipeId ? rs.find(r => r.id === input.recipeId) : null;
      if (input.recipeId && !old)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ricetta non trovata",
        });
      if (
        new Set(input.ingredients.map(i => i.productId)).size !==
        input.ingredients.length
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Uno stesso alimento può apparire una sola volta nella ricetta",
        });
      for (const i of input.ingredients) {
        const [p] = await tx
          .select()
          .from(prodotti)
          .where(scope(prodotti, a, i.productId));
        if (
          !p ||
          (!isFeedProduct(p) &&
            !old?.payload.ingredients.some(j => j.productId === p.id))
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Seleziona esclusivamente alimenti del Magazzino aziendale",
          });
      }
      const id = newId();
      const rootId = old?.rootId ?? id;
      const version =
        Math.max(
          0,
          ...rs.filter(r => r.rootId === rootId).map(r => r.version)
        ) + 1;
      const at = Date.now();
      const payload: FeedRecipe = {
        id,
        rootId,
        groupId: input.groupId,
        nome: input.nome,
        version,
        status: "salvata",
        validFrom: null,
        createdAt: at,
        updatedAt: at,
        responsible: input.responsible ?? null,
        ingredients: input.ingredients
          .map(i => ({ ...i }))
          .sort((a, b) => a.order - b.order),
        note: input.note ?? null,
      };
      await tx
        .insert(feedingRecipes)
        .values(
          withCreate(a, {
            id,
            groupId: input.groupId,
            rootId,
            version,
            status: "salvata",
            validFrom: null,
            payload,
          })
        );
      return { id };
    });
  },
  async activateRecipe(
    a: ActorContext,
    input: { id: string; validFrom?: number; confirm: boolean }
  ) {
    confirmed(input.confirm);
    const db = await database();
    return db.transaction(async tx => {
      const [r] = await tx
        .select()
        .from(feedingRecipes)
        .where(scope(feedingRecipes, a, input.id));
      if (!r || r.status === "archiviata")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ricetta non attivabile",
        });
      await tx.execute(
        sql`SELECT id FROM gruppi WHERE id=${r.groupId} AND companyId=${a.companyId} FOR UPDATE`
      );
      await realGroup(a, r.groupId, tx);
      const when = input.validFrom ?? Date.now();
      const status = when > Date.now() ? "programmata" : "attiva";
      const payload = {
        ...r.payload,
        status,
        validFrom: when,
        updatedAt: Date.now(),
      } as FeedRecipe;
      await tx
        .update(feedingRecipes)
        .set(withUpdate(a, { status, validFrom: when, payload }))
        .where(scope(feedingRecipes, a, r.id));
      return { id: r.id };
    });
  },
  async archiveRecipe(
    a: ActorContext,
    input: { id: string; confirm: boolean }
  ) {
    confirmed(input.confirm);
    const db = await database();
    const [r] = await db
      .select()
      .from(feedingRecipes)
      .where(scope(feedingRecipes, a, input.id));
    if (!r)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ricetta non trovata",
      });
    await db
      .update(feedingRecipes)
      .set(
        withUpdate(a, {
          status: "archiviata",
          payload: {
            ...r.payload,
            status: "archiviata",
            updatedAt: Date.now(),
          },
        })
      )
      .where(scope(feedingRecipes, a, r.id));
    return { id: r.id };
  },
  async savePreferences(
    a: ActorContext,
    input: {
      scopeType: "azienda" | "gruppo" | "operatore";
      scopeId?: string;
      value: Record<string, unknown>;
      confirm: boolean;
    }
  ) {
    confirmed(input.confirm);
    const db = await database();
    const scopeId =
      input.scopeType === "operatore"
        ? String(a.userId)
        : input.scopeType === "azienda"
          ? a.companyId
          : input.scopeId;
    if (!scopeId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Seleziona il gruppo della configurazione",
      });
    if (
      input.value.runsPerDay !== undefined &&
      (typeof input.value.runsPerDay !== "number" ||
        !Number.isFinite(input.value.runsPerDay) ||
        input.value.runsPerDay < 0.1 ||
        input.value.runsPerDay > 12)
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Frequenza non valida",
      });
    if (input.scopeType === "gruppo") await realGroup(a, scopeId);
    const prev = await db
      .select()
      .from(feedingSettings)
      .where(
        and(
          scope(feedingSettings, a),
          eq(feedingSettings.scopeType, input.scopeType),
          eq(feedingSettings.scopeId, scopeId)
        )
      );
    const id = prev[0]?.id ?? newId();
    const payload: FeedSetting = {
      id,
      scopeType: input.scopeType,
      scopeId,
      value: { ...prev[0]?.payload.value, ...input.value },
    };
    await db
      .insert(feedingSettings)
      .values(
        withCreate(a, { id, scopeType: input.scopeType, scopeId, payload })
      )
      .onDuplicateKeyUpdate({ set: withUpdate(a, { payload }) });
    return { id };
  },
  async configureFrequency(
    a: ActorContext,
    input: { groupId: string; runsPerDay: number; confirm: boolean }
  ) {
    return this.savePreferences(a, {
      scopeType: "gruppo",
      scopeId: input.groupId,
      value: { runsPerDay: input.runsPerDay },
      confirm: input.confirm,
    });
  },
  async saveContainer(
    a: ActorContext,
    input: {
      id?: string;
      nome: string;
      kg: number;
      groupId?: string | null;
      recipeId?: string | null;
      confirm: boolean;
    },
    canManage = true
  ) {
    confirmed(input.confirm);
    const db = await database();
    if (input.groupId) await realGroup(a, input.groupId);
    if (input.recipeId) {
      const [r] = await db
        .select()
        .from(feedingRecipes)
        .where(scope(feedingRecipes, a, input.recipeId));
      if (!r || (input.groupId && r.groupId !== input.groupId))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ricetta della calibrazione non disponibile",
        });
    }
    let id = input.id ?? newId();
    if (input.id) {
      const [c] = await db
        .select()
        .from(feedingContainers)
        .where(scope(feedingContainers, a, id));
      if (!c)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contenitore non trovato",
        });
      if (!canManage && c.payload.operatorId !== a.userUuid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Puoi modificare soltanto le tue calibrazioni",
        });
    }
    const payload: FeedContainer = {
      id,
      nome: input.nome,
      kg: input.kg,
      groupId: input.groupId ?? null,
      recipeId: input.recipeId ?? null,
      calibratedAt: Date.now(),
      operatorId: a.userUuid,
    };
    if (input.id)
      await db
        .update(feedingContainers)
        .set(withUpdate(a, { payload }))
        .where(scope(feedingContainers, a, id));
    else
      await db.insert(feedingContainers).values(withCreate(a, { id, payload }));
    return { id };
  },
  async saveDraft(
    a: ActorContext,
    input: {
      groupId: string;
      recipeId: string;
      draft: unknown;
      confirm: boolean;
    }
  ) {
    confirmed(input.confirm);
    const db = await database();
    await realGroup(a, input.groupId);
    const [r] = await db
      .select()
      .from(feedingRecipes)
      .where(scope(feedingRecipes, a, input.recipeId));
    if (!r || r.groupId !== input.groupId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ricetta non disponibile",
      });
    const id = newId();
    const payload: FeedRun = {
      id,
      groupId: r.groupId,
      recipeId: r.id,
      at: Date.now(),
      operatorId: a.userUuid,
      headCount: 0,
      animalIds: [],
      state: "preparazione",
      expectedKg: 0,
      freshKg: 0,
      reusedKg: 0,
      totalKg: 0,
      totalCostCents: null,
      ingredients: [],
      recipeSnapshot: r.payload,
      leftoverId: null,
      remainingKg: 0,
      note: null,
      draft: input.draft,
    };
    await db
      .insert(feedingRuns)
      .values(
        withCreate(a, {
          id,
          groupId: r.groupId,
          recipeId: r.id,
          requestKey: `draft:${id}`,
          state: "preparazione",
          at: payload.at,
          payload,
        })
      );
    return { id };
  },
  async saveMilkRecord(
    a: ActorContext,
    input: {
      groupId: string;
      at: number;
      milkKg: number;
      fat?: number | null;
      protein?: number | null;
      pricePerKg?: number | null;
      priceSource?: string;
      priceLineId?: string;
      priceDocumentId?: string;
      source?: string;
      confirm: boolean;
    }
  ) {
    confirmed(input.confirm);
    await realGroup(a, input.groupId);
    const { livestockService } = await import("../livestock/service");
    const g = await livestockService.getGruppoDetail(
      a.companyId,
      input.groupId
    );
    if (!g || g.stats.inLattazione === 0)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Registra produzione latte solo per un gruppo con animali in lattazione",
      });
    const db = await database();
    const id = newId();
    const payload: MilkRecord = {
      id,
      groupId: input.groupId,
      at: input.at,
      milkKg: input.milkKg,
      headCount: g.stats.inLattazione,
      fat: input.fat ?? null,
      protein: input.protein ?? null,
      pricePerKg: input.pricePerKg ?? null,
      priceSource:
        input.pricePerKg == null
          ? "Prezzo latte non disponibile"
          : (input.priceSource ??
            "Valore documentato manualmente — da verificare in Finanza"),
      priceLineId: input.priceLineId ?? null,
      priceDocumentId: input.priceDocumentId ?? null,
      source: input.source ?? "Rilevazione Dati stalla",
      operatorId: a.userUuid,
    };
    await db
      .insert(datiStallaRilevazioni)
      .values(
        withCreate(a, { id, groupId: input.groupId, at: input.at, payload })
      );
    return { id };
  },
};
