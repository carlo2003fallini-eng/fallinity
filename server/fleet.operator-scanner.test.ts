import { describe, expect, it } from "vitest";
import { findArticleByScanCode, normalizeScanCode } from "../client/src/pages/officina/scanner";

const articles = [
  { id: "a1", codice: "FILTRO-OLIO 01", nome: "Filtro olio" },
  { id: "a2", codice: "IT-QR-200", nome: "Kit QR" },
];

describe("scanner Menù operatore", () => {
  it("normalizza separatori, spazi e maiuscole", () => {
    expect(normalizeScanCode(" filtro-olio 01 ")).toBe("FILTROOLIO01");
  });

  it("trova un articolo dal barcode normalizzato", () => {
    expect(findArticleByScanCode(articles, "filtro olio 01")?.id).toBe("a1");
  });

  it("legge il codice da un QR che contiene una URL con parametro barcode", () => {
    expect(findArticleByScanCode(articles, "https://fallinity.local/ricambio?barcode=IT-QR-200")?.id).toBe("a2");
  });

  it("non seleziona articoli senza codice o codici non presenti", () => {
    expect(findArticleByScanCode([{ id: "empty", codice: null, nome: "Senza codice" }], "empty")).toBeUndefined();
    expect(findArticleByScanCode(articles, "non-esistente")).toBeUndefined();
  });
});
