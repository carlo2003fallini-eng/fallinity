import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reintegraSource = readFileSync(
  new URL("../client/src/pages/finanza/Reintegrazione.tsx", import.meta.url),
  "utf8",
);

describe("Fondo Reintegrazione — contratto markup", () => {
  it("non annida un anchor dentro il componente Link", () => {
    expect(reintegraSource).not.toMatch(/<Link[^>]*>\s*<a[\s>]/s);
  });

  it("espone un link Indietro accessibile verso Finanza", () => {
    expect(reintegraSource).toContain('href="/finanza"');
    expect(reintegraSource).toContain('aria-label="Torna alla Finanza"');
  });
});
