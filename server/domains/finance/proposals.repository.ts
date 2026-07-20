import { eq, and, isNull, desc, or, like, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { proposteFinanziarie, integrationSettings } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, newId, type ActorContext } from "../_core";
import type { StatoProposta, OriginModule } from "./proposals.validators";

/**
 * FINANCE — Proposals Repository
 * Accesso dati puro per proposte finanziarie e impostazioni integrazione.
 */
export const proposalsRepository = {
  // ══════════════════════════════════════════════════════════════════════════
  // PROPOSTE FINANZIARIE
  // ══════════════════════════════════════════════════════════════════════════

  /** Trova proposta per chiave di idempotenza (companyId + originModule + originEntityId + originEventType) */
  async findByOrigin(companyId: string, originModule: string, originEntityId: string, originEventType: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(proposteFinanziarie).where(
      and(
        eq(proposteFinanziarie.companyId, companyId),
        eq(proposteFinanziarie.originModule, originModule),
        eq(proposteFinanziarie.originEntityId, originEntityId),
        eq(proposteFinanziarie.originEventType, originEventType),
        isNull(proposteFinanziarie.deletedAt),
      ),
    );
    return rows[0] ?? null;
  },

  /** Inserisce una nuova proposta */
  async insert(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(proposteFinanziarie).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },

  /** Aggiorna una proposta */
  async update(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(proposteFinanziarie).set(withUpdate(actor, data) as any)
      .where(and(eq(proposteFinanziarie.id, id), eq(proposteFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },

  /** Ottieni proposta per ID */
  async getById(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(proposteFinanziarie).where(
      and(
        eq(proposteFinanziarie.id, id),
        eq(proposteFinanziarie.companyId, companyId),
        isNull(proposteFinanziarie.deletedAt),
      ),
    );
    return rows[0] ?? null;
  },

  /** Lista proposte con filtri */
  async list(companyId: string, filters?: {
    stato?: StatoProposta;
    originModule?: OriginModule;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [
      eq(proposteFinanziarie.companyId, companyId),
      isNull(proposteFinanziarie.deletedAt),
    ];
    if (filters?.stato) conds.push(eq(proposteFinanziarie.stato, filters.stato));
    if (filters?.originModule) conds.push(eq(proposteFinanziarie.originModule, filters.originModule));
    if (filters?.search) {
      conds.push(or(
        like(proposteFinanziarie.descrizione, `%${filters.search}%`),
        like(proposteFinanziarie.originReference, `%${filters.search}%`),
      ));
    }
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    return db.select().from(proposteFinanziarie).where(and(...conds))
      .orderBy(desc(proposteFinanziarie.createdAt)).limit(limit).offset(offset);
  },

  /** Conta proposte per stato */
  async countByStato(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(
      sql`SELECT stato, COUNT(*) as count FROM proposteFinanziarie
          WHERE companyId=${companyId} AND deletedAt IS NULL
          GROUP BY stato`,
    );
    return (rows as any[])[0] as Array<{ stato: string; count: number }> ?? [];
  },

  /** Trova tutte le proposte per un'entità di origine */
  async findByEntity(companyId: string, originModule: string, originEntityId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(proposteFinanziarie).where(
      and(
        eq(proposteFinanziarie.companyId, companyId),
        eq(proposteFinanziarie.originModule, originModule),
        eq(proposteFinanziarie.originEntityId, originEntityId),
        isNull(proposteFinanziarie.deletedAt),
      ),
    ).orderBy(desc(proposteFinanziarie.createdAt));
  },

  /** Soft delete proposta */
  async softDelete(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(proposteFinanziarie).set(softDeletePayload(actor) as any)
      .where(and(eq(proposteFinanziarie.id, id), eq(proposteFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  /** Ottieni impostazioni per modulo */
  async getSettings(companyId: string, modulo: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(integrationSettings).where(
      and(
        eq(integrationSettings.companyId, companyId),
        eq(integrationSettings.modulo, modulo),
        isNull(integrationSettings.deletedAt),
      ),
    );
    return rows[0] ?? null;
  },

  /** Lista tutte le impostazioni per company */
  async listSettings(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(integrationSettings).where(
      and(
        eq(integrationSettings.companyId, companyId),
        isNull(integrationSettings.deletedAt),
      ),
    );
  },

  /** Upsert impostazioni (insert or update) */
  async upsertSettings(actor: ActorContext, modulo: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const existing = await this.getSettings(actor.companyId, modulo);
    if (existing) {
      await db.update(integrationSettings).set(withUpdate(actor, data) as any)
        .where(and(eq(integrationSettings.id, existing.id), eq(integrationSettings.companyId, actor.companyId)));
      return { id: existing.id };
    } else {
      const id = newId();
      await db.insert(integrationSettings).values(withCreate(actor, { ...data, modulo, id }) as any);
      return { id };
    }
  },
};
