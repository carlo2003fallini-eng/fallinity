import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `filters-${RUN_ID}`;
const actor = {
  companyId: COMPANY_ID,
  userId: 92001,
  userUuid: `filters-user-${RUN_ID}`,
  userRole: "company_admin",
} as const;

describe("Lista Movimenti — filtri combinabili", () => {
  let fornitoreUnoId = "";
  let fornitoreDueId = "";
  let categoriaUnoId = "";
  let categoriaDueId = "";
  let centroUnoId = "";
  let centroDueId = "";

  beforeAll(async () => {
    fornitoreUnoId = (await financeService.createSoggetto(actor, {
      tipologia: "fornitore",
      ragioneSociale: `Agraria Filtri ${RUN_ID}`,
    })).id;
    fornitoreDueId = (await financeService.createSoggetto(actor, {
      tipologia: "fornitore",
      ragioneSociale: `Ricambi Filtri ${RUN_ID}`,
    })).id;
    categoriaUnoId = (await financeService.createCategoria(actor, {
      nome: `Mangimi Filtri ${RUN_ID}`,
      codice: `FM-${RUN_ID}`,
      tipo: "uscita",
    })).id;
    categoriaDueId = (await financeService.createCategoria(actor, {
      nome: `Manutenzione Filtri ${RUN_ID}`,
      codice: `FR-${RUN_ID}`,
      tipo: "uscita",
    })).id;
    centroUnoId = (await financeService.createCentroCosto(actor, { nome: `Stalla Filtri ${RUN_ID}` })).id;
    centroDueId = (await financeService.createCentroCosto(actor, { nome: `Officina Filtri ${RUN_ID}` })).id;

    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 15_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 15_000,
      dataDocumento: "2026-08-12",
      descrizione: `Acquisto mangimi ${RUN_ID}`,
      soggettoId: fornitoreUnoId,
      categoriaId: categoriaUnoId,
      centroCostoId: centroUnoId,
    });
    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 22_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 22_000,
      dataDocumento: "2026-07-05",
      descrizione: `Ricambio trattore ${RUN_ID}`,
      soggettoId: fornitoreDueId,
      categoriaId: categoriaDueId,
      centroCostoId: centroDueId,
    });
  });

  it("combina soggetto, categoria, centro di costo e intervallo date", async () => {
    const rows = await financeService.listMovimenti(COMPANY_ID, {
      tipo: "uscita",
      soggettoId: fornitoreUnoId,
      categoriaId: categoriaUnoId,
      centroCostoId: centroUnoId,
      dataInizio: "2026-08-01",
      dataFine: "2026-08-31",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].soggettoNome).toContain("Agraria Filtri");
    expect(rows[0].categoriaNome).toContain("Mangimi Filtri");
    expect(rows[0].centroCostoNome).toContain("Stalla Filtri");
  });

  it("cerca anche nei nomi di fornitore, categoria e centro di costo", async () => {
    const bySupplier = await financeService.listMovimenti(COMPANY_ID, { search: `Agraria Filtri ${RUN_ID}` });
    const byCategory = await financeService.listMovimenti(COMPANY_ID, { search: `Manutenzione Filtri ${RUN_ID}` });
    const byCostCenter = await financeService.listMovimenti(COMPANY_ID, { search: `Officina Filtri ${RUN_ID}` });
    expect(bySupplier).toHaveLength(1);
    expect(byCategory).toHaveLength(1);
    expect(byCostCenter).toHaveLength(1);
  });
});
