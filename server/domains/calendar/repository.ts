import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { eventi } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** CALENDAR (Calendario) — Repository */
export const calendarRepository = {
  async listByMonth(companyId: string, anno: number, mese: number) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT * FROM eventi WHERE companyId=${companyId} AND deletedAt IS NULL
          AND YEAR(dataInizio)=${anno} AND MONTH(dataInizio)=${mese} ORDER BY dataInizio LIMIT 200`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async listAll(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(eventi)
      .where(and(eq(eventi.companyId, companyId), isNull(eventi.deletedAt)))
      .orderBy(eventi.dataInizio).limit(100);
  },

  /** Solo eventi di oggi (per la card "Calendario Oggi" in Home). */
  async listToday(companyId: string) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT * FROM eventi WHERE companyId=${companyId} AND deletedAt IS NULL
          AND DATE(dataInizio)=CURDATE() ORDER BY dataInizio LIMIT 50`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async insert(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(eventi).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async toggleCompletato(actor: ActorContext, id: string, completato: boolean) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(eventi).set(withUpdate(actor, { completato }) as any)
      .where(and(eq(eventi.id, id), eq(eventi.companyId, actor.companyId)));
    return { success: true };
  },

  async softDelete(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(eventi).set(softDeletePayload(actor) as any)
      .where(and(eq(eventi.id, id), eq(eventi.companyId, actor.companyId)));
    return { success: true };
  },
};
