import { z } from "zod";

// ─── BUDGET VALIDATORS ─────────────────────────────────────────────────────────

export const createBudgetInput = z.object({
  nome: z.string().min(1).max(255),
  periodo: z.enum(["annuale", "mensile", "trimestrale", "personalizzato"]),
  dataInizio: z.string(), // YYYY-MM-DD
  dataFine: z.string(),
  tipo: z.enum(["entrata", "uscita"]),
  categoriaId: z.string().optional(),
  sottocategoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  settore: z.string().optional(),
  modulo: z.string().optional(),
  importoPrevisto: z.number().positive(),
  distribuzione: z.enum(["uniforme", "manuale", "stagionale", "storica", "personalizzata"]).default("uniforme"),
  distribuzioneManuale: z.array(z.object({ mese: z.number().min(1).max(12), importo: z.number() })).optional(),
  note: z.string().optional(),
  responsabile: z.string().optional(),
  stato: z.enum(["bozza", "attivo", "completato", "archiviato"]).default("bozza"),
});
export type CreateBudgetInput = z.infer<typeof createBudgetInput>;

export const updateBudgetInput = z.object({
  id: z.string(),
  nome: z.string().min(1).max(255).optional(),
  periodo: z.enum(["annuale", "mensile", "trimestrale", "personalizzato"]).optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  tipo: z.enum(["entrata", "uscita"]).optional(),
  categoriaId: z.string().nullable().optional(),
  sottocategoriaId: z.string().nullable().optional(),
  centroCostoId: z.string().nullable().optional(),
  settore: z.string().nullable().optional(),
  modulo: z.string().nullable().optional(),
  importoPrevisto: z.number().positive().optional(),
  distribuzione: z.enum(["uniforme", "manuale", "stagionale", "storica", "personalizzata"]).optional(),
  distribuzioneManuale: z.array(z.object({ mese: z.number().min(1).max(12), importo: z.number() })).optional(),
  note: z.string().nullable().optional(),
  responsabile: z.string().nullable().optional(),
  stato: z.enum(["bozza", "attivo", "completato", "archiviato"]).optional(),
});
export type UpdateBudgetInput = z.infer<typeof updateBudgetInput>;

export const listBudgetsInput = z.object({
  stato: z.enum(["bozza", "attivo", "completato", "archiviato"]).optional(),
  tipo: z.enum(["entrata", "uscita"]).optional(),
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  modulo: z.string().optional(),
  anno: z.number().optional(),
  search: z.string().optional(),
});
export type ListBudgetsInput = z.infer<typeof listBudgetsInput>;

export const budgetComparisonInput = z.object({
  budgetId: z.string().optional(),
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  tipo: z.enum(["entrata", "uscita"]).optional(),
  dataInizio: z.string(),
  dataFine: z.string(),
});
export type BudgetComparisonInput = z.infer<typeof budgetComparisonInput>;

export const budgetForecastInput = z.object({
  budgetId: z.string(),
  metodo: z.enum(["lineare", "storica", "scadenze"]).default("lineare"),
});
export type BudgetForecastInput = z.infer<typeof budgetForecastInput>;
