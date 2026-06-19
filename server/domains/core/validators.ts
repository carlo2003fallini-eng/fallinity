import { z } from "zod";

/** CORE (Company + Contatti/Azienda) — Validators */

export const listContattiInput = z
  .object({ tipo: z.enum(["dipendente", "fornitore", "cliente"]).optional() })
  .optional();

export const createContattoInput = z.object({
  tipo: z.enum(["dipendente", "fornitore", "cliente"]),
  nome: z.string().min(1),
  cognome: z.string().optional(),
  aziendaNome: z.string().optional(),
  email: z.string().optional(),
  telefono: z.string().optional(),
  citta: z.string().optional(),
  ruolo: z.string().optional(),
  note: z.string().optional(),
});

export const deleteContattoInput = z.object({ id: z.string() });

export type CreateContattoInput = z.infer<typeof createContattoInput>;
