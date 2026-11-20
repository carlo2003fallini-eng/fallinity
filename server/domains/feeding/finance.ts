import { z } from "zod";
import { protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import { accessService } from "../access/service";
import { moduleMatches } from "../../../shared/access";
import { database, scope } from "./service";
import {
  feedingRuns,
  feedingDistributions,
  feedingLeftovers,
  prodotti,
} from "../../../drizzle/schema";
import { isFeedProduct } from "./data";
export const costiAlimentari = protectedProcedure
  .input(
    z.object({
      from: z.number().finite(),
      to: z.number().finite(),
      scope: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const a = await getActor(ctx);
    if (input.scope && input.scope !== a.companyId)
      throw new Error("Azienda cambiata");
    const profile = await accessService.profile(a, ctx.user!);
    if (
      !profile.isCompanyAdmin &&
      !profile.modules.some(m =>
        ["finanza.kpi", "finanza.movimenti", "finanza.report"].some(k =>
          moduleMatches(m as any, k)
        )
      )
    )
      throw new Error("Dati economici non autorizzati");
    if (input.from > input.to) throw new Error("Periodo non valido");
    const db = await database();
    const [r, d, p, l] = await Promise.all([
      db.select().from(feedingRuns).where(scope(feedingRuns, a)),
      db
        .select()
        .from(feedingDistributions)
        .where(scope(feedingDistributions, a)),
      db.select().from(prodotti).where(scope(prodotti, a)),
      db.select().from(feedingLeftovers).where(scope(feedingLeftovers, a)),
    ]);
    const runs = r
      .map(x => x.payload)
      .filter(
        x =>
          x.at >= input.from &&
          x.at <= input.to &&
          x.state !== "annullato" &&
          x.state !== "preparazione"
      );
    const ds = d
      .map(x => x.payload)
      .filter(x => x.at >= input.from && x.at <= input.to && !x.annulled);
    const freshKnown = runs.every(x =>
      x.ingredients.every(i => i.costCents != null)
    );
    const attributedKnown = ds.every(x => x.costCents != null);
    const freshCostCents = !runs.length
      ? null
      : !freshKnown
        ? null
        : runs.reduce(
            (s, x) => s + x.ingredients.reduce((s, i) => s + i.costCents!, 0),
            0
          );
    const attributedCostCents = !ds.length
      ? null
      : !attributedKnown
        ? null
        : ds.reduce(
            (s, x) =>
              s +
              x.costCents! *
                (1 -
                  l
                    .filter(v => v.distributionId === x.id)
                    .reduce((s, v) => s + v.payload.reusedKg, 0) /
                    x.kg),
            0
          );
    const feed = p.filter(isFeedProduct);
    const stockValueCents =
      !feed.length || feed.some(x => x.costoMedioUnitario == null)
        ? null
        : Math.round(
            feed.reduce(
              (s, x) =>
                s + Number(x.quantita) * Number(x.costoMedioUnitario) * 100,
              0
            )
          );
    return {
      freshCostCents,
      attributedCostCents,
      stockValueCents,
      runs: runs.length,
      distributions: ds.length,
      hasMissingCosts: !freshKnown || !attributedKnown,
      source:
        "Registrazioni Alimentazione e costo medio delle giacenze Magazzino",
      note: "Attribuzione analitica dei costi: non viene aggiunta alle uscite da fattura. I filtri soggetto/categoria Finanza non filtrano questi costi: questo riquadro segue esclusivamente il periodo selezionato.",
    };
  });
