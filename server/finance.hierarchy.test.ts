import { beforeAll, describe, expect, it } from "vitest";
import { financeService } from "./domains/finance/service";
import type { ActorContext } from "./domains/_core";

const RUN_ID = Date.now().toString(36);
const COMPANY_ID = `test-hierarchy-${RUN_ID}`;
const actor: ActorContext = { companyId: COMPANY_ID, userId: 1, userUuid: `user-${RUN_ID}` };

describe.sequential("Finance — gerarchia centri e sottocategorie", () => {
  let categoriaStallaId = "";
  let categoriaCampiId = "";
  let centroStallaId = "";
  let centroCampiId = "";
  let mangimiId = "";
  let sementiId = "";

  beforeAll(async () => {
    categoriaStallaId = (await financeService.createCategoriaCentro(actor, { nome: `Produzione animale ${RUN_ID}` })).id;
    categoriaCampiId = (await financeService.createCategoriaCentro(actor, { nome: `Produzione vegetale ${RUN_ID}` })).id;
    centroStallaId = (await financeService.createCentroCosto(actor, { nome: `Stalla ${RUN_ID}`, categoriaCentroId: categoriaStallaId })).id;
    centroCampiId = (await financeService.createCentroCosto(actor, { nome: `Campi ${RUN_ID}`, categoriaCentroId: categoriaCampiId })).id;
    mangimiId = (await financeService.createCategoria(actor, { nome: `Mangimi ${RUN_ID}`, tipo: "uscita", categoriaCentroIds: [categoriaStallaId] })).id;
    sementiId = (await financeService.createCategoria(actor, { nome: `Sementi ${RUN_ID}`, tipo: "uscita", categoriaCentroIds: [categoriaCampiId] })).id;
  });

  it("propone soltanto le sottocategorie correlate al centro selezionato", async () => {
    const stalla = await financeService.listCategorie(COMPANY_ID, "uscita", centroStallaId);
    expect(stalla.map((item) => item.id)).toContain(mangimiId);
    expect(stalla.map((item) => item.id)).not.toContain(sementiId);

    const campi = await financeService.listCategorie(COMPANY_ID, "uscita", centroCampiId);
    expect(campi.map((item) => item.id)).toContain(sementiId);
    expect(campi.map((item) => item.id)).not.toContain(mangimiId);
  });

  it("impedisce di salvare una sottocategoria correlata a un’altra categoria del centro", async () => {
    await expect(financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 1_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 1_000,
      dataDocumento: "2026-09-01",
      categoriaId: sementiId,
      centroCostoId: centroStallaId,
    })).rejects.toThrow("non è correlata");
  });

  it("filtra i movimenti per categoria del centro", async () => {
    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 2_000,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 2_000,
      dataDocumento: "2026-09-02",
      categoriaId: mangimiId,
      centroCostoId: centroStallaId,
      descrizione: `Movimento stalla ${RUN_ID}`,
    });
    const risultati = await financeService.listMovimenti(COMPANY_ID, { categoriaCentroId: categoriaStallaId });
    expect(risultati.some((item) => item.descrizione === `Movimento stalla ${RUN_ID}`)).toBe(true);
    expect(risultati.every((item) => item.categoriaCentroNome === `Produzione animale ${RUN_ID}`)).toBe(true);
  });

  it("collega al primo utilizzo una sottocategoria legacy ancora priva di configurazione", async () => {
    const legacyId = (await financeService.createCategoria(actor, { nome: `Legacy ${RUN_ID}`, tipo: "uscita" })).id;
    await financeService.creaMovimento(actor, {
      tipo: "uscita",
      tipoRegistrazione: "documento",
      imponibile: 500,
      aliquotaIva: 0,
      importoIva: 0,
      totale: 500,
      dataDocumento: "2026-09-03",
      categoriaId: legacyId,
      centroCostoId: centroStallaId,
    });
    const correlate = await financeService.listCategorie(COMPANY_ID, "uscita", centroStallaId);
    expect(correlate.map((item) => item.id)).toContain(legacyId);
  });

  it("non espone categorie o relazioni a un’altra azienda", async () => {
    expect(await financeService.listCategorieCentri(`${COMPANY_ID}-other`)).toEqual([]);
    expect(await financeService.listCategorie(`${COMPANY_ID}-other`, "uscita", centroStallaId)).toEqual([]);
  });

  it("sostituisce in blocco le sottocategorie di una categoria del centro", async () => {
    const risultato = await financeService.replaceCategoriaCentroSottocategorie(
      actor,
      categoriaStallaId,
      [mangimiId, sementiId, sementiId],
    );

    expect(risultato.totale).toBe(2);
    expect(risultato.aggiunte).toContain(sementiId);

    const entrambe = await financeService.listCategorie(COMPANY_ID, "uscita", centroStallaId);
    expect(entrambe.map((item) => item.id)).toEqual(expect.arrayContaining([mangimiId, sementiId]));

    const ridotto = await financeService.replaceCategoriaCentroSottocategorie(actor, categoriaStallaId, [sementiId]);
    expect(ridotto.rimosse).toContain(mangimiId);

    const correlate = await financeService.listCategorie(COMPANY_ID, "uscita", centroStallaId);
    expect(correlate.map((item) => item.id)).toContain(sementiId);
    expect(correlate.map((item) => item.id)).not.toContain(mangimiId);
  });

  it("impedisce alla gestione bulk di collegare record di un’altra azienda", async () => {
    const actorAltro: ActorContext = {
      companyId: `${COMPANY_ID}-other`,
      userId: 2,
      userUuid: `user-other-${RUN_ID}`,
    };
    const sottocategoriaAltra = (await financeService.createCategoria(actorAltro, {
      nome: `Sottocategoria altra ${RUN_ID}`,
      tipo: "uscita",
    })).id;

    await expect(
      financeService.replaceCategoriaCentroSottocategorie(actor, categoriaStallaId, [sottocategoriaAltra]),
    ).rejects.toThrow("altra azienda");

    await expect(
      financeService.replaceCategoriaCentroSottocategorie(actorAltro, categoriaStallaId, []),
    ).rejects.toThrow("non valida");
  });
});
