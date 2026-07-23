import { z } from "zod";

// ─── PIANI DI SOSTITUZIONE ─────────────────────────────────────────────────────

export const createReplacementPlanInput = z.object({
  macchinaId: z.string().optional(),
  nome: z.string().min(1).max(255),
  valoreSostituzione: z.number().positive(),
  dataSostituzione: z.string(), // YYYY-MM-DD
  vitaUtile: z.number().int().positive().optional(), // anni
  valoreResiduo: z.number().min(0).default(0),
  accantonamentoMensileEffettivo: z.number().min(0).optional(),
  rendimento: z.number().min(0).max(100).default(0), // % annuo
  priorita: z.enum(["alta", "media", "bassa"]).default("media"),
  note: z.string().optional(),
});
export type CreateReplacementPlanInput = z.infer<typeof createReplacementPlanInput>;

export const updateReplacementPlanInput = z.object({
  id: z.string(),
  nome: z.string().min(1).max(255).optional(),
  valoreSostituzione: z.number().positive().optional(),
  dataSostituzione: z.string().optional(),
  vitaUtile: z.number().int().positive().optional(),
  valoreResiduo: z.number().min(0).optional(),
  accantonamentoMensileEffettivo: z.number().min(0).optional(),
  rendimento: z.number().min(0).max(100).optional(),
  priorita: z.enum(["alta", "media", "bassa"]).optional(),
  stato: z.enum(["attivo", "completato", "sospeso"]).optional(),
  note: z.string().optional(),
});
export type UpdateReplacementPlanInput = z.infer<typeof updateReplacementPlanInput>;

export const listReplacementPlansInput = z.object({
  stato: z.enum(["attivo", "completato", "sospeso"]).optional(),
  macchinaId: z.string().optional(),
  priorita: z.enum(["alta", "media", "bassa"]).optional(),
}).optional();
export type ListReplacementPlansInput = z.infer<typeof listReplacementPlansInput>;

export const updateValoreSostituzioneInput = z.object({
  planId: z.string(),
  nuovoValore: z.number().positive(),
  motivazione: z.string().min(1),
});
export type UpdateValoreSostituzioneInput = z.infer<typeof updateValoreSostituzioneInput>;

// ─── CONTI DEPOSITO ─────────────────────────────────────────────────────────────

export const createReplacementAccountInput = z.object({
  contoFinanziarioId: z.string().optional(),
  tassoInteresse: z.number().min(0).max(100).default(0),
  periodicita: z.enum(["mensile", "trimestrale", "semestrale", "annuale"]).default("mensile"),
  note: z.string().optional(),
});
export type CreateReplacementAccountInput = z.infer<typeof createReplacementAccountInput>;

export const updateReplacementAccountInput = z.object({
  id: z.string(),
  tassoInteresse: z.number().min(0).max(100).optional(),
  periodicita: z.enum(["mensile", "trimestrale", "semestrale", "annuale"]).optional(),
  note: z.string().optional(),
});
export type UpdateReplacementAccountInput = z.infer<typeof updateReplacementAccountInput>;

// ─── ALLOCAZIONI ────────────────────────────────────────────────────────────────

export const createAllocationInput = z.object({
  replacementAccountId: z.string(),
  replacementPlanId: z.string(),
  importoAllocato: z.number().positive(),
});
export type CreateAllocationInput = z.infer<typeof createAllocationInput>;

export const updateAllocationInput = z.object({
  id: z.string(),
  importoAllocato: z.number().positive(),
});
export type UpdateAllocationInput = z.infer<typeof updateAllocationInput>;

// ─── ACCANTONAMENTO ─────────────────────────────────────────────────────────────

export const accantonamentoInput = z.object({
  planId: z.string(),
  importo: z.number().positive(),
  tipo: z.enum(["gestionale", "trasferimento"]), // gestionale = solo contabile, trasferimento = muove soldi al conto deposito
  note: z.string().optional(),
});
export type AccantonamentoInput = z.infer<typeof accantonamentoInput>;
