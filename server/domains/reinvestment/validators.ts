import { z } from "zod";

/** REINVESTMENT (Reintegrazione) — Validators */

export const addFondoInput = z.object({
  macchinaId: z.string(),
  nomeDisplay: z.string().min(1),
  valoreAcquisto: z.number().positive(),
  fondoAttuale: z.number().min(0).default(0),
  tassoInteresse: z.number().min(0).max(1).default(0.03),
  annoObiettivo: z.number().optional(),
  rataConsigliata: z.number().optional(),
});

export const pagaRataInput = z.object({ fondoId: z.string(), importo: z.number().positive() });

export const rateInput = z.object({ fondoId: z.string() });

export type AddFondoInput = z.infer<typeof addFondoInput>;
