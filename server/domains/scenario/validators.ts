import { z } from "zod";

export const VARIABILI_SCENARIO = [
  "investimento_iniziale",
  "costo_manodopera",
  "costo_mangimi",
  "costo_energia",
  "costo_manutenzione",
  "prezzo_latte",
  "prezzo_carne",
  "produzione_latte_giorno",
  "numero_capi",
  "ettari_coltivati",
  "resa_ettaro",
  "prezzo_vendita_colture",
] as const;

export const MODELLI_SCENARIO = [
  "personalizzato",
  "espansione",
  "riduzione_costi",
  "nuovo_investimento",
  "cambio_produzione",
] as const;

export const STATI_SCENARIO = ["bozza", "calcolato", "archiviato"] as const;

export const createScenarioSchema = z.object({
  nome: z.string().min(1).max(255),
  descrizione: z.string().optional(),
  modello: z.enum(MODELLI_SCENARIO).default("personalizzato"),
});

export const addIpotesiSchema = z.object({
  scenarioId: z.string().min(1),
  variabile: z.enum(VARIABILI_SCENARIO),
  valoreAttuale: z.number(),
  valoreIpotesi: z.number(),
  unita: z.string().default("€"),
  note: z.string().optional(),
});

export const addIpotesiBatchSchema = z.object({
  scenarioId: z.string().min(1),
  ipotesi: z.array(z.object({
    variabile: z.enum(VARIABILI_SCENARIO),
    valoreAttuale: z.number(),
    valoreIpotesi: z.number(),
    unita: z.string().default("€"),
    note: z.string().optional(),
  })).min(1),
});

export const calcolaSchema = z.object({
  scenarioId: z.string().min(1),
});

export const confrontaSchema = z.object({
  scenarioIds: z.array(z.string()).min(2).max(5),
});

export const listScenariSchema = z.object({
  stato: z.enum(STATI_SCENARIO).optional(),
});

export const deleteScenarioSchema = z.object({
  id: z.string().min(1),
});

export const updateIpotesiSchema = z.object({
  id: z.string().min(1),
  valoreIpotesi: z.number(),
  note: z.string().optional(),
});

export const removeIpotesiSchema = z.object({
  id: z.string().min(1),
});
