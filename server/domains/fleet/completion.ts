import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { interventi, interventoRicambi, macchine, prodotti, ricambi, movimentiMagazzino } from "../../../drizzle/schema";
import { withCreate, withUpdate, type ActorContext } from "../_core";
import { proposalsService } from "../finance/proposals.service";
import { calendarRepository } from "../calendar/repository";
import type { CompletaInterventoInput } from "./validators";

export function costiCompletamento(materialiGiaPrelevati: number, nuoviMateriali: number, ore: number, tariffa: number) {
  const costoRicambi = materialiGiaPrelevati + nuoviMateriali;
  const costoManodopera = ore * tariffa;
  return { costoRicambi, costoManodopera, costoFinale: costoRicambi + costoManodopera };
}

export async function completaInterventoAtomico(actor: ActorContext, input: CompletaInterventoInput) {
  const db = await getDb();
  if (!db) throw new Error("Database non disponibile");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM interventi WHERE id=${input.id} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
    const [work] = await tx.select().from(interventi).where(and(eq(interventi.id, input.id), eq(interventi.companyId, actor.companyId), isNull(interventi.deletedAt))).limit(1);
    if (!work) throw new Error("Intervento non trovato nell’azienda attiva");
    if (work.stato === "completato") return { success: true, duplicate: true, costoFinale: Number(work.costoFinale), costoManodopera: Number(work.costoManodopera), costoRicambi: Number(work.costoRicambi), work, macchina: null, costoEsterno: 0 };
    const rows = await tx.select().from(interventoRicambi).where(and(eq(interventoRicambi.interventoId, input.id), eq(interventoRicambi.companyId, actor.companyId), isNull(interventoRicambi.deletedAt)));
    const giaPrelevati = rows.reduce((sum, r) => sum + Number(r.quantitaUtilizzata || 0) * Number(r.costoUnitario || 0), 0);
    let nuoviMateriali = 0;
    let costoEsterno = 0;
    const seen = new Set<string>();
    for (const used of input.ricambiUtilizzati) {
      if (used.quantitaUtilizzata <= 0) continue;
      const row = used.rigaId ? rows.find((r) => r.id === used.rigaId) : rows.find((r) => (used.prodottoId && r.prodottoId === used.prodottoId) || (used.ricambioId && r.ricambioId === used.ricambioId));
      if (used.rigaId && !row) throw new Error("Riga materiali non trovata");
      // Un prelievo registrato è già scaricato: non viene ripetuto al completamento.
      if (row && Number(row.quantitaUtilizzata) > 0) throw new Error("Questo materiale è già stato prelevato: non inserirlo nuovamente");
      const prodottoId = row?.prodottoId || used.prodottoId;
      const ricambioId = row?.ricambioId || used.ricambioId;
      const key = prodottoId || ricambioId || used.rigaId || used.nomeRicambio || "manuale";
      if (seen.has(key)) throw new Error("Materiale duplicato nel completamento");
      seen.add(key);
      let costoUnitario = Number(used.costoUnitario || 0);
      let nome = row?.nomeRicambio || used.nomeRicambio;
      let codice = row?.codiceRicambio || used.codiceRicambio;
      if (prodottoId) {
        await tx.execute(sql`SELECT id FROM prodotti WHERE id=${prodottoId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
        const [p] = await tx.select().from(prodotti).where(and(eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt))).limit(1);
        if (!p || Number(p.quantita) < used.quantitaUtilizzata) throw new Error("Giacenza insufficiente o prodotto non disponibile nell’azienda");
        costoUnitario = Number(p.prezzoUnitario || 0); nome = p.nome; codice = p.codice || undefined;
        await tx.update(prodotti).set(withUpdate(actor, { quantita: (Number(p.quantita) - used.quantitaUtilizzata).toFixed(3), ultimoScaricoQuantita: String(used.quantitaUtilizzata), ultimoScaricoAt: new Date() }) as any).where(and(eq(prodotti.id, prodottoId), eq(prodotti.companyId, actor.companyId)));
        await tx.insert(movimentiMagazzino).values(withCreate(actor, { prodottoId, tipo: "scarico", quantita: String(used.quantitaUtilizzata), data: new Date().toISOString().slice(0, 10), dataOra: new Date(), causale: "officina", descrizione: `Completamento ${work.codice || input.id}`, operatore: actor.userUuid }) as any);
      } else if (ricambioId) {
        await tx.execute(sql`SELECT id FROM ricambi WHERE id=${ricambioId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
        const [p] = await tx.select().from(ricambi).where(and(eq(ricambi.id, ricambioId), eq(ricambi.companyId, actor.companyId), isNull(ricambi.deletedAt))).limit(1);
        if (!p || Number(p.quantitaDisponibile) < used.quantitaUtilizzata) throw new Error("Giacenza ricambio insufficiente");
        costoUnitario = Number(p.costoMedio || 0); nome = p.nome; codice = p.codice || undefined;
        await tx.update(ricambi).set(withUpdate(actor, { quantitaDisponibile: (Number(p.quantitaDisponibile) - used.quantitaUtilizzata).toFixed(3) }) as any).where(and(eq(ricambi.id, ricambioId), eq(ricambi.companyId, actor.companyId)));
      } else {
        costoEsterno += costoUnitario * used.quantitaUtilizzata;
      }
      nuoviMateriali += costoUnitario * used.quantitaUtilizzata;
      const patch = { prodottoId: prodottoId || null, ricambioId: ricambioId || null, nomeRicambio: nome, codiceRicambio: codice, quantitaUtilizzata: String(used.quantitaUtilizzata), costoUnitario: String(costoUnitario) };
      if (row) await tx.update(interventoRicambi).set(withUpdate(actor, patch) as any).where(and(eq(interventoRicambi.id, row.id), eq(interventoRicambi.companyId, actor.companyId)));
      else await tx.insert(interventoRicambi).values(withCreate(actor, { ...patch, interventoId: input.id, quantitaRichiesta: String(used.quantitaUtilizzata), obbligatorio: false }) as any);
    }
    const tariffa = input.costoOrario ?? Number(work.costoOrario ?? 35);
    const costs = costiCompletamento(giaPrelevati, nuoviMateriali, input.oreLavoro, tariffa);
    await tx.update(interventi).set(withUpdate(actor, { stato: "completato", dataCompletamento: new Date(), oreLavoro: String(input.oreLavoro), tempoEffettivo: String(input.oreLavoro), costoOrario: String(tariffa), costoRicambi: String(costs.costoRicambi), costoManodopera: String(costs.costoManodopera), costoFinale: String(costs.costoFinale), note: input.note ?? work.note, foto: input.foto ?? work.foto }) as any).where(and(eq(interventi.id, input.id), eq(interventi.companyId, actor.companyId)));
    await tx.execute(sql`SELECT id FROM macchine WHERE id=${work.macchinaId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
    const [machine] = await tx.select().from(macchine).where(and(eq(macchine.id, work.macchinaId), eq(macchine.companyId, actor.companyId), isNull(macchine.deletedAt))).limit(1);
    if (!machine) throw new Error("Mezzo non trovato nell’azienda attiva");
    const otherWork = await tx.select({ id: interventi.id }).from(interventi).where(and(eq(interventi.macchinaId, machine.id), eq(interventi.companyId, actor.companyId), isNull(interventi.deletedAt), sql`${interventi.stato} <> 'completato'`));
    await tx.update(macchine).set(withUpdate(actor, { costoTotale: String(Number(machine.costoTotale || 0) + nuoviMateriali + costs.costoManodopera), ...(work.tipo === "tagliando" || work.tipo === "manutenzione" ? { ultimoTagliando: new Date() } : {}), ...(machine.stato === "manutenzione" && otherWork.length === 0 ? { stato: "operativo" } : {}) }) as any).where(and(eq(macchine.id, machine.id), eq(macchine.companyId, actor.companyId)));
    return { success: true, duplicate: false, ...costs, work, macchina: machine, costoEsterno };
  });
  if (!result.duplicate) {
    // I materiali di magazzino (inclusi prelievi precedenti) sono costo gestionale, non un nuovo acquisto.
    const includiManodopera = await proposalsService.isManodoperaFinanziaria(actor.companyId, "fleet");
    const importo = Math.round((result.costoEsterno + (includiManodopera ? result.costoManodopera : 0)) * 100);
    if (importo > 0) await proposalsService.createOrGetProposal(actor, { tipo: "uscita", importo, descrizione: `Intervento ${result.work.codice || input.id} — costi esterni`, dataOrigine: new Date().toISOString().slice(0, 10), originModule: "fleet", originEntityType: "intervento", originEntityId: input.id, originEventType: "completamento", originReference: result.work.codice || input.id });
    await calendarRepository.insert(actor, { titolo: `Manutenzione: ${result.macchina?.nome || "mezzo"}`, descrizione: result.work.descrizione, tipo: "manutenzione", dataInizio: new Date(), tuttoIlGiorno: true, completato: true, colore: "#4ade80", riferimentoId: input.id, riferimentoTipo: "intervento" });
  }
  return { success: true, duplicate: result.duplicate, costoFinale: result.costoFinale, costoRicambi: result.costoRicambi, costoManodopera: result.costoManodopera };
}
