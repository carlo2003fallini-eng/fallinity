import { z } from "zod";
/**
 * FINANCE — Validators (Zod)
 * Contratti di input per tutte le procedure del dominio finanziario.
 * Importi sempre in centesimi (integer). Aliquota IVA in centesimi (2200 = 22%).
 */

// ── Legacy (retrocompatibilità dashboard) ──
export const listTransazioniInput = z
  .object({ tipo: z.enum(["entrata", "uscita"]).optional() })
  .optional();
export const createTransazioneInput = z.object({
  tipo: z.enum(["entrata", "uscita"]),
  categoria: z.string().min(1),
  descrizione: z.string().optional(),
  importo: z.number().positive(),
  data: z.string(),
  note: z.string().optional(),
});
export const deleteTransazioneInput = z.object({ id: z.string() });
export type ListTransazioniInput = z.infer<typeof listTransazioniInput>;
export type CreateTransazioneInput = z.infer<typeof createTransazioneInput>;
export type DeleteTransazioneInput = z.infer<typeof deleteTransazioneInput>;

// ══════════════════════════════════════════════════════════════════════════════
// NUOVA FINANZA — Sprint Fase 1
// ══════════════════════════════════════════════════════════════════════════════

// ── Categorie ──
export const createCategoriaInput = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["entrata", "uscita", "entrambi"]),
  codice: z.string().optional(),
  colore: z.string().optional(),
  icona: z.string().optional(),
  parentId: z.string().optional(),
  ordine: z.number().int().optional(),
});
export const updateCategoriaInput = z.object({
  id: z.string(),
  nome: z.string().min(1).optional(),
  colore: z.string().optional(),
  icona: z.string().optional(),
  attivo: z.boolean().optional(),
  ordine: z.number().int().optional(),
});
export const listCategorieInput = z.object({
  tipo: z.enum(["entrata", "uscita", "entrambi"]).optional(),
}).optional();

// ── Centri di costo ──
export const createCentroCostoInput = z.object({
  nome: z.string().min(1),
  codice: z.string().optional(),
  descrizione: z.string().optional(),
  colore: z.string().optional(),
});
export const updateCentroCostoInput = z.object({
  id: z.string(),
  nome: z.string().min(1).optional(),
  descrizione: z.string().optional(),
  colore: z.string().optional(),
  attivo: z.boolean().optional(),
});

// ── Soggetti ──
export const createSoggettoInput = z.object({
  tipologia: z.enum(["cliente", "fornitore", "entrambi"]),
  ragioneSociale: z.string().min(1),
  nomeBreve: z.string().optional(),
  partitaIva: z.string().optional(),
  codiceFiscale: z.string().optional(),
  email: z.string().optional(),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  iban: z.string().optional(),
  note: z.string().optional(),
});
export const updateSoggettoInput = z.object({
  id: z.string(),
  ragioneSociale: z.string().min(1).optional(),
  nomeBreve: z.string().optional(),
  partitaIva: z.string().optional(),
  codiceFiscale: z.string().optional(),
  email: z.string().optional(),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  iban: z.string().optional(),
  note: z.string().optional(),
  attivo: z.boolean().optional(),
});
export const listSoggettiInput = z.object({
  tipologia: z.enum(["cliente", "fornitore", "entrambi"]).optional(),
  search: z.string().optional(),
}).optional();

// ── Conti ──
export const createContoInput = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["bancario", "cassa", "carta", "deposito", "altro"]),
  banca: z.string().optional(),
  ibanMascherato: z.string().optional(),
  saldoIniziale: z.number().int().default(0),
  valuta: z.string().default("EUR"),
});
export const updateContoInput = z.object({
  id: z.string(),
  nome: z.string().min(1).optional(),
  banca: z.string().optional(),
  ibanMascherato: z.string().optional(),
  attivo: z.boolean().optional(),
});

// ── Metodi di pagamento ──
export const createMetodoInput = z.object({ nome: z.string().min(1) });
export const updateMetodoInput = z.object({ id: z.string(), nome: z.string().optional(), attivo: z.boolean().optional() });

// ── Documento / Movimento ──
export const createMovimentoInput = z.object({
  tipo: z.enum(["entrata", "uscita"]),
  tipoRegistrazione: z.enum(["pagato_subito", "documento", "ricorrente", "trasferimento", "investimento"]),
  // Importi in centesimi
  imponibile: z.number().int().min(0),
  aliquotaIva: z.number().int().min(0).default(2200),
  importoIva: z.number().int().min(0),
  totale: z.number().int().positive(),
  // Date
  dataDocumento: z.string(),
  dataCompetenza: z.string().optional(),
  dataScadenza: z.string().optional(),
  // Riferimenti
  categoriaId: z.string().min(1),
  centroCostoId: z.string().optional(),
  soggettoId: z.string().optional(),
  contoId: z.string().optional(),
  metodoId: z.string().optional(),
  // Documento
  tipoDocumento: z.string().optional(),
  numero: z.string().optional(),
  // Contenuto
  descrizione: z.string().optional(),
  note: z.string().optional(),
  riferimentoEsterno: z.string().optional(),
  // Origine
  originModule: z.string().optional(),
  originEntityType: z.string().optional(),
  originEntityId: z.string().optional(),
});

export const listMovimentiInput = z.object({
  tipo: z.enum(["entrata", "uscita"]).optional(),
  stato: z.string().optional(),
  categoriaId: z.string().optional(),
  centroCostoId: z.string().optional(),
  contoId: z.string().optional(),
  soggettoId: z.string().optional(),
  search: z.string().optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
}).optional();

export const annullaMovimentoInput = z.object({
  id: z.string(),
  motivo: z.string().optional(),
});

export const deleteMovimentoInput = z.object({ id: z.string() });

export const seedInput = z.object({}).optional();

// ══════════════════════════════════════════════════════════════════════════════
// FASE 2 — Pagamenti, Scadenze, Rate, Ricorrenze
// ══════════════════════════════════════════════════════════════════════════════

/** Registra un pagamento/incasso (parziale o totale) su un documento */
export const registraPagamentoInput = z.object({
  documentoId: z.string(),
  scadenzaId: z.string().optional(),
  contoId: z.string(),
  metodoId: z.string().optional(),
  importo: z.number().int().positive(),
  data: z.string(),
  riferimento: z.string().optional(),
  note: z.string().optional(),
});

/** Crea una singola scadenza per un documento */
export const creaScadenzaInput = z.object({
  documentoId: z.string(),
  importo: z.number().int().positive(),
  dataScadenza: z.string(),
  note: z.string().optional(),
});

/** Crea rate (split automatico) per un documento */
export const creaRateInput = z.object({
  documentoId: z.string(),
  numeroRate: z.number().int().min(2).max(120),
  frequenza: z.enum(["mensile", "bimestrale", "trimestrale", "semestrale", "annuale"]),
  dataInizio: z.string(),
});

/** Crea scadenze personalizzate (importi liberi) */
export const creaScadenzePersonalizzateInput = z.object({
  documentoId: z.string(),
  scadenze: z.array(z.object({
    importo: z.number().int().positive(),
    dataScadenza: z.string(),
    note: z.string().optional(),
  })).min(1),
});

/** Annulla un pagamento (storno) */
export const annullaPagamentoInput = z.object({
  id: z.string(),
  motivo: z.string().optional(),
});

/** Crea una ricorrenza finanziaria */
export const creaRicorrenzaInput = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["entrata", "uscita"]),
  tipoDocumento: z.string().optional(),
  soggettoId: z.string().optional(),
  categoriaId: z.string(),
  centroCostoId: z.string().optional(),
  imponibile: z.number().int().min(0),
  aliquotaIva: z.number().int().min(0).default(2200),
  importoIva: z.number().int().min(0),
  totale: z.number().int().positive(),
  descrizione: z.string().optional(),
  frequenza: z.enum(["mensile", "bimestrale", "trimestrale", "semestrale", "annuale"]),
  giorno: z.number().int().min(1).max(31).default(1),
  prossimaEmissione: z.string(),
  dataFine: z.string().optional(),
  creaScadenza: z.boolean().default(true),
  creaPagamento: z.boolean().default(false),
  contoId: z.string().optional(),
  metodoId: z.string().optional(),
});

export const updateRicorrenzaInput = z.object({
  id: z.string(),
  nome: z.string().optional(),
  attiva: z.boolean().optional(),
  dataFine: z.string().optional(),
  totale: z.number().int().positive().optional(),
  imponibile: z.number().int().min(0).optional(),
  importoIva: z.number().int().min(0).optional(),
  frequenza: z.enum(["mensile", "bimestrale", "trimestrale", "semestrale", "annuale"]).optional(),
  giorno: z.number().int().min(1).max(31).optional(),
  prossimaEmissione: z.string().optional(),
});

export const listScadenzeInput = z.object({
  stato: z.enum(["aperta", "parzialmente_pagata", "pagata", "incassata", "scaduta", "annullata"]).optional(),
  documentoId: z.string().optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
}).optional();

export const listCreditiDebitiInput = z.object({
  tipo: z.enum(["crediti", "debiti"]),
  limit: z.number().int().min(1).max(200).default(50),
}).optional();

export const listRicorrenzeInput = z.object({
  attiva: z.boolean().optional(),
}).optional();

// ── Type exports ──
export type CreateMovimentoInput = z.infer<typeof createMovimentoInput>;
export type ListMovimentiInput = z.infer<typeof listMovimentiInput>;
export type CreateCategoriaInput = z.infer<typeof createCategoriaInput>;
export type CreateSoggettoInput = z.infer<typeof createSoggettoInput>;
export type CreateContoInput = z.infer<typeof createContoInput>;
export type RegistraPagamentoInput = z.infer<typeof registraPagamentoInput>;
export type CreaScadenzaInput = z.infer<typeof creaScadenzaInput>;
export type CreaRateInput = z.infer<typeof creaRateInput>;
export type CreaRicorrenzaInput = z.infer<typeof creaRicorrenzaInput>;
