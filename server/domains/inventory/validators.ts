import { z } from "zod";

/** INVENTORY (Magazzino) — Validators */

export const movimentiInput = z.object({ prodottoId: z.string().min(1) });

export const createProdottoInput = z.object({
  nome: z.string().trim().min(1).max(255),
  codice: z.string().trim().max(100).optional(),
  categoria: z.string().trim().max(100).optional(),
  sottocategoria: z.string().trim().max(100).optional(),
  unitaMisura: z.string().trim().max(50).optional(),
  quantita: z.number().min(0).default(0),
  quantitaMinima: z.number().min(0).default(0),
  prezzoUnitario: z.number().min(0).optional(),
  note: z.string().trim().max(2_000).optional(),
});

/** Movimento generico, mantenuto per le integrazioni esistenti e futuri carichi manuali. */
export const movimentoInput = z.object({
  prodottoId: z.string().min(1),
  tipo: z.enum(["carico", "scarico"]),
  quantita: z.number().finite().positive(),
  data: z.string().date(),
  descrizione: z.string().trim().max(2_000).optional(),
  causale: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2_000).optional(),
});

/** Scarico ottimizzato per l’operatività ripetuta da smartphone. */
export const scaricoRapidoInput = z.object({
  prodottoId: z.string().min(1),
  quantita: z.number().finite().positive(),
  causale: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2_000).optional(),
});

export const deleteProdottoInput = z.object({ id: z.string().min(1) });

export type CreateProdottoInput = z.infer<typeof createProdottoInput>;
export type MovimentoInput = z.infer<typeof movimentoInput>;
export type ScaricoRapidoInput = z.infer<typeof scaricoRapidoInput>;
