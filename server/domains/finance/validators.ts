import { z } from "zod";

/**
 * FINANCE — Validators (Zod)
 * Contratti di input per le procedure del dominio finanziario.
 */

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
