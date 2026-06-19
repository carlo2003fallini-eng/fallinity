import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { animali, trattamentiAnimali, zoppie } from "../../../drizzle/schema";
import { withCreate, withUpdate, type ActorContext } from "../_core";

/** LIVESTOCK (Stalla) — Repository */
export const livestockRepository = {
  async listAnimali(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(animali)
      .where(and(eq(animali.companyId, companyId), isNull(animali.deletedAt)))
      .orderBy(animali.matricola);
  },

  async listZoppie(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(zoppie)
      .where(and(eq(zoppie.companyId, companyId), isNull(zoppie.deletedAt)))
      .orderBy(desc(zoppie.createdAt));
  },

  /** Conteggi KPI tramite SQL parametrico (no string interpolation). */
  async stats(companyId: string) {
    const db = await getDb();
    if (!db) return { sincronizzazioniOggi: 0, zoppieAperte: 0, trattamentiPianificati: 0, partiMese: 0 };
    const scalar = async (q: any) => {
      const r = (await db.execute(q) as any[]);
      return Number((r[0] as any[])[0]?.cnt ?? 0);
    };
    return {
      sincronizzazioniOggi: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND tipo='sincronizzazione' AND stato='pianificato' AND DATE(dataTrattamento)=CURDATE()`),
      zoppieAperte: await scalar(sql`SELECT COUNT(*) as cnt FROM zoppie WHERE companyId=${companyId} AND deletedAt IS NULL AND stato!='risolta'`),
      trattamentiPianificati: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='pianificato'`),
      partiMese: await scalar(sql`SELECT COUNT(*) as cnt FROM gravidanze WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='in_corso' AND MONTH(dataPartoPrevisto)=MONTH(NOW()) AND YEAR(dataPartoPrevisto)=YEAR(NOW())`),
    };
  },

  async insertAnimale(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(animali).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async insertZoppia(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(zoppie).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async eseguiTrattamento(actor: ActorContext, animaleId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(trattamentiAnimali).set(withUpdate(actor, { stato: "eseguito" }) as any)
      .where(and(eq(trattamentiAnimali.animaleId, animaleId), eq(trattamentiAnimali.stato, "pianificato"), eq(trattamentiAnimali.companyId, actor.companyId)));
    return { success: true };
  },
};
