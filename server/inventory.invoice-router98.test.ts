import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getActor: vi.fn(), profile: vi.fn(), getPermissions: vi.fn(), invokeLLM: vi.fn(), listLLMModels: vi.fn(), getDb: vi.fn() }));
vi.mock("./domains/_core", () => ({ getActor: mocks.getActor }));
vi.mock("./domains/access/service", () => ({ accessService: { profile: mocks.profile } }));
vi.mock("./domains/access/repository", () => ({ accessRepository: { getPermissions: mocks.getPermissions } }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM, listLLMModels: mocks.listLLMModels }));
// Guardia supplementare: nessun test può avviare una connessione o mutazione SQL.
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { invoiceImportPermissions, invoiceImportRouter } from "./domains/inventory/invoice-router";
import { parseWarehouseInvoiceFile, parseWarehouseInvoiceXml, redactInvoiceEconomics } from "./domains/inventory/invoice-xml";
import { decodeInvoiceBase64, parseFatturaPaXml } from "./domains/finance/invoice-xml";

// Documento sintetico completo, indipendente dai fixture scritti da altri agenti.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
<FatturaElettronicaHeader>
<DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>00000000098</IdCodice></IdTrasmittente><ProgressivoInvio>DEMO98</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario></DatiTrasmissione>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000098</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Fornitore simulato 98 SRL</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>Via Demo</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000099</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Azienda solo fixture 98</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>Via Fixture</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Provincia>RM</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente>
</FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali>
<DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-01</Data><Numero>DEMO-98/1</Numero><ImportoTotaleDocumento>537.80</ImportoTotaleDocumento></DatiGeneraliDocumento>
<DatiOrdineAcquisto><RiferimentoNumeroLinea>1</RiferimentoNumeroLinea><IdDocumento>ORD-DEMO-98</IdDocumento></DatiOrdineAcquisto>
<DatiDDT><NumeroDDT>DDT-A-98</NumeroDDT><DataDDT>2026-10-30</DataDDT><RiferimentoNumeroLinea>1</RiferimentoNumeroLinea></DatiDDT>
<DatiDDT><NumeroDDT>DDT-B-98</NumeroDDT><DataDDT>2026-10-31</DataDDT></DatiDDT>
</DatiGenerali><DatiBeniServizi>
<DettaglioLinee><NumeroLinea>1</NumeroLinea><CodiceArticolo><CodiceTipo>SKU</CodiceTipo><CodiceValore>FO822</CodiceValore></CodiceArticolo><CodiceArticolo><CodiceTipo>OEM</CodiceTipo><CodiceValore>OEM-822</CodiceValore></CodiceArticolo><CodiceArticolo><CodiceTipo>EAN</CodiceTipo><CodiceValore>0000000000098</CodiceValore></CodiceArticolo><Descrizione>CART. FILTRO OLIO FENDT 822</Descrizione><Quantita>10.000</Quantita><UnitaMisura>PZ</UnitaMisura><PrezzoUnitario>40.0000</PrezzoUnitario><ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>10.00</Percentuale></ScontoMaggiorazione><ScontoMaggiorazione><Tipo>MG</Tipo><Importo>1.00</Importo></ScontoMaggiorazione><PrezzoTotale>370.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>2</NumeroLinea><Descrizione>Manodopera officina</Descrizione><Quantita>2</Quantita><UnitaMisura>ORE</UnitaMisura><PrezzoUnitario>30.00</PrezzoUnitario><PrezzoTotale>60.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>3</NumeroLinea><Descrizione>Trasporto</Descrizione><Quantita>1</Quantita><UnitaMisura>NR</UnitaMisura><PrezzoUnitario>20.00</PrezzoUnitario><PrezzoTotale>20.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>4</NumeroLinea><TipoCessionePrestazione>SC</TipoCessionePrestazione><Descrizione>Sconto commerciale</Descrizione><Quantita>1</Quantita><PrezzoUnitario>-10.00</PrezzoUnitario><PrezzoTotale>-10.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>440.00</ImponibileImporto><Imposta>96.80</Imposta></DatiRiepilogo>
</DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-12-01</DataScadenzaPagamento><ImportoPagamento>537.80</ImportoPagamento></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody>
</p:FatturaElettronica>`;
function file(xml = XML, nomeFile = "fattura-simulata98.xml") {
  const bytes = Buffer.from(xml, "utf8");
  return { nomeFile, contenutoBase64: bytes.toString("base64"), dimensione: bytes.length };
}
const ACTOR = { companyId: "00000000-0000-4000-8000-000000000098", userId: 98, userUuid: "00000000-0000-4000-8000-000000000099" };
const USER: NonNullable<TrpcContext["user"]> = { id: ACTOR.userId, uuid: ACTOR.userUuid, openId: "fixture-only-user-98", name: "Utente fixture", email: "fixture98@example.invalid", loginMethod: "fixture", role: "user", platformRole: "operator", avatarUrl: null, activeCompanyId: ACTOR.companyId, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), lastSignedIn: new Date("2026-01-01") };
function caller(user: TrpcContext["user"] = USER) {
  return invoiceImportRouter.createCaller({ user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
}
function access(roleCode = "operator", modules = ["azienda.magazzino"], editable = true, isCompanyAdmin = false) {
  mocks.profile.mockResolvedValue({ isCompanyAdmin, isSuperAdmin: false, roleCode, modules });
  mocks.getPermissions.mockResolvedValue(modules.map(moduleKey => ({ moduleKey, canView: true, canEdit: editable })));
}
const CLASSIFICATION = { categoria: "Ricambi", reparto: "Officina", famiglia: "Filtri", sottocategoria: "Olio" };
const AI_INPUT = { invoice: { lines: [{ id: "fixture-line-98", name: "CART. FILTRO OLIO FENDT 822", codes: [{ type: "OEM", value: "OEM-822" }] }] }, products: [{ id: "fixture-product-98", nome: "Filtro olio Fendt 822", codice: "OEM-822", description: "Filtro olio", identifiers: ["OEM-822"], ...CLASSIFICATION }], structure: [CLASSIFICATION] };
function suggestion(overrides: Record<string, unknown> = {}) {
  return { lineId: "fixture-line-98", productId: "fixture-product-98", ...CLASSIFICATION, reason: "Codice coerente: verificare prima della conferma", confidence: 0.8, ...overrides };
}
function response(value: unknown) {
  mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(value) } }] });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getDb.mockImplementation(() => { throw new Error("DB proibito nei test demo98"); });
  mocks.getActor.mockResolvedValue(ACTOR);
  access();
  mocks.listLLMModels.mockResolvedValue({ data: [{ id: "gpt-6-luna" }] });
  response({ suggestions: [suggestion()] });
});

describe("XML Magazzino 98 — adattatore reale e input non affidabile", () => {
  it("estrae tutti i codici, DDT, ordini, sconti/maggiorazioni e importi in centesimi", () => {
    const parsed = parseWarehouseInvoiceXml(XML);
    expect(parsed).toMatchObject({ number: "DEMO-98/1", date: "2026-11-01", currency: "EUR", type: "TD01", supplierKey: "IT:00000000098", supplierVat: "00000000098", supplierName: "Fornitore simulato 98 SRL", totalCents: 53780, orderRefs: ["ORD-DEMO-98"] });
    expect(parsed.lines).toHaveLength(4);
    expect(parsed.lines[0]).toMatchObject({ id: `${parsed.id}:1`, number: 1, quantity: 10, unit: "PZ", unitPriceCents: 4000, totalCents: 37000, vatRate: 2200, codes: [{ type: "SKU", value: "FO822" }, { type: "OEM", value: "OEM-822" }, { type: "EAN", value: "0000000000098" }], adjustments: [{ type: "SC", percent: 10, amountCents: null }, { type: "MG", percent: null, amountCents: 100 }], ddtRefs: ["DDT-A-98 · 2026-10-30", "DDT-B-98 · 2026-10-31"] });
    expect(parsed.ddts).toEqual([{ number: "DDT-A-98", date: "2026-10-30", lineNumbers: [1] }, { number: "DDT-B-98", date: "2026-10-31", lineNumbers: [] }]);
    expect(parsed.lines[1].ddtRefs).toEqual(["DDT-B-98 · 2026-10-31"]);
    expect(parsed.lines.map(line => line.kind)).toEqual(["materiale", "servizio", "accessorio", "sconto"]);
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("decodifica il file validando dimensione e hash senza dipendere dal nome", () => {
    const input = file(); const decoded = decodeInvoiceBase64(input.contenutoBase64, input.dimensione);
    expect(decoded.xml).toBe(XML);
    expect(decoded.hashFile).toBe(createHash("sha256").update(Buffer.from(XML)).digest("hex"));
    expect(parseWarehouseInvoiceFile(input)).toEqual(parseWarehouseInvoiceXml(XML, decoded.hashFile));
    expect(parseWarehouseInvoiceFile({ ...input, nomeFile: "rinominato.XML" }).id).toBe(parseWarehouseInvoiceFile(input).id);
    expect(() => parseWarehouseInvoiceFile({ ...input, dimensione: input.dimensione + 1 })).toThrow(/incompleto|danneggiato/);
    expect(() => parseWarehouseInvoiceFile({ ...input, nomeFile: "fattura.pdf" })).toThrow(/XML/);
    expect(() => parseWarehouseInvoiceFile({ ...input, contenutoBase64: "not_base64!" })).toThrow(/Base64/);
  });

  it.each([
    '<!DOCTYPE p:FatturaElettronica [<!ENTITY ext SYSTEM "file:///nonexistent-demo98-secret">]>',
    '<!DOCTYPE p:FatturaElettronica [<!ENTITY ext SYSTEM "https://example.invalid/demo98-secret">]>',
    '<!ENTITY explode "unsafe">',
  ])("rifiuta XXE/ENTITY nel decoder e parser senza leggere risorse esterne: %s", (declaration) => {
    const unsafe = XML.replace('<p:FatturaElettronica ', `${declaration}\n<p:FatturaElettronica `);
    const input = file(unsafe);
    expect(() => decodeInvoiceBase64(input.contenutoBase64, input.dimensione)).toThrow(/non consentite/);
    expect(() => parseWarehouseInvoiceXml(unsafe)).toThrow(/non consentite/);
    expect(() => parseWarehouseInvoiceFile(input)).toThrow(/non consentite/);
  });

  it("rifiuta XML malformato, numeri riga duplicati e quantità non finite", () => {
    expect(() => parseWarehouseInvoiceXml("<FatturaElettronica><not-closed>")).toThrow(/XML non valido/);
    expect(() => parseWarehouseInvoiceXml(XML.replace("<NumeroLinea>2</NumeroLinea>", "<NumeroLinea>1</NumeroLinea>"))).toThrow(/duplicati|non validi/);
    expect(() => parseWarehouseInvoiceXml(XML.replace("<Quantita>10.000</Quantita>", "<Quantita>Infinity</Quantita>"))).toThrow(/Quantità|valore non valido/);
  });

  it("identità fiscale stabile anche modificando prezzi, file e nome fornitore, ma distinta per fornitore", () => {
    const original = parseWarehouseInvoiceXml(XML);
    const changed = parseWarehouseInvoiceXml(XML.replace("<PrezzoUnitario>40.0000</PrezzoUnitario>", "<PrezzoUnitario>42.0000</PrezzoUnitario>").replace("Fornitore simulato 98 SRL", "Nome commerciale aggiornato"));
    expect(changed.id).toBe(original.id);
    expect(changed.sourceHash).not.toBe(original.sourceHash);
    expect(parseWarehouseInvoiceXml(XML.replace("<IdCodice>00000000098</IdCodice>", "<IdCodice>00000000097</IdCodice>").replace("<IdCodice>00000000098</IdCodice>", "<IdCodice>00000000097</IdCodice>")).id).not.toBe(original.id);
  });

  it("l'adattatore non altera il risultato fiscale esistente: servizi commerciali conservati e sconto negativo ancora escluso", () => {
    const today = new Date("2026-11-01T00:00:00Z");
    const before = parseFatturaPaXml(XML, today);
    parseWarehouseInvoiceXml(XML);
    const after = parseFatturaPaXml(XML, today);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ numeroDocumento: "DEMO-98/1", dataDocumento: "2026-11-01", totale: 53780, imponibile: 44000, importoIva: 9680 });
    expect(after.righe.map(line => line.descrizione)).toEqual(["CART. FILTRO OLIO FENDT 822", "Manodopera officina", "Trasporto"]);
    expect(after.righe[0]).toMatchObject({ codiceArticolo: "FO822", prezzoUnitario: 4000, totaleLinea: 37000 });
  });

  it("redazione immutabile: tutti gli importi a zero e classificazione preservata", () => {
    const original = parseWarehouseInvoiceXml(XML); const snapshot = structuredClone(original);
    const redacted = redactInvoiceEconomics(original);
    expect(original).toEqual(snapshot);
    expect(redacted.totalCents).toBe(0);
    expect(redacted.lines.every(l => l.unitPriceCents === 0 && l.totalCents === 0 && l.vatRate === 0 && l.adjustments.length === 0)).toBe(true);
    expect(redacted.lines.map(l => l.kind)).toEqual(original.lines.map(l => l.kind));
    expect(redacted.lines[0]).toMatchObject({ quantity: 10, codes: original.lines[0].codes, ddtRefs: original.lines[0].ddtRefs });
  });
});

describe("Router import fatture 98 — autorizzazione sul vero tRPC", () => {
  it("helper: viewer non modifica, operatore magazzino non vede costi, admin ha permessi completi", () => {
    expect(invoiceImportPermissions({ isCompanyAdmin: false, roleCode: "viewer", modules: ["azienda.magazzino"] }, ["azienda.magazzino"])).toEqual({ canView: true, canEdit: false, canSeeCosts: false });
    expect(invoiceImportPermissions({ isCompanyAdmin: false, roleCode: "operator", modules: ["azienda.magazzino"] }, ["azienda.magazzino"])).toEqual({ canView: true, canEdit: true, canSeeCosts: false });
    expect(invoiceImportPermissions({ isCompanyAdmin: false, roleCode: "manager", modules: ["azienda.magazzino", "finanza.fatturazione"] }, [])).toEqual({ canView: true, canEdit: false, canSeeCosts: true });
    expect(invoiceImportPermissions({ isCompanyAdmin: true, roleCode: "company_admin", modules: [] }, [])).toEqual({ canView: true, canEdit: true, canSeeCosts: true });
  });

  it("permessi si riferisce all'attore server e all'azienda attiva, non agli ID o flag inviati dal client", async () => {
    const c = caller();
    const result = await c.permessi();
    expect(result).toEqual({ canView: true, canEdit: true, canSeeCosts: false, companyId: ACTOR.companyId, userId: ACTOR.userId, productionEnabled: false });
    expect(mocks.getActor).toHaveBeenCalledWith(expect.objectContaining({ user: USER }));
    expect(mocks.profile).toHaveBeenCalledWith(ACTOR, USER);
    expect(mocks.getPermissions).toHaveBeenCalledWith(ACTOR.companyId, ACTOR.userId);
    const spoof = { ...file(), companyId: "other-client-company", userId: 1, canSeeCosts: true, isCompanyAdmin: true };
    expect((await c.leggiXml(spoof)).totalCents).toBe(0);
    expect(mocks.getPermissions).toHaveBeenLastCalledWith(ACTOR.companyId, ACTOR.userId);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("viewer può leggere permessi ma riceve 403 sia su leggiXml sia su suggerisciAI", async () => {
    access("viewer", ["azienda.magazzino"], true);
    expect((await caller().permessi()).canEdit).toBe(false);
    await expect(caller().leggiXml(file())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.listLLMModels).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("senza modulo Magazzino anche permessi è 403; senza canEdit sono vietate le mutation", async () => {
    access("operator", ["azienda.officina", "finanza.fatturazione"], true);
    await expect(caller().permessi()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().leggiXml(file())).rejects.toMatchObject({ code: "FORBIDDEN" });
    access("operator", ["azienda.magazzino"], false);
    expect((await caller().permessi()).canEdit).toBe(false);
    await expect(caller().leggiXml(file())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("non autenticato riceve 401 prima di attore, parser e LLM", async () => {
    await expect(caller(null).permessi()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).leggiXml(file())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getActor).not.toHaveBeenCalled();
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
  });

  it("canEdit senza Finanza legge XML con prezzi zero ma kind corretto senza LLM o SQL", async () => {
    const result = await caller().leggiXml(file());
    expect(result.totalCents).toBe(0);
    expect(result.lines.every(l => l.unitPriceCents === 0 && l.totalCents === 0 && l.vatRate === 0 && l.adjustments.length === 0)).toBe(true);
    expect(result.lines.map(l => l.kind)).toEqual(["materiale", "servizio", "accessorio", "sconto"]);
    expect(result.lines[0].quantity).toBe(10);
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.listLLMModels).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("accesso economico autorizzato conserva i prezzi del parser", async () => {
    access("manager", ["azienda.magazzino", "finanza.fatturazione"]);
    expect(await caller().leggiXml(file())).toEqual(parseWarehouseInvoiceFile(file()));
  });

  it("errori del file/XXE diventano BAD_REQUEST senza invocare LLM o mutare SQL", async () => {
    await expect(caller().leggiXml(file('<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///nonexistent-demo98">]><x/>'))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().leggiXml({ ...file(), dimensione: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("Suggerimenti IA 98 — invocazione esplicita e output non affidabile", () => {
  it("solo suggerisciAI invoca il client reale sostituito dal mock; ritorna suggerimenti senza cambiare input né DB", async () => {
    const input = structuredClone(AI_INPUT); const snapshot = structuredClone(input);
    await caller().permessi(); await caller().leggiXml(file());
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    const result = await caller().suggerisciAI(input);
    expect(result).toEqual({ suggestions: [suggestion()], model: "gpt-6-luna" });
    expect(mocks.listLLMModels).toHaveBeenCalledTimes(1);
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(1);
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-6-luna", reasoning: { effort: "low" }, response_format: expect.objectContaining({ type: "json_schema" }) }));
    expect(input).toEqual(snapshot);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("schema input elimina importi, IVA, quantità, giacenze e flag client dal prompt LLM", async () => {
    const input = { ...AI_INPUT, companyId: "spoof-company", financeExpensesCents: 987654321, invoice: { totalCents: 987654321, supplierVat: "private-vat", lines: AI_INPUT.invoice.lines.map(l => ({ ...l, totalCents: 987654321, unitPriceCents: 123456789, vatRate: 2200, quantity: 10, adjustments: [{ amountCents: 456789 }] })) }, products: AI_INPUT.products.map(p => ({ ...p, lastPurchaseCents: 987654321, valuationUnitCents: 123456789, quantity: 200, canSeeCosts: true })) };
    await caller().suggerisciAI(input);
    const request = mocks.invokeLLM.mock.calls[0][0];
    const userPrompt = request.messages.find((m: { role: string }) => m.role === "user").content;
    expect(JSON.parse(userPrompt)).toEqual(AI_INPUT);
    expect(userPrompt).not.toMatch(/totalCents|unitPriceCents|vatRate|lastPurchaseCents|valuationUnitCents|financeExpensesCents|quantity|supplierVat|companyId|987654321|123456789/);
    expect(request.messages.find((m: { role: string }) => m.role === "system").content).toMatch(/NON affidabile/);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("scarta ID riga/prodotto sconosciuti invece di proporre associazioni fuori dal catalogo", async () => {
    response({ suggestions: [suggestion(), suggestion({ lineId: "unknown-line" }), suggestion({ productId: "unknown-product" }), suggestion({ productId: null })] });
    const result = await caller().suggerisciAI(AI_INPUT);
    expect(result.suggestions).toEqual([suggestion()]);
    expect(result.suggestions.some(s => s.lineId === "unknown-line" || s.productId === "unknown-product")).toBe(false);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("accetta productId nullo per una riga incerta senza inventare identità", async () => {
    response({ suggestions: [suggestion({ productId: null, confidence: 0.2 })] });
    expect((await caller().suggerisciAI(AI_INPUT)).suggestions).toEqual([suggestion({ productId: null, confidence: 0.2 })]);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each([-0.01, 1.01, "0.8", null])("rifiuta confidenza fuori range/non numerica: %s", async confidence => {
    response({ suggestions: [suggestion({ confidence })] });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("rifiuta JSON corrotto, classificazione mancante e struttura di risposta errata", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "not JSON" } }] });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    const { famiglia: _omitted, ...incomplete } = suggestion();
    response({ suggestions: [incomplete] });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    response({ suggestions: "not an array" });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("modello non disponibile: revisione manuale possibile, nessuna invocazione LLM", async () => {
    mocks.listLLMModels.mockResolvedValue({ data: [] });
    await expect(caller().suggerisciAI(AI_INPUT)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect((await caller().leggiXml(file())).lines).toHaveLength(4);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("limiti dello schema impediscono input troppo grandi prima del client LLM", async () => {
    const oversized = { ...AI_INPUT, invoice: { lines: Array.from({ length: 51 }, (_, index) => ({ ...AI_INPUT.invoice.lines[0], id: `line-${index}` })) } };
    await expect(caller().suggerisciAI(oversized)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.invokeLLM).not.toHaveBeenCalled();
    expect(mocks.listLLMModels).not.toHaveBeenCalled();
  });
});
