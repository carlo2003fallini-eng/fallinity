import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../client/src/pages/finanza/NuovoMovimento.tsx", import.meta.url),
  "utf8",
);

describe("Nuovo Movimento — soggetto prima e data persistente", () => {
  it("mostra Cliente/Fornitore prima di Centro e Sottocategoria", () => {
    const subjectPosition = source.indexOf('label={`${tipo === "entrata" ? "Cliente" : "Fornitore"} *`}');
    const centerPosition = source.indexOf("Centro di costo *");
    const categoryPosition = source.indexOf('label="Sottocategoria *"');
    expect(subjectPosition).toBeGreaterThan(-1);
    expect(centerPosition).toBeGreaterThan(subjectPosition);
    expect(categoryPosition).toBeGreaterThan(subjectPosition);
    expect(categoryPosition).toBeGreaterThan(centerPosition);
  });

  it("usa l’ultimo movimento del soggetto per categoria e centro di costo", () => {
    expect(source).toContain("movimenti.lastForSubject.useQuery");
    expect(source).toContain("setCategoriaId(ultimoMovimento.categoriaId");
    expect(source).toContain("setCentroCostoId(ultimoMovimento.centroCostoId");
    expect(source).toContain("setContoId(ultimoMovimento.contoId");
    expect(source).toContain("setMetodoId(ultimoMovimento.metodoId");
    expect(source).toContain("Puoi modificarli");
  });

  it("pulisce conto e metodo quando cambia soggetto per evitare dati del soggetto precedente", () => {
    expect(source.match(/setContoId\(""\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/setMetodoId\(""\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("blocca la classificazione fino alla selezione del soggetto", () => {
    expect(source).toContain("disabled={!soggettoId}");
    expect(source).toContain("disabled={!centroCostoId || categorieQuery.isFetching}");
    expect(source).toContain("!centroCostoId");
    expect(source).toContain("!categoriaId");
  });

  it("salva e ripristina la data senza reimpostarla dopo il salvataggio", () => {
    expect(source).toContain("dataDocumento: string");
    expect(source).toContain("last.dataDocumento || new Date()");
    expect(source).toContain("soggettoId, contoId, metodoId, descrizione, dataDocumento");
    expect(source).not.toContain("setDataDocumento(new Date()");
  });
});
