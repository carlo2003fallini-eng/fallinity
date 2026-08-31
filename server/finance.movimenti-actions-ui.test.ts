import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listSource = readFileSync(
  new URL("../client/src/pages/finanza/ListaMovimenti.tsx", import.meta.url),
  "utf8",
);
const actionsSource = readFileSync(
  new URL("../client/src/components/finance/MovimentoActions.tsx", import.meta.url),
  "utf8",
);

describe("Lista Movimenti — azioni modifica ed elimina", () => {
  it("espone il menu azioni su ogni movimento", () => {
    expect(listSource).toContain("<MovimentoActions movimento={m} />");
    expect(actionsSource).toContain("MoreVertical");
    expect(actionsSource).toContain("Modifica");
    expect(actionsSource).toContain("Elimina");
  });

  it("include un form di modifica precompilato con protezione degli importi regolati", () => {
    expect(actionsSource).toContain("Modifica movimento");
    expect(actionsSource).toContain("Salva modifiche");
    expect(actionsSource).toContain("hasConfirmedPayments");
    expect(actionsSource).toContain("importo, tipo e IVA sono bloccati");
  });

  it("richiede conferma e spiega lo storno prima dell’eliminazione", () => {
    expect(actionsSource).toContain("Eliminare questo movimento?");
    expect(actionsSource).toContain("verrà creato automaticamente uno storno");
    expect(actionsSource).toContain("Elimina movimento");
  });

  it("non annida il menu azioni nel pulsante che apre il dettaglio", () => {
    expect(listSource).not.toMatch(/<button[^>]*>[\s\S]*<MovimentoActions movimento=\{m\}[\s\S]*<\/button>/);
  });
});
