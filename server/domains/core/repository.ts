import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { companies, contatti } from "../../../drizzle/schema";
import { withCreate, softDeletePayload, type ActorContext } from "../_core";

/** CORE — Repository (company, contatti, conteggi operativi cross-dominio) */
export const coreRepository = {
  async currentCompany(companyId: string) {
    const db = await getDb();
    if (!db) return null;
    const [c] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    return c ?? null;
  },

  async listContatti(companyId: string, tipo?: "dipendente" | "fornitore" | "cliente") {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(contatti.companyId, companyId), isNull(contatti.deletedAt)];
    if (tipo) conds.push(eq(contatti.tipo, tipo));
    return db.select().from(contatti).where(and(...conds)).orderBy(contatti.nome);
  },

  async allContatti(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contatti).where(and(eq(contatti.companyId, companyId), isNull(contatti.deletedAt)));
  },

  async insertContatto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(contatti).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async softDeleteContatto(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(contatti).set(softDeletePayload(actor) as any)
      .where(and(eq(contatti.id, id), eq(contatti.companyId, actor.companyId)));
    return { success: true };
  },

  /** Conteggio generico multi-tenant su una tabella operativa. */
  async count(companyId: string, table: string, extra = "") {
    const db = await getDb();
    if (!db) return 0;
    const r = (await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${table} WHERE companyId='${companyId}' AND deletedAt IS NULL ${extra}`)) as any[]);
    return Number((r[0] as any[])[0]?.cnt ?? 0);
  },
};
