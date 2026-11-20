import type {
  AnalyticsInput,
  AnalyticsResult,
  FeedData,
  FeedDistribution,
  FeedGroup,
  FeedLeftover,
  FeedRun,
  LoadIngredient,
  MilkRecord,
  NirParams,
  NutrientValue,
} from "../../../shared/feeding/types";

/** Orth (1992), verified in Brito et al. (2022), Calculations, kg/day:
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC8982198/
 * Fat and protein in MilkRecord are percentages, not kg or g/kg.
 * Unlike some industry calculators, no assumed lactating percentage is applied.
 */
const ECM_SOURCE = "https://pmc.ncbi.nlm.nih.gov/articles/PMC8982198/";
const ECM_FORMULA = `ECM (kg) = 0,327 × latte (kg) + 12,95 × [latte (kg) × grasso (%) / 100] + 7,2 × [latte (kg) × proteine (%) / 100]. Orth (1992), ${ECM_SOURCE}`;
const DAY = 86_400_000;
const EPS = 1e-6;
type Nullable = number | null;
type Nutrients = {
  dm: Nullable;
  protein: Nullable;
  ndf: Nullable;
  starch: Nullable;
  energy: Nullable;
};
type Value = Nutrients & { cost: Nullable };
type LeftValue = {
  kg: Nullable;
  knownKg: number;
  reused: Nullable;
  discarded: Nullable;
  valid: boolean;
  measured: boolean;
};
type Bucket = {
  group: FeedGroup;
  day: string;
  runs: FeedRun[];
  distributions: FeedDistribution[];
  milk: MilkRecord[];
  observations: Array<{ at: number; heads: number; priority: number }>;
};
type Row = Record<string, Nullable>;

const known = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const safe = (v: number): Nullable => (Number.isFinite(v) ? v : null);
const sum = (values: Nullable[], empty: Nullable = null): Nullable =>
  values.length === 0
    ? empty
    : values.every((v): v is number => v !== null)
      ? safe(values.reduce((a, b) => a + b, 0))
      : null;
const ratio = (a: Nullable, b: Nullable): Nullable =>
  a !== null && b !== null && b > 0 ? safe(a / b) : null;
const scale = (v: Nullable, factor: number): Nullable =>
  factor === 0 ? 0 : v === null ? null : safe(v * factor);
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);
const keyOf = (groupId: string, day: string) => `${groupId}\u0000${day}`;
const unique = <T extends { id: string }>(items: T[]): T[] =>
  Array.from(new Map(items.map(item => [item.id, item])).values());
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const lactating = (group: FeedGroup): boolean => {
  const kind = normalize(group.tipologia);
  if (/asciutt|manz|vitell|nonlatt|rimonta|ingrasso|toro/.test(kind))
    return false;
  return /lattaz|lactat/.test(kind) || group.inLattazione > 0;
};
const emptyNutrients = (): Nutrients => ({
  dm: null,
  protein: null,
  ndf: null,
  starch: null,
  energy: null,
});
const zeroValue = (): Value => ({
  dm: 0,
  protein: 0,
  ndf: 0,
  starch: 0,
  energy: 0,
  cost: 0,
});
const fraction = (param: NutrientValue | undefined): Nullable => {
  if (!param || !known(param.value)) return null;
  const unit = normalize(param.unit);
  const value =
    param.unit.trim().startsWith("%") || /percent/.test(unit)
      ? param.value / 100
      : /^gkg(ss|tq|ndf|dm)?$/.test(unit)
        ? param.value / 1000
        : /^kgkg(ss|tq|ndf|dm)?$/.test(unit) ||
            unit === "fraction" ||
            unit === "frazione"
          ? param.value
          : null;
  return value !== null && value <= 1 ? value : null;
};
const findParam = (
  params: NirParams,
  aliases: string[]
): NutrientValue | undefined => {
  const accepted = aliases.map(normalize);
  const matches = Object.entries(params).filter(
    ([key, value]) => accepted.includes(normalize(key)) && value.value !== null
  );
  return matches.length === 1 ? matches[0][1] : undefined;
};
function ingredientNutrients(
  item: LoadIngredient,
  params: NirParams
): Nutrients {
  if (item.actualKg === 0)
    return { dm: 0, protein: 0, ndf: 0, starch: 0, energy: 0 };
  const ss = findParam(params, [
    "ss",
    "dm",
    "dryMatter",
    "sostanza secca",
    "sostanzaSecca",
  ]);
  const moisture = findParam(params, ["umidita", "moisture", "humidity"]);
  let dmFraction: Nullable =
    known(item.dryMatter) && item.dryMatter <= 100
      ? item.dryMatter / 100
      : null;
  if (dmFraction === null && ss?.basis === "TQ") dmFraction = fraction(ss);
  if (dmFraction === null && moisture?.basis === "TQ") {
    const water = fraction(moisture);
    dmFraction = water === null ? null : 1 - water;
  }
  const dm = dmFraction === null ? null : scale(dmFraction, item.actualKg);
  const mass = (aliases: string[]): Nullable => {
    const param = findParam(params, aliases);
    const f = fraction(param);
    if (f === null || !param || param.basis === "NDF") return null;
    return param.basis === "TQ"
      ? scale(f, item.actualKg)
      : dm === null
        ? null
        : scale(dm, f);
  };
  const energyParam = findParam(params, [
    "enl",
    "nel",
    "energia netta lattazione",
    "energiaNetta",
    "netEnergyLactation",
    "energia",
  ]);
  let energy: Nullable = null;
  if (energyParam && known(energyParam.value) && energyParam.basis !== "NDF") {
    const unit = normalize(energyParam.unit);
    const perKg = /mcal/.test(unit)
      ? energyParam.value
      : /mj/.test(unit)
        ? energyParam.value / 4.184
        : null;
    const base = energyParam.basis === "TQ" ? item.actualKg : dm;
    energy = perKg === null || base === null ? null : scale(perKg, base);
  }
  return {
    dm,
    protein: mass([
      "pg",
      "cp",
      "proteina",
      "proteine",
      "protein",
      "proteinaGrezza",
      "proteineGrezze",
      "proteinGrezza",
      "crudeProtein",
    ]),
    ndf: mass(["ndf"]),
    starch: mass(["amido", "starch", "am"]),
    energy,
  };
}

/** Pure projection, no DB, current-price lookup, clock, mutation or resampling.
 * Period timestamps are inclusive. Graph/calendar buckets use UTC (the API has
 * no farm timezone). A leftover belongs to its original distribution, even if
 * measured after the selected period: a later observation corrects that meal.
 * Loads are counted by load timestamp; distributions by distribution timestamp.
 * CostUsed is NEW inventory consumed, not a new expense. CostDistributed is
 * gross handling value, including transferred reuse. Cost/costAllocated subtract
 * only the value transferred for reuse; discarded feed remains charged to its
 * original group. These cost columns must never be added together.
 * No leftover observation is NOT an observation of zero. All intake is estimated.
 */
export function feedingAnalytics(
  data: FeedData,
  input: AnalyticsInput
): AnalyticsResult {
  if (!data.permissions.canView)
    throw new Error("Non autorizzato a consultare l'alimentazione.");
  if (
    !known(input.from) ||
    !known(input.to) ||
    input.to < input.from ||
    input.to > 8.64e15
  ) {
    throw new Error(
      "Periodo non valido: indicare timestamp UTC e una fine successiva all'inizio."
    );
  }
  const warnings = new Set<string>();
  const sourceSet = new Set<string>([
    "Carichi e distribuzioni effettivi: snapshot quantità, prezzi, composizione e capi del momento; nessuna ricetta o prezzo attuale moltiplicati per giorni.",
    "Calendario UTC; estremi inclusivi. Nessuna interpolazione o produzione inventata nei giorni mancanti.",
    "Avanzi attribuiti alla distribuzione originale, anche se misurati successivamente al periodo; riuso sottratto una sola volta dall'ingestione.",
    "Costo utilizzato = prelievo fresco; costo distribuito = valore lordo movimentato; costo attribuito = distribuito meno valore trasferito per riuso, inclusi gli scarti. Non sommare queste voci.",
    "Giorni-capo: capi totali da carichi/distribuzioni; capi in lattazione da rilevazioni latte, senza confondere le due popolazioni; solo giorni con snapshot osservati, conteggio una volta per gruppo/giorno; cambi intragiornalieri ponderati per durata. Il primo snapshot del giorno rappresenta l'inizio del solo giorno osservato; nessuna estensione ai giorni senza osservazioni.",
    `ECM Orth (1992), verifica in Brito et al. (2022): ${ECM_SOURCE}`,
  ]);
  const inPeriod = (at: number) =>
    known(at) && at >= input.from && at <= input.to;
  const groupMap = new Map(unique(data.groups).map(g => [g.id, g]));
  const selected = unique(data.groups).filter(
    g =>
      (!input.groupId || g.id === input.groupId) &&
      (!input.lactatingOnly || lactating(g))
  );
  const selectedIds = new Set(selected.map(g => g.id));
  if (input.groupId && !groupMap.has(input.groupId))
    warnings.add(
      "Gruppo non disponibile nella propria azienda; nessun dato restituito."
    );
  const runs = unique(data.runs).filter(
    r => r.state !== "annullato" && r.state !== "preparazione" && known(r.at)
  );
  const runMap = new Map(runs.map(r => [r.id, r]));
  const distributions = unique(data.distributions).filter(
    d =>
      !d.annulled &&
      known(d.at) &&
      known(d.kg) &&
      (!data.runs.some(r => r.id === d.runId) || runMap.has(d.runId))
  );
  const distributionMap = new Map(distributions.map(d => [d.id, d]));
  const leftovers = unique(data.leftovers);
  const leftMap = new Map(leftovers.map(l => [l.id, l]));
  const byDistribution = new Map<string, FeedLeftover[]>();
  for (const left of leftovers) {
    const original = distributionMap.get(left.distributionId);
    if (!original) {
      if (selectedIds.has(left.groupId) && inPeriod(left.at))
        warnings.add(
          "Avanzi senza distribuzione valida: esclusi, non attribuiti alla giornata di registrazione."
        );
      continue;
    }
    if (
      left.groupId !== original.groupId ||
      !known(left.at) ||
      left.at < original.at
    ) {
      if (selectedIds.has(original.groupId) && inPeriod(original.at))
        warnings.add(
          "Avanzo con gruppo/data incoerenti: ingestione non calcolabile per la distribuzione originale."
        );
    }
    const list = byDistribution.get(original.id) ?? [];
    list.push(left);
    byDistribution.set(original.id, list);
  }
  const reuseByLeft = new Map<string, number>();
  for (const run of runs) {
    if (run.leftoverId && known(run.reusedKg))
      reuseByLeft.set(
        run.leftoverId,
        (reuseByLeft.get(run.leftoverId) ?? 0) + run.reusedKg
      );
  }
  const leftValue = (distribution: FeedDistribution): LeftValue => {
    const records = byDistribution.get(distribution.id) ?? [];
    if (distribution.kg === 0 && records.length === 0)
      return {
        kg: 0,
        knownKg: 0,
        reused: 0,
        discarded: 0,
        valid: true,
        measured: true,
      };
    const measured = records.length > 0;
    const valid =
      measured &&
      records.every(
        l =>
          known(l.kg) &&
          known(l.reusedKg) &&
          known(l.discardedKg) &&
          l.groupId === distribution.groupId &&
          known(l.at) &&
          l.at >= distribution.at &&
          Math.max(reuseByLeft.get(l.id) ?? 0, l.reusedKg) + l.discardedKg <=
            l.kg + EPS
      ) &&
      records.reduce((n, l) => n + (known(l.kg) ? l.kg : 0), 0) <=
        distribution.kg + EPS;
    return {
      kg: valid ? records.reduce((n, l) => n + l.kg, 0) : null,
      knownKg: records.reduce((n, l) => n + (known(l.kg) ? l.kg : 0), 0),
      reused: valid
        ? records.reduce(
            (n, l) => n + Math.max(reuseByLeft.get(l.id) ?? 0, l.reusedKg),
            0
          )
        : null,
      discarded: valid ? records.reduce((n, l) => n + l.discardedKg, 0) : null,
      valid,
      measured,
    };
  };
  const runCache = new Map<string, Value>();
  const distributionCache = new Map<string, Value>();
  const evaluating = new Set<string>();
  const addValues = (values: Value[]): Value => {
    const value = zeroValue();
    for (const key of [
      "cost",
      "dm",
      "protein",
      "ndf",
      "starch",
      "energy",
    ] as const)
      value[key] = sum(
        values.map(v => v[key]),
        0
      );
    return value;
  };
  const scaled = (value: Value, factor: number): Value => {
    const result = zeroValue();
    for (const key of [
      "cost",
      "dm",
      "protein",
      "ndf",
      "starch",
      "energy",
    ] as const)
      result[key] = scale(value[key], factor);
    return result;
  };
  const freshValue = (run: FeedRun): Value => {
    if (!known(run.freshKg)) return { ...emptyNutrients(), cost: null };
    if (run.freshKg === 0) return zeroValue();
    const items = run.ingredients.filter(i => i.actualKg !== 0);
    const quantitiesValid =
      items.length > 0 &&
      items.every(i => known(i.actualKg)) &&
      Math.abs(items.reduce((n, i) => n + i.actualKg, 0) - run.freshKg) <=
        Math.max(EPS, run.freshKg * 1e-6);
    const components: Value[] = items.map(item => {
      const historical = item.nirId
        ? data.nirAnalyses.find(
            n =>
              n.id === item.nirId &&
              n.productId === item.productId &&
              n.at <= run.at
          )
        : undefined;
      const params = Object.keys(item.params ?? {}).length
        ? item.params
        : (historical?.params ?? {});
      const cost = known(item.costCents)
        ? item.costCents / 100
        : known(item.unitCostCentsPerKg) && known(item.actualKg)
          ? (item.unitCostCentsPerKg * item.actualKg) / 100
          : null;
      return { ...ingredientNutrients(item, params), cost };
    });
    const result = quantitiesValid
      ? addValues(components)
      : { ...emptyNutrients(), cost: null };
    // Core run.totalCostCents includes inherited reuse value. Only ingredient
    // rows measure NEW inventory consumed; never use a gross reused-run total
    // as fresh cost. A no-reuse run total is a safe historical fallback.
    if (run.reusedKg === 0 && known(run.totalCostCents))
      result.cost = run.totalCostCents / 100;
    return result;
  };
  const runValue = (run: FeedRun): Value => {
    const cached = runCache.get(run.id);
    if (cached) return cached;
    if (evaluating.has(run.id)) return { ...emptyNutrients(), cost: null };
    evaluating.add(run.id);
    let value = freshValue(run);
    if (
      !known(run.reusedKg) ||
      !known(run.totalKg) ||
      Math.abs(run.totalKg - run.freshKg - run.reusedKg) > EPS
    ) {
      value = { ...emptyNutrients(), cost: null };
    } else if (run.reusedKg > 0) {
      const left = run.leftoverId ? leftMap.get(run.leftoverId) : undefined;
      const origin = left
        ? distributionMap.get(left.distributionId)
        : undefined;
      const validReuse =
        left &&
        origin &&
        left.compositionKnown &&
        leftValue(origin).valid &&
        left.at <= run.at &&
        origin.at <= run.at &&
        known(left.kg) &&
        run.reusedKg <= left.kg + EPS &&
        origin.kg > 0;
      const reusedValue = validReuse
        ? scaled(distributionValue(origin), run.reusedKg / origin.kg)
        : { ...emptyNutrients(), cost: null };
      value = addValues([value, reusedValue]);
    }
    // Authoritative gross snapshot, if present, already includes transferred
    // reuse cost. It replaces—not adds to—the reconstructed gross cost.
    if (known(run.totalCostCents)) value.cost = run.totalCostCents / 100;
    evaluating.delete(run.id);
    runCache.set(run.id, value);
    return value;
  };
  const distributionValue = (distribution: FeedDistribution): Value => {
    const cached = distributionCache.get(distribution.id);
    if (cached) return cached;
    const run = runMap.get(distribution.runId);
    let value: Value =
      distribution.kg === 0
        ? zeroValue()
        : run &&
            known(run.totalKg) &&
            run.totalKg > 0 &&
            distribution.kg <= run.totalKg + EPS
          ? scaled(runValue(run), distribution.kg / run.totalKg)
          : { ...emptyNutrients(), cost: null };
    if (known(distribution.costCents))
      value.cost = distribution.costCents / 100;
    if (
      known(distribution.dryMatterKg) &&
      distribution.dryMatterKg <= distribution.kg + EPS
    )
      value.dm = distribution.dryMatterKg;
    distributionCache.set(distribution.id, value);
    return value;
  };
  const bucketMap = new Map<string, Bucket>();
  const bucketFor = (groupId: string, at: number) => {
    const day = dayOf(at);
    const key = keyOf(groupId, day);
    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = {
        group: groupMap.get(groupId)!,
        day,
        runs: [],
        distributions: [],
        milk: [],
        observations: [],
      };
      bucketMap.set(key, bucket);
    }
    return bucket;
  };
  const observe = (
    bucket: Bucket,
    at: number,
    heads: number,
    priority: number
  ) => {
    if (known(heads)) bucket.observations.push({ at, heads, priority });
  };
  for (const run of runs.filter(
    r => selectedIds.has(r.groupId) && inPeriod(r.at)
  )) {
    const bucket = bucketFor(run.groupId, run.at);
    bucket.runs.push(run);
    observe(bucket, run.at, run.headCount, 1);
  }
  for (const distribution of distributions.filter(
    d => selectedIds.has(d.groupId) && inPeriod(d.at)
  )) {
    const bucket = bucketFor(distribution.groupId, distribution.at);
    bucket.distributions.push(distribution);
    observe(bucket, distribution.at, distribution.headCount, 2);
    if (!runMap.has(distribution.runId))
      warnings.add(
        "Una distribuzione non ha un carro disponibile: si usano esclusivamente i suoi snapshot, senza ricostruire da ricette correnti."
      );
  }
  const allMilk = unique(data.milkRecords).filter(
    m => known(m.at) && known(m.milkKg)
  );
  for (const milk of allMilk.filter(
    m => selectedIds.has(m.groupId) && inPeriod(m.at)
  )) {
    const group = groupMap.get(milk.groupId)!;
    if (!lactating(group)) {
      warnings.add(
        `Latte registrato per ${group.nome}, gruppo non in lattazione: escluso dagli indicatori latte, IOFC ed efficienza.`
      );
      continue;
    }
    const bucket = bucketFor(milk.groupId, milk.at);
    bucket.milk.push(milk);
    observe(bucket, milk.at, milk.headCount, 3);
  }
  const headDaysFor = (bucket: Bucket, milkOnly = false): Nullable => {
    const feedingSnapshots = bucket.observations.filter(o => o.priority !== 3);
    // MilkRecord.headCount counts lactating animals; run/distribution.headCount
    // counts ALL animals. A mixed group must not mistake these for herd moves.
    const candidates = milkOnly
      ? bucket.observations.filter(o => o.priority === 3)
      : feedingSnapshots.length
        ? feedingSnapshots
        : bucket.observations;
    const snapshots = candidates
      .slice()
      .sort((a, b) => a.at - b.at || a.priority - b.priority);
    if (!snapshots.length) return null;
    const start = Math.max(Date.parse(`${bucket.day}T00:00:00Z`), input.from);
    const end = Math.min(
      Date.parse(`${bucket.day}T00:00:00Z`) + DAY,
      input.to + 1
    );
    let cursor = start;
    let heads = snapshots[0].heads;
    let total = 0;
    for (const snapshot of snapshots) {
      total += (heads * Math.max(0, snapshot.at - cursor)) / DAY;
      heads = snapshot.heads;
      cursor = snapshot.at;
    }
    return safe(total + (heads * Math.max(0, end - cursor)) / DAY);
  };
  const priceFor = (
    milk: MilkRecord
  ): { price: Nullable; estimated: boolean } => {
    if (known(milk.pricePerKg))
      return {
        price: milk.pricePerKg,
        estimated: /stim|estimate/i.test(milk.priceSource),
      };
    // Last known company price, never a future record, never a market default.
    const previous = allMilk
      .filter(
        m =>
          m.at <= milk.at &&
          known(m.pricePerKg) &&
          !/stim|estimate/i.test(m.priceSource)
      )
      .sort(
        (a, b) =>
          b.at - a.at ||
          Number(b.groupId === milk.groupId) -
            Number(a.groupId === milk.groupId)
      )[0];
    if (!previous) return { price: null, estimated: false };
    sourceSet.add(
      `Prezzo latte stimato da ultimo prezzo registrato: rilevazione ${previous.id}, ${dayOf(previous.at)}, fonte ${previous.priceSource || previous.source || "registrazione aziendale"}.`
    );
    return { price: previous.pricePerKg, estimated: true };
  };
  const rows = new Map<string, Row>();
  for (const [key, bucket] of Array.from(bucketMap)) {
    const values = bucket.distributions.map(distributionValue);
    const lefts = bucket.distributions.map(leftValue);
    const fresh = bucket.runs.map(freshValue);
    const r: Row = {};
    r.headDays = headDaysFor(bucket);
    r.lactatingHeadDays = lactating(bucket.group)
      ? headDaysFor(bucket, true)
      : null;
    r.loadedKg = sum(
      bucket.runs.map(run => (known(run.totalKg) ? run.totalKg : null))
    );
    r.freshKg = sum(
      bucket.runs.map(run => (known(run.freshKg) ? run.freshKg : null))
    );
    r.reusedKg = sum(
      bucket.runs.map(run => (known(run.reusedKg) ? run.reusedKg : null))
    );
    r.costUsed = sum(fresh.map(v => v.cost));
    r.distributedKg = sum(bucket.distributions.map(d => d.kg));
    r.costDistributed = sum(values.map(v => v.cost));
    r.dmDistributedKg = sum(values.map(v => v.dm));
    r.leftoverKg = sum(lefts.map(l => l.kg));
    r.knownLeftoverKg = sum(lefts.map(l => l.knownKg));
    r.discardedKg = sum(lefts.map(l => l.discarded));
    r.transferredReuseKg = sum(lefts.map(l => l.reused));
    r.costDiscarded = sum(
      values.map((v, i) =>
        lefts[i].discarded === null
          ? null
          : scale(
              v.cost,
              lefts[i].discarded! / (bucket.distributions[i].kg || 1)
            )
      )
    );
    // Missing leftover observation cannot hide the observed feed charge. When a
    // measured leftover has inconsistent dispositions, allocation is unknown.
    const reuseCosts = values.map((v, i) =>
      !lefts[i].measured
        ? 0
        : lefts[i].reused === null
          ? null
          : scale(v.cost, lefts[i].reused! / (bucket.distributions[i].kg || 1))
    );
    r.costReused = sum(reuseCosts);
    r.cost = sum(
      values.map((v, i) =>
        v.cost === null || reuseCosts[i] === null
          ? null
          : v.cost - reuseCosts[i]!
      )
    );
    r.costAllocated = r.cost;
    const intakes = bucket.distributions.map((d, i) =>
      lefts[i].kg === null ? null : Math.max(0, d.kg - lefts[i].kg!)
    );
    r.ingestionKg = sum(intakes);
    const intakeValues = values.map((v, i) =>
      intakes[i] === null
        ? { ...emptyNutrients(), cost: null }
        : scaled(v, intakes[i]! / (bucket.distributions[i].kg || 1))
    );
    r.dm = sum(intakeValues.map(v => v.dm));
    r.dmIngestedKg = r.dm;
    r.ingestionEstimated = bucket.distributions.length ? 1 : null;
    r.leftoverObservedDistributions = lefts.filter(l => l.valid).length;
    r.distributionCount = bucket.distributions.length;
    r.runCount = bucket.runs.length;
    if (lefts.some(l => !l.measured))
      warnings.add(
        "Ingestione non calcolabile dove manca la misurazione dell'avanzo: assenza di registrazione non equivale a zero."
      );
    if (lefts.some(l => l.measured && !l.valid))
      warnings.add(
        "Quantità o destinazioni degli avanzi incoerenti: ingestione e valori trasferiti non calcolabili, nessuna quantità negativa forzata."
      );
    if (bucket.distributions.length)
      warnings.add(
        "Ingestione e sostanza secca ingerita sono stime; per gli avanzi si assume la composizione storica della razione, non essendo presente un'analisi autonoma dell'avanzo."
      );
    if (values.some(v => v.dm === null))
      warnings.add(
        "Sostanza secca storica mancante per alcune distribuzioni: nessun NIR attivo attuale sostituisce lo snapshot."
      );
    if (
      data.permissions.canSeeCosts &&
      (values.some(v => v.cost === null) || fresh.some(v => v.cost === null))
    )
      warnings.add(
        "Costo storico mancante per alcuni carichi/distribuzioni: totale incompleto non sostituito con zero o prezzo corrente."
      );
    const prices = bucket.milk.map(priceFor);
    r.priceEstimatedRecords = prices.filter(p => p.estimated).length;
    r.milk = sum(bucket.milk.map(m => m.milkKg));
    r.revenue = sum(
      bucket.milk.map((m, i) =>
        m.milkKg === 0
          ? 0
          : prices[i].price === null
            ? null
            : scale(prices[i].price, m.milkKg)
      )
    );
    r.ecm = sum(
      bucket.milk.map(m =>
        known(m.fat) && m.fat <= 100 && known(m.protein) && m.protein <= 100
          ? safe(
              m.milkKg *
                (0.327 + (12.95 * m.fat) / 100 + (7.2 * m.protein) / 100)
            )
          : null
      )
    );
    r.iofc =
      lactating(bucket.group) &&
      r.milk !== null &&
      r.revenue !== null &&
      r.cost !== null
        ? safe(r.revenue - r.cost)
        : null;
    r.iofcActual = r.iofc !== null && !r.priceEstimatedRecords ? r.iofc : null;
    if (prices.some(p => p.estimated))
      warnings.add(
        "IOFC/ricavo con ultimo prezzo latte noto: stima esplicita, non liquidazione del periodo. Separato da IOFC effettivo."
      );
    if (prices.some(p => p.price === null))
      warnings.add(
        "Prezzo del latte mancante: ricavo e IOFC non calcolabili, nessun prezzo standard inventato."
      );
    if (bucket.milk.some(m => !known(m.fat) || !known(m.protein)))
      warnings.add(
        "ECM non calcolabile dove mancano grasso o proteine del latte."
      );
    r.iofcMatchedGroupDays = r.iofc !== null ? 1 : 0;
    r.actualIofcMatchedGroupDays = r.iofcActual !== null ? 1 : 0;
    r.iofcHeadDays = r.iofc !== null ? r.lactatingHeadDays : null;
    r.iofcMilk = r.iofc !== null ? r.milk : null;
    r.efficiencyMilk =
      lactating(bucket.group) && r.milk !== null && r.dm !== null
        ? r.milk
        : null;
    r.efficiencyDm = r.efficiencyMilk !== null ? r.dm : null;
    r.ecmEfficiencyMilk =
      lactating(bucket.group) && r.ecm !== null && r.dm !== null ? r.ecm : null;
    r.ecmEfficiencyDm = r.ecmEfficiencyMilk !== null ? r.dm : null;
    r.costMilk =
      lactating(bucket.group) && r.milk !== null && r.cost !== null
        ? r.cost
        : null;
    r.costMilkDenominator = r.costMilk !== null ? r.milk : null;
    r.costHeadDays = r.cost !== null ? r.headDays : null;
    r.dmHeadDays = r.dm !== null ? r.headDays : null;
    r.milkHeadDays = r.milk !== null ? r.lactatingHeadDays : null;
    r.ecmHeadDays = r.ecm !== null ? r.lactatingHeadDays : null;
    for (const nutrient of [
      "dm",
      "protein",
      "ndf",
      "starch",
      "energy",
    ] as const) {
      r[`${nutrient}Distributed`] = sum(values.map(v => v[nutrient]));
      r[`${nutrient}Fresh`] = sum(fresh.map(v => v[nutrient]));
    }
    rows.set(key, r);
  }
  // A cell's null is never silently converted to zero when summing required
  // source measurements. Matched ratios deliberately use their own cohorts.
  const matchedKeys = new Set([
    "iofc",
    "iofcActual",
    "iofcHeadDays",
    "iofcMilk",
    "efficiencyMilk",
    "efficiencyDm",
    "ecmEfficiencyMilk",
    "ecmEfficiencyDm",
    "costMilk",
    "costMilkDenominator",
    "costHeadDays",
    "dmHeadDays",
    "milkHeadDays",
    "ecmHeadDays",
  ]);
  const allKeys = Array.from(
    new Set([
      "headDays",
      "lactatingHeadDays",
      "loadedKg",
      "freshKg",
      "reusedKg",
      "costUsed",
      "distributedKg",
      "costDistributed",
      "costDiscarded",
      "costReused",
      "cost",
      "costAllocated",
      "dmDistributedKg",
      "leftoverKg",
      "knownLeftoverKg",
      "discardedKg",
      "transferredReuseKg",
      "ingestionKg",
      "dm",
      "dmIngestedKg",
      "ingestionEstimated",
      "leftoverObservedDistributions",
      "distributionCount",
      "runCount",
      "priceEstimatedRecords",
      "milk",
      "revenue",
      "ecm",
      "iofc",
      "iofcActual",
      "iofcMatchedGroupDays",
      "actualIofcMatchedGroupDays",
      "iofcHeadDays",
      "iofcMilk",
      "efficiencyMilk",
      "efficiencyDm",
      "ecmEfficiencyMilk",
      "ecmEfficiencyDm",
      "costMilk",
      "costMilkDenominator",
      "costHeadDays",
      "dmHeadDays",
      "milkHeadDays",
      "ecmHeadDays",
      "dmDistributed",
      "dmFresh",
      "proteinDistributed",
      "proteinFresh",
      "ndfDistributed",
      "ndfFresh",
      "starchDistributed",
      "starchFresh",
      "energyDistributed",
      "energyFresh",
      ...Array.from(rows.values()).flatMap(r => Object.keys(r)),
    ])
  );
  const aggregate = (entries: Row[]): Row => {
    const result: Row = {};
    for (const key of allKeys) {
      let required = entries;
      if (
        key === "milk" ||
        key === "revenue" ||
        key === "ecm" ||
        key === "priceEstimatedRecords"
      )
        required = entries.filter(r => r.milk !== null);
      else if (
        /Fresh$/.test(key) ||
        ["loadedKg", "freshKg", "reusedKg", "costUsed"].includes(key)
      )
        required = entries.filter(r => (r.runCount ?? 0) > 0);
      else if (
        /Distributed$/.test(key) ||
        [
          "distributedKg",
          "costDistributed",
          "cost",
          "costAllocated",
          "costDiscarded",
          "costReused",
          "dmDistributedKg",
          "leftoverKg",
          "knownLeftoverKg",
          "discardedKg",
          "transferredReuseKg",
          "ingestionKg",
          "dm",
          "dmIngestedKg",
        ].includes(key)
      )
        required = entries.filter(r => (r.distributionCount ?? 0) > 0);
      const values = required.map(r => r[key] ?? null);
      result[key] = matchedKeys.has(key)
        ? sum(values.filter((v): v is number => v !== null))
        : sum(values);
    }
    result.ingestionEstimated = entries.some(r => r.ingestionEstimated === 1)
      ? 1
      : null;
    result.leftover = result.leftoverKg;
    for (const key of [
      "runCount",
      "distributionCount",
      "leftoverObservedDistributions",
      "iofcMatchedGroupDays",
      "actualIofcMatchedGroupDays",
      "priceEstimatedRecords",
    ]) {
      if (!entries.length) result[key] = 0;
    }
    result.iofcPerHead = ratio(result.iofc, result.iofcHeadDays);
    result.iofcPerMilk = ratio(result.iofc, result.iofcMilk);
    result.costPerHead = ratio(
      sum(entries.filter(r => r.cost !== null).map(r => r.cost)),
      result.costHeadDays
    );
    result.milkPerHead = ratio(result.milk, result.milkHeadDays);
    result.ecmPerHead = ratio(result.ecm, result.ecmHeadDays);
    result.dmPerHead = ratio(result.dm, result.dmHeadDays);
    result.ingestionPerHead = ratio(
      result.ingestionKg,
      sum(entries.filter(r => r.ingestionKg !== null).map(r => r.headDays))
    );
    result.leftoverPercent = scale(
      ratio(result.leftoverKg, result.distributedKg),
      100
    );
    result.efficiency = ratio(result.efficiencyMilk, result.efficiencyDm);
    result.ecmEfficiency = ratio(
      result.ecmEfficiencyMilk,
      result.ecmEfficiencyDm
    );
    result.costPerMilk = ratio(result.costMilk, result.costMilkDenominator);
    result.costPerDm = ratio(result.costDistributed, result.dmDistributed);
    result.costPerDmFresh = ratio(result.costUsed, result.dmFresh);
    result.costPerProtein = ratio(
      result.costDistributed,
      result.proteinDistributed
    );
    result.costPerNdf = ratio(result.costDistributed, result.ndfDistributed);
    result.costPerStarch = ratio(
      result.costDistributed,
      result.starchDistributed
    );
    result.costPerMcal = ratio(
      result.costDistributed,
      result.energyDistributed
    );
    return result;
  };
  const requestedDays =
    Math.floor(input.to / DAY) - Math.floor(input.from / DAY) + 1;
  const allRows = Array.from(rows.values());
  const totals = aggregate(allRows);
  const days = Array.from(
    new Set(Array.from(bucketMap.values()).map(b => b.day))
  ).sort();
  const daily: AnalyticsResult["daily"] = days.map(day => ({
    day,
    ...aggregate(
      Array.from(rows)
        .filter(([key]) => key.endsWith(`\u0000${day}`))
        .map(([, row]) => row)
    ),
  }));
  const groupResults: AnalyticsResult["groups"] = selected.map(group => {
    const groupRows = Array.from(rows)
      .filter(([key]) => key.startsWith(`${group.id}\u0000`))
      .map(([, row]) => row);
    const metrics = aggregate(groupRows);
    metrics.iofcDailyAverage = ratio(
      metrics.iofc,
      groupRows.filter(r => r.iofc !== null).length
    );
    metrics.costDailyAverage = ratio(
      metrics.cost,
      groupRows.filter(r => r.cost !== null).length
    );
    metrics.iofcMatchedDays = groupRows.filter(r => r.iofc !== null).length;
    return {
      ...metrics,
      groupId: group.id,
      nome: group.nome,
      lactating: lactating(group),
      headDays:
        sum(
          groupRows.map(r => r.headDays),
          0
        ) ?? 0,
      observedDays: groupRows.length,
      headSnapshotDays: groupRows.filter(r => r.headDays !== null).length,
      headDaysKnown:
        groupRows.length > 0 && groupRows.every(r => r.headDays !== null),
      requestedDays,
    };
  });
  totals.observedDays = days.length;
  totals.requestedDays = requestedDays;
  totals.observedGroupDays = allRows.length;
  totals.requestedGroupDays = requestedDays * selected.length;
  totals.headSnapshotGroupDays = allRows.filter(
    r => r.headDays !== null
  ).length;
  totals.milkGroupDays = allRows.filter(r => r.milk !== null).length;
  totals.feedGroupDays = allRows.filter(
    r => (r.distributionCount ?? 0) > 0
  ).length;
  totals.efficiencyMatchedGroupDays = allRows.filter(
    r => r.efficiencyMilk !== null
  ).length;
  totals.iofcMatchedDays = daily.filter(r => r.iofc !== null).length;
  totals.iofcDailyAverage = ratio(totals.iofc, totals.iofcMatchedDays);
  totals.costDailyAverage = ratio(
    totals.cost,
    totals.feedGroupDays === 0
      ? null
      : daily.filter(r => r.cost !== null).length
  );
  // All dates can be observed yet have absent measurements for another group.
  const coverage = `${days.length}/${requestedDays} giorni UTC con eventi; ${allRows.length}/${requestedDays * selected.length} giorni-gruppo osservati; ${totals.headSnapshotGroupDays ?? 0} con snapshot capi; ${totals.feedGroupDays ?? 0} con distribuzioni, ${totals.milkGroupDays ?? 0} con latte; IOFC ${totals.iofcMatchedGroupDays ?? 0} giorni-gruppo abbinati (${totals.actualIofcMatchedGroupDays ?? 0} con prezzo effettivo); avanzi misurati ${totals.leftoverObservedDistributions ?? 0}/${totals.distributionCount ?? 0} distribuzioni. I totali coprono solo osservazioni, non l'intero periodo se incompleto.`;
  if (!allRows.length)
    warnings.add(
      "Nessun evento reale disponibile per gruppo e periodo selezionati."
    );
  if (allRows.length < requestedDays * selected.length)
    warnings.add(
      "Copertura storica incompleta: giorni mancanti non ricostruiti e giorni-capo non estrapolati dalla mandria attuale."
    );
  if (
    Array.from(rows).some(
      ([key, r]) =>
        (r.milk !== null && (r.distributionCount ?? 0) === 0) ||
        (lactating(groupMap.get(key.split("\u0000")[0])!) &&
          (r.distributionCount ?? 0) > 0 &&
          r.milk === null)
    )
  )
    warnings.add(
      "Latte e costo alimentare non presenti negli stessi giorni-gruppo: IOFC ed efficienza usano solo le osservazioni abbinate, non la differenza tra totali disallineati."
    );
  if (selected.some(g => !lactating(g)))
    sourceSet.add(
      "Stato lattazione da Stalla/Gruppi: non è disponibile nel contratto una cronologia dello stato produttivo. Nessun indicatore latte per manze/asciutta."
    );
  sourceSet.add(
    "Costi per nutriente: costo lordo delle distribuzioni / massa storica distribuita; costi per SS fresca: prelievo fresco / SS fresca. Rapporti comparativi, non costi da sommare. Energia convertita MJ → Mcal con 4,184 MJ/Mcal."
  );
  // Defense in depth: prevent cost leakage even when upstream FeedData has not
  // been redacted. Price-derived revenue, IOFC and their coverage are sensitive.
  if (!data.permissions.canSeeCosts) {
    const redact = (row: Record<string, unknown>) => {
      for (const key of Object.keys(row))
        if (/cost|iofc|revenue|price/i.test(key)) row[key] = null;
    };
    redact(totals);
    daily.forEach(redact);
    groupResults.forEach(redact);
    for (const source of Array.from(sourceSet))
      if (source.startsWith("Prezzo latte stimato")) sourceSet.delete(source);
    for (const warning of Array.from(warnings))
      if (/costo|prezzo|iofc|ricavo/i.test(warning)) warnings.delete(warning);
  }
  return {
    from: input.from,
    to: input.to,
    coverage: data.permissions.canSeeCosts
      ? coverage
      : `${days.length}/${requestedDays} giorni UTC con eventi; ${allRows.length}/${requestedDays * selected.length} giorni-gruppo osservati; avanzi misurati ${totals.leftoverObservedDistributions ?? 0}/${totals.distributionCount ?? 0} distribuzioni. Costi e indicatori economici riservati.`,
    totals,
    daily,
    groups: groupResults,
    warnings: Array.from(warnings),
    sources: Array.from(sourceSet),
    formulaECM: ECM_FORMULA,
  };
}
