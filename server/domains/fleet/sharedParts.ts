import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { prodotti, movimentiMagazzino } from "../../../drizzle/schema";
import { newId, withCreate, withUpdate, type ActorContext } from "../_core";
import { inventoryRepository } from "../inventory/repository";
import { fleetRepository } from "./repository";
import type { CreateRicambioInput, UpdateRicambioInput } from "./validators";
import { eRicambio } from "./parts";

function productPatch(input: Partial<CreateRicambioInput>) {
  const patch: Record<string, unknown> = {};
  for (const key of ["codice", "nome", "reparto", "famiglia", "sottocategoria", "immagineUrl", "compatibilita", "posizione", "fornitore", "note"] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (input.categoria !== undefined && input.famiglia === undefined) patch.famiglia = input.categoria;
  if (input.quantitaDisponibile !== undefined) patch.quantita = String(input.quantitaDisponibile);
  if (input.sogliaMinima !== undefined) patch.quantitaMinima = String(input.sogliaMinima);
  if (input.costoMedio !== undefined) patch.prezzoUnitario = String(input.costoMedio);
  return patch;
}

export const sharedPartsService = {
  async create(actor: ActorContext, input: CreateRicambioInput) {
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    if (input.codice) {
      const rows = await inventoryRepository.listProdotti(actor.companyId);
      if (rows.some((p) => p.codice?.trim().toLowerCase() === input.codice!.trim().toLowerCase())) throw new Error("Questo codice esiste già nel Magazzino aziendale");
    }
    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(prodotti).values(withCreate(actor, {
        ...productPatch(input), id, codice: input.codice || `RIC-${id.slice(0, 8).toUpperCase()}`,
        categoria: "Ricambi", famiglia: input.famiglia || input.categoria || "Altro", unitaMisura: "pz",
      }) as any);
      if (input.quantitaDisponibile > 0) await tx.insert(movimentiMagazzino).values(withCreate(actor, {
        prodottoId: id, tipo: "carico", quantita: String(input.quantitaDisponibile),
        data: new Date().toISOString().slice(0, 10), dataOra: new Date(), causale: "giacenza_iniziale",
        descrizione: "Giacenza iniziale ricambio — nessun nuovo acquisto", operatore: actor.userUuid,
      }) as any);
    });
    return { success: true, id };
  },
  async update(actor: ActorContext, input: UpdateRicambioInput) {
    const product = await inventoryRepository.getProdotto(actor.companyId, input.id);
    if (!product) {
      const legacy = await fleetRepository.getRicambio(actor.companyId, input.id);
      if (!legacy) throw new Error("Ricambio non trovato nell’azienda attiva");
      const { id, ...patch } = input;
      return fleetRepository.updateRicambio(actor, id, patch as any);
    }
    if (!eRicambio(product)) throw new Error("Il prodotto non appartiene ai ricambi Officina");
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM prodotti WHERE id=${input.id} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      const [fresh] = await tx.select().from(prodotti).where(and(eq(prodotti.id, input.id), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt))).limit(1);
      if (!fresh) throw new Error("Ricambio non disponibile");
      if (input.quantitaDisponibile != null && input.quantitaDisponibile !== Number(fresh.quantita)) {
        const delta = input.quantitaDisponibile - Number(fresh.quantita);
        await tx.insert(movimentiMagazzino).values(withCreate(actor, {
          prodottoId: input.id, tipo: delta > 0 ? "carico" : "scarico", quantita: String(Math.abs(delta)),
          data: new Date().toISOString().slice(0, 10), dataOra: new Date(), causale: "rettifica",
          descrizione: "Rettifica confermata dalla scheda ricambio", operatore: actor.userUuid,
        }) as any);
      }
      await tx.update(prodotti).set(withUpdate(actor, productPatch(input)) as any).where(and(eq(prodotti.id, input.id), eq(prodotti.companyId, actor.companyId)));
    });
    return { success: true };
  },
  async adjust(actor: ActorContext, id: string, delta: number) {
    const p = await inventoryRepository.getProdotto(actor.companyId, id);
    if (!p) {
      const r = await fleetRepository.getRicambio(actor.companyId, id);
      if (!r) throw new Error("Ricambio non trovato");
      if (Number(r.quantitaDisponibile) + delta < 0) throw new Error("Giacenza insufficiente");
      return fleetRepository.updateRicambio(actor, id, { quantitaDisponibile: String(Number(r.quantitaDisponibile) + delta) });
    }
    if (!eRicambio(p) || !Number.isFinite(delta) || delta === 0) throw new Error("Rettifica non valida");
    return inventoryRepository.registraMovimentoAtomico(actor, {
      prodottoId: id, tipo: delta > 0 ? "carico" : "scarico", quantita: String(Math.abs(delta)),
      data: new Date().toISOString().slice(0, 10), causale: "rettifica", descrizione: "Rettifica giacenza Officina",
    });
  },
  async order(actor: ActorContext, id: string, statoOrdine: string) {
    const p = await inventoryRepository.getProdotto(actor.companyId, id);
    if (!p) {
      if (!await fleetRepository.getRicambio(actor.companyId, id)) throw new Error("Ricambio non trovato");
      return fleetRepository.updateRicambio(actor, id, { statoOrdine });
    }
    if (!eRicambio(p)) throw new Error("Ricambio non trovato");
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    await db.update(prodotti).set(withUpdate(actor, { statoOrdine }) as any).where(and(eq(prodotti.id, id), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt)));
    return { success: true };
  },
  async remove(actor: ActorContext, id: string) {
    const p = await inventoryRepository.getProdotto(actor.companyId, id);
    if (p && eRicambio(p)) return inventoryRepository.softDeleteProdotto(actor, id);
    if (!await fleetRepository.getRicambio(actor.companyId, id)) throw new Error("Ricambio non trovato");
    return fleetRepository.softDeleteRicambio(actor, id);
  },
};
