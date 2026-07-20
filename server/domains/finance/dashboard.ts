import { eq, and, sql, ne, isNull, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  documentiFinanziari,
  movimentiCassa,
  registrazioniEconomiche,
  scadenzeFinanziarie,
  pagamentiIncassi,
  contiFin,
  categorieFinanziarie,
  centriDiCosto,
  soggetti,
} from "../../../drizzle/schema";

// ── Types ──
export interface DashboardFilters {
  companyId: string;
  dataInizio: string; // YYYY-MM-DD
  dataFine: string;
  modalita: "cassa" | "competenza";
  centroCostoId?: string;
  categoriaId?: string;
}

export interface PeriodComparison {
  valore: number;
  valorePrecedente: number | null;
  differenza: number | null;
  percentuale: number | null; // basis points (1234 = 12.34%)
}

function calcPercentuale(attuale: number, precedente: number | null): number | null {
  if (precedente === null || precedente === 0) return null;
  return Math.round(((attuale - precedente) / Math.abs(precedente)) * 10000);
}

function buildComparison(attuale: number, precedente: number | null): PeriodComparison {
  return {
    valore: attuale,
    valorePrecedente: precedente,
    differenza: precedente !== null ? attuale - precedente : null,
    percentuale: calcPercentuale(attuale, precedente),
  };
}

// Calcola il periodo precedente equivalente
function calcolaPeriodoPrecedente(dataInizio: string, dataFine: string): { dataInizio: string; dataFine: string } {
  const start = new Date(dataInizio);
  const end = new Date(dataFine);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000); // giorno prima dell'inizio
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return {
    dataInizio: prevStart.toISOString().split("T")[0],
    dataFine: prevEnd.toISOString().split("T")[0],
  };
}

// ── SUMMARY ──
export async function dashboardSummary(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, dataInizio, dataFine, modalita, centroCostoId, categoriaId } = filters;
  const prev = calcolaPeriodoPrecedente(dataInizio, dataFine);

  let entrate: number;
  let uscite: number;
  let entratePrev: number;
  let uscitePrev: number;
  let numEntrate: number;
  let numUscite: number;

  if (modalita === "cassa") {
    const [entrateRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)`, count: sql<number>`COUNT(*)` })
      .from(movimentiCassa)
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "entrata"),
        sql`${movimentiCassa.data} >= ${dataInizio}`,
        sql`${movimentiCassa.data} <= ${dataFine}`,
      ));

    const [usciteRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)`, count: sql<number>`COUNT(*)` })
      .from(movimentiCassa)
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "uscita"),
        sql`${movimentiCassa.data} >= ${dataInizio}`,
        sql`${movimentiCassa.data} <= ${dataFine}`,
      ));

    const [entratePrevRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
      .from(movimentiCassa)
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "entrata"),
        sql`${movimentiCassa.data} >= ${prev.dataInizio}`,
        sql`${movimentiCassa.data} <= ${prev.dataFine}`,
      ));

    const [uscitePrevRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
      .from(movimentiCassa)
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "uscita"),
        sql`${movimentiCassa.data} >= ${prev.dataInizio}`,
        sql`${movimentiCassa.data} <= ${prev.dataFine}`,
      ));

    entrate = Number(entrateRes.total);
    uscite = Number(usciteRes.total);
    numEntrate = Number(entrateRes.count);
    numUscite = Number(usciteRes.count);
    entratePrev = Number(entratePrevRes.total);
    uscitePrev = Number(uscitePrevRes.total);
  } else {
    // Competenza: registrazioniEconomiche
    const baseConds: any[] = [eq(registrazioniEconomiche.companyId, companyId)];
    if (centroCostoId) baseConds.push(eq(registrazioniEconomiche.centroCostoId, centroCostoId));
    if (categoriaId) baseConds.push(eq(registrazioniEconomiche.categoriaId, categoriaId));

    const [ricaviRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)`, count: sql<number>`COUNT(*)` })
      .from(registrazioniEconomiche)
      .where(and(
        ...baseConds,
        eq(registrazioniEconomiche.tipo, "ricavo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${dataFine}`,
      ));

    const [costiRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)`, count: sql<number>`COUNT(*)` })
      .from(registrazioniEconomiche)
      .where(and(
        ...baseConds,
        eq(registrazioniEconomiche.tipo, "costo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${dataFine}`,
      ));

    const [ricaviPrevRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
      .from(registrazioniEconomiche)
      .where(and(
        ...baseConds,
        eq(registrazioniEconomiche.tipo, "ricavo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${prev.dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${prev.dataFine}`,
      ));

    const [costiPrevRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
      .from(registrazioniEconomiche)
      .where(and(
        ...baseConds,
        eq(registrazioniEconomiche.tipo, "costo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${prev.dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${prev.dataFine}`,
      ));

    entrate = Number(ricaviRes.total);
    uscite = Number(costiRes.total);
    numEntrate = Number(ricaviRes.count);
    numUscite = Number(costiRes.count);
    entratePrev = Number(ricaviPrevRes.total);
    uscitePrev = Number(costiPrevRes.total);
  }

  const utileNetto = entrate - uscite;
  const utileNettoPrev = entratePrev - uscitePrev;

  return {
    modalita,
    periodo: { dataInizio, dataFine },
    periodoPrecedente: prev,
    utileNetto: buildComparison(utileNetto, utileNettoPrev),
    entrate: { ...buildComparison(entrate, entratePrev), numMovimenti: numEntrate },
    uscite: { ...buildComparison(uscite, uscitePrev), numMovimenti: numUscite },
    cashflow: buildComparison(entrate - uscite, entratePrev - uscitePrev),
  };
}

// ── TREND (andamento mensile) ──
export async function dashboardTrend(filters: DashboardFilters & { mesi: number }) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, modalita, mesi, centroCostoId, categoriaId } = filters;
  const oggi = new Date();
  const inizio = new Date(oggi.getFullYear(), oggi.getMonth() - mesi + 1, 1);
  const dataInizio = inizio.toISOString().split("T")[0];
  const dataFine = oggi.toISOString().split("T")[0];

  type TrendPoint = { mese: string; entrate: number; uscite: number; utile: number };
  const result: TrendPoint[] = [];

  if (modalita === "cassa") {
    const rawTrend = (await db.execute(
      sql`SELECT DATE_FORMAT(data, '%Y-%m') as mese, tipo, COALESCE(SUM(importo), 0) as totale
          FROM movimentiCassa
          WHERE companyId = ${companyId} AND stato = 'confermato'
            AND data >= ${dataInizio} AND data <= ${dataFine}
          GROUP BY DATE_FORMAT(data, '%Y-%m'), tipo`,
    ) as any[]);
    const rows = (rawTrend as any[])[0] ?? rawTrend ?? [];

    const map = new Map<string, { entrate: number; uscite: number }>();
    for (const r of rows) {
      const m = String(r.mese);
      if (!map.has(m)) map.set(m, { entrate: 0, uscite: 0 });
      const entry = map.get(m)!;
      if (r.tipo === "entrata") entry.entrate = Number(r.totale);
      else entry.uscite = Number(r.totale);
    }

    for (let i = 0; i < mesi; i++) {
      const d = new Date(inizio.getFullYear(), inizio.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = map.get(key) || { entrate: 0, uscite: 0 };
      result.push({ mese: key, entrate: entry.entrate, uscite: entry.uscite, utile: entry.entrate - entry.uscite });
    }
  } else {
    const conds: any[] = [
      eq(registrazioniEconomiche.companyId, companyId),
      sql`${registrazioniEconomiche.dataCompetenza} >= ${dataInizio}`,
      sql`${registrazioniEconomiche.dataCompetenza} <= ${dataFine}`,
    ];
    if (centroCostoId) conds.push(eq(registrazioniEconomiche.centroCostoId, centroCostoId));
    if (categoriaId) conds.push(eq(registrazioniEconomiche.categoriaId, categoriaId));

    const cdcFilter = centroCostoId ? sql` AND centroCostoId = ${centroCostoId}` : sql``;
    const catFilter = categoriaId ? sql` AND categoriaId = ${categoriaId}` : sql``;
    const rawTrend = (await db.execute(
      sql`SELECT DATE_FORMAT(dataCompetenza, '%Y-%m') as mese, tipo, COALESCE(SUM(importo), 0) as totale
          FROM registrazioniEconomiche
          WHERE companyId = ${companyId}
            AND dataCompetenza >= ${dataInizio} AND dataCompetenza <= ${dataFine}
            ${cdcFilter} ${catFilter}
          GROUP BY DATE_FORMAT(dataCompetenza, '%Y-%m'), tipo`,
    ) as any[]);
    const rows = (rawTrend as any[])[0] ?? rawTrend ?? [];

    const map = new Map<string, { entrate: number; uscite: number }>();
    for (const r of rows) {
      const m = String(r.mese);
      if (!map.has(m)) map.set(m, { entrate: 0, uscite: 0 });
      const entry = map.get(m)!;
      if (r.tipo === "ricavo") entry.entrate = Number(r.totale);
      else entry.uscite = Number(r.totale);
    }

    for (let i = 0; i < mesi; i++) {
      const d = new Date(inizio.getFullYear(), inizio.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = map.get(key) || { entrate: 0, uscite: 0 };
      result.push({ mese: key, entrate: entry.entrate, uscite: entry.uscite, utile: entry.entrate - entry.uscite });
    }
  }

  return { mesi, modalita, trend: result };
}

// ── COST CENTERS ──
export async function dashboardCostCenters(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, dataInizio, dataFine, modalita } = filters;
  const prev = calcolaPeriodoPrecedente(dataInizio, dataFine);

  let rows: Array<{ centroCostoId: string | null; totale: number }>;
  let rowsPrev: Array<{ centroCostoId: string | null; totale: number }>;

  if (modalita === "cassa") {
    const res = await db
      .select({
        centroCostoId: documentiFinanziari.centroCostoId,
        totale: sql<number>`COALESCE(SUM(${movimentiCassa.importo}), 0)`,
      })
      .from(movimentiCassa)
      .leftJoin(documentiFinanziari, eq(movimentiCassa.documentoId, documentiFinanziari.id))
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "uscita"),
        sql`${movimentiCassa.data} >= ${dataInizio}`,
        sql`${movimentiCassa.data} <= ${dataFine}`,
      ))
      .groupBy(documentiFinanziari.centroCostoId);
    rows = res.map((r: any) => ({ centroCostoId: r.centroCostoId, totale: Number(r.totale) }));

    const resPrev = await db
      .select({
        centroCostoId: documentiFinanziari.centroCostoId,
        totale: sql<number>`COALESCE(SUM(${movimentiCassa.importo}), 0)`,
      })
      .from(movimentiCassa)
      .leftJoin(documentiFinanziari, eq(movimentiCassa.documentoId, documentiFinanziari.id))
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "uscita"),
        sql`${movimentiCassa.data} >= ${prev.dataInizio}`,
        sql`${movimentiCassa.data} <= ${prev.dataFine}`,
      ))
      .groupBy(documentiFinanziari.centroCostoId);
    rowsPrev = resPrev.map((r: any) => ({ centroCostoId: r.centroCostoId, totale: Number(r.totale) }));
  } else {
    const res = await db
      .select({
        centroCostoId: registrazioniEconomiche.centroCostoId,
        totale: sql<number>`COALESCE(SUM(${registrazioniEconomiche.importo}), 0)`,
      })
      .from(registrazioniEconomiche)
      .where(and(
        eq(registrazioniEconomiche.companyId, companyId),
        eq(registrazioniEconomiche.tipo, "costo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${dataFine}`,
      ))
      .groupBy(registrazioniEconomiche.centroCostoId);
    rows = res.map((r: any) => ({ centroCostoId: r.centroCostoId, totale: Number(r.totale) }));

    const resPrev = await db
      .select({
        centroCostoId: registrazioniEconomiche.centroCostoId,
        totale: sql<number>`COALESCE(SUM(${registrazioniEconomiche.importo}), 0)`,
      })
      .from(registrazioniEconomiche)
      .where(and(
        eq(registrazioniEconomiche.companyId, companyId),
        eq(registrazioniEconomiche.tipo, "costo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${prev.dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${prev.dataFine}`,
      ))
      .groupBy(registrazioniEconomiche.centroCostoId);
    rowsPrev = resPrev.map((r: any) => ({ centroCostoId: r.centroCostoId, totale: Number(r.totale) }));
  }

  // Fetch nomi centri di costo
  const cdcIds = Array.from(new Set(rows.map(r => r.centroCostoId).filter(Boolean) as string[]));
  const cdcList = cdcIds.length > 0
    ? await db.select().from(centriDiCosto).where(and(eq(centriDiCosto.companyId, companyId), inArray(centriDiCosto.id, cdcIds)))
    : [];
  const cdcMap = new Map(cdcList.map((c: any) => [c.id, c]));

  const totaleUscite = rows.reduce((sum, r) => sum + r.totale, 0);
  const prevMap = new Map(rowsPrev.map(r => [r.centroCostoId || "null", r.totale]));

  const centri = rows
    .sort((a, b) => b.totale - a.totale)
    .slice(0, 10)
    .map(r => {
      const cdc = r.centroCostoId ? cdcMap.get(r.centroCostoId) : null;
      const prevTotale = prevMap.get(r.centroCostoId || "null") ?? null;
      return {
        id: r.centroCostoId,
        nome: cdc?.nome || "Non assegnato",
        colore: cdc?.colore || "#6b7280",
        importo: r.totale,
        percentuale: totaleUscite > 0 ? Math.round((r.totale / totaleUscite) * 10000) : 0,
        variazione: calcPercentuale(r.totale, prevTotale),
      };
    });

  return { totaleUscite, centri };
}

// ── CATEGORIES ──
export async function dashboardCategories(filters: DashboardFilters) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, dataInizio, dataFine, modalita } = filters;
  let rows: Array<{ categoriaId: string | null; totale: number; count: number }>;

  if (modalita === "cassa") {
    const res = await db
      .select({
        categoriaId: documentiFinanziari.categoriaId,
        totale: sql<number>`COALESCE(SUM(${movimentiCassa.importo}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(movimentiCassa)
      .leftJoin(documentiFinanziari, eq(movimentiCassa.documentoId, documentiFinanziari.id))
      .where(and(
        eq(movimentiCassa.companyId, companyId),
        eq(movimentiCassa.stato, "confermato"),
        eq(movimentiCassa.tipo, "uscita"),
        sql`${movimentiCassa.data} >= ${dataInizio}`,
        sql`${movimentiCassa.data} <= ${dataFine}`,
      ))
      .groupBy(documentiFinanziari.categoriaId);
    rows = res.map((r: any) => ({ categoriaId: r.categoriaId, totale: Number(r.totale), count: Number(r.count) }));
  } else {
    const res = await db
      .select({
        categoriaId: registrazioniEconomiche.categoriaId,
        totale: sql<number>`COALESCE(SUM(${registrazioniEconomiche.importo}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(registrazioniEconomiche)
      .where(and(
        eq(registrazioniEconomiche.companyId, companyId),
        eq(registrazioniEconomiche.tipo, "costo"),
        sql`${registrazioniEconomiche.dataCompetenza} >= ${dataInizio}`,
        sql`${registrazioniEconomiche.dataCompetenza} <= ${dataFine}`,
      ))
      .groupBy(registrazioniEconomiche.categoriaId);
    rows = res.map((r: any) => ({ categoriaId: r.categoriaId, totale: Number(r.totale), count: Number(r.count) }));
  }

  // Fetch nomi categorie
  const catIds = Array.from(new Set(rows.map(r => r.categoriaId).filter(Boolean) as string[]));
  const catList = catIds.length > 0
    ? await db.select().from(categorieFinanziarie).where(and(eq(categorieFinanziarie.companyId, companyId), inArray(categorieFinanziarie.id, catIds)))
    : [];
  const catMap = new Map(catList.map((c: any) => [c.id, c]));

  const totale = rows.reduce((sum, r) => sum + r.totale, 0);

  const categorie = rows
    .sort((a, b) => b.totale - a.totale)
    .slice(0, 10)
    .map(r => {
      const cat = r.categoriaId ? catMap.get(r.categoriaId) : null;
      return {
        id: r.categoriaId,
        nome: cat?.nome || "Non categorizzato",
        colore: cat?.colore || "#6b7280",
        importo: r.totale,
        percentuale: totale > 0 ? Math.round((r.totale / totale) * 10000) : 0,
        numMovimenti: r.count,
      };
    });

  return { totale, categorie };
}

// ── DEADLINES (scadenze prossimi 30 giorni) ──
export async function dashboardDeadlines(companyId: string) {
  const db = await getDb();
  if (!db) return null;

  const oggi = new Date().toISOString().split("T")[0];
  const fra7gg = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const fra30gg = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  // Scadenze aperte nei prossimi 30 giorni
  const prossime = await db
    .select()
    .from(scadenzeFinanziarie)
    .where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata"]),
      sql`${scadenzeFinanziarie.dataScadenza} >= ${oggi}`,
      sql`${scadenzeFinanziarie.dataScadenza} <= ${fra30gg}`,
    ))
    .orderBy(asc(scadenzeFinanziarie.dataScadenza))
    .limit(20);

  // Scadenze scadute
  const scadute = await db
    .select()
    .from(scadenzeFinanziarie)
    .where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata", "scaduta"]),
      sql`${scadenzeFinanziarie.dataScadenza} < ${oggi}`,
    ))
    .orderBy(asc(scadenzeFinanziarie.dataScadenza))
    .limit(20);

  // Arricchisci con info documento
  const allScadenze = [...prossime, ...scadute];
  const docIds = Array.from(new Set(allScadenze.map((s: any) => s.documentoId)));
  const docs = docIds.length > 0
    ? await db.select({ id: documentiFinanziari.id, tipo: documentiFinanziari.tipo, descrizione: documentiFinanziari.descrizione, soggettoId: documentiFinanziari.soggettoId })
        .from(documentiFinanziari).where(inArray(documentiFinanziari.id, docIds))
    : [];
  const docMap = new Map(docs.map((d: any) => [d.id, d]));

  const soggettiIds = Array.from(new Set(docs.map((d: any) => d.soggettoId).filter(Boolean) as string[]));
  const soggettiList = soggettiIds.length > 0
    ? await db.select({ id: soggetti.id, ragioneSociale: soggetti.ragioneSociale }).from(soggetti).where(inArray(soggetti.id, soggettiIds))
    : [];
  const soggettiMap = new Map(soggettiList.map((s: any) => [s.id, s.ragioneSociale]));

  const enrichScadenza = (s: any) => {
    const doc = docMap.get(s.documentoId);
    return {
      id: s.id,
      documentoId: s.documentoId,
      importo: s.importo,
      residuo: s.residuo,
      dataScadenza: s.dataScadenza,
      stato: s.stato,
      numero: s.numero,
      totaleRate: s.totaleRate,
      tipoDocumento: doc?.tipo || null,
      descrizioneDoc: doc?.descrizione || null,
      soggetto: doc?.soggettoId ? soggettiMap.get(doc.soggettoId) || null : null,
    };
  };

  // Raggruppamento
  const daPagare7gg = prossime.filter((s: any) => {
    const doc = docMap.get(s.documentoId);
    return doc?.tipo === "uscita" && s.dataScadenza <= fra7gg;
  });
  const daPagare30gg = prossime.filter((s: any) => {
    const doc = docMap.get(s.documentoId);
    return doc?.tipo === "uscita" && s.dataScadenza > fra7gg;
  });
  const daIncassare30gg = prossime.filter((s: any) => {
    const doc = docMap.get(s.documentoId);
    return doc?.tipo === "entrata";
  });

  return {
    daPagare7gg: daPagare7gg.map(enrichScadenza),
    daPagare30gg: daPagare30gg.map(enrichScadenza),
    daIncassare30gg: daIncassare30gg.map(enrichScadenza),
    scadute: scadute.map(enrichScadenza),
    totali: {
      daPagare7gg: daPagare7gg.reduce((sum: number, s: any) => sum + s.residuo, 0),
      daPagare30gg: daPagare30gg.reduce((sum: number, s: any) => sum + s.residuo, 0),
      daIncassare30gg: daIncassare30gg.reduce((sum: number, s: any) => sum + s.residuo, 0),
      scadute: scadute.reduce((sum: number, s: any) => sum + s.residuo, 0),
      numScadenze: prossime.length + scadute.length,
    },
  };
}

// ── CREDITS & DEBTS ──
export async function dashboardCreditsDebts(companyId: string) {
  const db = await getDb();
  if (!db) return null;

  const oggi = new Date().toISOString().split("T")[0];

  const [creditiRes] = await db
    .select({
      totaleResiduo: sql<number>`COALESCE(SUM(residuo), 0)`,
      numDocumenti: sql<number>`COUNT(*)`,
    })
    .from(documentiFinanziari)
    .where(and(
      eq(documentiFinanziari.companyId, companyId),
      eq(documentiFinanziari.tipo, "entrata"),
      sql`${documentiFinanziari.residuo} > 0`,
      ne(documentiFinanziari.stato, "annullato"),
      ne(documentiFinanziari.stato, "bozza"),
    ));

  // Crediti scaduti
  const [creditiScadutiRes] = await db
    .select({ totale: sql<number>`COALESCE(SUM(${scadenzeFinanziarie.residuo}), 0)` })
    .from(scadenzeFinanziarie)
    .innerJoin(documentiFinanziari, eq(scadenzeFinanziarie.documentoId, documentiFinanziari.id))
    .where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      eq(documentiFinanziari.tipo, "entrata"),
      inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata", "scaduta"]),
      sql`${scadenzeFinanziarie.dataScadenza} < ${oggi}`,
    ));

  const [debitiRes] = await db
    .select({
      totaleResiduo: sql<number>`COALESCE(SUM(residuo), 0)`,
      numDocumenti: sql<number>`COUNT(*)`,
    })
    .from(documentiFinanziari)
    .where(and(
      eq(documentiFinanziari.companyId, companyId),
      eq(documentiFinanziari.tipo, "uscita"),
      sql`${documentiFinanziari.residuo} > 0`,
      ne(documentiFinanziari.stato, "annullato"),
      ne(documentiFinanziari.stato, "bozza"),
    ));

  const [debitiScadutiRes] = await db
    .select({ totale: sql<number>`COALESCE(SUM(${scadenzeFinanziarie.residuo}), 0)` })
    .from(scadenzeFinanziarie)
    .innerJoin(documentiFinanziari, eq(scadenzeFinanziarie.documentoId, documentiFinanziari.id))
    .where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      eq(documentiFinanziari.tipo, "uscita"),
      inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata", "scaduta"]),
      sql`${scadenzeFinanziarie.dataScadenza} < ${oggi}`,
    ));

  return {
    crediti: {
      totaleResiduo: Number(creditiRes.totaleResiduo),
      quotaScaduta: Number(creditiScadutiRes.totale),
      numDocumenti: Number(creditiRes.numDocumenti),
    },
    debiti: {
      totaleResiduo: Number(debitiRes.totaleResiduo),
      quotaScaduta: Number(debitiScadutiRes.totale),
      numDocumenti: Number(debitiRes.numDocumenti),
    },
  };
}

// ── ACCOUNTS (disponibilità liquida) ──
export async function dashboardAccounts(companyId: string) {
  const db = await getDb();
  if (!db) return null;

  const conti = await db
    .select()
    .from(contiFin)
    .where(and(eq(contiFin.companyId, companyId), eq(contiFin.attivo, true)));

  const saldoTotale = conti.reduce((sum: number, c: any) => sum + c.saldoAttuale, 0);

  const perTipo = new Map<string, number>();
  for (const c of conti) {
    perTipo.set(c.tipo, (perTipo.get(c.tipo) || 0) + c.saldoAttuale);
  }

  return {
    saldoTotale,
    conti: conti.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldoAttuale: c.saldoAttuale,
      banca: c.banca,
      valuta: c.valuta,
    })),
    perTipo: Object.fromEntries(perTipo),
  };
}
