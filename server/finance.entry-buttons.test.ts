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
const appSource = readFileSync(
  new URL("../client/src/App.tsx", import.meta.url),
  "utf8",
);
const automaticPage = readFileSync(
  new URL("../client/src/pages/finanza/NuovoMovimentoAutomatico.tsx", import.meta.url),
  "utf8",
);

describe("Comandi inserimento nell’header Finanza", () => {
  it("mantiene Manuale e aggiunge Automatico nell’header", () => {
    expect(finanzaSource).toContain("<FinanceEntryActions");
    expect(finanzaSource).toContain('label="Manuale"');
    expect(finanzaSource).toContain('label="Automatico"');
    expect(finanzaSource).toContain('onManual={() => setLocation("/finanza/nuovo")}');
    expect(finanzaSource).toContain('onAutomatic={() => setLocation("/finanza/nuovo-automatico")}');
    expect(finanzaSource).toContain("finance-manual-entry_50e37e4c.png");
    expect(finanzaSource).toContain("finance-ai-entry_833a1992.png");
  });

  it("rimuove i due riquadri duplicati e il vecchio placeholder", () => {
    expect(finanzaSource).not.toContain('<ActionButton imageSrc={MANUAL_ENTRY_ICON}');
    expect(finanzaSource).not.toContain('<ActionButton\n          imageSrc={AI_ENTRY_ICON}');
    expect(finanzaSource).not.toContain('label="Inserim. AI"');
    expect(finanzaSource).not.toContain('status="In arrivo"');
    expect(finanzaSource).not.toContain("Inserimento AI in preparazione");
    expect(finanzaSource).not.toContain('<ActionButton icon={Plus} label="Nuovo"');
  });

  it("usa due pulsanti della stessa altezza e una route automatica reale", () => {
    expect(finanzaSource).toContain('className="flex h-16 min-w-[78px]');
    expect(finanzaSource).toContain('border: "1px solid oklch(0.52 0.12 145 / 0.46)"');
    expect(appSource).toContain('path="/finanza/nuovo-automatico"');
    expect(appSource).toContain("NuovoMovimentoAutomatico");
    expect(automaticPage).toContain("Carica fattura XML");
    expect(automaticPage).toContain("Conferma e registra");
    expect(automaticPage).toContain("fattureAutomatiche.acquisisci.useMutation");
    expect(automaticPage).not.toContain("contenutoBase64}");
    expect(serviceWorker).toContain("finance-manual-entry_50e37e4c.png");
    expect(serviceWorker).toContain("finance-ai-entry_833a1992.png");
  });
});
