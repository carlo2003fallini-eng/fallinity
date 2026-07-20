import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  movimentiCassa,
  scadenzeFinanziarie,
  documentiFinanziari,
  contiFin,
  ricorrenzeFinanziarie,
} from "../../../drizzle/schema";

// ── Types ──
export interface CashflowFilters {
  companyId: string;
  contoId?: string; // filtro per conto specifico
  dataInizio: string;
  dataFine: string;
}

export interface CashflowPoint {
  data: string; // YYYY-MM-DD o YYYY-MM
  entrateEffettive: number;
  usciteEffettive: number;
  saldoGiornaliero: number;
  saldoCumulativo: number;
}

export interface ForecastPoint {
  data: string;
  entratePrevisione: number;
  uscitePrevisione: number;
  saldoPrevisione: number;
  saldoCumulativo: number;
  fonti: string[]; // da dove viene la previsione
}

// ── CASHFLOW EFFETTIVO (storico) ──
export async function cashflowEffettivo(filters: CashflowFilters) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, contoId, dataInizio, dataFine } = filters;

  const conds: any[] = [
    eq(movimentiCassa.companyId, companyId),
    eq(movimentiCassa.stato, "confermato"),
    sql`${movimentiCassa.data} >= ${dataInizio}`,
    sql`${movimentiCassa.data} <= ${dataFine}`,
  ];
  if (contoId) conds.push(eq(movimentiCassa.contoId, contoId));

  // Raggruppa per giorno
  const contoFilter = contoId ? sql` AND contoId = ${contoId}` : sql``;
  const rawRows = (await db.execute(
    sql`SELECT DATE(data) as giorno, tipo, COALESCE(SUM(importo), 0) as totale
        FROM movimentiCassa
        WHERE companyId = ${companyId} AND stato = 'confermato'
          AND data >= ${dataInizio} AND data <= ${dataFine} ${contoFilter}
        GROUP BY DATE(data), tipo
        ORDER BY giorno`,
  ) as any[]);
  const rows = (rawRows as any[])[0] ?? rawRows ?? [];

  // Costruisci mappa giornaliera
  const map = new Map<string, { entrate: number; uscite: number }>();
  for (const r of rows) {
    const d = String(r.data);
    if (!map.has(d)) map.set(d, { entrate: 0, uscite: 0 });
    const entry = map.get(d)!;
    if (r.tipo === "entrata") entry.entrate = Number(r.totale);
    else entry.uscite = Number(r.totale);
  }

  // Saldo iniziale (prima di dataInizio)
  const [saldoInizialeRes] = await db
    .select({
      entrate: sql<number>`COALESCE(SUM(CASE WHEN tipo = 'entrata' THEN importo ELSE 0 END), 0)`,
      uscite: sql<number>`COALESCE(SUM(CASE WHEN tipo = 'uscita' THEN importo ELSE 0 END), 0)`,
    })
    .from(movimentiCassa)
    .where(and(
      eq(movimentiCassa.companyId, companyId),
      eq(movimentiCassa.stato, "confermato"),
      sql`${movimentiCassa.data} < ${dataInizio}`,
      ...(contoId ? [eq(movimentiCassa.contoId, contoId)] : []),
    ));

  // Saldo iniziale dai conti
  let saldoIniziale: number;
  if (contoId) {
    const [conto] = await db.select().from(contiFin).where(eq(contiFin.id, contoId));
    saldoIniziale = conto ? conto.saldoIniziale + Number(saldoInizialeRes.entrate) - Number(saldoInizialeRes.uscite) : 0;
  } else {
    const conti = await db.select().from(contiFin).where(and(eq(contiFin.companyId, companyId), eq(contiFin.attivo, true)));
    const saldoInizialeConti = conti.reduce((sum: number, c: any) => sum + c.saldoIniziale, 0);
    saldoIniziale = saldoInizialeConti + Number(saldoInizialeRes.entrate) - Number(saldoInizialeRes.uscite);
  }

  // Genera serie giornaliera
  const result: CashflowPoint[] = [];
  let cumulativo = saldoIniziale;
  const start = new Date(dataInizio);
  const end = new Date(dataFine);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    const entry = map.get(key) || { entrate: 0, uscite: 0 };
    const saldoGiornaliero = entry.entrate - entry.uscite;
    cumulativo += saldoGiornaliero;
    result.push({
      data: key,
      entrateEffettive: entry.entrate,
      usciteEffettive: entry.uscite,
      saldoGiornaliero,
      saldoCumulativo: cumulativo,
    });
  }

  return {
    saldoIniziale,
    saldoFinale: cumulativo,
    variazione: cumulativo - saldoIniziale,
    punti: result,
  };
}

// ── CASHFLOW PREVISTO (forecast) ──
export async function cashflowPrevisto(filters: CashflowFilters & { orizzonteGiorni: number }) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, contoId, orizzonteGiorni } = filters;
  const oggi = new Date();
  const dataInizio = oggi.toISOString().split("T")[0];
  const fine = new Date(oggi.getTime() + orizzonteGiorni * 86400000);
  const dataFine = fine.toISOString().split("T")[0];

  // 1. Scadenze aperte nel periodo
  const scadenze = await db
    .select({
      dataScadenza: scadenzeFinanziarie.dataScadenza,
      residuo: scadenzeFinanziarie.residuo,
      documentoId: scadenzeFinanziarie.documentoId,
    })
    .from(scadenzeFinanziarie)
    .where(and(
      eq(scadenzeFinanziarie.companyId, companyId),
      inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata"]),
      sql`${scadenzeFinanziarie.dataScadenza} >= ${dataInizio}`,
      sql`${scadenzeFinanziarie.dataScadenza} <= ${dataFine}`,
    ))
    .orderBy(asc(scadenzeFinanziarie.dataScadenza));

  // Arricchisci con tipo documento
  const docIds = Array.from(new Set(scadenze.map((s: any) => s.documentoId)));
  const docs = docIds.length > 0
    ? await db.select({ id: documentiFinanziari.id, tipo: documentiFinanziari.tipo }).from(documentiFinanziari).where(inArray(documentiFinanziari.id, docIds))
    : [];
  const docMap = new Map(docs.map((d: any) => [d.id, d.tipo]));

  // 2. Ricorrenze attive nel periodo
  const ricorrenze = await db
    .select()
    .from(ricorrenzeFinanziarie)
    .where(and(
      eq(ricorrenzeFinanziarie.companyId, companyId),
      eq(ricorrenzeFinanziarie.attiva, true),
      sql`${ricorrenzeFinanziarie.prossimaEmissione} >= ${dataInizio}`,
      sql`${ricorrenzeFinanziarie.prossimaEmissione} <= ${dataFine}`,
    ));

  // 3. Saldo attuale
  let saldoAttuale: number;
  if (contoId) {
    const [conto] = await db.select().from(contiFin).where(eq(contiFin.id, contoId));
    saldoAttuale = conto ? conto.saldoAttuale : 0;
  } else {
    const conti = await db.select().from(contiFin).where(and(eq(contiFin.companyId, companyId), eq(contiFin.attivo, true)));
    saldoAttuale = conti.reduce((sum: number, c: any) => sum + c.saldoAttuale, 0);
  }

  // Costruisci mappa previsionale giornaliera
  const map = new Map<string, { entrate: number; uscite: number; fonti: Set<string> }>();

  // Scadenze
  for (const s of scadenze) {
    const d = String(s.dataScadenza);
    if (!map.has(d)) map.set(d, { entrate: 0, uscite: 0, fonti: new Set() });
    const entry = map.get(d)!;
    const tipo = docMap.get(s.documentoId);
    if (tipo === "entrata") {
      entry.entrate += s.residuo;
      entry.fonti.add("scadenza_incasso");
    } else {
      entry.uscite += s.residuo;
      entry.fonti.add("scadenza_pagamento");
    }
  }

  // Ricorrenze
  for (const r of ricorrenze) {
    const d = String(r.prossimaEmissione);
    if (!map.has(d)) map.set(d, { entrate: 0, uscite: 0, fonti: new Set() });
    const entry = map.get(d)!;
    if (r.tipo === "entrata") {
      entry.entrate += r.totale || 0;
    } else {
      entry.uscite += r.totale || 0;
    }
    entry.fonti.add("ricorrenza");
  }

  // Genera serie
  const result: ForecastPoint[] = [];
  let cumulativo = saldoAttuale;

  for (let d = new Date(oggi); d <= fine; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    const entry = map.get(key) || { entrate: 0, uscite: 0, fonti: new Set<string>() };
    const saldoPrevisione = entry.entrate - entry.uscite;
    cumulativo += saldoPrevisione;
    result.push({
      data: key,
      entratePrevisione: entry.entrate,
      uscitePrevisione: entry.uscite,
      saldoPrevisione,
      saldoCumulativo: cumulativo,
      fonti: Array.from(entry.fonti),
    });
  }

  // Calcola orizzonti
  const saldo7gg = result.length >= 7 ? result[6].saldoCumulativo : cumulativo;
  const saldo30gg = result.length >= 30 ? result[29].saldoCumulativo : cumulativo;
  const saldo90gg = result.length >= 90 ? result[89].saldoCumulativo : cumulativo;

  // Punto minimo
  const puntoMinimo = result.reduce((min, p) => p.saldoCumulativo < min.saldoCumulativo ? p : min, result[0]);

  return {
    saldoAttuale,
    orizzonti: {
      "7gg": saldo7gg,
      "30gg": saldo30gg,
      "90gg": saldo90gg,
    },
    puntoMinimo: { data: puntoMinimo?.data, saldo: puntoMinimo?.saldoCumulativo },
    totaleEntrateAttese: result.reduce((sum, p) => sum + p.entratePrevisione, 0),
    totaleUsciteAttese: result.reduce((sum, p) => sum + p.uscitePrevisione, 0),
    punti: result,
  };
}

// ── CASHFLOW MENSILE (aggregato per mese, utile per grafici) ──
export async function cashflowMensile(filters: CashflowFilters) {
  const db = await getDb();
  if (!db) return null;

  const { companyId, contoId, dataInizio, dataFine } = filters;

  const conds: any[] = [
    eq(movimentiCassa.companyId, companyId),
    eq(movimentiCassa.stato, "confermato"),
    sql`${movimentiCassa.data} >= ${dataInizio}`,
    sql`${movimentiCassa.data} <= ${dataFine}`,
  ];
  if (contoId) conds.push(eq(movimentiCassa.contoId, contoId));

  const contoFilter2 = contoId ? sql` AND contoId = ${contoId}` : sql``;
  const rawRows2 = (await db.execute(
    sql`SELECT DATE_FORMAT(data, '%Y-%m') as mese, tipo, COALESCE(SUM(importo), 0) as totale
        FROM movimentiCassa
        WHERE companyId = ${companyId} AND stato = 'confermato'
          AND data >= ${dataInizio} AND data <= ${dataFine} ${contoFilter2}
        GROUP BY DATE_FORMAT(data, '%Y-%m'), tipo
        ORDER BY mese`,
  ) as any[]);
  const rows = (rawRows2 as any[])[0] ?? rawRows2 ?? [];

  const map = new Map<string, { entrate: number; uscite: number }>();
  for (const r of rows) {
    const m = String(r.mese);
    if (!map.has(m)) map.set(m, { entrate: 0, uscite: 0 });
    const entry = map.get(m)!;
    if (r.tipo === "entrata") entry.entrate = Number(r.totale);
    else entry.uscite = Number(r.totale);
  }

  const result = Array.from(map.entries()).map(([mese, entry]) => ({
    mese,
    entrate: entry.entrate,
    uscite: entry.uscite,
    netto: entry.entrate - entry.uscite,
  }));

  return { punti: result };
}
