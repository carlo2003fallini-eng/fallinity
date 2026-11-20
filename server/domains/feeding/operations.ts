import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "crypto";
import {
  prodotti,
  gruppi,
  movimentiMagazzino,
  feedingRecipes,
  feedingRuns,
  feedingDistributions,
  feedingLeftovers,
  feedingContainers,
  feedingCorrections,
} from "../../../drizzle/schema";
import { withCreate, withUpdate, newId, type ActorContext } from "../_core";
import { database, scope, confirmed, realGroup } from "./service";
import { loadFeedingData, effectiveRecipe } from "./data";
import { livestockService } from "../livestock/service";
import { calculateRecipe, kgFactor } from "../../../shared/feeding/math";
import type {
  LoadInput,
  DistributionInput,
  LeftoverInput,
  FeedRun,
  FeedDistribution,
  FeedLeftover,
  FeedingPermissions,
} from "../../../shared/feeding/types";
const internalAccess = (a: ActorContext): FeedingPermissions => ({
  companyId: a.companyId,
  userId: a.userId,
  canView: true,
  canManage: true,
  canOperate: true,
  canNir: true,
  canSeeCosts: true,
});
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
function replay(payload: any, h: string) {
  if (payload?.requestHash !== h && payload?.draft?.requestHash !== h)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "La chiave di conferma è già stata usata con dati diversi",
    });
}
export const feedingOperations = {
  async confirmLoad(a: ActorContext, input: LoadInput) {
    confirmed(input.confirm);
    const db = await database();
    const h = hash(input);
    return db.transaction(async tx => {
      await tx.execute(
        sql`SELECT id FROM gruppi WHERE id=${input.groupId} AND companyId=${a.companyId} FOR UPDATE`
      );
      await realGroup(a, input.groupId, tx);
      const [prior] = await tx
        .select()
        .from(feedingRuns)
        .where(
          and(scope(feedingRuns, a), eq(feedingRuns.requestKey, input.key))
        )
        .for("update");
      if (prior) {
        replay(prior.payload, h);
        return { id: prior.id, idempotent: true };
      }
      const data = await loadFeedingData(a, internalAccess(a));
      const group = data.groups.find(g => g.id === input.groupId);
      if (!group || group.nAnimali < 1)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Il gruppo non ha animali alimentabili",
        });
      const rs = await tx
        .select()
        .from(feedingRecipes)
        .where(
          and(
            scope(feedingRecipes, a),
            eq(feedingRecipes.groupId, input.groupId)
          )
        )
        .for("update");
      const recipe = effectiveRecipe(
        rs.map(
          r =>
            ({ ...r.payload, status: r.status, validFrom: r.validFrom }) as any
        ),
        input.groupId
      );
      if (!recipe || recipe.id !== input.recipeId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "La ricetta non è più quella attiva: aggiorna e verifica il carico",
        });
      if (group.frequency == null)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Configura prima la frequenza di distribuzione del gruppo",
        });
      if (group.overlaps.length && !input.acknowledgeOverlap)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Verifica e conferma gli animali sovrapposti ai gruppi alimentati",
        });
      const live = await livestockService.getGruppoDetail(
        a.companyId,
        group.id
      );
      if (!live || live.stats.totale < 1)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gruppo senza animali",
        });
      const groupNow = {
        ...group,
        nAnimali: live.stats.totale,
        animalIds: live.membri.map(m => m.id),
      };
      const calc = calculateRecipe(recipe, groupNow, data.products);
      const target = calc.kgPerRun;
      if (target == null || target <= 0)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quantità per carro non calcolabile",
        });
      const last = data.distributions
        .filter(d => d.groupId === group.id && !d.annulled)
        .sort((a, b) => b.at - a.at)[0];
      if (last && !data.leftovers.some(l => l.distributionId === last.id))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Registra o conferma l’assenza dell’avanzo della distribuzione precedente",
        });
      let reused = Number(input.reusedKg ?? 0);
      let reuseCost: number | null = 0;
      let leftover: FeedLeftover | null = null;
      let inherited: FeedRun | null = null;
      if (reused > 0) {
        if (!input.leftoverId || !input.compatibleReuse)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Il riutilizzo dell’avanzo richiede quantità e compatibilità confermate",
          });
        await tx.execute(
          sql`SELECT id FROM feedingLeftovers WHERE id=${input.leftoverId} AND companyId=${a.companyId} FOR UPDATE`
        );
        const [l] = await tx
          .select()
          .from(feedingLeftovers)
          .where(scope(feedingLeftovers, a, input.leftoverId))
          .for("update");
        if (!l)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Avanzo non disponibile",
          });
        leftover = l.payload;
        if (
          leftover.groupId !== group.id ||
          leftover.destination !== "riutilizzo" ||
          !leftover.compositionKnown ||
          reused >
            leftover.kg - leftover.reusedKg - leftover.discardedKg + 0.0001 ||
          reused >= target
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Avanzo insufficiente, incompatibile o non riutilizzabile",
          });
        const distribution = data.distributions.find(
          d => d.id === leftover!.distributionId
        );
        inherited = data.runs.find(r => r.id === distribution?.runId) ?? null;
        if (!inherited || inherited.recipeSnapshot.id !== recipe.id)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "La composizione dell’avanzo non corrisponde alla versione della ricetta: non ridurre automaticamente gli ingredienti",
          });
        reuseCost =
          inherited.totalCostCents == null
            ? null
            : Math.round(
                (inherited.totalCostCents / inherited.totalKg) * reused
              );
        await tx
          .update(feedingLeftovers)
          .set(
            withUpdate(a, {
              payload: { ...leftover, reusedKg: leftover.reusedKg + reused },
            })
          )
          .where(scope(feedingLeftovers, a, leftover.id));
      }
      const ids = input.ingredients.map(i => i.productId);
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== recipe.ingredients.length ||
        recipe.ingredients.some(i => !ids.includes(i.productId))
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Il carico deve contenere esattamente gli ingredienti della ricetta",
        });
      const id = newId();
      const ingredients: FeedRun["ingredients"] = [];
      for (const actual of [...input.ingredients].sort((a, b) =>
        a.productId.localeCompare(b.productId)
      )) {
        await tx.execute(
          sql`SELECT id FROM prodotti WHERE id=${actual.productId} AND companyId=${a.companyId} AND deletedAt IS NULL FOR UPDATE`
        );
        const [p] = await tx
          .select()
          .from(prodotti)
          .where(scope(prodotti, a, actual.productId))
          .for("update");
        if (!p)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Alimento non disponibile nella propria azienda",
          });
        const factor = kgFactor(p.unitaMisura ?? "");
        if (!factor)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unità di ${p.nome} non convertibile in kg: configura kg, q o t in Magazzino`,
          });
        const units = actual.actualKg / factor;
        if (
          !Number.isFinite(units) ||
          actual.actualKg <= 0 ||
          units > Number(p.quantita) + 0.000001
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Giacenza insufficiente per ${p.nome}; nessuno scarico è stato confermato`,
          });
        const current = data.products.find(f => f.id === p.id);
        if (!current)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "L’ingrediente non è un alimento aziendale",
          });
        const price =
          p.costoMedioUnitario != null
            ? Number(p.costoMedioUnitario) / factor
            : p.prezzoUnitario != null && Number(p.prezzoUnitario) > 0
              ? Number(p.prezzoUnitario) / factor
              : null;
        const cost =
          price == null ? null : Math.round(actual.actualKg * price * 100);
        const movementId = newId();
        await tx
          .insert(movimentiMagazzino)
          .values(
            withCreate(a, {
              id: movementId,
              prodottoId: p.id,
              tipo: "scarico",
              quantita: units.toFixed(3),
              data: new Date(input.at),
              dataOra: new Date(input.at),
              descrizione: `Alimentazione — carro ${id}`,
              causale: "carico_carro",
              costoUnitario: price == null ? null : (price * factor).toFixed(6),
              importoCosto: cost == null ? null : (cost / 100).toFixed(2),
              originModule: "feeding",
              originId: id,
              operatore: a.userUuid,
            })
          );
        await tx
          .update(prodotti)
          .set(
            withUpdate(a, {
              quantita: (Number(p.quantita) - units).toFixed(3),
              ultimoScaricoAt: new Date(input.at),
              ultimoScaricoQuantita: units.toFixed(3),
            })
          )
          .where(scope(prodotti, a, p.id));
        const theoretical =
          ((recipe.ingredients.find(i => i.productId === p.id)!.kgPerHead *
            groupNow.nAnimali) /
            groupNow.frequency!) *
          (1 - reused / target);
        ingredients.push({
          productId: p.id,
          nome: p.nome,
          expectedKg: theoretical,
          actualKg: actual.actualKg,
          unitCostCentsPerKg: price == null ? null : price * 100,
          costCents: cost,
          nirId: current.nirId,
          params: structuredClone(current.params),
          dryMatter: current.dryMatter,
          movementId,
        });
      }
      const fresh = ingredients.reduce((s, i) => s + i.actualKg, 0);
      const totalCost =
        ingredients.some(i => i.costCents == null) || reuseCost == null
          ? null
          : ingredients.reduce((s, i) => s + i.costCents!, 0) + reuseCost;
      const payload: FeedRun = {
        id,
        groupId: group.id,
        recipeId: recipe.id,
        at: input.at,
        operatorId: a.userUuid,
        headCount: groupNow.nAnimali,
        animalIds: groupNow.animalIds,
        state: "caricato",
        expectedKg: target,
        freshKg: fresh,
        reusedKg: reused,
        totalKg: fresh + reused,
        totalCostCents: totalCost,
        ingredients,
        recipeSnapshot: structuredClone(recipe),
        leftoverId: leftover?.id ?? null,
        remainingKg: fresh + reused,
        note: input.note ?? null,
        draft: {
          requestHash: h,
          reusedDryMatter: inherited
            ? (inherited.ingredients.reduce(
                (s, i) =>
                  s +
                  (i.dryMatter == null ? 0 : (i.actualKg * i.dryMatter) / 100),
                0
              ) /
                inherited.totalKg) *
              reused
            : null,
          reusedCompositionKnown: inherited
            ? inherited.ingredients.every(i => i.dryMatter != null)
            : reused === 0,
        },
      };
      await tx
        .insert(feedingRuns)
        .values(
          withCreate(a, {
            id,
            groupId: group.id,
            recipeId: recipe.id,
            requestKey: input.key,
            state: "caricato",
            at: input.at,
            payload,
          })
        );
      if (input.draftId) {
        const [d] = await tx
          .select()
          .from(feedingRuns)
          .where(scope(feedingRuns, a, input.draftId))
          .for("update");
        if (!d || d.state !== "preparazione" || d.createdBy !== a.userUuid)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bozza non disponibile per questo operatore",
          });
        await tx
          .update(feedingRuns)
          .set(
            withUpdate(a, {
              state: "annullato",
              payload: {
                ...d.payload,
                state: "annullato",
                note: `Bozza confermata nel carro ${id}`,
              },
            })
          )
          .where(scope(feedingRuns, a, d.id));
      }
      return { id, idempotent: false };
    });
  },
  async distribute(a: ActorContext, input: DistributionInput) {
    confirmed(input.confirm);
    const db = await database();
    const h = hash(input);
    return db.transaction(async tx => {
      await tx.execute(
        sql`SELECT id FROM feedingRuns WHERE id=${input.runId} AND companyId=${a.companyId} FOR UPDATE`
      );
      const [prior] = await tx
        .select()
        .from(feedingDistributions)
        .where(
          and(
            scope(feedingDistributions, a),
            eq(feedingDistributions.requestKey, input.key)
          )
        )
        .for("update");
      if (prior) {
        replay(prior.payload, h);
        return { id: prior.id, idempotent: true };
      }
      const [r] = await tx
        .select()
        .from(feedingRuns)
        .where(scope(feedingRuns, a, input.runId))
        .for("update");
      if (!r || !["caricato", "parziale"].includes(r.state))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Carro non distribuibile",
        });
      await realGroup(a, input.groupId, tx);
      if (input.groupId !== r.groupId && !input.authorizeOtherGroup)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Conferma l’autorizzazione di distribuzione a un gruppo diverso",
        });
      if (input.at < r.at)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La distribuzione non può precedere il carico",
        });
      const run = r.payload;
      if (input.kg <= 0 || input.kg > run.remainingKg + 0.00001)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quantità superiore al residuo del carro",
        });
      const detail = await livestockService.getGruppoDetail(
        a.companyId,
        input.groupId
      );
      if (!detail || detail.stats.totale === 0)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gruppo di destinazione senza animali",
        });
      const id = newId();
      const baseDm = run.ingredients.every(i => i.dryMatter != null)
        ? run.ingredients.reduce(
            (s, i) => s + (i.actualKg * i.dryMatter!) / 100,
            0
          )
        : null;
      const reusedDm = (run.draft as any)?.reusedDryMatter ?? null;
      const totalDm =
        baseDm == null || (run.reusedKg > 0 && reusedDm == null)
          ? null
          : baseDm + (reusedDm ?? 0);
      const payload: FeedDistribution = {
        id,
        runId: run.id,
        groupId: input.groupId,
        at: input.at,
        kg: input.kg,
        costCents:
          run.totalCostCents == null
            ? null
            : Math.round((run.totalCostCents * input.kg) / run.totalKg),
        dryMatterKg:
          totalDm == null ? null : (totalDm * input.kg) / run.totalKg,
        headCount: detail.stats.totale,
        animalIds: detail.membri.map(m => m.id),
        operatorId: a.userUuid,
        annulled: false,
        note: input.note ?? null,
      };
      const withHash = { ...payload, requestHash: h };
      await tx
        .insert(feedingDistributions)
        .values(
          withCreate(a, {
            id,
            runId: run.id,
            groupId: input.groupId,
            requestKey: input.key,
            at: input.at,
            payload: withHash,
          })
        );
      const remaining = Math.max(0, run.remainingKg - input.kg);
      const state = remaining < 0.001 ? "distribuito" : "parziale";
      await tx
        .update(feedingRuns)
        .set(
          withUpdate(a, {
            state,
            payload: { ...run, state, remainingKg: remaining },
          })
        )
        .where(scope(feedingRuns, a, run.id));
      return { id, idempotent: false };
    });
  },
  async registerLeftover(a: ActorContext, input: LeftoverInput) {
    confirmed(input.confirm);
    const db = await database();
    const h = hash(input);
    return db.transaction(async tx => {
      await tx.execute(
        sql`SELECT id FROM feedingDistributions WHERE id=${input.distributionId} AND companyId=${a.companyId} FOR UPDATE`
      );
      const [prior] = await tx
        .select()
        .from(feedingLeftovers)
        .where(
          and(
            scope(feedingLeftovers, a),
            eq(feedingLeftovers.requestKey, input.key)
          )
        )
        .for("update");
      if (prior) {
        replay(prior.payload, h);
        return { id: prior.id, idempotent: true };
      }
      const [d] = await tx
        .select()
        .from(feedingDistributions)
        .where(scope(feedingDistributions, a, input.distributionId))
        .for("update");
      if (!d || d.payload.annulled)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Distribuzione precedente non disponibile",
        });
      if (input.at < d.at)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L’avanzo non può precedere la distribuzione",
        });
      const already = await tx
        .select()
        .from(feedingLeftovers)
        .where(
          and(
            scope(feedingLeftovers, a),
            eq(feedingLeftovers.distributionId, d.id)
          )
        );
      if (already.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Avanzo già registrato: non è consentita una seconda registrazione",
        });
      let kg = input.method === "nessuno" ? 0 : Number(input.kg ?? 0);
      let containerWeight: number | null = null;
      if (input.method === "contenitore") {
        if (
          !input.containerId ||
          !input.containerCount ||
          input.containerCount <= 0
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Seleziona contenitore e frazione positiva",
          });
        const [c] = await tx
          .select()
          .from(feedingContainers)
          .where(scope(feedingContainers, a, input.containerId));
        if (!c || (c.payload.groupId && c.payload.groupId !== d.groupId))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contenitore non configurato per questo gruppo",
          });
        containerWeight = c.payload.kg;
        kg = containerWeight * input.containerCount;
      }
      if (
        kg < 0 ||
        kg > d.payload.kg + 0.0001 ||
        (input.method !== "nessuno" && kg === 0)
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quantità avanzo non valida",
        });
      if (
        input.destination === "riutilizzo" &&
        (!input.compositionKnown || !input.compatibleReuse)
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Conferma composizione nota e compatibilità prima del riutilizzo",
        });
      const id = newId();
      const payload: FeedLeftover = {
        id,
        distributionId: d.id,
        groupId: d.groupId,
        at: input.at,
        kg,
        reusedKg: 0,
        discardedKg: input.destination === "scartato" ? kg : 0,
        destination: input.destination,
        method: input.method,
        containerId: input.containerId ?? null,
        containerCount:
          input.method === "contenitore"
            ? (input.containerCount ?? null)
            : null,
        containerWeightKg: containerWeight,
        compositionKnown: input.compositionKnown ?? false,
        operatorId: a.userUuid,
        note: input.note ?? null,
      };
      await tx
        .insert(feedingLeftovers)
        .values(
          withCreate(a, {
            id,
            distributionId: d.id,
            groupId: d.groupId,
            requestKey: input.key,
            at: input.at,
            payload: { ...payload, requestHash: h },
          })
        );
      return { id, idempotent: false };
    });
  },
  async rectifyLoad(
    a: ActorContext,
    input: { key: string; runId: string; reason: string; confirm: boolean }
  ) {
    confirmed(input.confirm);
    const db = await database();
    return db.transaction(async tx => {
      await tx.execute(
        sql`SELECT id FROM feedingRuns WHERE id=${input.runId} AND companyId=${a.companyId} FOR UPDATE`
      );
      const [prev] = await tx
        .select()
        .from(feedingCorrections)
        .where(
          and(
            scope(feedingCorrections, a),
            eq(feedingCorrections.requestKey, input.key)
          )
        )
        .for("update");
      if (prev) {
        if (prev.runId !== input.runId || prev.reason !== input.reason)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Chiave di rettifica già usata",
          });
        return { id: prev.id, idempotent: true };
      }
      const [r] = await tx
        .select()
        .from(feedingRuns)
        .where(scope(feedingRuns, a, input.runId))
        .for("update");
      if (!r || r.state !== "caricato")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Puoi annullare solo un carro senza distribuzioni; per altri casi serve una rettifica fisica documentata in Magazzino",
        });
      const dist = await tx
        .select()
        .from(feedingDistributions)
        .where(
          and(
            scope(feedingDistributions, a),
            eq(feedingDistributions.runId, r.id)
          )
        );
      if (dist.length)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Il carro ha distribuzioni nello storico: annullamento semplice non consentito",
        });
      const id = newId();
      for (const i of [...r.payload.ingredients].sort((a, b) =>
        a.productId.localeCompare(b.productId)
      )) {
        await tx.execute(
          sql`SELECT id FROM prodotti WHERE id=${i.productId} AND companyId=${a.companyId} FOR UPDATE`
        );
        const [p] = await tx
          .select()
          .from(prodotti)
          .where(scope(prodotti, a, i.productId))
          .for("update");
        if (!p)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Prodotto della rettifica non disponibile",
          });
        const f = kgFactor(p.unitaMisura ?? "");
        if (!f)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unità originale da verificare per la rettifica",
          });
        await tx
          .update(prodotti)
          .set(
            withUpdate(a, {
              quantita: (Number(p.quantita) + i.actualKg / f).toFixed(3),
            })
          )
          .where(scope(prodotti, a, p.id));
        await tx
          .insert(movimentiMagazzino)
          .values(
            withCreate(a, {
              id: newId(),
              prodottoId: p.id,
              tipo: "carico",
              quantita: (i.actualKg / f).toFixed(3),
              data: new Date(),
              dataOra: new Date(),
              causale: "rettifica_carro",
              descrizione: input.reason,
              originModule: "feeding",
              originId: id,
              operatore: a.userUuid,
              importoCosto:
                i.costCents == null ? null : (i.costCents / 100).toFixed(2),
            })
          );
      }
      if (r.payload.leftoverId) {
        await tx.execute(
          sql`SELECT id FROM feedingLeftovers WHERE id=${r.payload.leftoverId} AND companyId=${a.companyId} FOR UPDATE`
        );
        const [l] = await tx
          .select()
          .from(feedingLeftovers)
          .where(scope(feedingLeftovers, a, r.payload.leftoverId))
          .for("update");
        if (l)
          await tx
            .update(feedingLeftovers)
            .set(
              withUpdate(a, {
                payload: {
                  ...l.payload,
                  reusedKg: Math.max(
                    0,
                    l.payload.reusedKg - r.payload.reusedKg
                  ),
                },
              })
            )
            .where(scope(feedingLeftovers, a, l.id));
      }
      await tx
        .insert(feedingCorrections)
        .values(
          withCreate(a, {
            id,
            runId: r.id,
            requestKey: input.key,
            at: Date.now(),
            reason: input.reason,
            payload: { originalRun: r.payload },
          })
        );
      await tx
        .update(feedingRuns)
        .set(
          withUpdate(a, {
            state: "annullato",
            payload: {
              ...r.payload,
              state: "annullato",
              remainingKg: 0,
              note: `${r.payload.note ?? ""}\nRettifica ${id}: ${input.reason}`,
            },
          })
        )
        .where(scope(feedingRuns, a, r.id));
      return { id, idempotent: false };
    });
  },
};
