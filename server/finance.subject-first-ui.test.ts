import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../client/src/pages/finanza/NuovoMovimento.tsx", import.meta.url),
  "utf8",
);

describe("Nuovo Movimento — soggetto prima e data persistente", () => {
  it("mostra Cliente/Fornitore prima della Categoria", () => {
    const subjectPosition = source.indexOf('label={`${tipo === "entrata" ? "Cliente" : "Fornitore"} *`}');
    const categoryPosition = source.indexOf('label="Categoria *"');
    expect(subjectPosition).toBeGreaterThan(-1);
    expect(categoryPosition).toBeGreaterThan(subjectPosition);
  });

  it("usa l’ultimo movimento del soggetto per categoria e centro di costo", () => {
    expect(source).toContain("movimenti.lastForSubject.useQuery");
    expect(source).toContain("setCategoriaId(ultimoMovimento.categoriaId");
    expect(source).toContain("setCentroCostoId(ultimoMovimento.centroCostoId");
    expect(source).toContain("Puoi modificarli");
  });

  it("blocca la classificazione fino alla selezione del soggetto", () => {
    expect(source.match(/disabled=\{!soggettoId\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain("!soggettoId || !categoriaId");
  });

  it("salva e ripristina la data senza reimpostarla dopo il salvataggio", () => {
    expect(source).toContain("dataDocumento: string");
    expect(source).toContain("last.dataDocumento || new Date()");
    expect(source).toContain("soggettoId, contoId, metodoId, descrizione, dataDocumento");
    expect(source).not.toContain("setDataDocumento(new Date()");
  });
});
