import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const unifiedSource = readFileSync(
  new URL("../client/src/pages/finanza/Reintegrazione.tsx", import.meta.url),
  "utf8",
);
const financeSource = readFileSync(
  new URL("../client/src/pages/Finanza.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../client/src/App.tsx", import.meta.url),
  "utf8",
);

describe("Fondo Reintegrazione — contratto pagina unica", () => {
  it("mostra riepilogo, piani, conti e versamenti nella stessa sezione", () => {
    expect(unifiedSource).toContain("Piani di reintegrazione");
    expect(unifiedSource).toContain("Conti deposito");
    expect(unifiedSource).toContain("Registra accantonamento");
    expect(unifiedSource).not.toContain("<Tabs");
  });

  it("rimane nella tab Reintegrazione di Finanza", () => {
    expect(financeSource).toContain('import Reintegrazione from "./finanza/Reintegrazione"');
    expect(financeSource).toContain('<Reintegrazione />');
    expect(financeSource).toContain('initialTab?: "dashboard" | "reintegrazione"');
  });

  it("non mostra più il riquadro Reintegr. nella Dashboard", () => {
    expect(financeSource).not.toContain('label="Reintegr."');
  });

  it("consolida le route legacy sulla tab interna a Finanza", () => {
    expect(appSource).not.toContain('import Reintegrazione from "./pages/Reintegrazione"');
    expect(appSource).toContain('<Finanza initialTab="reintegrazione" />');
  });

  it("non annida anchor nei componenti Link", () => {
    expect(unifiedSource).not.toMatch(/<Link[^>]*>\s*<a[\s>]/s);
  });
});
