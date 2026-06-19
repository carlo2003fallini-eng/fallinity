import { z } from "zod";

/** FLEET (Officina) — Validators */

export const createMacchinaInput = z.object({
  nome: z.string().min(1),
  marca: z.string().optional(),
  modello: z.string().optional(),
  targa: z.string().optional(),
  telaio: z.string().optional(),
  anno: z.number().optional(),
  oreTotali: z.number().optional(),
  stato: z.enum(["operativo", "manutenzione", "fermo"]).default("operativo"),
  note: z.string().optional(),
});

export const deleteMacchinaInput = z.object({ id: z.string() });

export const listInterventiInput = z.object({ macchinaId: z.string().optional() }).optional();

export const createInterventoInput = z.object({
  macchinaId: z.string(),
  tipo: z.enum(["manutenzione", "riparazione", "revisione"]),
  descrizione: z.string().min(1),
  data: z.string(),
  priorita: z.enum(["alta", "media", "bassa"]).default("media"),
  stato: z.enum(["pianificato", "in_corso", "completato"]).default("pianificato"),
  costoManodopera: z.number().optional(),
  costoRicambi: z.number().optional(),
  operatore: z.string().optional(),
  note: z.string().optional(),
});

export const updateStatoInterventoInput = z.object({
  id: z.string(),
  stato: z.enum(["pianificato", "in_corso", "completato"]),
});

export type CreateMacchinaInput = z.infer<typeof createMacchinaInput>;
export type CreateInterventoInput = z.infer<typeof createInterventoInput>;
