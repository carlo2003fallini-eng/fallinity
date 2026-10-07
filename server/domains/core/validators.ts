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

export const COMPANY_AREA_ORDER_IDS = ["stalla", "magazzino", "officina", "campi"] as const;

export const updateCompanyAreasOrderInput = z.object({
  ordine: z.array(z.enum(COMPANY_AREA_ORDER_IDS)).length(COMPANY_AREA_ORDER_IDS.length)
    .refine((ordine) => new Set(ordine).size === COMPANY_AREA_ORDER_IDS.length, "L’ordine contiene aree duplicate"),
});

// Lo scope serve soltanto a separare la cache client quando cambia azienda;
// il server usa sempre e solo l'azienda attiva ricavata dal contesto autenticato.
export const companyAreasOrderScopeInput = z.object({
  scope: z.string().trim().max(64).optional(),
}).optional();

export type CreateContattoInput = z.infer<typeof createContattoInput>;
export type UpdateCompanyAreasOrderInput = z.infer<typeof updateCompanyAreasOrderInput>;
