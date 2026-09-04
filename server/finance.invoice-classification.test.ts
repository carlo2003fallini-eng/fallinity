import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildClassificationRuleKey, classifyInvoiceLines } from "./domains/finance/invoice-classification";

const baseLine = {
  numeroLinea: 1,
  codiceArticolo: "MANG-01",
  descrizione: "Mangime bovini",
  quantita: "10.000",
  unitaMisura: "KG",
  prezzoUnitario: 2000,
  totaleLinea: 20000,
  aliquotaIva: 2200,
  naturaIva: null,
};

describe("Classificazione righe fattura", () => {
  it("prioritizza lo storico per fornitore e codice articolo", async () => {
    const result = await classifyInvoiceLines({
      partitaIva: "01234567890",
      lines: [baseLine],
      rules: [{ codiceArticolo: "MANG-01", descrizioneNormalizzata: "mangime bovini", categoriaId: "cat-feed", centroCostoId: "cdc-feed", destinazione: "magazzino", prodottoId: "prod-feed" }],
      categories: [{ id: "cat-feed", nome: "Mangimi", tipo: "uscita", attivo: true }],
      centers: [{ id: "cdc-feed", nome: "Alimentazione", attivo: true }],
      products: [{ id: "prod-feed", nome: "Mangime bovini", codice: "MANG-01" }],
      enableAi: false,
    });
    expect(result.aiUsed).toBe(false);
    expect(result.lines[0]).toMatchObject({ categoriaId: "cat-feed", centroCostoId: "cdc-feed", fonteClassificazione: "storico_codice", confidenza: 96, prodottoId: "prod-feed" });
  });

  it("usa regole lessicali e lascia ogni proposta modificabile", async () => {
    const result = await classifyInvoiceLines({
      partitaIva: null,
      lines: [{ ...baseLine, codiceArticolo: null, descrizione: "Gasolio agricolo agevolato" }],
      rules: [],
      categories: [{ id: "cat-fuel", nome: "Carburanti", tipo: "uscita", attivo: true }],
      centers: [{ id: "cdc-machines", nome: "Carburanti officina", attivo: true }],
      products: [],
      enableAi: false,
    });
    expect(result.lines[0]).toMatchObject({ categoriaId: "cat-fuel", centroCostoId: "cdc-machines", fonteClassificazione: "regola", confidenza: 78 });
  });

  it("genera chiavi diverse per fornitori diversi", () => {
    expect(buildClassificationRuleKey("IT111", "ABC", "Mangime"))
      .not.toBe(buildClassificationRuleKey("IT222", "ABC", "Mangime"));
  });
});

describe("Contratti di sicurezza acquisizione e conferma", () => {
  const repositorySource = readFileSync(new URL("./domains/finance/invoice.repository.ts", import.meta.url), "utf8");
  const serviceSource = readFileSync(new URL("./domains/finance/invoice.service.ts", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("./domains/finance/router.ts", import.meta.url), "utf8");

  it("isola query e conferma per companyId", () => {
    expect(repositorySource).toContain("eq(acquisizioniFatture.companyId, actor.companyId)");
    expect(repositorySource).toContain("eq(righeFattureAcquisite.companyId, actor.companyId)");
    expect(repositorySource).toContain("eq(prodotti.companyId, actor.companyId)");
    expect(repositorySource).toContain("FOR UPDATE");
  });

  it("non crea documenti prima della conferma e conferma tutto in transazione", () => {
    const acquireBody = serviceSource.slice(serviceSource.indexOf("async acquire"), serviceSource.indexOf("async detail"));
    expect(acquireBody).not.toContain("documentiFinanziari");
    expect(repositorySource).toContain("return db.transaction(async (tx) =>");
    expect(repositorySource).toContain("tx.insert(documentiFinanziari)");
    expect(repositorySource).toContain("tx.insert(scadenzeFinanziarie)");
    expect(repositorySource).toContain("tx.insert(registrazioniEconomiche)");
    expect(repositorySource).toContain("if (line.aggiornaMagazzino)");
  });

  it("blocca duplicati senza override ed espone soltanto procedure protette", () => {
    expect(serviceSource).toContain("POSSIBILE_DUPLICATO");
    expect(serviceSource).toContain("!input.confermaDuplicato");
    expect(routerSource).toContain("fattureAutomatiche: router");
    expect(routerSource).toContain("protectedProcedure.input(acquisisciFatturaXmlInput)");
    expect(routerSource).toContain("protectedProcedure.input(confermaFatturaAcquisitaInput)");
  });
});
