/** Dati esclusivamente simulati. XML ordinario FPR12, massimo cinque righe per preset.
 * Le fixture non contattano SdI e non rappresentano documenti fiscali reali.
 */
export type DemoInvoicePreset = {
  id: string;
  label: string;
  xml: string;
  mode: "acquisto" | "inventario";
};

type FixtureLine = {
  name: string; code: string; quantity: number; unit: string; unitCents: number;
  originalCode?: string; discountPercent?: number;
};

type FixtureDocument = {
  id: string; number: string; date: string; lines: FixtureLine[];
  type?: "TD01" | "TD04"; ddt?: { number: string; date: string };
};

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const money = (value: number) => (value / 100).toFixed(2);
const lineTotal = (line: FixtureLine) => Math.round(line.quantity * line.unitCents * (1 - (line.discountPercent ?? 0) / 100));

function fixtureXml(document: FixtureDocument): string {
  const total = document.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const details = document.lines.map((line, index) => `
      <DettaglioLinee>
        <NumeroLinea>${index + 1}</NumeroLinea>
        <CodiceArticolo><CodiceTipo>FORNITORE</CodiceTipo><CodiceValore>${xmlEscape(line.code)}</CodiceValore></CodiceArticolo>${line.originalCode ? `
        <CodiceArticolo><CodiceTipo>OEM</CodiceTipo><CodiceValore>${xmlEscape(line.originalCode)}</CodiceValore></CodiceArticolo>` : ""}
        <Descrizione>${xmlEscape(line.name)}</Descrizione>
        <Quantita>${line.quantity.toFixed(3)}</Quantita>
        <UnitaMisura>${xmlEscape(line.unit)}</UnitaMisura>
        <PrezzoUnitario>${money(line.unitCents)}</PrezzoUnitario>${line.discountPercent ? `
        <ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>${line.discountPercent.toFixed(2)}</Percentuale></ScontoMaggiorazione>` : ""}
        <PrezzoTotale>${money(lineTotal(line))}</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${xmlEscape(document.id)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Ricambi Agricoli Demo S.r.l.</Denominazione></Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via della Simulazione</Indirizzo><NumeroCivico>10</NumeroCivico><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>09876543210</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fallinity Azienda Demo</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via del Magazzino Demo</Indirizzo><NumeroCivico>1</NumeroCivico><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${document.type ?? "TD01"}</TipoDocumento><Divisa>EUR</Divisa>
        <Data>${document.date}</Data><Numero>${xmlEscape(document.number)}</Numero>
        <ImportoTotaleDocumento>${money(total)}</ImportoTotaleDocumento>
        <Causale>SIMULAZIONE DEMO - nessun dato reale - operazione non soggetta IVA N2.2</Causale>
      </DatiGeneraliDocumento>${document.ddt ? `
      <DatiDDT><NumeroDDT>${xmlEscape(document.ddt.number)}</NumeroDDT><DataDDT>${document.ddt.date}</DataDDT>${document.lines.map((_, index) => `<RiferimentoNumeroLinea>${index + 1}</RiferimentoNumeroLinea>`).join("")}</DatiDDT>` : ""}
    </DatiGenerali>
    <DatiBeniServizi>${details}
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura>
        <ImponibileImporto>${money(total)}</ImponibileImporto><Imposta>0.00</Imposta>
        <RiferimentoNormativo>Operazione non soggetta IVA - N2.2 - dati simulati</RiferimentoNormativo>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-12-15</DataScadenzaPagamento><ImportoPagamento>${money(total)}</ImportoPagamento></DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`;
}

const filter = (quantity: number, name = "CART. FILTRO OLIO FENDT 822", unitCents = 4000): FixtureLine => ({
  name, code: "FO822", quantity, unit: "PZ", unitCents,
});

/** La prima FO822 richiede associazione manuale suggerita dal nome; la successiva
 * viene riconosciuta dall'alias soltanto DOPO la conferma dell'utente.
 * Inventario storico: chiedere esplicitamente quantità fisica 7 (anche 0 è valido).
 * Confezioni: impostare articolo in pz e fattore 10, mai ricavarlo automaticamente.
 */
export const DEMO_INVOICE_PRESETS: DemoInvoicePreset[] = [
  {
    id: "base", label: "Demo completa: tre ricambi, manodopera e trasporto", mode: "acquisto",
    xml: fixtureXml({ id: "D001", number: "DEMO-001", date: "2026-11-01", lines: [
      filter(3),
      { name: "Fusibile mini 10 A", code: "FUS10", originalCode: "FUSE-MINI-10A", quantity: 20, unit: "PZ", unitCents: 100 },
      { name: "Cuscinetto 6205", code: "CUS6205", originalCode: "BEARING-6205", quantity: 6, unit: "PZ", unitCents: 1500 },
      { name: "Manodopera officina", code: "SERV-MAN", quantity: 2, unit: "ORE", unitCents: 5000 },
      { name: "Trasporto ricambi", code: "SERV-TRASP", quantity: 1, unit: "NR", unitCents: 1500 },
    ] }),
  },
  {
    id: "storico", label: "Inventario iniziale: 20 filtri storici, confermare 7 fisici", mode: "inventario",
    xml: fixtureXml({ id: "D002", number: "DEMO-STORICO-2025", date: "2025-06-10", lines: [filter(20)] }),
  },
  {
    id: "acquisto-400", label: "Finanza: acquisto 10 filtri a 40 € (totale 400 €, IVA 0)", mode: "acquisto",
    xml: fixtureXml({ id: "D003", number: "DEMO-400", date: "2026-11-02", lines: [filter(10)] }),
  },
  {
    id: "alias-successivo", label: "Stesso fornitore e codice FO822: memoria associazione confermata", mode: "acquisto",
    xml: fixtureXml({ id: "D004", number: "DEMO-ALIAS-02", date: "2026-11-05", lines: [filter(3, "Cartuccia olio mot. 822", 4500)] }),
  },
  {
    id: "ddt", label: "DDT DEMO-DDT-10: 10 filtri già ricevuti, collegare senza secondo carico", mode: "acquisto",
    xml: fixtureXml({ id: "D005", number: "DEMO-DDT-FACT", date: "2026-11-06", ddt: { number: "DEMO-DDT-10", date: "2026-11-04" }, lines: [{ ...filter(10), originalCode: "FENDT-OIL-822" }] }),
  },
  {
    id: "parziale", label: "Ricezione parziale: fattura da 10 filtri, prima 6 poi 4", mode: "acquisto",
    xml: fixtureXml({ id: "D006", number: "DEMO-PARZIALE", date: "2026-11-07", lines: [filter(10)] }),
  },
  {
    id: "confezioni", label: "Unità di misura: 2 confezioni da 10 fusibili, confermare fattore 10", mode: "acquisto",
    xml: fixtureXml({ id: "D007", number: "DEMO-CONF-10", date: "2026-11-08", lines: [
      { name: "Fusibile mini 10 A - confezione da 10 pezzi", code: "FUS10-CONF", originalCode: "FUSE-MINI-10A", quantity: 2, unit: "CONF", unitCents: 1000 },
    ] }),
  },
  {
    id: "sconto", label: "Prezzo netto: 2 filtri da 50 € con sconto 20%, netto 40 €", mode: "acquisto",
    xml: fixtureXml({ id: "D008", number: "DEMO-SCONTO", date: "2026-11-09", lines: [
      { ...filter(2, "Filtro olio Fendt 822", 5000), discountPercent: 20 },
    ] }),
  },
  {
    id: "credito", label: "Nota di credito TD04: -40 € in Finanza, nessun reso automatico", mode: "acquisto",
    xml: fixtureXml({ id: "D009", number: "DEMO-NC-01", date: "2026-11-10", type: "TD04", lines: [filter(1)] }),
  },
];
