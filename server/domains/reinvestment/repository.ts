import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { fondiReintegrazione, rateReintegrazione, macchine } from "../../../drizzle/schema";
import { withCreate, withUpdate, type ActorContext } from "../_core";

/** REINVESTMENT (Reintegrazione) — Repository */
export const reinvestmentRepository = {
  async listFondi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(fondiReintegrazione)
      .where(and(eq(fondiReintegrazione.companyId, companyId), eq(fondiReintegrazione.attivo, true), isNull(fondiReintegrazione.deletedAt)))
      .orderBy(fondiReintegrazione.nomeDisplay);
  },

  async getMacchina(id: string) {
    const db = await getDb();
    if (!db) return null;
    const [m] = await db.select().from(macchine).where(eq(macchine.id, id)).limit(1);
    return m ?? null;
  },

  async getFondo(id: string) {
    const db = await getDb();
    if (!db) return null;
    const [f] = await db.select().from(fondiReintegrazione).where(eq(fondiReintegrazione.id, id)).limit(1);
    return f ?? null;
  },

  async totale(companyId: string) {
    const db = await getDb();
    if (!db) return { totale: 0, interessi: 0, fondiCount: 0 };
    const rows = (await db.execute(
      sql`SELECT COALESCE(SUM(fondoAttuale),0) as totale, COALESCE(SUM(fondoAttuale*tassoInteresse),0) as interessi, COUNT(*) as cnt
          FROM fondiReintegrazione WHERE companyId=${companyId} AND attivo=1 AND deletedAt IS NULL`,
    ) as any[]);
    const r = (rows as any[])[0]?.[0] ?? {};
    return { totale: Number(r.totale ?? 0), interessi: Number(r.interessi ?? 0), fondiCount: Number(r.cnt ?? 0) };
  },

  async rate(companyId: string, fondoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(rateReintegrazione)
      .where(and(eq(rateReintegrazione.fondoId, fondoId), eq(rateReintegrazione.companyId, companyId), isNull(rateReintegrazione.deletedAt)))
      .orderBy(desc(rateReintegrazione.data));
  },

  async insertFondo(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(fondiReintegrazione).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateFondoAttuale(actor: ActorContext, fondoId: string, fondoAttuale: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(fondiReintegrazione).set(withUpdate(actor, { fondoAttuale }) as any).where(eq(fondiReintegrazione.id, fondoId));
  },

  async insertRata(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(rateReintegrazione).values(withCreate(actor, data) as any);
  },
};
