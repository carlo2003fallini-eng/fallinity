import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { sql } from "drizzle-orm";
import { getActor } from "../_core";

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function nd(val: number | null | undefined): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.round(val * 100) / 100;
}

function periodoSql(periodo: string) {
  switch (periodo) {
    case "mese": return "INTERVAL 1 MONTH";
    case "trimestre": return "INTERVAL 3 MONTH";
    case "semestre": return "INTERVAL 6 MONTH";
    case "anno": return "INTERVAL 12 MONTH";
    default: return "INTERVAL 12 MONTH";
  }
}

const periodoInput = z.object({
  periodo: z.enum(["mese", "trimestre", "semestre", "anno"]).default("anno"),
}).optional();

// ─── KPI GENERALI ───────────────────────────────────────────────────────────────

async function getGeneralKpi(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return null;
  const intervallo = periodoSql(periodo);

  // Entrate, uscite, utile
  const finRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN tipo='entrata' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as ricavi,
      COALESCE(SUM(CASE WHEN tipo='uscita' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as costi
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const fin = (finRows as any[])[0]?.[0] ?? {};
  const ricavi = Number(fin.ricavi ?? 0);
  const costi = Number(fin.costi ?? 0);
  const utile = ricavi - costi;
  const margine = ricavi > 0 ? (utile / ricavi) * 100 : null;

  // Liquidità (saldo conti)
  const contiRows = (await db.execute(
    sql.raw(`SELECT COALESCE(SUM(CAST(saldo AS DECIMAL(14,2))),0) as liquidita
    FROM contiFin WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);
  const liquidita = Number((contiRows as any[])[0]?.[0]?.liquidita ?? 0);

  // Crediti e debiti
  const docRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN tipo='fattura_emessa' THEN CAST(importoResiduo AS DECIMAL(14,2)) ELSE 0 END),0) as crediti,
      COALESCE(SUM(CASE WHEN tipo='fattura_ricevuta' THEN CAST(importoResiduo AS DECIMAL(14,2)) ELSE 0 END),0) as debiti
    FROM documentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato IN ('attivo','scaduto')`),
  ) as any[]);
  const doc = (docRows as any[])[0]?.[0] ?? {};
  const crediti = Number(doc.crediti ?? 0);
  const debiti = Number(doc.debiti ?? 0);

  // Giorni medi incasso/pagamento (approssimazione)
  const giorniRows = (await db.execute(
    sql.raw(`SELECT 
      AVG(CASE WHEN tipo='fattura_emessa' AND stato='pagato' THEN DATEDIFF(updatedAt, dataEmissione) END) as giorniIncasso,
      AVG(CASE WHEN tipo='fattura_ricevuta' AND stato='pagato' THEN DATEDIFF(updatedAt, dataEmissione) END) as giorniPagamento
    FROM documentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND updatedAt >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const giorni = (giorniRows as any[])[0]?.[0] ?? {};

  // Copertura budget
  const budgetRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as totale,
      SUM(CASE WHEN stato='attivo' THEN 1 ELSE 0 END) as attivi
    FROM budgets WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);
  const budgetInfo = (budgetRows as any[])[0]?.[0] ?? {};

  // Copertura Reintegrazione
  const reintRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(AVG(CAST(percentualeCopertura AS DECIMAL(5,2))),0) as copertura
    FROM replacementPlans WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato='attivo'`),
  ) as any[]);
  const coperturaReint = Number((reintRows as any[])[0]?.[0]?.copertura ?? 0);

  // Cashflow (entrate - uscite del periodo)
  const cashflow = ricavi - costi;

  return {
    ricavi: nd(ricavi),
    costi: nd(costi),
    utile: nd(utile),
    margine: nd(margine),
    cashflow: nd(cashflow),
    liquidita: nd(liquidita),
    crediti: nd(crediti),
    debiti: nd(debiti),
    giorniIncasso: nd(Number(giorni.giorniIncasso)),
    giorniPagamento: nd(Number(giorni.giorniPagamento)),
    budgetAttivi: Number(budgetInfo.attivi ?? 0),
    coperturaReintegrazione: nd(coperturaReint),
  };
}

// ─── KPI STALLA ─────────────────────────────────────────────────────────────────

async function getDairyKpi(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return null;
  const intervallo = periodoSql(periodo);

  // Ricavi latte (movimenti con categoria latte o descrizione contenente latte)
  const ricaviRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN tipo='entrata' AND (descrizione LIKE '%latte%' OR descrizione LIKE '%Latte%') THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as ricavoLatte,
      COALESCE(SUM(CASE WHEN tipo='uscita' AND (descrizione LIKE '%mangime%' OR descrizione LIKE '%Mangime%' OR descrizione LIKE '%veterinar%' OR descrizione LIKE '%Veterinar%') THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as costoStalla
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const r = (ricaviRows as any[])[0]?.[0] ?? {};
  const ricavoLatte = Number(r.ricavoLatte ?? 0);
  const costoStalla = Number(r.costoStalla ?? 0);

  // Numero vacche attive
  const animaliRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as vacche FROM animali 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato='attivo'`),
  ) as any[]);
  const vacche = Number((animaliRows as any[])[0]?.[0]?.vacche ?? 0);

  // Trattamenti
  const trattRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as trattamenti FROM trattamentiAnimali 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND createdAt >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const trattamenti = Number((trattRows as any[])[0]?.[0]?.trattamenti ?? 0);

  const margine = ricavoLatte - costoStalla;
  const ricavoPerVacca = vacche > 0 ? ricavoLatte / vacche : null;
  const costoPerVacca = vacche > 0 ? costoStalla / vacche : null;
  const marginePerVacca = vacche > 0 ? margine / vacche : null;
  const costoTrattamentoPerCapo = vacche > 0 && trattamenti > 0 ? costoStalla * 0.3 / vacche : null; // stima 30% costi = trattamenti

  return {
    ricavoLatte: nd(ricavoLatte),
    costoStalla: nd(costoStalla),
    margine: nd(margine),
    vacche,
    ricavoPerVacca: nd(ricavoPerVacca),
    costoPerVacca: nd(costoPerVacca),
    marginePerVacca: nd(marginePerVacca),
    trattamenti,
    costoTrattamentoPerCapo: nd(costoTrattamentoPerCapo),
  };
}

// ─── KPI MACCHINARI ─────────────────────────────────────────────────────────────

async function getMachineryKpi(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return null;
  const intervallo = periodoSql(periodo);

  // Numero macchine
  const macchineRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as totale FROM macchine 
    WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);
  const totaleMacchine = Number((macchineRows as any[])[0]?.[0]?.totale ?? 0);

  // Costi manutenzione (interventi)
  const costiRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CAST(costoTotale AS DECIMAL(14,2))),0) as costoManutenzione,
      COUNT(*) as interventi
    FROM interventi 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND createdAt >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const c = (costiRows as any[])[0]?.[0] ?? {};
  const costoManutenzione = Number(c.costoManutenzione ?? 0);
  const interventi = Number(c.interventi ?? 0);

  const costoPerMacchina = totaleMacchine > 0 ? costoManutenzione / totaleMacchine : null;
  const frequenzaInterventi = totaleMacchine > 0 ? interventi / totaleMacchine : null;

  // Copertura Reintegrazione macchinari
  const reintRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(AVG(CAST(percentualeCopertura AS DECIMAL(5,2))),0) as copertura
    FROM replacementPlans 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato='attivo' AND macchinaId IS NOT NULL`),
  ) as any[]);
  const coperturaReint = Number((reintRows as any[])[0]?.[0]?.copertura ?? 0);

  return {
    totaleMacchine,
    costoManutenzione: nd(costoManutenzione),
    interventi,
    costoPerMacchina: nd(costoPerMacchina),
    frequenzaInterventi: nd(frequenzaInterventi),
    coperturaReintegrazione: nd(coperturaReint),
  };
}

// ─── KPI CAMPI ──────────────────────────────────────────────────────────────────

async function getCropsKpi(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return null;
  const intervallo = periodoSql(periodo);

  // Ettari totali
  const campiRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CAST(superficie AS DECIMAL(10,2))),0) as ettari,
      COUNT(*) as campi
    FROM campi WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);
  const campiInfo = (campiRows as any[])[0]?.[0] ?? {};
  const ettari = Number(campiInfo.ettari ?? 0);
  const numCampi = Number(campiInfo.campi ?? 0);

  // Costi campi (lavorazioni con costo)
  const costiRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CAST(costo AS DECIMAL(14,2))),0) as costoTotale
    FROM lavorazioni 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const costoTotale = Number((costiRows as any[])[0]?.[0]?.costoTotale ?? 0);

  // Ricavi colture
  const ricaviRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN tipo='entrata' AND (descrizione LIKE '%coltura%' OR descrizione LIKE '%raccolto%' OR descrizione LIKE '%grano%' OR descrizione LIKE '%mais%') THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as ricavi
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= DATE_SUB(CURDATE(), ${intervallo})`),
  ) as any[]);
  const ricavi = Number((ricaviRows as any[])[0]?.[0]?.ricavi ?? 0);

  const costoPerEttaro = ettari > 0 ? costoTotale / ettari : null;
  const ricavoPerEttaro = ettari > 0 ? ricavi / ettari : null;
  const marginePerEttaro = ettari > 0 ? (ricavi - costoTotale) / ettari : null;

  return {
    ettari: nd(ettari),
    numCampi,
    costoTotale: nd(costoTotale),
    ricavi: nd(ricavi),
    costoPerEttaro: nd(costoPerEttaro),
    ricavoPerEttaro: nd(ricavoPerEttaro),
    marginePerEttaro: nd(marginePerEttaro),
  };
}

// ─── ANALISI CENTRI DI COSTO ────────────────────────────────────────────────────

async function getCostCentersAnalysis(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return [];
  const intervallo = periodoSql(periodo);

  const rows = (await db.execute(
    sql.raw(`SELECT 
      cc.id, cc.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as spesa,
      COUNT(m.id) as movimenti
    FROM centriCosto cc
    LEFT JOIN movimentiFinanziari m ON m.centroCostoId=cc.id AND m.tipo='uscita' AND m.deletedAt IS NULL AND m.data >= DATE_SUB(CURDATE(), ${intervallo})
    WHERE cc.companyId='${companyId}' AND cc.deletedAt IS NULL
    GROUP BY cc.id, cc.nome
    ORDER BY spesa DESC`),
  ) as any[]);
  return ((rows as any[])[0] ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    spesa: Number(r.spesa ?? 0),
    movimenti: Number(r.movimenti ?? 0),
  }));
}

// ─── ANALISI FORNITORI ──────────────────────────────────────────────────────────

async function getSuppliersAnalysis(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return [];
  const intervallo = periodoSql(periodo);

  const rows = (await db.execute(
    sql.raw(`SELECT 
      s.id, s.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as spesa,
      COUNT(m.id) as movimenti
    FROM contatti s
    LEFT JOIN movimentiFinanziari m ON m.soggettoId=s.id AND m.tipo='uscita' AND m.deletedAt IS NULL AND m.data >= DATE_SUB(CURDATE(), ${intervallo})
    WHERE s.companyId='${companyId}' AND s.deletedAt IS NULL AND s.tipo IN ('fornitore','entrambi')
    GROUP BY s.id, s.nome
    ORDER BY spesa DESC
    LIMIT 20`),
  ) as any[]);
  return ((rows as any[])[0] ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    spesa: Number(r.spesa ?? 0),
    movimenti: Number(r.movimenti ?? 0),
  }));
}

// ─── ANALISI CLIENTI ────────────────────────────────────────────────────────────

async function getCustomersAnalysis(companyId: string, periodo: string) {
  const db = await getDb();
  if (!db) return [];
  const intervallo = periodoSql(periodo);

  const rows = (await db.execute(
    sql.raw(`SELECT 
      c.id, c.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as ricavi,
      COUNT(m.id) as movimenti
    FROM contatti c
    LEFT JOIN movimentiFinanziari m ON m.soggettoId=c.id AND m.tipo='entrata' AND m.deletedAt IS NULL AND m.data >= DATE_SUB(CURDATE(), ${intervallo})
    WHERE c.companyId='${companyId}' AND c.deletedAt IS NULL AND c.tipo IN ('cliente','entrambi')
    GROUP BY c.id, c.nome
    ORDER BY ricavi DESC
    LIMIT 20`),
  ) as any[]);
  return ((rows as any[])[0] ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    ricavi: Number(r.ricavi ?? 0),
    movimenti: Number(r.movimenti ?? 0),
  }));
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────────

export const analyticsRouter = router({
  general: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getGeneralKpi(actor.companyId, input?.periodo ?? "anno");
    }),

  dairy: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getDairyKpi(actor.companyId, input?.periodo ?? "anno");
    }),

  machinery: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getMachineryKpi(actor.companyId, input?.periodo ?? "anno");
    }),

  crops: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getCropsKpi(actor.companyId, input?.periodo ?? "anno");
    }),

  costCenters: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getCostCentersAnalysis(actor.companyId, input?.periodo ?? "anno");
    }),

  suppliers: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getSuppliersAnalysis(actor.companyId, input?.periodo ?? "anno");
    }),

  customers: protectedProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getCustomersAnalysis(actor.companyId, input?.periodo ?? "anno");
    }),
});
