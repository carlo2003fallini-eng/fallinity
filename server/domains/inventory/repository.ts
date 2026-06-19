import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { prodotti, movimentiMagazzino } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** INVENTORY (Magazzino) — Repository */
export const inventoryRepository = {
  async listProdotti(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(prodotti)
      .where(and(eq(prodotti.companyId, companyId), isNull(prodotti.deletedAt)))
      .orderBy(prodotti.nome);
  },

  async listMovimenti(companyId: string, prodottoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(movimentiMagazzino)
      .where(and(eq(movimentiMagazzino.prodottoId, prodottoId), eq(movimentiMagazzino.companyId, companyId), isNull(movimentiMagazzino.deletedAt)))
      .orderBy(desc(movimentiMagazzino.data));
  },

  async getProdotto(id: string) {
    const db = await getDb();
    if (!db) return null;
    const [p] = await db.select().from(prodotti).where(eq(prodotti.id, id)).limit(1);
    return p ?? null;
  },

  async insertProdotto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(prodotti).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async insertMovimento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(movimentiMagazzino).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateQuantita(actor: ActorContext, prodottoId: string, quantita: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(prodotti).set(withUpdate(actor, { quantita }) as any).where(eq(prodotti.id, prodottoId));
  },

  async softDeleteProdotto(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(prodotti).set(softDeletePayload(actor) as any)
      .where(and(eq(prodotti.id, id), eq(prodotti.companyId, actor.companyId)));
    return { success: true };
  },
};
