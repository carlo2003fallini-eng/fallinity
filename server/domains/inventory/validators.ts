import { z } from "zod";

/** INVENTORY (Magazzino) — Validators */

export const movimentiInput = z.object({ prodottoId: z.string() });

export const createProdottoInput = z.object({
  nome: z.string().min(1),
  codice: z.string().optional(),
  categoria: z.string().optional(),
  unitaMisura: z.string().optional(),
  quantita: z.number().default(0),
  quantitaMinima: z.number().default(0),
  prezzoUnitario: z.number().optional(),
});

export const movimentoInput = z.object({
  prodottoId: z.string(),
  tipo: z.enum(["carico", "scarico"]),
  quantita: z.number().positive(),
  data: z.string(),
  descrizione: z.string().optional(),
});

export const deleteProdottoInput = z.object({ id: z.string() });

export type CreateProdottoInput = z.infer<typeof createProdottoInput>;
export type MovimentoInput = z.infer<typeof movimentoInput>;
