import { z } from "zod";

/** FLEET (Officina) — Validators */

export const STATI_MACCHINA = ["operativo", "manutenzione", "fermo", "riposo"] as const;
export const TIPI_INTERVENTO = ["manutenzione", "riparazione", "revisione", "tagliando", "straordinario"] as const;
export const PRIORITA_INTERVENTO = ["urgente", "alta", "media", "bassa"] as const;
export const STATI_INTERVENTO = ["pianificato", "in_corso", "straordinario", "completato"] as const;
export const CATEGORIE_RICAMBIO = [
  "Filtri olio",
  "Filtri aria",
  "Filtri carburante",
  "Lubrificanti",
  "Idraulica",
  "Elettrico",
  "Freni",
  "Trasmissione",
  "Altro",
] as const;

// ── Macchine ──────────────────────────────────────────────────────────────────
export const createMacchinaInput = z.object({
  nome: z.string().min(1),
  categoria: z.string().optional(),
  marca: z.string().optional(),
  modello: z.string().optional(),
  targa: z.string().optional(),
  telaio: z.string().optional(),
  anno: z.number().optional(),
  foto: z.string().optional(),
  oreTotali: z.number().optional(),
  oreMotore: z.number().optional(),
  chilometri: z.number().optional(),
  healthScore: z.number().min(0).max(100).optional(),
  ultimoTagliando: z.string().optional(),
  prossimaManutenzione: z.string().optional(),
  stato: z.enum(STATI_MACCHINA).default("operativo"),
  note: z.string().optional(),
});

export const updateMacchinaInput = createMacchinaInput.partial().extend({ id: z.string() });

export const deleteMacchinaInput = z.object({ id: z.string() });

export const macchinaDetailInput = z.object({ id: z.string() });

// ── Documenti macchina ──────────────────────────────────────────────────────────
export const addDocumentoInput = z.object({
  macchinaId: z.string(),
  nome: z.string().min(1),
  tipo: z.string().optional(),
  url: z.string().min(1),
  fileKey: z.string().optional(),
});

export const deleteDocumentoInput = z.object({ id: z.string() });

// ── Interventi ──────────────────────────────────────────────────────────────────
export const listInterventiInput = z
  .object({
    macchinaId: z.string().optional(),
    stato: z.enum(STATI_INTERVENTO).optional(),
    priorita: z.enum(PRIORITA_INTERVENTO).optional(),
    tipo: z.enum(TIPI_INTERVENTO).optional(),
  })
  .optional();

export const createInterventoInput = z.object({
  macchinaId: z.string(),
  tipo: z.enum(TIPI_INTERVENTO),
  categoria: z.string().optional(),
  descrizione: z.string().min(1),
  data: z.string(),
  dataPianificata: z.string().optional(),
  priorita: z.enum(PRIORITA_INTERVENTO).default("media"),
  stato: z.enum(STATI_INTERVENTO).default("pianificato"),
  operatore: z.string().optional(),
  tempoStimato: z.number().optional(),
  costoOrario: z.number().optional(),
  costoPrevisto: z.number().optional(),
  note: z.string().optional(),
  // Ricambi necessari (sempre mostrati anche se non disponibili).
  ricambi: z
    .array(
      z.object({
        ricambioId: z.string().optional(),
        codiceRicambio: z.string().optional(),
        nomeRicambio: z.string().optional(),
        quantitaRichiesta: z.number().default(1),
        obbligatorio: z.boolean().default(true),
      }),
    )
    .optional(),
});

export const updateStatoInterventoInput = z.object({
  id: z.string(),
  stato: z.enum(STATI_INTERVENTO),
});

export const deleteInterventoInput = z.object({ id: z.string() });

// Workflow completamento intervento.
export const completaInterventoInput = z.object({
  id: z.string(),
  oreLavoro: z.number().min(0).default(0),
  costoOrario: z.number().min(0).optional(),
  note: z.string().optional(),
  foto: z.string().optional(),
  ricambiUtilizzati: z
    .array(
      z.object({
        ricambioId: z.string().optional(),
        codiceRicambio: z.string().optional(),
        nomeRicambio: z.string().optional(),
        quantitaUtilizzata: z.number().min(0).default(0),
        costoUnitario: z.number().min(0).optional(),
      }),
    )
    .default([]),
});

// ── Ricambi (magazzino officina) ─────────────────────────────────────────────────
export const listRicambiInput = z
  .object({
    categoria: z.string().optional(),
    filtro: z
      .enum(["tutti", "disponibili", "sotto_scorta", "non_disponibili", "da_ordinare"])
      .optional(),
  })
  .optional();

export const createRicambioInput = z.object({
  codice: z.string().optional(),
  nome: z.string().min(1),
  categoria: z.enum(CATEGORIE_RICAMBIO).default("Altro"),
  compatibilita: z.string().optional(),
  quantitaDisponibile: z.number().min(0).default(0),
  sogliaMinima: z.number().min(0).default(0),
  posizione: z.string().optional(),
  costoMedio: z.number().min(0).optional(),
  fornitore: z.string().optional(),
  note: z.string().optional(),
});

export const updateRicambioInput = createRicambioInput.partial().extend({ id: z.string() });

export const deleteRicambioInput = z.object({ id: z.string() });

export const adjustRicambioInput = z.object({
  id: z.string(),
  delta: z.number(),
});

export type CreateMacchinaInput = z.infer<typeof createMacchinaInput>;
export type UpdateMacchinaInput = z.infer<typeof updateMacchinaInput>;
export type AddDocumentoInput = z.infer<typeof addDocumentoInput>;
export type CreateInterventoInput = z.infer<typeof createInterventoInput>;
export type CompletaInterventoInput = z.infer<typeof completaInterventoInput>;
export type CreateRicambioInput = z.infer<typeof createRicambioInput>;
export type UpdateRicambioInput = z.infer<typeof updateRicambioInput>;
