import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { invoiceService, runBatchWithConcurrency } from "./domains/finance/invoice.service";
import { acquisisciFattureXmlBatchInput } from "./domains/finance/validators";

const file = (index: number, dimensione = 1024) => ({
  nomeFile: `fattura-${index}.xml`,
  mimeType: "application/xml",
  dimensione,
  contenutoBase64: "PGZhdHR1cmE+PC9mYXR0dXJhPg==",
});

describe("Importazione multipla fatture XML", () => {
  it("accetta fino a 20 file XML nel limite aggregato", () => {
    const result = acquisisciFattureXmlBatchInput.safeParse({ files: Array.from({ length: 20 }, (_, index) => file(index, 1_000_000)) });
    expect(result.success).toBe(true);
  });

  it("rifiuta più di 20 file o oltre 25 MB complessivi", () => {
    expect(acquisisciFattureXmlBatchInput.safeParse({ files: Array.from({ length: 21 }, (_, index) => file(index)) }).success).toBe(false);
    expect(acquisisciFattureXmlBatchInput.safeParse({ files: Array.from({ length: 6 }, (_, index) => file(index, 5 * 1024 * 1024)) }).success).toBe(false);
  });

  it("limita il lavoro concorrente e conserva l’ordine dei risultati", async () => {
    let active = 0;
    let maximum = 0;
    const results = await runBatchWithConcurrency([1, 2, 3, 4, 5], async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, value % 2 ? 5 : 1));
      active -= 1;
      return value * 10;
    }, 2);
    expect(maximum).toBeLessThanOrEqual(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("restituisce un errore per file senza interrompere le altre acquisizioni", async () => {
    const service = invoiceService as unknown as {
      acquire: (actor: unknown, input: { nomeFile: string }) => Promise<any>;
    };
    const original = service.acquire;
    service.acquire = async (_actor, input) => {
      if (input.nomeFile === "non-valido.xml") throw new Error("XML non valido");
      return {
        id: `acq-${input.nomeFile}`,
        numeroDocumento: "FA-1",
        fornitore: { ragioneSociale: "Fornitore QA" },
        totale: 10_000,
        valuta: "EUR",
        riutilizzata: false,
      };
    };
    try {
      const result = await invoiceService.acquireBatch({ companyId: "azienda-qa" } as any, {
        files: [file(1), { ...file(2), nomeFile: "non-valido.xml" }, file(3)],
      });
      expect(result).toMatchObject({ totale: 3, acquisiti: 2, errori: 1 });
      expect(result.risultati.map((item) => item.stato)).toEqual(["acquisita", "errore", "acquisita"]);
      expect(result.risultati[1]?.messaggio).toBe("XML non valido");
    } finally {
      service.acquire = original;
    }
  });

  it("espone risultati per file e mantiene la conferma esterna al batch", () => {
    const serviceSource = readFileSync(new URL("./domains/finance/invoice.service.ts", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./domains/finance/router.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimentoAutomatico.tsx", import.meta.url), "utf8");
    expect(serviceSource).toContain("async acquireBatch");
    expect(serviceSource).toContain('stato: "errore" as const');
    expect(serviceSource).toContain("}, 2);");
    expect(routerSource).toContain("acquisisciBatch: protectedProcedure.input(acquisisciFattureXmlBatchInput)");
    expect(pageSource).toContain("multiple");
    expect(pageSource).toContain("handleFiles(event.dataTransfer.files)");
    expect(pageSource).toContain("runFileQueue");
    expect(pageSource).toContain("Ogni file viene controllato separatamente");
    expect(pageSource).toContain("Conferma e registra");
  });
});
