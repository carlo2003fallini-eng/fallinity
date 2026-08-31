import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-subject-defaults-${RUN_ID}`;
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: `user-${RUN_ID}`,
};

describe.sequential("Finance — preferenze ultimo movimento per soggetto", () => {
  let soggettoId = "";
  let categoriaPrimaId = "";
  let categoriaUltimaId = "";
  let centroPrimaId = "";
  let centroUltimoId = "";

  beforeAll(async () => {
    soggettoId = (await financeService.createSoggetto(actor, {
      tipologia: "entrambi",
      ragioneSociale: `Soggetto storico ${RUN_ID}`,
    })).id;
    categoriaPrimaId = (await financeService.createCategoria(actor, {
      nome: `Categoria prima ${RUN_ID}`,
      tipo: "uscita",
    })).id;
    categoriaUltimaId = (await financeService.createCategoria(actor, {
      nome: `Categoria ultima ${RUN_ID}`,
      tipo: "uscita",
    })).id;
    centroPrimaId = (await financeService.createCentroCosto(actor, {
      nome: `Centro prima ${RUN_ID}`,
    })).id;
    centroUltimoId = (await financeService.createCentroCosto(actor, {
      nome: `Centro ultimo ${RUN_ID}`,
    })).id;
  });

  it("restituisce categoria e centro dell’ultimo movimento creato, non della data documento più recente", async () => {
    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 1_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 1_000,
      dataDocumento: "2026-12-31",
      categoriaId: categoriaPrimaId,
      centroCostoId: centroPrimaId,
      soggettoId,
    });
    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 2_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 2_000,
      dataDocumento: "2026-01-01",
      categoriaId: categoriaUltimaId,
      centroCostoId: centroUltimoId,
      soggettoId,
    });

    const ultimo = await financeService.ultimoMovimentoPerSoggetto(COMPANY_ID, soggettoId, "uscita");
    expect(ultimo?.categoriaId).toBe(categoriaUltimaId);
    expect(ultimo?.centroCostoId).toBe(centroUltimoId);
    expect(ultimo?.tipo).toBe("uscita");
  });

  it("separa lo storico di entrate e uscite per lo stesso soggetto", async () => {
    const categoriaEntrataId = (await financeService.createCategoria(actor, {
      nome: `Categoria entrata ${RUN_ID}`,
      tipo: "entrata",
    })).id;
    await financeService.creaMovimento(actor, {
      tipo: "entrata",
      tipoRegistrazione: "documento",
      imponibile: 3_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 3_000,
      dataDocumento: "2026-02-01",
      categoriaId: categoriaEntrataId,
      soggettoId,
    });

    const ultimo = await financeService.ultimoMovimentoPerSoggetto(COMPANY_ID, soggettoId, "entrata");
    expect(ultimo?.categoriaId).toBe(categoriaEntrataId);
    expect(ultimo?.centroCostoId).toBeNull();
  });

  it("non espone preferenze di un’altra azienda", async () => {
    const ultimo = await financeService.ultimoMovimentoPerSoggetto(`${COMPANY_ID}-other`, soggettoId, "uscita");
    expect(ultimo).toBeNull();
  });
});
