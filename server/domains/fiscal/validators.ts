import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────────
// FISCAL DOMAIN — Validators
// Forma giuridica, qualifiche agricole, regime IVA, posizione IVA, periodi
// ──────────────────────────────────────────────────────────────────────────────

// Forme giuridiche ammesse
export const legalForms = [
  "ditta_individuale",
  "societa_semplice",
  "societa_semplice_agricola",
  "srl",
  "srl_agricola",
  "srls",
  "snc",
  "sas",
  "cooperativa",
  "cooperativa_agricola",
  "consorzio",
  "consorzio_agrario",
  "impresa_familiare",
  "altro",
] as const;

// Qualifiche agricole
export const qualificationTypes = [
  "IAP",
  "CD",
  "coltivatore_part_time",
  "nessuna",
  "altra",
] as const;

// Regimi IVA
export const vatRegimes = [
  "speciale_agricoltura",
  "ordinario",
  "forfettario",
  "esonero",
  "altro",
] as const;

// Periodicità liquidazione
export const settlementFrequencies = [
  "mensile",
  "trimestrale",
  "annuale",
] as const;

// Tipo posizione IVA iniziale
export const positionTypes = [
  "credito",
  "debito",
  "zero",
  "da_definire",
] as const;

// Tipi movimenti IVA
export const vatEntryTypes = [
  "vendita",
  "acquisto",
  "nota_credito_emessa",
  "nota_credito_ricevuta",
  "rettifica",
  "versamento",
  "compensazione",
  "rimborso",
  "acconto",
] as const;

// Direzioni
export const vatDirections = ["dare", "avere"] as const;

// Stati periodo IVA
export const vatPeriodStatuses = ["aperto", "in_verifica", "chiuso", "riaperto"] as const;

// ─── Legal Profile ───────────────────────────────────────────────────────────

export const createLegalProfileInput = z.object({
  legalForm: z.enum(legalForms),
  isAgriculturalCompany: z.boolean().default(false),
  specifyOther: z.string().optional(),
  effectiveFrom: z.string(), // YYYY-MM-DD
  effectiveTo: z.string().optional(),
});
export type CreateLegalProfileInput = z.infer<typeof createLegalProfileInput>;

export const updateLegalProfileInput = z.object({
  id: z.string(),
  legalForm: z.enum(legalForms).optional(),
  isAgriculturalCompany: z.boolean().optional(),
  specifyOther: z.string().optional(),
  effectiveTo: z.string().optional(),
});
export type UpdateLegalProfileInput = z.infer<typeof updateLegalProfileInput>;

// ─── Agricultural Qualifications ─────────────────────────────────────────────

export const createQualificationInput = z.object({
  qualificationType: z.enum(qualificationTypes),
  personId: z.string().optional(),
  subjectRole: z.string().optional(),
  subjectName: z.string().optional(),
  validFrom: z.string(),
  validTo: z.string().optional(),
  authority: z.string().optional(),
  practiceRef: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateQualificationInput = z.infer<typeof createQualificationInput>;

export const updateQualificationInput = z.object({
  id: z.string(),
  qualificationType: z.enum(qualificationTypes).optional(),
  subjectRole: z.string().optional(),
  subjectName: z.string().optional(),
  validTo: z.string().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});
export type UpdateQualificationInput = z.infer<typeof updateQualificationInput>;

// ─── Tax Profile ─────────────────────────────────────────────────────────────

export const createTaxProfileInput = z.object({
  vatRegime: z.enum(vatRegimes),
  settlementFrequency: z.enum(settlementFrequencies),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
});
export type CreateTaxProfileInput = z.infer<typeof createTaxProfileInput>;

export const updateTaxProfileInput = z.object({
  id: z.string(),
  vatRegime: z.enum(vatRegimes).optional(),
  settlementFrequency: z.enum(settlementFrequencies).optional(),
  effectiveTo: z.string().optional(),
  verified: z.boolean().optional(),
  verifiedBy: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateTaxProfileInput = z.infer<typeof updateTaxProfileInput>;

// ─── VAT Opening Balance ─────────────────────────────────────────────────────

export const createOpeningBalanceInput = z.object({
  positionType: z.enum(positionTypes),
  amount: z.number(),
  referenceDate: z.string(),
  referencePeriod: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  consultant: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateOpeningBalanceInput = z.infer<typeof createOpeningBalanceInput>;

// ─── VAT Configuration ───────────────────────────────────────────────────────

export const createVatConfigInput = z.object({
  regime: z.enum(vatRegimes),
  productCategory: z.string().min(1),
  vatRate: z.number().min(0).max(100),
  compensationRate: z.number().min(0).max(100),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  excludedOps: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  documentUrl: z.string().optional(),
});
export type CreateVatConfigInput = z.infer<typeof createVatConfigInput>;

export const updateVatConfigInput = z.object({
  id: z.string(),
  vatRate: z.number().min(0).max(100).optional(),
  compensationRate: z.number().min(0).max(100).optional(),
  effectiveTo: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateVatConfigInput = z.infer<typeof updateVatConfigInput>;

// ─── VAT Ledger Entry ────────────────────────────────────────────────────────

export const createVatEntryInput = z.object({
  documentId: z.string().optional(),
  type: z.enum(vatEntryTypes),
  direction: z.enum(vatDirections),
  amount: z.number(),
  referenceDate: z.string(),
  referencePeriod: z.string(),
  taxProfileVersionId: z.string().optional(),
  regime: z.string().optional(),
  description: z.string().optional(),
  documentUrl: z.string().optional(),
});
export type CreateVatEntryInput = z.infer<typeof createVatEntryInput>;

// ─── VAT Period Actions ──────────────────────────────────────────────────────

export const vatPeriodActionInput = z.object({
  period: z.string(),
  year: z.number(),
  action: z.enum(["verify", "close", "reopen"]),
  reason: z.string().optional(), // obbligatorio per reopen
});
export type VatPeriodActionInput = z.infer<typeof vatPeriodActionInput>;

// ─── Wizard Creazione Azienda ────────────────────────────────────────────────

export const createCompanyWizardInput = z.object({
  // Step 1: Dati base
  name: z.string().min(1),
  partitaIva: z.string().optional(),
  codiceFiscale: z.string().optional(),
  indirizzo: z.string().optional(),
  citta: z.string().optional(),
  provincia: z.string().optional(),
  cap: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  settore: z.string().optional(),
  ettari: z.number().optional(),
  // Step 2: Forma giuridica
  legalForm: z.enum(legalForms),
  isAgriculturalCompany: z.boolean().default(false),
  specifyOther: z.string().optional(),
  // Step 3: Qualifiche agricole
  qualifications: z.array(z.object({
    qualificationType: z.enum(qualificationTypes),
    subjectRole: z.string().optional(),
    subjectName: z.string().optional(),
    validFrom: z.string(),
    validTo: z.string().optional(),
    authority: z.string().optional(),
    practiceRef: z.string().optional(),
  })).default([]),
  // Step 4: Regime IVA
  vatRegime: z.enum(vatRegimes),
  settlementFrequency: z.enum(settlementFrequencies),
  vatEffectiveFrom: z.string(),
  // Step 5: Posizione IVA iniziale
  vatPositionType: z.enum(positionTypes),
  vatAmount: z.number().default(0),
  vatReferenceDate: z.string(),
  vatReferencePeriod: z.string().optional(),
  vatSource: z.string().optional(),
  vatConsultant: z.string().optional(),
  vatNotes: z.string().optional(),
});
export type CreateCompanyWizardInput = z.infer<typeof createCompanyWizardInput>;

// ─── Query Filters ───────────────────────────────────────────────────────────

export const vatEntriesFilterInput = z.object({
  period: z.string().optional(),
  year: z.number().optional(),
  type: z.enum(vatEntryTypes).optional(),
  direction: z.enum(vatDirections).optional(),
});
export type VatEntriesFilterInput = z.infer<typeof vatEntriesFilterInput>;
