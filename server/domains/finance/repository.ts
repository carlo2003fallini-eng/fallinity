import { and, desc, eq, isNull, sql, like, or, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  transazioni,
  categorieFinanziarie,
  centriDiCosto,
  soggetti,
  contiFin,
  metodiPagamento,
  documentiFinanziari,
  scadenzeFinanziarie,
  pagamentiIncassi,
  movimentiCassa,
  registrazioniEconomiche,
  allegatiFinanziari,
  ricorrenzeFinanziarie,
} from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, tenantScope, newId, type ActorContext } from "../_core";

/**
 * FINANCE — Repository
 * Accesso dati puro: nessuna logica di business, solo query Drizzle/SQL.
 * Multi-tenant (filtra companyId) e soft-delete.
 */
export const financeRepository = {
  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY — transazioni (retrocompatibilità dashboard)
  // ══════════════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORIE FINANZIARIE
  // ══════════════════════════════════════════════════════════════════════════
  async listCategorie(companyId: string, tipo?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(categorieFinanziarie.companyId, companyId), isNull(categorieFinanziarie.deletedAt)];
    if (tipo && tipo !== "entrambi") {
      conds.push(or(eq(categorieFinanziarie.tipo, tipo as any), eq(categorieFinanziarie.tipo, "entrambi")));
    }
    return db.select().from(categorieFinanziarie).where(and(...conds)).orderBy(asc(categorieFinanziarie.ordine));
  },
  async insertCategoria(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(categorieFinanziarie).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateCategoria(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(categorieFinanziarie).set(withUpdate(actor, data) as any)
      .where(and(eq(categorieFinanziarie.id, id), eq(categorieFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CENTRI DI COSTO
  // ══════════════════════════════════════════════════════════════════════════
  async listCentriCosto(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(centriDiCosto)
      .where(and(eq(centriDiCosto.companyId, companyId), isNull(centriDiCosto.deletedAt)));
  },
  async insertCentroCosto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(centriDiCosto).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateCentroCosto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(centriDiCosto).set(withUpdate(actor, data) as any)
      .where(and(eq(centriDiCosto.id, id), eq(centriDiCosto.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOGGETTI
  // ══════════════════════════════════════════════════════════════════════════
  async listSoggetti(companyId: string, tipologia?: string, search?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(soggetti.companyId, companyId), isNull(soggetti.deletedAt)];
    if (tipologia && tipologia !== "entrambi") {
      conds.push(or(eq(soggetti.tipologia, tipologia as any), eq(soggetti.tipologia, "entrambi")));
    }
    if (search) {
      conds.push(or(
        like(soggetti.ragioneSociale, `%${search}%`),
        like(soggetti.nomeBreve, `%${search}%`),
        like(soggetti.partitaIva, `%${search}%`),
      ));
    }
    return db.select().from(soggetti).where(and(...conds)).orderBy(asc(soggetti.ragioneSociale)).limit(100);
  },
  async getSoggetto(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(soggetti)
      .where(and(eq(soggetti.id, id), eq(soggetti.companyId, companyId), isNull(soggetti.deletedAt)));
    return rows[0] ?? null;
  },
  async insertSoggetto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(soggetti).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateSoggetto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(soggetti).set(withUpdate(actor, data) as any)
      .where(and(eq(soggetti.id, id), eq(soggetti.companyId, actor.companyId)));
    return { success: true };
  },
  async softDeleteSoggetto(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(soggetti).set(softDeletePayload(actor) as any)
      .where(and(eq(soggetti.id, id), eq(soggetti.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONTI FINANZIARI
  // ══════════════════════════════════════════════════════════════════════════
  async listConti(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contiFin)
      .where(and(eq(contiFin.companyId, companyId), isNull(contiFin.deletedAt)));
  },
  async getConto(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(contiFin)
      .where(and(eq(contiFin.id, id), eq(contiFin.companyId, companyId), isNull(contiFin.deletedAt)));
    return rows[0] ?? null;
  },
  async insertConto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    const saldoIniziale = (data.saldoIniziale as number) ?? 0;
    await db.insert(contiFin).values(withCreate(actor, { ...data, id, saldoAttuale: saldoIniziale }) as any);
    return { id };
  },
  async updateConto(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(contiFin).set(withUpdate(actor, data) as any)
      .where(and(eq(contiFin.id, id), eq(contiFin.companyId, actor.companyId)));
    return { success: true };
  },
  async updateSaldoConto(companyId: string, contoId: string, nuovoSaldo: number) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(contiFin).set({ saldoAttuale: nuovoSaldo } as any)
      .where(and(eq(contiFin.id, contoId), eq(contiFin.companyId, companyId)));
  },

  // ══════════════════════════════════════════════════════════════════════════
  // METODI DI PAGAMENTO
  // ══════════════════════════════════════════════════════════════════════════
  async listMetodi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(metodiPagamento)
      .where(and(eq(metodiPagamento.companyId, companyId), isNull(metodiPagamento.deletedAt)));
  },
  async insertMetodo(actor: ActorContext, nome: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(metodiPagamento).values(withCreate(actor, { id, nome }) as any);
    return { id };
  },
  async updateMetodo(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(metodiPagamento).set(withUpdate(actor, data) as any)
      .where(and(eq(metodiPagamento.id, id), eq(metodiPagamento.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENTI FINANZIARI
  // ══════════════════════════════════════════════════════════════════════════
  async listDocumenti(companyId: string, filters?: {
    tipo?: string; stato?: string; categoriaId?: string; centroCostoId?: string;
    contoId?: string; soggettoId?: string; search?: string;
    dataInizio?: string; dataFine?: string; limit?: number; offset?: number;
  }) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(documentiFinanziari.companyId, companyId), isNull(documentiFinanziari.deletedAt)];
    if (filters?.tipo) conds.push(eq(documentiFinanziari.tipo, filters.tipo as any));
    if (filters?.stato) conds.push(eq(documentiFinanziari.stato, filters.stato as any));
    if (filters?.categoriaId) conds.push(eq(documentiFinanziari.categoriaId, filters.categoriaId));
    if (filters?.centroCostoId) conds.push(eq(documentiFinanziari.centroCostoId, filters.centroCostoId));
    if (filters?.soggettoId) conds.push(eq(documentiFinanziari.soggettoId, filters.soggettoId));
    if (filters?.search) {
      conds.push(or(
        like(documentiFinanziari.descrizione, `%${filters.search}%`),
        like(documentiFinanziari.numero, `%${filters.search}%`),
      ));
    }
    if (filters?.dataInizio) conds.push(sql`dataDocumento >= ${filters.dataInizio}`);
    if (filters?.dataFine) conds.push(sql`dataDocumento <= ${filters.dataFine}`);
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    return db.select().from(documentiFinanziari).where(and(...conds))
      .orderBy(desc(documentiFinanziari.dataDocumento)).limit(limit).offset(offset);
  },
  async getDocumento(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(documentiFinanziari)
      .where(and(eq(documentiFinanziari.id, id), eq(documentiFinanziari.companyId, companyId), isNull(documentiFinanziari.deletedAt)));
    return rows[0] ?? null;
  },
  async insertDocumento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(documentiFinanziari).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateDocumento(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(documentiFinanziari).set(withUpdate(actor, data) as any)
      .where(and(eq(documentiFinanziari.id, id), eq(documentiFinanziari.companyId, actor.companyId)));
    return { success: true };
  },
  async softDeleteDocumento(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(documentiFinanziari).set(softDeletePayload(actor) as any)
      .where(and(eq(documentiFinanziari.id, id), eq(documentiFinanziari.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SCADENZE
  // ══════════════════════════════════════════════════════════════════════════
  async listScadenze(companyId: string, documentoId?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(scadenzeFinanziarie.companyId, companyId), isNull(scadenzeFinanziarie.deletedAt)];
    if (documentoId) conds.push(eq(scadenzeFinanziarie.documentoId, documentoId));
    return db.select().from(scadenzeFinanziarie).where(and(...conds)).orderBy(asc(scadenzeFinanziarie.dataScadenza));
  },
  async insertScadenza(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(scadenzeFinanziarie).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateScadenza(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(scadenzeFinanziarie).set(withUpdate(actor, data) as any)
      .where(and(eq(scadenzeFinanziarie.id, id), eq(scadenzeFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PAGAMENTI / INCASSI
  // ══════════════════════════════════════════════════════════════════════════
  async listPagamenti(companyId: string, documentoId?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(pagamentiIncassi.companyId, companyId), isNull(pagamentiIncassi.deletedAt)];
    if (documentoId) conds.push(eq(pagamentiIncassi.documentoId, documentoId));
    return db.select().from(pagamentiIncassi).where(and(...conds)).orderBy(desc(pagamentiIncassi.data));
  },
  async insertPagamento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(pagamentiIncassi).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updatePagamento(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(pagamentiIncassi).set(withUpdate(actor, data) as any)
      .where(and(eq(pagamentiIncassi.id, id), eq(pagamentiIncassi.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MOVIMENTI CASSA
  // ══════════════════════════════════════════════════════════════════════════
  async listMovimentiCassa(companyId: string, contoId?: string, limit = 50) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(movimentiCassa.companyId, companyId), isNull(movimentiCassa.deletedAt)];
    if (contoId) conds.push(eq(movimentiCassa.contoId, contoId));
    return db.select().from(movimentiCassa).where(and(...conds)).orderBy(desc(movimentiCassa.data)).limit(limit);
  },
  async insertMovimentoCassa(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(movimentiCassa).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateMovimentoCassa(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(movimentiCassa).set(withUpdate(actor, data) as any)
      .where(and(eq(movimentiCassa.id, id), eq(movimentiCassa.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRAZIONI ECONOMICHE
  // ══════════════════════════════════════════════════════════════════════════
  async insertRegistrazione(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(registrazioniEconomiche).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ALLEGATI
  // ══════════════════════════════════════════════════════════════════════════
  async listAllegati(companyId: string, documentoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(allegatiFinanziari)
      .where(and(eq(allegatiFinanziari.companyId, companyId), eq(allegatiFinanziari.documentoId, documentoId), isNull(allegatiFinanziari.deletedAt)));
  },
  async insertAllegato(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(allegatiFinanziari).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async softDeleteAllegato(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(allegatiFinanziari).set(softDeletePayload(actor) as any)
      .where(and(eq(allegatiFinanziari.id, id), eq(allegatiFinanziari.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // FASE 2 — Ricorrenze
  // ══════════════════════════════════════════════════════════════════════════════
  async listRicorrenze(companyId: string, attiva?: boolean) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(ricorrenzeFinanziarie.companyId, companyId), isNull(ricorrenzeFinanziarie.deletedAt)];
    if (attiva !== undefined) conds.push(eq(ricorrenzeFinanziarie.attiva, attiva));
    return db.select().from(ricorrenzeFinanziarie).where(and(...conds)).orderBy(asc(ricorrenzeFinanziarie.prossimaEmissione));
  },
  async getRicorrenza(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(ricorrenzeFinanziarie)
      .where(and(eq(ricorrenzeFinanziarie.id, id), eq(ricorrenzeFinanziarie.companyId, companyId), isNull(ricorrenzeFinanziarie.deletedAt)));
    return rows[0] ?? null;
  },
  async insertRicorrenza(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(ricorrenzeFinanziarie).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateRicorrenza(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(ricorrenzeFinanziarie).set(withUpdate(actor, data) as any)
      .where(and(eq(ricorrenzeFinanziarie.id, id), eq(ricorrenzeFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },
  async softDeleteRicorrenza(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(ricorrenzeFinanziarie).set(softDeletePayload(actor) as any)
      .where(and(eq(ricorrenzeFinanziarie.id, id), eq(ricorrenzeFinanziarie.companyId, actor.companyId)));
    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // FASE 2 — Query avanzate
  // ══════════════════════════════════════════════════════════════════════════════
  /** Conta documenti per generare codice sequenziale DOC-ENT-000001 */
  async countDocumenti(companyId: string, tipo: "entrata" | "uscita") {
    const db = await getDb();
    if (!db) return 0;
    const rows = (await db.execute(
      sql`SELECT COUNT(*) as cnt FROM documentiFinanziari WHERE companyId=${companyId} AND tipo=${tipo}`,
    ) as any[]);
    return Number((rows as any[])[0]?.[0]?.cnt ?? 0);
  },
  /** Ottieni scadenza singola */
  async getScadenza(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(scadenzeFinanziarie)
      .where(and(eq(scadenzeFinanziarie.id, id), eq(scadenzeFinanziarie.companyId, companyId), isNull(scadenzeFinanziarie.deletedAt)));
    return rows[0] ?? null;
  },
  /** Ottieni pagamento singolo */
  async getPagamento(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(pagamentiIncassi)
      .where(and(eq(pagamentiIncassi.id, id), eq(pagamentiIncassi.companyId, companyId), isNull(pagamentiIncassi.deletedAt)));
    return rows[0] ?? null;
  },
  /** Lista scadenze con filtri avanzati */
  async listScadenzeAvanzate(companyId: string, filters?: {
    stato?: string; documentoId?: string; dataInizio?: string; dataFine?: string; limit?: number;
  }) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(scadenzeFinanziarie.companyId, companyId), isNull(scadenzeFinanziarie.deletedAt)];
    if (filters?.stato) conds.push(eq(scadenzeFinanziarie.stato, filters.stato as any));
    if (filters?.documentoId) conds.push(eq(scadenzeFinanziarie.documentoId, filters.documentoId));
    if (filters?.dataInizio) conds.push(sql`dataScadenza >= ${filters.dataInizio}`);
    if (filters?.dataFine) conds.push(sql`dataScadenza <= ${filters.dataFine}`);
    return db.select().from(scadenzeFinanziarie).where(and(...conds))
      .orderBy(asc(scadenzeFinanziarie.dataScadenza)).limit(filters?.limit ?? 50);
  },
  /** Lista crediti (documenti entrata con residuo > 0) */
  async listCrediti(companyId: string, limit = 50) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [
      eq(documentiFinanziari.companyId, companyId),
      eq(documentiFinanziari.tipo, "entrata"),
      isNull(documentiFinanziari.deletedAt),
      sql`residuo > 0`,
      sql`stato != 'annullato'`,
    ];
    return db.select().from(documentiFinanziari).where(and(...conds))
      .orderBy(desc(documentiFinanziari.dataDocumento)).limit(limit);
  },
  /** Lista debiti (documenti uscita con residuo > 0) */
  async listDebiti(companyId: string, limit = 50) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [
      eq(documentiFinanziari.companyId, companyId),
      eq(documentiFinanziari.tipo, "uscita"),
      isNull(documentiFinanziari.deletedAt),
      sql`residuo > 0`,
      sql`stato != 'annullato'`,
    ];
    return db.select().from(documentiFinanziari).where(and(...conds))
      .orderBy(desc(documentiFinanziari.dataDocumento)).limit(limit);
  },
  /** Somma residui per tipo */
  async sumResidui(companyId: string) {
    const db = await getDb();
    if (!db) return { crediti: 0, debiti: 0 };
    const rows = (await db.execute(
      sql`SELECT
        COALESCE(SUM(CASE WHEN tipo='entrata' AND stato!='annullato' THEN residuo ELSE 0 END),0) as crediti,
        COALESCE(SUM(CASE WHEN tipo='uscita' AND stato!='annullato' THEN residuo ELSE 0 END),0) as debiti
        FROM documentiFinanziari WHERE companyId=${companyId} AND deletedAt IS NULL`,
    ) as any[]);
    const r = (rows as any[])[0]?.[0] ?? {};
    return { crediti: Number(r.crediti ?? 0), debiti: Number(r.debiti ?? 0) };
  },
  /** Annulla tutte le scadenze di un documento */
  async annullaScadenzeDocumento(actor: ActorContext, documentoId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(scadenzeFinanziarie).set(withUpdate(actor, { stato: "annullata" }) as any)
      .where(and(
        eq(scadenzeFinanziarie.documentoId, documentoId),
        eq(scadenzeFinanziarie.companyId, actor.companyId),
      ));
  },
};
