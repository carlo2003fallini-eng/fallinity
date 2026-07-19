import { z } from "zod";
/** LIVESTOCK (Stalla) — Validators */

// ── Enum condivisi ──
export const STATI_PRODUTTIVI = ["in_lattazione", "asciutta", "rimonta", "vitello", "manza", "riformata", "venduta", "deceduta"] as const;
export const STATI_RIPRODUTTIVI = ["vuota", "inseminata", "gravida", "da_controllare", "persa", "non_idonea"] as const;
export const MODALITA_FATTORE = ["automatico", "conferma", "suggerimento", "non_applicare"] as const;
export const TIPOLOGIE_GRUPPO = ["lattazione", "asciutta", "rimonta", "infermeria", "vitelli", "manze", "pre_parto", "post_parto", "personalizzato"] as const;
export const TIPI_EVENTO = ["inseminazione", "diagnosi_gravidanza", "parto", "trattamento", "zoppia", "mastite", "spostamento_gruppo", "asciugatura", "riforma", "vendita", "decesso", "visita", "sincronizzazione", "controllo", "nota", "altro"] as const;

// ── Gruppi ──
export const createGruppoInput = z.object({
  nome: z.string().min(1),
  tipologia: z.enum(TIPOLOGIE_GRUPPO).default("personalizzato"),
  colore: z.string().optional(),
  descrizione: z.string().optional(),
  capacitaMax: z.number().int().positive().optional(),
  note: z.string().optional(),
  applicaFattoriPredefiniti: z.boolean().default(false),
  statoProduttivoPredefinito: z.enum(STATI_PRODUTTIVI).nullable().optional(),
  modalitaStatoProduttivo: z.enum(MODALITA_FATTORE).default("non_applicare"),
  statoRiproduttivoPredefinito: z.enum(STATI_RIPRODUTTIVI).nullable().optional(),
  modalitaStatoRiproduttivo: z.enum(MODALITA_FATTORE).default("non_applicare"),
  categoriaSanitariaPredefinita: z.string().nullable().optional(),
  modalitaCategoriaSanitaria: z.enum(MODALITA_FATTORE).default("non_applicare"),
  percorsoOperativoPredefinito: z.string().nullable().optional(),
});
export type CreateGruppoInput = z.infer<typeof createGruppoInput>;

export const updateGruppoInput = z.object({
  id: z.string(),
  nome: z.string().min(1).optional(),
  tipologia: z.enum(TIPOLOGIE_GRUPPO).optional(),
  colore: z.string().optional(),
  descrizione: z.string().optional(),
  capacitaMax: z.number().int().positive().nullable().optional(),
  note: z.string().optional(),
  stato: z.enum(["attivo", "archiviato"]).optional(),
  applicaFattoriPredefiniti: z.boolean().optional(),
  statoProduttivoPredefinito: z.enum(STATI_PRODUTTIVI).nullable().optional(),
  modalitaStatoProduttivo: z.enum(MODALITA_FATTORE).optional(),
  statoRiproduttivoPredefinito: z.enum(STATI_RIPRODUTTIVI).nullable().optional(),
  modalitaStatoRiproduttivo: z.enum(MODALITA_FATTORE).optional(),
  categoriaSanitariaPredefinita: z.string().nullable().optional(),
  modalitaCategoriaSanitaria: z.enum(MODALITA_FATTORE).optional(),
  percorsoOperativoPredefinito: z.string().nullable().optional(),
});
export type UpdateGruppoInput = z.infer<typeof updateGruppoInput>;

export const archiveGruppoInput = z.object({ id: z.string() });

// ── Animali ──
export const addAnimaleInput = z.object({
  matricola: z.string().min(1),
  numeroAziendale: z.string().optional(),
  nome: z.string().optional(),
  rfid: z.string().optional(),
  gruppoId: z.string().min(1, "Il gruppo è obbligatorio"),
  gruppo: z.string().optional(),
  razza: z.string().optional(),
  dataNascita: z.string().optional(),
  sesso: z.enum(["femmina", "maschio"]).default("femmina"),
  stato: z.enum(["attiva", "asciutta", "gravida", "infermeria", "venduta", "morta"]).default("attiva"),
  statoProduttivo: z.enum(STATI_PRODUTTIVI).default("in_lattazione"),
  statoRiproduttivo: z.enum(STATI_RIPRODUTTIVI).default("vuota"),
  foto: z.string().optional(),
  note: z.string().optional(),
  confermaFattori: z.boolean().default(false),
});
export type AddAnimaleInput = z.infer<typeof addAnimaleInput>;

export const updateAnimaleInput = z.object({
  id: z.string(),
  matricola: z.string().min(1).optional(),
  numeroAziendale: z.string().optional(),
  nome: z.string().optional(),
  rfid: z.string().optional(),
  gruppoId: z.string().nullable().optional(),
  gruppo: z.string().optional(),
  razza: z.string().optional(),
  dataNascita: z.string().optional(),
  sesso: z.enum(["femmina", "maschio"]).optional(),
  stato: z.enum(["attiva", "asciutta", "gravida", "infermeria", "venduta", "morta"]).optional(),
  statoProduttivo: z.enum(STATI_PRODUTTIVI).optional(),
  statoRiproduttivo: z.enum(STATI_RIPRODUTTIVI).optional(),
  foto: z.string().optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  produzioneOggi: z.number().min(0).optional(),
  giorniLattazione: z.number().int().min(0).optional(),
  giorniGravidanza: z.number().int().min(0).optional(),
  dataPartoPrevisto: z.string().optional(),
  note: z.string().optional(),
});
export type UpdateAnimaleInput = z.infer<typeof updateAnimaleInput>;

// ── Spostamento gruppo (singolo) ──
export const spostaGruppoInput = z.object({
  animaleId: z.string(),
  nuovoGruppoId: z.string(),
  confermaFattori: z.boolean().default(true),
  motivo: z.string().optional(),
});
export type SpostaGruppoInput = z.infer<typeof spostaGruppoInput>;

// ── Spostamento gruppo (multiplo) ──
export const spostaMultiploInput = z.object({
  animaleIds: z.array(z.string()).min(1),
  nuovoGruppoId: z.string(),
  confermaFattori: z.boolean().default(true),
  motivo: z.string().optional(),
});
export type SpostaMultiploInput = z.infer<typeof spostaMultiploInput>;

// ── Anteprima fattori ──
export const anteprimaFattoriInput = z.object({
  animaleId: z.string().optional(),
  animaleIds: z.array(z.string()).optional(),
  gruppoDestinazioneId: z.string(),
});
export type AnteprimaFattoriInput = z.infer<typeof anteprimaFattoriInput>;

// ── Trattamenti ──
export const createTrattamentoInput = z.object({
  animaleId: z.string().min(1),
  tipo: z.enum(["sincronizzazione", "vaccino", "farmaco", "visita", "altro"]).default("altro"),
  tipologia: z.string().optional(),
  motivo: z.string().optional(),
  farmaco: z.string().optional(),
  prodotto: z.string().optional(),
  dose: z.string().optional(),
  unitaMisura: z.string().optional(),
  viaSomministrazione: z.string().optional(),
  dataTrattamento: z.string(),
  dataFine: z.string().optional(),
  tempiSospensione: z.string().optional(),
  prossimoTrattamento: z.string().optional(),
  operatore: z.string().optional(),
  veterinario: z.string().optional(),
  note: z.string().optional(),
});
export type CreateTrattamentoInput = z.infer<typeof createTrattamentoInput>;

// ── Ricerca ──
export const ricercaAnimaliInput = z.object({ query: z.string().min(1) });
export const getAnimaleInput = z.object({ id: z.string() });

// ── Zoppie (legacy) ──
export const addZoppiaInput = z.object({
  animaleId: z.string(),
  dataRilevazione: z.string(),
  score: z.number().min(1).max(5).default(1),
  zampa: z.string().optional(),
  diagnosi: z.string().optional(),
  trattamento: z.string().optional(),
});
export type AddZoppiaInput = z.infer<typeof addZoppiaInput>;

export const eseguiTrattamentoInput = z.object({ animaleId: z.string() });

// ── Eventi Animale ──
export const addEventoAnimaleInput = z.object({
  animaleId: z.string(),
  tipo: z.enum(TIPI_EVENTO).default("altro"),
  data: z.string(),
  descrizione: z.string().optional(),
  operatore: z.string().optional(),
  note: z.string().optional(),
  gruppoPrecedenteId: z.string().optional(),
  gruppoNuovoId: z.string().optional(),
  statoProduttivoPrecedente: z.string().optional(),
  statoProduttivoNuovo: z.string().optional(),
  statoRiproduttivoPrecedente: z.string().optional(),
  statoRiproduttivoNuovo: z.string().optional(),
  fattoriApplicati: z.string().optional(),
  modalitaApplicazione: z.string().optional(),
  motivo: z.string().optional(),
  operazioneMultiplaId: z.string().optional(),
});
export type AddEventoAnimaleInput = z.infer<typeof addEventoAnimaleInput>;

// ── Filtri Gruppi ──
export const filtriGruppiInput = z.object({
  tipologia: z.string().optional(),
  stato: z.enum(["attivo", "archiviato"]).optional(),
  conAlert: z.boolean().optional(),
  conGravide: z.boolean().optional(),
  inLattazione: z.boolean().optional(),
  conTrattamenti: z.boolean().optional(),
  produzioneSottoMedia: z.boolean().optional(),
  ricerca: z.string().optional(),
}).optional();
export type FiltriGruppiInput = z.infer<typeof filtriGruppiInput>;

// ── Filtri Animali ──
export const filtriAnimaliInput = z.object({
  gruppoId: z.string().optional(),
  statoProduttivo: z.enum(STATI_PRODUTTIVI).optional(),
  statoRiproduttivo: z.enum(STATI_RIPRODUTTIVI).optional(),
  conTrattamento: z.boolean().optional(),
  conAlert: z.boolean().optional(),
  healthScoreMax: z.number().optional(),
  ricerca: z.string().optional(),
}).optional();
export type FiltriAnimaliInput = z.infer<typeof filtriAnimaliInput>;
