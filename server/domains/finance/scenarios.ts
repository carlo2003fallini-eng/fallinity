import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { scenariV2 } from "../../../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getActor } from "../_core";

// ─── VALIDATORS ─────────────────────────────────────────────────────────────────

const scenarioVariablesSchema = z.object({
  // Entrate
  variazioneEntrate: z.number().default(0), // % variazione rispetto a storico
  entrateExtra: z.number().default(0), // importo aggiuntivo
  // Uscite
  variazioneUscite: z.number().default(0), // % variazione
  usciteExtra: z.number().default(0),
  // Specifiche
  prezzoLatte: z.number().optional(), // €/litro
  litriGiorno: z.number().optional(),
  prezzoGrano: z.number().optional(), // €/quintale
  ettariColtivati: z.number().optional(),
  costoCarburante: z.number().optional(), // €/litro
  costoMangime: z.number().optional(), // €/quintale
  investimentiPianificati: z.number().default(0),
  contributiAttesi: z.number().default(0),
  // Reintegrazione
  accantonamentoMensile: z.number().optional(),
});

export const createScenarioInput = z.object({
  nome: z.string().min(1).max(255),
  tipo: z.enum(["prudente", "realistico", "ottimistico", "personalizzato"]),
  variabili: scenarioVariablesSchema,
  note: z.string().optional(),
});

export const updateScenarioInput = z.object({
  id: z.string(),
  nome: z.string().min(1).max(255).optional(),
  tipo: z.enum(["prudente", "realistico", "ottimistico", "personalizzato"]).optional(),
  variabili: scenarioVariablesSchema.optional(),
  note: z.string().optional(),
});

export const listScenariosInput = z.object({
  tipo: z.string().optional(),
}).optional();

// ─── SERVICE ────────────────────────────────────────────────────────────────────

async function getBaselineData(companyId: string) {
  const db = await getDb();
  if (!db) return { entrateAnnue: 0, usciteAnnue: 0, creditiAttivi: 0, debitiAttivi: 0, capitaleReintegrazione: 0, capitaleNecessario: 0 };
  
  // Entrate e uscite ultimi 12 mesi
  const finRows = (await db.execute(
    sql`SELECT 
      COALESCE(SUM(CASE WHEN tipo='entrata' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as entrate,
      COALESCE(SUM(CASE WHEN tipo='uscita' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as uscite
    FROM movimentiFinanziari 
    WHERE companyId=${companyId} AND deletedAt IS NULL 
    AND data >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)`,
  ) as any[]);
  const fin = (finRows as any[])[0]?.[0] ?? {};

  // Crediti e debiti attivi
  const docRows = (await db.execute(
    sql`SELECT 
      COALESCE(SUM(CASE WHEN tipo='fattura_emessa' THEN CAST(importoResiduo AS DECIMAL(14,2)) ELSE 0 END),0) as crediti,
      COALESCE(SUM(CASE WHEN tipo='fattura_ricevuta' THEN CAST(importoResiduo AS DECIMAL(14,2)) ELSE 0 END),0) as debiti
    FROM documentiFinanziari 
    WHERE companyId=${companyId} AND deletedAt IS NULL AND stato IN ('attivo','scaduto')`,
  ) as any[]);
  const doc = (docRows as any[])[0]?.[0] ?? {};

  // Reintegrazione
  const reintRows = (await db.execute(
    sql`SELECT 
      COALESCE(SUM(CAST(capitaleAccantonato AS DECIMAL(14,2))),0) as accantonato,
      COALESCE(SUM(CAST(capitaleNecessario AS DECIMAL(14,2))),0) as necessario
    FROM replacementPlans 
    WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='attivo'`,
  ) as any[]);
  const reint = (reintRows as any[])[0]?.[0] ?? {};

  return {
    entrateAnnue: Number(fin.entrate ?? 0),
    usciteAnnue: Number(fin.uscite ?? 0),
    creditiAttivi: Number(doc.crediti ?? 0),
    debitiAttivi: Number(doc.debiti ?? 0),
    capitaleReintegrazione: Number(reint.accantonato ?? 0),
    capitaleNecessario: Number(reint.necessario ?? 0),
  };
}

function calculateResults(baseline: Awaited<ReturnType<typeof getBaselineData>>, variabili: z.infer<typeof scenarioVariablesSchema>) {
  // Entrate proiettate
  const entrate = baseline.entrateAnnue * (1 + variabili.variazioneEntrate / 100) + variabili.entrateExtra;
  
  // Uscite proiettate
  const uscite = baseline.usciteAnnue * (1 + variabili.variazioneUscite / 100) + variabili.usciteExtra + variabili.investimentiPianificati;
  
  // Utile
  const utile = entrate - uscite + variabili.contributiAttesi;
  
  // Cashflow (utile - investimenti + contributi)
  const cashflow = utile;
  
  // Saldo minimo stimato (utile / 12 come proxy)
  const saldoMinimo = cashflow / 12;
  
  // Crediti/debiti (invariati nello scenario base)
  const crediti = baseline.creditiAttivi;
  const debiti = baseline.debitiAttivi;
  
  // Capacità accantonamento
  const capacitaAccantonamento = Math.max(0, cashflow * 0.1); // 10% del cashflow
  
  // Copertura Reintegrazione
  const accantonamentoAnnuo = (variabili.accantonamentoMensile ?? 0) * 12;
  const coperturaReintegrazione = baseline.capitaleNecessario > 0
    ? ((baseline.capitaleReintegrazione + accantonamentoAnnuo) / baseline.capitaleNecessario) * 100
    : 100;
  
  // Scostamento budget (non calcolabile senza budget specifico, placeholder)
  const scostamentoBudget = null;

  return {
    entrateProiettate: Math.round(entrate * 100) / 100,
    usciteProiettate: Math.round(uscite * 100) / 100,
    utile: Math.round(utile * 100) / 100,
    cashflow: Math.round(cashflow * 100) / 100,
    saldoMinimo: Math.round(saldoMinimo * 100) / 100,
    crediti: Math.round(crediti * 100) / 100,
    debiti: Math.round(debiti * 100) / 100,
    capacitaAccantonamento: Math.round(capacitaAccantonamento * 100) / 100,
    coperturaReintegrazione: Math.round(coperturaReintegrazione * 100) / 100,
    scostamentoBudget,
    margineOperativo: entrate > 0 ? Math.round((utile / entrate) * 10000) / 100 : null,
  };
}

async function createScenario(companyId: string, input: z.infer<typeof createScenarioInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  
  const baseline = await getBaselineData(companyId);
  const risultati = calculateResults(baseline, input.variabili);

  await db.insert(scenariV2).values({
    id,
    companyId,
    nome: input.nome,
    tipo: input.tipo,
    variabili: JSON.stringify(input.variabili),
    risultati: JSON.stringify(risultati),
    note: input.note,
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id, risultati };
}

async function updateScenario(companyId: string, input: z.infer<typeof updateScenarioInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.note !== undefined) updates.note = input.note;
  if (input.variabili !== undefined) {
    updates.variabili = JSON.stringify(input.variabili);
    const baseline = await getBaselineData(companyId);
    updates.risultati = JSON.stringify(calculateResults(baseline, input.variabili));
  }
  await db.update(scenariV2).set(updates)
    .where(and(eq(scenariV2.id, input.id), eq(scenariV2.companyId, companyId), isNull(scenariV2.deletedAt)));
}

async function getScenario(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scenariV2)
    .where(and(eq(scenariV2.id, id), eq(scenariV2.companyId, companyId), isNull(scenariV2.deletedAt)));
  const s = rows[0] || null;
  if (!s) return null;
  return {
    ...s,
    variabili: typeof s.variabili === "string" ? JSON.parse(s.variabili) : s.variabili,
    risultati: typeof s.risultati === "string" ? JSON.parse(s.risultati) : s.risultati,
  };
}

async function listScenarios(companyId: string, filters?: { tipo?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(scenariV2.companyId, companyId), isNull(scenariV2.deletedAt)];
  if (filters?.tipo) conditions.push(eq(scenariV2.tipo, filters.tipo as any));
  const rows = await db.select().from(scenariV2).where(and(...conditions));
  return rows.map(s => ({
    ...s,
    variabili: typeof s.variabili === "string" ? JSON.parse(s.variabili) : s.variabili,
    risultati: typeof s.risultati === "string" ? JSON.parse(s.risultati) : s.risultati,
  }));
}

async function deleteScenario(companyId: string, id: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(scenariV2).set({ deletedAt: new Date(), deletedBy: userId })
    .where(and(eq(scenariV2.id, id), eq(scenariV2.companyId, companyId), isNull(scenariV2.deletedAt)));
}

async function compareScenarios(companyId: string, ids: string[]) {
  const scenarios = await Promise.all(ids.map(id => getScenario(companyId, id)));
  return scenarios.filter(Boolean);
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────────

export const scenariosRouter = router({
  list: protectedProcedure
    .input(listScenariosInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return listScenarios(actor.companyId, input ?? undefined);
    }),

  detail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getScenario(actor.companyId, input.id);
    }),

  create: protectedProcedure
    .input(createScenarioInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return createScenario(actor.companyId, input, actor.userUuid);
    }),

  update: protectedProcedure
    .input(updateScenarioInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return updateScenario(actor.companyId, input, actor.userUuid);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return deleteScenario(actor.companyId, input.id, actor.userUuid);
    }),

  compare: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(2).max(5) }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return compareScenarios(actor.companyId, input.ids);
    }),
});
