import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-mov-actions-${RUN_ID}`;
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: `user-${RUN_ID}`,
};

describe.sequential("Finance — modifica ed eliminazione movimenti", () => {
  let categoriaEntrataId = "";
  let categoriaUscitaId = "";
  let contoId = "";

  beforeAll(async () => {
    categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Entrate azioni ${RUN_ID}`,
      tipo: "entrata",
    })).id;
    categoriaUscitaId = (await financeService.createCategoria(actor, {
      nome: `Uscite azioni ${RUN_ID}`,
      tipo: "uscita",
    })).id;
    contoId = (await financeService.createConto(actor, {
      nome: `Conto azioni ${RUN_ID}`,
      tipo: "bancario",
      saldoIniziale: 100_000,
      valuta: "EUR",
    })).id;
  });

  it("modifica importi e scadenza di un movimento non regolato", async () => {
    const created = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 10_000,
      aliquotaIva: 2_200,
      importoIva: 2_200,
      totale: 12_200,
      dataDocumento: "2026-08-01",
      dataScadenza: "2026-09-01",
      categoriaId: categoriaUscitaId,
      descrizione: `Prima modifica ${RUN_ID}`,
    });

    const updated = await financeService.modificaMovimento(actor, created.documentoId, {
      imponibile: 20_000,
      aliquotaIva: 2_200,
      importoIva: 4_400,
      totale: 24_400,
      dataScadenza: "2026-10-15",
      descrizione: `Dopo modifica ${RUN_ID}`,
    });

    expect(updated?.totale).toBe(24_400);
    expect(updated?.residuo).toBe(24_400);
    expect(updated?.descrizione).toContain("Dopo modifica");
    expect(new Date(updated?.scadenze[0]?.dataScadenza ?? "").toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("blocca la modifica degli importi dopo un incasso", async () => {
    const created = await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "pagato_subito",
      imponibile: 10_000,
      aliquotaIva: 2_200,
      importoIva: 2_200,
      totale: 12_200,
      dataDocumento: "2026-08-10",
      categoriaId: categoriaEntrataId,
      contoId,
      descrizione: `Incasso protetto ${RUN_ID}`,
    });

    await expect(financeService.modificaMovimento(actor, created.documentoId, {
      imponibile: 20_000,
      importoIva: 4_400,
      totale: 24_400,
    })).rejects.toThrow("Gli importi non sono modificabili");
  });

  it("elimina un movimento regolato creando lo storno del saldo", async () => {
    const accountsBefore = await financeService.listConti(COMPANY_ID);
    const saldoPrima = accountsBefore.find((account) => account.id === contoId)?.saldoAttuale ?? 0;

    const created = await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "pagato_subito",
      imponibile: 5_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 5_000,
      dataDocumento: "2026-08-15",
      categoriaId: categoriaEntrataId,
      contoId,
      descrizione: `Entrata da eliminare ${RUN_ID}`,
    });

    const result = await financeService.deleteMovimento(actor, created.documentoId, "Errore di inserimento");
    const accountsAfter = await financeService.listConti(COMPANY_ID);
    const saldoDopo = accountsAfter.find((account) => account.id === contoId)?.saldoAttuale ?? 0;

    expect(result.storniCreati).toBe(1);
    expect(saldoDopo).toBe(saldoPrima);
    expect(await financeService.dettaglioMovimento(COMPANY_ID, created.documentoId)).toBeNull();
  });

  it("impedisce modifica ed eliminazione da un’altra azienda", async () => {
    const created = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 1_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 1_000,
      dataDocumento: "2026-08-20",
      categoriaId: categoriaUscitaId,
      descrizione: `Isolamento ${RUN_ID}`,
    });
    const otherActor = { ...actor, companyId: `${COMPANY_ID}-other` };

    await expect(financeService.modificaMovimento(otherActor, created.documentoId, { descrizione: "Non autorizzato" }))
      .rejects.toThrow("Movimento non trovato");
    await expect(financeService.deleteMovimento(otherActor, created.documentoId))
      .rejects.toThrow("Movimento non trovato");
  });
});
