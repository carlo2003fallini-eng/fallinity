import { z } from "zod";

/** LIVESTOCK (Stalla) — Validators */

export const addAnimaleInput = z.object({
  matricola: z.string().min(1),
  nome: z.string().optional(),
  gruppo: z.string().optional(),
  razza: z.string().optional(),
  stato: z.enum(["attiva", "asciutta", "gravida", "infermeria"]).default("attiva"),
});

export const eseguiTrattamentoInput = z.object({ animaleId: z.string() });

export const addZoppiaInput = z.object({
  animaleId: z.string(),
  dataRilevazione: z.string(),
  score: z.number().min(1).max(5).default(1),
  zampa: z.string().optional(),
  diagnosi: z.string().optional(),
  trattamento: z.string().optional(),
});

export type AddAnimaleInput = z.infer<typeof addAnimaleInput>;
export type AddZoppiaInput = z.infer<typeof addZoppiaInput>;
