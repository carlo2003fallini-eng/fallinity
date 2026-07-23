import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { insights } from "../../../drizzle/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { getActor } from "../_core";

// ─── TYPES ──────────────────────────────────────────────────────────────────────

type InsightData = {
  tipo: string;
  titolo: string;
  messaggio: string;
  datiAnalizzati: Record<string, any>;
  motivazione: string;
  livelloConfidenza: "alto" | "medio" | "basso";
  linkDettaglio?: string;
  azioneSuggerita?: string;
};

// ─── REGOLE DETERMINISTICHE ─────────────────────────────────────────────────────

async function generateDeterministicInsights(companyId: string): Promise<InsightData[]> {
  const db = await getDb();
  if (!db) return [];
  const results: InsightData[] = [];

  // 1. Budget superato (>100%)
  const budgetRows = (await db.execute(
    sql.raw(`SELECT b.id, b.nome, b.importoPrevisto, b.tipo,
      COALESCE((SELECT SUM(CAST(m.importo AS DECIMAL(14,2))) FROM movimentiFinanziari m 
        WHERE m.companyId='${companyId}' AND m.deletedAt IS NULL AND m.tipo=b.tipo
        AND m.categoriaId=b.categoriaId AND m.data >= b.dataInizio AND m.data <= b.dataFine),0) as consuntivo
    FROM budgets b WHERE b.companyId='${companyId}' AND b.deletedAt IS NULL AND b.stato='attivo'
    HAVING consuntivo > CAST(b.importoPrevisto AS DECIMAL(14,2))`),
  ) as any[]);
  for (const b of ((budgetRows as any[])[0] ?? [])) {
    const perc = Math.round((Number(b.consuntivo) / Number(b.importoPrevisto)) * 100);
    results.push({
      tipo: "budget_superato",
      titolo: `Budget "${b.nome}" superato`,
      messaggio: `Il budget ${b.nome} ha raggiunto il ${perc}% (€${Number(b.consuntivo).toFixed(0)} su €${Number(b.importoPrevisto).toFixed(0)}).`,
      datiAnalizzati: { budgetId: b.id, previsto: Number(b.importoPrevisto), consuntivo: Number(b.consuntivo), percentuale: perc },
      motivazione: "Il consuntivo ha superato l'importo previsto nel budget attivo.",
      livelloConfidenza: "alto",
      linkDettaglio: `/finanza/budget`,
      azioneSuggerita: "Verificare le voci di spesa e valutare una revisione del budget.",
    });
  }

  // 2. Liquidità sotto soglia (< 5000€)
  const contiRows = (await db.execute(
    sql.raw(`SELECT COALESCE(SUM(CAST(saldo AS DECIMAL(14,2))),0) as liquidita
    FROM contiFin WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);
  const liquidita = Number((contiRows as any[])[0]?.[0]?.liquidita ?? 0);
  if (liquidita < 5000 && liquidita >= 0) {
    results.push({
      tipo: "liquidita_bassa",
      titolo: "Liquidità sotto soglia",
      messaggio: `Il saldo totale dei conti è €${liquidita.toFixed(0)}, sotto la soglia minima consigliata di €5.000.`,
      datiAnalizzati: { liquidita, soglia: 5000 },
      motivazione: "Il saldo complessivo dei conti finanziari è inferiore alla soglia di sicurezza.",
      livelloConfidenza: "alto",
      linkDettaglio: `/finanza`,
      azioneSuggerita: "Verificare i pagamenti in entrata e posticipare uscite non urgenti.",
    });
  }

  // 3. Crediti scaduti
  const creditiRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as scaduti, COALESCE(SUM(CAST(importoResiduo AS DECIMAL(14,2))),0) as totale
    FROM documentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND tipo='fattura_emessa' AND stato='scaduto'`),
  ) as any[]);
  const credScaduti = (creditiRows as any[])[0]?.[0] ?? {};
  if (Number(credScaduti.scaduti) > 0) {
    results.push({
      tipo: "crediti_scaduti",
      titolo: `${credScaduti.scaduti} fatture emesse scadute`,
      messaggio: `Hai €${Number(credScaduti.totale).toFixed(0)} in crediti scaduti da ${credScaduti.scaduti} fatture non incassate.`,
      datiAnalizzati: { numero: Number(credScaduti.scaduti), totale: Number(credScaduti.totale) },
      motivazione: "Esistono fatture emesse con data scadenza superata e importo residuo > 0.",
      livelloConfidenza: "alto",
      linkDettaglio: `/finanza`,
      azioneSuggerita: "Sollecitare i clienti per l'incasso delle fatture scadute.",
    });
  }

  // 4. Debiti imminenti (scadenza entro 7 giorni)
  const debitiRows = (await db.execute(
    sql.raw(`SELECT COUNT(*) as imminenti, COALESCE(SUM(CAST(importoResiduo AS DECIMAL(14,2))),0) as totale
    FROM documentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND tipo='fattura_ricevuta' AND stato='attivo'
    AND dataScadenza <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND dataScadenza >= CURDATE()`),
  ) as any[]);
  const debImminenti = (debitiRows as any[])[0]?.[0] ?? {};
  if (Number(debImminenti.imminenti) > 0) {
    results.push({
      tipo: "debiti_imminenti",
      titolo: `${debImminenti.imminenti} pagamenti in scadenza`,
      messaggio: `Hai €${Number(debImminenti.totale).toFixed(0)} da pagare entro 7 giorni (${debImminenti.imminenti} documenti).`,
      datiAnalizzati: { numero: Number(debImminenti.imminenti), totale: Number(debImminenti.totale) },
      motivazione: "Documenti con data scadenza nei prossimi 7 giorni.",
      livelloConfidenza: "alto",
      linkDettaglio: `/finanza`,
      azioneSuggerita: "Pianificare i pagamenti per evitare ritardi e penali.",
    });
  }

  // 5. Reintegrazione insufficiente (copertura < 50%)
  const reintRows = (await db.execute(
    sql.raw(`SELECT id, nome, percentualeCopertura, dataSostituzione
    FROM replacementPlans 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato='attivo'
    AND CAST(percentualeCopertura AS DECIMAL(5,2)) < 50
    AND dataSostituzione <= DATE_ADD(CURDATE(), INTERVAL 24 MONTH)`),
  ) as any[]);
  for (const p of ((reintRows as any[])[0] ?? [])) {
    results.push({
      tipo: "reintegrazione_insufficiente",
      titolo: `Piano "${p.nome}" in ritardo`,
      messaggio: `Il piano di sostituzione "${p.nome}" ha solo il ${Number(p.percentualeCopertura).toFixed(0)}% di copertura con scadenza ${p.dataSostituzione}.`,
      datiAnalizzati: { planId: p.id, copertura: Number(p.percentualeCopertura), scadenza: p.dataSostituzione },
      motivazione: "La copertura del fondo è inferiore al 50% con scadenza entro 24 mesi.",
      livelloConfidenza: "alto",
      linkDettaglio: `/finanza/reintegrazione`,
      azioneSuggerita: "Aumentare l'accantonamento mensile o rivedere il piano.",
    });
  }

  // 6. Costi in crescita (mese corrente vs precedente > +20%)
  const costiRows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN data >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as meseCorrente,
      COALESCE(SUM(CASE WHEN data >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND data < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as mesePrecedente
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND tipo='uscita'
    AND data >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`),
  ) as any[]);
  const costi = (costiRows as any[])[0]?.[0] ?? {};
  const meseCorrUscite = Number(costi.meseCorrente ?? 0);
  const mesePrecUscite = Number(costi.mesePrecedente ?? 0);
  if (mesePrecUscite > 0 && meseCorrUscite > mesePrecUscite * 1.2) {
    const crescita = Math.round(((meseCorrUscite - mesePrecUscite) / mesePrecUscite) * 100);
    results.push({
      tipo: "costi_crescita",
      titolo: `Costi in crescita (+${crescita}%)`,
      messaggio: `Le uscite del mese corrente (€${meseCorrUscite.toFixed(0)}) sono cresciute del ${crescita}% rispetto al mese precedente (€${mesePrecUscite.toFixed(0)}).`,
      datiAnalizzati: { meseCorrente: meseCorrUscite, mesePrecedente: mesePrecUscite, crescita },
      motivazione: "Confronto mese su mese delle uscite totali con variazione > 20%.",
      livelloConfidenza: "medio",
      linkDettaglio: `/finanza/analisi`,
      azioneSuggerita: "Controllare le categorie di spesa con maggiore incremento.",
    });
  }

  return results;
}

// ─── SALVATAGGIO E LETTURA ──────────────────────────────────────────────────────

async function saveInsights(companyId: string, insightsList: InsightData[]) {
  const db = await getDb();
  if (!db) return;
  for (const ins of insightsList) {
    const id = crypto.randomUUID();
    await db.insert(insights).values({
      id,
      companyId,
      tipo: ins.tipo,
      titolo: ins.titolo,
      messaggio: ins.messaggio,
      datiAnalizzati: JSON.stringify(ins.datiAnalizzati),
      motivazione: ins.motivazione,
      livelloConfidenza: ins.livelloConfidenza,
      linkDettaglio: ins.linkDettaglio,
      dataGenerazione: new Date().toISOString().split("T")[0],
      letto: false,
      azioneSuggerita: ins.azioneSuggerita,
    } as any);
  }
}

async function listInsights(companyId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(insights)
    .where(eq(insights.companyId, companyId))
    .orderBy(desc(insights.dataGenerazione))
    .limit(limit);
  return rows.map(r => ({
    ...r,
    datiAnalizzati: typeof r.datiAnalizzati === "string" ? JSON.parse(r.datiAnalizzati) : r.datiAnalizzati,
  }));
}

async function markRead(companyId: string, id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(insights).set({ letto: true } as any)
    .where(and(eq(insights.id, id), eq(insights.companyId, companyId)));
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────────

export const insightsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return listInsights(actor.companyId, input?.limit ?? 20);
    }),

  generate: protectedProcedure
    .mutation(async ({ ctx }) => {
      const actor = await getActor(ctx);
      const newInsights = await generateDeterministicInsights(actor.companyId);
      if (newInsights.length > 0) {
        await saveInsights(actor.companyId, newInsights);
      }
      return { generated: newInsights.length, insights: newInsights };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return markRead(actor.companyId, input.id);
    }),
});
