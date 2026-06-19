import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { macchine, interventi } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** FLEET (Officina) — Repository */
export const fleetRepository = {
  async listMacchine(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(macchine)
      .where(and(eq(macchine.companyId, companyId), isNull(macchine.deletedAt)))
      .orderBy(macchine.nome);
  },

  async listInterventi(companyId: string, macchinaId?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(interventi.companyId, companyId), isNull(interventi.deletedAt)];
    if (macchinaId) conds.push(eq(interventi.macchinaId, macchinaId));
    return db.select().from(interventi).where(and(...conds)).orderBy(desc(interventi.data)).limit(50);
  },

  async insertMacchina(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(macchine).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async insertIntervento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(interventi).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateStatoIntervento(actor: ActorContext, id: string, stato: "pianificato" | "in_corso" | "completato") {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(interventi).set(withUpdate(actor, { stato }) as any)
      .where(and(eq(interventi.id, id), eq(interventi.companyId, actor.companyId)));
    return { success: true };
  },

  async softDeleteMacchina(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(macchine).set(softDeletePayload(actor) as any)
      .where(and(eq(macchine.id, id), eq(macchine.companyId, actor.companyId)));
    return { success: true };
  },
};
