import { z } from "zod";

/** CROP (Campi) — Validators */

export const lavorazioniInput = z.object({ campoId: z.string() });

export const createCampoInput = z.object({
  nome: z.string().min(1),
  codice: z.string().optional(),
  ettari: z.number().positive(),
  comune: z.string().optional(),
  coltura: z.string().optional(),
  stato: z.enum(["attivo", "a_riposo", "in_lavorazione"]).default("attivo"),
  note: z.string().optional(),
});

export const addLavorazioneInput = z.object({
  campoId: z.string(),
  tipo: z.string().min(1),
  descrizione: z.string().optional(),
  data: z.string(),
  operatore: z.string().optional(),
  costo: z.number().optional(),
});

export const deleteCampoInput = z.object({ id: z.string() });

export type CreateCampoInput = z.infer<typeof createCampoInput>;
export type AddLavorazioneInput = z.infer<typeof addLavorazioneInput>;
