import { z } from "zod";

/** CALENDAR (Calendario) — Validators */

export const listEventiInput = z.object({ anno: z.number().optional(), mese: z.number().optional() }).optional();

export const createEventoInput = z.object({
  titolo: z.string().min(1),
  descrizione: z.string().optional(),
  tipo: z.enum(["lavorazione", "manutenzione", "scadenza", "altro"]).default("altro"),
  data: z.string(),
  ora: z.string().optional(),
  priorita: z.enum(["bassa", "normale", "alta"]).default("normale"),
});

export const toggleCompletatoInput = z.object({ id: z.string(), completato: z.boolean() });
export const deleteEventoInput = z.object({ id: z.string() });

export type CreateEventoInput = z.infer<typeof createEventoInput>;
