import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import sharp from "sharp";
import {
  calculateComparison,
  calculateRecipe,
  dryMatter,
  kgFactor,
  nutrientOnDm,
  nirParamsSchema,
  weightedCost,
} from "../shared/feeding/math";
import type {
  ComparisonSide,
  FeedData,
  FeedGroup,
  FeedNir,
  FeedProduct,
  FeedRecipe,
  FeedingPermissions,
  NirParams,
  NutrientValue,
} from "../shared/feeding/types";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  storagePut: vi.fn(),
  signed: vi.fn(),
  llm: vi.fn(),
  catalog: vi.fn(),
  load: vi.fn(),
  profile: vi.fn(),
  permissions: vi.fn(),
  policy: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb, getActiveCompanyId: vi.fn() }));
vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
  storageGetSignedUrl: mocks.signed,
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.llm,
  listLLMModels: mocks.catalog,
}));
vi.mock("./domains/access/service", () => ({
  accessService: { profile: mocks.profile },
}));
vi.mock("./domains/access/repository", () => ({
  accessRepository: { getPermissions: mocks.permissions },
}));
vi.mock("./domains/feeding/permissions", () => ({
  feedingPermissions: mocks.policy,
}));
vi.mock("./domains/feeding/service", () => ({ loadFeedingData: mocks.load }));
import {
  activateNir,
  documentNir,
  extractNir,
  intelligence,
  intelligenceContext,
  nirInputSchema,
  resolveComparison,
  saveComparison,
  saveNir,
  uploadNirDocument,
  validateNirDocument,
  validateNirDocumentKey,
} from "./domains/feeding/nutrition";

const actor = {
  companyId: "company-n99",
  userId: 99,
  userUuid: "operator-n99",
};
const permission = (
  patch: Partial<FeedingPermissions> = {}
): FeedingPermissions => ({
  canView: true,
  canOperate: true,
  canManage: true,
  canSeeCosts: true,
  canNir: true,
  companyId: actor.companyId,
  userId: actor.userId,
  ...patch,
});
const value = (
  n: number | null,
  basis: NutrientValue["basis"] = "SS",
  unit = "%",
  more: Partial<NutrientValue> = {}
): NutrientValue => ({ value: n, basis, unit, ...more });
const params = (dm = 34): NirParams => ({
  ss: value(dm, "TQ"),
  humidity: value(100 - dm, "TQ"),
  protein: value(8),
  ndf: value(42),
  starch: value(32),
  ndfd: value(50, "NDF", "%", { hours: 30, method: "in vitro" }),
  enl: value(1.6, "SS", "Mcal/kg SS"),
});
const product = (id = "p1", patch: Partial<FeedProduct> = {}): FeedProduct => ({
  id,
  nome: `Alimento ${id}`,
  codice: null,
  categoria: "Alimenti",
  unitaMisura: "kg",
  quantity: 42000,
  quantityKg: 42000,
  unitToKg: 1,
  prezzoKg: 0.09,
  costSource: "Costo medio Magazzino",
  lastPriceKg: 0.1,
  fornitoreId: null,
  fornitore: null,
  immagineUrl: null,
  nirId: "n1",
  params: params(),
  dryMatter: 34,
  dailyUseKg: 4200,
  autonomyDays: 10,
  autonomyStatus: "in uso",
  purchases: [],
  ...patch,
});
const group = (patch: Partial<FeedGroup> = {}): FeedGroup => ({
  id: "g1",
  nome: "Gruppo",
  tipologia: "lattazione",
  foto: null,
  nAnimali: 85,
  inLattazione: 85,
  animalIds: [],
  frequency: 2,
  frequencySource: "configurata",
  frequencyReliability: "configurata",
  lastDistributionAt: null,
  nextDistributionAt: null,
  activeRecipeId: "r1",
  overlaps: [],
  ...patch,
});
const recipe = (ingredients = [25, 5, 8, 3, 1]): FeedRecipe => ({
  id: "r1",
  rootId: "r1",
  groupId: "g1",
  nome: "Ricetta",
  version: 1,
  status: "attiva",
  validFrom: null,
  createdAt: 1,
  updatedAt: 1,
  responsible: null,
  ingredients: ingredients.map((kgPerHead, order) => ({
    productId: `p${order + 1}`,
    kgPerHead,
    order,
  })),
  note: null,
});
const side = (price = 9, dm = 34): ComparisonSide => ({
  nome: "Alimento",
  productId: null,
  pricePerQuintal: price,
  params: params(dm),
  source: "referto verificato",
});
const data = (patch: Partial<FeedData> = {}): FeedData => ({
  groups: [group()],
  products: [product()],
  recipes: [recipe([25])],
  runs: [],
  distributions: [],
  leftovers: [],
  containers: [],
  settings: [],
  nirAnalyses: [],
  comparisons: [],
  milkRecords: [],
  summary: {
    autonomyDays: null,
    limitingProduct: null,
    fedAnimals: 0,
    averageRunsPerDay: null,
    todayRuns: 0,
    undistributedRuns: 0,
    warnings: [],
    coverage: "nessun evento",
  },
  permissions: permission(),
  ...patch,
});
const docKey =
  "companies/company-n99/feeding/nir/p1/11111111-1111-4111-8111-111111111111_abcdef12.pdf";
const pdf = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
);
const nir = (id: string, active = false): FeedNir => ({
  id,
  productId: "p1",
  at: 1000,
  responsible: null,
  laboratory: null,
  lot: null,
  trench: null,
  sample: null,
  method: null,
  params: params(),
  active,
  documentKey: docKey,
  note: null,
  operatorId: actor.userUuid,
});
const aiResponse = (output: unknown) => ({
  choices: [
    { finish_reason: "stop", message: { content: JSON.stringify(output) } },
  ],
});

/** Queue-only DB stub. No getDb from production can ever be called by this suite. */
function mockDb(reads: unknown[][] = [[{ id: 99, uuid: actor.userUuid }]]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const writes: Array<{
    type: string;
    table: unknown;
    values: any;
    where?: unknown;
  }> = [];
  const dialect = new MySqlDialect();
  const db: any = {
    select: vi.fn(() => {
      const q: any = {
        from: vi.fn(() => q),
        where: vi.fn((condition: any) => {
          queries.push(dialect.sqlToQuery(condition));
          return q;
        }),
        limit: vi.fn(() => q),
        for: vi.fn(() => q),
        then: (resolve: any, reject: any) =>
          Promise.resolve(reads.shift() ?? []).then(resolve, reject),
      };
      return q;
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: any) => {
        writes.push({ type: "insert", table, values });
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(async (where: any) => {
          queries.push(dialect.sqlToQuery(where));
          writes.push({ type: "update", table, values, where });
        }),
      })),
    })),
    transaction: vi.fn(async (fn: any) => fn(db)),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, writes, queries };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.policy.mockReturnValue(permission());
  mocks.profile.mockResolvedValue({});
  mocks.permissions.mockResolvedValue([]);
  mocks.load.mockResolvedValue(data());
  mocks.catalog.mockResolvedValue({ data: [{ id: "gpt-6.1-sol" }] });
  mocks.signed.mockResolvedValue(
    "https://private-storage.example.test/signed-object?signature=test"
  );
  mocks.storagePut.mockImplementation(async (key: string) => ({
    key,
    url: `/manus-storage/${key}`,
  }));
  mockDb();
});

describe("F99 unità e ricetta documentata §5.5", () => {
  it.each([
    ["kg", 1],
    [" KG ", 1],
    ["q", 100],
    ["quintali", 100],
    ["t", 1000],
    ["tonnellate", 1000],
    ["sacco", null],
    [null, null],
  ])("converte %s solo quando la conversione è esplicita", (unit, expected) =>
    expect(kgFactor(unit as string | null)).toBe(expected)
  );
  it("calcola i 42 kg/capo, 3570 kg/giorno e 1785 kg/carro del requisito senza alterare input", () => {
    const r = recipe(),
      g = group(),
      products = [1, 2, 3, 4, 5].map(n =>
        product(`p${n}`, { params: { ss: value(50, "TQ") }, prezzoKg: 0.1 })
      );
    const original = JSON.stringify({ r, g, products });
    const result = calculateRecipe(r, g, products);
    expect(result).toMatchObject({
      kgPerHead: 42,
      kgPerDay: 3570,
      kgPerRun: 1785,
      ssKgPerHead: 21,
      ssPercent: 50,
    });
    expect(result.costPerHead).toBeCloseTo(4.2, 12);
    expect(result.costPerDay).toBeCloseTo(357, 12);
    expect(result.lines[0]).toMatchObject({
      kgPerDay: 2125,
      kgPerRun: 1062.5,
      ssKgPerHead: 12.5,
      costPerHead: 2.5,
    });
    expect(JSON.stringify({ r, g, products })).toBe(original);
  });
  it("un carro ogni tre giorni non viene scambiato per una razione giornaliera", () => {
    expect(
      calculateRecipe(recipe([10]), group({ nAnimali: 60, frequency: 1 / 3 }), [
        product(),
      ])
    ).toMatchObject({ kgPerDay: 600, kgPerRun: 1800 });
  });
  it("mantiene null per frequenza, costi e NIR mancanti, incluso prodotto rimosso", () => {
    const result = calculateRecipe(recipe([10]), group({ frequency: null }), [
      product("p1", { prezzoKg: null, dryMatter: null, params: {} }),
    ]);
    expect(result).toMatchObject({
      kgPerHead: 10,
      kgPerRun: null,
      costPerHead: null,
      costPerDay: null,
      ssKgPerHead: null,
      ssPercent: null,
    });
    expect(calculateRecipe(recipe([10]), group(), []).lines[0]).toMatchObject({
      nome: "Alimento non disponibile",
      costPerHead: null,
      ssKgPerHead: null,
    });
  });
  it("non crea totali zero per una ricetta vuota", () =>
    expect(calculateRecipe(recipe([]), group(), [])).toMatchObject({
      kgPerHead: null,
      costPerHead: null,
      ssPercent: null,
    }));
  it("ricette con quantità invalide non generano NaN o costi negativi", () => {
    const result = calculateRecipe(recipe([NaN]), group(), [product()]);
    expect(result.kgPerHead).toBeNull();
    expect(result.costPerHead).toBeNull();
    expect(JSON.stringify(result)).not.toContain("NaN");
  });
  it("media ponderata su residuo 42000×.09 + acquisto 20000×.10", () =>
    expect(weightedCost(42000, 0.09, 20000, 0.1)).toBeCloseTo(
      5780 / 62000,
      12
    ));
  it("costo mancante del residuo positivo invalida la media ma residuo zero non lo fa", () => {
    expect(weightedCost(42000, null, 20000, 0.1)).toBeNull();
    expect(weightedCost(0, null, 20000, 0.1)).toBe(0.1);
    expect(weightedCost(0, null, 0, null)).toBeNull();
    expect(weightedCost(-1, 1, 5, 1)).toBeNull();
    expect(weightedCost(4, Infinity, 5, 1)).toBeNull();
  });
});

describe("F99 basi TQ, SS, NDF e validazione", () => {
  it("SS/umidità reciproche, g/kg e dati mancanti", () => {
    expect(dryMatter({ humidity: value(660, "TQ", "g/kg") })).toBe(34);
    expect(
      dryMatter({ ss: value(34, "TQ"), humidity: value(60, "TQ") })
    ).toBeNull();
    expect(dryMatter({ ss: value(null, "TQ") })).toBeNull();
    expect(dryMatter({ ss: value(100, "SS") })).toBeNull();
  });
  it("converte proteina TQ e g/kg in percentuale SS, non confonde base NDF", () => {
    expect(
      nutrientOnDm(
        { ss: value(40, "TQ"), protein: value(80, "TQ", "g/kg") },
        "proteina"
      )
    ).toBe(20);
    expect(
      nutrientOnDm(
        { ss: value(40, "TQ"), protein: value(200, "SS", "g/kg") },
        "protein"
      )
    ).toBe(20);
    expect(
      nutrientOnDm({ ndf: value(40), undf: value(25, "NDF") }, "undf")
    ).toBe(10);
    expect(nutrientOnDm({ undf: value(25, "NDF") }, "undf")).toBeNull();
    expect(nutrientOnDm({ ndf: value(100, "NDF") }, "ndf")).toBeNull();
    expect(
      nutrientOnDm({ ss: value(0, "TQ"), protein: value(10, "TQ") }, "protein")
    ).toBeNull();
  });
  it("energia MJ→Mcal e base tal quale→SS", () => {
    expect(
      nutrientOnDm({ enl: value(6.6944, "SS", "MJ/kg SS") }, "enl")
    ).toBeCloseTo(1.6, 12);
    expect(
      nutrientOnDm(
        { ss: value(40, "TQ"), enl: value(2.67776, "TQ", "MJ/kg TQ") },
        "enl"
      )
    ).toBeCloseTo(1.6, 12);
  });
  it("un alias nullo del frontend non nasconde la misura reale", () =>
    expect(
      nutrientOnDm({ protein: value(null), pg: value(18) }, "protein")
    ).toBe(18));
  it.each([
    { ss: value(120, "TQ") },
    { ss: value(34, "SS") },
    { ss: value(34, "TQ"), humidity: value(60, "TQ") },
    { protein: value(Infinity) },
    { protein: value(-1) },
    { protein: value(1001, "SS", "g/kg") },
    { enl: value(5, "TQ", "MJ/kg SS") },
    { ndfd30h: value(40, "NDF", "%", { hours: 48 }) },
    { ss: value(20, "TQ"), protein: value(30, "TQ") },
    { protein: value(18), pg: value(20) },
  ])("rifiuta parametro non valido %#", p =>
    expect(nirParamsSchema.safeParse(p).success).toBe(false)
  );
  it("rifiuta chiavi pericolose e richiede conferma e almeno un valore", () => {
    expect(
      nirParamsSchema.safeParse(
        JSON.parse('{"__proto__":{"value":1,"unit":"%","basis":"SS"}}')
      ).success
    ).toBe(false);
    expect(
      nirInputSchema.safeParse({
        productId: "p1",
        at: 1000,
        params: params(),
        confirm: false,
      }).success
    ).toBe(false);
    expect(
      nirInputSchema.safeParse({
        productId: "p1",
        at: 1000,
        params: { ss: value(null, "TQ") },
        confirm: true,
      }).success
    ).toBe(false);
    expect(
      nirInputSchema.safeParse({
        productId: "p1",
        at: 1000,
        params: params(),
        confirm: true,
      }).success
    ).toBe(true);
  });
});

describe("F99 confronto formule §21.1–21.2", () => {
  it("calcola tutti i costi, incluso NDF digeribile ed energia, e prezzo equivalente solo SS", () => {
    const result = calculateComparison(side(), side(8.5, 30));
    const economic = Object.fromEntries(result.economic.map(r => [r.key, r]));
    expect(economic.ss.left).toBeCloseTo(9 / 34, 12);
    expect(economic.ss.right).toBeCloseTo(8.5 / 30, 12);
    expect(economic.ss.diffPercent).toBeCloseTo(
      (8.5 / 30 / (9 / 34) - 1) * 100,
      12
    );
    expect(economic.proteina.left).toBeCloseTo(9 / ((34 * 8) / 100), 12);
    expect(economic.ndf.left).toBeCloseTo(9 / ((34 * 42) / 100), 12);
    expect(economic.ndfd.left).toBeCloseTo(
      9 / ((((34 * 42) / 100) * 50) / 100),
      12
    );
    expect(economic.amido.left).toBeCloseTo(9 / ((34 * 32) / 100), 12);
    expect(economic.enl.left).toBeCloseTo(9 / (34 * 1.6), 12);
    expect(result.equivalentPrice).toBeCloseTo((9 * 30) / 34, 12);
  });
  it("i parametri inglesi della UI e proteina TQ sono normalizzati", () => {
    const left = side();
    left.params.protein = value(2.72, "TQ");
    expect(
      calculateComparison(left, side()).nutrients.find(
        n => n.key === "proteina"
      )?.left
    ).toBeCloseTo(8, 12);
  });
  it("energia MJ produce lo stesso costo Mcal", () => {
    const right = side();
    right.params.enl = value(6.6944, "SS", "MJ/kg SS");
    expect(
      calculateComparison(side(), right).economic.find(r => r.key === "enl")
        ?.diffPercent
    ).toBeCloseTo(0, 12);
  });
  it("prezzi missing/null non diventano costo zero", () => {
    const left = { ...side(), pricePerQuintal: null };
    const result = calculateComparison(left, side());
    expect(
      result.economic.every(r => r.left === null && r.diffPercent === null)
    ).toBe(true);
    expect(result.equivalentPrice).toBeNull();
    expect(result.warnings.join(" ")).toContain("Prezzo mancante");
  });
  it("denominatori zero, null ed energia assente non producono infinito", () => {
    const left = side();
    left.params.ss = value(0, "TQ");
    left.params.humidity = value(100, "TQ");
    const result = calculateComparison(left, side());
    expect(result.economic.every(r => r.left === null)).toBe(true);
    expect(result.equivalentPrice).toBeNull();
    const free = calculateComparison(side(0), side());
    expect(free.economic.every(r => r.diffPercent === null)).toBe(true);
    const missing = side();
    missing.params.enl.value = null;
    expect(
      calculateComparison(side(), missing).economic.find(r => r.key === "enl")
        ?.right
    ).toBeNull();
  });
  it.each([
    { hours: 48, method: "in vitro" },
    { hours: 30, method: "in situ" },
    { hours: undefined, method: "in vitro" },
    { hours: 30, method: undefined },
  ])(
    "non confronta direttamente NDFD con ore/metodi incompatibili %#",
    more => {
      const right = side();
      right.params.ndfd = value(50, "NDF", "%", more);
      const result = calculateComparison(side(), right);
      const nutrient = result.nutrients.find(n => n.key === "ndfd");
      expect(nutrient?.left).toBeNull();
      expect(nutrient?.right).toBeNull();
      expect(nutrient?.warning).toBeTruthy();
      expect(result.economic.find(n => n.key === "ndfd")).toMatchObject({
        left: null,
        right: null,
        diffPercent: null,
      });
    }
  );
  it("NDFD espresso su SS è convertito in percentuale della NDF", () => {
    const right = side();
    right.params.ndfd = value(21, "SS", "%", { hours: 30, method: "in vitro" });
    const result = calculateComparison(side(), right);
    expect(result.nutrients.find(n => n.key === "ndfd")?.right).toBe(50);
    expect(
      result.economic.find(n => n.key === "ndfd")?.diffPercent
    ).toBeCloseTo(0, 12);
  });
  it("misure NDFD multiple e uNDF con tempi differenti non sono comparate arbitrariamente", () => {
    const left = side(),
      right = side();
    left.params.ndfd24h = value(40, "NDF", "%", {
      hours: 24,
      method: "in vitro",
    });
    left.params.undf = value(10, "SS", "%", { hours: 240, method: "in vitro" });
    right.params.undf = value(10, "SS", "%", {
      hours: 120,
      method: "in vitro",
    });
    const result = calculateComparison(left, right);
    expect(result.nutrients.find(r => r.key === "ndfd")?.warning).toContain(
      "Più misure"
    );
    expect(result.nutrients.find(r => r.key === "undf")?.right).toBeNull();
  });
});

describe("F99 NIR privato e snapshot (servizi mocked)", () => {
  it("salvataggio senza conferma non legge né scrive DB", async () => {
    const untrusted = {
      productId: "p1",
      at: 1000,
      params: params(),
      confirm: false,
    } as unknown as Parameters<typeof saveNir>[1];
    await expect(saveNir(actor, untrusted)).rejects.toThrow();
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("nega NIR a operatore non autorizzato", async () => {
    mocks.policy.mockReturnValue(permission({ canNir: false }));
    const db = mockDb();
    await expect(
      saveNir(actor, {
        productId: "p1",
        at: 1000,
        params: params(),
        confirm: true,
      })
    ).rejects.toThrow("Non sei autorizzato");
    expect(db.writes).toHaveLength(0);
  });
  it("crea snapshot nuovo, disattiva solo il flag precedente in transazione, preserva parametri", async () => {
    const old = nir("old", true);
    const original = structuredClone(old);
    const db = mockDb([
      [{ id: 99, uuid: actor.userUuid }],
      [{ id: "p1" }],
      [{ id: "old", payload: old }],
    ]);
    const result = await saveNir(actor, {
      productId: "p1",
      at: 1000,
      params: params(),
      activate: true,
      confirm: true,
    });
    expect(db.db.transaction).toHaveBeenCalledTimes(1);
    expect(db.writes.map(w => w.type)).toEqual(["update", "insert"]);
    expect(db.writes[0].values.payload).toEqual({ ...original, active: false });
    expect(old).toEqual(original);
    expect(db.writes[1].values).toMatchObject({
      id: result.id,
      companyId: actor.companyId,
      createdBy: actor.userUuid,
      productId: "p1",
      at: 1000,
      payload: { active: true },
    });
    expect(
      db.queries.every(
        q =>
          q.params.includes(actor.companyId) || q.params.includes(actor.userId)
      )
    ).toBe(true);
  });
  it("attivazione usa lock sul prodotto e non riscrive parametri dello snapshot", async () => {
    const target = nir("target"),
      old = nir("old", true);
    const db = mockDb([
      [{ id: 99, uuid: actor.userUuid }],
      [{ id: "target", payload: target }],
      [{ id: "p1" }],
      [
        { id: "target", payload: target },
        { id: "old", payload: old },
      ],
    ]);
    await activateNir(actor, "target");
    expect(db.db.transaction).toHaveBeenCalledOnce();
    expect(db.writes).toHaveLength(2);
    expect(db.writes[0].values.payload).toEqual({ ...target, active: true });
    expect(db.writes[1].values.payload).toEqual({ ...old, active: false });
  });
  it("alimento assente non crea analisi né aggiorna Magazzino", async () => {
    const db = mockDb([[{ id: 99, uuid: actor.userUuid }], []]);
    await expect(
      saveNir(actor, {
        productId: "foreign",
        at: 1000,
        params: params(),
        confirm: true,
      })
    ).rejects.toThrow("Alimento non trovato");
    expect(db.writes).toHaveLength(0);
    expect(db.queries.at(-1)?.params).toContain(actor.companyId);
  });
  it.each([
    docKey.replace("company-n99", "company-other"),
    docKey.replace("/p1/", "/p2/"),
    "https://evil.test/a.pdf",
    docKey.replace("/p1/", "/p1/../p1/"),
    docKey + "?key=1",
    docKey.replace(".pdf", ".svg"),
  ])("nega document key esterna/traversal %#", key =>
    expect(() => validateNirDocumentKey(actor, "p1", key)).toThrow()
  );
  it("upload preserva byte originali e restituisce solo signed URL dopo ownership", async () => {
    const db = mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    const result = await uploadNirDocument(actor, {
      productId: "p1",
      name: "referto.pdf",
      mime: "application/pdf",
      base64: pdf.toString("base64"),
    });
    expect(mocks.storagePut.mock.calls[0][1]).toEqual(pdf);
    expect(result.documentKey).toMatch(
      /^companies\/company-n99\/feeding\/nir\/p1\//
    );
    expect(result.url).toMatch(/^https:/);
    expect(db.writes).toHaveLength(0);
  });
  it("validazione reale immagini accetta PNG integra, verifica MIME/magic e byte originali", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const result = await validateNirDocument({
      productId: "p1",
      name: "lab.png",
      mime: "image/png",
      base64: png.toString("base64"),
    });
    expect(result.bytes).toEqual(png);
    await expect(
      validateNirDocument({
        productId: "p1",
        name: "lab.jpg",
        mime: "image/jpeg",
        base64: png.toString("base64"),
      })
    ).rejects.toThrow("formato dichiarato");
  });
  it.each([
    "%%%%",
    "PGh0bWw+ZXZpbDwvaHRtbD4=",
    Buffer.from("%PDF-1.7 incomplete").toString("base64"),
    Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64"),
  ])("rifiuta base64/magic/incomplete/oversize %#", async base64 => {
    await expect(
      validateNirDocument({
        productId: "p1",
        name: "lab.pdf",
        mime: "application/pdf",
        base64,
      })
    ).rejects.toThrow();
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });
  it("documento analisi estranea non emette URL firmato", async () => {
    mockDb([[{ id: 99, uuid: actor.userUuid }], []]);
    await expect(documentNir(actor, "foreign")).rejects.toThrow(
      "Analisi non trovata"
    );
    expect(mocks.signed).not.toHaveBeenCalled();
  });
  it("estrazione rifiuta URL terzo prima di fetch o LLM", async () => {
    mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      extractNir(actor, {
        productId: "p1",
        documentKey: "https://evil.test/report.pdf",
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("download estrazione oltre 5MB viene bloccato prima del modello", async () => {
    mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(pdf, {
          status: 200,
          headers: { "content-length": String(5 * 1024 * 1024 + 1) },
        })
      )
    );
    await expect(
      extractNir(actor, { productId: "p1", documentKey: docKey })
    ).rejects.toThrow("superiore a 5 MB");
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("estrazione structured safeoutput mantiene mancanti null e non salva né attiva", async () => {
    const db = mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(pdf, { status: 200 }))
    );
    mocks.llm.mockResolvedValue(
      aiResponse({
        parameters: [
          {
            key: "ss",
            value: 34,
            unit: "%",
            basis: "TQ",
            method: null,
            hours: null,
          },
        ],
        notes: "Referto",
      })
    );
    const result = await extractNir(actor, {
      productId: "p1",
      documentKey: docKey,
    });
    expect(result.params.ss.value).toBe(34);
    expect(result.params.proteina.value).toBeNull();
    expect(result.params.ndfd.value).toBeNull();
    expect(result.notes).toContain("verificare sul referto");
    expect(db.writes).toHaveLength(0);
    expect(mocks.catalog).toHaveBeenCalledOnce();
    expect(mocks.llm.mock.calls[0][0]).toMatchObject({
      model: "gpt-6.1-sol",
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
  });
  it("estrazione schema invalido e modello non disponibile non attivano analisi", async () => {
    const db = mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(pdf)));
    mocks.llm.mockResolvedValue(
      aiResponse({
        parameters: [
          {
            key: "ss",
            value: 120,
            unit: "%",
            basis: "TQ",
            method: null,
            hours: null,
          },
        ],
        notes: "",
      })
    );
    await expect(
      extractNir(actor, { productId: "p1", documentKey: docKey })
    ).rejects.toThrow("controlli");
    expect(db.writes).toHaveLength(0);
    mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "p1" }]]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(pdf)));
    mocks.catalog.mockResolvedValue({ data: [] });
    mocks.llm.mockClear();
    await expect(
      extractNir(actor, { productId: "p1", documentKey: docKey })
    ).rejects.toThrow("modello nutrizione non è disponibile");
    expect(mocks.llm).not.toHaveBeenCalled();
  });
});

describe("F99 confronto storico e Intelligence autorizzata", () => {
  it("left e right aziendali sono riletti, non fidati di prezzo/parametri caller", () => {
    const d = data({
      products: [
        product("p1"),
        product("p2", { prezzoKg: 0.5, params: params(50) }),
      ],
    });
    const resolved = resolveComparison(
      d,
      { ...side(999), productId: "p1", params: {} },
      { ...side(1), productId: "p2", params: {} }
    );
    expect(resolved.left.pricePerQuintal).toBe(9);
    expect(resolved.left.params).toEqual(params());
    expect(resolved.right.pricePerQuintal).toBe(50);
    expect(d.products[0].prezzoKg).toBe(0.09);
  });
  it("non consente left non aziendale o prodotti di altra azienda", () => {
    expect(() => resolveComparison(data(), side(), side())).toThrow(
      "alimento aziendale"
    );
    expect(() =>
      resolveComparison(data(), { ...side(), productId: "foreign" }, side())
    ).toThrow("azienda attiva");
  });
  it("salvare nuova versione conserva parentId e inserisce nuovo id senza update", async () => {
    const db = mockDb([[{ id: 99, uuid: actor.userUuid }], [{ id: "prior" }]]);
    const result = await saveComparison(actor, {
      id: "prior",
      left: { ...side(999), productId: "p1" },
      right: side(8.5, 30),
      confirm: true,
    });
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].type).toBe("insert");
    expect(db.writes[0].values.payload).toMatchObject({
      id: result.id,
      parentId: "prior",
      left: { pricePerQuintal: 9 },
    });
    expect(result.id).not.toBe("prior");
  });
  it("context non autorizzato non invia importi aziendali nemmeno se loader restituisce righe grezze", () => {
    const d = data({
      permissions: permission({ canSeeCosts: false }),
      products: [
        product("p1", {
          prezzoKg: 123.456,
          lastPriceKg: 456.789,
          costSource: "contiene 123.456 euro",
          purchases: [
            {
              invoiceId: "inv",
              lineId: "line",
              at: "2026-11-01",
              supplier: "lab",
              priceKg: 777.777,
              quantityKg: 100,
            },
          ],
        }),
      ],
    });
    const result = intelligenceContext(d, {
      question: "Scorte",
      from: 1,
      to: 1000,
      comparison: {
        left: { ...side(), productId: "p1" },
        right: { ...side(999.999), source: "costo 999.999 euro" },
      },
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("123.456");
    expect(json).not.toContain("456.789");
    expect(json).not.toContain("777.777");
    expect(json).not.toContain("999.999");
    expect(result.context.comparison?.left.pricePerQuintal).toBeNull();
  });
  it("allowlist esclude costi snapshot ingredienti, carri, distribuzioni, latte e note", () => {
    const d = data({ permissions: permission({ canSeeCosts: false }) });
    d.recipes[0].ingredients[0].note = "costo segreto 111.111";
    d.runs.push({
      id: "run",
      groupId: "g1",
      recipeId: "r1",
      at: 1000,
      operatorId: "op",
      headCount: 85,
      animalIds: [],
      state: "distribuito",
      expectedKg: 100,
      freshKg: 100,
      reusedKg: 0,
      totalKg: 100,
      totalCostCents: 23456789,
      ingredients: [
        {
          productId: "p1",
          nome: "alimento",
          expectedKg: 100,
          actualKg: 100,
          unitCostCentsPerKg: 3456789,
          costCents: 45678901,
          nirId: "n1",
          params: params(),
          dryMatter: 34,
          movementId: null,
        },
      ],
      recipeSnapshot: d.recipes[0],
      leftoverId: null,
      remainingKg: 0,
      note: "costo segreto 222.222",
      draft: { price: 333.333 },
    });
    d.distributions.push({
      id: "dist",
      runId: "run",
      groupId: "g1",
      at: 1000,
      kg: 100,
      costCents: 56789012,
      dryMatterKg: 34,
      headCount: 85,
      animalIds: [],
      operatorId: "op",
      annulled: false,
      note: "costo segreto 444.444",
    });
    d.milkRecords.push({
      id: "milk",
      groupId: "g1",
      at: 1000,
      milkKg: 1000,
      headCount: 85,
      fat: 4,
      protein: 3.4,
      pricePerKg: 987.654,
      priceSource: "segreto 555.555",
      source: "fonte",
      operatorId: "op",
    });
    const context = intelligenceContext(d, {
      question: "Scorte",
      from: 1,
      to: 2000,
    });
    const json = JSON.stringify(context);
    for (const secret of [
      "111.111",
      "222.222",
      "333.333",
      "444.444",
      "555.555",
      "23456789",
      "3456789",
      "45678901",
      "56789012",
      "987.654",
    ])
      expect(json).not.toContain(secret);
    expect(context.context.runs[0]).not.toHaveProperty("totalCostCents");
    expect(context.context.milk[0]).not.toHaveProperty("pricePerKg");
  });
  it("Intelligence usa fonti server e calcoli e non effettua alcuna scrittura", async () => {
    const db = mockDb();
    mocks.llm.mockResolvedValue(
      aiResponse({
        answer: "Scorta aziendale disponibile, consumo previsto da ricetta.",
        sourceIndexes: [0],
        missing: ["Storico distribuzioni"],
      })
    );
    const result = await intelligence(
      actor,
      {
        question: "Quali dati mancano?",
        from: 1,
        to: 1000,
        comparison: { left: { ...side(), productId: "p1" }, right: side() },
      },
      permission()
    );
    expect(result.sources[0]).toContain("Magazzino alimento p1");
    expect(result.answer).toContain("Nessuna modifica");
    expect(result.missing).toContain("Storico distribuzioni");
    expect(db.writes).toHaveLength(0);
    expect(JSON.stringify(mocks.llm.mock.calls[0][0].messages)).toContain(
      "calculation"
    );
  });
  it("Intelligence rifiuta permessi altra azienda e fonti inventate", async () => {
    await expect(
      intelligence(
        actor,
        { question: "domanda" },
        permission({ companyId: "foreign" })
      )
    ).rejects.toThrow("un'altra azienda");
    expect(mocks.load).not.toHaveBeenCalled();
    mockDb();
    mocks.llm.mockResolvedValue(
      aiResponse({ answer: "test", sourceIndexes: [999999], missing: [] })
    );
    await expect(
      intelligence(
        actor,
        { question: "domanda", from: 1, to: 1000 },
        permission()
      )
    ).rejects.toThrow("fonti non verificabili");
  });
  it("gruppo non appartenente al dataset non restituisce dati", () =>
    expect(() =>
      intelligenceContext(data(), { question: "domanda", groupId: "foreign" })
    ).toThrow("Gruppo non trovato"));
});
