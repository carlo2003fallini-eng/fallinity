import { z } from "zod";

/**
 * FINANCE — Proposals Validators
 * Input schemas per le proposte finanziarie generate dai moduli operativi.
 */

// ── Enums ──
export const STATI_PROPOSTA = [
  "da_esaminare",
  "approvata",
  "convertita",
  "collegata",
  "ignorata",
  "annullata",
  "errore",
] as const;
export type StatoProposta = (typeof STATI_PROPOSTA)[number];

export const ORIGIN_MODULES = ["fleet", "inventory", "livestock", "crop", "machinery"] as const;
export type OriginModule = (typeof ORIGIN_MODULES)[number];

export const AUTOMAZIONE_MODES = ["proposta_auto", "conferma", "bozza", "nessuna"] as const;
export type AutomazioneMode = (typeof AUTOMAZIONE_MODES)[number];

export const MANODOPERA_MODES = ["gestionale", "finanziario", "escluso"] as const;
export type ManodoperaMode = (typeof MANODOPERA_MODES)[number];

// ── Create Proposal (internal, called by domain services) ──
export const createProposalInput = z.object({
  tipo: z.enum(["entrata", "uscita"]),
  importo: z.number().positive(), // centesimi
  imponibile: z.number().min(0).optional(),
  iva: z.number().min(0).optional(),
  descrizione: z.string().min(1),
  dataOrigine: z.string(), // YYYY-MM-DD
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  soggettoId: z.string().optional(),
  originModule: z.enum(ORIGIN_MODULES),
  originEntityType: z.string().min(1),
  originEntityId: z.string().min(1),
  originEventType: z.string().min(1),
  originReference: z.string().optional(),
});
export type CreateProposalInput = z.infer<typeof createProposalInput>;

// ── List Proposals (frontend) ──
export const listProposalsInput = z.object({
  stato: z.enum(STATI_PROPOSTA).optional(),
  originModule: z.enum(ORIGIN_MODULES).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListProposalsInput = z.infer<typeof listProposalsInput>;

// ── Convert Proposal to Payment (pagato_subito) ──
export const convertToPaymentInput = z.object({
  proposalId: z.string().min(1),
  contoId: z.string().min(1),
  metodoId: z.string().optional(),
  categoriaId: z.string().optional(), // override
  centroCostoId: z.string().optional(), // override
  soggettoId: z.string().optional(), // override
  note: z.string().optional(),
});
export type ConvertToPaymentInput = z.infer<typeof convertToPaymentInput>;

// ── Convert Proposal to Document (scadenza) ──
export const convertToDocumentInput = z.object({
  proposalId: z.string().min(1),
  tipoDocumento: z.string().optional(),
  numero: z.string().optional(),
  dataScadenza: z.string().optional(),
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  soggettoId: z.string().optional(),
  note: z.string().optional(),
});
export type ConvertToDocumentInput = z.infer<typeof convertToDocumentInput>;

// ── Link Proposal to existing Document ──
export const linkProposalInput = z.object({
  proposalId: z.string().min(1),
  documentoFinanziarioId: z.string().min(1),
});
export type LinkProposalInput = z.infer<typeof linkProposalInput>;

// ── Ignore Proposal ──
export const ignoreProposalInput = z.object({
  proposalId: z.string().min(1),
  motivo: z.string().min(1),
});
export type IgnoreProposalInput = z.infer<typeof ignoreProposalInput>;

// ── Retry Proposal ──
export const retryProposalInput = z.object({
  proposalId: z.string().min(1),
});
export type RetryProposalInput = z.infer<typeof retryProposalInput>;

// ── Integration Settings ──
export const updateSettingsInput = z.object({
  modulo: z.enum(ORIGIN_MODULES),
  automazione: z.enum(AUTOMAZIONE_MODES).optional(),
  categoriaDefaultId: z.string().nullable().optional(),
  centroCostoDefaultId: z.string().nullable().optional(),
  soggettoDefaultId: z.string().nullable().optional(),
  manodoperaInternaMode: z.enum(MANODOPERA_MODES).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;

// ── Origin Status (check financial status of an entity from other modules) ──
export const originStatusInput = z.object({
  originModule: z.enum(ORIGIN_MODULES),
  originEntityId: z.string().min(1),
});
export type OriginStatusInput = z.infer<typeof originStatusInput>;
