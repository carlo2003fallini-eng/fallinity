import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { transazioni } from "../../../drizzle/schema";
import { withCreate, softDeletePayload, type ActorContext } from "../_core";

/**
 * FINANCE — Repository
 * Accesso dati puro: nessuna logica di business, solo query Drizzle/SQL.
 * Ogni metodo è multi-tenant (filtra companyId) e rispetta il soft-delete.
 */

export const financeRepository = {
  async listTransazioni(companyId: string, tipo?: "entrata" | "uscita") {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(transazioni.companyId, companyId), isNull(transazioni.deletedAt)];
    if (tipo) conds.push(eq(transazioni.tipo, tipo));
    return db.select().from(transazioni).where(and(...conds)).orderBy(desc(transazioni.data)).limit(100);
  },

  async sumEntrateUscite(companyId: string, monthScope = false) {
    const db = await getDb();
    if (!db) return { entrate: 0, uscite: 0 };
    const monthFilter = monthScope
      ? sql`AND MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`
      : sql``;
    const rows = (await db.execute(
      sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
          COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
          FROM transazioni WHERE companyId=${companyId} AND deletedAt IS NULL ${monthFilter}`,
    ) as any[]);
    const r = (rows as any[])[0]?.[0] ?? {};
    return { entrate: Number(r.entrate ?? 0), uscite: Number(r.uscite ?? 0) };
  },

  async monthlySeries(companyId: string) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
          SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
          SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
          FROM transazioni WHERE companyId=${companyId} AND deletedAt IS NULL
          AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b') ORDER BY y, m`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async byCategoria(companyId: string, limit = 6) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT categoria as name, SUM(importo) as value FROM transazioni
          WHERE tipo='uscita' AND companyId=${companyId} AND deletedAt IS NULL
          GROUP BY categoria ORDER BY value DESC LIMIT ${limit}`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async recentActivity(companyId: string, limit = 8) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT 'transazione' as tipo, descrizione as testo, data as quando FROM transazioni
          WHERE companyId=${companyId} AND deletedAt IS NULL
          ORDER BY createdAt DESC LIMIT ${limit}`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async insertTransazione(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(transazioni).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async softDeleteTransazione(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(transazioni).set(softDeletePayload(actor) as any)
      .where(and(eq(transazioni.id, id), eq(transazioni.companyId, actor.companyId)));
    return { success: true };
  },
};
