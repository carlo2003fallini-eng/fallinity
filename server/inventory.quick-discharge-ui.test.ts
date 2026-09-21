import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../client/src/pages/Magazzino.tsx", import.meta.url),
  "utf8",
);
const routerSource = readFileSync(
  new URL("./domains/inventory/router.ts", import.meta.url),
  "utf8",
);

describe("Magazzino — interfaccia scarico rapido", () => {
  it("memorizza la posizione operativa locale", () => {
    expect(pageSource).toContain("fallinity:magazzino:position:v1");
    expect(pageSource).toContain("window.localStorage.setItem");
    expect(pageSource).toContain("categoria: catFilter");
    expect(pageSource).toContain("sottocategoria: subcatFilter");
  });

  it("espone direttamente Scarico e Dettagli dalla riga espandibile", () => {
    expect(pageSource).toContain("expandedProductId");
    expect(pageSource).toContain('aria-controls={`azioni-prodotto-${product.id}`}');
    expect(pageSource).toContain("Scarico");
    expect(pageSource).toContain("Dettagli");
    expect(pageSource).not.toContain("Carico manuale");
  });

  it("precompila il popup, conferma senza secondo dialogo e usa un toast", () => {
    expect(pageSource).toContain("ultimoScaricoQuantita");
    expect(pageSource).toContain("Scarico prodotto");
    expect(pageSource).toContain("Quantità da rimuovere");
    expect(pageSource).toContain("Causale (opzionale)");
    expect(pageSource).toContain("Note (opzionali)");
    expect(pageSource).toContain("Conferma scarico");
    expect(pageSource).toContain('toast.success("Scarico confermato"');
    expect(pageSource).toContain("setDischargeProductId(null)");
  });

  it("collega la UI al contratto server dedicato", () => {
    expect(pageSource).toContain("trpc.magazzino.scaricaRapido.useMutation");
    expect(routerSource).toContain("scaricaRapido:");
  });
});
