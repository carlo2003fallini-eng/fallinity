import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  prodotti,
  gruppi,
  animali,
  soggetti,
  acquisizioniFatture,
  righeFattureAcquisite,
  feedingRecipes,
  feedingRuns,
  feedingDistributions,
  feedingLeftovers,
  feedingNirAnalyses,
  feedingContainers,
  feedingSettings,
  feedingComparisons,
  datiStallaRilevazioni,
} from "../../../drizzle/schema";
import { livestockService, membriDelGruppo } from "../livestock/service";
import { livestockRepository } from "../livestock/repository";
import type { ActorContext } from "../_core";
import type {
  FeedData,
  FeedRecipe,
  FeedGroup,
  FeedProduct,
  FeedingPermissions,
} from "../../../shared/feeding/types";
import { kgFactor, dryMatter } from "../../../shared/feeding/math";
export const isFeedProduct = (p: {
  categoria?: string | null;
  reparto?: string | null;
  famiglia?: string | null;
}) =>
  /alimenti|alimentazione|foraggi|foraggio|mangimi|mangime|cereali|insilati|fieni|materie prime alimentari/i.test(
    [p.categoria, p.reparto, p.famiglia].join(" ")
  );
export function effectiveRecipe(
  recipes: FeedRecipe[],
  groupId: string,
  at = Date.now()
) {
  return (
    recipes
      .filter(
        r =>
          r.groupId === groupId &&
          (r.status === "attiva" || r.status === "programmata") &&
          (r.validFrom ?? r.createdAt) <= at
      )
      .sort(
        (a, b) =>
          (b.validFrom ?? b.createdAt) - (a.validFrom ?? a.createdAt) ||
          b.version - a.version
      )[0] ?? null
  );
}
export function observedFrequency(
  distributions: FeedData["distributions"],
  groupId: string,
  configured: number | null,
  now = Date.now()
) {
  const byRun = new Map<string, number>();
  distributions
    .filter(
      d =>
        d.groupId === groupId &&
        !d.annulled &&
        d.kg > 0 &&
        d.at >= now - 35 * 86400000
    )
    .forEach(d =>
      byRun.set(d.runId, Math.min(byRun.get(d.runId) ?? d.at, d.at))
    );
  const ats = Array.from(byRun.values()).sort((a, b) => a - b);
  const last = distributions
    .filter(d => d.groupId === groupId && !d.annulled && d.kg > 0)
    .reduce<
      number | null
    >((latest, d) => (latest == null ? d.at : Math.max(latest, d.at)), null);
  if (ats.length >= 4 && ats.at(-1)! - ats[0] >= 86400000) {
    const gaps = ats
      .slice(1)
      .map((a, i) => (a - ats[i]) / 86400000)
      .filter(v => v > 0)
      .sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const median =
      gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
    const stable =
      gaps.filter(v => Math.abs(v - median) <= median * 0.5).length /
        gaps.length >=
      0.7;
    if (stable && median > 0)
      return {
        frequency: 1 / median,
        frequencySource: "Distribuzioni effettive (mediana intervalli)",
        frequencyReliability: "osservata",
        lastDistributionAt: last,
        nextDistributionAt: last == null ? null : last + median * 86400000,
      };
  }
  return {
    frequency: configured,
    frequencySource:
      configured == null
        ? "Frequenza da configurare: storico insufficiente"
        : "Configurazione gruppo; storico ancora insufficiente o variabile",
    frequencyReliability: configured == null ? "insufficiente" : "configurata",
    lastDistributionAt: last,
    nextDistributionAt:
      last == null || configured == null ? null : last + 86400000 / configured,
  };
}
export async function loadFeedingData(
  actor: ActorContext,
  permissions: FeedingPermissions
): Promise<FeedData> {
  const db = await getDb();
  if (!db) throw new Error("Database non disponibile");
  const rows = async (table: any) =>
    db
      .select()
      .from(table)
      .where(
        and(eq(table.companyId, actor.companyId), isNull(table.deletedAt))
      );
  const [
    rawProducts,
    rawGroups,
    animals,
    members,
    parts,
    rR,
    runsR,
    distR,
    leftR,
    nirR,
    contR,
    setR,
    compR,
    milkR,
    suppliers,
    invoiceRows,
    lineRows,
  ] = await Promise.all([
    rows(prodotti),
    rows(gruppi),
    livestockRepository.listAnimali(actor.companyId),
    livestockRepository.listGruppiAnimali(actor.companyId),
    livestockRepository.listUltimiParti(actor.companyId),
    rows(feedingRecipes),
    rows(feedingRuns),
    rows(feedingDistributions),
    rows(feedingLeftovers),
    rows(feedingNirAnalyses),
    rows(feedingContainers),
    rows(feedingSettings),
    rows(feedingComparisons),
    rows(datiStallaRilevazioni),
    rows(soggetti),
    rows(acquisizioniFatture),
    rows(righeFattureAcquisite),
  ]);
  const recipes: FeedRecipe[] = rR.map((r: any) => ({
    ...r.payload,
    id: r.id,
    rootId: r.rootId,
    groupId: r.groupId,
    version: r.version,
    status: r.status,
    validFrom: r.validFrom,
  }));
  const runs: FeedData["runs"] = runsR
    .map((r: any) => ({ ...r.payload, id: r.id, state: r.state }))
    .sort((a: any, b: any) => b.at - a.at);
  const distributions: FeedData["distributions"] = distR.map((r: any) => ({
    ...r.payload,
    id: r.id,
  }));
  const leftovers: FeedData["leftovers"] = leftR.map((r: any) => ({
    ...r.payload,
    id: r.id,
  }));
  const settings: FeedData["settings"] = setR
    .map((r: any) => ({ ...r.payload, id: r.id }))
    .filter(
      (s: any) =>
        s.scopeType !== "operatore" || s.scopeId === String(actor.userId)
    );
  const nirAnalyses: FeedData["nirAnalyses"] = nirR
    .map((r: any) => ({ ...r.payload, id: r.id }))
    .sort((a: any, b: any) => b.at - a.at);
  const lastPart = new Map<string, Date>();
  parts.forEach((p: any) => {
    if (!lastPart.has(p.animaleId)) lastPart.set(p.animaleId, new Date(p.data));
  });
  const groups: FeedGroup[] = rawGroups
    .filter((g: any) => g.stato === "attivo")
    .map((g: any) => {
      const membersNow = membriDelGruppo(
        g,
        animals as any,
        members as any,
        lastPart
      );
      const configured = settings.find(
        s => s.scopeType === "gruppo" && s.scopeId === g.id
      )?.value.runsPerDay;
      return {
        id: g.id,
        nome: g.nome,
        tipologia: g.tipologia,
        foto: g.foto ?? null,
        nAnimali: membersNow.length,
        inLattazione: membersNow.filter(
          (a: any) => a.statoProduttivo === "in_lattazione"
        ).length,
        animalIds: membersNow.map((a: any) => a.id),
        activeRecipeId: effectiveRecipe(recipes, g.id)?.id ?? null,
        overlaps: [],
        ...observedFrequency(
          distributions,
          g.id,
          typeof configured === "number" && configured > 0 ? configured : null
        ),
      };
    });
  groups.forEach(g => {
    if (g.activeRecipeId)
      g.overlaps = groups
        .filter(
          other =>
            other.id !== g.id &&
            other.activeRecipeId &&
            other.animalIds.some(id => g.animalIds.includes(id))
        )
        .map(other => other.nome);
  });
  const used = new Set(
    recipes.flatMap(r => r.ingredients.map(i => i.productId))
  );
  const products: FeedProduct[] = rawProducts
    .filter((p: any) => isFeedProduct(p) || used.has(p.id))
    .map((p: any) => {
      const factor = kgFactor(p.unitaMisura ?? "");
      const nr =
        nirAnalyses.find(n => n.productId === p.id && n.active) ?? null;
      const mean =
        p.costoMedioUnitario == null ? null : Number(p.costoMedioUnitario);
      const reference =
        p.prezzoUnitario != null && Number(p.prezzoUnitario) > 0
          ? Number(p.prezzoUnitario)
          : null;
      const price = mean ?? reference;
      const source =
        mean != null
          ? (p.costoFonte ?? "Costo medio Magazzino")
          : reference != null
            ? "Prezzo di riferimento Magazzino; media storica non ricostruita"
            : "Costo non disponibile";
      const supplier = suppliers.find((s: any) => s.id === p.fornitoreId);
      const purchases = lineRows
        .filter((l: any) => l.prodottoId === p.id)
        .map((l: any) => {
          const inv = invoiceRows.find((v: any) => v.id === l.acquisizioneId);
          const f = kgFactor(l.unitaMisura ?? p.unitaMisura ?? "");
          const q = l.quantita == null ? null : Number(l.quantita);
          return {
            invoiceId: inv?.id ?? l.acquisizioneId,
            lineId: l.id,
            at: String(inv?.dataDocumento ?? ""),
            supplier:
              inv?.fornitoreRagioneSociale ??
              supplier?.ragioneSociale ??
              p.fornitore ??
              "",
            priceKg:
              f && l.prezzoUnitario != null
                ? Number(l.prezzoUnitario) / 100 / f
                : null,
            quantityKg: f && q != null ? q * f : null,
          };
        })
        .sort((a: any, b: any) => b.at.localeCompare(a.at));
      const daily = groups.reduce((sum, g) => {
        const rec = effectiveRecipe(recipes, g.id);
        const base =
          (rec?.ingredients.find(i => i.productId === p.id)?.kgPerHead ?? 0) *
          g.nAnimali;
        if (!rec || !base) return sum;
        const observed = runs.filter(
          r =>
            r.groupId === g.id &&
            r.recipeId === rec.id &&
            r.state !== "preparazione" &&
            r.state !== "annullato" &&
            r.at >= Date.now() - 30 * 86400000
        );
        const ratios = observed
          .map(r => {
            const i = r.ingredients.find(i => i.productId === p.id);
            const recipeKg = rec.ingredients.reduce(
              (s, i) => s + i.kgPerHead,
              0
            );
            const expected =
              (r.expectedKg *
                (rec.ingredients.find(i => i.productId === p.id)?.kgPerHead ??
                  0)) /
              recipeKg;
            return i && expected > 0 ? i.actualKg / expected : null;
          })
          .filter((v): v is number => v != null && v >= 0 && v <= 2)
          .sort((a, b) => a - b);
        const factor =
          ratios.length >= 3 ? ratios[Math.floor(ratios.length / 2)] : 1;
        return sum + base * factor;
      }, 0);
      const quantityKg = factor == null ? null : Number(p.quantita) * factor;
      return {
        id: p.id,
        nome: p.nome,
        codice: p.codice ?? null,
        categoria: p.categoria ?? null,
        unitaMisura: p.unitaMisura ?? null,
        quantity: Number(p.quantita),
        quantityKg,
        unitToKg: factor,
        prezzoKg: factor && price != null ? price / factor : null,
        costSource: source,
        lastPriceKg:
          purchases[0]?.priceKg ??
          (factor && reference != null ? reference / factor : null),
        fornitoreId: p.fornitoreId ?? null,
        fornitore: p.fornitore ?? supplier?.ragioneSociale ?? null,
        immagineUrl: p.immagineUrl ?? null,
        nirId: nr?.id ?? null,
        params: nr?.params ?? {},
        dryMatter: dryMatter(nr?.params ?? {}),
        dailyUseKg: daily > 0 ? daily : null,
        autonomyDays:
          daily > 0 && quantityKg != null ? quantityKg / daily : null,
        autonomyStatus:
          daily === 0
            ? "Non in uso"
            : quantityKg == null
              ? "Autonomia non ancora calcolabile"
              : "Previsione da ricette, capi attuali e prelievi freschi osservati (quando sufficienti)",
        purchases,
      };
    });
  const milkPrices = await (await import("./milk")).realMilkPrices(actor);
  const activeGroups = groups.filter(g => g.activeRecipeId);
  const fed = new Set(activeGroups.flatMap(g => g.animalIds));
  const limit = products
    .filter(p => p.autonomyDays != null)
    .sort((a, b) => a.autonomyDays! - b.autonomyDays!)[0];
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const recent = runs.filter(
    r =>
      r.state !== "preparazione" &&
      r.state !== "annullato" &&
      r.at >= now - 30 * 86400000
  );
  const span = recent.length
    ? Math.max(1, (now - Math.min(...recent.map(r => r.at))) / 86400000)
    : null;
  const warnings: string[] = [];
  if (activeGroups.some(g => g.frequency == null))
    warnings.push(
      "Configura le frequenze dei gruppi senza storico sufficiente."
    );
  if (activeGroups.some(g => g.overlaps.length))
    warnings.push(
      "Alcuni gruppi alimentati hanno animali sovrapposti: verificare per evitare doppia alimentazione."
    );
  products
    .filter(p => p.autonomyDays != null && p.autonomyDays < 7)
    .forEach(p =>
      warnings.push(`${p.nome}: scorta prevista inferiore a 7 giorni.`)
    );
  if (!activeGroups.length)
    warnings.push("Nessuna ricetta attiva: autonomia non ancora calcolabile.");
  if (products.some(p => p.prezzoKg == null))
    warnings.push("Alcuni alimenti non hanno un costo disponibile.");
  const visibleRecipes = recipes.map(r => {
    const selected = effectiveRecipe(recipes, r.groupId);
    return r.status === "attiva" ||
      (r.status === "programmata" && (r.validFrom ?? Infinity) <= Date.now())
      ? {
          ...r,
          status:
            selected?.id === r.id ? ("attiva" as const) : ("salvata" as const),
        }
      : r;
  });
  return {
    groups,
    products,
    recipes: visibleRecipes,
    runs,
    distributions,
    leftovers,
    nirAnalyses,
    settings,
    containers: contR.map((r: any) => ({ ...r.payload, id: r.id })),
    comparisons: compR
      .map((r: any) => ({ ...r.payload, id: r.id }))
      .sort((a: any, b: any) => b.at - a.at),
    milkRecords: milkR.map((r: any) => {
      const payload = { ...r.payload, id: r.id };
      if (payload.pricePerKg == null) {
        const latest = milkPrices.find(p => p.at <= payload.at);
        if (latest) {
          payload.pricePerKg = latest.pricePerKg;
          payload.priceSource = `Stima dall’ultimo prezzo documentato: ${latest.source}`;
        }
      }
      return payload;
    }),
    permissions,
    summary: {
      autonomyDays: limit?.autonomyDays ?? null,
      limitingProduct: limit?.nome ?? null,
      fedAnimals: fed.size,
      averageRunsPerDay: span == null ? null : recent.length / span,
      todayRuns: runs.filter(
        r =>
          r.state !== "preparazione" &&
          r.state !== "annullato" &&
          r.at >= today.getTime()
      ).length,
      undistributedRuns: runs.filter(
        r => r.state === "caricato" || r.state === "parziale"
      ).length,
      warnings,
      coverage:
        "Autonomia prevista dalle ricette attive e consistenza attuale; frequenze da distribuzioni reali quando sufficienti. Storico costi dai soli eventi registrati.",
    },
  };
}
