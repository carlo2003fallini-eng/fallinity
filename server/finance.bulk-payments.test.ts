import { beforeAll, describe, expect, it } from "vitest";
import { financeRepository } from "./domains/finance/repository";
import { financeService } from "./domains/finance/service";
import { registraPagamentiMultipliInput } from "./domains/finance/validators";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `bulk-payment-${RUN_ID}`;
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 60_001,
  userUuid: `bulk-payment-user-${RUN_ID}`,
};

describe.sequential("Finance — pagamento multiplo fatture", () => {
  let categoriaUscitaId = "";
  let categoriaEntrataId = "";
  let contoId = "";
  let metodoId = "";

  beforeAll(async () => {
    categoriaUscitaId = (await financeService.createCategoria(actor, {
      nome: `Uscite pagamento multiplo ${RUN_ID}`,
      tipo: "uscita",
    })).id;
    categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Entrate pagamento multiplo ${RUN_ID}`,
      tipo: "entrata",
    })).id;
    contoId = (await financeService.createConto(actor, {
      nome: `Conto pagamento multiplo ${RUN_ID}`,
      tipo: "bancario",
      saldoIniziale: 100_000,
      valuta: "EUR",
    })).id;
    metodoId = (await financeService.createMetodo(actor, `Bonifico pagamento multiplo ${RUN_ID}`)).id;
  });

  it("salda più fatture, chiude le scadenze e aggiorna il conto in una sola operazione", async () => {
    const prima = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 12_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 12_000,
      dataDocumento: "2026-09-01",
      dataScadenza: "2026-09-30",
      categoriaId: categoriaUscitaId,
      descrizione: `Prima fattura multipla ${RUN_ID}`,
    });
    const seconda = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 30_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 30_000,
      dataDocumento: "2026-09-02",
      dataScadenza: "2026-09-30",
      categoriaId: categoriaUscitaId,
      descrizione: `Seconda fattura multipla ${RUN_ID}`,
    });

    // Pagamento storico senza una rata specifica: il batch deve comunque chiudere la scadenza residua.
    await financeService.registraPagamento(actor, {
      documentoId: seconda.documentoId,
      contoId,
      metodoId,
      importo: 5_000,
      data: "2026-09-10",
    });

    const result = await financeService.registraPagamentiMultipli(actor, {
      documentoIds: [prima.documentoId, seconda.documentoId],
      contoId,
      metodoId,
      data: "2026-09-20",
      riferimento: `BON-${RUN_ID}`,
      note: "Saldo fatture settembre",
    });

    expect(result.documentiPagati).toBe(2);
    expect(result.totale).toBe(37_000);
    expect(result.saldoDopo).toBe(58_000);
    expect(result.pagamenti.map((pagamento) => pagamento.importo)).toEqual([12_000, 25_000]);

    const [dettaglioPrima, dettaglioSeconda] = await Promise.all([
      financeService.dettaglioMovimento(COMPANY_ID, prima.documentoId),
      financeService.dettaglioMovimento(COMPANY_ID, seconda.documentoId),
    ]);
    expect(dettaglioPrima).toMatchObject({ stato: "pagato", totalePagato: 12_000, residuo: 0 });
    expect(dettaglioSeconda).toMatchObject({ stato: "pagato", totalePagato: 30_000, residuo: 0 });
    expect(dettaglioPrima?.scadenze).toEqual(expect.arrayContaining([
      expect.objectContaining({ stato: "pagata", residuo: 0, importoPagato: 12_000 }),
    ]));
    expect(dettaglioSeconda?.scadenze).toEqual(expect.arrayContaining([
      expect.objectContaining({ stato: "pagata", residuo: 0, importoPagato: 30_000 }),
    ]));
    expect(dettaglioPrima?.pagamenti).toEqual(expect.arrayContaining([
      expect.objectContaining({ importo: 12_000, riferimento: `BON-${RUN_ID}`, note: "Saldo fatture settembre", stato: "confermato" }),
    ]));
    expect(dettaglioSeconda?.pagamenti).toEqual(expect.arrayContaining([
      expect.objectContaining({ importo: 25_000, riferimento: `BON-${RUN_ID}`, note: "Saldo fatture settembre", stato: "confermato" }),
    ]));

    const conto = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId);
    expect(conto?.saldoAttuale).toBe(58_000);
    const movimentiCassa = await financeRepository.listMovimentiCassa(COMPANY_ID, contoId, 10);
    expect(movimentiCassa.filter((movimento) => movimento.descrizione?.startsWith("Pagamento multiplo ·"))).toHaveLength(2);
  });

  it("non registra nulla se anche una sola selezione non è una fattura pagabile", async () => {
    const fatturaAperta = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 7_500,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 7_500,
      dataDocumento: "2026-10-01",
      categoriaId: categoriaUscitaId,
      descrizione: `Fattura da proteggere ${RUN_ID}`,
    });
    const entrata = await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "documento",
      imponibile: 4_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 4_000,
      dataDocumento: "2026-10-01",
      categoriaId: categoriaEntrataId,
      descrizione: `Entrata non pagabile ${RUN_ID}`,
    });
    const saldoPrima = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId)?.saldoAttuale;

    await expect(financeService.registraPagamentiMultipli(actor, {
      documentoIds: [fatturaAperta.documentoId, entrata.documentoId],
      contoId,
      data: "2026-10-05",
    })).rejects.toThrow("Una o più fatture non sono disponibili");

    const dettaglio = await financeService.dettaglioMovimento(COMPANY_ID, fatturaAperta.documentoId);
    const saldoDopo = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId)?.saldoAttuale;
    expect(dettaglio).toMatchObject({ stato: "registrato", totalePagato: 0, residuo: 7_500 });
    expect(dettaglio?.pagamenti).toHaveLength(0);
    expect(saldoDopo).toBe(saldoPrima);
  });

  it("rifiuta nell'API input duplicati e selezioni inferiori a due fatture", () => {
    expect(() => registraPagamentiMultipliInput.parse({
      documentoIds: ["fattura-1", "fattura-1"],
      contoId: "conto-1",
      data: "2026-10-06",
    })).toThrow("Ogni fattura può essere selezionata una sola volta");
    expect(() => registraPagamentiMultipliInput.parse({
      documentoIds: ["fattura-1"],
      contoId: "conto-1",
      data: "2026-10-06",
    })).toThrow();
  });
});
