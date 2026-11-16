export type ScannableArticle = {
  id: string;
  codice: string | null;
  nome: string;
};

/** Normalizza codici provenienti da barcode, QR e input manuali. */
export function normalizeScanCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function scanCandidates(rawValue: string) {
  const raw = rawValue.trim();
  const values = [raw];
  try {
    const url = new URL(raw);
    for (const key of ["code", "barcode", "sku", "codice"]) {
      const value = url.searchParams.get(key);
      if (value) values.push(value);
    }
    const lastPathPart = url.pathname.split("/").filter(Boolean).at(-1);
    if (lastPathPart) values.push(lastPathPart);
  } catch {
    // Il valore può essere un barcode semplice, non necessariamente una URL.
  }
  return Array.from(new Set(values.map(normalizeScanCode).filter(Boolean)));
}

/** Cerca un articolo del catalogo usando un codice letto dalla fotocamera. */
export function findArticleByScanCode<T extends ScannableArticle>(articles: T[], rawValue: string) {
  const candidates = scanCandidates(rawValue);
  return articles.find((article) => {
    const code = article.codice ? normalizeScanCode(article.codice) : "";
    return code.length > 0 && candidates.includes(code);
  });
}
