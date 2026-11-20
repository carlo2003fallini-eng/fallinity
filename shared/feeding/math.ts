import { z } from "zod";
import type {
  ComparisonSide,
  FeedGroup,
  FeedProduct,
  FeedRecipe,
  NirParams,
  NutrientValue,
} from "./types";

/** All public calculations retain null: an unknown price/analysis is never zero. */
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const nonnegative = (n: unknown): n is number => finite(n) && n >= 0;
const positive = (n: unknown): n is number => finite(n) && n > 0;
const safe = (n: number): number | null => (finite(n) ? n : null);
export const normalizeNutrientKey = (key: string) =>
  key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  ss: ["ss", "dm", "drymatter", "sostanzasecca"],
  umidita: ["umidita", "moisture", "humidity"],
  proteina: [
    "proteina",
    "proteine",
    "protein",
    "proteingrezza",
    "proteinagrezza",
    "proteinegrezze",
    "crudeprotein",
    "pg",
    "cp",
  ],
  ndf: ["ndf"],
  adf: ["adf"],
  amido: ["amido", "starch", "am"],
  zuccheri: ["zuccheri", "sugars", "sugar"],
  grassi: ["grassi", "fat", "ee", "estrattoetereo"],
  ceneri: ["ceneri", "ash"],
  lignina: ["lignina", "lignin", "adl"],
  ndfd: ["ndfd", "digeribilitandf", "ndfdigestibility"],
  undf: ["undf", "ndfindigeribile", "indigestiblendf"],
  enl: [
    "enl",
    "nel",
    "energianettalattazione",
    "energia",
    "netenergylactation",
  ],
};
export function canonicalNutrientKey(key: string): string {
  const normalized = normalizeNutrientKey(key);
  for (const [canonical, options] of Object.entries(aliases)) {
    if (
      options.includes(normalized) ||
      ((canonical === "ndfd" || canonical === "undf") &&
        options.some(a => new RegExp(`^${a}\\d+h?$`).test(normalized)))
    )
      return canonical;
  }
  return normalized;
}
const entriesFor = (params: NirParams, key: string) => {
  const entries = Object.entries(params ?? {}).filter(
    ([k]) => canonicalNutrientKey(k) === canonicalNutrientKey(key)
  );
  const measured = entries.filter(([, value]) => value.value !== null);
  return measured.length ? measured : entries.slice(0, 1);
};
function lookup(params: NirParams, key: string): NutrientValue | undefined {
  const found = entriesFor(params, key);
  return found.length === 1 ? found[0][1] : undefined; // No arbitrary choice among NDFD 24/30/48h.
}
const normalizedUnit = (unit: string) =>
  unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/sostanzasecca/g, "ss")
    .replace(/drymatter|dm/g, "ss");
function percent(value: NutrientValue | undefined): number | null {
  if (!value || !nonnegative(value.value)) return null;
  const unit = normalizedUnit(value.unit);
  const n =
    unit === "%" || unit.startsWith("%")
      ? value.value
      : /^g\/(kg|kgss|kgtq|kgndf)$/.test(unit)
        ? value.value / 10
        : null;
  return n !== null && n <= 100 ? n : null;
}
/** Percent dry matter in the original material, linked to moisture if provided. */
export function dryMatter(params: NirParams): number | null {
  const ss = lookup(params, "ss"),
    moisture = lookup(params, "umidita");
  const d = ss?.basis === "TQ" ? percent(ss) : null;
  const m = moisture?.basis === "TQ" ? percent(moisture) : null;
  if (d !== null && m !== null && Math.abs(d + m - 100) > 0.1) return null;
  return d ?? (m === null ? null : 100 - m);
}
/** Percentage on DM; energy is returned in Mcal/kg DM. NDF-based values require measured NDF. */
export function nutrientOnDm(params: NirParams, key: string): number | null {
  const canonical = canonicalNutrientKey(key);
  if (canonical === "ss") return dryMatter(params);
  if (canonical === "umidita") {
    const dm = dryMatter(params);
    return dm === null ? null : 100 - dm;
  }
  const value = lookup(params, key);
  if (!value || !nonnegative(value.value)) return null;
  if (
    canonical === "enl" ||
    /^(mj|mcal)\/kg/.test(normalizedUnit(value.unit))
  ) {
    const unit = normalizedUnit(value.unit);
    let energy = unit.startsWith("mj/kg")
      ? value.value / 4.184
      : unit.startsWith("mcal/kg")
        ? value.value
        : null;
    if (energy === null || value.basis === "NDF") return null;
    if (value.basis === "TQ") {
      const dm = dryMatter(params);
      if (!positive(dm)) return null;
      energy /= dm / 100;
    }
    return safe(energy);
  }
  const p = percent(value);
  if (p === null) return null;
  if (value.basis === "SS") return p;
  if (value.basis === "TQ") {
    const dm = dryMatter(params);
    return positive(dm) ? safe(p / (dm / 100)) : null;
  }
  if (canonical === "ndf") return null; // Prevent recursion for an invalid NDF expressed as % NDF.
  const ndf = nutrientOnDm(params, "ndf");
  return ndf === null ? null : safe((p * ndf) / 100);
}
/** Explicit warehouse mass conversion, unknown units are not presumed to be kg. */
export function kgFactor(unit: string | null | undefined): number | null {
  const u = unit?.trim().toLowerCase().replace(/\./g, "");
  if (
    ["kg", "chilogrammo", "chilogrammi", "kilogram", "kilograms"].includes(
      u ?? ""
    )
  )
    return 1;
  if (["q", "ql", "qle", "q li", "quintale", "quintali"].includes(u ?? ""))
    return 100;
  if (
    [
      "t",
      "ton",
      "tonn",
      "tonnellata",
      "tonnellate",
      "tonne",
      "tonnes",
    ].includes(u ?? "")
  )
    return 1000;
  return null;
}
export function weightedCost(
  oldQuantity: number,
  oldUnitCost: number | null,
  newQuantity: number,
  newUnitCost: number | null
): number | null {
  if (
    !nonnegative(oldQuantity) ||
    !nonnegative(newQuantity) ||
    !positive(oldQuantity + newQuantity)
  )
    return null;
  if (
    (oldQuantity > 0 && !nonnegative(oldUnitCost)) ||
    (newQuantity > 0 && !nonnegative(newUnitCost))
  )
    return null;
  return safe(
    ((oldQuantity === 0 ? 0 : oldQuantity * oldUnitCost!) +
      (newQuantity === 0 ? 0 : newQuantity * newUnitCost!)) /
      (oldQuantity + newQuantity)
  );
}
export function calculateRecipe(
  recipe: Pick<FeedRecipe, "ingredients">,
  group: Pick<FeedGroup, "nAnimali" | "frequency">,
  products: FeedProduct[]
) {
  const heads = nonnegative(group.nAnimali) ? group.nAnimali : null;
  const frequency = positive(group.frequency) ? group.frequency : null;
  const lines = recipe.ingredients.map(ingredient => {
    const product = products.find(p => p.id === ingredient.productId);
    const kg = nonnegative(ingredient.kgPerHead) ? ingredient.kgPerHead : null;
    // Product.dryMatter is a canonical snapshot, use only when params contain no SS/moisture.
    const hasDm =
      entriesFor(product?.params ?? {}, "ss").length +
        entriesFor(product?.params ?? {}, "umidita").length >
      0;
    const dm = hasDm
      ? dryMatter(product?.params ?? {})
      : nonnegative(product?.dryMatter) && product!.dryMatter! <= 100
        ? product!.dryMatter
        : null;
    const day = kg === null || heads === null ? null : safe(kg * heads);
    return {
      productId: ingredient.productId,
      nome: product?.nome ?? "Alimento non disponibile",
      kgPerHead: kg,
      kgPerDay: day,
      kgPerRun:
        day === null || frequency === null ? null : safe(day / frequency),
      ssKgPerHead:
        kg === null
          ? null
          : kg === 0
            ? 0
            : dm === null
              ? null
              : safe((kg * dm) / 100),
      costPerHead:
        kg === null
          ? null
          : kg === 0
            ? 0
            : nonnegative(product?.prezzoKg)
              ? safe(kg * product!.prezzoKg!)
              : null,
    };
  });
  const sum = (key: keyof (typeof lines)[number]): number | null =>
    !lines.length || lines.some(l => !finite(l[key]))
      ? null
      : safe(lines.reduce((total, l) => total + (l[key] as number), 0));
  const kgPerHead = sum("kgPerHead"),
    kgPerDay = sum("kgPerDay"),
    ssKgPerHead = sum("ssKgPerHead"),
    costPerHead = sum("costPerHead");
  return {
    kgPerHead,
    kgPerDay,
    kgPerRun: sum("kgPerRun"),
    ssKgPerHead,
    ssPercent:
      positive(kgPerHead) && ssKgPerHead !== null
        ? safe((ssKgPerHead / kgPerHead) * 100)
        : null,
    costPerHead,
    costPerDay:
      costPerHead === null || heads === null ? null : safe(costPerHead * heads),
    lines,
  };
}

const labels: Record<string, string> = {
  ss: "Sostanza secca",
  umidita: "Umidità",
  proteina: "Proteina grezza",
  ndf: "NDF",
  adf: "ADF",
  amido: "Amido",
  zuccheri: "Zuccheri",
  grassi: "Grassi",
  ceneri: "Ceneri",
  lignina: "Lignina",
  ndfd: "Digeribilità NDF",
  undf: "NDF indigeribile",
  enl: "Energia netta lattazione",
};
export function nutrientHours(
  key: string,
  value?: NutrientValue
): number | undefined {
  const fromKey = normalizeNutrientKey(key).match(/(\d+)h?$/);
  return value?.hours ?? (fromKey ? Number(fromKey[1]) : undefined);
}
function digestibilityWarning(
  lKey: string,
  left?: NutrientValue,
  rKey?: string,
  right?: NutrientValue
): string | null {
  if (!left || !right) return "Dato non disponibile in entrambe le analisi";
  const lh = nutrientHours(lKey, left),
    rh = nutrientHours(rKey ?? lKey, right);
  const lm = left.method?.trim().toLowerCase(),
    rm = right.method?.trim().toLowerCase();
  if (lh === undefined || rh === undefined)
    return "Tempo di incubazione mancante: confronto diretto non consentito";
  if (lh !== rh)
    return "Tempi di incubazione diversi: confronto diretto non consentito";
  if (!lm || !rm)
    return "Metodo di digeribilità mancante: confronto diretto non consentito";
  return lm !== rm
    ? "Metodi di digeribilità diversi: confronto diretto non consentito"
    : null;
}
function digestibleFraction(
  params: NirParams,
  entry?: [string, NutrientValue]
): number | null {
  if (!entry) return null;
  const [key, value] = entry;
  if (value.basis === "NDF") return percent(value);
  const onDm = nutrientOnDm(params, key),
    ndf = nutrientOnDm(params, "ndf");
  return onDm !== null && positive(ndf) ? safe((onDm / ndf) * 100) : null;
}
export function calculateComparison(
  left: ComparisonSide,
  right: ComparisonSide
) {
  const warnings: string[] = [];
  const addWarning = (warning: string) => {
    if (!warnings.includes(warning)) warnings.push(warning);
  };
  const keys = [
    "ss",
    "umidita",
    "proteina",
    "ndf",
    "adf",
    "amido",
    "ndfd",
    "enl",
    ...Object.keys(left.params),
    ...Object.keys(right.params),
  ];
  const seen = new Set<string>();
  const nutrients: Array<{
    key: string;
    label: string;
    left: number | null;
    right: number | null;
    unit: string;
    warning: string | null;
  }> = [];
  for (const original of keys) {
    const key = canonicalNutrientKey(original);
    if (seen.has(key)) continue;
    seen.add(key);
    const lEntries = entriesFor(left.params, key),
      rEntries = entriesFor(right.params, key);
    const digest = key === "ndfd" || key === "undf";
    const ambiguous = lEntries.length > 1 || rEntries.length > 1;
    let warning: string | null = ambiguous
      ? "Più misure dello stesso parametro: selezionare un tempo e un metodo univoci"
      : null;
    if (digest && !warning)
      warning = digestibilityWarning(
        lEntries[0]?.[0] ?? key,
        lEntries[0]?.[1],
        rEntries[0]?.[0],
        rEntries[0]?.[1]
      );
    let l =
      digest && key === "ndfd"
        ? digestibleFraction(left.params, lEntries[0])
        : nutrientOnDm(left.params, key);
    let r =
      digest && key === "ndfd"
        ? digestibleFraction(right.params, rEntries[0])
        : nutrientOnDm(right.params, key);
    const known = Object.hasOwn(labels, key);
    let unit =
      key === "enl"
        ? "Mcal/kg SS"
        : key === "ndfd"
          ? "% NDF"
          : key === "ss" || key === "umidita"
            ? "% TQ"
            : "% SS";
    if (
      !known &&
      lEntries[0] &&
      rEntries[0] &&
      normalizedUnit(lEntries[0][1].unit) !==
        normalizedUnit(rEntries[0][1].unit)
    )
      warning =
        "Unità differenti o non convertibili: confronto diretto non consentito";
    if (
      !known &&
      percent(lEntries[0]?.[1]) === null &&
      percent(rEntries[0]?.[1]) === null
    ) {
      const lv = lEntries[0]?.[1],
        rv = rEntries[0]?.[1];
      unit = lv?.unit ?? rv?.unit ?? "";
      if (
        lv &&
        rv &&
        lv.basis === rv.basis &&
        normalizedUnit(lv.unit) === normalizedUnit(rv.unit)
      ) {
        l = nonnegative(lv.value) ? lv.value : null;
        r = nonnegative(rv.value) ? rv.value : null;
      } else {
        l = null;
        r = null;
        warning ??=
          "Unità o base non convertibile: parametro non confrontabile";
      }
    }
    if (!warning && (l === null || r === null))
      warning = "Dato non disponibile o base non convertibile";
    if (warning) addWarning(`${labels[key] ?? original}: ${warning}`);
    // Incomparable digestibility is not exposed as a directly comparable numeric pair.
    if (digest && warning) {
      l = null;
      r = null;
    }
    nutrients.push({
      key,
      label: labels[key] ?? original,
      left: l,
      right: r,
      unit,
      warning,
    });
  }
  const lDm = dryMatter(left.params),
    rDm = dryMatter(right.params);
  const lNdfd = entriesFor(left.params, "ndfd"),
    rNdfd = entriesFor(right.params, "ndfd");
  const comparableDigest =
    lNdfd.length === 1 &&
    rNdfd.length === 1 &&
    !digestibilityWarning(lNdfd[0][0], lNdfd[0][1], rNdfd[0][0], rNdfd[0][1]);
  const cost = (side: ComparisonSide, nutrient: string): number | null => {
    const price = side.pricePerQuintal,
      dm = dryMatter(side.params);
    if (!nonnegative(price) || !positive(dm)) return null;
    if (nutrient === "ss") return safe(price / dm);
    let n = nutrientOnDm(side.params, nutrient === "ndfd" ? "ndf" : nutrient);
    if (!positive(n)) return null;
    if (nutrient === "enl") return safe(price / (dm * n));
    if (nutrient === "ndfd") {
      const d = digestibleFraction(
        side.params,
        entriesFor(side.params, "ndfd")[0]
      );
      if (!comparableDigest || !positive(d)) return null;
      n *= d / 100;
    }
    return safe(price / ((dm * n) / 100));
  };
  const economic = ["ss", "proteina", "ndf", "ndfd", "amido", "enl"].map(
    key => {
      const l = cost(left, key),
        r = cost(right, key);
      return {
        key,
        label:
          key === "enl"
            ? "Costo per Mcal ENL"
            : `Costo per kg di ${key === "ndfd" ? "NDF digeribile" : (labels[key] ?? key).toLowerCase()}`,
        left: l,
        right: r,
        diffPercent: positive(l) && r !== null ? safe((r / l - 1) * 100) : null,
      };
    }
  );
  if (!nonnegative(left.pricePerQuintal) || !nonnegative(right.pricePerQuintal))
    addWarning(
      "Prezzo mancante: i costi non sono calcolabili per il prodotto senza prezzo"
    );
  addWarning(
    "I costi per nutriente sono rapporti alternativi e non vanno sommati. Il prezzo equivalente riguarda soltanto la sostanza secca, non la qualità complessiva."
  );
  return {
    nutrients,
    economic,
    equivalentPrice:
      nonnegative(left.pricePerQuintal) && positive(lDm) && positive(rDm)
        ? safe((left.pricePerQuintal * rDm) / lDm)
        : null,
    warnings,
  };
}

/** Shared client/server validation: finite numbers, supported bases and units, no silent coercion. */
export const nirValueSchema = z
  .object({
    value: z.number().finite().min(0).nullable(),
    unit: z.string().trim().min(1).max(40),
    basis: z.enum(["TQ", "SS", "NDF"]),
    method: z.string().trim().min(1).max(160).optional(),
    hours: z.number().finite().positive().max(1000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const unit = normalizedUnit(v.unit);
    const isPercent = unit.startsWith("%"),
      isG = /^g\/(kg|kgss|kgtq|kgndf)$/.test(unit),
      isEnergy = /^(mj|mcal)\/kg(ss|tq)?$/.test(unit);
    if (
      v.value !== null &&
      ((isPercent && v.value > 100) || (isG && v.value > 1000))
    )
      ctx.addIssue({
        code: "custom",
        message: "Concentrazione superiore al 100%",
      });
    if (
      isEnergy &&
      (v.basis === "NDF" ||
        (v.value !== null && v.value > (unit.startsWith("mj") ? 60 : 15)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Energia o base di misura non valida",
      });
    if (
      (unit.includes("ss") && v.basis !== "SS") ||
      (unit.includes("tq") && v.basis !== "TQ") ||
      (unit.includes("ndf") && v.basis !== "NDF")
    )
      ctx.addIssue({
        code: "custom",
        message: "Unità e base di misura incoerenti",
      });
  });
export const nirParamsSchema = z
  .preprocess(
    (raw, ctx) => {
      if (
        raw &&
        typeof raw === "object" &&
        Object.keys(raw).some(k =>
          ["__proto__", "constructor", "prototype"].includes(k)
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Chiave nutrizionale non valida",
        });
        return z.NEVER;
      }
      return raw;
    },
    z.record(z.string().min(1).max(80), nirValueSchema)
  )
  .superRefine((params, ctx) => {
    if (Object.keys(params).length > 80)
      ctx.addIssue({
        code: "custom",
        message: "Massimo 80 parametri per analisi",
      });
    const measuredKeys = new Set<string>();
    for (const [key, value] of Object.entries(params)) {
      const canonical = canonicalNutrientKey(key),
        unit = normalizedUnit(value.unit);
      if (value.value !== null && !["ndfd", "undf"].includes(canonical)) {
        if (measuredKeys.has(canonical))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message:
              "Parametro duplicato sotto un altro nome: usa una sola misura",
          });
        measuredKeys.add(canonical);
      }
      const concentration =
        Object.hasOwn(labels, canonical) && canonical !== "enl";
      if (
        concentration &&
        !(unit.startsWith("%") || /^g\/(kg|kgss|kgtq|kgndf)$/.test(unit))
      )
        ctx.addIssue({
          code: "custom",
          path: [key, "unit"],
          message: "Usa percentuale o g/kg per questa concentrazione",
        });
      if (["ss", "umidita"].includes(canonical) && value.basis !== "TQ")
        ctx.addIssue({
          code: "custom",
          path: [key, "basis"],
          message: "SS e umidità devono riferirsi al tal quale",
        });
      if (canonical === "enl" && !/^(mj|mcal)\/kg(ss|tq)?$/.test(unit))
        ctx.addIssue({
          code: "custom",
          path: [key, "unit"],
          message: "Usa Mcal/kg SS oppure MJ/kg SS",
        });
      const fromKey = normalizeNutrientKey(key).match(/(\d+)h?$/);
      if (
        ["ndfd", "undf"].includes(canonical) &&
        fromKey &&
        value.hours !== undefined &&
        Number(fromKey[1]) !== value.hours
      )
        ctx.addIssue({
          code: "custom",
          path: [key, "hours"],
          message: "Tempo di incubazione incoerente con il parametro",
        });
    }
    const dmEntry = lookup(params, "ss"),
      moistureEntry = lookup(params, "umidita");
    const dm = percent(dmEntry),
      moisture = percent(moistureEntry);
    if (dm !== null && moisture !== null && Math.abs(dm + moisture - 100) > 0.1)
      ctx.addIssue({
        code: "custom",
        message: "Sostanza secca e umidità devono sommare a 100%",
      });
    for (const [key, value] of Object.entries(params)) {
      if (
        !Object.hasOwn(labels, canonicalNutrientKey(key)) ||
        ["ss", "umidita", "enl"].includes(canonicalNutrientKey(key)) ||
        value.value === null
      )
        continue;
      const dmValue = nutrientOnDm(params, key);
      if (dmValue !== null && dmValue > 100 + 0.0001)
        ctx.addIssue({
          code: "custom",
          path: [key, "value"],
          message: "Concentrazione sulla SS superiore al 100%",
        });
    }
  });
export const comparisonSideSchema = z
  .object({
    productId: z.string().min(1).max(64).nullish(),
    nome: z.string().trim().min(1).max(255),
    pricePerQuintal: z.number().finite().min(0).max(1_000_000).nullable(),
    params: nirParamsSchema,
    source: z.string().trim().min(1).max(500),
    nirId: z.string().min(1).max(64).nullish(),
    supplier: z.string().max(255).nullish(),
    lot: z.string().max(255).nullish(),
  })
  .strict();
