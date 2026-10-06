import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-overdue-${RUN_ID}`;
const actor: ActorContext = { companyId: COMPANY_ID, userId: 1, userUuid: `user-${RUN_ID}` };

describe.sequential("Finance — movimenti scaduti", () => {
  let categoriaId = "";

  beforeAll(async () => {
    categoriaId = (await financeService.createCategoria(actor, {
      nome: `Uscite scadute ${RUN_ID}`,
      tipo: "uscita",
    })).id;
  });

  it("restituisce i documenti con scadenza aperta precedente a oggi anche se il documento è ancora registrato", async () => {
    const created = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 10_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 10_000,
      dataDocumento: "2026-01-10",
      dataScadenza: "2026-01-11",
      categoriaId,
      descrizione: `Fattura scaduta ${RUN_ID}`,
    });

    const scaduti = await financeService.listMovimenti(COMPANY_ID, { scaduti: true });
    const trovato = (scaduti as any[]).find((movimento) => movimento.id === created.documentoId);

    expect(trovato).toBeTruthy();
    expect(trovato.scadenzaData).toContain("2026-01-11");
    expect(trovato.residuo).toBe(10_000);
  });
});
