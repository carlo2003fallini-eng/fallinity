import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const movementsSource = readFileSync(
  new URL("../client/src/pages/finanza/ListaMovimenti.tsx", import.meta.url),
  "utf8",
);

describe("Lista Movimenti — pagamento multiplo", () => {
  it("mostra la selezione soltanto nella scheda Scadenze per fatture di uscita pagabili", () => {
    expect(movementsSource).toContain('tab === "da_regolare" ? "uscita" : tipoFilter');
    expect(movementsSource).toContain('stati: tab === "da_regolare" ? [...STATI_PAGABILI] : undefined');
    expect(movementsSource).toContain('aria-label="Pagamento multiplo fatture"');
    expect(movementsSource).toContain('m.tipo === "uscita"');
    expect(movementsSource).toContain("STATI_PAGABILI.includes(m.stato)");
  });

  it("richiede almeno due fatture e rende trasparente il totale prima della conferma", () => {
    expect(movementsSource).toContain("Seleziona almeno due fatture per usare il pagamento multiplo.");
    expect(movementsSource).toContain("fattureSelezionate.length < 2");
    expect(movementsSource).toContain("Totale selezionato");
    expect(movementsSource).toContain("Saldo previsto dopo il pagamento");
    expect(movementsSource).toContain("Conferma pagamento multiplo");
  });

  it("invia un unico comando tipizzato con conto, metodo, data, riferimento e nota", () => {
    expect(movementsSource).toContain("trpc.finanza.pagamenti.registraMultipli.useMutation");
    expect(movementsSource).toContain("documentoIds: fattureSelezionate.map");
    expect(movementsSource).toContain("contoId: pagamentoMultiplo.contoId");
    expect(movementsSource).toContain("metodoId: pagamentoMultiplo.metodoId === \"__none__\"");
    expect(movementsSource).toContain("riferimento: pagamentoMultiplo.riferimento.trim() || undefined");
    expect(movementsSource).toContain("note: pagamentoMultiplo.note.trim() || undefined");
  });
});
