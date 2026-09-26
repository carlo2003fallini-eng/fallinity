import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(
  new URL("../client/src/pages/finanza/Impostazioni.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../client/src/pages/finanza/RegolarizzaScadenzeStoriche.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../client/src/App.tsx", import.meta.url),
  "utf8",
);

describe("Impostazioni Finanza — regolarizzazione storico", () => {
  it("espone un accesso dedicato nelle impostazioni", () => {
    expect(settingsSource).toContain("Regolarizza storico fatture");
    expect(settingsSource).toContain("/finanza/impostazioni/regolarizza-storico");
    expect(appSource).toContain('path="/finanza/impostazioni/regolarizza-storico"');
    expect(appSource).toContain("RegolarizzaScadenzeStoriche");
  });

  it("separa entrate e uscite, consentendo la selezione totale con ultima scadenza", () => {
    expect(pageSource).toContain("Uscite da pagare");
    expect(pageSource).toContain("Entrate da incassare");
    expect(pageSource).toContain('setTipo("entrata")');
    expect(pageSource).toContain('setTipo("uscita")');
    expect(pageSource).toContain("Seleziona tutte le {tipo === \"entrata\" ? \"entrate\" : \"uscite\"} in scadenza");
    expect(pageSource).toContain("selezionaTutte");
    expect(pageSource).toContain("Ultima scadenza:");
    expect(pageSource).toContain("fattura.scadenzaFinale");
    expect(pageSource).toContain("fattura.scadenzeAperte");
  });

  it("richiede conto e conferma esplicita mostrando importi, date e verso applicato", () => {
    expect(pageSource).toContain("Conto di {tipo === \"entrata\" ? \"accredito\" : \"addebito\"} *");
    expect(pageSource).toContain("Saldo previsto dopo la registrazione");
    expect(pageSource).toContain("{tipo === \"entrata\" ? \"Incassare\" : \"Regolarizzare\"}");
    expect(pageSource).toContain("Totale da {tipo === \"entrata\" ? \"incassare\" : \"regolarizzare\"}");
    expect(pageSource).toContain("Date applicate");
    expect(pageSource).toContain("Conferma e ${tipo === \"entrata\" ? \"incassa\" : \"registra\"}");
    expect(pageSource).toContain("La data documento non viene modificata.");
  });

  it("invia esclusivamente il comando dedicato alla regolarizzazione storica", () => {
    expect(pageSource).toContain("trpc.finanza.pagamenti.regolarizzaStorico.useMutation");
    expect(pageSource).toContain("documentoIds: fattureSelezionate.map");
    expect(pageSource).toContain("tipo,");
    expect(pageSource).toContain("contoId: form.contoId");
    expect(pageSource).toContain('metodoId: form.metodoId === "__none__"');
  });
});
