import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  FeedData,
  FeedGroup,
  FeedProduct,
  FeedRecipe,
  FeedRun,
  FeedLeftover,
} from "@shared/feeding/types";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  slots: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  refIndex: 0,
  tree: undefined as unknown,
  asks: [] as Array<{
    title: string;
    message: string;
    action: () => Promise<unknown>;
  }>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  refresh: vi.fn(async () => undefined),
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = h.index++;
      if (!(index in h.slots))
        h.slots[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        h.slots[index],
        (value: unknown) => {
          h.slots[index] =
            typeof value === "function"
              ? (value as (old: unknown) => unknown)(h.slots[index])
              : value;
        },
      ];
    },
    useMemo: (factory: () => unknown) => factory(),
    useRef: (value: unknown) => {
      const index = h.refIndex++;
      return h.refs[index] ?? (h.refs[index] = { current: value });
    },
  };
});
vi.mock("@/lib/trpc", () => ({
  trpc: {
    alimentazione: new Proxy(
      {},
      {
        get: (_, name: string) => ({
          useMutation: () => ({
            isPending: false,
            mutateAsync: (...args: unknown[]) => h.mutations[name](...args),
          }),
        }),
      }
    ),
  },
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock("./shared", () => ({
  ACTION: "min-h-12",
  INPUT: "min-h-12",
  PANEL: "panel",
  qty: (value: number | null | undefined, unit = "") =>
    value == null || !Number.isFinite(value)
      ? "Dato non disponibile"
      : `${value} ${unit}`,
  eur: (value: number | null) =>
    value == null ? "Costo non disponibile" : `EUR ${value}`,
  dateTime: (value: number) => String(value),
  useFeed: () => ({
    data: h.data,
    isLoading: false,
    error: null,
    refresh: h.refresh,
  }),
  useFeedConfirm: () => ({
    pending: false,
    dialog: null,
    ask: (title: string, message: string, action: () => Promise<unknown>) =>
      h.asks.push({ title, message, action }),
  }),
  FeedPage: ({ children }: { children: React.ReactNode }) => {
    h.tree = children;
    return <main>{children}</main>;
  },
  FeedStatus: () => null,
  Field: ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <label>
      {label}
      {children}
    </label>
  ),
}));
import Distribuzione, {
  availableLeftover,
  definitiveFeedRejection,
  feedNumber,
  ingredientProblem,
  knownCompatibleLeftover,
  previousDistribution,
  readLoadDraft,
  sameRecipeSnapshot,
} from "./Distribuzione";
import * as math from "@shared/feeding/math";

const now = Date.now();
const group: FeedGroup = {
  id: "g",
  nome: "Gruppo test",
  tipologia: "lattazione",
  foto: null,
  nAnimali: 10,
  inLattazione: 10,
  animalIds: ["a"],
  frequency: 2,
  frequencySource: "configurata",
  frequencyReliability: "configurata",
  lastDistributionAt: null,
  nextDistributionAt: null,
  activeRecipeId: "r",
  overlaps: [],
};
const recipe: FeedRecipe = {
  id: "r",
  rootId: "r",
  groupId: "g",
  nome: "Razione test",
  version: 1,
  status: "attiva",
  validFrom: now - 1000,
  createdAt: now - 1000,
  updatedAt: now - 1000,
  responsible: null,
  ingredients: [{ productId: "p", kgPerHead: 20, order: 0 }],
  note: null,
};
const product: FeedProduct = {
  id: "p",
  nome: "Ingrediente test",
  codice: null,
  categoria: "alimenti",
  unitaMisura: "kg",
  quantity: 1000,
  quantityKg: 1000,
  unitToKg: 1,
  prezzoKg: 0.25,
  costSource: "magazzino",
  lastPriceKg: null,
  fornitoreId: null,
  fornitore: null,
  immagineUrl: null,
  nirId: null,
  params: {},
  dryMatter: null,
  dailyUseKg: 200,
  autonomyDays: 5,
  autonomyStatus: "previsione",
  purchases: [],
};
function dataset(): FeedData {
  return {
    groups: [structuredClone(group)],
    products: [structuredClone(product)],
    recipes: [structuredClone(recipe)],
    runs: [],
    distributions: [],
    leftovers: [],
    containers: [],
    settings: [],
    nirAnalyses: [],
    comparisons: [],
    milkRecords: [],
    summary: {
      autonomyDays: 5,
      limitingProduct: "Ingrediente test",
      fedAnimals: 10,
      averageRunsPerDay: null,
      todayRuns: 0,
      undistributedRuns: 0,
      warnings: [],
      coverage: "test",
    },
    permissions: {
      canView: true,
      canOperate: true,
      canManage: true,
      canSeeCosts: true,
      canNir: true,
      companyId: "company-test",
      userId: 1,
    },
  };
}
function run(): FeedRun {
  return {
    id: "run",
    groupId: "g",
    recipeId: "r",
    at: now,
    operatorId: "op",
    headCount: 10,
    animalIds: ["a"],
    state: "caricato",
    expectedKg: 100,
    freshKg: 100,
    reusedKg: 0,
    totalKg: 100,
    totalCostCents: 2500,
    ingredients: [
      {
        productId: "p",
        nome: "Ingrediente test",
        expectedKg: 100,
        actualKg: 100,
        unitCostCentsPerKg: 25,
        costCents: 2500,
        nirId: null,
        params: {},
        dryMatter: null,
        movementId: "mov",
      },
    ],
    recipeSnapshot: structuredClone(recipe),
    leftoverId: null,
    remainingKg: 100,
    note: null,
    draft: null,
  };
}
function leftover(): FeedLeftover {
  return {
    id: "left",
    distributionId: "dist",
    groupId: "g",
    at: now,
    kg: 20,
    reusedKg: 0,
    discardedKg: 0,
    destination: "riutilizzo",
    method: "kg",
    containerId: null,
    containerCount: null,
    containerWeightKg: null,
    compositionKnown: true,
    operatorId: "op",
    note: null,
  };
}
function render() {
  h.index = 0;
  h.refIndex = 0;
  return renderToStaticMarkup(<Distribuzione />);
}
function nodes(
  value: unknown
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (React.isValidElement<Record<string, unknown>>(value))
    return text(value.props.children);
  return "";
}
function button(label: string) {
  const found = nodes(h.tree).find(
    node => node.type === "button" && text(node.props.children).includes(label)
  );
  expect(found, `button ${label}`).toBeTruthy();
  return found!;
}
function click(label: string) {
  const found = button(label);
  expect(found.props.disabled).toBeFalsy();
  (found.props.onClick as () => void)();
}
async function confirm() {
  const ask = h.asks.pop();
  expect(ask).toBeTruthy();
  await ask!.action();
}
function field(label: string, value: string) {
  const wrapper = nodes(h.tree).find(
    node => typeof node.type === "function" && node.props.label === label
  );
  expect(wrapper).toBeTruthy();
  const input = nodes(wrapper!.props.children).find(
    node =>
      node.type === "input" ||
      node.type === "textarea" ||
      node.type === "select"
  );
  expect(input).toBeTruthy();
  (input!.props.onChange as (event: unknown) => void)({ target: { value } });
}
function consent(label: string, value = true) {
  const found = nodes(h.tree).find(
    node =>
      typeof node.type === "function" &&
      text(node.props.children).includes(label) &&
      typeof node.props.onChange === "function" &&
      typeof node.props.checked === "boolean"
  );
  expect(found).toBeTruthy();
  (found!.props.onChange as (value: boolean) => void)(value);
}
function realPrevious(data: FeedData) {
  data.runs = [run()];
  data.distributions = [
    {
      id: "dist",
      runId: "run",
      groupId: "g",
      at: now - 1000,
      kg: 100,
      costCents: null,
      dryMatterKg: null,
      headCount: 10,
      animalIds: [],
      operatorId: "op",
      annulled: false,
      note: null,
    },
  ];
}
async function startWizard() {
  render();
  click("Carico carro");
  render();
  click("Gruppo test");
  render();
  click("Confermo zero avanzo precedente");
  await confirm();
  render();
  click("Inizia carico guidato");
  await confirm();
  render();
}

beforeEach(() => {
  h.data = dataset();
  h.slots = [];
  h.refs = [];
  h.asks = [];
  h.refresh.mockClear();
  for (const name of [
    "confirmLoad",
    "saveDraft",
    "distribute",
    "registerLeftover",
    "saveContainer",
    "savePreferences",
    "configureFrequency",
    "rectifyLoad",
  ])
    h.mutations[name] = vi.fn(async () => ({ id: "saved", idempotent: false }));
});

describe("operator numeric and snapshot guards", () => {
  it("accepts Italian decimal fractions, never blanks/negative/nonfinite", () => {
    expect(feedNumber("1,5")).toBe(1.5);
    expect(feedNumber(".5")).toBe(0.5);
    for (const value of ["", " ", "-1", "NaN", "Infinity", "1.000,5", "1e3"])
      expect(feedNumber(value)).toBeNull();
    expect(feedNumber("0")).toBe(0);
  });
  it("blocks missing conversions, over-stock and negative weights", () => {
    expect(ingredientProblem("10", null)).toMatch(/Giacenza/);
    expect(ingredientProblem("101", 100)).toMatch(/supera/);
    expect(ingredientProblem("-1", 100)).toMatch(/non negativo/);
    expect(ingredientProblem("0", 100)).toMatch(/peso zero/);
  });
  it("requires identical version and actual ingredient composition", () => {
    expect(sameRecipeSnapshot(recipe, structuredClone(recipe))).toBe(true);
    expect(sameRecipeSnapshot(recipe, { ...recipe, version: 2 })).toBe(false);
    expect(
      sameRecipeSnapshot(recipe, {
        ...recipe,
        ingredients: [{ ...recipe.ingredients[0], kgPerHead: 21 }],
      })
    ).toBe(false);
  });
  it("requires a real non-annulled distribution and known same snapshot for reuse", () => {
    const data = dataset();
    data.runs = [run()];
    data.distributions = [
      {
        id: "dist",
        runId: "run",
        groupId: "g",
        at: now,
        kg: 100,
        costCents: null,
        dryMatterKg: null,
        headCount: 10,
        animalIds: [],
        operatorId: "op",
        annulled: false,
        note: null,
      },
    ];
    expect(knownCompatibleLeftover(data, leftover(), recipe)).toBe(true);
    expect(
      knownCompatibleLeftover(
        data,
        { ...leftover(), compositionKnown: false },
        recipe
      )
    ).toBe(false);
    expect(
      knownCompatibleLeftover(data, leftover(), { ...recipe, id: "other" })
    ).toBe(false);
    data.distributions[0].annulled = true;
    expect(knownCompatibleLeftover(data, leftover(), recipe)).toBe(false);
    expect(previousDistribution(data, "g")).toBeUndefined();
  });
  it("subtracts consumed/discarded leftovers and rejects malformed drafts", () => {
    expect(
      availableLeftover({ ...leftover(), reusedKg: 5, discardedKg: 3 })
    ).toBe(12);
    expect(readLoadDraft({})).toBeNull();
    expect(
      readLoadDraft({
        version: 1,
        recipeId: "r",
        headCount: 10,
        frequency: 2,
        weights: { p: "12" },
        note: "",
      })
    ).not.toBeNull();
  });
  it("shared math reduces proportional fresh forecast", () => {
    const data = dataset();
    const calculated = math.calculateRecipe(recipe, group, data.products);
    expect(calculated.kgPerRun).toBe(100);
    expect(
      (calculated.lines[0].kgPerRun! * (calculated.kgPerRun! - 20)) /
        calculated.kgPerRun!
    ).toBe(80);
  });
});

describe("mocked operator workflow without database", () => {
  it("renders a 2x2 hub without calling any mutations", () => {
    const html = render();
    expect(html).toContain("Carico carro");
    expect(html).toContain("Distribuzione");
    expect(html).toContain("Consumi");
    expect(html).toContain("Storico");
    expect(html).toContain("grid-cols-2");
    for (const mutation of Object.values(h.mutations))
      expect(mutation).not.toHaveBeenCalled();
  });
  it("confirms missing-previous zero locally and only unloads at final explicit confirmation", async () => {
    await startWizard();
    expect(h.mutations.registerLeftover).not.toHaveBeenCalled();
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
    field("Peso effettivamente caricato (kg)", "100");
    render();
    click("Conferma ingrediente");
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
    await confirm();
    render();
    click("CONFERMA CARRO");
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
    await confirm();
    expect(h.mutations.confirmLoad).toHaveBeenCalledTimes(1);
    const payload = h.mutations.confirmLoad.mock.calls[0][0];
    expect(payload).toMatchObject({
      groupId: "g",
      recipeId: "r",
      ingredients: [{ productId: "p", actualKg: 100 }],
      reusedKg: 0,
      confirm: true,
    });
    expect(payload.key).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("locks the load and preserves identical UUID, time and payload on retry", async () => {
    await startWizard();
    field("Peso effettivamente caricato (kg)", "100");
    render();
    click("Conferma ingrediente");
    await confirm();
    render();
    h.mutations.confirmLoad.mockRejectedValueOnce(new Error("response lost"));
    click("CONFERMA CARRO");
    await expect(confirm()).rejects.toThrow("response lost");
    render();
    click("Riprova CONFERMA CARRO");
    await confirm();
    expect(h.mutations.confirmLoad.mock.calls[1][0]).toEqual(
      h.mutations.confirmLoad.mock.calls[0][0]
    );
  });
  it("saving a draft is explicit and never unloads stock", async () => {
    await startWizard();
    field("Peso effettivamente caricato (kg)", "30");
    render();
    click("Salva bozza");
    expect(h.mutations.saveDraft).not.toHaveBeenCalled();
    await confirm();
    expect(h.mutations.saveDraft).toHaveBeenCalledTimes(1);
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
  });
  it("blocks stock overruns before confirming an ingredient", async () => {
    await startWizard();
    field("Peso effettivamente caricato (kg)", "1001");
    const html = render();
    expect(html).toContain("supera la disponibilità");
    expect(button("Conferma ingrediente").props.disabled).toBeTruthy();
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
  });
  it("partial distribution preserves balance and never calls confirmLoad", async () => {
    (h.data as FeedData).runs = [run()];
    render();
    click("Distribuzione");
    render();
    click("Gruppo test");
    render();
    field("Peso effettivamente distribuito (kg)", "40");
    const html = render();
    expect(html).toContain("60 kg");
    click("Conferma distribuzione");
    expect(h.mutations.distribute).not.toHaveBeenCalled();
    await confirm();
    expect(h.mutations.distribute.mock.calls[0][0]).toMatchObject({
      runId: "run",
      groupId: "g",
      kg: 40,
      confirm: true,
    });
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
  });
  it("hides historical costs when not authorized and blocks operator access", () => {
    const data = h.data as FeedData;
    data.permissions.canSeeCosts = false;
    data.permissions.canOperate = false;
    data.permissions.canManage = false;
    data.runs = [run()];
    render();
    click("Storico");
    render();
    click("Gruppo test");
    const html = render();
    expect(html).not.toContain("EUR 25");
    expect(html).not.toContain("Prezzo storico");
    expect(html).not.toContain("Rettifica autorizzata");
    expect(html).toContain("Snapshot storico");
  });
  it("registers fractional containers only against a real distribution and explicit confirmation", async () => {
    const data = h.data as FeedData;
    realPrevious(data);
    data.containers = [
      {
        id: "c",
        nome: "Contenitore test",
        kg: 20,
        groupId: "g",
        recipeId: "r",
        calibratedAt: now,
        operatorId: "op",
      },
    ];
    render();
    click("Carico carro");
    render();
    click("Gruppo test");
    render();
    field("Come misuri l’avanzo?", "contenitore");
    render();
    field("Contenitore e calibrazione", "c");
    field("Numero contenitori · anche frazioni", "1,5");
    const html = render();
    expect(html).toContain("30 kg");
    click("Conferma avanzo di oggi");
    expect(h.mutations.registerLeftover).not.toHaveBeenCalled();
    await confirm();
    expect(h.mutations.registerLeftover.mock.calls[0][0]).toMatchObject({
      distributionId: "dist",
      method: "contenitore",
      containerId: "c",
      containerCount: 1.5,
      kg: 30,
      confirm: true,
    });
  });
  it("retrying a leftover keeps the original payload even when refreshed data shows its commit", async () => {
    const data = h.data as FeedData;
    realPrevious(data);
    render();
    click("Carico carro");
    render();
    click("Gruppo test");
    render();
    h.mutations.registerLeftover.mockRejectedValueOnce(new Error("lost"));
    click("Conferma avanzo di oggi");
    await expect(confirm()).rejects.toThrow("lost");
    data.leftovers = [
      { ...leftover(), kg: 0, destination: "rimosso", method: "nessuno" },
    ];
    render();
    click("Riprova stessa registrazione");
    await confirm();
    expect(h.mutations.registerLeftover.mock.calls[1][0]).toEqual(
      h.mutations.registerLeftover.mock.calls[0][0]
    );
  });
  it("reuses only after manual choice and compatibility consent and reduces fresh to 80 kg", async () => {
    const data = h.data as FeedData;
    realPrevious(data);
    data.leftovers = [leftover()];
    render();
    click("Carico carro");
    render();
    click("Gruppo test");
    render();
    click("Verifico e riconfermo");
    await confirm();
    render();
    consent("Riutilizzare parte");
    render();
    field("Avanzo da riutilizzare in questo carro (massimo 20 kg)", "20");
    render();
    expect(button("Inizia carico guidato").props.disabled).toBeTruthy();
    consent("Confermo composizione nota");
    let html = render();
    expect(html).toContain("80 kg");
    click("Inizia carico guidato");
    await confirm();
    html = render();
    expect(html).toContain("80 kg");
    expect(h.mutations.confirmLoad).not.toHaveBeenCalled();
  });
  it("other-group distribution is blocked until explicitly authorized", async () => {
    const data = h.data as FeedData;
    data.runs = [run()];
    data.groups.push({ ...group, id: "other", nome: "Altro gruppo" });
    render();
    click("Distribuzione");
    render();
    click("Gruppo test");
    render();
    field("Gruppo destinatario", "other");
    field("Peso effettivamente distribuito (kg)", "20");
    render();
    expect(button("Conferma distribuzione").props.disabled).toBeTruthy();
    consent("Sono autorizzato");
    render();
    click("Conferma distribuzione");
    await confirm();
    expect(h.mutations.distribute.mock.calls[0][0]).toMatchObject({
      groupId: "other",
      authorizeOtherGroup: true,
      kg: 20,
    });
  });
  it("manager rectification requires a reason and final confirmation", async () => {
    const data = h.data as FeedData;
    data.runs = [run()];
    render();
    click("Storico");
    render();
    click("Gruppo test");
    render();
    expect(
      button("Conferma rettifica con motivazione").props.disabled
    ).toBeTruthy();
    field("Motivazione obbligatoria · almeno 5 caratteri", "Peso errato");
    render();
    click("Conferma rettifica con motivazione");
    expect(h.mutations.rectifyLoad).not.toHaveBeenCalled();
    await confirm();
    expect(h.mutations.rectifyLoad.mock.calls[0][0]).toMatchObject({
      runId: "run",
      reason: "Peso errato",
      confirm: true,
    });
  });
  it("rectification is not available after any actual distribution", () => {
    const data = h.data as FeedData;
    realPrevious(data);
    render();
    click("Storico");
    render();
    click("Gruppo test");
    const html = render();
    expect(html).not.toContain("Rettifica autorizzata");
    expect(html).toContain("esistono distribuzioni effettive");
  });
  it("does not reapply preferences automatically or save them on render", async () => {
    const data = h.data as FeedData;
    data.settings = [
      {
        id: "s",
        scopeType: "operatore",
        scopeId: "1",
        value: {
          groupId: "g",
          method: "kg",
          kg: 40,
          destination: "riutilizzo",
        },
      },
    ];
    render();
    click("Carico carro");
    render();
    click("Gruppo test");
    const html = render();
    expect(html).toContain("Confermo zero avanzo precedente");
    expect(h.mutations.savePreferences).not.toHaveBeenCalled();
    expect(h.mutations.registerLeftover).not.toHaveBeenCalled();
  });
  it("definitive typed rejections allow correction but ambiguous failures keep retry locks", () => {
    expect(definitiveFeedRejection({ data: { code: "BAD_REQUEST" } })).toBe(
      true
    );
    expect(
      definitiveFeedRejection({ data: { code: "INTERNAL_SERVER_ERROR" } })
    ).toBe(false);
    expect(definitiveFeedRejection(new Error("offline"))).toBe(false);
  });
  it("handles empty company without demo entities", () => {
    const data = h.data as FeedData;
    data.groups = [];
    data.products = [];
    data.recipes = [];
    const html = render();
    expect(html).toContain("Non ci sono gruppi aziendali");
    expect(html).not.toContain("Gruppo test");
  });
});
