import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseFatturaPaXml } from "./domains/finance/invoice-xml";
import { resolveInvoiceDirection } from "./domains/finance/invoice.service";
import { classifyInvoiceLines } from "./domains/finance/invoice-classification";

const company = { partitaIva: "00608920146", codiceFiscale: "00608920146" };

function buildXmlWithoutArticleCodes(numero: string, totale: string, lines: string, imponibile: string, imposta: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
    <FatturaElettronicaHeader>
      <CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>03107710133</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Controparte XML</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore>
      <CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00608920146</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Azienda Fallini</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente>
    </FatturaElettronicaHeader>
    <FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-07-31</Data><Numero>${numero}</Numero><ImportoTotaleDocumento>${totale}</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
      <DatiBeniServizi>${lines}<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>${imponibile}</ImponibileImporto><Imposta>${imposta}</Imposta></DatiRiepilogo></DatiBeniServizi>
    </FatturaElettronicaBody>
  </p:FatturaElettronica>`;
}

describe("Riconoscimento XML, verso e duplicati fattura", () => {
  it("riconosce le righe economiche dei tracciati forniti anche quando manca il codice articolo", () => {
    const firstXml = buildXmlWithoutArticleCodes("956", "140.00", `
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Numero spedizione di riferimento</Descrizione><Quantita>0</Quantita><PrezzoUnitario>0</PrezzoUnitario><PrezzoTotale>0</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      ${Array.from({ length: 6 }, (_, index) => `<DettaglioLinee><NumeroLinea>${index + 2}</NumeroLinea><Descrizione>Articolo commerciale ${index + 1}</Descrizione><Quantita>1</Quantita><PrezzoUnitario>19.12</PrezzoUnitario><PrezzoTotale>19.12</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>`).join("")}`, "114.75", "25.25");
    const secondXml = buildXmlWithoutArticleCodes("35/E", "2986.56", `
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Prestazione veterinaria</Descrizione><Quantita>1</Quantita><PrezzoUnitario>2448.00</PrezzoUnitario><PrezzoTotale>2448.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DettaglioLinee><NumeroLinea>2</NumeroLinea><Descrizione>Riferimento tecnico</Descrizione><Quantita>0</Quantita><PrezzoUnitario>0</PrezzoUnitario><PrezzoTotale>0</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>`, "2448.00", "538.56");
    const first = parseFatturaPaXml(firstXml);
    const second = parseFatturaPaXml(secondXml);

    expect(first).toMatchObject({ numeroDocumento: "956", totale: 14_000 });
    expect(first.righe).toHaveLength(6);
    expect(first.righe.every((line) => line.codiceArticolo === null && line.totaleLinea > 0)).toBe(true);
    expect(second).toMatchObject({ numeroDocumento: "35/E", totale: 298_656 });
    expect(second.righe).toHaveLength(1);
    expect(second.righe[0]).toMatchObject({ codiceArticolo: null, totaleLinea: 244_800 });
  });

  it("rileva uscita quando l’azienda è cessionaria e entrata quando è cedente", () => {
    const parsed = {
      cedente: { partitaIva: "01234567890", codiceFiscale: null },
      cessionario: { partitaIva: "00608920146", codiceFiscale: "00608920146" },
    } as ReturnType<typeof parseFatturaPaXml>;
    expect(resolveInvoiceDirection(parsed, company)).toMatchObject({ tipoMovimento: "uscita", incerta: false });
    expect(resolveInvoiceDirection({ ...parsed, cedente: parsed.cessionario, cessionario: parsed.cedente }, company)).toMatchObject({ tipoMovimento: "entrata", incerta: false });
  });

  it("classifica una fattura in Entrata come ricavo e non propone un carico di magazzino", async () => {
    const result = await classifyInvoiceLines({
      partitaIva: "01234567890",
      tipoMovimento: "entrata",
      lines: [{ numeroLinea: 1, codiceArticolo: "LATTE-01", descrizione: "Latte conferito", quantita: "100", unitaMisura: "LT", prezzoUnitario: 60, totaleLinea: 6000, aliquotaIva: 1000, naturaIva: null }],
      rules: [],
      categories: [{ id: "cat-ricavi", nome: "Ricavi latte", tipo: "entrata", attivo: true }],
      centers: [],
      products: [{ id: "prod-latte", nome: "Latte conferito", codice: "LATTE-01" }],
      enableAi: false,
    });
    expect(result.lines[0]).toMatchObject({ categoriaId: "cat-ricavi", destinazione: "costo", prodottoId: "prod-latte" });
  });

  it("mantiene il blocco duplicati senza alcun parametro di override", () => {
    const validator = fs.readFileSync(path.resolve("server/domains/finance/validators.ts"), "utf8");
    const service = fs.readFileSync(path.resolve("server/domains/finance/invoice.service.ts"), "utf8");
    const repository = fs.readFileSync(path.resolve("server/domains/finance/invoice.repository.ts"), "utf8");
    const schema = fs.readFileSync(path.resolve("drizzle/schema.ts"), "utf8");
    const page = fs.readFileSync(path.resolve("client/src/pages/finanza/NuovoMovimentoAutomatico.tsx"), "utf8");

    expect(validator).not.toMatch(/confermaDuplicato/);
    expect(service).toContain("DUPLICATO_BLOCCATO");
    expect(repository).toContain("DUPLICATO_BLOCCATO");
    expect(schema).toContain("uq_acq_fatture_company_hash_documento");
    expect(page).toContain("Rileva automaticamente");
    expect(page).toContain("Entrata · vendita a cliente");
    expect(page).toContain("{!isEntrata && <div");
    expect(page).not.toContain("voglio registrare comunque");
  });
});
