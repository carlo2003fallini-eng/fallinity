import { createHash } from "node:crypto";
import { invokeLLM } from "../../_core/llm";
import type { RigaFatturaXml } from "./invoice-xml";
import { normalizeInvoiceDescription } from "./invoice-xml";

type Category = { id: string; nome: string; tipo: string; attivo: boolean };
type CostCenter = { id: string; nome: string; attivo: boolean };
type Product = { id: string; nome: string; codice: string | null };
type Rule = {
  codiceArticolo: string | null;
  descrizioneNormalizzata: string | null;
  categoriaId: string;
  centroCostoId: string | null;
  destinazione: "costo" | "magazzino" | "investimento" | "altro";
  prodottoId: string | null;
};

export type ClassifiedInvoiceLine = RigaFatturaXml & {
  categoriaId: string | null;
  centroCostoId: string | null;
  destinazione: "costo" | "magazzino" | "investimento" | "altro";
  fonteClassificazione: "storico_codice" | "storico_descrizione" | "regola" | "ai" | "non_classificata";
  confidenza: number;
  prodottoId: string | null;
  aggiornaMagazzino: boolean;
  creaProdotto: boolean;
  nomeProdotto: string | null;
};

export function buildClassificationRuleKey(partitaIva: string | null, codiceArticolo: string | null, descrizione: string): string {
  const supplier = partitaIva?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "senza-id";
  const identity = codiceArticolo
    ? `codice:${codiceArticolo.toUpperCase().replace(/\s+/g, "")}`
    : `descrizione:${normalizeInvoiceDescription(descrizione)}`;
  return createHash("sha256").update(`${supplier}|${identity}`).digest("hex");
}

function matchProduct(line: RigaFatturaXml, products: Product[]): Product | null {
  if (line.codiceArticolo) {
    const code = line.codiceArticolo.toUpperCase().replace(/\s+/g, "");
    const byCode = products.find((product) => product.codice?.toUpperCase().replace(/\s+/g, "") === code);
    if (byCode) return byCode;
  }
  const description = normalizeInvoiceDescription(line.descrizione);
  return products.find((product) => normalizeInvoiceDescription(product.nome) === description) ?? null;
}

const KEYWORD_GROUPS = [
  { line: ["gasolio", "benzina", "adblue", "carburante", "combustibile"], category: ["carbur", "combust", "energia"] },
  { line: ["mangime", "foraggio", "fieno", "razione", "insilato"], category: ["mangim", "aliment", "foragg"] },
  { line: ["farmaco", "vaccino", "veterin", "medicinale"], category: ["veterin", "farmac", "sanit"] },
  { line: ["semente", "sementi", "seme", "piantina"], category: ["sement", "coltur", "agricol"] },
  { line: ["fertilizzante", "concime", "urea", "azoto"], category: ["fertiliz", "concim", "coltur"] },
  { line: ["ricambio", "filtro", "cinghia", "cuscinetto", "lubrificante", "olio motore"], category: ["manuten", "ricamb", "officina"] },
  { line: ["energia elettrica", "elettricita", "metano", "bolletta"], category: ["energia", "utenze"] },
  { line: ["consulenza", "servizio", "assistenza", "canone"], category: ["serviz", "consul"] },
] as const;

function keywordClassification(line: RigaFatturaXml, categories: Category[], centers: CostCenter[]) {
  const description = normalizeInvoiceDescription(line.descrizione);
  const group = KEYWORD_GROUPS.find((item) => item.line.some((keyword) => description.includes(keyword)));
  if (!group) return null;
  const category = categories.find((candidate) => {
    const name = normalizeInvoiceDescription(candidate.nome);
    return group.category.some((keyword) => name.includes(keyword));
  });
  if (!category) return null;
  const center = centers.find((candidate) => {
    const name = normalizeInvoiceDescription(candidate.nome);
    return group.category.some((keyword) => name.includes(keyword));
  });
  return { category, center: center ?? null };
}

async function classifyResidualWithAi(
  lines: ClassifiedInvoiceLine[],
  categories: Category[],
  centers: CostCenter[],
): Promise<Map<number, { categoriaId: string; centroCostoId: string | null; destinazione: "costo" | "magazzino" | "investimento" | "altro"; confidenza: number }>> {
  if (!lines.length || !categories.length) return new Map();
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "Classifica righe di fatture agricole italiane. Non modificare né inferire dati fiscali o importi. Usa soltanto gli ID consentiti. Se il centro non è chiaro usa null. Restituisci esclusivamente JSON conforme allo schema.",
      },
      {
        role: "user",
        content: JSON.stringify({
          categorieConsentite: categories.map(({ id, nome }) => ({ id, nome })),
          centriConsentiti: centers.map(({ id, nome }) => ({ id, nome })),
          righe: lines.map(({ numeroLinea, codiceArticolo, descrizione, unitaMisura }) => ({ numeroLinea, codiceArticolo, descrizione, unitaMisura })),
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "classificazione_righe_fattura",
        strict: true,
        schema: {
          type: "object",
          properties: {
            righe: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  numeroLinea: { type: "integer" },
                  categoriaId: { type: "string" },
                  centroCostoId: { anyOf: [{ type: "string" }, { type: "null" }] },
                  destinazione: { type: "string", enum: ["costo", "magazzino", "investimento", "altro"] },
                  confidenza: { type: "integer", minimum: 0, maximum: 100 },
                },
                required: ["numeroLinea", "categoriaId", "centroCostoId", "destinazione", "confidenza"],
                additionalProperties: false,
              },
            },
          },
          required: ["righe"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") return new Map();
  const parsed = JSON.parse(content) as { righe?: Array<{ numeroLinea: number; categoriaId: string; centroCostoId: string | null; destinazione: string; confidenza: number }> };
  const allowedCategories = new Set(categories.map((item) => item.id));
  const allowedCenters = new Set(centers.map((item) => item.id));
  const result = new Map<number, { categoriaId: string; centroCostoId: string | null; destinazione: "costo" | "magazzino" | "investimento" | "altro"; confidenza: number }>();
  for (const item of parsed.righe ?? []) {
    if (!allowedCategories.has(item.categoriaId)) continue;
    if (item.centroCostoId && !allowedCenters.has(item.centroCostoId)) continue;
    if (!["costo", "magazzino", "investimento", "altro"].includes(item.destinazione)) continue;
    result.set(item.numeroLinea, {
      categoriaId: item.categoriaId,
      centroCostoId: item.centroCostoId,
      destinazione: item.destinazione as "costo" | "magazzino" | "investimento" | "altro",
      confidenza: Math.max(0, Math.min(100, Math.trunc(item.confidenza))),
    });
  }
  return result;
}

export async function classifyInvoiceLines(input: {
  partitaIva: string | null;
  lines: RigaFatturaXml[];
  rules: Rule[];
  categories: Category[];
  centers: CostCenter[];
  products: Product[];
  enableAi?: boolean;
}): Promise<{ lines: ClassifiedInvoiceLine[]; aiUsed: boolean }> {
  const categories = input.categories.filter((item) => item.attivo && (item.tipo === "uscita" || item.tipo === "entrambi"));
  const centers = input.centers.filter((item) => item.attivo);
  const fallbackCategory = categories[0] ?? null;
  let lines: ClassifiedInvoiceLine[] = input.lines.map((line) => {
    const code = line.codiceArticolo?.toUpperCase().replace(/\s+/g, "") ?? null;
    const normalizedDescription = normalizeInvoiceDescription(line.descrizione);
    const historicCode = code
      ? input.rules.find((rule) => rule.codiceArticolo?.toUpperCase().replace(/\s+/g, "") === code)
      : null;
    const historicDescription = !historicCode
      ? input.rules.find((rule) => rule.descrizioneNormalizzata === normalizedDescription)
      : null;
    const rule = historicCode ?? historicDescription;
    const matchedProduct = matchProduct(line, input.products);
    if (rule && categories.some((item) => item.id === rule.categoriaId)) {
      return {
        ...line,
        categoriaId: rule.categoriaId,
        centroCostoId: centers.some((item) => item.id === rule.centroCostoId) ? rule.centroCostoId : null,
        destinazione: rule.destinazione,
        fonteClassificazione: historicCode ? "storico_codice" as const : "storico_descrizione" as const,
        confidenza: 96,
        prodottoId: rule.prodottoId && input.products.some((item) => item.id === rule.prodottoId) ? rule.prodottoId : matchedProduct?.id ?? null,
        aggiornaMagazzino: false,
        creaProdotto: false,
        nomeProdotto: line.descrizione.slice(0, 255),
      };
    }
    const keyword = keywordClassification(line, categories, centers);
    return {
      ...line,
      categoriaId: keyword?.category.id ?? fallbackCategory?.id ?? null,
      centroCostoId: keyword?.center?.id ?? null,
      destinazione: matchedProduct ? "magazzino" as const : "costo" as const,
      fonteClassificazione: keyword ? "regola" as const : "non_classificata" as const,
      confidenza: keyword ? 78 : fallbackCategory ? 25 : 0,
      prodottoId: matchedProduct?.id ?? null,
      aggiornaMagazzino: false,
      creaProdotto: false,
      nomeProdotto: line.descrizione.slice(0, 255),
    };
  });

  const residual = lines.filter((line) => line.fonteClassificazione === "non_classificata");
  let aiUsed = false;
  if (input.enableAi !== false && residual.length && categories.length) {
    try {
      const suggestions = await classifyResidualWithAi(residual, categories, centers);
      if (suggestions.size) {
        aiUsed = true;
        lines = lines.map((line) => {
          const suggestion = suggestions.get(line.numeroLinea);
          if (!suggestion) return line;
          return {
            ...line,
            categoriaId: suggestion.categoriaId,
            centroCostoId: suggestion.centroCostoId,
            destinazione: suggestion.destinazione,
            fonteClassificazione: "ai",
            confidenza: suggestion.confidenza,
          };
        });
      }
    } catch (error) {
      console.warn("[Fatture XML] Classificazione AI non disponibile, applicato fallback deterministico", error);
    }
  }
  return { lines, aiUsed };
}
