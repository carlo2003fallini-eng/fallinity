import * as budgetRepo from "./budget.repository";
import type { CreateBudgetInput, UpdateBudgetInput, ListBudgetsInput, BudgetComparisonInput, BudgetForecastInput } from "./budget.validators";

// ─── BUDGET SERVICE ─────────────────────────────────────────────────────────────

export async function createBudget(companyId: string, input: CreateBudgetInput, userId?: string) {
  const id = await budgetRepo.createBudget(companyId, input, userId);

  // Genera distribuzione mensile
  const distribution = generateDistribution(input);
  if (distribution.length > 0) {
    await budgetRepo.saveDistribution(id, distribution, userId);
  }

  return { id };
}

export async function updateBudget(companyId: string, input: UpdateBudgetInput, userId?: string) {
  await budgetRepo.updateBudget(companyId, input, userId);

  // Se cambia importo o distribuzione, rigenera
  if (input.importoPrevisto !== undefined || input.distribuzione !== undefined || input.distribuzioneManuale) {
    const budget = await budgetRepo.getBudgetById(companyId, input.id);
    if (budget) {
      const dist = generateDistribution({
        importoPrevisto: input.importoPrevisto ?? Number(budget.importoPrevisto),
        distribuzione: input.distribuzione ?? budget.distribuzione,
        distribuzioneManuale: input.distribuzioneManuale,
        dataInizio: input.dataInizio ?? budget.dataInizio as unknown as string,
        dataFine: input.dataFine ?? budget.dataFine as unknown as string,
      } as any);
      await budgetRepo.saveDistribution(input.id, dist, userId);
    }
  }
}

export async function getBudget(companyId: string, id: string) {
  const budget = await budgetRepo.getBudgetById(companyId, id);
  if (!budget) return null;
  const distribution = await budgetRepo.getDistribution(id);
  return { ...budget, distribution };
}

export async function listBudgets(companyId: string, filters: ListBudgetsInput) {
  return budgetRepo.listBudgets(companyId, filters);
}

export async function archiveBudget(companyId: string, id: string, userId?: string) {
  return budgetRepo.archiveBudget(companyId, id, userId);
}

export async function deleteBudget(companyId: string, id: string, userId?: string) {
  return budgetRepo.deleteBudget(companyId, id, userId);
}

// ─── CONFRONTO BUDGET/CONSUNTIVO ────────────────────────────────────────────────

export async function getBudgetComparison(companyId: string, input: BudgetComparisonInput) {
  // Se c'è un budgetId specifico, carica quel budget
  if (input.budgetId) {
    const budget = await budgetRepo.getBudgetById(companyId, input.budgetId);
    if (!budget) return null;
    const distribution = await budgetRepo.getDistribution(input.budgetId);
    const consuntivo = await budgetRepo.getConsuntivoAggregato(companyId, {
      tipo: budget.tipo,
      dataInizio: input.dataInizio,
      dataFine: input.dataFine,
      categoriaId: budget.categoriaId || undefined,
      centroCostoId: budget.centroCostoId || undefined,
    });
    const consuntivoTotale = await budgetRepo.getConsuntivoTotale(companyId, {
      tipo: budget.tipo,
      dataInizio: input.dataInizio,
      dataFine: input.dataFine,
      categoriaId: budget.categoriaId || undefined,
      centroCostoId: budget.centroCostoId || undefined,
    });

    const previsto = Number(budget.importoPrevisto);
    const scostamento = consuntivoTotale - previsto;
    const percentualeUtilizzata = previsto > 0 ? (consuntivoTotale / previsto) * 100 : 0;

    return {
      budget,
      distribution,
      consuntivoMensile: consuntivo,
      consuntivoTotale,
      previsto,
      scostamento,
      percentualeUtilizzata: Math.round(percentualeUtilizzata * 100) / 100,
      stato: percentualeUtilizzata >= 100 ? "superato" : percentualeUtilizzata >= 80 ? "warning" : "ok",
    };
  }

  // Altrimenti aggregato per tipo
  const consuntivoTotale = await budgetRepo.getConsuntivoTotale(companyId, {
    tipo: input.tipo || "uscita",
    dataInizio: input.dataInizio,
    dataFine: input.dataFine,
    categoriaId: input.categoriaId,
    centroCostoId: input.centroCostoId,
  });

  // Somma tutti i budget attivi dello stesso tipo nel periodo
  const allBudgets = await budgetRepo.listBudgets(companyId, {
    stato: "attivo",
    tipo: input.tipo,
    categoriaId: input.categoriaId,
    centroCostoId: input.centroCostoId,
  });
  const previsto = allBudgets.reduce((sum, b) => sum + Number(b.importoPrevisto), 0);
  const scostamento = consuntivoTotale - previsto;
  const percentualeUtilizzata = previsto > 0 ? (consuntivoTotale / previsto) * 100 : 0;

  return {
    budgets: allBudgets,
    consuntivoTotale,
    previsto,
    scostamento,
    percentualeUtilizzata: Math.round(percentualeUtilizzata * 100) / 100,
    stato: percentualeUtilizzata >= 100 ? "superato" : percentualeUtilizzata >= 80 ? "warning" : "ok",
  };
}

// ─── PREVISIONE FINE PERIODO ────────────────────────────────────────────────────

export async function getBudgetForecast(companyId: string, input: BudgetForecastInput) {
  const budget = await budgetRepo.getBudgetById(companyId, input.budgetId);
  if (!budget) return null;

  const dataInizio = new Date(budget.dataInizio as unknown as string);
  const dataFine = new Date(budget.dataFine as unknown as string);
  const now = new Date();

  const mesiTotali = monthsBetween(dataInizio, dataFine);
  const mesiTrascorsi = monthsBetween(dataInizio, now);
  const mesiRimanenti = Math.max(0, mesiTotali - mesiTrascorsi);

  const consuntivoAttuale = await budgetRepo.getConsuntivoTotale(companyId, {
    tipo: budget.tipo,
    dataInizio: formatDate(dataInizio),
    dataFine: formatDate(now),
    categoriaId: budget.categoriaId || undefined,
    centroCostoId: budget.centroCostoId || undefined,
  });

  let previsioneFinePeriodo: number;
  let metodo = input.metodo;

  if (metodo === "lineare") {
    // Proiezione lineare: media mensile * mesi totali
    const mediaPerMese = mesiTrascorsi > 0 ? consuntivoAttuale / mesiTrascorsi : 0;
    previsioneFinePeriodo = mediaPerMese * mesiTotali;
  } else {
    // Fallback lineare per ora (storica e scadenze richiederebbero dati storici)
    const mediaPerMese = mesiTrascorsi > 0 ? consuntivoAttuale / mesiTrascorsi : 0;
    previsioneFinePeriodo = mediaPerMese * mesiTotali;
  }

  const previsto = Number(budget.importoPrevisto);
  const scostamentoPrevisto = previsioneFinePeriodo - previsto;

  return {
    budget,
    consuntivoAttuale,
    previsioneFinePeriodo: Math.round(previsioneFinePeriodo * 100) / 100,
    previsto,
    scostamentoPrevisto: Math.round(scostamentoPrevisto * 100) / 100,
    mesiTrascorsi,
    mesiRimanenti,
    mesiTotali,
    metodo,
    stato: previsioneFinePeriodo > previsto ? "supererà" : "nei limiti",
  };
}

// ─── ALERT BUDGET ───────────────────────────────────────────────────────────────

export async function getBudgetAlerts(companyId: string) {
  const activeBudgets = await budgetRepo.listBudgets(companyId, { stato: "attivo" });
  const alerts: { budgetId: string; nome: string; tipo: string; percentuale: number; stato: string }[] = [];

  for (const b of activeBudgets) {
    const consuntivo = await budgetRepo.getConsuntivoTotale(companyId, {
      tipo: b.tipo,
      dataInizio: b.dataInizio as unknown as string,
      dataFine: b.dataFine as unknown as string,
      categoriaId: b.categoriaId || undefined,
      centroCostoId: b.centroCostoId || undefined,
    });
    const previsto = Number(b.importoPrevisto);
    const pct = previsto > 0 ? (consuntivo / previsto) * 100 : 0;
    if (pct >= 80) {
      alerts.push({
        budgetId: b.id,
        nome: b.nome,
        tipo: b.tipo,
        percentuale: Math.round(pct * 100) / 100,
        stato: pct >= 100 ? "superato" : "warning",
      });
    }
  }

  return alerts;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function generateDistribution(input: { importoPrevisto: number; distribuzione: string; distribuzioneManuale?: { mese: number; importo: number }[]; dataInizio: string; dataFine: string }) {
  if (input.distribuzione === "manuale" || input.distribuzione === "personalizzata") {
    return input.distribuzioneManuale || [];
  }

  // Calcola mesi nel periodo
  const start = new Date(input.dataInizio);
  const end = new Date(input.dataFine);
  const mesi = monthsBetween(start, end);
  if (mesi <= 0) return [];

  if (input.distribuzione === "uniforme") {
    const importoPerMese = input.importoPrevisto / mesi;
    const distribution: { mese: number; importo: number }[] = [];
    for (let i = 0; i < mesi; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      distribution.push({ mese: d.getMonth() + 1, importo: Math.round(importoPerMese * 100) / 100 });
    }
    return distribution;
  }

  if (input.distribuzione === "stagionale") {
    // Distribuzione stagionale: più alto in primavera/estate per aziende agricole
    const weights = [0.05, 0.05, 0.08, 0.10, 0.12, 0.12, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05];
    const distribution: { mese: number; importo: number }[] = [];
    for (let i = 0; i < mesi; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const m = d.getMonth(); // 0-11
      distribution.push({ mese: m + 1, importo: Math.round(input.importoPrevisto * weights[m] * 100) / 100 });
    }
    return distribution;
  }

  // Default: uniforme
  const importoPerMese = input.importoPrevisto / mesi;
  return Array.from({ length: mesi }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    return { mese: d.getMonth() + 1, importo: Math.round(importoPerMese * 100) / 100 };
  });
}

function monthsBetween(start: Date, end: Date): number {
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
