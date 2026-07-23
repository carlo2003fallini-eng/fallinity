import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { investments } from "../../../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getActor } from "../_core";

// ─── VALIDATORS ─────────────────────────────────────────────────────────────────

export const createInvestmentInput = z.object({
  nome: z.string().min(1).max(255),
  categoria: z.enum(["macchina", "struttura", "terreno", "tecnologia", "altro"]),
  descrizione: z.string().optional(),
  importoStimato: z.number().positive(),
  dataPrevista: z.string().optional(),
  durata: z.number().int().positive().optional(), // mesi
  fornitore: z.string().optional(),
  finanziamentoPrevisto: z.number().min(0).default(0),
  anticipo: z.number().min(0).default(0),
  rate: z.number().int().min(0).default(0),
  contributi: z.number().min(0).default(0),
  valoreResiduo: z.number().min(0).default(0),
  risparmioPrevisto: z.number().min(0).default(0), // annuo
  ricavoAggiuntivo: z.number().min(0).default(0), // annuo
  costiOperativi: z.number().min(0).default(0), // annui
  centroCostoId: z.string().optional(),
  priorita: z.enum(["alta", "media", "bassa"]).default("media"),
});
export type CreateInvestmentInput = z.infer<typeof createInvestmentInput>;

export const updateInvestmentInput = z.object({
  id: z.string(),
  nome: z.string().min(1).max(255).optional(),
  categoria: z.enum(["macchina", "struttura", "terreno", "tecnologia", "altro"]).optional(),
  descrizione: z.string().optional(),
  importoStimato: z.number().positive().optional(),
  dataPrevista: z.string().optional(),
  durata: z.number().int().positive().optional(),
  fornitore: z.string().optional(),
  finanziamentoPrevisto: z.number().min(0).optional(),
  anticipo: z.number().min(0).optional(),
  rate: z.number().int().min(0).optional(),
  contributi: z.number().min(0).optional(),
  valoreResiduo: z.number().min(0).optional(),
  risparmioPrevisto: z.number().min(0).optional(),
  ricavoAggiuntivo: z.number().min(0).optional(),
  costiOperativi: z.number().min(0).optional(),
  centroCostoId: z.string().optional(),
  stato: z.enum(["idea", "da_valutare", "approvato", "pianificato", "in_corso", "completato", "annullato"]).optional(),
  priorita: z.enum(["alta", "media", "bassa"]).optional(),
});

export const listInvestmentsInput = z.object({
  stato: z.string().optional(),
  categoria: z.string().optional(),
  priorita: z.string().optional(),
}).optional();

// ─── SERVICE ────────────────────────────────────────────────────────────────────

async function createInvestment(companyId: string, input: CreateInvestmentInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(investments).values({
    id,
    companyId,
    nome: input.nome,
    categoria: input.categoria,
    descrizione: input.descrizione,
    importoStimato: String(input.importoStimato),
    dataPrevista: input.dataPrevista,
    durata: input.durata,
    fornitore: input.fornitore,
    finanziamentoPrevisto: String(input.finanziamentoPrevisto),
    anticipo: String(input.anticipo),
    rate: input.rate,
    contributi: String(input.contributi),
    valoreResiduo: String(input.valoreResiduo),
    risparmioPrevisto: String(input.risparmioPrevisto),
    ricavoAggiuntivo: String(input.ricavoAggiuntivo),
    costiOperativi: String(input.costiOperativi),
    centroCostoId: input.centroCostoId,
    stato: "idea",
    priorita: input.priorita,
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id };
}

async function updateInvestment(companyId: string, input: z.infer<typeof updateInvestmentInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.categoria !== undefined) updates.categoria = input.categoria;
  if (input.descrizione !== undefined) updates.descrizione = input.descrizione;
  if (input.importoStimato !== undefined) updates.importoStimato = String(input.importoStimato);
  if (input.dataPrevista !== undefined) updates.dataPrevista = input.dataPrevista;
  if (input.durata !== undefined) updates.durata = input.durata;
  if (input.fornitore !== undefined) updates.fornitore = input.fornitore;
  if (input.finanziamentoPrevisto !== undefined) updates.finanziamentoPrevisto = String(input.finanziamentoPrevisto);
  if (input.anticipo !== undefined) updates.anticipo = String(input.anticipo);
  if (input.rate !== undefined) updates.rate = input.rate;
  if (input.contributi !== undefined) updates.contributi = String(input.contributi);
  if (input.valoreResiduo !== undefined) updates.valoreResiduo = String(input.valoreResiduo);
  if (input.risparmioPrevisto !== undefined) updates.risparmioPrevisto = String(input.risparmioPrevisto);
  if (input.ricavoAggiuntivo !== undefined) updates.ricavoAggiuntivo = String(input.ricavoAggiuntivo);
  if (input.costiOperativi !== undefined) updates.costiOperativi = String(input.costiOperativi);
  if (input.centroCostoId !== undefined) updates.centroCostoId = input.centroCostoId;
  if (input.stato !== undefined) updates.stato = input.stato;
  if (input.priorita !== undefined) updates.priorita = input.priorita;
  await db.update(investments).set(updates)
    .where(and(eq(investments.id, input.id), eq(investments.companyId, companyId), isNull(investments.deletedAt)));
}

async function getInvestment(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(investments)
    .where(and(eq(investments.id, id), eq(investments.companyId, companyId), isNull(investments.deletedAt)));
  const inv = rows[0] || null;
  if (!inv) return null;
  // Calcola KPI gestionali
  return { ...inv, kpi: calculateKpi(inv) };
}

async function listInvestments(companyId: string, filters?: { stato?: string; categoria?: string; priorita?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(investments.companyId, companyId), isNull(investments.deletedAt)];
  if (filters?.stato) conditions.push(eq(investments.stato, filters.stato as any));
  if (filters?.categoria) conditions.push(eq(investments.categoria, filters.categoria as any));
  if (filters?.priorita) conditions.push(eq(investments.priorita, filters.priorita as any));
  return db.select().from(investments).where(and(...conditions));
}

async function deleteInvestment(companyId: string, id: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(investments).set({ deletedAt: new Date(), deletedBy: userId })
    .where(and(eq(investments.id, id), eq(investments.companyId, companyId), isNull(investments.deletedAt)));
}

async function evaluateInvestment(companyId: string, id: string) {
  const inv = await getInvestment(companyId, id);
  if (!inv) return null;
  return inv.kpi;
}

function calculateKpi(inv: any) {
  const importo = Number(inv.importoStimato);
  const risparmio = Number(inv.risparmioPrevisto);
  const ricavo = Number(inv.ricavoAggiuntivo);
  const costi = Number(inv.costiOperativi);
  const contributi = Number(inv.contributi);
  const finanziamento = Number(inv.finanziamentoPrevisto);
  const anticipo = Number(inv.anticipo);
  const valoreResiduo = Number(inv.valoreResiduo);
  const durata = inv.durata || 60; // mesi default 5 anni

  // Costo netto = importo - contributi - finanziamento
  const costoNetto = importo - contributi;
  
  // Flusso annuo netto = risparmio + ricavo - costi operativi
  const flussoAnnuoNetto = risparmio + ricavo - costi;

  // Tempo di ritorno (payback period) in mesi
  const tempoRitornoMesi = flussoAnnuoNetto > 0 ? Math.round((costoNetto / (flussoAnnuoNetto / 12)) * 100) / 100 : null;

  // ROI semplice = (flusso annuo netto * anni) / costo netto * 100
  const anni = durata / 12;
  const roiSemplice = costoNetto > 0 ? Math.round(((flussoAnnuoNetto * anni - costoNetto) / costoNetto) * 10000) / 100 : null;

  // Effetto cashflow mensile = anticipo iniziale + rata mensile finanziamento
  const rataMensile = finanziamento > 0 && inv.rate > 0 ? finanziamento / inv.rate : 0;
  const effettoCashflowMensile = -rataMensile + (flussoAnnuoNetto / 12);

  // Effetto Reintegrazione: se è una macchina, il valore residuo a fine vita
  const effettoReintegrazione = valoreResiduo;

  return {
    costoNetto: Math.round(costoNetto * 100) / 100,
    flussoAnnuoNetto: Math.round(flussoAnnuoNetto * 100) / 100,
    tempoRitornoMesi,
    roiSemplice,
    effettoCashflowMensile: Math.round(effettoCashflowMensile * 100) / 100,
    effettoReintegrazione,
    rataMensile: Math.round(rataMensile * 100) / 100,
    valutazione: tempoRitornoMesi !== null && tempoRitornoMesi <= durata ? "positivo" : "da_valutare",
  };
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────────

export const investmentsRouter = router({
  list: protectedProcedure
    .input(listInvestmentsInput)
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return listInvestments(actor.companyId, input ?? undefined);
    }),

  detail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getInvestment(actor.companyId, input.id);
    }),

  create: protectedProcedure
    .input(createInvestmentInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return createInvestment(actor.companyId, input, actor.userUuid);
    }),

  update: protectedProcedure
    .input(updateInvestmentInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return updateInvestment(actor.companyId, input, actor.userUuid);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return deleteInvestment(actor.companyId, input.id, actor.userUuid);
    }),

  evaluate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return evaluateInvestment(actor.companyId, input.id);
    }),
});
