import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  companies, users, macchine, macchinaDocumenti, interventi, interventoRicambi, ricambi, prodotti,
  movimentiMagazzino, prelieviOfficina, eventi, proposteFinanziarie, integrationSettings, domainEvents,
} from "../drizzle/schema";
import { withCreate, type ActorContext } from "./domains/_core";
import { fleetService } from "./domains/fleet/service";
import { inventoryRepository } from "./domains/inventory/repository";
import { operatorService } from "./domains/fleet/operator";
import { sharedPartsService } from "./domains/fleet/sharedParts";
import { completaInterventoAtomico } from "./domains/fleet/completion";
import { completaInterventoInput, confermaPrelievoInput, createRicambioInput } from "./domains/fleet/validators";

// Nessun dato demo/reale: tutte le query e cancellazioni sono vincolate ai due UUID
// generati da questa suite. Le fixture di ogni test hanno ID distinti.
const COMPANY_ID = randomUUID();
const OTHER_COMPANY_ID = randomUUID();
const USER_UUID = randomUUID();
const COMPANY_IDS = [COMPANY_ID, OTHER_COMPANY_ID];
const UNIT_COST = 12.5;
const INITIAL_QUANTITY = 4;
const INITIAL_MACHINE_COST = 100;
let actor: ActorContext = { companyId: COMPANY_ID, userId: 0, userUuid: USER_UUID };
let otherActor: ActorContext = { ...actor, companyId: OTHER_COMPANY_ID };
let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
let macchinaId = "";
let otherMacchinaId = "";
let prodottoId = "";
let otherProdottoId = "";
let codice = "";

async function product(id = prodottoId, companyId = COMPANY_ID) {
  const [row] = await db.select().from(prodotti).where(and(eq(prodotti.id, id), eq(prodotti.companyId, companyId)));
  expect(row).toBeTruthy();
  return row;
}

async function machine(id = macchinaId, companyId = COMPANY_ID) {
  const [row] = await db.select().from(macchine).where(and(eq(macchine.id, id), eq(macchine.companyId, companyId)));
  expect(row).toBeTruthy();
  return row;
}

async function movements(id = prodottoId) {
  return db.select().from(movimentiMagazzino).where(and(eq(movimentiMagazzino.prodottoId, id), eq(movimentiMagazzino.companyId, COMPANY_ID)));
}

async function materialRows(workId: string) {
  return db.select().from(interventoRicambi).where(and(eq(interventoRicambi.interventoId, workId), eq(interventoRicambi.companyId, COMPANY_ID)));
}

async function work(workId: string) {
  const [row] = await db.select().from(interventi).where(and(eq(interventi.id, workId), eq(interventi.companyId, COMPANY_ID)));
  expect(row).toBeTruthy();
  return row;
}

function withdrawalInput(quantity = 2) {
  return confermaPrelievoInput.parse({
    idempotencyKey: `f96-${randomUUID()}`, macchinaId,
    nuovoIntervento: { descrizione: "F96 sostituzione filtro test", tipo: "manutenzione" },
    righe: [{ ricambioId: prodottoId, quantita: quantity }],
  });
}

async function withdrawal(quantity = 2) {
  const result = await operatorService.confermaPrelievo(actor, withdrawalInput(quantity));
  expect(result.duplicate).toBe(false);
  expect(result.interventoId).toBeTruthy();
  return { ...result, interventoId: result.interventoId! };
}

async function completedEvents(workId: string) {
  return db.select().from(eventi).where(and(eq(eventi.companyId, COMPANY_ID), eq(eventi.riferimentoId, workId)));
}

async function proposals() {
  return db.select().from(proposteFinanziarie).where(eq(proposteFinanziarie.companyId, COMPANY_ID));
}

const cleanupTables = [
  eventi, domainEvents, proposteFinanziarie, prelieviOfficina, interventoRicambi,
  movimentiMagazzino, macchinaDocumenti, interventi, ricambi, prodotti, macchine, integrationSettings,
] as const;

describe.sequential("F96 — ricambi condivisi / prelievo / completamento con tenant temporanei", () => {
  beforeAll(async () => {
    const connection = await getDb();
    if (!connection) throw new Error("F96 integrazione richiede DATABASE_URL: test non simulato e non saltato");
    db = connection;
    // Il cleanup è registrato in afterAll anche se il setup fallisce parzialmente.
    await db.insert(companies).values(COMPANY_IDS.map((id) => ({ id, name: `TEST F96 ${id}`, createdBy: USER_UUID, updatedBy: USER_UUID })));
    const [user] = await db.insert(users).values({ uuid: USER_UUID, openId: `f96-${USER_UUID}`, name: "TEST F96 operatore", platformRole: "operator", activeCompanyId: COMPANY_ID }).$returningId();
    actor = { ...actor, userId: user.id };
    otherActor = { ...actor, companyId: OTHER_COMPANY_ID };
    await db.insert(integrationSettings).values(withCreate(actor, { modulo: "fleet", automazione: "proposta_auto", manodoperaInternaMode: "gestionale" }));
  }, 30_000);

  beforeEach(async () => {
    macchinaId = randomUUID();
    otherMacchinaId = randomUUID();
    codice = `F96-${randomUUID()}`;
    await db.insert(macchine).values([
      withCreate(actor, { id: macchinaId, nome: `TEST F96 mezzo ${macchinaId}`, codice: `F96-${macchinaId}`, categoria: "Trattori", stato: "manutenzione" as const, costoTotale: String(INITIAL_MACHINE_COST) }),
      withCreate(otherActor, { id: otherMacchinaId, nome: `TEST F96 altro mezzo ${otherMacchinaId}`, categoria: "Trattori", stato: "operativo" as const, costoTotale: "0" }),
    ]);
    const input = createRicambioInput.parse({ codice, nome: `TEST F96 filtro ${codice}`, categoria: "Filtri olio", reparto: "Motore", famiglia: "Filtri", sottocategoria: "Olio", quantitaDisponibile: INITIAL_QUANTITY, sogliaMinima: 1, costoMedio: UNIT_COST, fornitore: "TEST F96 fornitore", posizione: "TEST F96 scaffale" });
    prodottoId = (await sharedPartsService.create(actor, input)).id;
    // Stesso codice ammesso in un'azienda distinta: verificare anche il controllo duplicati tenant-scoped.
    otherProdottoId = (await sharedPartsService.create(otherActor, { ...input, nome: `TEST F96 altro filtro ${codice}` })).id;
  }, 30_000);

  afterAll(async () => {
    if (!db) return;
    const failures: unknown[] = [];
    // Continua a pulire le altre tabelle anche in presenza di un errore, poi fallisce.
    for (const table of cleanupTables) {
      try { await db.delete(table).where(inArray(table.companyId, COMPANY_IDS)); }
      catch (error) { failures.push(error); }
    }
    try { await db.delete(users).where(eq(users.uuid, USER_UUID)); } catch (error) { failures.push(error); }
    try { await db.delete(companies).where(inArray(companies.id, COMPANY_IDS)); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, "F96 cleanup incompleto");
    for (const table of cleanupTables) {
      const rows = await db.select({ id: table.id }).from(table).where(inArray(table.companyId, COMPANY_IDS));
      expect(rows, "F96 cleanup deve eliminare tutti i record, anche soft-deleted").toHaveLength(0);
    }
    expect(await db.select({ id: companies.id }).from(companies).where(inArray(companies.id, COMPANY_IDS))).toHaveLength(0);
    expect(await db.select({ id: users.id }).from(users).where(eq(users.uuid, USER_UUID))).toHaveLength(0);
  }, 30_000);

  it("crea il ricambio solo in prodotti, con metadata, carico iniziale e nessuna nuova spesa", async () => {
    const saved = await product();
    expect(saved).toMatchObject({ companyId: COMPANY_ID, categoria: "Ricambi", reparto: "Motore", famiglia: "Filtri", sottocategoria: "Olio", fornitore: "TEST F96 fornitore", posizione: "TEST F96 scaffale", unitaMisura: "pz", createdBy: USER_UUID });
    expect(Number(saved.quantita)).toBe(INITIAL_QUANTITY);
    expect(Number(saved.prezzoUnitario)).toBe(UNIT_COST);
    expect(await db.select().from(ricambi).where(and(eq(ricambi.companyId, COMPANY_ID), eq(ricambi.codice, codice)))).toHaveLength(0);
    expect(await inventoryRepository.getProdotto(COMPANY_ID, prodottoId)).toMatchObject({ id: prodottoId, codice });
    const listed = (await fleetService.listRicambi(COMPANY_ID)).find((row) => row.id === prodottoId);
    expect(listed).toMatchObject({ source: "magazzino", statoScorta: "disponibile" });
    expect(Number(listed?.costoMedio)).toBe(UNIT_COST);
    const rows = await movements();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tipo: "carico", causale: "giacenza_iniziale", operatore: USER_UUID });
    expect(Number(rows[0].quantita)).toBe(INITIAL_QUANTITY);
    expect(await proposals()).toHaveLength(0);
  });

  it("rifiuta codici duplicati normalizzati nell'azienda senza nuovi record", async () => {
    await expect(sharedPartsService.create(actor, createRicambioInput.parse({ nome: "TEST F96 duplicato", codice: ` ${codice.toLowerCase()} `, quantitaDisponibile: 1 })))
      .rejects.toThrow("Questo codice esiste già");
    const rows = await db.select().from(prodotti).where(and(eq(prodotti.companyId, COMPANY_ID), eq(prodotti.codice, codice)));
    expect(rows).toHaveLength(1);
    expect(await movements()).toHaveLength(1);
  });

  it("prelievo scala una volta, registra materiale usato e attribuisce subito il costo macchina; retry invariato", async () => {
    const input = withdrawalInput();
    const first = await operatorService.confermaPrelievo(actor, input);
    const retry = await operatorService.confermaPrelievo(actor, input);
    expect(first).toMatchObject({ success: true, duplicate: false, costoTotale: UNIT_COST * 2 });
    expect(retry).toMatchObject({ success: true, duplicate: true, prelievoId: first.prelievoId, costoTotale: UNIT_COST * 2 });
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY - 2);
    const rows = await movements();
    expect(rows).toHaveLength(2); // un carico iniziale + un solo scarico
    expect(rows.filter((row) => row.tipo === "scarico")).toHaveLength(1);
    expect(rows.find((row) => row.tipo === "scarico")).toMatchObject({ causale: "officina", operatore: USER_UUID, note: input.idempotencyKey });
    const history = await db.select().from(prelieviOfficina).where(and(eq(prelieviOfficina.companyId, COMPANY_ID), eq(prelieviOfficina.idempotencyKey, input.idempotencyKey)));
    expect(history).toHaveLength(1);
    expect(history[0].righe).toEqual([expect.objectContaining({ prodottoId, quantita: 2, costoUnitario: UNIT_COST, totale: UNIT_COST * 2 })]);
    const materials = await materialRows(first.interventoId!);
    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({ prodottoId, ricambioId: null, obbligatorio: false });
    expect(Number(materials[0].quantitaUtilizzata)).toBe(2);
    expect(Number(materials[0].costoUnitario)).toBe(UNIT_COST);
    expect(Number((await work(first.interventoId!)).costoRicambi)).toBe(UNIT_COST * 2);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST + UNIT_COST * 2);
    expect(await proposals()).toHaveLength(0);
  });

  it("retry concorrenti della stessa chiave producono un solo prelievo e un solo addebito", async () => {
    const input = withdrawalInput();
    // allSettled garantisce che nessuna transazione rimanga attiva al cleanup se una fallisce.
    const settled = await Promise.allSettled([operatorService.confermaPrelievo(actor, input), operatorService.confermaPrelievo(actor, input)]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const results = settled.map((result) => { if (result.status === "rejected") throw result.reason; return result.value; });
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect(results[0].prelievoId).toBe(results[1].prelievoId);
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY - 2);
    expect((await movements()).filter((row) => row.tipo === "scarico")).toHaveLength(1);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST + UNIT_COST * 2);
  }, 30_000);

  it("ricambio esaurito resta nella lista e nello storico usato ma scompare solo dal catalogo operatore", async () => {
    const taken = await withdrawal(INITIAL_QUANTITY);
    expect(Number((await product()).quantita)).toBe(0);
    expect((await operatorService.catalogo(COMPANY_ID)).articoli.some((row) => row.id === prodottoId)).toBe(false);
    expect((await fleetService.listRicambi(COMPANY_ID)).find((row) => row.id === prodottoId)).toMatchObject({ source: "magazzino", statoScorta: "non_disponibile" });
    expect((await fleetService.listRicambi(COMPANY_ID, { filtro: "non_disponibili" })).some((row) => row.id === prodottoId)).toBe(true);
    const detail = await fleetService.interventoDetail(COMPANY_ID, taken.interventoId);
    const material = detail?.ricambiNecessari.find((row) => row.prodottoId === prodottoId);
    expect(material).toBeTruthy();
    expect(Number(material?.quantitaUtilizzata)).toBe(INITIAL_QUANTITY);
    expect(Number(material?.costoUnitario)).toBe(UNIT_COST);
    expect(detail?.prontoPerCompletamento).toBe(true);
    // Stato storico: una riga già scaricata è usata, non un fabbisogno non disponibile.
    expect(material?.statoDisponibilita).toBe("usato");
  });

  it("nuovo ricambio a zero è elencato senza carico iniziale e senza comparire nel catalogo", async () => {
    const { id } = await sharedPartsService.create(actor, createRicambioInput.parse({ nome: `TEST F96 esaurito ${randomUUID()}`, famiglia: "Filtri", quantitaDisponibile: 0 }));
    expect((await fleetService.listRicambi(COMPANY_ID)).find((row) => row.id === id)).toMatchObject({ source: "magazzino", statoScorta: "non_disponibile" });
    expect((await operatorService.catalogo(COMPANY_ID)).articoli.some((row) => row.id === id)).toBe(false);
    expect(await movements(id)).toHaveLength(0);
  });

  it("completa senza ricambi extra conserva costo e righe usate, senza nuovo scarico né doppio addebito macchina", async () => {
    const taken = await withdrawal();
    const rowsBefore = await materialRows(taken.interventoId);
    const movementIdsBefore = (await movements()).map((row) => row.id).sort();
    const result = await completaInterventoAtomico(actor, completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 2, costoOrario: 35 }));
    expect(result).toEqual({ success: true, duplicate: false, costoRicambi: UNIT_COST * 2, costoManodopera: 2 * 35, costoFinale: UNIT_COST * 2 + 2 * 35 });
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY - 2);
    expect((await movements()).map((row) => row.id).sort()).toEqual(movementIdsBefore);
    expect(await materialRows(taken.interventoId)).toEqual(rowsBefore);
    const savedWork = await work(taken.interventoId);
    expect(savedWork.stato).toBe("completato");
    expect(Number(savedWork.costoRicambi)).toBe(UNIT_COST * 2);
    expect(Number(savedWork.costoFinale)).toBe(UNIT_COST * 2 + 2 * 35);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST + UNIT_COST * 2 + 2 * 35);
    expect((await machine()).stato).toBe("operativo");
    expect(await completedEvents(taken.interventoId)).toHaveLength(1);
    expect(await proposals()).toHaveLength(0);
  });

  it("retry completamento non cambia costo macchina, costo intervento, materiali, movimenti o calendario", async () => {
    const taken = await withdrawal();
    const input = completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 2, costoOrario: 35 });
    const first = await fleetService.completaIntervento(actor, input);
    const machineBefore = await machine();
    const workBefore = await work(taken.interventoId);
    const rowsBefore = await materialRows(taken.interventoId);
    const movesBefore = (await movements()).map((row) => row.id).sort();
    const retry = await fleetService.completaIntervento(actor, { ...input, oreLavoro: 99, costoOrario: 999 });
    expect(retry).toEqual({ ...first, duplicate: true });
    expect(await machine()).toEqual(machineBefore);
    expect(await work(taken.interventoId)).toEqual(workBefore);
    expect(await materialRows(taken.interventoId)).toEqual(rowsBefore);
    expect((await movements()).map((row) => row.id).sort()).toEqual(movesBefore);
    expect(await completedEvents(taken.interventoId)).toHaveLength(1);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST + UNIT_COST * 2 + 2 * 35);
  });

  it("completamento con nuovi materiali aggiunge solo extra e manodopera al costo già attribuito", async () => {
    const taken = await withdrawal();
    const { id: extraId } = await sharedPartsService.create(actor, createRicambioInput.parse({ nome: `TEST F96 extra ${randomUUID()}`, famiglia: "Fusibili", quantitaDisponibile: 3, costoMedio: 5 }));
    const result = await completaInterventoAtomico(actor, completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 1, costoOrario: 40,
      ricambiUtilizzati: [{ prodottoId: extraId, quantitaUtilizzata: 1, costoUnitario: 999 }] }));
    expect(result.costoRicambi).toBe(UNIT_COST * 2 + 5); // costo DB, mai il costo arbitrario inviato dal client
    expect(result.costoFinale).toBe(UNIT_COST * 2 + 5 + 40);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST + UNIT_COST * 2 + 5 + 40);
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY - 2);
    expect(Number((await product(extraId)).quantita)).toBe(2);
    expect((await movements()).filter((row) => row.tipo === "scarico")).toHaveLength(1);
    expect((await movements(extraId)).filter((row) => row.tipo === "scarico")).toHaveLength(1);
    const material = (await materialRows(taken.interventoId)).find((row) => row.prodottoId === prodottoId);
    expect(Number(material?.quantitaUtilizzata)).toBe(2);
    expect(await proposals()).toHaveLength(0);
  });

  it("rifiuta il reinserimento al completamento di un materiale già prelevato senza alterare stato o costi", async () => {
    const taken = await withdrawal();
    const rows = await materialRows(taken.interventoId);
    const machineBefore = await machine();
    await expect(completaInterventoAtomico(actor, completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 1,
      ricambiUtilizzati: [{ rigaId: rows[0].id, prodottoId, quantitaUtilizzata: 2 }] }))).rejects.toThrow("già stato prelevato");
    expect((await work(taken.interventoId)).stato).toBe("in_corso");
    expect(await machine()).toEqual(machineBefore);
    expect(await materialRows(taken.interventoId)).toEqual(rows);
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY - 2);
    expect((await movements()).filter((row) => row.tipo === "scarico")).toHaveLength(1);
    expect(await completedEvents(taken.interventoId)).toHaveLength(0);
  });

  it("rollback su giacenza insufficiente non lascia intervento, prelievo, scarico o incremento costo macchina", async () => {
    const input = withdrawalInput(INITIAL_QUANTITY + 1);
    const beforeMachine = await machine();
    await expect(operatorService.confermaPrelievo(actor, input)).rejects.toThrow("Giacenza insufficiente");
    expect(Number((await product()).quantita)).toBe(INITIAL_QUANTITY);
    expect(await machine()).toEqual(beforeMachine);
    expect((await movements()).filter((row) => row.tipo === "scarico")).toHaveLength(0);
    expect(await db.select().from(interventi).where(and(eq(interventi.companyId, COMPANY_ID), eq(interventi.macchinaId, macchinaId)))).toHaveLength(0);
    expect(await db.select().from(prelieviOfficina).where(and(eq(prelieviOfficina.companyId, COMPANY_ID), eq(prelieviOfficina.idempotencyKey, input.idempotencyKey)))).toHaveLength(0);
  });

  it("isola lista, catalogo, letture e mutazioni del ricambio dell'altra azienda", async () => {
    const otherBefore = await product(otherProdottoId, OTHER_COMPANY_ID);
    expect((await fleetService.listRicambi(COMPANY_ID)).some((row) => row.id === otherProdottoId)).toBe(false);
    expect((await fleetService.listRicambi(OTHER_COMPANY_ID)).some((row) => row.id === prodottoId)).toBe(false);
    const catalog = await operatorService.catalogo(COMPANY_ID);
    expect(catalog.articoli.some((row) => row.id === otherProdottoId)).toBe(false);
    expect(catalog.categorie.flatMap((category) => category.mezzi).some((row) => row.id === otherMacchinaId)).toBe(false);
    expect(await inventoryRepository.getProdotto(COMPANY_ID, otherProdottoId)).toBeNull();
    await expect(sharedPartsService.update(actor, { id: otherProdottoId, quantitaDisponibile: 0 })).rejects.toThrow("azienda attiva");
    await expect(sharedPartsService.adjust(actor, otherProdottoId, -1)).rejects.toThrow("Ricambio non trovato");
    await expect(sharedPartsService.order(actor, otherProdottoId, "ordinato")).rejects.toThrow("Ricambio non trovato");
    await expect(sharedPartsService.remove(actor, otherProdottoId)).rejects.toThrow("Ricambio non trovato");
    await expect(operatorService.confermaPrelievo(actor, { ...withdrawalInput(), righe: [{ ricambioId: otherProdottoId, quantita: 1 }] })).rejects.toThrow("azienda attiva");
    await expect(operatorService.confermaPrelievo(actor, { ...withdrawalInput(), macchinaId: otherMacchinaId })).rejects.toThrow("Mezzo non trovato");
    expect(await product(otherProdottoId, OTHER_COMPANY_ID)).toEqual(otherBefore);
    expect(Number((await machine()).costoTotale)).toBe(INITIAL_MACHINE_COST);
  });

  it("altra azienda non può completare un intervento né consumare il prodotto altrui", async () => {
    const taken = await withdrawal();
    expect(await fleetService.interventoDetail(OTHER_COMPANY_ID, taken.interventoId)).toBeNull();
    expect((await operatorService.catalogo(OTHER_COMPANY_ID)).interventiAperti.some((row) => row.id === taken.interventoId)).toBe(false);
    await expect(completaInterventoAtomico(otherActor, completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 1 })))
      .rejects.toThrow("Intervento non trovato nell’azienda attiva");
    expect((await work(taken.interventoId)).stato).toBe("in_corso");
    await expect(completaInterventoAtomico(actor, completaInterventoInput.parse({ id: taken.interventoId, oreLavoro: 1,
      ricambiUtilizzati: [{ prodottoId: otherProdottoId, quantitaUtilizzata: 1 }] }))).rejects.toThrow("non disponibile nell’azienda");
    expect(Number((await product(otherProdottoId, OTHER_COMPANY_ID)).quantita)).toBe(INITIAL_QUANTITY);
    expect((await work(taken.interventoId)).stato).toBe("in_corso");
  });
});
