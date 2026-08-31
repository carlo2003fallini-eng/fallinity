import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categorieFinanziarie,
  centriDiCosto,
  documentiFinanziari,
  soggetti,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const financialAnalysisInput = z.object({
  dataInizio: dateField,
  dataFine: dateField,
  confrontoInizio: dateField,
  confrontoFine: dateField,
  granularita: z.enum(["mese", "anno"]).default("mese"),
  soggettoId: z.string().optional(),
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
});

export type FinancialAnalysisInput = z.infer<typeof financialAnalysisInput>;

type Totals = {
  entrate: number;
  uscite: number;
  utile: number;
  margine: number | null;
  movimenti: number;
};

function percentuale(attuale: number, precedente: number): number | null {
  if (precedente === 0) return attuale === 0 ? 0 : null;
  return Math.round((((attuale - precedente) / Math.abs(precedente)) * 100) * 10) / 10;
}

export function confrontaValore(attuale: number, precedente: number) {
  return {
    valore: attuale,
    precedente,
    differenza: attuale - precedente,
    percentuale: percentuale(attuale, precedente),
  };
}

function condizioniBase(companyId: string, input: FinancialAnalysisInput, inizio: string, fine: string) {
  const condizioni: any[] = [
    eq(documentiFinanziari.companyId, companyId),
    isNull(documentiFinanziari.deletedAt),
    sql`${documentiFinanziari.stato} NOT IN ('bozza', 'annullato')`,
    sql`${documentiFinanziari.dataDocumento} >= ${inizio}`,
    sql`${documentiFinanziari.dataDocumento} <= ${fine}`,
  ];
  if (input.soggettoId) condizioni.push(eq(documentiFinanziari.soggettoId, input.soggettoId));
  if (input.categoriaId) condizioni.push(eq(documentiFinanziari.categoriaId, input.categoriaId));
  if (input.centroCostoId) condizioni.push(eq(documentiFinanziari.centroCostoId, input.centroCostoId));
  return condizioni;
}

async function totaliPeriodo(companyId: string, input: FinancialAnalysisInput, inizio: string, fine: string): Promise<Totals> {
  const db = await getDb();
  if (!db) return { entrate: 0, uscite: 0, utile: 0, margine: null, movimenti: 0 };
  const [row] = await db.select({
    entrate: sql<number>`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'entrata' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`,
    uscite: sql<number>`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'uscita' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`,
    movimenti: sql<number>`COUNT(*)`,
  }).from(documentiFinanziari).where(and(...condizioniBase(companyId, input, inizio, fine)));

  const entrate = Number(row?.entrate ?? 0);
  const uscite = Number(row?.uscite ?? 0);
  const utile = entrate - uscite;
  return {
    entrate,
    uscite,
    utile,
    margine: entrate > 0 ? Math.round((utile / entrate) * 1000) / 10 : null,
    movimenti: Number(row?.movimenti ?? 0),
  };
}

async function trendPeriodo(companyId: string, input: FinancialAnalysisInput) {
  const db = await getDb();
  if (!db) return [];
  const bucket = input.granularita === "anno"
    ? sql<string>`CAST(YEAR(MIN(${documentiFinanziari.dataDocumento})) AS CHAR)`
    : sql<string>`DATE_FORMAT(MIN(${documentiFinanziari.dataDocumento}), '%Y-%m')`;
  const groupFields = input.granularita === "anno"
    ? [sql`YEAR(${documentiFinanziari.dataDocumento})`]
    : [sql`YEAR(${documentiFinanziari.dataDocumento})`, sql`MONTH(${documentiFinanziari.dataDocumento})`];

  const rows = await db.select({
    periodo: bucket,
    entrate: sql<number>`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'entrata' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`,
    uscite: sql<number>`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'uscita' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`,
  }).from(documentiFinanziari)
    .where(and(...condizioniBase(companyId, input, input.dataInizio, input.dataFine)))
    .groupBy(...groupFields)
    .orderBy(...groupFields);

  return rows.map((row) => ({
    periodo: String(row.periodo),
    entrate: Number(row.entrate ?? 0),
    uscite: Number(row.uscite ?? 0),
    risultato: Number(row.entrate ?? 0) - Number(row.uscite ?? 0),
  }));
}

async function distribuzioneCategorie(companyId: string, input: FinancialAnalysisInput) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: categorieFinanziarie.id,
    nome: categorieFinanziarie.nome,
    colore: categorieFinanziarie.colore,
    tipo: documentiFinanziari.tipo,
    totale: sql<number>`COALESCE(SUM(${documentiFinanziari.totale}), 0)`,
    movimenti: sql<number>`COUNT(${documentiFinanziari.id})`,
  }).from(documentiFinanziari)
    .leftJoin(categorieFinanziarie, and(
      eq(categorieFinanziarie.id, documentiFinanziari.categoriaId),
      eq(categorieFinanziarie.companyId, documentiFinanziari.companyId),
    ))
    .where(and(...condizioniBase(companyId, input, input.dataInizio, input.dataFine)))
    .groupBy(categorieFinanziarie.id, categorieFinanziarie.nome, categorieFinanziarie.colore, documentiFinanziari.tipo)
    .orderBy(desc(sql`COALESCE(SUM(${documentiFinanziari.totale}), 0)`))
    .limit(12);
  return rows.map((row) => ({ ...row, nome: row.nome ?? "Senza categoria", totale: Number(row.totale), movimenti: Number(row.movimenti) }));
}

async function distribuzioneSoggetti(companyId: string, input: FinancialAnalysisInput) {
  const db = await getDb();
  if (!db) return [];
  const nome = sql<string>`COALESCE(${soggetti.nomeBreve}, ${soggetti.ragioneSociale}, 'Senza soggetto')`;
  const rows = await db.select({
    id: soggetti.id,
    nome,
    tipo: documentiFinanziari.tipo,
    totale: sql<number>`COALESCE(SUM(${documentiFinanziari.totale}), 0)`,
    movimenti: sql<number>`COUNT(${documentiFinanziari.id})`,
  }).from(documentiFinanziari)
    .leftJoin(soggetti, and(
      eq(soggetti.id, documentiFinanziari.soggettoId),
      eq(soggetti.companyId, documentiFinanziari.companyId),
    ))
    .where(and(...condizioniBase(companyId, input, input.dataInizio, input.dataFine)))
    .groupBy(soggetti.id, soggetti.nomeBreve, soggetti.ragioneSociale, documentiFinanziari.tipo)
    .orderBy(desc(sql`COALESCE(SUM(${documentiFinanziari.totale}), 0)`))
    .limit(12);
  return rows.map((row) => ({ ...row, nome: String(row.nome), totale: Number(row.totale), movimenti: Number(row.movimenti) }));
}

async function distribuzioneCentri(companyId: string, input: FinancialAnalysisInput) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: centriDiCosto.id,
    nome: centriDiCosto.nome,
    totale: sql<number>`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'uscita' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`,
    movimenti: sql<number>`COUNT(${documentiFinanziari.id})`,
  }).from(documentiFinanziari)
    .leftJoin(centriDiCosto, and(
      eq(centriDiCosto.id, documentiFinanziari.centroCostoId),
      eq(centriDiCosto.companyId, documentiFinanziari.companyId),
    ))
    .where(and(...condizioniBase(companyId, input, input.dataInizio, input.dataFine)))
    .groupBy(centriDiCosto.id, centriDiCosto.nome)
    .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${documentiFinanziari.tipo} = 'uscita' THEN ${documentiFinanziari.totale} ELSE 0 END), 0)`))
    .limit(10);
  return rows.map((row) => ({ ...row, nome: row.nome ?? "Non assegnato", totale: Number(row.totale), movimenti: Number(row.movimenti) }))
    .filter((row) => row.totale > 0);
}

export function creaInsightFinanziari(attuale: Totals, precedente: Totals, categorie: Array<{ nome: string; tipo: string; totale: number }>, soggetti: Array<{ nome: string; tipo: string; totale: number }>) {
  const insight: Array<{ livello: "positivo" | "attenzione" | "informativo"; titolo: string; messaggio: string }> = [];
  const variazioneCosti = percentuale(attuale.uscite, precedente.uscite);
  const variazioneRicavi = percentuale(attuale.entrate, precedente.entrate);

  if (attuale.utile < 0) insight.push({ livello: "attenzione", titolo: "Risultato negativo", messaggio: `Le uscite superano le entrate di €${(Math.abs(attuale.utile) / 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })} nel periodo selezionato.` });
  if (variazioneCosti !== null && variazioneCosti >= 15) insight.push({ livello: "attenzione", titolo: "Costi in aumento", messaggio: `Le uscite sono cresciute del ${variazioneCosti.toFixed(1)}% rispetto al periodo di confronto.` });
  if (variazioneRicavi !== null && variazioneRicavi >= 10) insight.push({ livello: "positivo", titolo: "Ricavi in crescita", messaggio: `Le entrate sono aumentate del ${variazioneRicavi.toFixed(1)}% rispetto al periodo di confronto.` });

  const totaleUscite = categorie.filter((c) => c.tipo === "uscita").reduce((sum, c) => sum + c.totale, 0);
  const categoriaTop = categorie.find((c) => c.tipo === "uscita");
  if (categoriaTop && totaleUscite > 0 && categoriaTop.totale / totaleUscite >= 0.35) {
    insight.push({ livello: "informativo", titolo: "Costo concentrato", messaggio: `${categoriaTop.nome} rappresenta ${Math.round((categoriaTop.totale / totaleUscite) * 100)}% delle uscite analizzate.` });
  }

  const fornitori = soggetti.filter((s) => s.tipo === "uscita");
  const totaleFornitori = fornitori.reduce((sum, s) => sum + s.totale, 0);
  const fornitoreTop = fornitori[0];
  if (fornitoreTop && totaleFornitori > 0 && fornitoreTop.totale / totaleFornitori >= 0.4) {
    insight.push({ livello: "informativo", titolo: "Dipendenza da un fornitore", messaggio: `${fornitoreTop.nome} concentra ${Math.round((fornitoreTop.totale / totaleFornitori) * 100)}% della spesa per soggetto.` });
  }

  if (insight.length === 0) insight.push({ livello: "positivo", titolo: "Andamento stabile", messaggio: "Non emergono scostamenti rilevanti nel periodo selezionato." });
  return insight.slice(0, 4);
}

export async function financialAnalysisOverview(companyId: string, input: FinancialAnalysisInput) {
  const [attuale, precedente, trend, categorie, soggettiDati, centriCosto] = await Promise.all([
    totaliPeriodo(companyId, input, input.dataInizio, input.dataFine),
    totaliPeriodo(companyId, input, input.confrontoInizio, input.confrontoFine),
    trendPeriodo(companyId, input),
    distribuzioneCategorie(companyId, input),
    distribuzioneSoggetti(companyId, input),
    distribuzioneCentri(companyId, input),
  ]);

  return {
    periodo: { inizio: input.dataInizio, fine: input.dataFine },
    confronto: { inizio: input.confrontoInizio, fine: input.confrontoFine },
    kpi: {
      entrate: confrontaValore(attuale.entrate, precedente.entrate),
      uscite: confrontaValore(attuale.uscite, precedente.uscite),
      utile: confrontaValore(attuale.utile, precedente.utile),
      margine: {
        valore: attuale.margine,
        precedente: precedente.margine,
        differenza: attuale.margine !== null && precedente.margine !== null ? Math.round((attuale.margine - precedente.margine) * 10) / 10 : null,
      },
      movimenti: confrontaValore(attuale.movimenti, precedente.movimenti),
    },
    trend,
    categorie,
    soggetti: soggettiDati,
    centriCosto,
    insight: creaInsightFinanziari(attuale, precedente, categorie as any, soggettiDati as any),
  };
}
