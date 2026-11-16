import { eRicambio } from "./parts";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  interventi,
  interventoRicambi,
  macchine,
  movimentiMagazzino,
  prelieviOfficina,
  prodotti,
} from "../../../drizzle/schema";
import { newId, withCreate, type ActorContext } from "../_core";
import type { ConfermaPrelievoInput } from "./validators";

const REPARTI_PREDEFINITI = [
  "Elettronica ed elettrico",
  "Idraulica",
  "Meccanica",
  "Motore",
  "Trasmissione e cambio",
] as const;

function repartoDaCategoria(categoria: string | null) {
  const value = (categoria ?? "").toLowerCase();
  if (value.includes("elettr") || value.includes("fren")) return "Elettronica ed elettrico";
  if (value.includes("idraul")) return "Idraulica";
  if (value.includes("trasmiss") || value.includes("cambio")) return "Trasmissione e cambio";
  if (value.includes("filtro") || value.includes("lubr") || value.includes("motore")) return "Motore";
  return "Meccanica";
}

function categoriaMezzo(categoria: string | null) {
  const value = (categoria ?? "").trim();
  return value || "Altri mezzi";
}


export function costruisciCatalogoOperatore(
  machines: any[],
  parts: any[],
  openWork: any[],
) {
  const disponibili = parts
    .filter((part) => eRicambio(part) && Number(part.quantita ?? 0) > 0)
    .map((part) => ({
      id: part.id,
      codice: part.codice,
      nome: part.nome,
      reparto: part.reparto || repartoDaCategoria(part.categoria),
      famiglia: part.famiglia || part.categoria || "Ricambi",
      sottocategoria: part.sottocategoria || null,
      immagineUrl: part.immagineUrl || null,
      quantitaDisponibile: Number(part.quantita ?? 0),
      costoUnitario: part.prezzoUnitario == null ? null : Number(part.prezzoUnitario),
    }));

  const categorie = Array.from(new Set(machines.map((machine) => categoriaMezzo(machine.categoria))))
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((nome) => ({
      nome,
      mezzi: machines.filter((machine) => categoriaMezzo(machine.categoria) === nome).map((machine) => ({
        id: machine.id,
        codice: machine.codice,
        nome: machine.nome,
        marca: machine.marca,
        modello: machine.modello,
        stato: machine.stato,
        foto: machine.foto,
      })),
    }));

  const tuttiReparti = Array.from(new Set([...REPARTI_PREDEFINITI, ...disponibili.map((p) => p.reparto)]));
  const reparti = tuttiReparti.map((nome) => ({
    nome,
    famiglie: Array.from(new Set(disponibili.filter((part) => part.reparto === nome).map((part) => part.famiglia)))
      .sort((a, b) => a.localeCompare(b, "it"))
      .map((famiglia) => ({
        nome: famiglia,
        sottocategorie: Array.from(new Set(disponibili
          .filter((part) => part.reparto === nome && part.famiglia === famiglia)
          .map((part) => part.sottocategoria)
          .filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, "it")),
      })),
  })).filter((reparto) => reparto.famiglie.length > 0);

  return { categorie, reparti, articoli: disponibili, interventiAperti: openWork };
}

export const operatorService = {
  async catalogo(companyId: string) {
    const db = await getDb();
    if (!db) return { categorie: [], reparti: [], articoli: [], interventiAperti: [] };
    const [machines, parts, openWork] = await Promise.all([
      db.select().from(macchine).where(and(eq(macchine.companyId, companyId), isNull(macchine.deletedAt))).orderBy(asc(macchine.nome)),
      db.select().from(prodotti).where(and(eq(prodotti.companyId, companyId), isNull(prodotti.deletedAt))).orderBy(asc(prodotti.nome)),
      db.select({ id: interventi.id, macchinaId: interventi.macchinaId, codice: interventi.codice, descrizione: interventi.descrizione, tipo: interventi.tipo, stato: interventi.stato })
        .from(interventi)
        .where(and(eq(interventi.companyId, companyId), isNull(interventi.deletedAt), sql`${interventi.stato} <> 'completato'`))
        .orderBy(asc(interventi.data)),
    ]);
    return costruisciCatalogoOperatore(machines, parts, openWork);
  },

  async confermaPrelievo(actor: ActorContext, input: ConfermaPrelievoInput) {
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");

    const findExisting = () => db.select().from(prelieviOfficina).where(and(
      eq(prelieviOfficina.companyId, actor.companyId),
      eq(prelieviOfficina.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    const existing = await findExisting();
    if (existing[0]) return { success: true, duplicate: true, prelievoId: existing[0].id, costoTotale: Number(existing[0].costoTotale) };

    try {
      return await db.transaction(async (tx) => {
        const macchina = await tx.select().from(macchine).where(and(
          eq(macchine.id, input.macchinaId), eq(macchine.companyId, actor.companyId), isNull(macchine.deletedAt),
        )).limit(1);
        if (!macchina[0]) throw new Error("Mezzo non trovato nell’azienda attiva");

        let interventoId = input.interventoId;
        if (interventoId) {
          await tx.execute(sql`SELECT id FROM interventi WHERE id=${interventoId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
          const open = await tx.select({ id: interventi.id }).from(interventi).where(and(
            eq(interventi.id, interventoId), eq(interventi.macchinaId, input.macchinaId),
            eq(interventi.companyId, actor.companyId), isNull(interventi.deletedAt), sql`${interventi.stato} <> 'completato'`,
          )).limit(1);
          if (!open[0]) throw new Error("Intervento non trovato per il mezzo selezionato");
        } else if (input.nuovoIntervento) {
          interventoId = newId();
          await tx.insert(interventi).values(withCreate(actor, {
            id: interventoId,
            macchinaId: input.macchinaId,
            codice: `OP-${new Date().getFullYear()}-${interventoId.slice(0, 6).toUpperCase()}`,
            tipo: input.nuovoIntervento.tipo,
            descrizione: input.nuovoIntervento.descrizione,
            data: new Date().toISOString().slice(0, 10),
            priorita: "media",
            stato: "in_corso",
            operatore: actor.userUuid,
          }) as any);
        }

        const uniqueRows = new Map<string, number>();
        for (const row of input.righe) uniqueRows.set(row.ricambioId, (uniqueRows.get(row.ricambioId) ?? 0) + row.quantita);
        const snapshots: Array<Record<string, unknown>> = [];
        let costoTotale = 0;

        for (const [prodottoId, quantita] of Array.from(uniqueRows.entries())) {
          const part = await tx.select().from(prodotti).where(and(
            eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt),
          )).limit(1);
          if (!part[0] || !eRicambio(part[0])) throw new Error("Ricambio non trovato nel Magazzino dell’azienda attiva");

          // Lock della riga: due operatori concorrenti non possono scaricare la stessa giacenza.
          await tx.execute(sql`SELECT id FROM prodotti WHERE id=${prodottoId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
          const freshPart = await tx.select().from(prodotti).where(and(
            eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt),
          )).limit(1);
          const disponibile = Number(freshPart[0]?.quantita ?? 0);
          if (quantita > disponibile) throw new Error(`Giacenza insufficiente per ${part[0].nome}`);
          await tx.update(prodotti)
            .set({ quantita: (disponibile - quantita).toFixed(3), ultimoScaricoQuantita: String(quantita), ultimoScaricoAt: new Date() })
            .where(and(eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId)));
          const [savedPart] = await tx.select({ quantita: prodotti.quantita }).from(prodotti).where(and(
            eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt),
          )).limit(1);
          if (!savedPart || Number(savedPart.quantita) !== Number((disponibile - quantita).toFixed(3))) {
            throw new Error(`Giacenza insufficiente per ${part[0].nome}`);
          }

          const costoUnitario = Number(part[0].prezzoUnitario ?? 0);
          const totaleRiga = costoUnitario * quantita;
          costoTotale += totaleRiga;
          snapshots.push({ prodottoId, codice: part[0].codice, nome: part[0].nome, quantita, costoUnitario, totale: totaleRiga });
          await tx.insert(movimentiMagazzino).values(withCreate(actor, {
            id: newId(), prodottoId, tipo: "scarico", quantita: String(quantita),
            data: new Date().toISOString().slice(0, 10), dataOra: new Date(),
            descrizione: `Prelievo Officina per ${macchina[0].nome}`, causale: "officina",
            note: input.idempotencyKey, operatore: actor.userUuid,
          }) as any);

          if (interventoId) {
            await tx.insert(interventoRicambi).values(withCreate(actor, {
              interventoId, ricambioId: null, prodottoId, codiceRicambio: part[0].codice,
              nomeRicambio: part[0].nome, quantitaRichiesta: String(quantita), quantitaUtilizzata: String(quantita),
              costoUnitario: String(costoUnitario), obbligatorio: false,
            }) as any);
          }
        }

        if (interventoId && costoTotale > 0) {
          await tx.update(interventi).set({ costoRicambi: sql`COALESCE(${interventi.costoRicambi}, 0) + ${costoTotale}` } as any)
            .where(and(eq(interventi.id, interventoId), eq(interventi.companyId, actor.companyId)));
        }

        if (costoTotale > 0) await tx.update(macchine).set({ costoTotale: sql`COALESCE(${macchine.costoTotale}, 0) + ${costoTotale}`, updatedBy: actor.userUuid }).where(and(eq(macchine.id, input.macchinaId), eq(macchine.companyId, actor.companyId), isNull(macchine.deletedAt)));

        const prelievoId = newId();
        await tx.insert(prelieviOfficina).values(withCreate(actor, {
          id: prelievoId, idempotencyKey: input.idempotencyKey, macchinaId: input.macchinaId,
          interventoId: interventoId ?? null, operatore: actor.userUuid, costoTotale: String(costoTotale), righe: snapshots,
        }) as any);

        // Nessuna proposta Finanza: il ricambio era già acquistato e sta solo cambiando giacenza.
        return { success: true, duplicate: false, prelievoId, interventoId: interventoId ?? null, costoTotale };
      });
    } catch (error) {
      // Se un retry concorrente ha già vinto la chiave unica, restituiamo il suo esito.
      const winner = await findExisting();
      if (winner[0]) return { success: true, duplicate: true, prelievoId: winner[0].id, costoTotale: Number(winner[0].costoTotale) };
      throw error;
    }
  },
};
