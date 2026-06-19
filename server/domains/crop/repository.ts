import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { campi, lavorazioni } from "../../../drizzle/schema";
import { withCreate, softDeletePayload, type ActorContext } from "../_core";

/** CROP (Campi) — Repository */
export const cropRepository = {
  async listCampi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(campi)
      .where(and(eq(campi.companyId, companyId), isNull(campi.deletedAt)))
      .orderBy(campi.nome);
  },

  async listLavorazioni(companyId: string, campoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(lavorazioni)
      .where(and(eq(lavorazioni.campoId, campoId), eq(lavorazioni.companyId, companyId), isNull(lavorazioni.deletedAt)))
      .orderBy(desc(lavorazioni.data));
  },

  async insertCampo(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(campi).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async insertLavorazione(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(lavorazioni).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async softDeleteCampo(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(campi).set(softDeletePayload(actor) as any)
      .where(and(eq(campi.id, id), eq(campi.companyId, actor.companyId)));
    return { success: true };
  },
};
