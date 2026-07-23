import { getDb } from "../../db";
import { replacementPlans, replacementAccounts, replacementAllocations, replacementValueHistory, replacementTransactions } from "../../../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import type { CreateReplacementPlanInput, UpdateReplacementPlanInput, CreateReplacementAccountInput, UpdateReplacementAccountInput, CreateAllocationInput } from "./replacement.validators";

// ─── PIANI ──────────────────────────────────────────────────────────────────────

export async function createPlan(companyId: string, input: CreateReplacementPlanInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  
  // Calcoli automatici
  const capitaleNecessario = input.valoreSostituzione - input.valoreResiduo;
  const dataSost = new Date(input.dataSostituzione);
  const now = new Date();
  const mesiRimanenti = Math.max(1, (dataSost.getFullYear() - now.getFullYear()) * 12 + (dataSost.getMonth() - now.getMonth()));
  const accantonamentoConsigliato = Math.round((capitaleNecessario / mesiRimanenti) * 100) / 100;

  await db.insert(replacementPlans).values({
    id,
    companyId,
    macchinaId: input.macchinaId,
    nome: input.nome,
    valoreSostituzione: String(input.valoreSostituzione),
    dataSostituzione: input.dataSostituzione,
    vitaUtile: input.vitaUtile,
    valoreResiduo: String(input.valoreResiduo),
    capitaleNecessario: String(capitaleNecessario),
    capitaleAccantonato: "0",
    accantonamentoMensileConsigliato: String(accantonamentoConsigliato),
    accantonamentoMensileEffettivo: String(input.accantonamentoMensileEffettivo ?? accantonamentoConsigliato),
    rendimento: String(input.rendimento ?? 0),
    interessiMaturati: "0",
    percentualeCopertura: "0",
    stato: "attivo",
    priorita: input.priorita,
    note: input.note,
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id };
}

export async function updatePlan(companyId: string, input: UpdateReplacementPlanInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.valoreSostituzione !== undefined) updates.valoreSostituzione = String(input.valoreSostituzione);
  if (input.dataSostituzione !== undefined) updates.dataSostituzione = input.dataSostituzione;
  if (input.vitaUtile !== undefined) updates.vitaUtile = input.vitaUtile;
  if (input.valoreResiduo !== undefined) updates.valoreResiduo = String(input.valoreResiduo);
  if (input.accantonamentoMensileEffettivo !== undefined) updates.accantonamentoMensileEffettivo = String(input.accantonamentoMensileEffettivo);
  if (input.rendimento !== undefined) updates.rendimento = String(input.rendimento);
  if (input.priorita !== undefined) updates.priorita = input.priorita;
  if (input.stato !== undefined) updates.stato = input.stato;
  if (input.note !== undefined) updates.note = input.note;

  await db.update(replacementPlans)
    .set(updates)
    .where(and(eq(replacementPlans.id, input.id), eq(replacementPlans.companyId, companyId), isNull(replacementPlans.deletedAt)));
}

export async function getPlanById(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(replacementPlans)
    .where(and(eq(replacementPlans.id, id), eq(replacementPlans.companyId, companyId), isNull(replacementPlans.deletedAt)));
  return rows[0] || null;
}

export async function listPlans(companyId: string, filters?: { stato?: string; macchinaId?: string; priorita?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(replacementPlans.companyId, companyId), isNull(replacementPlans.deletedAt)];
  if (filters?.stato) conditions.push(eq(replacementPlans.stato, filters.stato as any));
  if (filters?.macchinaId) conditions.push(eq(replacementPlans.macchinaId, filters.macchinaId));
  if (filters?.priorita) conditions.push(eq(replacementPlans.priorita, filters.priorita as any));
  return db.select().from(replacementPlans).where(and(...conditions));
}

export async function deletePlan(companyId: string, id: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(replacementPlans)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(and(eq(replacementPlans.id, id), eq(replacementPlans.companyId, companyId), isNull(replacementPlans.deletedAt)));
}

export async function updatePlanCapitale(planId: string, capitaleAccantonato: number, interessiMaturati: number, percentualeCopertura: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(replacementPlans)
    .set({
      capitaleAccantonato: String(capitaleAccantonato),
      interessiMaturati: String(interessiMaturati),
      percentualeCopertura: String(percentualeCopertura),
    } as any)
    .where(eq(replacementPlans.id, planId));
}

// ─── CONTI DEPOSITO ─────────────────────────────────────────────────────────────

export async function createAccount(companyId: string, input: CreateReplacementAccountInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(replacementAccounts).values({
    id,
    companyId,
    nome: `Conto deposito`,
    contoFinanziarioId: input.contoFinanziarioId,
    tassoInteresse: String(input.tassoInteresse),
    periodicita: input.periodicita,
    interesseLordo: "0",
    interesseNetto: "0",
    capitaleVersato: "0",
    capitaleVincolato: "0",
    note: input.note,
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id };
}

export async function updateAccount(companyId: string, input: UpdateReplacementAccountInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.tassoInteresse !== undefined) updates.tassoInteresse = String(input.tassoInteresse);
  if (input.periodicita !== undefined) updates.periodicita = input.periodicita;
  if (input.note !== undefined) updates.note = input.note;
  await db.update(replacementAccounts)
    .set(updates)
    .where(and(eq(replacementAccounts.id, input.id), eq(replacementAccounts.companyId, companyId)));
}

export async function getAccountById(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(replacementAccounts)
    .where(and(eq(replacementAccounts.id, id), eq(replacementAccounts.companyId, companyId)));
  return rows[0] || null;
}

export async function listAccounts(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replacementAccounts).where(eq(replacementAccounts.companyId, companyId));
}

// ─── ALLOCAZIONI ────────────────────────────────────────────────────────────────

export async function createAllocation(input: CreateAllocationInput, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(replacementAllocations).values({
    id,
    replacementAccountId: input.replacementAccountId,
    replacementPlanId: input.replacementPlanId,
    importoAllocato: String(input.importoAllocato),
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id };
}

export async function listAllocations(accountId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replacementAllocations)
    .where(eq(replacementAllocations.replacementAccountId, accountId));
}

export async function listAllocationsByPlan(planId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replacementAllocations)
    .where(eq(replacementAllocations.replacementPlanId, planId));
}

export async function updateAllocation(id: string, importo: number, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(replacementAllocations)
    .set({ importoAllocato: String(importo), updatedBy: userId } as any)
    .where(eq(replacementAllocations.id, id));
}

export async function deleteAllocation(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(replacementAllocations).where(eq(replacementAllocations.id, id));
}

// ─── STORICO VALORI ─────────────────────────────────────────────────────────────

export async function addValueHistory(planId: string, valorePrecedente: number, nuovoValore: number, operatore: string, motivazione: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(replacementValueHistory).values({
    id,
    replacementPlanId: planId,
    valorePrecedente: String(valorePrecedente),
    nuovoValore: String(nuovoValore),
    data: new Date().toISOString().split("T")[0],
    operatore,
    motivazione,
  } as any);
}

export async function getValueHistory(planId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replacementValueHistory)
    .where(eq(replacementValueHistory.replacementPlanId, planId));
}

// ─── TRANSAZIONI REINTEGRAZIONE ─────────────────────────────────────────────────

export async function addTransaction(planId: string, accountId: string | null, tipo: string, importo: number, note?: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(replacementTransactions).values({
    id,
    replacementPlanId: planId,
    replacementAccountId: accountId,
    tipo,
    importo: String(importo),
    data: new Date().toISOString().split("T")[0],
    note,
    createdBy: userId,
  } as any);
  return { id };
}

export async function listTransactions(planId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(replacementTransactions)
    .where(eq(replacementTransactions.replacementPlanId, planId));
}

// ─── AGGREGATI ──────────────────────────────────────────────────────────────────

export async function getDashboardAggregates(companyId: string) {
  const db = await getDb();
  if (!db) return { totalePlans: 0, capitaleAccantonato: 0, capitaleNecessario: 0, interessiTotali: 0, coperturaMedia: 0 };
  const rows = (await db.execute(
    sql`SELECT 
      COUNT(*) as totalePlans,
      COALESCE(SUM(CAST(capitaleAccantonato AS DECIMAL(14,2))),0) as capitaleAccantonato,
      COALESCE(SUM(CAST(capitaleNecessario AS DECIMAL(14,2))),0) as capitaleNecessario,
      COALESCE(SUM(CAST(interessiMaturati AS DECIMAL(14,2))),0) as interessiTotali,
      COALESCE(AVG(CAST(percentualeCopertura AS DECIMAL(5,2))),0) as coperturaMedia
    FROM replacementPlans 
    WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='attivo'`,
  ) as any[]);
  const r = (rows as any[])[0]?.[0] ?? {};
  return {
    totalePlans: Number(r.totalePlans ?? 0),
    capitaleAccantonato: Number(r.capitaleAccantonato ?? 0),
    capitaleNecessario: Number(r.capitaleNecessario ?? 0),
    interessiTotali: Number(r.interessiTotali ?? 0),
    coperturaMedia: Number(r.coperturaMedia ?? 0),
  };
}
