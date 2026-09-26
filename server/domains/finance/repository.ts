import { and, desc, eq, getTableColumns, inArray, isNull, sql, like, or, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  transazioni,
  categorieFinanziarie,
  categorieCentriCosto,
  categorieCentroSottocategorie,
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
  acquisizioniFatture,
  ricorrenzeFinanziarie,
} from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, tenantScope, newId, type ActorContext } from "../_core";

function businessIsoDate(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Data di scadenza non valida");
  return date.toISOString().slice(0, 10);
}

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
  async listCategorie(companyId: string, tipo?: string, centroCostoId?: string, categoriaCentroId?: string) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(categorieFinanziarie.companyId, companyId), isNull(categorieFinanziarie.deletedAt)];
    if (tipo && tipo !== "entrambi") {
      conds.push(or(eq(categorieFinanziarie.tipo, tipo as any), eq(categorieFinanziarie.tipo, "entrambi")));
    }
    const categorie = await db.select().from(categorieFinanziarie).where(and(...conds)).orderBy(asc(categorieFinanziarie.ordine));
    let categoriaId = categoriaCentroId;
    if (!categoriaId && centroCostoId) {
      const centro = await this.getCentroCosto(companyId, centroCostoId);
      categoriaId = centro?.categoriaCentroId ?? undefined;
    }
    if (!categoriaId) return categorie;
    const relazioni = await db.select({ sottocategoriaId: categorieCentroSottocategorie.sottocategoriaId })
      .from(categorieCentroSottocategorie)
      .where(and(
        eq(categorieCentroSottocategorie.companyId, companyId),
        eq(categorieCentroSottocategorie.categoriaCentroId, categoriaId),
        isNull(categorieCentroSottocategorie.deletedAt),
      ));
    const idsConsentiti = new Set(relazioni.map((relazione) => relazione.sottocategoriaId));
    return categorie.filter((categoria) => idsConsentiti.has(categoria.id));
  },
  async getCategoria(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(categorieFinanziarie).where(and(
      eq(categorieFinanziarie.companyId, companyId),
      eq(categorieFinanziarie.id, id),
      isNull(categorieFinanziarie.deletedAt),
    )).limit(1);
    return rows[0] ?? null;
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
  async replaceCategoriaCentroRelations(actor: ActorContext, sottocategoriaId: string, categoriaCentroIds: string[]) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.transaction(async (tx) => {
      await tx.update(categorieCentroSottocategorie).set(softDeletePayload(actor) as any).where(and(
        eq(categorieCentroSottocategorie.companyId, actor.companyId),
        eq(categorieCentroSottocategorie.sottocategoriaId, sottocategoriaId),
        isNull(categorieCentroSottocategorie.deletedAt),
      ));
      for (const categoriaCentroId of categoriaCentroIds) {
        await tx.insert(categorieCentroSottocategorie).values(withCreate(actor, {
          id: newId(), categoriaCentroId, sottocategoriaId,
        }) as any).onDuplicateKeyUpdate({
          set: { deletedAt: null, deletedBy: null, updatedAt: new Date(), updatedBy: actor.userUuid } as any,
        });
      }
    });
  },
  async replaceSottocategorieForCategoriaCentro(actor: ActorContext, categoriaCentroId: string, sottocategoriaIds: string[]) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.transaction(async (tx) => {
      await tx.update(categorieCentroSottocategorie).set(softDeletePayload(actor) as any).where(and(
        eq(categorieCentroSottocategorie.companyId, actor.companyId),
        eq(categorieCentroSottocategorie.categoriaCentroId, categoriaCentroId),
        isNull(categorieCentroSottocategorie.deletedAt),
      ));
      for (const sottocategoriaId of sottocategoriaIds) {
        await tx.insert(categorieCentroSottocategorie).values(withCreate(actor, {
          id: newId(), categoriaCentroId, sottocategoriaId,
        }) as any).onDuplicateKeyUpdate({
          set: { deletedAt: null, deletedBy: null, updatedAt: new Date(), updatedBy: actor.userUuid } as any,
        });
      }
    });
  },
  async isSottocategoriaAllowed(companyId: string, categoriaCentroId: string, sottocategoriaId: string) {
    const db = await getDb();
    if (!db) return false;
    const rows = await db.select({ id: categorieCentroSottocategorie.id }).from(categorieCentroSottocategorie).where(and(
      eq(categorieCentroSottocategorie.companyId, companyId),
      eq(categorieCentroSottocategorie.categoriaCentroId, categoriaCentroId),
      eq(categorieCentroSottocategorie.sottocategoriaId, sottocategoriaId),
      isNull(categorieCentroSottocategorie.deletedAt),
    )).limit(1);
    return rows.length > 0;
  },
  async listCategoriaCentroRelations(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      categoriaCentroId: categorieCentroSottocategorie.categoriaCentroId,
      sottocategoriaId: categorieCentroSottocategorie.sottocategoriaId,
    }).from(categorieCentroSottocategorie).where(and(
      eq(categorieCentroSottocategorie.companyId, companyId),
      isNull(categorieCentroSottocategorie.deletedAt),
    ));
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORIE DEI CENTRI DI COSTO
  // ══════════════════════════════════════════════════════════════════════════
  async listCategorieCentri(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(categorieCentriCosto).where(and(
      eq(categorieCentriCosto.companyId, companyId),
      isNull(categorieCentriCosto.deletedAt),
    )).orderBy(asc(categorieCentriCosto.ordine), asc(categorieCentriCosto.nome));
  },
  async getCategoriaCentro(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(categorieCentriCosto).where(and(
      eq(categorieCentriCosto.companyId, companyId),
      eq(categorieCentriCosto.id, id),
      isNull(categorieCentriCosto.deletedAt),
    )).limit(1);
    return rows[0] ?? null;
  },
  async insertCategoriaCentro(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const id = newId();
    await db.insert(categorieCentriCosto).values(withCreate(actor, { ...data, id }) as any);
    return { id };
  },
  async updateCategoriaCentro(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(categorieCentriCosto).set(withUpdate(actor, data) as any).where(and(
      eq(categorieCentriCosto.companyId, actor.companyId),
      eq(categorieCentriCosto.id, id),
    ));
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
  async getCentroCosto(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(centriDiCosto).where(and(
      eq(centriDiCosto.companyId, companyId),
      eq(centriDiCosto.id, id),
      isNull(centriDiCosto.deletedAt),
    )).limit(1);
    return rows[0] ?? null;
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
    tipo?: string; stato?: string; stati?: string[]; categoriaId?: string; categoriaCentroId?: string; centroCostoId?: string;
    contoId?: string; soggettoId?: string; search?: string;
    dataInizio?: string; dataFine?: string; limit?: number; offset?: number;
  }) {
    const db = await getDb();
    if (!db) return [];
    const conds: any[] = [eq(documentiFinanziari.companyId, companyId), isNull(documentiFinanziari.deletedAt)];
    if (filters?.tipo) conds.push(eq(documentiFinanziari.tipo, filters.tipo as any));
    if (filters?.stato) conds.push(eq(documentiFinanziari.stato, filters.stato as any));
    if (filters?.stati?.length) conds.push(inArray(documentiFinanziari.stato, filters.stati as any));
    if (filters?.categoriaId) conds.push(eq(documentiFinanziari.categoriaId, filters.categoriaId));
    if (filters?.categoriaCentroId) conds.push(eq(centriDiCosto.categoriaCentroId, filters.categoriaCentroId));
    if (filters?.centroCostoId) conds.push(eq(documentiFinanziari.centroCostoId, filters.centroCostoId));
    if (filters?.soggettoId) conds.push(eq(documentiFinanziari.soggettoId, filters.soggettoId));
    if (filters?.search) {
      conds.push(or(
        like(documentiFinanziari.descrizione, `%${filters.search}%`),
        like(documentiFinanziari.numero, `%${filters.search}%`),
        like(soggetti.ragioneSociale, `%${filters.search}%`),
        like(soggetti.nomeBreve, `%${filters.search}%`),
        like(categorieFinanziarie.nome, `%${filters.search}%`),
        like(centriDiCosto.nome, `%${filters.search}%`),
      ));
    }
    if (filters?.dataInizio) conds.push(sql`dataDocumento >= ${filters.dataInizio}`);
    if (filters?.dataFine) conds.push(sql`dataDocumento <= ${filters.dataFine}`);
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    return db.select({
      ...getTableColumns(documentiFinanziari),
      categoriaNome: categorieFinanziarie.nome,
      sottocategoriaNome: categorieFinanziarie.nome,
      categoriaColore: categorieFinanziarie.colore,
      centroCostoNome: centriDiCosto.nome,
      categoriaCentroNome: categorieCentriCosto.nome,
      soggettoNome: sql<string | null>`COALESCE(${soggetti.nomeBreve}, ${soggetti.ragioneSociale})`,
    })
      .from(documentiFinanziari)
      .leftJoin(categorieFinanziarie, and(
        eq(categorieFinanziarie.id, documentiFinanziari.categoriaId),
        eq(categorieFinanziarie.companyId, documentiFinanziari.companyId),
      ))
      .leftJoin(centriDiCosto, and(
        eq(centriDiCosto.id, documentiFinanziari.centroCostoId),
        eq(centriDiCosto.companyId, documentiFinanziari.companyId),
      ))
      .leftJoin(categorieCentriCosto, and(
        eq(categorieCentriCosto.id, centriDiCosto.categoriaCentroId),
        eq(categorieCentriCosto.companyId, documentiFinanziari.companyId),
      ))
      .leftJoin(soggetti, and(
        eq(soggetti.id, documentiFinanziari.soggettoId),
        eq(soggetti.companyId, documentiFinanziari.companyId),
      ))
      .where(and(...conds))
      .orderBy(desc(documentiFinanziari.dataDocumento), desc(documentiFinanziari.createdAt))
      .limit(limit)
      .offset(offset);
  },
  async getDocumento(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(documentiFinanziari)
      .where(and(eq(documentiFinanziari.id, id), eq(documentiFinanziari.companyId, companyId), isNull(documentiFinanziari.deletedAt)));
    return rows[0] ?? null;
  },
  async getLastDocumentoForSubject(companyId: string, soggettoId: string, tipo: "entrata" | "uscita") {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(documentiFinanziari)
      .where(and(
        eq(documentiFinanziari.companyId, companyId),
        eq(documentiFinanziari.soggettoId, soggettoId),
        eq(documentiFinanziari.tipo, tipo),
        isNull(documentiFinanziari.deletedAt),
      ))
      .orderBy(
        desc(documentiFinanziari.createdAt),
        desc(documentiFinanziari.codiceInterno),
        desc(documentiFinanziari.id),
      )
      .limit(1);
    return rows[0] ?? null;
  },
  async getLastPaymentForSubject(companyId: string, soggettoId: string, tipo: "entrata" | "uscita") {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select({
      pagamentoId: pagamentiIncassi.id,
      documentoId: documentiFinanziari.id,
      contoId: contiFin.id,
      metodoId: metodiPagamento.id,
      data: pagamentiIncassi.data,
    })
      .from(pagamentiIncassi)
      .innerJoin(documentiFinanziari, and(
        eq(documentiFinanziari.id, pagamentiIncassi.documentoId),
        eq(documentiFinanziari.companyId, pagamentiIncassi.companyId),
      ))
      .innerJoin(contiFin, and(
        eq(contiFin.id, pagamentiIncassi.contoId),
        eq(contiFin.companyId, pagamentiIncassi.companyId),
        eq(contiFin.attivo, true),
        isNull(contiFin.deletedAt),
      ))
      .leftJoin(metodiPagamento, and(
        eq(metodiPagamento.id, pagamentiIncassi.metodoId),
        eq(metodiPagamento.companyId, pagamentiIncassi.companyId),
        eq(metodiPagamento.attivo, true),
        isNull(metodiPagamento.deletedAt),
      ))
      .where(and(
        eq(documentiFinanziari.companyId, companyId),
        eq(documentiFinanziari.soggettoId, soggettoId),
        eq(documentiFinanziari.tipo, tipo),
        eq(pagamentiIncassi.stato, "confermato"),
        isNull(documentiFinanziari.deletedAt),
        isNull(pagamentiIncassi.deletedAt),
      ))
      .orderBy(
        desc(pagamentiIncassi.createdAt),
        desc(pagamentiIncassi.data),
        desc(pagamentiIncassi.id),
      )
      .limit(1);
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

  async updateMovimentoCompleto(actor: ActorContext, id: string, data: {
    documento: Record<string, unknown>;
    registrazione: Record<string, unknown>;
    scadenza?: Record<string, unknown>;
  }) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db.transaction(async (tx) => {
      await tx.update(documentiFinanziari)
        .set(withUpdate(actor, data.documento) as any)
        .where(and(
          eq(documentiFinanziari.id, id),
          eq(documentiFinanziari.companyId, actor.companyId),
          isNull(documentiFinanziari.deletedAt),
        ));

      await tx.update(registrazioniEconomiche)
        .set(withUpdate(actor, data.registrazione) as any)
        .where(and(
          eq(registrazioniEconomiche.documentoId, id),
          eq(registrazioniEconomiche.companyId, actor.companyId),
          isNull(registrazioniEconomiche.deletedAt),
        ));

      if (data.scadenza) {
        await tx.update(scadenzeFinanziarie)
          .set(withUpdate(actor, data.scadenza) as any)
          .where(and(
            eq(scadenzeFinanziarie.documentoId, id),
            eq(scadenzeFinanziarie.companyId, actor.companyId),
            isNull(scadenzeFinanziarie.deletedAt),
          ));
      }
    });

    return { success: true };
  },

  async eliminaMovimentoCompleto(actor: ActorContext, id: string, motivo?: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    return db.transaction(async (tx) => {
      const docs = await tx.select().from(documentiFinanziari)
        .where(and(
          eq(documentiFinanziari.id, id),
          eq(documentiFinanziari.companyId, actor.companyId),
          isNull(documentiFinanziari.deletedAt),
        ));
      const doc = docs[0];
      if (!doc) throw new Error("Movimento non trovato");

      const pagamenti = await tx.select().from(pagamentiIncassi)
        .where(and(
          eq(pagamentiIncassi.documentoId, id),
          eq(pagamentiIncassi.companyId, actor.companyId),
          eq(pagamentiIncassi.stato, "confermato"),
          isNull(pagamentiIncassi.deletedAt),
        ));

      let storniCreati = 0;
      for (const pagamento of pagamenti) {
        const conti = await tx.select().from(contiFin)
          .where(and(
            eq(contiFin.id, pagamento.contoId),
            eq(contiFin.companyId, actor.companyId),
            isNull(contiFin.deletedAt),
          ));
        const conto = conti[0];
        if (!conto) throw new Error("Conto del pagamento non trovato");

        const deltaStorno = doc.tipo === "entrata" ? -pagamento.importo : pagamento.importo;
        const saldoDopo = conto.saldoAttuale + deltaStorno;
        await tx.update(contiFin)
          .set({ saldoAttuale: saldoDopo, updatedBy: actor.userUuid } as any)
          .where(and(eq(contiFin.id, conto.id), eq(contiFin.companyId, actor.companyId)));

        await tx.update(pagamentiIncassi)
          .set(withUpdate(actor, {
            stato: "annullato",
            note: motivo ? `[ELIMINATO] ${motivo}` : "[ELIMINATO]",
          }) as any)
          .where(and(eq(pagamentiIncassi.id, pagamento.id), eq(pagamentiIncassi.companyId, actor.companyId)));

        await tx.insert(movimentiCassa).values(withCreate(actor, {
          contoId: conto.id,
          tipo: doc.tipo === "entrata" ? "uscita" : "entrata",
          importo: pagamento.importo,
          data: new Date().toISOString().slice(0, 10),
          saldoPrecedente: conto.saldoAttuale,
          saldoDopo,
          descrizione: `Storno eliminazione ${doc.codiceInterno ?? id}`,
          documentoId: id,
          pagamentoId: pagamento.id,
          stato: "confermato",
        }) as any);
        storniCreati += 1;
      }

      const deletePayload = softDeletePayload(actor);
      await tx.update(documentiFinanziari)
        .set({ ...deletePayload, updatedBy: actor.userUuid, stato: "annullato" } as any)
        .where(and(eq(documentiFinanziari.id, id), eq(documentiFinanziari.companyId, actor.companyId)));
      await tx.update(registrazioniEconomiche)
        .set(deletePayload as any)
        .where(and(eq(registrazioniEconomiche.documentoId, id), eq(registrazioniEconomiche.companyId, actor.companyId), isNull(registrazioniEconomiche.deletedAt)));
      await tx.update(scadenzeFinanziarie)
        .set({ ...deletePayload, stato: "annullata" } as any)
        .where(and(eq(scadenzeFinanziarie.documentoId, id), eq(scadenzeFinanziarie.companyId, actor.companyId), isNull(scadenzeFinanziarie.deletedAt)));
      await tx.update(pagamentiIncassi)
        .set(deletePayload as any)
        .where(and(eq(pagamentiIncassi.documentoId, id), eq(pagamentiIncassi.companyId, actor.companyId), isNull(pagamentiIncassi.deletedAt)));
      await tx.update(allegatiFinanziari)
        .set(deletePayload as any)
        .where(and(eq(allegatiFinanziari.documentoId, id), eq(allegatiFinanziari.companyId, actor.companyId), isNull(allegatiFinanziari.deletedAt)));

      return { success: true, storniCreati };
    });
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
  /**
   * Registra il saldo completo di più fatture di uscita in un'unica transazione.
   * Blocca fatture e conto durante il calcolo per evitare doppi pagamenti concorrenti.
   */
  async registraPagamentiMultipliAtomici(actor: ActorContext, input: {
    documentoIds: string[];
    contoId: string;
    metodoId?: string;
    data: string;
    riferimento?: string;
    note?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");

    return db.transaction(async (tx) => {
      const contoRows = await tx.select().from(contiFin).where(and(
        eq(contiFin.id, input.contoId),
        eq(contiFin.companyId, actor.companyId),
        eq(contiFin.attivo, true),
        isNull(contiFin.deletedAt),
      )).for("update");
      const conto = contoRows[0];
      if (!conto) throw new Error("Conto non valido o non attivo");

      if (input.metodoId) {
        const metodi = await tx.select({ id: metodiPagamento.id }).from(metodiPagamento).where(and(
          eq(metodiPagamento.id, input.metodoId),
          eq(metodiPagamento.companyId, actor.companyId),
          eq(metodiPagamento.attivo, true),
          isNull(metodiPagamento.deletedAt),
        )).for("update");
        if (!metodi[0]) throw new Error("Metodo di pagamento non valido o non attivo");
      }

      const documenti = await tx.select().from(documentiFinanziari).where(and(
        eq(documentiFinanziari.companyId, actor.companyId),
        inArray(documentiFinanziari.id, input.documentoIds),
        eq(documentiFinanziari.tipo, "uscita"),
        isNull(documentiFinanziari.deletedAt),
      )).for("update");

      if (documenti.length !== input.documentoIds.length) {
        throw new Error("Una o più fatture non sono disponibili per il pagamento");
      }

      const perId = new Map(documenti.map((documento) => [documento.id, documento]));
      const documentiOrdinati = input.documentoIds.map((id) => perId.get(id)!);
      const nonPagabili = documentiOrdinati.find((documento) => (
        !["registrato", "parzialmente_regolato", "scaduto"].includes(documento.stato)
        || Number(documento.residuo ?? documento.totale) <= 0
      ));
      if (nonPagabili) {
        throw new Error(`La fattura ${nonPagabili.codiceInterno ?? nonPagabili.numero ?? nonPagabili.id} non ha più un residuo da pagare`);
      }

      const scadenze = await tx.select().from(scadenzeFinanziarie).where(and(
        eq(scadenzeFinanziarie.companyId, actor.companyId),
        inArray(scadenzeFinanziarie.documentoId, input.documentoIds),
        isNull(scadenzeFinanziarie.deletedAt),
      )).for("update");
      const scadenzePerDocumento = new Map<string, typeof scadenze>();
      for (const scadenza of scadenze) {
        const esistenti = scadenzePerDocumento.get(scadenza.documentoId) ?? [];
        esistenti.push(scadenza);
        scadenzePerDocumento.set(scadenza.documentoId, esistenti);
      }

      const totale = documentiOrdinati.reduce((somma, documento) => somma + Number(documento.residuo ?? documento.totale), 0);
      const saldoDopo = conto.saldoAttuale - totale;
      await tx.update(contiFin).set(withUpdate(actor, { saldoAttuale: saldoDopo }) as any).where(and(
        eq(contiFin.id, conto.id),
        eq(contiFin.companyId, actor.companyId),
      ));

      const pagamenti: Array<{ documentoId: string; pagamentoId: string; importo: number }> = [];
      for (const documento of documentiOrdinati) {
        const importo = Number(documento.residuo ?? documento.totale);
        const pagamentoId = newId();
        const scadenzeDocumento = (scadenzePerDocumento.get(documento.id) ?? [])
          .filter((scadenza) => Number(scadenza.residuo) > 0 && !["pagata", "annullata"].includes(scadenza.stato));

        await tx.insert(pagamentiIncassi).values(withCreate(actor, {
          id: pagamentoId,
          documentoId: documento.id,
          contoId: conto.id,
          metodoId: input.metodoId,
          importo,
          data: input.data,
          riferimento: input.riferimento,
          note: input.note,
          stato: "confermato",
        }) as any);
        await tx.update(documentiFinanziari).set(withUpdate(actor, {
          totalePagato: Number(documento.totalePagato ?? 0) + importo,
          residuo: 0,
          stato: "pagato",
        }) as any).where(and(
          eq(documentiFinanziari.id, documento.id),
          eq(documentiFinanziari.companyId, actor.companyId),
        ));
        await tx.insert(movimentiCassa).values(withCreate(actor, {
          id: newId(),
          contoId: conto.id,
          tipo: "uscita",
          importo,
          data: input.data,
          saldoPrecedente: conto.saldoAttuale - pagamenti.reduce((somma, pagamento) => somma + pagamento.importo, 0),
          saldoDopo: conto.saldoAttuale - pagamenti.reduce((somma, pagamento) => somma + pagamento.importo, 0) - importo,
          descrizione: `Pagamento multiplo · ${documento.codiceInterno ?? documento.numero ?? documento.id}`,
          documentoId: documento.id,
          pagamentoId,
          stato: "confermato",
        }) as any);

        for (const scadenza of scadenzeDocumento) {
          await tx.update(scadenzeFinanziarie).set(withUpdate(actor, {
            // Una chiusura del residuo documento completa anche le rate rimaste aperte.
            // È compatibile con pagamenti parziali storici non associati a una rata precisa.
            importoPagato: Number(scadenza.importo),
            residuo: 0,
            stato: "pagata",
          }) as any).where(and(
            eq(scadenzeFinanziarie.id, scadenza.id),
            eq(scadenzeFinanziarie.companyId, actor.companyId),
          ));
        }

        pagamenti.push({ documentoId: documento.id, pagamentoId, importo });
      }

      await tx.update(acquisizioniFatture).set(withUpdate(actor, { stato: "pagata" }) as any).where(and(
        eq(acquisizioniFatture.companyId, actor.companyId),
        inArray(acquisizioniFatture.documentoFinanziarioId, input.documentoIds),
        isNull(acquisizioniFatture.deletedAt),
      ));

      return {
        documentiPagati: pagamenti.length,
        totale,
        contoId: conto.id,
        saldoDopo,
        pagamenti,
      };
    });
  },

  /**
   * Restituisce soltanto documenti aperti del verso scelto con almeno una scadenza residua.
   * La data proposta è sempre l'ultima rata ancora aperta del singolo documento.
   */
  async listFattureStoricheInScadenza(companyId: string, limit = 500, tipo: "entrata" | "uscita" = "uscita") {
    const db = await getDb();
    if (!db) return [];
    const documenti = await db.select({
      ...getTableColumns(documentiFinanziari),
      soggettoNome: sql<string | null>`COALESCE(${soggetti.nomeBreve}, ${soggetti.ragioneSociale})`,
    }).from(documentiFinanziari)
      .leftJoin(soggetti, and(
        eq(soggetti.id, documentiFinanziari.soggettoId),
        eq(soggetti.companyId, documentiFinanziari.companyId),
        isNull(soggetti.deletedAt),
      ))
      .where(and(
        eq(documentiFinanziari.companyId, companyId),
        eq(documentiFinanziari.tipo, tipo),
        inArray(documentiFinanziari.stato, ["registrato", "parzialmente_regolato", "scaduto"]),
        sql`${documentiFinanziari.residuo} > 0`,
        isNull(documentiFinanziari.deletedAt),
      ))
      .orderBy(asc(documentiFinanziari.dataDocumento))
      .limit(limit);
    if (!documenti.length) return [];

    const scadenze = await db.select().from(scadenzeFinanziarie).where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      inArray(scadenzeFinanziarie.documentoId, documenti.map((documento) => documento.id)),
      sql`${scadenzeFinanziarie.residuo} > 0`,
      sql`${scadenzeFinanziarie.stato} NOT IN ('pagata', 'annullata')`,
      isNull(scadenzeFinanziarie.deletedAt),
    ));
    const perDocumento = new Map<string, typeof scadenze>();
    for (const scadenza of scadenze) {
      const gruppo = perDocumento.get(scadenza.documentoId) ?? [];
      gruppo.push(scadenza);
      perDocumento.set(scadenza.documentoId, gruppo);
    }

    return documenti.flatMap((documento) => {
      const aperte = perDocumento.get(documento.id) ?? [];
      const ultima = aperte.sort((a, b) => businessIsoDate(a.dataScadenza).localeCompare(businessIsoDate(b.dataScadenza))).at(-1);
      if (!ultima) return [];
      return [{
        ...documento,
        scadenzeAperte: aperte.length,
        scadenzaFinale: businessIsoDate(ultima.dataScadenza),
      }];
    }).sort((a, b) => a.scadenzaFinale.localeCompare(b.scadenzaFinale));
  },

  /**
   * Regolarizza incassi o pagamenti storici sulla rispettiva ultima scadenza aperta.
   * Conto, documenti e scadenze vengono bloccati e aggiornati nella stessa transazione.
   */
  async regolarizzaScadenzeStoricheAtomico(actor: ActorContext, input: {
    documentoIds: string[];
    tipo: "entrata" | "uscita";
    contoId: string;
    metodoId?: string;
    riferimento?: string;
    note?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");

    return db.transaction(async (tx) => {
      const contoRows = await tx.select().from(contiFin).where(and(
        eq(contiFin.id, input.contoId),
        eq(contiFin.companyId, actor.companyId),
        eq(contiFin.attivo, true),
        isNull(contiFin.deletedAt),
      )).for("update");
      const conto = contoRows[0];
      if (!conto) throw new Error("Conto non valido o non attivo");

      if (input.metodoId) {
        const metodi = await tx.select({ id: metodiPagamento.id }).from(metodiPagamento).where(and(
          eq(metodiPagamento.id, input.metodoId),
          eq(metodiPagamento.companyId, actor.companyId),
          eq(metodiPagamento.attivo, true),
          isNull(metodiPagamento.deletedAt),
        )).for("update");
        if (!metodi[0]) throw new Error("Metodo di pagamento non valido o non attivo");
      }

      const documenti = await tx.select().from(documentiFinanziari).where(and(
        eq(documentiFinanziari.companyId, actor.companyId),
        inArray(documentiFinanziari.id, input.documentoIds),
        eq(documentiFinanziari.tipo, input.tipo),
        isNull(documentiFinanziari.deletedAt),
      )).for("update");
      if (documenti.length !== input.documentoIds.length) {
        throw new Error("Uno o più documenti non sono disponibili per la regolarizzazione");
      }
      const nonRegolabili = documenti.find((documento) => (
        !["registrato", "parzialmente_regolato", "scaduto"].includes(documento.stato)
        || Number(documento.residuo ?? documento.totale) <= 0
      ));
      if (nonRegolabili) {
        throw new Error(`Il documento ${nonRegolabili.codiceInterno ?? nonRegolabili.numero ?? nonRegolabili.id} non ha più un residuo da regolarizzare`);
      }

      const scadenze = await tx.select().from(scadenzeFinanziarie).where(and(
        eq(scadenzeFinanziarie.companyId, actor.companyId),
        inArray(scadenzeFinanziarie.documentoId, input.documentoIds),
        isNull(scadenzeFinanziarie.deletedAt),
      )).for("update");
      const scadenzePerDocumento = new Map<string, typeof scadenze>();
      for (const scadenza of scadenze) {
        const gruppo = scadenzePerDocumento.get(scadenza.documentoId) ?? [];
        gruppo.push(scadenza);
        scadenzePerDocumento.set(scadenza.documentoId, gruppo);
      }

      const fatture = documenti.map((documento) => {
        const scadenzeAperte = (scadenzePerDocumento.get(documento.id) ?? [])
          .filter((scadenza) => Number(scadenza.residuo) > 0 && !["pagata", "annullata"].includes(scadenza.stato));
        const ultimaScadenza = scadenzeAperte.sort((a, b) => businessIsoDate(a.dataScadenza).localeCompare(businessIsoDate(b.dataScadenza))).at(-1);
        if (!ultimaScadenza) {
          throw new Error(`Il documento ${documento.codiceInterno ?? documento.id} non ha una scadenza residua utilizzabile`);
        }
        const dataPagamento = businessIsoDate(ultimaScadenza.dataScadenza);
        return { documento, scadenzeAperte, dataPagamento, importo: Number(documento.residuo ?? documento.totale) };
      }).sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento) || a.documento.id.localeCompare(b.documento.id));

      const totale = fatture.reduce((somma, fattura) => somma + fattura.importo, 0);
      const saldoDopo = input.tipo === "entrata"
        ? conto.saldoAttuale + totale
        : conto.saldoAttuale - totale;
      await tx.update(contiFin).set(withUpdate(actor, { saldoAttuale: saldoDopo }) as any).where(and(
        eq(contiFin.id, conto.id),
        eq(contiFin.companyId, actor.companyId),
      ));

      let totaleRegistrato = 0;
      const pagamenti: Array<{ documentoId: string; pagamentoId: string; importo: number; data: string }> = [];
      for (const fattura of fatture) {
        const pagamentoId = newId();
        const saldoPrecedente = input.tipo === "entrata"
          ? conto.saldoAttuale + totaleRegistrato
          : conto.saldoAttuale - totaleRegistrato;
        const saldoDopoMovimento = input.tipo === "entrata"
          ? saldoPrecedente + fattura.importo
          : saldoPrecedente - fattura.importo;
        await tx.insert(pagamentiIncassi).values(withCreate(actor, {
          id: pagamentoId,
          documentoId: fattura.documento.id,
          contoId: conto.id,
          metodoId: input.metodoId,
          importo: fattura.importo,
          data: fattura.dataPagamento,
          riferimento: input.riferimento,
          note: input.note,
          stato: "confermato",
        }) as any);
        await tx.update(documentiFinanziari).set(withUpdate(actor, {
          totalePagato: Number(fattura.documento.totalePagato ?? 0) + fattura.importo,
          residuo: 0,
          stato: input.tipo === "entrata" ? "incassato" : "pagato",
        }) as any).where(and(
          eq(documentiFinanziari.id, fattura.documento.id),
          eq(documentiFinanziari.companyId, actor.companyId),
        ));
        await tx.insert(movimentiCassa).values(withCreate(actor, {
          id: newId(),
          contoId: conto.id,
          tipo: input.tipo,
          importo: fattura.importo,
          data: fattura.dataPagamento,
          saldoPrecedente,
          saldoDopo: saldoDopoMovimento,
          descrizione: `${input.tipo === "entrata" ? "Incasso storico" : "Regolarizzazione storico"} · ${fattura.documento.codiceInterno ?? fattura.documento.numero ?? fattura.documento.id}`,
          documentoId: fattura.documento.id,
          pagamentoId,
          stato: "confermato",
        }) as any);
        for (const scadenza of fattura.scadenzeAperte) {
          await tx.update(scadenzeFinanziarie).set(withUpdate(actor, {
            importoPagato: Number(scadenza.importo),
            residuo: 0,
            stato: input.tipo === "entrata" ? "incassata" : "pagata",
          }) as any).where(and(
            eq(scadenzeFinanziarie.id, scadenza.id),
            eq(scadenzeFinanziarie.companyId, actor.companyId),
          ));
        }
        totaleRegistrato += fattura.importo;
        pagamenti.push({ documentoId: fattura.documento.id, pagamentoId, importo: fattura.importo, data: fattura.dataPagamento });
      }

      if (input.tipo === "uscita") {
        await tx.update(acquisizioniFatture).set(withUpdate(actor, { stato: "pagata" }) as any).where(and(
          eq(acquisizioniFatture.companyId, actor.companyId),
          inArray(acquisizioniFatture.documentoFinanziarioId, input.documentoIds),
          isNull(acquisizioniFatture.deletedAt),
        ));
      }

      return { documentiRegolarizzati: pagamenti.length, totale, contoId: conto.id, saldoDopo, tipo: input.tipo, pagamenti };
    });
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
