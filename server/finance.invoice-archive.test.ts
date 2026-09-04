import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listArchivioFattureInput } from "./domains/finance/validators";
import { invoiceRepository } from "./domains/finance/invoice.repository";
import { invoiceService } from "./domains/finance/invoice.service";

describe("Archivio fatture acquisite", () => {
  it("accetta ricerca e filtri avanzati validi", () => {
    const parsed = listArchivioFattureInput.safeParse({
      search: "Cooperativa 123",
      stati: ["da_verificare", "registrata"],
      dataDa: "2026-01-01",
      dataA: "2026-12-31",
      totaleMin: 10_000,
      totaleMax: 250_000,
      conAvvisi: true,
      conPossibileDuplicato: false,
      limit: 30,
      offset: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("rifiuta intervalli data/importo invertiti e pagine oltre il limite", () => {
    expect(listArchivioFattureInput.safeParse({ dataDa: "2026-12-31", dataA: "2026-01-01" }).success).toBe(false);
    expect(listArchivioFattureInput.safeParse({ totaleMin: 20_000, totaleMax: 10_000 }).success).toBe(false);
    expect(listArchivioFattureInput.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("formatta i risultati archivio mantenendo il perimetro della sola azienda richiesta", async () => {
    const repository = invoiceRepository as unknown as { listAcquisitions: (companyId: string, input: any) => Promise<any> };
    const original = repository.listAcquisitions;
    let receivedCompanyId = "";
    try {
      repository.listAcquisitions = async (companyId, input) => {
        receivedCompanyId = companyId;
        expect(input).toMatchObject({ search: "fornitore", limit: 30, offset: 0 });
        return {
          total: 1,
          hasMore: false,
          items: [{ id: "acq-1", dataDocumento: new Date("2026-09-01T00:00:00Z"), avvisiJson: [{ codice: "verifica", severita: "attenzione", messaggio: "Controlla" }] }],
        };
      };
      const result = await invoiceService.listArchive("azienda-isolata", { search: "fornitore", limit: 30, offset: 0 });
      expect(receivedCompanyId).toBe("azienda-isolata");
      expect(result.items[0]).toMatchObject({ id: "acq-1", dataDocumento: "2026-09-01", avvisi: [{ codice: "verifica" }] });
    } finally {
      repository.listAcquisitions = original;
    }
  });

  it("mantiene la ricerca e i filtri isolati per azienda nella query archivio", () => {
    const repositorySource = readFileSync(new URL("./domains/finance/invoice.repository.ts", import.meta.url), "utf8");
    expect(repositorySource).toContain("async listAcquisitions(companyId: string, input: ListArchivioFattureInput)");
    expect(repositorySource).toContain("eq(acquisizioniFatture.companyId, companyId)");
    expect(repositorySource).toContain("like(acquisizioniFatture.fornitoreRagioneSociale, pattern)");
    expect(repositorySource).toContain("like(acquisizioniFatture.fornitorePartitaIva, pattern)");
    expect(repositorySource).toContain("JSON_LENGTH(${acquisizioniFatture.avvisiJson}) > 0");
    expect(repositorySource).toContain(".limit(input.limit).offset(input.offset)");
  });

  it("espone un archivio protetto e una UI con ricerca, filtri e apertura revisione", () => {
    const routerSource = readFileSync(new URL("./domains/finance/router.ts", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const archivePageSource = readFileSync(new URL("../client/src/pages/finanza/ArchivioFatture.tsx", import.meta.url), "utf8");
    const automaticPageSource = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimentoAutomatico.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("archivio: protectedProcedure.input(listArchivioFattureInput)");
    expect(appSource).toContain('path="/finanza/fatture-acquisite"');
    expect(archivePageSource).toContain("Cerca fattura…");
    expect(archivePageSource).toContain("Cerca per fornitore, P. IVA, numero o nome file");
    expect(archivePageSource).toContain("Filtri avanzati");
    expect(archivePageSource).toContain("Possibili duplicati");
    expect(archivePageSource).toContain('setLocation("/finanza/nuovo-automatico")');
    expect(automaticPageSource).toContain('setLocation("/finanza/fatture-acquisite")');
  });
});
