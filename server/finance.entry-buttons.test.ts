import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const finanzaSource = readFileSync(
  new URL("../client/src/pages/Finanza.tsx", import.meta.url),
  "utf8",
);
const serviceWorker = readFileSync(
  new URL("../client/public/sw.js", import.meta.url),
  "utf8",
);

describe("Riquadri inserimento Finanza", () => {
  it("sostituisce Nuovo con Manuale mantenendo la route esistente", () => {
    expect(finanzaSource).toContain('label="Manuale"');
    expect(finanzaSource).toContain('setLocation("/finanza/nuovo")');
    expect(finanzaSource).toContain("finance-manual-entry_50e37e4c.png");
    expect(finanzaSource).not.toContain('<ActionButton icon={Plus} label="Nuovo"');
    expect(finanzaSource).not.toContain("<Plus size={15} /> Nuovo");
  });

  it("predispone Inserimento AI senza aprire una schermata vuota", () => {
    expect(finanzaSource).toContain('label="Inserim. AI"');
    expect(finanzaSource).toContain('status="In arrivo"');
    expect(finanzaSource).toContain("Inserimento AI in preparazione");
    expect(finanzaSource).toContain("finance-ai-entry_833a1992.png");
  });

  it("mantiene dimensioni uniformi e rende disponibili le icone offline", () => {
    expect(finanzaSource).toContain('min-h-[60px]');
    expect(finanzaSource).toContain("grid grid-cols-4 gap-2");
    expect(serviceWorker).toContain("finance-manual-entry_50e37e4c.png");
    expect(serviceWorker).toContain("finance-ai-entry_833a1992.png");
  });
});
