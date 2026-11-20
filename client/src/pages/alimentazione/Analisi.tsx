import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalyticsInput,
  AnalyticsResult,
  FeedData,
  FeedGroup,
} from "@shared/feeding/types";
import { trpc } from "@/lib/trpc";
import {
  ACTION,
  INPUT,
  PANEL,
  FeedPage,
  FeedStatus,
  Field,
  eur,
  qty,
  useFeed,
  useFeedConfirm,
} from "./shared";

type Period = "7" | "30" | "90" | "365" | "custom";
type Metric = {
  key: string;
  label: string;
  unit: string;
  economic?: boolean;
  milk?: boolean;
  note?: string;
};
const METRICS: Metric[] = [
  {
    key: "iofcPerHead",
    label: "IOFC per capo / giorno",
    unit: "€/capo/giorno",
    economic: true,
    milk: true,
  },
  {
    key: "iofc",
    label: "IOFC del periodo",
    unit: "€",
    economic: true,
    milk: true,
  },
  {
    key: "iofcActual",
    label: "IOFC con prezzo latte effettivo",
    unit: "€",
    economic: true,
    milk: true,
    note: "Solo giorni-gruppo abbinati con prezzo effettivo. L’IOFC del periodo può includere stime: verifica copertura e avvisi.",
  },
  {
    key: "iofcDailyAverage",
    label: "IOFC medio nei giorni abbinati",
    note: "Media sui soli giorni con IOFC disponibile, non sui giorni senza osservazioni.",
    unit: "€/giorno",
    economic: true,
    milk: true,
  },
  {
    key: "revenue",
    label: "Ricavo latte del periodo",
    unit: "€",
    economic: true,
    milk: true,
  },
  {
    key: "iofcPerMilk",
    label: "IOFC per kg latte",
    unit: "€/kg latte",
    economic: true,
    milk: true,
  },
  {
    key: "cost",
    label: "Costo attribuito al gruppo",
    unit: "€",
    economic: true,
  },
  {
    key: "costUsed",
    label: "Costo dei prelievi freschi",
    unit: "€",
    economic: true,
  },
  {
    key: "costDistributed",
    label: "Valore lordo distribuito",
    unit: "€",
    economic: true,
  },
  {
    key: "costDiscarded",
    label: "Costo degli avanzi scartati",
    unit: "€",
    economic: true,
  },
  {
    key: "costDailyAverage",
    label: "Costo medio nei giorni osservati",
    unit: "€/giorno",
    economic: true,
  },
  {
    key: "costPerHead",
    label: "Costo per capo / giorno",
    unit: "€/capo/giorno",
    economic: true,
  },
  {
    key: "costPerDm",
    label: "Costo lordo per kg di SS distribuita",
    unit: "€/kg SS",
    economic: true,
  },
  {
    key: "costPerMilk",
    label: "Costo alimentare per kg latte",
    unit: "€/kg latte",
    economic: true,
    milk: true,
  },
  { key: "loadedKg", label: "Peso caricato complessivo", unit: "kg TQ" },
  { key: "freshKg", label: "Prelievi freschi da Magazzino", unit: "kg TQ" },
  { key: "distributedKg", label: "Quantità distribuita", unit: "kg TQ" },
  { key: "leftoverKg", label: "Avanzi attribuiti", unit: "kg TQ" },
  { key: "discardedKg", label: "Avanzi scartati", unit: "kg TQ" },
  { key: "reusedKg", label: "Avanzi riutilizzati", unit: "kg TQ" },
  { key: "leftoverPercent", label: "Percentuale di avanzo", unit: "%" },
  {
    key: "ingestionKg",
    label: "Ingestione stimata tal quale",
    unit: "kg TQ",
    note: "Stima, non misurazione diretta dell’ingestione.",
  },
  {
    key: "ingestionPerHead",
    label: "Ingestione stimata per capo / giorno",
    unit: "kg TQ/capo/giorno",
  },
  {
    key: "dmIngestedKg",
    label: "Ingestione stimata di sostanza secca",
    unit: "kg SS",
  },
  {
    key: "dmPerHead",
    label: "Ingestione SS stimata per capo / giorno",
    unit: "kg SS/capo/giorno",
  },
  {
    key: "efficiency",
    label: "Efficienza alimentare",
    unit: "kg latte/kg SS",
    milk: true,
  },
  {
    key: "milk",
    label: "Produzione latte del periodo",
    unit: "kg latte",
    milk: true,
  },
  {
    key: "milkPerHead",
    label: "Latte per capo / giorno",
    unit: "kg latte/capo/giorno",
    milk: true,
  },
  {
    key: "ecm",
    label: "Latte corretto per energia (ECM)",
    unit: "kg ECM",
    milk: true,
  },
  {
    key: "ecmPerHead",
    label: "ECM per capo / giorno",
    unit: "kg ECM/capo/giorno",
    milk: true,
  },
  {
    key: "ecmEfficiency",
    label: "Efficienza ECM",
    unit: "kg ECM/kg SS",
    milk: true,
  },
];
const CHART_KEYS = [
  "iofc",
  "efficiency",
  "milk",
  "cost",
  "dmIngestedKg",
  "leftoverKg",
  "costPerMilk",
];
const CONTROL =
  "min-h-12 rounded-xl border border-white/15 px-3 text-sm text-zinc-200 transition-colors hover:border-green-500 hover:text-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-40";

export function isLactatingGroup(group: FeedGroup | undefined) {
  if (!group) return false;
  const type = group.tipologia
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (/asciutt|manz|vitell|nonlatt|rimonta|ingrasso|toro/.test(type))
    return false;
  return /lattaz|lactat/.test(type) || group.inLattazione > 0;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}
export function analyticsPeriod(
  period: Period,
  fromDate: string,
  toDate: string,
  today: string
): { from: number; to: number; error: string | null } {
  const end = parseLocalDate(period === "custom" ? toDate : today);
  const start =
    period === "custom" ? parseLocalDate(fromDate) : end && new Date(end);
  if (!start || !end)
    return { from: 0, to: 0, error: "Inserisci entrambe le date del periodo." };
  if (period !== "custom")
    start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  end.setUTCDate(end.getUTCDate() + 1);
  const from = start.getTime();
  const to = end.getTime() - 1;
  return {
    from,
    to,
    error:
      from > to
        ? "La data iniziale non può essere successiva alla data finale."
        : null,
  };
}
export function numericMetric(
  record: Record<string, unknown> | undefined,
  key: string
): number | null {
  if (key === "iofcDailyAverage") {
    const total = numericMetric(record, "iofc");
    const matchedDays = numericMetric(record, "iofcMatchedDays");
    return total !== null && matchedDays !== null && matchedDays > 0
      ? total / matchedDays
      : null;
  }
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function allowedMetrics(
  canSeeCosts: boolean,
  milkRelevant: boolean
): Metric[] {
  return METRICS.filter(
    metric =>
      (!metric.economic || canSeeCosts) && (!metric.milk || milkRelevant)
  );
}
export function analyticsDaily(
  result: AnalyticsResult | undefined,
  key: string
) {
  if (!result) return [];
  const observed = result.daily
    .map(row => ({
      day: row.day,
      at: Date.parse(`${row.day}T00:00:00Z`),
      value: numericMetric(row, key),
    }))
    .filter(row => Number.isFinite(row.at))
    .sort((a, b) => a.at - b.at);
  const output: typeof observed = [];
  for (const row of observed) {
    const last = output[output.length - 1];
    if (last && row.at - last.at > 86_400_000) {
      const missingAt = last.at + 86_400_000;
      // Null is only a gap marker. No measurement is generated or interpolated.
      output.push({
        day: new Date(missingAt).toISOString().slice(0, 10),
        at: missingAt,
        value: null,
      });
    }
    output.push(row);
  }
  return output;
}
function formatMetric(value: number | null, metric: Metric) {
  return metric.unit === "€"
    ? value === null
      ? "Dato non disponibile"
      : eur(value)
    : qty(value, metric.unit);
}
function periodLabel(from: number, to: number) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(from)} – ${formatter.format(to)}`;
}
export function visibleNotes(items: string[], canSeeCosts: boolean) {
  return canSeeCosts
    ? items
    : items.filter(
        item =>
          !/cost|iofc|prezz|ricav|revenue|price|liquidaz|finanz|econom/i.test(
            item
          )
      );
}
function InfoList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-zinc-200">{title}</h3>
      {items.length ? (
        <ul className="space-y-2 text-sm text-zinc-400">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="break-words">
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">{empty}</p>
      )}
    </div>
  );
}
function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${PANEL} min-w-0 space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
function MetricCard({
  metric,
  current,
  previous,
}: {
  metric: Metric;
  current: number | null;
  previous: number | null;
}) {
  const difference =
    current !== null && previous !== null ? current - previous : null;
  const percentage =
    difference !== null && previous !== null && previous !== 0
      ? (difference / Math.abs(previous)) * 100
      : null;
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/40 p-3">
      <h3 className="text-sm text-zinc-400">{metric.label}</h3>
      <p
        className={`mt-2 break-words text-lg font-semibold ${current === null ? "text-zinc-400" : "text-white"}`}
      >
        {formatMetric(current, metric)}
      </p>
      {metric.note && (
        <p className="mt-1 text-xs leading-relaxed text-amber-300">
          {metric.note}
        </p>
      )}
      <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">
        {difference === null ? (
          "Confronto precedente non disponibile"
        ) : (
          <>
            Differenza: {difference > 0 ? "+" : ""}
            {formatMetric(difference, metric)}
            {percentage !== null && (
              <>
                {" "}
                ({percentage > 0 ? "+" : ""}
                {qty(percentage, "%")})
              </>
            )}
            <span className="block">
              Precedente: {formatMetric(previous, metric)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

export function ingredientSnapshotCosts(data: FeedData, input: AnalyticsInput) {
  if (!data.permissions.canSeeCosts || !data.permissions.canView) return [];
  const products = new Map<
    string,
    {
      productId: string;
      nome: string;
      freshKg: number;
      cost: number | null;
      loads: number;
    }
  >();
  const groups = new Map(data.groups.map(group => [group.id, group]));
  const runs = data.runs.filter(
    run =>
      run.state !== "annullato" &&
      run.state !== "preparazione" &&
      run.at >= input.from &&
      run.at <= input.to &&
      (!input.groupId || run.groupId === input.groupId) &&
      (!input.lactatingOnly || isLactatingGroup(groups.get(run.groupId)))
  );
  for (const run of runs)
    for (const ingredient of run.ingredients) {
      const previous = products.get(ingredient.productId);
      if (ingredient.actualKg === 0) continue;
      const savedCost =
        ingredient.costCents !== null &&
        Number.isFinite(ingredient.costCents) &&
        ingredient.costCents >= 0
          ? ingredient.costCents / 100
          : ingredient.unitCostCentsPerKg !== null &&
              Number.isFinite(ingredient.unitCostCentsPerKg) &&
              ingredient.unitCostCentsPerKg >= 0 &&
              Number.isFinite(ingredient.actualKg) &&
              ingredient.actualKg >= 0
            ? (ingredient.unitCostCentsPerKg * ingredient.actualKg) / 100
            : null;
      products.set(ingredient.productId, {
        productId: ingredient.productId,
        nome: ingredient.nome,
        freshKg: (previous?.freshKg ?? 0) + ingredient.actualKg,
        cost:
          savedCost === null || previous?.cost === null
            ? null
            : (previous?.cost ?? 0) + savedCost,
        loads: (previous?.loads ?? 0) + 1,
      });
    }
  return Array.from(products.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "it")
  );
}

export default function Analisi() {
  const feed = useFeed();
  const confirm = useFeedConfirm();
  const [today] = useState(() => dateInputValue(new Date()));
  const [scope, setScope] = useState("company");
  const [period, setPeriod] = useState<Period>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(today);
  const [indicator, setIndicator] = useState("iofc");
  const [question, setQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<{
    context: string;
    question: string;
    answer: string;
    sources: string[];
    missing: string[];
  } | null>(null);
  const [aiError, setAiError] = useState<{
    context: string;
    message: string;
  } | null>(null);
  const data = feed.data as FeedData | undefined;
  const canView = !!data?.permissions.canView;
  const canSeeCosts = !!data?.permissions.canSeeCosts;
  const selectedGroup = scope.startsWith("group:")
    ? data?.groups.find(group => group.id === scope.slice(6))
    : undefined;
  const scopeError =
    scope.startsWith("group:") && data && !selectedGroup
      ? "Il gruppo selezionato non è più disponibile. Scegli un altro gruppo."
      : null;
  const range = useMemo(
    () => analyticsPeriod(period, customFrom, customTo, today),
    [period, customFrom, customTo, today]
  );
  const input = useMemo<AnalyticsInput>(
    () => ({
      from: range.from,
      to: range.to,
      groupId: selectedGroup?.id,
      lactatingOnly: scope === "lactating",
    }),
    [range.from, range.to, selectedGroup?.id, scope]
  );
  const previousInput = useMemo<AnalyticsInput>(
    () => ({
      ...input,
      from: input.from - (input.to - input.from + 1),
      to: input.from - 1,
    }),
    [input]
  );
  const comparisonInput = useMemo<AnalyticsInput>(
    () => ({
      from: input.from,
      to: input.to,
      lactatingOnly: scope === "lactating",
    }),
    [input.from, input.to, scope]
  );
  const enabled = canView && !feed.error && !range.error && !scopeError;
  const analytics = trpc.alimentazione.analytics.useQuery(input, {
    enabled,
    retry: false,
  });
  const previous = trpc.alimentazione.analytics.useQuery(previousInput, {
    enabled,
    retry: false,
  });
  const comparison = trpc.alimentazione.analytics.useQuery(comparisonInput, {
    enabled: enabled && !!selectedGroup,
    retry: false,
  });
  const intelligence = trpc.alimentazione.intelligence.useMutation();
  const result = analytics.data as AnalyticsResult | undefined;
  const predecessor = previous.error
    ? undefined
    : (previous.data as AnalyticsResult | undefined);
  const groupResult = selectedGroup
    ? comparison.error
      ? undefined
      : (comparison.data as AnalyticsResult | undefined)
    : result;
  const milkRelevant = selectedGroup
    ? isLactatingGroup(selectedGroup)
    : scope === "lactating" ||
      !!data?.groups.some(group => isLactatingGroup(group));
  const metrics = allowedMetrics(canSeeCosts, milkRelevant);
  const chartMetrics = metrics.filter(metric =>
    CHART_KEYS.includes(metric.key)
  );
  const chartMetric =
    chartMetrics.find(metric => metric.key === indicator) ?? chartMetrics[0];
  const daily = useMemo(
    () => (chartMetric ? analyticsDaily(result, chartMetric.key) : []),
    [result, chartMetric?.key]
  );
  const chartHasData = daily.some(row => row.value !== null);
  const missing = result
    ? metrics
        .filter(metric => numericMetric(result.totals, metric.key) === null)
        .map(metric => metric.label)
    : [];
  const ingredients = useMemo(
    () =>
      data && enabled && canSeeCosts
        ? ingredientSnapshotCosts(data, input)
        : [],
    [data, enabled, canSeeCosts, input]
  );
  const context = JSON.stringify({
    company: data?.permissions.companyId,
    costs: canSeeCosts,
    ...input,
  });
  const displayedAnswer = aiResponse?.context === context ? aiResponse : null;
  const scopeLabel =
    selectedGroup?.nome ??
    (scope === "lactating"
      ? "Tutti i gruppi in lattazione"
      : "Tutta l’azienda");
  const questionPrefix = `Periodo: ${!range.error ? periodLabel(input.from, input.to) : "non valido"}. Ambito: ${scopeLabel}. ${scope === "lactating" ? "Considera soltanto i gruppi in lattazione. " : ""}${!canSeeCosts ? "Non includere dati economici o finanziari. " : ""}`;
  const questionLimit = Math.max(0, 2000 - questionPrefix.length);
  const questionError =
    question.trim().length > questionLimit
      ? `La domanda supera il limite di ${questionLimit} caratteri disponibile per questo ambito.`
      : null;
  const changeScope = (next: string) => {
    setScope(next);
    setAiError(null);
  };

  function requestIntelligence() {
    const trimmed = question.trim();
    if (
      !trimmed ||
      !enabled ||
      questionError ||
      confirm.pending ||
      intelligence.isPending
    )
      return;
    const frozenContext = context;
    const frozenQuestion = trimmed;
    const request = {
      question: `${questionPrefix}${frozenQuestion}`,
      from: input.from,
      to: input.to,
      groupId: input.groupId ?? undefined,
      lactatingOnly: input.lactatingOnly,
    };
    confirm.ask(
      "Conferma analisi con Fallinity Intelligence",
      `Domanda: ${frozenQuestion}\n\nGruppi: ${scopeLabel}\nPeriodo: ${periodLabel(input.from, input.to)}\n\nSaranno letti soltanto i dati aziendali consentiti dai tuoi permessi. Nessuna ricetta o registrazione verrà modificata.`,
      async () => {
        setAiError(null);
        try {
          const response = await intelligence.mutateAsync(request);
          setAiResponse({
            context: frozenContext,
            question: frozenQuestion,
            ...response,
          });
        } catch (error) {
          setAiError({
            context: frozenContext,
            message:
              error instanceof Error
                ? error.message
                : "Analisi IA non riuscita. Riprova.",
          });
          throw error;
        }
      }
    );
  }

  return (
    <FeedPage title="Analisi">
      <p className="text-sm leading-relaxed text-zinc-400">
        Alimentazione, produzione e risultati sullo stesso periodo. Solo
        registrazioni aziendali: i dati mancanti non sono sostituiti da valori
        inventati.
      </p>
      <FeedStatus query={feed} />
      {feed.error && (
        <button className={CONTROL} onClick={() => void feed.refetch()}>
          <RefreshCw className="mr-2 inline" size={16} />
          Riprova caricamento
        </button>
      )}
      {!feed.isLoading && !feed.error && !data && (
        <div className={PANEL}>Dati aziendali non disponibili.</div>
      )}
      {data && !feed.error && !canView && (
        <div role="alert" className={`${PANEL} text-amber-300`}>
          Non hai il permesso di consultare l’alimentazione aziendale.
        </div>
      )}
      {data && !feed.error && canView && (
        <>
          <section className={`${PANEL} space-y-4`} aria-label="Filtri analisi">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Gruppo">
                <select
                  className={INPUT}
                  value={scope}
                  onChange={event => changeScope(event.target.value)}
                >
                  <option value="company">Tutta l’azienda</option>
                  <option value="lactating">
                    Tutti i gruppi in lattazione
                  </option>
                  {data.groups.map(group => (
                    <option key={group.id} value={`group:${group.id}`}>
                      {group.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Periodo">
                <select
                  className={INPUT}
                  value={period}
                  onChange={event => setPeriod(event.target.value as Period)}
                >
                  <option value="7">Ultimi 7 giorni</option>
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="365">Ultimi 365 giorni</option>
                  <option value="custom">Personalizzato</option>
                </select>
              </Field>
            </div>
            {period === "custom" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Dal giorno">
                  <input
                    className={INPUT}
                    type="date"
                    value={customFrom}
                    onChange={event => setCustomFrom(event.target.value)}
                    aria-invalid={!!range.error}
                  />
                </Field>
                <Field label="Al giorno (incluso)">
                  <input
                    className={INPUT}
                    type="date"
                    value={customTo}
                    onChange={event => setCustomTo(event.target.value)}
                    aria-invalid={!!range.error}
                  />
                </Field>
              </div>
            )}
            {range.error || scopeError ? (
              <p role="alert" className="text-sm text-amber-300">
                {range.error ?? scopeError}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                {scopeLabel} · {periodLabel(input.from, input.to)}
                <span className="mt-1 block text-xs">
                  Calendario UTC · Confronto:{" "}
                  {periodLabel(previousInput.from, previousInput.to)}. Le
                  differenze usano i dati registrati nel periodo precedente.
                </span>
              </p>
            )}
            {!data.groups.length && (
              <p className="text-sm text-amber-300">
                Nessun gruppo aziendale disponibile in Stalla. Gli indicatori
                rimangono non calcolabili finché non sono disponibili
                registrazioni valide.
              </p>
            )}
            {scope === "lactating" &&
              !data.groups.some(group => isLactatingGroup(group)) && (
                <p className="text-sm text-amber-300">
                  Nessun gruppo in lattazione disponibile.
                </p>
              )}
          </section>
          <div
            className={`${PANEL} flex flex-wrap items-center justify-between gap-3 text-sm`}
          >
            <div>
              <p className="font-medium text-white">
                Autonomia aziendale: {qty(data.summary.autonomyDays, "giorni")}
              </p>
              <p className="mt-1 text-zinc-400">
                Alimento limitante:{" "}
                {data.summary.limitingProduct ?? "Non disponibile"}
              </p>
            </div>
            <p className="max-w-lg text-xs text-zinc-400">
              Scorte e fabbisogno dell’intera azienda, indipendenti dal gruppo e
              dal periodo selezionati. {data.summary.coverage}
            </p>
          </div>
          {enabled && (
            <>
              <FeedStatus query={analytics} />
              {analytics.error && (
                <button
                  className={CONTROL}
                  onClick={() => void analytics.refetch()}
                >
                  Riprova analisi
                </button>
              )}
              {!analytics.isLoading && !analytics.error && !result && (
                <div className={PANEL}>
                  Nessun risultato analitico disponibile per il periodo.
                </div>
              )}
              {result && !analytics.error && (
                <>
                  {canSeeCosts && milkRelevant && (
                    <Block
                      title="IOFC · ricavo latte meno costo alimentare"
                      description="Si riferisce soltanto ai gruppi in lattazione; non è l’utile netto aziendale. Seleziona “Tutti i gruppi in lattazione” per isolare gli indicatori alimentari dello stesso ambito."
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {metrics
                          .filter(
                            metric =>
                              metric.key.startsWith("iofc") ||
                              metric.key === "revenue"
                          )
                          .map(metric => (
                            <MetricCard
                              key={metric.key}
                              metric={metric}
                              current={numericMetric(result.totals, metric.key)}
                              previous={numericMetric(
                                predecessor?.totals,
                                metric.key
                              )}
                            />
                          ))}
                      </div>
                    </Block>
                  )}
                  {selectedGroup && !milkRelevant && (
                    <p className={`${PANEL} text-sm text-zinc-400`}>
                      Il gruppo selezionato non è in lattazione: IOFC,
                      produzione latte, ECM ed efficienza da latte non sono
                      pertinenti e non vengono mostrati.
                    </p>
                  )}
                  <Block
                    title="Qualità e provenienza dei dati"
                    description="La copertura determina come interpretare i risultati: un totale disponibile non garantisce che tutte le giornate siano state registrate."
                  >
                    <p className="flex items-start gap-2 break-words text-sm text-green-300">
                      <Info size={18} className="mt-0.5 shrink-0" />
                      <span>
                        {result.coverage || "Copertura non disponibile"}
                      </span>
                    </p>
                    {analytics.isFetching && (
                      <p className="text-xs text-zinc-400" role="status">
                        Aggiornamento dei dati in corso…
                      </p>
                    )}
                    {previous.isLoading ? (
                      <p role="status" className="text-sm text-zinc-400">
                        Caricamento del periodo precedente…
                      </p>
                    ) : previous.error ? (
                      <div
                        role="alert"
                        className="space-y-2 text-sm text-amber-300"
                      >
                        <p>
                          Periodo precedente non disponibile:{" "}
                          {previous.error.message}
                        </p>
                        <button
                          className={CONTROL}
                          onClick={() => void previous.refetch()}
                        >
                          Riprova confronto temporale
                        </button>
                      </div>
                    ) : (
                      predecessor && (
                        <p className="text-xs text-zinc-400">
                          Copertura precedente:{" "}
                          {predecessor.coverage || "Non disponibile"}
                        </p>
                      )
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <InfoList
                        title="Fonti effettivamente utilizzate"
                        items={visibleNotes(result.sources, canSeeCosts)}
                        empty="Nessuna fonte dichiarata dal calcolo."
                      />
                      <InfoList
                        title="Avvisi e assunzioni del calcolo"
                        items={visibleNotes(result.warnings, canSeeCosts)}
                        empty="Nessun avviso segnalato dal calcolo."
                      />
                    </div>
                    <InfoList
                      title="Indicatori mancanti / non calcolabili"
                      items={missing}
                      empty="Tutti gli indicatori pertinenti sono disponibili. Verifica comunque la copertura."
                    />
                  </Block>
                  {canSeeCosts && (
                    <Block
                      title="Costi alimentari storici"
                      description="Costi storici delle registrazioni del periodo, non nuove spese finanziarie e non prezzi correnti moltiplicati per i giorni. Prelievo fresco, valore lordo distribuito e costo attribuito sono voci diverse: non vanno sommate tra loro."
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {metrics
                          .filter(
                            metric =>
                              metric.economic &&
                              !metric.key.startsWith("iofc") &&
                              metric.key !== "revenue"
                          )
                          .map(metric => (
                            <MetricCard
                              key={metric.key}
                              metric={metric}
                              current={numericMetric(result.totals, metric.key)}
                              previous={numericMetric(
                                predecessor?.totals,
                                metric.key
                              )}
                            />
                          ))}
                      </div>
                      <details className="rounded-xl border border-white/10">
                        <summary className="min-h-12 cursor-pointer rounded-xl p-3 text-sm font-medium text-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                          Composizione dei prelievi freschi per alimento
                        </summary>
                        <div className="space-y-3 p-3 pt-0">
                          <p className="text-xs leading-relaxed text-zinc-400">
                            Quantità e costi degli ingredienti salvati nei
                            carichi confermati. Il filtro gruppo si riferisce al
                            destinatario previsto del carro. Non coincide
                            necessariamente con il costo attribuito alle
                            distribuzioni, soprattutto in caso di distribuzione
                            parziale o in più gruppi. Il riutilizzo non genera
                            un secondo prelievo; un costo storico mancante resta
                            non disponibile.
                          </p>
                          {ingredients.length ? (
                            ingredients.map(ingredient => (
                              <div
                                key={ingredient.productId}
                                className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3 text-sm"
                              >
                                <span className="min-w-0 break-words font-medium text-white">
                                  {ingredient.nome}
                                </span>
                                <span className="text-zinc-400">
                                  {qty(ingredient.freshKg, "kg TQ")} ·{" "}
                                  {eur(ingredient.cost)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-zinc-400">
                              Nessun ingrediente in carichi confermati
                              disponibile per questo filtro.
                            </p>
                          )}
                        </div>
                      </details>
                    </Block>
                  )}
                  <Block
                    title="Consumi, avanzi e ingestione"
                    description="Prelievo, distribuzione e ingestione non sono sinonimi. Gli avanzi sono attribuiti alla distribuzione di origine; il riutilizzo non va contato due volte."
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {metrics
                        .filter(metric => !metric.economic && !metric.milk)
                        .map(metric => (
                          <MetricCard
                            key={metric.key}
                            metric={metric}
                            current={numericMetric(result.totals, metric.key)}
                            previous={numericMetric(
                              predecessor?.totals,
                              metric.key
                            )}
                          />
                        ))}
                    </div>
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-300">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>
                        L’ingestione è una stima da distribuzioni e avanzi, non
                        una misura diretta. La SS ingerita richiede la
                        composizione della razione e degli avanzi: consulta gli
                        avvisi per le assunzioni realmente utilizzate.
                      </span>
                    </p>
                  </Block>
                  {milkRelevant && (
                    <Block
                      title="Produzione, efficienza alimentare ed ECM"
                      description="Rapporti calcolati su latte e ingestione SS riferiti ai gruppi produttivi. Le medie per capo utilizzano i giorni-capo effettivi, non soltanto il numero attuale di animali."
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {metrics
                          .filter(metric => metric.milk && !metric.economic)
                          .map(metric => (
                            <MetricCard
                              key={metric.key}
                              metric={metric}
                              current={numericMetric(result.totals, metric.key)}
                              previous={numericMetric(
                                predecessor?.totals,
                                metric.key
                              )}
                            />
                          ))}
                      </div>
                      <p className="break-words text-xs text-zinc-400">
                        Formula ECM e unità:{" "}
                        {result.formulaECM ||
                          "Non dichiarate dal calcolo; risultato non verificabile."}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Grasso o proteine del latte mancanti non vengono
                        sostituiti con valori medi aziendali.
                      </p>
                    </Block>
                  )}
                  <Block
                    title="Andamento nel periodo"
                    description="Serie giornaliera reale restituita dal calcolo. Le lacune restano vuote: nessuna interpolazione o serie dimostrativa."
                  >
                    <Field label="Indicatore del grafico">
                      <select
                        className={INPUT}
                        value={chartMetric?.key ?? ""}
                        onChange={event => setIndicator(event.target.value)}
                        disabled={!chartMetrics.length}
                      >
                        {chartMetrics.map(metric => (
                          <option key={metric.key} value={metric.key}>
                            {metric.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {chartHasData && chartMetric ? (
                      <>
                        <div
                          className="h-64 w-full min-w-0"
                          role="img"
                          aria-label={`Andamento giornaliero: ${chartMetric.label}, ${chartMetric.unit}`}
                        >
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            minWidth={0}
                          >
                            <LineChart
                              data={daily}
                              margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
                              accessibilityLayer
                            >
                              <CartesianGrid
                                stroke="#27272a"
                                strokeDasharray="3 3"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="at"
                                type="number"
                                scale="time"
                                domain={[input.from, input.to]}
                                stroke="#a1a1aa"
                                tick={{ fontSize: 11 }}
                                minTickGap={28}
                                tickFormatter={at =>
                                  new Intl.DateTimeFormat("it-IT", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    timeZone: "UTC",
                                  }).format(Number(at))
                                }
                              />
                              <YAxis
                                width={48}
                                stroke="#a1a1aa"
                                tick={{ fontSize: 11 }}
                                tickFormatter={value => qty(Number(value))}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "#09090b",
                                  borderColor: "#3f3f46",
                                  borderRadius: "12px",
                                  color: "#fff",
                                  maxWidth: "260px",
                                  whiteSpace: "normal",
                                }}
                                labelStyle={{ color: "#d4d4d8" }}
                                labelFormatter={at =>
                                  new Intl.DateTimeFormat("it-IT", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    timeZone: "UTC",
                                  }).format(Number(at))
                                }
                                formatter={value => [
                                  formatMetric(
                                    typeof value === "number" &&
                                      Number.isFinite(value)
                                      ? value
                                      : null,
                                    chartMetric
                                  ),
                                  chartMetric.label,
                                ]}
                              />
                              <Line
                                type="linear"
                                dataKey="value"
                                name={chartMetric.label}
                                stroke="#4ade80"
                                strokeWidth={2}
                                dot={daily.length < 32 ? { r: 3 } : false}
                                activeDot={{ r: 5 }}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <details>
                          <summary
                            className={`${CONTROL} flex cursor-pointer items-center`}
                          >
                            Dati giornalieri in formato accessibile
                          </summary>
                          <div className="mt-3 max-h-72 overflow-y-auto">
                            <table className="w-full table-fixed text-left text-sm">
                              <caption className="sr-only">
                                {chartMetric.label}: dati giornalieri del
                                periodo
                              </caption>
                              <thead>
                                <tr className="text-zinc-400">
                                  <th className="w-2/5 py-2">Giorno</th>
                                  <th className="py-2">
                                    Valore ({chartMetric.unit})
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {daily.map((day, index) => (
                                  <tr
                                    key={`${day.day}-${index}`}
                                    className="border-t border-white/10"
                                  >
                                    <td className="break-words py-2 pr-2 text-zinc-400">
                                      {day.day}
                                    </td>
                                    <td className="break-words py-2 text-white">
                                      {formatMetric(day.value, chartMetric)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </>
                    ) : (
                      <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 px-3 text-center text-sm text-zinc-400">
                        <BarChart3 size={28} />
                        <p>
                          Nessuna serie giornaliera disponibile per questo
                          indicatore e periodo.
                        </p>
                      </div>
                    )}
                  </Block>
                  <Block
                    title="Confronto gruppi"
                    description="Tocca un gruppo per aggiornare il filtro senza cambiare schermata. Il numero attuale di animali non sostituisce i giorni-capo storici."
                  >
                    {selectedGroup && (
                      <button
                        className={CONTROL}
                        onClick={() => changeScope("company")}
                      >
                        Mostra tutta l’azienda
                      </button>
                    )}
                    {selectedGroup && comparison.isLoading && (
                      <p role="status" className="text-sm text-zinc-400">
                        Caricamento confronto tra gruppi…
                      </p>
                    )}
                    {selectedGroup && comparison.error && (
                      <div
                        role="alert"
                        className="space-y-2 text-sm text-amber-300"
                      >
                        <p>
                          Confronto gruppi non disponibile:{" "}
                          {comparison.error.message}
                        </p>
                        <button
                          className={CONTROL}
                          onClick={() => void comparison.refetch()}
                        >
                          Riprova confronto gruppi
                        </button>
                      </div>
                    )}
                    {groupResult?.groups.length ? (
                      <div className="space-y-3">
                        {groupResult.groups.map(group => (
                          <GroupComparison
                            key={group.groupId}
                            group={group}
                            liveGroup={data.groups.find(
                              item => item.id === group.groupId
                            )}
                            canSeeCosts={canSeeCosts}
                            selected={selectedGroup?.id === group.groupId}
                            onSelect={() =>
                              changeScope(`group:${group.groupId}`)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      !(
                        selectedGroup &&
                        (comparison.isLoading || comparison.error)
                      ) && (
                        <p className="text-sm text-zinc-400">
                          Nessun gruppo con dati confrontabili nel periodo.
                        </p>
                      )
                    )}
                    {selectedGroup && groupResult && (
                      <p className="text-xs text-zinc-400">
                        Copertura del confronto aziendale:{" "}
                        {groupResult.coverage || "Non disponibile"}
                      </p>
                    )}
                  </Block>
                </>
              )}
            </>
          )}
          <Block
            title="Fallinity Intelligence"
            description="Analizza relazioni tra ricette, NIR, consumi, avanzi, latte e dati consentiti dai tuoi permessi. Le correlazioni non dimostrano una causa; nessuna modifica automatica."
          >
            <p className="text-xs text-zinc-400">
              {range.error || scopeError
                ? "Completa i filtri per richiedere l’analisi."
                : `${scopeLabel} · ${periodLabel(input.from, input.to)}`}
            </p>
            <form
              className="space-y-3"
              onSubmit={event => {
                event.preventDefault();
                requestIntelligence();
              }}
            >
              <Field label="Domanda sui dati del periodo">
                <textarea
                  className={`${INPUT} min-h-28 resize-y py-3`}
                  value={question}
                  onChange={event => setQuestion(event.target.value)}
                  placeholder="Quali variazioni emergono nei consumi e negli avanzi?"
                  maxLength={questionLimit}
                  aria-invalid={!!questionError}
                  disabled={confirm.pending || intelligence.isPending}
                />
              </Field>
              {questionError && (
                <p role="alert" className="text-sm text-amber-300">
                  {questionError}
                </p>
              )}
              <p className="text-xs text-zinc-400">
                {question.length}/{questionLimit} caratteri
              </p>
              <button
                type="submit"
                className={`${ACTION} flex w-full items-center justify-center gap-2 sm:w-auto`}
                disabled={
                  !enabled ||
                  !question.trim() ||
                  !!questionError ||
                  confirm.pending ||
                  intelligence.isPending
                }
              >
                {intelligence.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                {intelligence.isPending
                  ? "Analisi in corso…"
                  : "Richiedi analisi IA"}
              </button>
            </form>
            {aiError?.context === context && (
              <p role="alert" className="break-words text-sm text-red-300">
                {aiError.message}
              </p>
            )}
            {displayedAnswer ? (
              <div
                className="space-y-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3"
                aria-live="polite"
              >
                <p className="break-words text-sm font-medium text-zinc-300">
                  Domanda: {displayedAnswer.question}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                  {displayedAnswer.answer ||
                    "L’analisi non ha restituito una risposta."}
                </p>
                <InfoList
                  title="Fonti lette da Intelligence"
                  items={visibleNotes(displayedAnswer.sources, canSeeCosts)}
                  empty="Nessuna fonte dichiarata nella risposta."
                />
                <InfoList
                  title="Dati mancanti indicati da Intelligence"
                  items={visibleNotes(displayedAnswer.missing, canSeeCosts)}
                  empty="Nessun dato mancante segnalato nella risposta."
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                {aiResponse
                  ? "I filtri sono cambiati: richiedi una nuova analisi per questo ambito."
                  : "Nessuna analisi IA richiesta. Scrivi una domanda e conferma esplicitamente l’invio."}
              </p>
            )}
          </Block>
        </>
      )}
      {confirm.dialog}
    </FeedPage>
  );
}

function GroupComparison({
  group,
  liveGroup,
  canSeeCosts,
  selected,
  onSelect,
}: {
  group: AnalyticsResult["groups"][number];
  liveGroup?: FeedGroup;
  canSeeCosts: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const keys = [
    "costPerHead",
    "dmPerHead",
    "milkPerHead",
    "efficiency",
    "iofcPerHead",
    "leftoverPercent",
  ];
  const metrics = allowedMetrics(canSeeCosts, group.lactating).filter(metric =>
    keys.includes(metric.key)
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!liveGroup}
      aria-pressed={selected}
      className={`w-full min-w-0 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${selected ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/30 hover:border-green-500/50"} disabled:opacity-60`}
    >
      <span className="block break-words font-semibold text-white">
        {group.nome}
      </span>
      <span className="mt-1 block break-words text-xs text-zinc-400">
        {liveGroup
          ? `${qty(liveGroup.nAnimali)} animali attuali`
          : "Gruppo non più disponibile in Stalla"}{" "}
        · {qty(numericMetric(group, "headDays"))} giorni-capo registrati ·{" "}
        {group.lactating ? "Lattazione" : "Non in lattazione"}
      </span>
      <span className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(metric => (
          <span key={metric.key} className="min-w-0">
            <span className="block text-xs text-zinc-400">{metric.label}</span>
            <span className="block break-words text-sm text-zinc-200">
              {formatMetric(numericMetric(group, metric.key), metric)}
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
