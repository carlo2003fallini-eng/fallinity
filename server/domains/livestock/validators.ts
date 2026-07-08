import { z } from "zod";

/** LIVESTOCK (Stalla) — Validators */

// ── Gruppi ──
export const createGruppoInput = z.object({
  nome: z.string().min(1),
  tipologia: z.enum(["lattazione", "asciutta", "rimonta", "infermeria", "vitelli", "manze", "pre_parto", "post_parto", "personalizzato"]).default("personalizzato"),
  colore: z.string().optional(),
  descrizione: z.string().optional(),
  capacitaMax: z.number().int().positive().optional(),
  note: z.string().optional(),
});
export type CreateGruppoInput = z.infer<typeof createGruppoInput>;

export const updateGruppoInput = z.object({
  id: z.string(),
  nome: z.string().min(1).optional(),
  tipologia: z.enum(["lattazione", "asciutta", "rimonta", "infermeria", "vitelli", "manze", "pre_parto", "post_parto", "personalizzato"]).optional(),
  colore: z.string().optional(),
  descrizione: z.string().optional(),
  capacitaMax: z.number().int().positive().nullable().optional(),
  note: z.string().optional(),
  stato: z.enum(["attivo", "archiviato"]).optional(),
});
export type UpdateGruppoInput = z.infer<typeof updateGruppoInput>;

export const archiveGruppoInput = z.object({ id: z.string() });

// ── Animali ──
export const STATI_PRODUTTIVI = ["in_lattazione", "asciutta", "rimonta", "vitello", "manza", "riformata", "venduta", "deceduta"] as const;
export const STATI_RIPRODUTTIVI = ["vuota", "inseminata", "gravida", "da_controllare", "persa", "non_idonea"] as const;

export const addAnimaleInput = z.object({
  matricola: z.string().min(1),
  numeroAziendale: z.string().optional(),
  nome: z.string().optional(),
  rfid: z.string().optional(),
  gruppoId: z.string().optional(),
  gruppo: z.string().optional(),
  razza: z.string().optional(),
  dataNascita: z.string().optional(),
  sesso: z.enum(["femmina", "maschio"]).default("femmina"),
  stato: z.enum(["attiva", "asciutta", "gravida", "infermeria", "venduta", "morta"]).default("attiva"),
  statoProduttivo: z.enum(STATI_PRODUTTIVI).default("in_lattazione"),
  statoRiproduttivo: z.enum(STATI_RIPRODUTTIVI).default("vuota"),
  foto: z.string().optional(),
  note: z.string().optional(),
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

export const spostaGruppoInput = z.object({
  animaleId: z.string(),
  nuovoGruppoId: z.string(),
});

export const ricercaAnimaliInput = z.object({
  query: z.string().min(1),
});

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
  tipo: z.enum(["inseminazione", "diagnosi_gravidanza", "parto", "trattamento", "zoppia", "mastite", "spostamento_gruppo", "asciugatura", "riforma", "vendita", "decesso", "visita", "altro"]).default("altro"),
  data: z.string(),
  descrizione: z.string().optional(),
  operatore: z.string().optional(),
  note: z.string().optional(),
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
