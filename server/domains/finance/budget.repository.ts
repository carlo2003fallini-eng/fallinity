import { getDb } from "../../db";
import { budgets, budgetDistributions } from "../../../drizzle/schema";
import { eq, and, isNull, sql, like } from "drizzle-orm";
import type { CreateBudgetInput, UpdateBudgetInput, ListBudgetsInput } from "./budget.validators";

// ─── BUDGET REPOSITORY ──────────────────────────────────────────────────────────

export async function createBudget(companyId: string, input: CreateBudgetInput, userId?: string) {
  const id = crypto.randomUUID();
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(budgets).values({
    id,
    companyId,
    nome: input.nome,
    periodo: input.periodo,
    dataInizio: input.dataInizio,
    dataFine: input.dataFine,
    tipo: input.tipo,
    categoriaId: input.categoriaId,
    sottocategoriaId: input.sottocategoriaId,
    centroCostoId: input.centroCostoId,
    settore: input.settore,
    modulo: input.modulo,
    importoPrevisto: String(input.importoPrevisto),
    distribuzione: input.distribuzione,
    note: input.note,
    responsabile: input.responsabile,
    stato: input.stato,
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return id;
}

export async function updateBudget(companyId: string, input: UpdateBudgetInput, userId?: string) {
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.periodo !== undefined) updates.periodo = input.periodo;
  if (input.dataInizio !== undefined) updates.dataInizio = input.dataInizio;
  if (input.dataFine !== undefined) updates.dataFine = input.dataFine;
  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.categoriaId !== undefined) updates.categoriaId = input.categoriaId;
  if (input.sottocategoriaId !== undefined) updates.sottocategoriaId = input.sottocategoriaId;
  if (input.centroCostoId !== undefined) updates.centroCostoId = input.centroCostoId;
  if (input.settore !== undefined) updates.settore = input.settore;
  if (input.modulo !== undefined) updates.modulo = input.modulo;
  if (input.importoPrevisto !== undefined) updates.importoPrevisto = String(input.importoPrevisto);
  if (input.distribuzione !== undefined) updates.distribuzione = input.distribuzione;
  if (input.note !== undefined) updates.note = input.note;
  if (input.responsabile !== undefined) updates.responsabile = input.responsabile;
  if (input.stato !== undefined) updates.stato = input.stato;

  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(budgets)
    .set(updates)
    .where(and(eq(budgets.id, input.id), eq(budgets.companyId, companyId), isNull(budgets.deletedAt)));
}

export async function getBudgetById(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId), isNull(budgets.deletedAt)));
  return rows[0] || null;
}

export async function listBudgets(companyId: string, filters: ListBudgetsInput) {
  const conditions = [eq(budgets.companyId, companyId), isNull(budgets.deletedAt)];
  if (filters.stato) conditions.push(eq(budgets.stato, filters.stato));
  if (filters.tipo) conditions.push(eq(budgets.tipo, filters.tipo));
  if (filters.categoriaId) conditions.push(eq(budgets.categoriaId, filters.categoriaId));
  if (filters.centroCostoId) conditions.push(eq(budgets.centroCostoId, filters.centroCostoId));
  if (filters.modulo) conditions.push(eq(budgets.modulo, filters.modulo));
  if (filters.anno) {
    conditions.push(sql`${budgets.dataFine} >= ${`${filters.anno}-01-01`}`);
    conditions.push(sql`${budgets.dataInizio} <= ${`${filters.anno}-12-31`}`);
  }
  if (filters.search) {
    conditions.push(like(budgets.nome, `%${filters.search}%`));
  }

  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgets).where(and(...conditions)).orderBy(budgets.createdAt);
}

export async function archiveBudget(companyId: string, id: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(budgets)
    .set({ stato: "archiviato", updatedBy: userId })
    .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId), isNull(budgets.deletedAt)));
}

export async function deleteBudget(companyId: string, id: string, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(budgets)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId), isNull(budgets.deletedAt)));
}

// ─── DISTRIBUZIONE ──────────────────────────────────────────────────────────────

export async function saveDistribution(budgetId: string, distribution: { mese: number; importo: number }[], userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Cancella distribuzione precedente
  await db.delete(budgetDistributions).where(eq(budgetDistributions.budgetId, budgetId));
  // Inserisci nuova
  if (distribution.length > 0) {
    await db.insert(budgetDistributions).values(
      distribution.map(d => ({
        id: crypto.randomUUID(),
        budgetId,
        mese: d.mese,
        importo: String(d.importo),
        createdBy: userId,
        updatedBy: userId,
      }))
    );
  }
}

export async function getDistribution(budgetId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgetDistributions)
    .where(eq(budgetDistributions.budgetId, budgetId))
    .orderBy(budgetDistributions.mese);
}

// ─── CONSUNTIVO AGGREGATO ───────────────────────────────────────────────────────

export async function getConsuntivoAggregato(companyId: string, opts: {
  tipo: "entrata" | "uscita";
  dataInizio: string;
  dataFine: string;
  categoriaId?: string;
  centroCostoId?: string;
}) {
  const db = await getDb();
  if (!db) return [] as { totale: string; mese: number }[];
  const rows = (await db.execute(
    sql`SELECT COALESCE(SUM(importo), 0) as totale, MONTH(data) as mese 
        FROM movimentiCassa 
        WHERE companyId=${companyId} AND deletedAt IS NULL 
        AND data >= ${opts.dataInizio} AND data <= ${opts.dataFine}
        AND tipo = ${opts.tipo}
        ${opts.categoriaId ? sql`AND categoriaId = ${opts.categoriaId}` : sql``}
        ${opts.centroCostoId ? sql`AND centroCostoId = ${opts.centroCostoId}` : sql``}
        GROUP BY MONTH(data) ORDER BY mese`,
  ) as any[]);
  return (rows as any[])[0] as { totale: string; mese: number }[];
}

export async function getConsuntivoTotale(companyId: string, opts: {
  tipo: "entrata" | "uscita";
  dataInizio: string;
  dataFine: string;
  categoriaId?: string;
  centroCostoId?: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const rows = (await db.execute(
    sql`SELECT COALESCE(SUM(importo), 0) as totale 
        FROM movimentiCassa 
        WHERE companyId=${companyId} AND deletedAt IS NULL 
        AND data >= ${opts.dataInizio} AND data <= ${opts.dataFine}
        AND tipo = ${opts.tipo}
        ${opts.categoriaId ? sql`AND categoriaId = ${opts.categoriaId}` : sql``}
        ${opts.centroCostoId ? sql`AND centroCostoId = ${opts.centroCostoId}` : sql``}`,
  ) as any[]);
  const r = (rows as any[])[0]?.[0] ?? {};
  return Number(r.totale ?? 0);
}
