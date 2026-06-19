import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { chatSessions, chatMessages } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** AI (Copilot) — Repository */
export const aiRepository = {
  async listSessions(companyId: string, userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(chatSessions)
      .where(and(eq(chatSessions.companyId, companyId), eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
      .orderBy(desc(chatSessions.createdAt)).limit(20);
  },

  async listMessages(companyId: string, sessionId: string, limit?: number) {
    const db = await getDb();
    if (!db) return [];
    const q = db.select().from(chatMessages)
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.companyId, companyId), isNull(chatMessages.deletedAt)))
      .orderBy(limit ? desc(chatMessages.createdAt) : asc(chatMessages.createdAt));
    return limit ? q.limit(limit) : q;
  },

  async insertSession(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(chatSessions).values(withCreate(actor, data) as any);
  },

  async insertMessage(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(chatMessages).values(withCreate(actor, data) as any);
  },

  async renameSession(actor: ActorContext, sessionId: string, titolo: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(chatSessions).set(withUpdate(actor, { titolo }) as any)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.companyId, actor.companyId)));
  },

  async softDeleteSession(actor: ActorContext, sessionId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(chatMessages).set(softDeletePayload(actor) as any)
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.companyId, actor.companyId)));
    await db.update(chatSessions).set(softDeletePayload(actor) as any)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.companyId, actor.companyId)));
    return { success: true };
  },

  /** KPI del mese corrente per arricchire il contesto del prompt. */
  async monthlyKpi(companyId: string) {
    const db = await getDb();
    if (!db) return { entrate: 0, uscite: 0 };
    const rows = (await db.execute(
      sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
          COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
          FROM transazioni WHERE companyId=${companyId} AND deletedAt IS NULL AND MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`,
    ) as any[]);
    const r = (rows as any[])[0]?.[0] ?? {};
    return { entrate: Number(r.entrate ?? 0), uscite: Number(r.uscite ?? 0) };
  },
};
