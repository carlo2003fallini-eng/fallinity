import { eq, and, sql, ne, isNull, inArray, desc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  alertFinanziari,
  soglieAlert,
  contiFin,
  scadenzeFinanziarie,
  documentiFinanziari,
  movimentiCassa,
} from "../../../drizzle/schema";
import { randomUUID } from "crypto";

// ── Types ──
export type TipoAlert =
  | "saldo_negativo"
  | "conto_sotto_soglia"
  | "scadenza_scaduta"
  | "scadenza_imminente"
  | "pagamento_importante"
  | "incasso_ritardo"
  | "aumento_uscite"
  | "doc_senza_scadenza"
  | "mov_senza_categoria";

export type Severita = "info" | "attenzione" | "alta" | "critica";

interface AlertInput {
  companyId: string;
  tipo: TipoAlert;
  severita: Severita;
  titolo: string;
  descrizione?: string;
  valore?: number;
  entitaId?: string;
  entitaTipo?: string;
}

// ── SOGLIE DEFAULT ──
const SOGLIE_DEFAULT: Record<string, number> = {
  saldo_minimo: 0, // centesimi (0 = alert solo se negativo)
  importo_rilevante: 500000, // 5000 EUR in centesimi
  giorni_preavviso: 7, // giorni prima della scadenza
  percentuale_aumento: 2000, // 20% in basis points
};

// ── CRUD SOGLIE ──
export async function getSoglie(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(soglieAlert).where(and(eq(soglieAlert.companyId, companyId), isNull(soglieAlert.deletedAt)));
}

export async function upsertSoglia(companyId: string, tipo: string, valore: number, userId?: string) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db.select().from(soglieAlert).where(and(
    eq(soglieAlert.companyId, companyId),
    eq(soglieAlert.tipo, tipo),
    isNull(soglieAlert.deletedAt),
  ));

  if (existing.length > 0) {
    await db.update(soglieAlert).set({ valore, updatedBy: userId || null }).where(eq(soglieAlert.id, existing[0].id));
    return { ...existing[0], valore };
  } else {
    const id = randomUUID();
    await db.insert(soglieAlert).values({ id, companyId, tipo, valore, attivo: true, createdBy: userId || null });
    return { id, companyId, tipo, valore, attivo: true };
  }
}

// ── CRUD ALERT ──
export async function listAlerts(companyId: string, filters?: { risolto?: boolean; tipo?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conds: any[] = [eq(alertFinanziari.companyId, companyId)];
  if (filters?.risolto !== undefined) conds.push(eq(alertFinanziari.risolto, filters.risolto));
  if (filters?.tipo) conds.push(eq(alertFinanziari.tipo, filters.tipo));

  return db.select().from(alertFinanziari)
    .where(and(...conds))
    .orderBy(desc(alertFinanziari.dataCreazione))
    .limit(filters?.limit ?? 50);
}

export async function markAlertLetto(alertId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(alertFinanziari).set({ letto: true }).where(eq(alertFinanziari.id, alertId));
}

export async function markAlertRisolto(alertId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(alertFinanziari).set({ risolto: true }).where(eq(alertFinanziari.id, alertId));
}

export async function countAlertNonLetti(companyId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [res] = await db.select({ count: sql<number>`COUNT(*)` }).from(alertFinanziari)
    .where(and(eq(alertFinanziari.companyId, companyId), eq(alertFinanziari.letto, false), eq(alertFinanziari.risolto, false)));
  return Number(res.count);
}

// ── CALCOLO ALERT (deterministico) ──
async function getSogliaValore(companyId: string, tipo: string): Promise<number> {
  const db = await getDb();
  if (!db) return SOGLIE_DEFAULT[tipo] ?? 0;

  const [soglia] = await db.select().from(soglieAlert).where(and(
    eq(soglieAlert.companyId, companyId),
    eq(soglieAlert.tipo, tipo),
    eq(soglieAlert.attivo, true),
    isNull(soglieAlert.deletedAt),
  ));

  return soglia ? soglia.valore : (SOGLIE_DEFAULT[tipo] ?? 0);
}

async function insertAlert(input: AlertInput) {
  const db = await getDb();
  if (!db) return;
  const id = randomUUID();
  const oggi = new Date().toISOString().split("T")[0];
  await db.insert(alertFinanziari).values({
    id,
    companyId: input.companyId,
    tipo: input.tipo,
    severita: input.severita,
    titolo: input.titolo,
    descrizione: input.descrizione || null,
    valore: input.valore ?? null,
    entitaId: input.entitaId || null,
    entitaTipo: input.entitaTipo || null,
    letto: false,
    risolto: false,
    dataCreazione: new Date(oggi),
  });
}

export async function calcolaAlerts(companyId: string): Promise<{ nuovi: number; tipi: string[] }> {
  const db = await getDb();
  if (!db) return { nuovi: 0, tipi: [] };

  const oggi = new Date().toISOString().split("T")[0];
  const nuoviAlert: AlertInput[] = [];

  // 1. Saldo negativo / sotto soglia
  const sogliaMinima = await getSogliaValore(companyId, "saldo_minimo");
  const conti = await db.select().from(contiFin).where(and(eq(contiFin.companyId, companyId), eq(contiFin.attivo, true)));

  for (const conto of conti) {
    if (conto.saldoAttuale < 0) {
      nuoviAlert.push({
        companyId,
        tipo: "saldo_negativo",
        severita: "critica",
        titolo: `Saldo negativo: ${conto.nome}`,
        descrizione: `Il conto "${conto.nome}" ha saldo negativo di ${(conto.saldoAttuale / 100).toFixed(2)} EUR`,
        valore: conto.saldoAttuale,
        entitaId: conto.id,
        entitaTipo: "conto",
      });
    } else if (sogliaMinima > 0 && conto.saldoAttuale < sogliaMinima) {
      nuoviAlert.push({
        companyId,
        tipo: "conto_sotto_soglia",
        severita: "alta",
        titolo: `Conto sotto soglia: ${conto.nome}`,
        descrizione: `Il conto "${conto.nome}" (${(conto.saldoAttuale / 100).toFixed(2)} EUR) è sotto la soglia di ${(sogliaMinima / 100).toFixed(2)} EUR`,
        valore: conto.saldoAttuale,
        entitaId: conto.id,
        entitaTipo: "conto",
      });
    }
  }

  // 2. Scadenze scadute
  const scadute = await db.select().from(scadenzeFinanziarie).where(and(
    eq(scadenzeFinanziarie.companyId, companyId),
    inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata"]),
    sql`${scadenzeFinanziarie.dataScadenza} < ${oggi}`,
  ));

  for (const s of scadute) {
    nuoviAlert.push({
      companyId,
      tipo: "scadenza_scaduta",
      severita: "alta",
      titolo: `Scadenza scaduta: ${(s.residuo / 100).toFixed(2)} EUR`,
      descrizione: `Scadenza del ${s.dataScadenza} con residuo ${(s.residuo / 100).toFixed(2)} EUR non pagata`,
      valore: s.residuo,
      entitaId: s.id,
      entitaTipo: "scadenza",
    });
  }

  // 3. Scadenze imminenti (entro N giorni)
  const giorniPreavviso = await getSogliaValore(companyId, "giorni_preavviso");
  const dataLimite = new Date(Date.now() + giorniPreavviso * 86400000).toISOString().split("T")[0];

  const imminenti = await db.select().from(scadenzeFinanziarie).where(and(
    eq(scadenzeFinanziarie.companyId, companyId),
    inArray(scadenzeFinanziarie.stato, ["aperta", "parzialmente_pagata"]),
    sql`${scadenzeFinanziarie.dataScadenza} >= ${oggi}`,
    sql`${scadenzeFinanziarie.dataScadenza} <= ${dataLimite}`,
  ));

  for (const s of imminenti) {
    nuoviAlert.push({
      companyId,
      tipo: "scadenza_imminente",
      severita: "attenzione",
      titolo: `Scadenza imminente: ${(s.residuo / 100).toFixed(2)} EUR il ${s.dataScadenza}`,
      descrizione: `Scadenza di ${(s.residuo / 100).toFixed(2)} EUR in scadenza il ${s.dataScadenza}`,
      valore: s.residuo,
      entitaId: s.id,
      entitaTipo: "scadenza",
    });
  }

  // 4. Documenti registrati senza scadenza
  const docSenzaScadenza = await db
    .select({ id: documentiFinanziari.id, descrizione: documentiFinanziari.descrizione, totale: documentiFinanziari.totale })
    .from(documentiFinanziari)
    .where(and(
      eq(documentiFinanziari.companyId, companyId),
      eq(documentiFinanziari.stato, "registrato"),
      sql`${documentiFinanziari.residuo} > 0`,
      ne(documentiFinanziari.stato, "annullato"),
    ))
    .limit(10);

  // Filtra quelli che non hanno scadenze
  for (const doc of docSenzaScadenza) {
    const [scadCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(scadenzeFinanziarie)
      .where(and(eq(scadenzeFinanziarie.documentoId, doc.id), isNull(scadenzeFinanziarie.deletedAt)));
    if (Number(scadCount.count) === 0) {
      nuoviAlert.push({
        companyId,
        tipo: "doc_senza_scadenza",
        severita: "info",
        titolo: `Documento senza scadenza`,
        descrizione: `Il documento "${doc.descrizione || 'N/A'}" (${(doc.totale / 100).toFixed(2)} EUR) non ha scadenze associate`,
        valore: doc.totale,
        entitaId: doc.id,
        entitaTipo: "documento",
      });
    }
  }

  // 5. Aumento uscite rispetto al mese precedente
  const inizioMeseCorrente = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const fineMeseCorrente = oggi;
  const inizioMesePrecedente = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0];
  const fineMesePrecedente = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0];

  const [usciteMeseCorrente] = await db.select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
    .from(movimentiCassa).where(and(
      eq(movimentiCassa.companyId, companyId),
      eq(movimentiCassa.tipo, "uscita"),
      eq(movimentiCassa.stato, "confermato"),
      sql`${movimentiCassa.data} >= ${inizioMeseCorrente}`,
      sql`${movimentiCassa.data} <= ${fineMeseCorrente}`,
    ));

  const [usciteMesePrecedente] = await db.select({ total: sql<number>`COALESCE(SUM(importo), 0)` })
    .from(movimentiCassa).where(and(
      eq(movimentiCassa.companyId, companyId),
      eq(movimentiCassa.tipo, "uscita"),
      eq(movimentiCassa.stato, "confermato"),
      sql`${movimentiCassa.data} >= ${inizioMesePrecedente}`,
      sql`${movimentiCassa.data} <= ${fineMesePrecedente}`,
    ));

  const usciteAttuali = Number(usciteMeseCorrente.total);
  const uscitePrecedenti = Number(usciteMesePrecedente.total);
  const sogliaAumento = await getSogliaValore(companyId, "percentuale_aumento");

  if (uscitePrecedenti > 0 && usciteAttuali > 0) {
    const aumento = Math.round(((usciteAttuali - uscitePrecedenti) / uscitePrecedenti) * 10000);
    if (aumento > sogliaAumento) {
      nuoviAlert.push({
        companyId,
        tipo: "aumento_uscite",
        severita: "attenzione",
        titolo: `Uscite in aumento: +${(aumento / 100).toFixed(1)}%`,
        descrizione: `Le uscite di questo mese (${(usciteAttuali / 100).toFixed(2)} EUR) superano del ${(aumento / 100).toFixed(1)}% quelle del mese precedente (${(uscitePrecedenti / 100).toFixed(2)} EUR)`,
        valore: usciteAttuali,
      });
    }
  }

  // Inserisci gli alert (evita duplicati per oggi)
  const alertOggi = await db.select({ tipo: alertFinanziari.tipo, entitaId: alertFinanziari.entitaId })
    .from(alertFinanziari).where(and(
      eq(alertFinanziari.companyId, companyId),
      sql`${alertFinanziari.dataCreazione} = ${oggi}`,
      eq(alertFinanziari.risolto, false),
    ));
  const alertOggiSet = new Set(alertOggi.map((a: any) => `${a.tipo}:${a.entitaId || ''}`));

  let inseriti = 0;
  const tipiInseriti = new Set<string>();
  for (const alert of nuoviAlert) {
    const key = `${alert.tipo}:${alert.entitaId || ''}`;
    if (!alertOggiSet.has(key)) {
      await insertAlert(alert);
      inseriti++;
      tipiInseriti.add(alert.tipo);
    }
  }

  return { nuovi: inseriti, tipi: Array.from(tipiInseriti) };
}
