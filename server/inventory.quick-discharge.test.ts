import { beforeAll, describe, expect, it } from "vitest";
import { inventoryService } from "./domains/inventory/service";
import { scaricoRapidoInput } from "./domains/inventory/validators";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-inventory-quick-${RUN_ID}`;
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: `operatore-${RUN_ID}`,
};

describe.sequential("Magazzino — scarico rapido", () => {
  let productId = "";

  beforeAll(async () => {
    await inventoryService.create(actor, {
      nome: `Detergente rapido ${RUN_ID}`,
      categoria: "Detersivi",
      sottocategoria: "Lavaggio",
      unitaMisura: "L",
      quantita: 25,
      quantitaMinima: 5,
    });
    const product = (await inventoryService.list(COMPANY_ID)).find((row) => row.nome === `Detergente rapido ${RUN_ID}`);
    productId = product?.id ?? "";
  });

  it("registra scarico, audit, causale, note e quantità dell’ultimo utilizzo", async () => {
    expect(productId).not.toBe("");

    const result = await inventoryService.scaricaRapido(actor, {
      prodottoId: productId,
      quantita: 10,
      causale: "Utilizzo in stalla",
      note: "Lavaggio serale",
    });

    expect(Number(result.prodotto.quantita)).toBe(15);
    expect(Number(result.prodotto.ultimoScaricoQuantita)).toBe(10);
    expect(result.prodotto.ultimoScaricoAt).toBeTruthy();

    const product = (await inventoryService.list(COMPANY_ID)).find((row) => row.id === productId);
    const movements = await inventoryService.movimenti(COMPANY_ID, productId);
    expect(Number(product?.quantita)).toBe(15);
    expect(Number(product?.ultimoScaricoQuantita)).toBe(10);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      tipo: "scarico",
      causale: "Utilizzo in stalla",
      note: "Lavaggio serale",
      operatore: actor.userUuid,
    });
    expect(Number(movements[0]?.quantita)).toBe(10);
    expect(movements[0]?.dataOra).toBeTruthy();
  });

  it("impedisce quantità nulle, negative e superiori alla disponibilità", async () => {
    expect(() => scaricoRapidoInput.parse({ prodottoId: productId, quantita: 0 })).toThrow();
    expect(() => scaricoRapidoInput.parse({ prodottoId: productId, quantita: -1 })).toThrow();

    await expect(inventoryService.scaricaRapido(actor, { prodottoId: productId, quantita: 15.001 }))
      .rejects.toThrow("Quantità non disponibile");
    const product = (await inventoryService.list(COMPANY_ID)).find((row) => row.id === productId);
    expect(Number(product?.quantita)).toBe(15);
  });

  it("isola i prodotti di un’altra azienda", async () => {
    await expect(inventoryService.scaricaRapido({ ...actor, companyId: `${COMPANY_ID}-other` }, {
      prodottoId: productId,
      quantita: 1,
    })).rejects.toThrow("Prodotto non trovato");
  });
});
