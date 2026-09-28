import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositorySource = readFileSync(new URL("./domains/finance/invoice.repository.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./domains/finance/invoice.service.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./domains/finance/router.ts", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../client/src/pages/finanza/DettaglioMovimento.tsx", import.meta.url), "utf8");
const invoiceViewSource = readFileSync(new URL("../client/src/pages/finanza/VisualizzaFattura.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("Fattura dal dettaglio movimento", () => {
  it("recupera la fattura solo tramite il documento finanziario e l'azienda attiva", () => {
    const method = repositorySource.slice(repositorySource.indexOf("async getDetailByFinancialDocument"), repositorySource.indexOf("async findSupplier"));
    expect(method).toContain("eq(acquisizioniFatture.companyId, companyId)");
    expect(method).toContain("eq(acquisizioniFatture.documentoFinanziarioId, documentoId)");
    expect(method).toContain("isNull(acquisizioniFatture.deletedAt)");
    expect(method).toContain("this.getDetail(companyId, acquisizioneId)");
  });

  it("espone una procedura protetta e restituisce soltanto il dettaglio pubblico", () => {
    expect(routerSource).toContain("perMovimento: protectedProcedure.input(fatturaPerMovimentoInput)");
    expect(routerSource).toContain("invoiceService.detailByFinancialDocument(actor.companyId, input.documentoId)");
    const method = serviceSource.slice(serviceSource.indexOf("async detailByFinancialDocument"), serviceSource.indexOf("async confirm"));
    expect(method).toContain("invoiceRepository.getDetailByFinancialDocument(companyId, documentoId)");
    expect(method).toContain("publicDetail(detail)");
  });

  it("mostra l'accesso soltanto sui movimenti generati dalla fattura XML", () => {
    expect(detailSource).toContain('doc.originEntityType === "fattura_xml"');
    expect(detailSource).toContain("Visualizza fattura");
    expect(detailSource).toContain("/finanza/movimento/${id}/fattura");
  });

  it("registra una rotta dedicata e mantiene un ritorno al movimento", () => {
    expect(appSource).toContain('path="/finanza/movimento/:documentoId/fattura"');
    expect(invoiceViewSource).toContain('useRoute("/finanza/movimento/:documentoId/fattura")');
    expect(invoiceViewSource).toContain("Torna al movimento");
    expect(invoiceViewSource).toContain("Fattura non disponibile");
  });

  it("visualizza dati fiscali leggibili senza esporre il file XML tecnico o azioni di modifica", () => {
    expect(invoiceViewSource).toContain("Riepilogo fiscale");
    expect(invoiceViewSource).toContain("Righe documento");
    expect(invoiceViewSource).toContain("Piano di regolazione");
    expect(invoiceViewSource).toContain("Il file XML originale resta protetto e non viene esposto");
    expect(invoiceViewSource).not.toContain("fileKey");
    expect(invoiceViewSource).not.toContain("fileUrl");
    expect(invoiceViewSource).not.toContain("Rileggi XML");
    expect(invoiceViewSource).not.toContain("Conferma fattura");
  });
});
