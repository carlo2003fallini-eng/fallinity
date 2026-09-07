import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Aggiornamento acquisizioni XML già salvate", () => {
  const serviceSource = readFileSync(new URL("./domains/finance/invoice.service.ts", import.meta.url), "utf8");
  const repositorySource = readFileSync(new URL("./domains/finance/invoice.repository.ts", import.meta.url), "utf8");
  const routerSource = readFileSync(new URL("./domains/finance/router.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimentoAutomatico.tsx", import.meta.url), "utf8");

  it("rigenera le sole bozze con lo stesso file invece di restituire le righe precedenti", () => {
    expect(serviceSource).toContain("if (existing?.documentoFinanziarioId)");
    expect(serviceSource).toContain("await invoiceRepository.replaceDraftAcquisition(actor, existing.id, acquisitionData, lines)");
    expect(repositorySource).toContain("async replaceDraftAcquisition(actor: ActorContext, id: string");
    expect(repositorySource).toContain("tx.delete(righeFattureAcquisite)");
    expect(repositorySource).toContain("La fattura è già registrata e non può essere riletta");
  });

  it("espone la rilettura protetta e aggiorna la revisione senza permettere modifiche ai documenti registrati", () => {
    expect(serviceSource).toContain("async reprocess(actor: ActorContext, id: string)");
    expect(serviceSource).toContain("storageGetSignedUrl(detail.acquisition.fileKey)");
    expect(routerSource).toContain("rileggi: protectedProcedure.input(dettaglioAcquisizioneFatturaInput)");
    expect(pageSource).toContain("fattureAutomatiche.rileggi.useMutation");
    expect(pageSource).toContain("XML riletto con il filtro aggiornato");
    expect(pageSource).toContain("Rileggi XML");
  });
});
