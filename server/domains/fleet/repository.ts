import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import {
  macchine,
  interventi,
  ricambi,
  interventoRicambi,
  macchinaDocumenti,
} from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** FLEET (Officina) — Repository (query pure Drizzle, multi-tenant + soft-delete) */
export const fleetRepository = {
  // ── Macchine ────────────────────────────────────────────────────────────────
  async listMacchine(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(macchine)
      .where(and(eq(macchine.companyId, companyId), isNull(macchine.deletedAt)))
      .orderBy(asc(macchine.nome));
  },

  async getMacchina(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(macchine)
      .where(and(eq(macchine.id, id), eq(macchine.companyId, companyId), isNull(macchine.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  },

  async insertMacchina(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(macchine).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateMacchina(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(macchine)
      .set(withUpdate(actor, data) as any)
      .where(and(eq(macchine.id, id), eq(macchine.companyId, actor.companyId)));
    return { success: true };
  },

  async softDeleteMacchina(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(macchine)
      .set(softDeletePayload(actor) as any)
      .where(and(eq(macchine.id, id), eq(macchine.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Documenti macchina ────────────────────────────────────────────────────────
  async listDocumenti(companyId: string, macchinaId: string) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(macchinaDocumenti)
      .where(
        and(
          eq(macchinaDocumenti.companyId, companyId),
          eq(macchinaDocumenti.macchinaId, macchinaId),
          isNull(macchinaDocumenti.deletedAt),
        ),
      )
      .orderBy(desc(macchinaDocumenti.createdAt));
  },

  async insertDocumento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(macchinaDocumenti).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async softDeleteDocumento(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(macchinaDocumenti)
      .set(softDeletePayload(actor) as any)
      .where(and(eq(macchinaDocumenti.id, id), eq(macchinaDocumenti.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Interventi ──────────────────────────────────────────────────────────────
  async listInterventi(
    companyId: string,
    filters?: { macchinaId?: string; stato?: string; priorita?: string; tipo?: string },
  ) {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(interventi.companyId, companyId), isNull(interventi.deletedAt)];
    if (filters?.macchinaId) conds.push(eq(interventi.macchinaId, filters.macchinaId));
    if (filters?.stato) conds.push(eq(interventi.stato, filters.stato as any));
    if (filters?.priorita) conds.push(eq(interventi.priorita, filters.priorita as any));
    if (filters?.tipo) conds.push(eq(interventi.tipo, filters.tipo as any));
    return db.select().from(interventi).where(and(...conds)).orderBy(desc(interventi.data)).limit(200);
  },

  async getIntervento(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(interventi)
      .where(and(eq(interventi.id, id), eq(interventi.companyId, companyId), isNull(interventi.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  },

  async insertIntervento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const payload = withCreate(actor, data) as any;
    await db.insert(interventi).values(payload);
    return { id: payload.id as string, success: true };
  },

  async updateIntervento(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(interventi)
      .set(withUpdate(actor, data) as any)
      .where(and(eq(interventi.id, id), eq(interventi.companyId, actor.companyId)));
    return { success: true };
  },

  async softDeleteIntervento(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(interventi)
      .set(softDeletePayload(actor) as any)
      .where(and(eq(interventi.id, id), eq(interventi.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Intervento <-> Ricambi (richiesti / utilizzati) ─────────────────────────────
  async listInterventoRicambi(companyId: string, interventoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(interventoRicambi)
      .where(
        and(
          eq(interventoRicambi.companyId, companyId),
          eq(interventoRicambi.interventoId, interventoId),
          isNull(interventoRicambi.deletedAt),
        ),
      );
  },

  async insertInterventoRicambio(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(interventoRicambi).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateInterventoRicambio(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(interventoRicambi)
      .set(withUpdate(actor, data) as any)
      .where(and(eq(interventoRicambi.id, id), eq(interventoRicambi.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Ricambi (magazzino officina) ────────────────────────────────────────────────
  async listRicambi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(ricambi)
      .where(and(eq(ricambi.companyId, companyId), isNull(ricambi.deletedAt)))
      .orderBy(asc(ricambi.nome));
  },

  async getRicambio(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(ricambi)
      .where(and(eq(ricambi.id, id), eq(ricambi.companyId, companyId), isNull(ricambi.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  },

  async insertRicambio(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(ricambi).values(withCreate(actor, data) as any);
    return { success: true };
  },

  async updateRicambio(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(ricambi)
      .set(withUpdate(actor, data) as any)
      .where(and(eq(ricambi.id, id), eq(ricambi.companyId, actor.companyId)));
    return { success: true };
  },

  async softDeleteRicambio(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .update(ricambi)
      .set(softDeletePayload(actor) as any)
      .where(and(eq(ricambi.id, id), eq(ricambi.companyId, actor.companyId)));
    return { success: true };
  },
};
