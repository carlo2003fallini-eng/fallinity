import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { interventi, movimentiMagazzino, prelieviOfficina, prodotti } from "../drizzle/schema";
import { fleetService } from "./domains/fleet/service";
import { operatorService } from "./domains/fleet/operator";
import { inventoryService } from "./domains/inventory/service";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-operator-menu-${RUN_ID}`;
const actor: ActorContext = { companyId: COMPANY_ID, userId: 1, userUuid: `operatore-${RUN_ID}` };

describe.sequential("Menù operatore — integrazione Magazzino", () => {
  let prodottoId = "";
  let macchinaId = "";

  beforeAll(async () => {
    await inventoryService.create(actor, {
      nome: `Filtro operatore ${RUN_ID}`,
      codice: `OP-FILTRO-${RUN_ID}`,
      categoria: "Pezzi di ricambio",
      reparto: "Motore",
      famiglia: "Filtri",
      sottocategoria: "Olio",
      unitaMisura: "pz",
      quantita: 5,
      quantitaMinima: 1,
      prezzoUnitario: 12,
    });
    prodottoId = (await inventoryService.list(COMPANY_ID)).find((row) => row.codice === `OP-FILTRO-${RUN_ID}`)?.id ?? "";

    await fleetService.createMacchina(actor, {
      nome: `Trattore operatore ${RUN_ID}`,
      categoria: "Trattori",
      stato: "operativo",
    });
    macchinaId = (await fleetService.listMacchine(COMPANY_ID)).find((row) => row.nome === `Trattore operatore ${RUN_ID}`)?.id ?? "";
  });

  it("scarica dal Magazzino, registra movimento, intervento e prelievo storico", async () => {
    const result = await operatorService.confermaPrelievo(actor, {
      idempotencyKey: `operator-integration-${RUN_ID}`,
      macchinaId,
      nuovoIntervento: { descrizione: "Sostituzione filtro olio", tipo: "manutenzione" },
      righe: [{ ricambioId: prodottoId, quantita: 2 }],
    });

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.interventoId).toBeTruthy();

    const db = await getDb();
    expect(db).toBeTruthy();
    const [product] = await db!.select().from(prodotti).where(and(eq(prodotti.id, prodottoId), eq(prodotti.companyId, COMPANY_ID)));
    const movements = await db!.select().from(movimentiMagazzino).where(and(eq(movimentiMagazzino.prodottoId, prodottoId), eq(movimentiMagazzino.companyId, COMPANY_ID)));
    const withdrawals = await db!.select().from(prelieviOfficina).where(and(eq(prelieviOfficina.companyId, COMPANY_ID), eq(prelieviOfficina.idempotencyKey, `operator-integration-${RUN_ID}`)));
    const work = await fleetService.listInterventi(COMPANY_ID, { macchinaId });

    expect(Number(product?.quantita)).toBe(3);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ tipo: "scarico", causale: "officina", operatore: actor.userUuid });
    expect(withdrawals).toHaveLength(1);
    expect(withdrawals[0]?.interventoId).toBe(result.interventoId);
    expect(work.find((item) => item.id === result.interventoId)?.descrizione).toBe("Sostituzione filtro olio");
  });

  it("rende idempotente il retry e non crea una seconda spesa o movimento", async () => {
    const input = {
      idempotencyKey: `operator-integration-${RUN_ID}`,
      macchinaId,
      righe: [{ ricambioId: prodottoId, quantita: 2 }],
    } as const;
    const result = await operatorService.confermaPrelievo(actor, input);
    expect(result.duplicate).toBe(true);

    const db = await getDb();
    const movements = await db!.select().from(movimentiMagazzino).where(and(eq(movimentiMagazzino.prodottoId, prodottoId), eq(movimentiMagazzino.companyId, COMPANY_ID)));
    const withdrawals = await db!.select().from(prelieviOfficina).where(eq(prelieviOfficina.companyId, COMPANY_ID));
    expect(movements).toHaveLength(1);
    expect(withdrawals).toHaveLength(1);
  });

  it("fa rollback su giacenza insufficiente senza lasciare interventi o movimenti", async () => {
    await expect(operatorService.confermaPrelievo(actor, {
      idempotencyKey: `operator-rollback-${RUN_ID}`,
      macchinaId,
      nuovoIntervento: { descrizione: "Intervento che deve fare rollback", tipo: "riparazione" },
      righe: [{ ricambioId: prodottoId, quantita: 99 }],
    })).rejects.toThrow("Giacenza insufficiente");

    const db = await getDb();
    const [product] = await db!.select().from(prodotti).where(eq(prodotti.id, prodottoId));
    const movements = await db!.select().from(movimentiMagazzino).where(and(eq(movimentiMagazzino.prodottoId, prodottoId), eq(movimentiMagazzino.companyId, COMPANY_ID)));
    const withdrawals = await db!.select().from(prelieviOfficina).where(eq(prelieviOfficina.companyId, COMPANY_ID));
    const work = await db!.select().from(interventi).where(and(eq(interventi.companyId, COMPANY_ID), eq(interventi.descrizione, "Intervento che deve fare rollback")));

    expect(Number(product?.quantita)).toBe(3);
    expect(movements).toHaveLength(1);
    expect(withdrawals).toHaveLength(1);
    expect(work).toHaveLength(0);
  });

  it("isola il prodotto per azienda", async () => {
    await expect(operatorService.confermaPrelievo({ ...actor, companyId: `${COMPANY_ID}-other` }, {
      idempotencyKey: `operator-isolation-${RUN_ID}`,
      macchinaId,
      righe: [{ ricambioId: prodottoId, quantita: 1 }],
    })).rejects.toThrow("Mezzo non trovato");
  });
});
