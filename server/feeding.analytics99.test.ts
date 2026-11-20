import { describe, expect, it } from "vitest";
import { feedingAnalytics } from "./domains/feeding/analytics";
import type {
  AnalyticsInput,
  FeedData,
  FeedDistribution,
  FeedGroup,
  FeedLeftover,
  FeedRecipe,
  FeedRun,
  MilkRecord,
  NirParams,
} from "../shared/feeding/types";

const DAY = 86_400_000;
const FROM = Date.parse("2026-01-01T00:00:00Z");
const at = (day = 0, hour = 6) => FROM + day * DAY + hour * 3_600_000;
const period = (days = 1): AnalyticsInput => ({
  from: FROM,
  to: FROM + days * DAY - 1,
});
const group = (id = "g", extra: Partial<FeedGroup> = {}): FeedGroup => ({
  id,
  nome: `Gruppo ${id}`,
  tipologia: "Lattazione",
  foto: null,
  nAnimali: 85,
  inLattazione: 85,
  animalIds: [],
  frequency: 1,
  frequencySource: "manuale",
  frequencyReliability: "configurata",
  lastDistributionAt: null,
  nextDistributionAt: null,
  activeRecipeId: "recipe",
  overlaps: [],
  ...extra,
});
const recipe = (): FeedRecipe => ({
  id: "recipe",
  rootId: "recipe",
  groupId: "g",
  nome: "Versione fixture",
  version: 1,
  status: "archiviata",
  validFrom: FROM,
  createdAt: FROM,
  updatedAt: FROM,
  responsible: null,
  ingredients: [{ productId: "p", kgPerHead: 42, order: 0 }],
  note: null,
});
const params: NirParams = {
  ss: { value: 50, unit: "%", basis: "TQ" },
  pg: { value: 20, unit: "%", basis: "SS" },
  ndf: { value: 40, unit: "%", basis: "SS" },
  amido: { value: 10, unit: "%", basis: "TQ" },
  enl: { value: 6.276, unit: "MJ/kg SS", basis: "SS" },
};
const run = (extra: Partial<FeedRun> = {}): FeedRun => ({
  id: "r",
  groupId: "g",
  recipeId: "recipe",
  at: at(),
  operatorId: "op",
  headCount: 85,
  animalIds: [],
  state: "distribuito",
  expectedKg: 3570,
  freshKg: 3570,
  reusedKg: 0,
  totalKg: 3570,
  totalCostCents: 66725,
  ingredients: [
    {
      productId: "p",
      nome: "Alimento fixture",
      expectedKg: 3570,
      actualKg: 3570,
      unitCostCentsPerKg: null,
      costCents: 66725,
      nirId: "nir-old",
      params,
      dryMatter: 50,
      movementId: "movement-fixture",
    },
  ],
  recipeSnapshot: recipe(),
  leftoverId: null,
  remainingKg: 0,
  note: null,
  draft: null,
  ...extra,
});
const distribution = (
  extra: Partial<FeedDistribution> = {}
): FeedDistribution => ({
  id: "d",
  runId: "r",
  groupId: "g",
  at: at(),
  kg: 3570,
  costCents: 66725,
  dryMatterKg: 1955,
  headCount: 85,
  animalIds: [],
  operatorId: "op",
  annulled: false,
  note: null,
  ...extra,
});
const left = (extra: Partial<FeedLeftover> = {}): FeedLeftover => ({
  id: "l",
  distributionId: "d",
  groupId: "g",
  at: at(1),
  kg: 0,
  reusedKg: 0,
  discardedKg: 0,
  destination: "rimosso",
  method: "nessuno",
  containerId: null,
  containerCount: null,
  containerWeightKg: null,
  compositionKnown: true,
  operatorId: "op",
  note: null,
  ...extra,
});
const milk = (extra: Partial<MilkRecord> = {}): MilkRecord => ({
  id: "m",
  groupId: "g",
  at: at(),
  milkKg: 3230,
  headCount: 85,
  fat: 4,
  protein: 3.2,
  pricePerKg: 0.55,
  priceSource: "liquidazione fixture",
  source: "Dati stalla fixture",
  operatorId: "op",
  ...extra,
});
const data = (extra: Partial<FeedData> = {}): FeedData => ({
  groups: [group()],
  products: [],
  recipes: [recipe()],
  runs: [run()],
  distributions: [distribution()],
  leftovers: [left()],
  containers: [],
  settings: [],
  nirAnalyses: [],
  comparisons: [],
  milkRecords: [milk()],
  summary: {
    autonomyDays: null,
    limitingProduct: null,
    fedAnimals: 85,
    averageRunsPerDay: null,
    todayRuns: 0,
    undistributedRuns: 0,
    warnings: [],
    coverage: "fixture test",
  },
  permissions: {
    canView: true,
    canOperate: true,
    canManage: true,
    canSeeCosts: true,
    canNir: true,
    companyId: "company-fixture",
    userId: 1,
  },
  ...extra,
});
const analyze = (extra: Partial<FeedData> = {}, input = period()) =>
  feedingAnalytics(data(extra), input);

// All numeric examples, including 0.55, exist only in these test fixtures.
describe("feedingAnalytics · storico reale Fase 99", () => {
  it("reproduce le formule cartacee 13,05 × 85 senza impostare valori aziendali", () => {
    const result = analyze();
    expect(result.totals.revenue).toBeCloseTo(1776.5);
    expect(result.totals.cost).toBeCloseTo(667.25);
    expect(result.totals.iofc).toBeCloseTo(1109.25);
    expect(result.totals.iofcPerHead).toBeCloseTo(13.05);
    expect(result.totals.iofcDailyAverage).toBeCloseTo(1109.25);
    expect(result.totals.iofcPerMilk).toBeCloseTo(1109.25 / 3230);
    expect(result.totals.efficiency).toBeCloseTo(38 / 23);
    expect(result.totals.dmPerHead).toBeCloseTo(23);
    expect(result.totals.milkPerHead).toBeCloseTo(38);
    expect(result.totals.costPerMilk).toBeCloseTo(667.25 / 3230);
    expect(result.totals.headDays).toBe(85);
    expect(result.totals.ingestionEstimated).toBe(1);
  });

  it("ECM Orth usa masse in kg e percentuali convertite; formula e URL sono consegnati", () => {
    const result = analyze();
    const expected =
      0.327 * 3230 + 12.95 * ((3230 * 4) / 100) + 7.2 * ((3230 * 3.2) / 100);
    expect(result.totals.ecm).toBeCloseTo(expected);
    expect(result.totals.ecmEfficiency).toBeCloseTo(expected / 1955);
    expect(result.formulaECM).toContain(
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC8982198/"
    );
    expect(result.sources.join(" ")).toContain("Orth");
  });

  it("non inventa grasso o proteine ECM mancanti", () => {
    const result = analyze({ milkRecords: [milk({ fat: null })] });
    expect(result.totals.ecm).toBeNull();
    expect(result.totals.ecmEfficiency).toBeNull();
    expect(result.totals.milk).toBe(3230);
  });

  it("denominatori zero restituiscono null, ma zero osservato resta zero", () => {
    const result = analyze({
      runs: [
        run({
          headCount: 0,
          freshKg: 0,
          totalKg: 0,
          totalCostCents: 0,
          ingredients: [],
        }),
      ],
      distributions: [
        distribution({ kg: 0, headCount: 0, costCents: 0, dryMatterKg: 0 }),
      ],
      leftovers: [],
      milkRecords: [milk({ milkKg: 0, headCount: 0 })],
    });
    expect(result.totals.milk).toBe(0);
    expect(result.totals.cost).toBe(0);
    expect(result.totals.iofc).toBe(0);
    expect(result.totals.efficiency).toBeNull();
    expect(result.totals.costPerMilk).toBeNull();
    expect(result.totals.iofcPerHead).toBeNull();
    expect(result.totals.leftoverPercent).toBeNull();
    for (const value of Object.values(result.totals))
      if (value !== null) expect(Number.isFinite(value)).toBe(true);
  });

  it("conserva IOFC negativo senza tagliarlo a zero", () => {
    expect(
      analyze({ milkRecords: [milk({ pricePerKg: 0 })] }).totals.iofc
    ).toBe(-667.25);
  });

  it("assenza di avanzo non equivale a nessun avanzo", () => {
    const result = analyze({ leftovers: [] });
    expect(result.totals.dm).toBeNull();
    expect(result.totals.ingestionKg).toBeNull();
    expect(result.totals.leftoverKg).toBeNull();
    expect(result.totals.efficiency).toBeNull();
    expect(result.totals.cost).toBe(667.25);
    expect(result.warnings.join(" ")).toContain(
      "assenza di registrazione non equivale a zero"
    );
  });

  it("attribuisce l’avanzo al giorno della distribuzione anche se misurato fuori periodo", () => {
    const result = analyze({
      leftovers: [
        left({
          kg: 100,
          discardedKg: 100,
          destination: "scartato",
          method: "kg",
          at: at(2),
        }),
      ],
    });
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].day).toBe("2026-01-01");
    expect(result.totals.leftoverKg).toBe(100);
    expect(result.totals.ingestionKg).toBe(3470);
    expect(result.totals.dm).toBeCloseTo((1955 * 3470) / 3570);
    expect(result.totals.costDiscarded).toBeCloseTo((667.25 * 100) / 3570);
    expect(result.totals.cost).toBe(667.25);
  });

  it("non sposta avanzi di un vecchio pasto sul nuovo periodo", () => {
    const result = analyze({}, { from: FROM + DAY, to: FROM + 2 * DAY - 1 });
    expect(result.daily).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Nessun evento reale");
  });

  it("esclude avanzi orfani senza attribuirli al giorno di registrazione", () => {
    const result = analyze({
      leftovers: [left({ distributionId: "missing", at: at(), kg: 20 })],
    });
    expect(result.totals.ingestionKg).toBeNull();
    expect(result.warnings.join(" ")).toContain(
      "Avanzi senza distribuzione valida"
    );
  });

  it("scarti e riuso sono sottocategorie dell’avanzo, non sottrazioni aggiuntive", () => {
    const result = analyze({
      leftovers: [
        left({
          kg: 100,
          discardedKg: 40,
          reusedKg: 60,
          destination: "riutilizzo",
          method: "kg",
        }),
      ],
    });
    expect(result.totals.ingestionKg).toBe(3470);
    expect(result.totals.transferredReuseKg).toBe(60);
    expect(result.totals.costReused).toBeCloseTo((667.25 * 60) / 3570);
    expect(result.totals.cost).toBeCloseTo((667.25 * 3510) / 3570);
  });

  it("riuso tra carri trasferisce valore/composizione storici senza secondo costo fresco", () => {
    const r1 = run({
      freshKg: 100,
      totalKg: 100,
      totalCostCents: 10000,
      ingredients: [
        { ...run().ingredients[0], actualKg: 100, costCents: 10000 },
      ],
    });
    const r2 = run({
      id: "r2",
      at: at(1),
      freshKg: 80,
      reusedKg: 20,
      totalKg: 100,
      totalCostCents: 10000,
      leftoverId: "l",
      ingredients: [{ ...run().ingredients[0], actualKg: 80, costCents: 8000 }],
    });
    const d1 = distribution({ kg: 100, costCents: 10000, dryMatterKg: 50 });
    const d2 = distribution({
      id: "d2",
      runId: "r2",
      at: at(1),
      kg: 100,
      costCents: null,
      dryMatterKg: null,
    });
    const result = analyze(
      {
        runs: [r1, r2],
        distributions: [d1, d2],
        leftovers: [
          left({
            at: at(1, 5),
            kg: 20,
            reusedKg: 20,
            destination: "riutilizzo",
            method: "kg",
          }),
          left({ id: "l2", distributionId: "d2", at: at(2) }),
        ],
        milkRecords: [],
      },
      period(2)
    );
    expect(result.totals.freshKg).toBe(180);
    expect(result.totals.distributedKg).toBe(200);
    expect(result.totals.ingestionKg).toBe(180);
    expect(result.totals.costUsed).toBe(180);
    expect(result.totals.costDistributed).toBe(200);
    expect(result.totals.cost).toBe(180);
    expect(result.totals.dm).toBe(90);
  });

  it("riuso senza composizione nota non ricostruisce NIR dalla ricetta odierna", () => {
    const origin = distribution({
      id: "d-old",
      at: at(-1),
      kg: 100,
      costCents: 10000,
      dryMatterKg: 50,
      runId: "old",
    });
    const current = run({
      freshKg: 0,
      reusedKg: 20,
      totalKg: 20,
      totalCostCents: 0,
      ingredients: [],
      leftoverId: "l",
    });
    const result = analyze({
      runs: [current],
      distributions: [
        origin,
        distribution({ kg: 20, costCents: null, dryMatterKg: null }),
      ],
      leftovers: [
        left({
          distributionId: origin.id,
          at: at(-1, 18),
          kg: 20,
          reusedKg: 20,
          compositionKnown: false,
        }),
        left({ id: "l-now", distributionId: "d", at: at(1) }),
      ],
      milkRecords: [],
    });
    expect(result.totals.dmDistributedKg).toBeNull();
    expect(result.totals.costDistributed).toBe(0); // preserved gross historical cost, composition still unknown
  });

  it("avanzi impossibili non generano ingestione negativa o allocazioni finte", () => {
    const result = analyze({
      leftovers: [left({ kg: 4000, discardedKg: 4000 })],
    });
    expect(result.totals.ingestionKg).toBeNull();
    expect(result.totals.costDiscarded).toBeNull();
    expect(result.warnings.join(" ")).toContain("incoerenti");
  });

  it("gap temporali restano gap e IOFC è somma solo dei giorni-gruppo abbinati", () => {
    const result = analyze(
      {
        runs: [run(), run({ id: "r3", at: at(2) })],
        distributions: [
          distribution(),
          distribution({ id: "d3", runId: "r3", at: at(2) }),
        ],
        leftovers: [
          left(),
          left({ id: "l3", distributionId: "d3", at: at(3) }),
        ],
        milkRecords: [milk(), milk({ id: "m4", at: at(3) })],
      },
      period(4)
    );
    expect(result.daily.map(d => d.day)).toEqual([
      "2026-01-01",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(result.totals.iofc).toBeCloseTo(1109.25);
    expect(result.daily.find(d => d.day === "2026-01-03")?.iofc).toBeNull();
    expect(result.daily.find(d => d.day === "2026-01-04")?.iofc).toBeNull();
    expect(result.totals.headDays).toBe(255);
    expect(result.totals.observedDays).toBe(3);
    expect(result.coverage).toContain("3/4");
  });

  it("nessuna ricetta × giorni, nemmeno se attiva ma senza carri", () => {
    const result = analyze(
      { runs: [], distributions: [], leftovers: [], milkRecords: [] },
      period(30)
    );
    expect(result.daily).toEqual([]);
    expect(result.groups[0].headDays).toBe(0);
    expect(result.groups[0].observedDays).toBe(0);
    expect(result.warnings.join(" ")).toContain("Nessun evento reale");
  });

  it("gruppi non in lattazione non hanno latte, IOFC o FE anche con latte errato", () => {
    const result = analyze({
      groups: [group("g", { tipologia: "Asciutta", inLattazione: 0 })],
    });
    expect(result.groups[0].lactating).toBe(false);
    expect(result.totals.milk).toBeNull();
    expect(result.totals.iofc).toBeNull();
    expect(result.totals.efficiency).toBeNull();
    expect(result.totals.cost).toBe(667.25);
    expect(result.totals.dm).toBe(1955);
    expect(result.totals.costPerMilk).toBeNull();
  });

  it("filtro lattazione esclude asciutta/manze e i loro costi dai KPI latte", () => {
    const result = analyze(
      {
        groups: [
          group(),
          group("dry", { tipologia: "Asciutta", inLattazione: 0 }),
        ],
        runs: [run(), run({ id: "r-dry", groupId: "dry" })],
        distributions: [
          distribution(),
          distribution({ id: "d-dry", runId: "r-dry", groupId: "dry" }),
        ],
      },
      { ...period(), lactatingOnly: true }
    );
    expect(result.groups).toHaveLength(1);
    expect(result.totals.cost).toBe(667.25);
  });

  it("filtra timestamp e gruppo, ma mantiene lo snapshot del carro precedente necessario", () => {
    const result = analyze(
      {
        groups: [group(), group("other")],
        runs: [
          run({
            at: at(-1),
            totalCostCents: 10000,
            freshKg: 100,
            totalKg: 100,
            ingredients: [
              { ...run().ingredients[0], actualKg: 100, costCents: 10000 },
            ],
          }),
          run({ id: "out", groupId: "other" }),
        ],
        distributions: [
          distribution({ kg: 50, costCents: null, dryMatterKg: null }),
          distribution({ id: "outside", runId: "out", groupId: "other" }),
          distribution({ id: "later", at: at(1) }),
        ],
        milkRecords: [],
      },
      { ...period(), groupId: "g" }
    );
    expect(result.totals.loadedKg).toBeNull();
    expect(result.totals.costUsed).toBeNull();
    expect(result.totals.distributedKg).toBe(50);
    expect(result.totals.costDistributed).toBe(50);
    expect(result.totals.dmDistributedKg).toBe(25);
    expect(result.groups).toHaveLength(1);
  });

  it("estremi del periodo inclusivi ed eventi annullati/draft esclusi", () => {
    const result = analyze({
      runs: [run({ state: "preparazione" })],
      distributions: [
        distribution(),
        distribution({ id: "annulled", annulled: true }),
      ],
      milkRecords: [
        milk({ at: FROM }),
        milk({ id: "end", at: FROM + DAY - 1, milkKg: 1 }),
        milk({ id: "out", at: FROM + DAY, milkKg: 9999 }),
      ],
    });
    expect(result.totals.milk).toBe(3231);
    expect(result.totals.distributionCount).toBe(0);
    expect(result.totals.iofc).toBeNull();
  });

  it("snapshot storico invariante a cambi ricetta, NIR attivo, costo e capi odierni", () => {
    const before = analyze();
    const changed = data();
    changed.groups[0].nAnimali = 500;
    changed.groups[0].inLattazione = 500;
    changed.recipes[0].ingredients[0].kgPerHead = 999;
    changed.products = [
      {
        id: "p",
        nome: "Corrente",
        codice: null,
        categoria: null,
        unitaMisura: "kg",
        quantity: 1000,
        quantityKg: 1000,
        unitToKg: 1,
        prezzoKg: 1000,
        costSource: "corrente",
        lastPriceKg: 1000,
        fornitoreId: null,
        fornitore: null,
        immagineUrl: null,
        nirId: "new",
        params: { ss: { value: 99, unit: "%", basis: "TQ" } },
        dryMatter: 99,
        dailyUseKg: null,
        autonomyDays: null,
        autonomyStatus: "",
        purchases: [],
      },
    ];
    changed.nirAnalyses = [
      {
        id: "new",
        productId: "p",
        at: at(1),
        responsible: null,
        laboratory: null,
        lot: null,
        trench: null,
        sample: null,
        method: null,
        params: changed.products[0].params,
        active: true,
        documentKey: null,
        note: null,
        operatorId: "op",
      },
    ];
    const after = feedingAnalytics(changed, period());
    expect(after.totals).toEqual(before.totals);
    expect(after.daily).toEqual(before.daily);
  });

  it("sostanza secca e nutrienti usano snapshot NIR referenziato, unità e base", () => {
    const current = run({
      ingredients: [{ ...run().ingredients[0], params: {}, dryMatter: null }],
    });
    const historic = {
      id: "nir-old",
      productId: "p",
      at: at(-1),
      responsible: null,
      laboratory: null,
      lot: null,
      trench: null,
      sample: null,
      method: null,
      params,
      active: false,
      documentKey: null,
      note: null,
      operatorId: "op",
    };
    const result = analyze({
      runs: [current],
      distributions: [distribution({ dryMatterKg: null })],
      nirAnalyses: [historic],
    });
    expect(result.totals.dmDistributedKg).toBe(1785);
    expect(result.totals.proteinDistributed).toBe(357);
    expect(result.totals.ndfDistributed).toBe(714);
    expect(result.totals.starchDistributed).toBe(357);
    expect(result.totals.energyDistributed).toBeCloseTo(2677.5);
    expect(result.totals.costPerProtein).toBeCloseTo(667.25 / 357);
    expect(result.totals.costPerMcal).toBeCloseTo(667.25 / 2677.5);
  });

  it("non usa prezzi correnti per costi storici null e non somma un totale parziale", () => {
    const result = analyze({
      runs: [
        run({
          totalCostCents: null,
          ingredients: [
            {
              ...run().ingredients[0],
              costCents: null,
              unitCostCentsPerKg: null,
            },
          ],
        }),
      ],
      distributions: [distribution({ costCents: null })],
    });
    expect(result.totals.costUsed).toBeNull();
    expect(result.totals.cost).toBeNull();
    expect(result.totals.iofc).toBeNull();
  });

  it("recupera costo dallo snapshot unitario quando manca l’importo di riga", () => {
    const result = analyze({
      runs: [
        run({
          totalCostCents: null,
          ingredients: [
            {
              ...run().ingredients[0],
              costCents: null,
              unitCostCentsPerKg: 10,
            },
          ],
        }),
      ],
      distributions: [distribution({ costCents: null })],
    });
    expect(result.totals.costUsed).toBe(357);
    expect(result.totals.cost).toBe(357);
  });

  it("ultimo prezzo latte noto è marcato stima; nessun default o prezzo futuro", () => {
    const historical = milk({ id: "price", at: at(-1), pricePerKg: 0.6 });
    const result = analyze({
      milkRecords: [
        historical,
        milk({ pricePerKg: null }),
        milk({ id: "future", at: at(2), pricePerKg: 999 }),
      ],
    });
    expect(result.totals.revenue).toBeCloseTo(3230 * 0.6);
    expect(result.totals.iofc).toBeCloseTo(3230 * 0.6 - 667.25);
    expect(result.totals.iofcActual).toBeNull();
    expect(result.totals.priceEstimatedRecords).toBe(1);
    expect(result.sources.join(" ")).toContain("rilevazione price");
    const absent = analyze({
      milkRecords: [
        milk({ pricePerKg: null }),
        milk({ id: "future", at: at(2), pricePerKg: 999 }),
      ],
    });
    expect(absent.totals.revenue).toBeNull();
    expect(absent.totals.iofc).toBeNull();
  });

  it("rapporti totali sono ponderati sulle masse e giorni-capo, non medie di rapporti", () => {
    const result = analyze({
      groups: [group(), group("g2", { nAnimali: 10, inLattazione: 10 })],
      runs: [run(), run({ id: "r2", groupId: "g2", headCount: 10 })],
      distributions: [
        distribution(),
        distribution({
          id: "d2",
          runId: "r2",
          groupId: "g2",
          headCount: 10,
          costCents: 10000,
          dryMatterKg: 100,
        }),
      ],
      leftovers: [
        left(),
        left({ id: "l2", distributionId: "d2", groupId: "g2" }),
      ],
      milkRecords: [
        milk(),
        milk({
          id: "m2",
          groupId: "g2",
          milkKg: 100,
          headCount: 10,
          pricePerKg: 0.4,
        }),
      ],
    });
    expect(result.totals.efficiency).toBeCloseTo(3330 / 2055);
    expect(result.totals.iofcPerHead).toBeCloseTo((1109.25 - 60) / 95);
    expect(result.totals.costPerMilk).toBeCloseTo(767.25 / 3330);
  });

  it("giorni-capo ponderano cambi osservati intragiornalieri senza duplicare carri", () => {
    const result = analyze({
      runs: [
        run({ at: at(0, 2), headCount: 10 }),
        run({ id: "r2", at: at(0, 12), headCount: 20 }),
      ],
      distributions: [],
      milkRecords: [],
      leftovers: [],
    });
    expect(result.totals.headDays).toBe(15);
    expect(result.groups[0].headDays).toBe(15);
  });

  it("doppioni ID non duplicano masse né costi", () => {
    const result = analyze({
      runs: [run(), run()],
      distributions: [distribution(), distribution()],
      leftovers: [left(), left()],
      milkRecords: [milk(), milk()],
    });
    expect(result.totals.distributedKg).toBe(3570);
    expect(result.totals.costUsed).toBe(667.25);
    expect(result.totals.iofc).toBeCloseTo(1109.25);
  });

  it("redazione economica server side copre daily, groups, totals e fonti", () => {
    const result = analyze({
      permissions: { ...data().permissions, canSeeCosts: false },
    });
    for (const row of [result.totals, ...result.daily, ...result.groups]) {
      for (const [key, value] of Object.entries(row))
        if (/cost|price|iofc|revenue/i.test(key)) expect(value).toBeNull();
    }
    expect(result.totals.milk).toBe(3230);
    expect(result.coverage).toContain("riservati");
  });

  it("valida intervalli e visibilità senza accesso al database", () => {
    expect(() => analyze({}, { from: FROM, to: FROM - 1 })).toThrow(
      "Periodo non valido"
    );
    expect(() => analyze({}, { from: NaN, to: FROM })).toThrow(
      "Periodo non valido"
    );
    expect(() =>
      analyze({ permissions: { ...data().permissions, canView: false } })
    ).toThrow("Non autorizzato");
    const unavailable = analyze({}, { ...period(), groupId: "unavailable" });
    expect(unavailable.groups).toEqual([]);
    expect(unavailable.daily).toEqual([]);
  });

  it("non modifica gli input né usa l’ora corrente", () => {
    const original = data();
    const before = JSON.stringify(original);
    const result = feedingAnalytics(original, period());
    expect(JSON.stringify(original)).toBe(before);
    expect(feedingAnalytics(original, period())).toEqual(result);
  });

  it("capi totali e vacche in lattazione restano popolazioni distinte", () => {
    const result = analyze({
      runs: [run({ headCount: 100, at: at(0, 6) })],
      distributions: [distribution({ headCount: 100, at: at(0, 6) })],
      milkRecords: [milk({ headCount: 85, at: at(0, 18) })],
    });
    expect(result.totals.headDays).toBe(100);
    expect(result.totals.lactatingHeadDays).toBe(85);
    expect(result.totals.iofcPerHead).toBeCloseTo(13.05);
    expect(result.totals.costPerHead).toBeCloseTo(667.25 / 100);
  });

  it("prezzo esplicitamente stimato non diventa liquidazione effettiva", () => {
    const result = analyze({
      milkRecords: [milk({ priceSource: "Ultimo prezzo noto — stima" })],
    });
    expect(result.totals.iofc).toBeCloseTo(1109.25);
    expect(result.totals.iofcActual).toBeNull();
    expect(result.totals.priceEstimatedRecords).toBe(1);
  });

  it("zero latte osservato dà ricavo zero anche senza prezzo, non latte inventato", () => {
    const result = analyze({
      milkRecords: [milk({ milkKg: 0, pricePerKg: null })],
    });
    expect(result.totals.revenue).toBe(0);
    expect(result.totals.iofc).toBe(-667.25);
    expect(result.totals.costPerMilk).toBeNull();
  });

  it("nomi dei campi grafico sono stabili, anche in risultato vuoto", () => {
    const populated = analyze();
    const empty = analyze({
      runs: [],
      distributions: [],
      leftovers: [],
      milkRecords: [],
    });
    for (const key of [
      "iofc",
      "cost",
      "milk",
      "dm",
      "leftover",
      "efficiency",
      "costPerMilk",
    ]) {
      expect(populated.daily[0]).toHaveProperty(key);
      expect(empty.totals).toHaveProperty(key, null);
    }
    expect(empty.groups[0].headDays).toBe(0);
  });

  it("la data di carico e quella di distribuzione non sono intercambiabili", () => {
    const result = analyze(
      {
        distributions: [distribution({ at: at(1) })],
        leftovers: [left({ at: at(2) })],
        milkRecords: [milk({ at: at(1) })],
      },
      period(2)
    );
    expect(result.daily[0].costUsed).toBe(667.25);
    expect(result.daily[0].cost).toBeNull();
    expect(result.daily[1].costUsed).toBeNull();
    expect(result.daily[1].cost).toBe(667.25);
    expect(result.daily[1].iofc).toBeCloseTo(1109.25);
  });
});
