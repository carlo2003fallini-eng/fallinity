import { beforeAll, describe, expect, it } from "vitest";
import { dashboardSummary, dashboardTrend } from "./domains/finance/dashboard";
import { financeService } from "./domains/finance/service";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `dashboard-accuracy-${RUN_ID}`;
const actor = {
  companyId: COMPANY_ID,
  userId: 93001,
  userUuid: `dashboard-accuracy-user-${RUN_ID}`,
  userRole: "company_admin",
} as const;

describe("Dashboard Finanza — importi e periodo selezionato", () => {
  let categoriaEntrataId = "";
  let categoriaUscitaId = "";
  let contoId = "";

  beforeAll(async () => {
    categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Entrate dashboard ${RUN_ID}`,
      codice: `DAE-${RUN_ID}`,
      tipo: "entrata",
    })).id;
    categoriaUscitaId = (await financeService.createCategoria(actor, {
      nome: `Uscite dashboard ${RUN_ID}`,
      codice: `DAU-${RUN_ID}`,
      tipo: "uscita",
    })).id;
    contoId = (await financeService.createConto(actor, {
      nome: `Conto dashboard ${RUN_ID}`,
      tipo: "bancario",
      saldoIniziale: 0,
      valuta: "EUR",
    })).id;

    for (const movimento of [
      { tipo: "entrata" as const, categoriaId: categoriaEntrataId, totale: 125_00, dataDocumento: "2024-03-05" },
      { tipo: "uscita" as const, categoriaId: categoriaUscitaId, totale: 45_00, dataDocumento: "2024-03-17" },
      { tipo: "entrata" as const, categoriaId: categoriaEntrataId, totale: 999_00, dataDocumento: "2024-04-05" },
    ]) {
      await financeService.creaMovimento(actor, {
        ...movimento,
        tipoRegistrazione: "pagato_subito",
        imponibile: movimento.totale,
        aliquotaIva: 0,
        importoIva: 0,
        contoId,
      });
    }
  });

  it("restituisce i centesimi corretti solo per il periodo richiesto", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: "2024-03-01",
      dataFine: "2024-03-31",
      modalita: "cassa",
    });

    expect(result?.entrate.valore).toBe(125_00);
    expect(result?.uscite.valore).toBe(45_00);
    expect(result?.utileNetto.valore).toBe(80_00);
    expect(result?.entrate.percentuale).toBeNull();
  });

  it("allinea l’andamento al periodo della dashboard, senza includere altri mesi", async () => {
    const result = await dashboardTrend({
      companyId: COMPANY_ID,
      dataInizio: "2024-03-01",
      dataFine: "2024-03-31",
      modalita: "cassa",
      mesi: 12,
    });

    expect(result?.periodo).toEqual({ dataInizio: "2024-03-01", dataFine: "2024-03-31" });
    expect(result?.trend).toEqual([{ mese: "2024-03", entrate: 125_00, uscite: 45_00, utile: 80_00 }]);
  });

  it("mantiene la stessa lettura economica in modalità competenza", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: "2024-03-01",
      dataFine: "2024-03-31",
      modalita: "competenza",
    });

    expect(result?.entrate.valore).toBe(125_00);
    expect(result?.uscite.valore).toBe(45_00);
    expect(result?.utileNetto.valore).toBe(80_00);
  });
});
