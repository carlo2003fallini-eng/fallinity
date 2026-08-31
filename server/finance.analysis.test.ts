import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";
import {
  confrontaValore,
  creaInsightFinanziari,
  financialAnalysisOverview,
} from "./domains/finance/financial-analysis";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `analysis-${RUN_ID}`;
const OTHER_COMPANY_ID = `analysis-other-${RUN_ID}`;

const actor = {
  companyId: COMPANY_ID,
  userId: 91001,
  userUuid: `analysis-user-${RUN_ID}`,
  userRole: "company_admin",
} as const;

const otherActor = {
  companyId: OTHER_COMPANY_ID,
  userId: 91002,
  userUuid: `analysis-other-user-${RUN_ID}`,
  userRole: "company_admin",
} as const;

describe("Analisi finanziaria multidimensionale", () => {
  let categoriaEntrataId = "";
  let categoriaUscitaId = "";
  let centroCostoId = "";
  let clienteId = "";
  let fornitoreId = "";

  beforeAll(async () => {
    categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Vendite analisi ${RUN_ID}`,
      codice: `AE-${RUN_ID}`,
      tipo: "entrata",
    })).id;
    categoriaUscitaId = (await financeService.createCategoria(actor, {
      nome: `Acquisti analisi ${RUN_ID}`,
      codice: `AU-${RUN_ID}`,
      tipo: "uscita",
    })).id;
    centroCostoId = (await financeService.createCentroCosto(actor, {
      nome: `Stalla analisi ${RUN_ID}`,
    })).id;
    clienteId = (await financeService.createSoggetto(actor, {
      tipologia: "cliente",
      ragioneSociale: `Cliente analisi ${RUN_ID}`,
    })).id;
    fornitoreId = (await financeService.createSoggetto(actor, {
      tipologia: "fornitore",
      ragioneSociale: `Fornitore analisi ${RUN_ID}`,
    })).id;

    const movimenti = [
      { tipo: "entrata" as const, totale: 100_000, dataDocumento: "2026-06-10", categoriaId: categoriaEntrataId, soggettoId: clienteId },
      { tipo: "uscita" as const, totale: 40_000, dataDocumento: "2026-06-15", categoriaId: categoriaUscitaId, soggettoId: fornitoreId },
      { tipo: "entrata" as const, totale: 80_000, dataDocumento: "2026-05-10", categoriaId: categoriaEntrataId, soggettoId: clienteId },
      { tipo: "uscita" as const, totale: 50_000, dataDocumento: "2026-05-15", categoriaId: categoriaUscitaId, soggettoId: fornitoreId },
    ];
    for (const movimento of movimenti) {
      await financeService.creaMovimento(actor, {
        ...movimento,
        tipoRegistrazione: "documento",
        imponibile: movimento.totale,
        aliquotaIva: 0,
        importoIva: 0,
        centroCostoId,
      });
    }

    const otherCategory = (await financeService.createCategoria(otherActor, {
      nome: `Categoria altra azienda ${RUN_ID}`,
      codice: `AO-${RUN_ID}`,
      tipo: "entrata",
    })).id;
    const otherSubject = (await financeService.createSoggetto(otherActor, {
      tipologia: "cliente",
      ragioneSociale: `Cliente altra azienda ${RUN_ID}`,
    })).id;
    await financeService.creaMovimento(otherActor, {
      tipo: "entrata",
      tipoRegistrazione: "documento",
      imponibile: 999_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 999_000,
      dataDocumento: "2026-06-20",
      categoriaId: otherCategory,
      soggettoId: otherSubject,
    });
  });

  it("calcola KPI e confronto sul periodo selezionato", async () => {
    const result = await financialAnalysisOverview(COMPANY_ID, {
      dataInizio: "2026-06-01",
      dataFine: "2026-06-30",
      confrontoInizio: "2026-05-01",
      confrontoFine: "2026-05-31",
      granularita: "mese",
    });

    expect(result.kpi.entrate.valore).toBe(100_000);
    expect(result.kpi.entrate.precedente).toBe(80_000);
    expect(result.kpi.entrate.percentuale).toBe(25);
    expect(result.kpi.uscite.valore).toBe(40_000);
    expect(result.kpi.utile.valore).toBe(60_000);
    expect(result.kpi.utile.precedente).toBe(30_000);
    expect(result.kpi.margine.valore).toBe(60);
    expect(result.kpi.movimenti.valore).toBe(2);
  });

  it("produce trend e confronti per categoria, soggetto e centro di costo", async () => {
    const result = await financialAnalysisOverview(COMPANY_ID, {
      dataInizio: "2026-05-01",
      dataFine: "2026-06-30",
      confrontoInizio: "2026-03-01",
      confrontoFine: "2026-04-30",
      granularita: "mese",
    });

    expect(result.trend).toHaveLength(2);
    expect(result.trend.map((point) => point.periodo)).toEqual(["2026-05", "2026-06"]);
    expect(result.categorie.some((row) => row.id === categoriaUscitaId && row.totale === 90_000)).toBe(true);
    expect(result.soggetti.some((row) => row.id === fornitoreId && row.totale === 90_000)).toBe(true);
    expect(result.centriCosto.some((row) => row.id === centroCostoId && row.totale === 90_000)).toBe(true);
    expect(result.soggetti.every((row) => !row.nome.includes("altra azienda"))).toBe(true);
  });

  it("genera confronti e insight deterministici", () => {
    expect(confrontaValore(125, 100)).toEqual({ valore: 125, precedente: 100, differenza: 25, percentuale: 25 });
    const insight = creaInsightFinanziari(
      { entrate: 80_000, uscite: 100_000, utile: -20_000, margine: -25, movimenti: 4 },
      { entrate: 90_000, uscite: 70_000, utile: 20_000, margine: 22.2, movimenti: 3 },
      [{ nome: "Mangimi", tipo: "uscita", totale: 60_000 }],
      [{ nome: "Fornitore Uno", tipo: "uscita", totale: 70_000 }],
    );
    expect(insight.map((item) => item.titolo)).toEqual(expect.arrayContaining(["Risultato negativo", "Costi in aumento", "Costo concentrato", "Dipendenza da un fornitore"]));
  });
});
