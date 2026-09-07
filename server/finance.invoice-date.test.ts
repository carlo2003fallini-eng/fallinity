import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { invoiceRepository } from "./domains/finance/invoice.repository";
import { invoiceService } from "./domains/finance/invoice.service";

function acquisition(dataDocumento: unknown, dataScadenza: unknown) {
  return {
    acquisition: {
      id: "acq-date",
      stato: "da_verificare",
      nomeFile: "fattura-date.xml",
      numeroDocumento: "42",
      dataDocumento,
      valuta: "EUR",
      tipoDocumento: "TD01",
      fornitoreRagioneSociale: "Fornitore test",
      fornitorePartitaIva: "12345678901",
      fornitoreCodiceFiscale: null,
      fornitoreIndirizzo: null,
      fornitoreEmail: null,
      fornitoreIban: null,
      soggettoId: null,
      imponibile: 10000,
      importoIva: 2200,
      totale: 12200,
      ritenute: 0,
      altriImporti: 0,
      metodoPagamento: null,
      condizioniPagamento: null,
      riepiloghiIvaJson: [],
      scadenzeJson: [{ dataScadenza, importo: 12200, iban: null, modalitaPagamento: null }],
      avvisiJson: [],
      aiUsata: false,
      duplicatoDocumentoId: null,
      documentoFinanziarioId: null,
    },
    lines: [],
  } as any;
}

describe("Date dell’inserimento automatico XML", () => {
  it("normalizza data documento e scadenza quando il database restituisce timestamp SQL completi", async () => {
    const repository = invoiceRepository as unknown as { getDetail: (companyId: string, id: string) => Promise<any> };
    const original = repository.getDetail;
    try {
      repository.getDetail = async () => acquisition("2026-09-04T00:00:00.000Z", "2026-10-05 00:00:00");
      const detail = await invoiceService.detail("azienda-date", "acq-date");
      expect(detail?.dataDocumento).toBe("2026-09-04");
      expect(detail?.scadenze[0]?.dataScadenza).toBe("2026-10-05");
    } finally {
      repository.getDetail = original;
    }
  });

  it("non propaga valori data non validi alla schermata di revisione", async () => {
    const repository = invoiceRepository as unknown as { getDetail: (companyId: string, id: string) => Promise<any> };
    const original = repository.getDetail;
    try {
      repository.getDetail = async () => acquisition("data non disponibile", "2026-02-30");
      const detail = await invoiceService.detail("azienda-date", "acq-date");
      expect(detail?.dataDocumento).toBe("");
      expect(detail?.scadenze[0]?.dataScadenza).toBe("");
    } finally {
      repository.getDetail = original;
    }
  });

  it("mostra un testo leggibile invece di Invalid Date nel client e conserva input date validi", () => {
    const source = readFileSync(new URL("../client/src/pages/finanza/NuovoMovimentoAutomatico.tsx", import.meta.url), "utf8");
    expect(source).toContain("function toInputDate(value: unknown)");
    expect(source).toContain('return "Data non disponibile"');
    expect(source).toContain("value={deadline.dataScadenza}");
    expect(source).toContain("value={displayDate(acquisition.dataDocumento)}");
  });
});
