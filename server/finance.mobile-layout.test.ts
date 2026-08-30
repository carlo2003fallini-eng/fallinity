import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nuovoMovimentoSource = readFileSync(
  new URL("../client/src/pages/finanza/NuovoMovimento.tsx", import.meta.url),
  "utf8",
);

describe("Finanza — layout mobile Nuovo Movimento", () => {
  it("mantiene la barra Salva Movimento sopra la bottom navigation", () => {
    expect(nuovoMovimentoSource).toContain('className="min-h-screen bg-background pb-48"');
    expect(nuovoMovimentoSource).toContain(
      'className="fixed bottom-16 left-0 right-0 z-30 border-t bg-background/95 p-4 backdrop-blur"',
    );
    expect(nuovoMovimentoSource).not.toContain(
      'className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-20"',
    );
  });
});
