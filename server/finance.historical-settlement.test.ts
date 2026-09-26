import { beforeAll, describe, expect, it } from "vitest";
import { financeRepository } from "./domains/finance/repository";
import { financeService } from "./domains/finance/service";
import { regolarizzaScadenzeStoricheInput } from "./domains/finance/validators";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `historical-settlement-${RUN_ID}`;
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 61_001,
  userUuid: `historical-settlement-user-${RUN_ID}`,
};

function isoDate(value: string | Date) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

describe.sequential("Finance — regolarizzazione storico alla scadenza finale", () => {
  let categoriaUscitaId = "";
  let categoriaEntrataId = "";
  let contoId = "";
  let metodoId = "";

  beforeAll(async () => {
    categoriaUscitaId = (await financeService.createCategoria(actor, {
      nome: `Uscite storico ${RUN_ID}`,
      tipo: "uscita",
    })).id;
    categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Entrate storico ${RUN_ID}`,
      tipo: "entrata",
    })).id;
    contoId = (await financeService.createConto(actor, {
      nome: `Conto storico ${RUN_ID}`,
      tipo: "bancario",
      saldoIniziale: 200_000,
      valuta: "EUR",
    })).id;
    metodoId = (await financeService.createMetodo(actor, `Bonifico storico ${RUN_ID}`)).id;
  });

  it("propone l'ultima rata aperta e registra ogni saldo alla sua data corretta", async () => {
    const fatturaRateizzata = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 12_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 12_000,
      dataDocumento: "2023-10-01",
      dataScadenza: "2023-10-10",
      categoriaId: categoriaUscitaId,
      descrizione: `Fattura rateizzata ${RUN_ID}`,
    });
    await financeService.creaRate(actor, {
      documentoId: fatturaRateizzata.documentoId,
      numeroRate: 3,
      frequenza: "mensile",
      dataInizio: "2023-10-10",
    });

    const fatturaSingola = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 8_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 8_000,
      dataDocumento: "2024-02-01",
      dataScadenza: "2024-02-20",
      categoriaId: categoriaUscitaId,
      descrizione: `Fattura singola ${RUN_ID}`,
    });

    const proposte = await financeService.listFattureStoricheInScadenza(COMPANY_ID, 50);
    const propostaRateizzata = proposte.find((fattura) => fattura.id === fatturaRateizzata.documentoId);
    const propostaSingola = proposte.find((fattura) => fattura.id === fatturaSingola.documentoId);
    expect(propostaRateizzata).toMatchObject({ scadenzeAperte: 3, scadenzaFinale: "2023-12-10", residuo: 12_000 });
    expect(propostaSingola).toMatchObject({ scadenzeAperte: 1, scadenzaFinale: "2024-02-20", residuo: 8_000 });

    const result = await financeService.regolarizzaScadenzeStoriche(actor, {
      documentoIds: [fatturaSingola.documentoId, fatturaRateizzata.documentoId],
      contoId,
      metodoId,
      riferimento: `STORICO-${RUN_ID}`,
      note: "Inserimento storico guidato",
    });

    expect(result.documentiRegolarizzati).toBe(2);
    expect(result.totale).toBe(20_000);
    expect(result.saldoDopo).toBe(180_000);
    expect(result.pagamenti).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentoId: fatturaRateizzata.documentoId, importo: 12_000, data: "2023-12-10" }),
      expect.objectContaining({ documentoId: fatturaSingola.documentoId, importo: 8_000, data: "2024-02-20" }),
    ]));

    const [dettaglioRateizzato, dettaglioSingolo] = await Promise.all([
      financeService.dettaglioMovimento(COMPANY_ID, fatturaRateizzata.documentoId),
      financeService.dettaglioMovimento(COMPANY_ID, fatturaSingola.documentoId),
    ]);
    expect(dettaglioRateizzato).toMatchObject({ stato: "pagato", totalePagato: 12_000, residuo: 0 });
    expect(dettaglioSingolo).toMatchObject({ stato: "pagato", totalePagato: 8_000, residuo: 0 });
    expect(dettaglioRateizzato?.scadenze.filter((scadenza) => scadenza.stato === "pagata")).toHaveLength(3);
    expect(dettaglioRateizzato?.scadenze.filter((scadenza) => scadenza.stato === "pagata").every((scadenza) => scadenza.residuo === 0)).toBe(true);
    expect(dettaglioRateizzato?.pagamenti).toEqual(expect.arrayContaining([
      expect.objectContaining({ data: expect.anything(), riferimento: `STORICO-${RUN_ID}`, note: "Inserimento storico guidato" }),
    ]));
    expect(isoDate(dettaglioRateizzato?.pagamenti.find((pagamento) => pagamento.riferimento === `STORICO-${RUN_ID}`)?.data as Date)).toBe("2023-12-10");
    expect(isoDate(dettaglioSingolo?.pagamenti.find((pagamento) => pagamento.riferimento === `STORICO-${RUN_ID}`)?.data as Date)).toBe("2024-02-20");

    const conto = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId);
    expect(conto?.saldoAttuale).toBe(180_000);
    const movimentiCassa = await financeRepository.listMovimentiCassa(COMPANY_ID, contoId, 10);
    const storici = movimentiCassa.filter((movimento) => movimento.descrizione?.startsWith("Regolarizzazione storico ·"));
    expect(storici).toHaveLength(2);
    expect(storici.map((movimento) => isoDate(movimento.data))).toEqual(expect.arrayContaining(["2023-12-10", "2024-02-20"]));
    expect(await financeService.listFattureStoricheInScadenza(COMPANY_ID, 50)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: fatturaRateizzata.documentoId }),
      expect.objectContaining({ id: fatturaSingola.documentoId }),
    ]));
  });

  it("incassa le entrate storiche alla loro ultima scadenza e accredita il conto", async () => {
    const entrataRateizzata = await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "documento",
      imponibile: 9_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 9_000,
      dataDocumento: "2024-06-01",
      dataScadenza: "2024-06-10",
      categoriaId: categoriaEntrataId,
      descrizione: `Entrata rateizzata ${RUN_ID}`,
    });
    await financeService.creaRate(actor, {
      documentoId: entrataRateizzata.documentoId,
      numeroRate: 2,
      frequenza: "mensile",
      dataInizio: "2024-06-10",
    });
    const entrataSingola = await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "documento",
      imponibile: 6_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 6_000,
      dataDocumento: "2024-08-01",
      dataScadenza: "2024-08-20",
      categoriaId: categoriaEntrataId,
      descrizione: `Entrata singola ${RUN_ID}`,
    });
    const saldoPrima = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId)?.saldoAttuale ?? 0;

    const proposte = await financeService.listFattureStoricheInScadenza(COMPANY_ID, 50, "entrata");
    expect(proposte.find((documento) => documento.id === entrataRateizzata.documentoId)).toMatchObject({
      scadenzeAperte: 2,
      scadenzaFinale: "2024-07-10",
      residuo: 9_000,
      tipo: "entrata",
    });
    expect(proposte.find((documento) => documento.id === entrataSingola.documentoId)).toMatchObject({
      scadenzaFinale: "2024-08-20",
      residuo: 6_000,
      tipo: "entrata",
    });
    expect(proposte).not.toEqual(expect.arrayContaining([expect.objectContaining({ tipo: "uscita" })]));

    const result = await financeService.regolarizzaScadenzeStoriche(actor, {
      documentoIds: [entrataSingola.documentoId, entrataRateizzata.documentoId],
      tipo: "entrata",
      contoId,
      metodoId,
      riferimento: `INCASSI-${RUN_ID}`,
    });
    expect(result).toMatchObject({ documentiRegolarizzati: 2, totale: 15_000, saldoDopo: saldoPrima + 15_000, tipo: "entrata" });
    expect(result.pagamenti).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentoId: entrataRateizzata.documentoId, importo: 9_000, data: "2024-07-10" }),
      expect.objectContaining({ documentoId: entrataSingola.documentoId, importo: 6_000, data: "2024-08-20" }),
    ]));

    const [dettaglioRateizzato, dettaglioSingolo] = await Promise.all([
      financeService.dettaglioMovimento(COMPANY_ID, entrataRateizzata.documentoId),
      financeService.dettaglioMovimento(COMPANY_ID, entrataSingola.documentoId),
    ]);
    expect(dettaglioRateizzato).toMatchObject({ stato: "incassato", totalePagato: 9_000, residuo: 0 });
    expect(dettaglioSingolo).toMatchObject({ stato: "incassato", totalePagato: 6_000, residuo: 0 });
    expect(dettaglioRateizzato?.scadenze.filter((scadenza) => scadenza.stato === "incassata")).toHaveLength(2);
    expect(isoDate(dettaglioRateizzato?.pagamenti.find((pagamento) => pagamento.riferimento === `INCASSI-${RUN_ID}`)?.data as Date)).toBe("2024-07-10");

    const conto = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId);
    expect(conto?.saldoAttuale).toBe(saldoPrima + 15_000);
    const movimentiCassa = await financeRepository.listMovimentiCassa(COMPANY_ID, contoId, 20);
    const incassi = movimentiCassa.filter((movimento) => movimento.descrizione?.startsWith("Incasso storico ·"));
    expect(incassi).toHaveLength(2);
    expect(incassi.every((movimento) => movimento.tipo === "entrata")).toBe(true);
    expect(incassi.map((movimento) => isoDate(movimento.data))).toEqual(expect.arrayContaining(["2024-07-10", "2024-08-20"]));
  });

  it("non registra alcuna fattura se la selezione contiene un documento già chiuso", async () => {
    const aperta = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 7_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 7_000,
      dataDocumento: "2024-04-01",
      dataScadenza: "2024-04-30",
      categoriaId: categoriaUscitaId,
      descrizione: `Fattura da proteggere ${RUN_ID}`,
    });
    const chiusa = await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "pagato_subito",
      imponibile: 3_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 3_000,
      dataDocumento: "2024-04-01",
      categoriaId: categoriaUscitaId,
      contoId,
      descrizione: `Fattura già chiusa ${RUN_ID}`,
    });
    const saldoPrima = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId)?.saldoAttuale;

    await expect(financeService.regolarizzaScadenzeStoriche(actor, {
      documentoIds: [aperta.documentoId, chiusa.documentoId],
      contoId,
    })).rejects.toThrow("non ha più un residuo da regolarizzare");

    const dettaglio = await financeService.dettaglioMovimento(COMPANY_ID, aperta.documentoId);
    const saldoDopo = (await financeService.listConti(COMPANY_ID)).find((item) => item.id === contoId)?.saldoAttuale;
    expect(dettaglio).toMatchObject({ stato: "registrato", totalePagato: 0, residuo: 7_000 });
    expect(dettaglio?.pagamenti).toHaveLength(0);
    expect(saldoDopo).toBe(saldoPrima);
  });

  it("valida il conto e impedisce documenti duplicati nella richiesta", () => {
    expect(() => regolarizzaScadenzeStoricheInput.parse({
      documentoIds: ["fattura-1", "fattura-1"],
      contoId: "conto-1",
    })).toThrow("Ogni fattura può essere selezionata una sola volta");
    expect(() => regolarizzaScadenzeStoricheInput.parse({ documentoIds: ["fattura-1"], contoId: "" })).toThrow();
  });
});
