import { describe, expect, it } from "vitest";
import {
  buildInvoiceDocumentHash,
  decodeInvoiceBase64,
  normalizeInvoiceDescription,
  parseFatturaPaXml,
} from "./domains/finance/invoice-xml";

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione><ProgressivoInvio>INV-77</ProgressivoInvio></DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>01234567890</CodiceFiscale>
        <Anagrafica><Denominazione>Forniture Agricole Italia SRL</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via dei Campi</Indirizzo><NumeroCivico>12</NumeroCivico><CAP>20100</CAP><Comune>Milano</Comune><Provincia>MI</Provincia><Nazione>IT</Nazione></Sede>
      <Contatti><Email>amministrazione@forniture.example</Email></Contatti>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-09-01</Data><Numero>FA-2026/77</Numero>
        <DatiRitenuta><TipoRitenuta>RT01</TipoRitenuta><ImportoRitenuta>10.00</ImportoRitenuta></DatiRitenuta>
        <DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>
        <ImportoTotaleDocumento>277.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><CodiceArticolo><CodiceTipo>SKU</CodiceTipo><CodiceValore>MANG-01</CodiceValore></CodiceArticolo><Descrizione>Mangime completo bovini</Descrizione><Quantita>10.000</Quantita><UnitaMisura>KG</UnitaMisura><PrezzoUnitario>20.0000</PrezzoUnitario><PrezzoTotale>200.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DettaglioLinee><NumeroLinea>2</NumeroLinea><Descrizione>Trasporto</Descrizione><Quantita>1.00</Quantita><UnitaMisura>NR</UnitaMisura><PrezzoUnitario>40.00</PrezzoUnitario><PrezzoTotale>40.00</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura></DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>200.00</ImponibileImporto><Imposta>44.00</Imposta></DatiRiepilogo>
      <DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura><ImponibileImporto>40.00</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-09-10</DataScadenzaPagamento><ImportoPagamento>138.50</ImportoPagamento><IBAN>IT60X0542811101000000123456</IBAN></DettaglioPagamento>
      <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-10-15</DataScadenzaPagamento><ImportoPagamento>138.50</ImportoPagamento><IBAN>IT60X0542811101000000123456</IBAN></DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

describe("Parser fattura elettronica XML", () => {
  it("estrae dati fiscali, righe, riepiloghi e scadenze senza AI", () => {
    const parsed = parseFatturaPaXml(VALID_XML, new Date("2026-09-04T00:00:00Z"));
    expect(parsed.versioneFatturaPa).toBe("FPR12");
    expect(parsed.fornitore).toMatchObject({
      ragioneSociale: "Forniture Agricole Italia SRL",
      partitaIva: "01234567890",
      iban: "IT60X0542811101000000123456",
    });
    expect(parsed).toMatchObject({
      numeroDocumento: "FA-2026/77",
      dataDocumento: "2026-09-01",
      imponibile: 24_000,
      importoIva: 4_400,
      totale: 27_700,
      ritenute: 1_000,
      altriImporti: 200,
      aliquotaIvaPrevalente: 2_200,
      metodoPagamento: "MP05",
      condizioniPagamento: "TP02",
    });
    expect(parsed.righe).toHaveLength(2);
    expect(parsed.righe[0]).toMatchObject({ codiceArticolo: "MANG-01", quantita: "10.000", prezzoUnitario: 2_000, totaleLinea: 20_000, aliquotaIva: 2_200 });
    expect(parsed.righe[1]).toMatchObject({ naturaIva: "N2.2", totaleLinea: 4_000, aliquotaIva: 0 });
    expect(parsed.scadenze.map((item) => item.importo)).toEqual([13_850, 13_850]);
    expect(parsed.avvisi.some((item) => item.codice === "scadenza_vicina")).toBe(true);
  });

  it("produce un’identità documento stabile e normalizza le descrizioni", () => {
    const parsed = parseFatturaPaXml(VALID_XML);
    expect(buildInvoiceDocumentHash(parsed)).toBe(buildInvoiceDocumentHash(parsed));
    expect(normalizeInvoiceDescription("  Concimè NPK — 20/10  ")).toBe("concime npk 20 10");
  });

  it("rifiuta XML malformato e dichiarazioni DOCTYPE/ENTITY", () => {
    expect(() => parseFatturaPaXml("<FatturaElettronica><non-chiuso>"))
      .toThrow(/XML non valido/);
    const unsafe = Buffer.from(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY ext SYSTEM "file:///etc/passwd">]><FatturaElettronica/>`);
    expect(() => decodeInvoiceBase64(unsafe.toString("base64"), unsafe.length))
      .toThrow(/dichiarazioni non consentite/);
  });

  it("non accetta dimensioni alterate o file con più fatture", () => {
    const bytes = Buffer.from(VALID_XML);
    expect(() => decodeInvoiceBase64(bytes.toString("base64"), bytes.length + 1)).toThrow(/incompleto o danneggiato/);
    const multiple = VALID_XML.replace("<FatturaElettronicaBody>", "<FatturaElettronicaBody>")
      .replace("</FatturaElettronicaBody>", "</FatturaElettronicaBody><FatturaElettronicaBody><DatiGenerali/></FatturaElettronicaBody>");
    expect(() => parseFatturaPaXml(multiple)).toThrow(/più fatture/);
  });
});
