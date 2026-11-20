import { TRPCError } from "@trpc/server";
import { accessService } from "../access/service";
import { moduleMatches } from "../../../shared/access";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { protectedProcedure } from "../../_core/trpc";
import { getActor } from "../_core";
import { getDb } from "../../db";
import { prodotti, movimentiMagazzino } from "../../../drizzle/schema";
export const ricevimentiDaCollegare = protectedProcedure
  .input(z.object({ prodottoId: z.string().min(1).max(100) }))
  .query(async ({ ctx, input }) => {
    const a = await getActor(ctx);
    const profile = await accessService.profile(a, ctx.user!);
    if (
      !profile.isCompanyAdmin &&
      !profile.modules.some(m =>
        ["finanza.movimenti", "finanza.fatturazione"].some(k =>
          moduleMatches(m as any, k)
        )
      )
    )
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Accesso ai ricevimenti per fatturazione non autorizzato",
      });
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    const [p] = await db
      .select()
      .from(prodotti)
      .where(
        and(
          eq(prodotti.id, input.prodottoId),
          eq(prodotti.companyId, a.companyId),
          isNull(prodotti.deletedAt)
        )
      );
    if (!p) throw new Error("Prodotto non disponibile nell’azienda attiva");
    const rows = await db
      .select()
      .from(movimentiMagazzino)
      .where(
        and(
          eq(movimentiMagazzino.companyId, a.companyId),
          eq(movimentiMagazzino.prodottoId, p.id),
          eq(movimentiMagazzino.tipo, "carico"),
          isNull(movimentiMagazzino.deletedAt),
          isNull(movimentiMagazzino.fatturaRigaId)
        )
      );
    return {
      unit: p.unitaMisura,
      quantity: Number(p.quantita),
      receipts: rows
        .filter(
          r => r.originModule !== "feeding" && r.originModule !== "finance"
        )
        .map(r => ({
          id: r.id,
          at: new Date(r.data).getTime(),
          quantity: Number(r.quantita),
          description: r.descrizione ?? "Ricevimento fisico Magazzino",
        }))
        .sort((a, b) => b.at - a.at),
    };
  });
