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

  it("permette di selezionare tutte le fatture e mostra la loro ultima scadenza", () => {
    expect(pageSource).toContain("Seleziona tutte le fatture in scadenza");
    expect(pageSource).toContain("selezionaTutte");
    expect(pageSource).toContain("Ultima scadenza:");
    expect(pageSource).toContain("fattura.scadenzaFinale");
    expect(pageSource).toContain("fattura.scadenzeAperte");
  });

  it("richiede conto e conferma esplicita mostrando gli importi e le date applicate", () => {
    expect(pageSource).toContain("Conto di addebito *");
    expect(pageSource).toContain("Saldo previsto dopo la registrazione");
    expect(pageSource).toContain("Regolarizzare {fattureSelezionate.length} fatture?");
    expect(pageSource).toContain("Date applicate");
    expect(pageSource).toContain("Conferma e registra");
    expect(pageSource).toContain("La data documento non viene modificata.");
  });

  it("invia esclusivamente il comando dedicato alla regolarizzazione storica", () => {
    expect(pageSource).toContain("trpc.finanza.pagamenti.regolarizzaStorico.useMutation");
    expect(pageSource).toContain("documentoIds: fattureSelezionate.map");
    expect(pageSource).toContain("contoId: form.contoId");
    expect(pageSource).toContain('metodoId: form.metodoId === "__none__"');
  });
});
