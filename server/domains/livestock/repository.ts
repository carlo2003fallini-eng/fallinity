import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { animali, gruppi, trattamentiAnimali, zoppie, eventiAnimale } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

/** LIVESTOCK (Stalla) — Repository */
export const livestockRepository = {
  // ── Gruppi ──
  async listGruppi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gruppi)
      .where(and(eq(gruppi.companyId, companyId), isNull(gruppi.deletedAt)))
      .orderBy(gruppi.nome);
  },

  async getGruppo(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(gruppi)
      .where(and(eq(gruppi.id, id), eq(gruppi.companyId, companyId), isNull(gruppi.deletedAt)));
    return rows[0] ?? null;
  },

  async countGruppi(companyId: string) {
    const db = await getDb();
    if (!db) return 0;
    const r = await db.execute(sql`SELECT COUNT(*) as cnt FROM gruppi WHERE companyId=${companyId} AND deletedAt IS NULL`);
    return Number((r as unknown as any[][])[0]?.[0]?.cnt ?? 0);
  },

  async insertGruppo(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(gruppi).values(row as any);
    return row;
  },

  async updateGruppo(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(gruppi).set(withUpdate(actor, data) as any)
      .where(and(eq(gruppi.id, id), eq(gruppi.companyId, actor.companyId)));
    return { success: true };
  },

  async archiveGruppo(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(gruppi).set(softDeletePayload(actor) as any)
      .where(and(eq(gruppi.id, id), eq(gruppi.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Animali ──
  async listAnimali(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(animali)
      .where(and(eq(animali.companyId, companyId), isNull(animali.deletedAt)))
      .orderBy(animali.matricola);
  },

  async listAnimaliByGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(animali)
      .where(and(eq(animali.companyId, companyId), eq(animali.gruppoId, gruppoId), isNull(animali.deletedAt)))
      .orderBy(animali.matricola);
  },

  async getAnimale(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(animali)
      .where(and(eq(animali.id, id), eq(animali.companyId, companyId), isNull(animali.deletedAt)));
    return rows[0] ?? null;
  },

  async ricercaAnimali(companyId: string, query: string) {
    const db = await getDb();
    if (!db) return [];
    const pattern = `%${query}%`;
    return db.select().from(animali)
      .where(and(
        eq(animali.companyId, companyId),
        isNull(animali.deletedAt),
        or(
          like(animali.matricola, pattern),
          like(animali.numeroAziendale, pattern),
          like(animali.nome, pattern),
          like(animali.rfid, pattern),
        ),
      ))
      .orderBy(animali.matricola)
      .limit(20);
  },

  async insertAnimale(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(animali).values(row as any);
    return row;
  },

  async updateAnimale(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(animali).set(withUpdate(actor, data) as any)
      .where(and(eq(animali.id, id), eq(animali.companyId, actor.companyId)));
    return { success: true };
  },

  async countAnimaliByGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return { totale: 0, inLattazione: 0, gravide: 0, manze: 0 };
    const r = await db.execute(sql`
      SELECT
        COUNT(*) as totale,
        SUM(CASE WHEN statoProduttivo='in_lattazione' THEN 1 ELSE 0 END) as inLattazione,
        SUM(CASE WHEN statoRiproduttivo='gravida' THEN 1 ELSE 0 END) as gravide,
        SUM(CASE WHEN statoProduttivo='manza' THEN 1 ELSE 0 END) as manze
      FROM animali
      WHERE companyId=${companyId} AND gruppoId=${gruppoId} AND deletedAt IS NULL
    `);
    const row = (r as unknown as any[][])[0]?.[0] ?? {};
    return {
      totale: Number(row.totale ?? 0),
      inLattazione: Number(row.inLattazione ?? 0),
      gravide: Number(row.gravide ?? 0),
      manze: Number(row.manze ?? 0),
    };
  },

  async produzioneMediaGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return 0;
    const r = await db.execute(sql`
      SELECT AVG(CAST(produzioneOggi AS DECIMAL(8,2))) as avg_prod
      FROM animali
      WHERE companyId=${companyId} AND gruppoId=${gruppoId} AND deletedAt IS NULL AND statoProduttivo='in_lattazione'
    `);
    return Number((r as unknown as any[][])[0]?.[0]?.avg_prod ?? 0);
  },

  // ── Zoppie ──
  async listZoppie(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(zoppie)
      .where(and(eq(zoppie.companyId, companyId), isNull(zoppie.deletedAt)))
      .orderBy(desc(zoppie.createdAt));
  },

  async insertZoppia(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(zoppie).values(withCreate(actor, data) as any);
    return { success: true };
  },

  // ── Eventi Animale ──
  async listEventiAnimale(companyId: string, animaleId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(eventiAnimale)
      .where(and(eq(eventiAnimale.companyId, companyId), eq(eventiAnimale.animaleId, animaleId), isNull(eventiAnimale.deletedAt)))
      .orderBy(desc(eventiAnimale.data));
  },

  async insertEventoAnimale(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(eventiAnimale).values(row as any);
    return row;
  },

  // ── Stats (legacy) ──
  async stats(companyId: string) {
    const db = await getDb();
    if (!db) return { sincronizzazioniOggi: 0, zoppieAperte: 0, trattamentiPianificati: 0, partiMese: 0 };
    const scalar = async (q: any) => {
      const r = await db.execute(q);
      return Number((r as unknown as any[][])[0]?.[0]?.cnt ?? 0);
    };
    return {
      sincronizzazioniOggi: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND tipo='sincronizzazione' AND stato='pianificato' AND DATE(dataTrattamento)=CURDATE()`),
      zoppieAperte: await scalar(sql`SELECT COUNT(*) as cnt FROM zoppie WHERE companyId=${companyId} AND deletedAt IS NULL AND stato!='risolta'`),
      trattamentiPianificati: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='pianificato'`),
      partiMese: await scalar(sql`SELECT COUNT(*) as cnt FROM gravidanze WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='in_corso' AND MONTH(dataPartoPrevisto)=MONTH(NOW()) AND YEAR(dataPartoPrevisto)=YEAR(NOW())`),
    };
  },

  async eseguiTrattamento(actor: ActorContext, animaleId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(trattamentiAnimali).set(withUpdate(actor, { stato: "eseguito" }) as any)
      .where(and(eq(trattamentiAnimali.animaleId, animaleId), eq(trattamentiAnimali.stato, "pianificato"), eq(trattamentiAnimali.companyId, actor.companyId)));
    return { success: true };
  },
};
