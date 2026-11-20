import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  History,
  Package,
  Scale,
  Settings2,
  Tractor,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type {
  DistributionInput,
  FeedData,
  FeedDistribution,
  FeedGroup,
  FeedLeftover,
  FeedRecipe,
  FeedRun,
  LeftoverInput,
  LoadInput,
} from "@shared/feeding/types";
import * as math from "@shared/feeding/math";
import {
  ACTION,
  INPUT,
  PANEL,
  FeedPage,
  FeedStatus,
  Field,
  dateTime,
  eur,
  qty,
  useFeed,
  useFeedConfirm,
} from "./shared";

const SECONDARY =
  "min-h-12 rounded-xl border border-white/15 bg-zinc-900 px-4 py-2 text-white hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-40";
const CHECK = "size-6 shrink-0 accent-green-500";
type Area =
  | "hub"
  | "carico"
  | "distribuzione"
  | "consumi"
  | "storico"
  | "frequenze";
type LeftoverForm = {
  method: FeedLeftover["method"];
  kg: string;
  containerId: string;
  count: string;
  destination: FeedLeftover["destination"];
  known: boolean;
  compatible: boolean;
  note: string;
};
type Wizard = {
  key: string;
  group: FeedGroup;
  recipe: FeedRecipe;
  expected: Array<{ productId: string; nome: string; kg: number }>;
  weights: Record<string, string>;
  checked: Record<string, boolean>;
  index: number;
  review: boolean;
  leftoverId: string | null;
  reusedKg: number;
  draftId?: string;
  note: string;
  overlap: boolean;
};
type Draft = {
  version: 1;
  headCount: number;
  frequency: number;
  recipeId: string;
  weights: Record<string, string>;
  note: string;
};
type Period = "tutto" | "oggi" | "7" | "30" | "90" | "365" | "personalizzato";

/** Deliberately rejects blank, non-finite and ambiguous thousands separators. */
export function feedNumber(raw: string): number | null {
  const value = raw.trim();
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
export function sameRecipeSnapshot(a: FeedRecipe, b: FeedRecipe): boolean {
  return (
    a.id === b.id &&
    a.version === b.version &&
    a.ingredients.length === b.ingredients.length &&
    a.ingredients.every((line, index) => {
      const other = b.ingredients[index];
      return (
        other?.productId === line.productId &&
        other.kgPerHead === line.kgPerHead &&
        other.order === line.order
      );
    })
  );
}
export function previousDistribution(
  data: FeedData,
  groupId: string
): FeedDistribution | undefined {
  return data.distributions
    .filter(item => item.groupId === groupId && !item.annulled && item.kg > 0)
    .sort((a, b) => b.at - a.at)[0];
}
export function availableLeftover(leftover: FeedLeftover): number {
  return Math.max(0, leftover.kg - leftover.reusedKg - leftover.discardedKg);
}
export function knownCompatibleLeftover(
  data: FeedData,
  leftover: FeedLeftover,
  recipe: FeedRecipe
): boolean {
  const distribution = data.distributions.find(
    item => item.id === leftover.distributionId && !item.annulled && item.kg > 0
  );
  const run = data.runs.find(
    item => item.id === distribution?.runId && item.state !== "annullato"
  );
  return (
    !!run &&
    leftover.destination === "riutilizzo" &&
    leftover.compositionKnown &&
    sameRecipeSnapshot(run.recipeSnapshot, recipe)
  );
}
export function ingredientProblem(
  raw: string,
  stock: number | null | undefined
): string | null {
  const value = feedNumber(raw);
  if (value == null)
    return "Inserisci un peso numerico non negativo, senza separatori delle migliaia.";
  if (value < 0.001)
    return "Ogni ingrediente richiede almeno 0,001 kg effettivi; il server non accetta righe a peso zero.";
  if (stock == null || !Number.isFinite(stock))
    return "Giacenza in kg non disponibile: verifica il prodotto e la conversione in Magazzino.";
  if (value > stock + 0.000001)
    return "Il peso supera la disponibilità in Magazzino. Il carico è bloccato.";
  return null;
}
export function readLoadDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<Draft>;
  if (
    draft.version !== 1 ||
    typeof draft.recipeId !== "string" ||
    typeof draft.headCount !== "number" ||
    typeof draft.frequency !== "number" ||
    draft.frequency <= 0 ||
    typeof draft.note !== "string" ||
    !draft.weights ||
    typeof draft.weights !== "object" ||
    Array.isArray(draft.weights) ||
    !Object.values(draft.weights).every(item => typeof item === "string")
  )
    return null;
  return draft as Draft;
}
/** A confirmed tRPC rejection means no commit; transport/internal failures remain ambiguous. */
export function definitiveFeedRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { data?: { code?: unknown } }).data?.code;
  return (
    typeof code === "string" &&
    [
      "BAD_REQUEST",
      "FORBIDDEN",
      "UNAUTHORIZED",
      "NOT_FOUND",
      "CONFLICT",
      "PRECONDITION_FAILED",
      "UNPROCESSABLE_CONTENT",
    ].includes(code)
  );
}
function Hint({
  children,
  danger = false,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      role={danger ? "alert" : "status"}
      className={`rounded-xl border p-3 text-sm ${danger ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-orange-500/25 bg-orange-950/20 text-orange-200"}`}
    >
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/40 p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
function Consent({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3 text-sm text-zinc-200">
      <input
        type="checkbox"
        className={CHECK}
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
function groupName(data: FeedData, id: string) {
  return (
    data.groups.find(group => group.id === id)?.nome ??
    `Gruppo non più disponibile (${id})`
  );
}
function sumKnown(values: Array<number | null>): number | null {
  return values.some(value => value == null || !Number.isFinite(value))
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
function todayInput(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function Distribuzione() {
  const feed = useFeed();
  if (feed.isLoading || feed.error)
    return (
      <FeedPage title="Distribuzione e consumi">
        <FeedStatus query={feed} />
        {feed.error && (
          <button className={SECONDARY} onClick={() => void feed.refetch()}>
            Riprova lettura dati
          </button>
        )}
      </FeedPage>
    );
  if (!feed.data)
    return (
      <FeedPage title="Distribuzione e consumi">
        <Hint>
          Nessun dato aziendale disponibile. Seleziona un’azienda e verifica
          l’accesso.
        </Hint>
      </FeedPage>
    );
  if (!feed.data.permissions.canView)
    return (
      <FeedPage title="Distribuzione e consumi">
        <Hint danger>
          Non sei autorizzato a consultare l’alimentazione di questa azienda.
        </Hint>
      </FeedPage>
    );
  return (
    <Operations
      key={`${feed.data.permissions.companyId}:${feed.data.permissions.userId}`}
      data={feed.data}
      refresh={feed.refresh}
    />
  );
}

function Operations({
  data,
  refresh,
}: {
  data: FeedData;
  refresh: () => Promise<unknown>;
}) {
  const confirmation = useFeedConfirm();
  const { canOperate, canManage, canSeeCosts } = data.permissions;
  const [area, setArea] = useState<Area>("hub");
  const [groupId, setGroupId] = useState("");
  const [previousConfirmed, setPreviousConfirmed] = useState<string | null>(
    null
  );
  const [leftoverForm, setLeftoverForm] = useState<LeftoverForm>({
    method: "nessuno",
    kg: "",
    containerId: "",
    count: "",
    destination: "rimosso",
    known: false,
    compatible: false,
    note: "",
  });
  const [reuseRequested, setReuseRequested] = useState(false);
  const [reuseConsent, setReuseConsent] = useState(false);
  const [reuseKg, setReuseKg] = useState("");
  const [useSavedSequence, setUseSavedSequence] = useState(false);
  const [wizard, setWizard] = useState<Wizard | null>(null);
  const [resumeDraft, setResumeDraft] = useState<{
    id: string;
    value: Draft;
  } | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>();
  const loadAttempt = useRef<LoadInput | null>(null);
  const leftoverAttempt = useRef<LeftoverInput | null>(null);
  const [loadFrozen, setLoadFrozen] = useState(false);
  const [leftoverFrozen, setLeftoverFrozen] = useState(false);
  const [leftoverKey, setLeftoverKey] = useState(() => crypto.randomUUID());
  const [selectedRunId, setSelectedRunId] = useState("");
  const [distributionGroup, setDistributionGroup] = useState("");
  const [distributedKg, setDistributedKg] = useState("");
  const [otherAuthorized, setOtherAuthorized] = useState(false);
  const [distributionNote, setDistributionNote] = useState("");
  const [distributionKey, setDistributionKey] = useState(() =>
    crypto.randomUUID()
  );
  const distributionAttempt = useRef<DistributionInput | null>(null);
  const [distributionFrozen, setDistributionFrozen] = useState(false);
  const [historyRunId, setHistoryRunId] = useState("");
  const [reason, setReason] = useState("");
  const rectifyAttempt = useRef<{
    key: string;
    runId: string;
    reason: string;
    confirm: true;
  } | null>(null);
  const [rectifyFrozen, setRectifyFrozen] = useState(false);
  const [containerEdit, setContainerEdit] = useState({
    id: "",
    nome: "",
    kg: "",
    groupId: "",
    recipeId: "",
  });
  const [preferenceScope, setPreferenceScope] = useState<
    "operatore" | "gruppo" | "azienda"
  >("operatore");
  const [frequencyInput, setFrequencyInput] = useState<Record<string, string>>(
    {}
  );
  const [frequencyMode, setFrequencyMode] = useState<
    Record<string, "daily" | "interval">
  >({});
  const [period, setPeriod] = useState<Period>("7");
  const [periodGroup, setPeriodGroup] = useState("");
  const [periodProduct, setPeriodProduct] = useState("");
  const [fromDate, setFromDate] = useState(() => todayInput(Date.now()));
  const [toDate, setToDate] = useState(() => todayInput(Date.now()));

  const loadMutation = trpc.alimentazione.confirmLoad.useMutation();
  const draftMutation = trpc.alimentazione.saveDraft.useMutation();
  const distributeMutation = trpc.alimentazione.distribute.useMutation();
  const leftoverMutation = trpc.alimentazione.registerLeftover.useMutation();
  const containerMutation = trpc.alimentazione.saveContainer.useMutation();
  const preferencesMutation = trpc.alimentazione.savePreferences.useMutation();
  const frequencyMutation = trpc.alimentazione.configureFrequency.useMutation();
  const rectifyMutation = trpc.alimentazione.rectifyLoad.useMutation();
  const pending =
    confirmation.pending ||
    loadMutation.isPending ||
    draftMutation.isPending ||
    distributeMutation.isPending ||
    leftoverMutation.isPending ||
    containerMutation.isPending ||
    preferencesMutation.isPending ||
    frequencyMutation.isPending ||
    rectifyMutation.isPending;
  const group = data.groups.find(item => item.id === groupId);
  const recipe = data.recipes.find(
    item =>
      item.id === group?.activeRecipeId &&
      (item.status === "attiva" ||
        (item.status === "programmata" &&
          (item.validFrom ?? Infinity) <= Date.now())) &&
      item.groupId === groupId
  );
  const calculated = useMemo(
    () =>
      group && recipe
        ? math.calculateRecipe(recipe, group, data.products)
        : null,
    [group, recipe, data.products]
  );
  const previous = useMemo(
    () => previousDistribution(data, groupId),
    [data.distributions, groupId]
  );
  const previousLeftover = data.leftovers
    .filter(item => item.distributionId === previous?.id)
    .sort((a, b) => b.at - a.at)[0];
  const previousToken = previous?.id ?? `nessuna:${groupId}`;
  const previousIsConfirmed = previousConfirmed === previousToken;
  const previousRecipeId = data.runs.find(run => run.id === previous?.runId)
    ?.recipeSnapshot.id;
  const eligibleContainers = data.containers.filter(
    item =>
      (!item.groupId || item.groupId === groupId) &&
      (!item.recipeId || item.recipeId === previousRecipeId)
  );
  const container = eligibleContainers.find(
    item => item.id === leftoverForm.containerId
  );
  const containerCount = feedNumber(leftoverForm.count);
  const leftoverWeight =
    leftoverForm.method === "nessuno"
      ? 0
      : leftoverForm.method === "kg"
        ? feedNumber(leftoverForm.kg)
        : container && containerCount != null
          ? container.kg * containerCount
          : null;
  const reusable =
    !!recipe &&
    !!previousLeftover &&
    knownCompatibleLeftover(data, previousLeftover, recipe);
  const requestedReuse = reuseRequested ? feedNumber(reuseKg) : 0;
  const baseKg = calculated?.kgPerRun;
  const reuseProblem =
    reuseRequested &&
    (!reusable ||
      !reuseConsent ||
      requestedReuse == null ||
      requestedReuse <= 0 ||
      !previousLeftover ||
      requestedReuse > availableLeftover(previousLeftover) ||
      baseKg == null ||
      requestedReuse >= baseKg);
  const readyRuns = data.runs
    .filter(
      run =>
        (run.state === "caricato" || run.state === "parziale") &&
        run.remainingKg > 0
    )
    .sort((a, b) => a.at - b.at);
  const selectedRun = data.runs.find(item => item.id === selectedRunId);
  const historyRun = data.runs.find(item => item.id === historyRunId);
  const currentProduct = wizard
    ? data.products.find(
        item => item.id === wizard.expected[wizard.index]?.productId
      )
    : undefined;
  const currentLine = wizard?.expected[wizard.index];
  const currentWeight =
    currentLine && wizard ? (wizard.weights[currentLine.productId] ?? "") : "";
  const currentProblem = currentLine
    ? ingredientProblem(currentWeight, currentProduct?.quantityKg)
    : null;
  const wizardChanged =
    !!wizard &&
    (!group ||
      !recipe ||
      !sameRecipeSnapshot(wizard.recipe, recipe) ||
      group.nAnimali !== wizard.group.nAnimali ||
      group.frequency !== wizard.group.frequency ||
      group.animalIds.slice().sort().join("|") !==
        wizard.group.animalIds.slice().sort().join("|"));
  const wizardComplete =
    !!wizard &&
    wizard.expected.every(
      line =>
        wizard.checked[line.productId] &&
        !ingredientProblem(
          wizard.weights[line.productId] ?? "",
          data.products.find(product => product.id === line.productId)
            ?.quantityKg
        )
    );
  const freshKg = wizard
    ? wizard.expected.reduce(
        (sum, line) =>
          sum + (feedNumber(wizard.weights[line.productId] ?? "") ?? 0),
        0
      )
    : 0;
  const loadCost =
    wizard && canSeeCosts
      ? sumKnown(
          wizard.expected.map(line => {
            const price = data.products.find(
              product => product.id === line.productId
            )?.prezzoKg;
            const weight = feedNumber(wizard.weights[line.productId] ?? "");
            return price == null || weight == null ? null : price * weight;
          })
        )
      : null;
  const settings = data.settings
    .filter(
      item =>
        item.scopeType === "azienda" ||
        (item.scopeType === "gruppo" && item.scopeId === groupId) ||
        (item.scopeType === "operatore" &&
          item.scopeId === String(data.permissions.userId))
    )
    .sort(
      (a, b) =>
        ["azienda", "gruppo", "operatore"].indexOf(a.scopeType) -
        ["azienda", "gruppo", "operatore"].indexOf(b.scopeType)
    );
  const preference = Object.assign(
    {},
    ...settings.map(item => item.value)
  ) as Record<string, unknown>;
  const savedSequence =
    Array.isArray(preference.sequence) &&
    preference.sequence.every(item => typeof item === "string") &&
    recipe &&
    preference.sequence.length === recipe.ingredients.length &&
    new Set(preference.sequence).size === recipe.ingredients.length &&
    recipe.ingredients.every(item =>
      (preference.sequence as string[]).includes(item.productId)
    )
      ? (preference.sequence as string[])
      : null;

  async function reload() {
    try {
      await refresh();
    } catch {
      toast.warning(
        "Operazione salvata. La rilettura dei dati non è riuscita: aggiorna prima della prossima operazione."
      );
    }
  }
  function selectGroup(id: string, draft?: { id: string; value: Draft }) {
    setGroupId(id);
    setPreviousConfirmed(null);
    setReuseRequested(false);
    setReuseConsent(false);
    setReuseKg("");
    setUseSavedSequence(false);
    setResumeDraft(draft ?? null);
    setDraftId(draft?.id);
    setLeftoverForm({
      method: "nessuno",
      kg: "",
      containerId: "",
      count: "",
      destination: "rimosso",
      known: false,
      compatible: false,
      note: "",
    });
    leftoverAttempt.current = null;
    setLeftoverFrozen(false);
    setLeftoverKey(crypto.randomUUID());
  }
  function setLeftover(patch: Partial<LeftoverForm>) {
    if (!leftoverFrozen) setLeftoverForm(form => ({ ...form, ...patch }));
  }
  function useSuggestions() {
    const method = preference.method;
    const destination = preference.destination;
    setLeftoverForm(form => ({
      ...form,
      method:
        method === "kg" || method === "contenitore" || method === "nessuno"
          ? method
          : form.method,
      destination:
        destination === "rimosso" ||
        destination === "scartato" ||
        destination === "riutilizzo"
          ? destination
          : form.destination,
      containerId:
        typeof preference.containerId === "string" &&
        eligibleContainers.some(item => item.id === preference.containerId)
          ? preference.containerId
          : "",
      kg: typeof preference.kg === "number" ? String(preference.kg) : "",
      count:
        typeof preference.containerCount === "number"
          ? String(preference.containerCount)
          : "",
      known: false,
      compatible: false,
    }));
    setPreviousConfirmed(null);
    setReuseConsent(false);
  }
  function beginLoad() {
    if (
      !group ||
      !recipe ||
      !calculated ||
      !previousIsConfirmed ||
      baseKg == null ||
      baseKg <= 0 ||
      reuseProblem ||
      !canOperate
    )
      return;
    const amount = requestedReuse ?? 0;
    const lines = calculated.lines
      .slice()
      .sort(
        (a, b) =>
          (recipe.ingredients.find(item => item.productId === a.productId)
            ?.order ?? 0) -
          (recipe.ingredients.find(item => item.productId === b.productId)
            ?.order ?? 0)
      );
    if (useSavedSequence && savedSequence) {
      lines.sort(
        (a, b) =>
          savedSequence.indexOf(a.productId) -
          savedSequence.indexOf(b.productId)
      );
    }
    if (lines.some(line => line.kgPerRun == null)) {
      toast.error("Quantità per carro mancanti: verifica ricetta e frequenza.");
      return;
    }
    const expected = lines.map(line => ({
      productId: line.productId,
      nome: line.nome,
      kg: (line.kgPerRun! * (baseKg - amount)) / baseKg,
    }));
    if (
      !expected.length ||
      new Set(expected.map(line => line.productId)).size !== expected.length ||
      expected.some(line => !Number.isFinite(line.kg))
    ) {
      toast.error(
        "Ricetta incompleta o ingredienti duplicati: verifica Razioni."
      );
      return;
    }
    const draft = resumeDraft?.value;
    if (
      draft &&
      (draft.recipeId !== recipe.id ||
        draft.headCount !== group.nAnimali ||
        draft.frequency !== group.frequency)
    ) {
      toast.error(
        "La bozza non è compatibile con ricetta, capi o frequenza attuali. Avvia una nuova preparazione."
      );
      return;
    }
    loadAttempt.current = null;
    setLoadFrozen(false);
    setWizard({
      key: crypto.randomUUID(),
      group: structuredClone(group),
      recipe: structuredClone(recipe),
      expected,
      weights: draft?.weights ?? {},
      checked: {},
      index: 0,
      review: false,
      leftoverId: amount > 0 ? (previousLeftover?.id ?? null) : null,
      reusedKg: amount,
      draftId: resumeDraft?.id,
      note: draft?.note ?? "",
      overlap: false,
    });
  }
  function changeWizard(patch: Partial<Wizard>) {
    if (!loadFrozen)
      setWizard(value => (value ? { ...value, ...patch } : value));
  }
  function chooseRun(run: FeedRun) {
    setSelectedRunId(run.id);
    setDistributionGroup(run.groupId);
    setDistributedKg("");
    setDistributionNote("");
    setOtherAuthorized(false);
    setDistributionKey(crypto.randomUUID());
    distributionAttempt.current = null;
    setDistributionFrozen(false);
  }
  function chooseHistory(run: FeedRun) {
    setHistoryRunId(run.id);
    setReason("");
    rectifyAttempt.current = null;
    setRectifyFrozen(false);
  }
  function navigate(next: Area) {
    if (wizard && next !== "carico") {
      confirmation.ask(
        "Lasciare la preparazione?",
        "I pesi non salvati saranno persi. Non è stato effettuato alcuno scarico definitivo. Per conservare i pesi usa prima Salva bozza.",
        async () => {
          if (loadFrozen)
            throw new Error(
              "Conferma già inviata: riprova con la stessa chiave prima di iniziare altre operazioni."
            );
          setWizard(null);
          setArea(next);
        }
      );
    } else if (distributionFrozen || leftoverFrozen || rectifyFrozen) {
      toast.warning(
        "Esito della richiesta da verificare: riprova la stessa conferma prima di cambiare operazione."
      );
    } else {
      if (next === "storico") setPeriod("tutto");
      setArea(next);
    }
  }
  function savePreferences() {
    if (
      !group ||
      !recipe ||
      (preferenceScope === "operatore" ? !canOperate : !canManage)
    )
      return;
    const value = {
      groupId: group.id,
      recipeId: recipe.id,
      method: leftoverForm.method,
      containerId: container?.id ?? null,
      containerWeightKg: container?.kg ?? null,
      containerCount,
      kg: leftoverWeight,
      destination: leftoverForm.destination,
      sequence:
        useSavedSequence && savedSequence
          ? savedSequence
          : recipe.ingredients
              .slice()
              .sort((a, b) => a.order - b.order)
              .map(line => line.productId),
    };
    confirmation.ask(
      "Salvare le preferenze?",
      `Ambito: ${preferenceScope}. Gruppo: ${group.nome}. Queste scelte saranno solo suggerimenti: il peso e la compatibilità dovranno essere riconfermati ogni volta.`,
      async () => {
        await preferencesMutation.mutateAsync({
          scopeType: preferenceScope,
          ...(preferenceScope === "gruppo" ? { scopeId: group.id } : {}),
          value,
          confirm: true,
        });
        await reload();
      }
    );
  }

  const periodBounds = useMemo(() => {
    if (period === "tutto") return { from: 0, to: Date.now(), valid: true };
    if (period === "personalizzato") {
      const from = new Date(`${fromDate}T00:00:00`).getTime();
      const to = new Date(`${toDate}T23:59:59.999`).getTime();
      return {
        from,
        to,
        valid: Number.isFinite(from) && Number.isFinite(to) && from <= to,
      };
    }
    const to = Date.now();
    const from = new Date(to);
    from.setHours(0, 0, 0, 0);
    if (period !== "oggi") from.setDate(from.getDate() - Number(period) + 1);
    return { from: from.getTime(), to, valid: true };
  }, [period, fromDate, toDate]);
  const inPeriod = (at: number) =>
    at >= periodBounds.from && at <= periodBounds.to;
  const matchesProduct = (run: FeedRun) =>
    !periodProduct ||
    run.ingredients.some(line => line.productId === periodProduct);
  const filteredRuns = data.runs.filter(
    run =>
      inPeriod(run.at) &&
      (!periodGroup || run.groupId === periodGroup) &&
      matchesProduct(run)
  );
  const consumptionRuns = filteredRuns.filter(
    run => run.state !== "preparazione" && run.state !== "annullato"
  );
  const consumptionDistributions = data.distributions.filter(
    item =>
      !item.annulled &&
      inPeriod(item.at) &&
      (!periodGroup || item.groupId === periodGroup) &&
      (!periodProduct ||
        data.runs.some(run => run.id === item.runId && matchesProduct(run)))
  );
  const consumptionLeftovers = data.leftovers.filter(
    item =>
      inPeriod(item.at) &&
      (!periodGroup || item.groupId === periodGroup) &&
      (!periodProduct ||
        data.distributions.some(
          distribution =>
            distribution.id === item.distributionId &&
            data.runs.some(
              run => run.id === distribution.runId && matchesProduct(run)
            )
        ))
  );
  const loadedKg = consumptionRuns.reduce(
    (sum, run) =>
      sum +
      run.ingredients
        .filter(line => !periodProduct || line.productId === periodProduct)
        .reduce((inner, line) => inner + line.actualKg, 0),
    0
  );
  const totalDistributed = consumptionDistributions.reduce(
    (sum, item) => sum + item.kg,
    0
  );
  const ingestionKnown =
    consumptionDistributions.length > 0 &&
    consumptionDistributions.every(item =>
      data.leftovers.some(leftover => leftover.distributionId === item.id)
    );
  const ingestion = ingestionKnown
    ? consumptionDistributions.reduce(
        (sum, item) =>
          sum +
          Math.max(
            0,
            item.kg -
              data.leftovers
                .filter(leftover => leftover.distributionId === item.id)
                .reduce((inner, leftover) => inner + leftover.kg, 0)
          ),
        0
      )
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plannedToday = sumKnown(
    data.groups.map(item =>
      item.nextDistributionAt == null || item.frequency == null
        ? null
        : item.nextDistributionAt < today.getTime() + 86400000
          ? item.frequency >= 1
            ? Math.ceil(item.frequency)
            : 1
          : 0
    )
  );
  const distributionAmount = feedNumber(distributedKg);
  const canDistribute =
    !!selectedRun &&
    (selectedRun.state === "caricato" || selectedRun.state === "parziale") &&
    distributionAmount != null &&
    distributionAmount >= 0.001 &&
    distributionAmount <= selectedRun.remainingKg &&
    data.groups.some(
      item => item.id === distributionGroup && item.nAnimali > 0
    ) &&
    (distributionGroup === selectedRun.groupId || otherAuthorized);

  return (
    <FeedPage title="Distribuzione e consumi">
      <div className="space-y-4 text-white">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Autonomia aziendale"
            value={qty(data.summary.autonomyDays, "giorni")}
          />
          <Stat
            label="Carri previsti oggi · stima"
            value={
              plannedToday == null ? "Dati insufficienti" : qty(plannedToday)
            }
          />
          <Stat
            label="Carri preparati oggi"
            value={qty(data.summary.todayRuns)}
          />
          <Stat
            label="Ancora da distribuire"
            value={qty(data.summary.undistributedRuns)}
          />
        </div>
        {data.summary.limitingProduct && (
          <p className="text-sm text-zinc-400">
            Alimento limitante: {data.summary.limitingProduct}
          </p>
        )}
        {data.summary.warnings.map((warning, index) => (
          <Hint key={index}>{warning}</Hint>
        ))}
        {!canOperate && (
          <Hint>
            Accesso in sola lettura: carichi, distribuzioni e avanzi richiedono
            il permesso operativo.
          </Hint>
        )}
        {area === "hub" ? (
          <>
            <section
              className="grid grid-cols-2 gap-3"
              aria-label="Operazioni alimentazione"
            >
              {(
                [
                  {
                    id: "carico",
                    label: "Carico carro",
                    icon: Tractor,
                    detail: "Pesi effettivi e preparazione",
                  },
                  {
                    id: "distribuzione",
                    label: "Distribuzione",
                    icon: Truck,
                    detail: "Carri pronti e saldo residuo",
                  },
                  {
                    id: "consumi",
                    label: "Consumi",
                    icon: Scale,
                    detail: "Prelievi, distribuito e avanzi",
                  },
                  {
                    id: "storico",
                    label: "Storico",
                    icon: History,
                    detail: "Registrazioni e snapshot",
                  },
                ] as const
              ).map(item => (
                <button
                  key={item.id}
                  className={`${PANEL} flex min-h-40 min-w-0 flex-col items-start gap-3 text-left transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500`}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon className="text-green-400" size={30} />
                  <span className="break-words text-lg font-semibold">
                    {item.label}
                  </span>
                  <span className="text-sm text-zinc-400">{item.detail}</span>
                </button>
              ))}
            </section>
            <button
              className={`${SECONDARY} w-full text-green-400`}
              onClick={() => navigate("frequenze")}
            >
              <Settings2 className="mr-2 inline" size={18} />
              Frequenze carri e contenitori
            </button>
            {!data.groups.length && (
              <Hint>
                Non ci sono gruppi aziendali. Crea i gruppi in Stalla: qui non
                vengono generate anagrafiche.
              </Hint>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              disabled={pending}
              className={SECONDARY}
              onClick={() => navigate("hub")}
            >
              <ArrowLeft size={18} className="mr-2 inline" />
              Operazioni
            </button>
            <h2 className="text-xl font-semibold">
              {
                {
                  carico: "Carico carro",
                  distribuzione: "Distribuzione",
                  consumi: "Consumi",
                  storico: "Storico",
                  frequenze: "Frequenze e contenitori",
                  hub: "Operazioni",
                }[area]
              }
            </h2>
          </div>
        )}

        {area === "carico" && !wizard && (
          <>
            {!group ? (
              <>
                <p className="text-sm text-zinc-400">
                  Scegli un gruppo reale della Stalla. Le quantità dipendono dai
                  capi e dalla frequenza attuale.
                </p>
                {!data.groups.length && (
                  <Hint>Nessun gruppo disponibile in Stalla.</Hint>
                )}
                {typeof preference.groupId === "string" &&
                  data.groups.some(item => item.id === preference.groupId) && (
                    <button
                      className={SECONDARY}
                      onClick={() => selectGroup(String(preference.groupId))}
                    >
                      Ultimo gruppo suggerito:{" "}
                      {groupName(data, String(preference.groupId))}
                    </button>
                  )}
                <div className="grid grid-cols-2 gap-3">
                  {data.groups.map(item => {
                    const active = data.recipes.find(
                      value => value.id === item.activeRecipeId
                    );
                    const due =
                      item.nextDistributionAt != null &&
                      item.nextDistributionAt <= Date.now();
                    return (
                      <button
                        disabled={pending || !canOperate}
                        key={item.id}
                        onClick={() => selectGroup(item.id)}
                        className={`${PANEL} min-h-48 min-w-0 space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${due ? "border-green-500/60" : ""}`}
                      >
                        {item.foto ? (
                          <img
                            src={item.foto}
                            alt=""
                            className="h-24 w-full rounded-xl object-cover"
                          />
                        ) : (
                          <Tractor className="text-green-400" size={28} />
                        )}
                        <p className="break-words font-semibold">{item.nome}</p>
                        <p className="text-sm text-zinc-400">
                          {item.tipologia} · {qty(item.nAnimali)} capi
                        </p>
                        <p className="break-words text-sm">
                          {active?.nome ?? "Ricetta attiva mancante"}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Ultima distribuzione:{" "}
                          {item.lastDistributionAt == null
                            ? "Non registrata"
                            : dateTime(item.lastDistributionAt)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Prossima:{" "}
                          {item.nextDistributionAt == null
                            ? "Non calcolabile"
                            : dateTime(item.nextDistributionAt)}
                        </p>
                        {due && (
                          <p className="text-xs text-green-400">
                            Alimentazione prevista
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {data.runs.some(run => run.state === "preparazione") && (
                  <section className={PANEL}>
                    <h3 className="mb-3 font-semibold">
                      Bozze salvate · nessuno scarico definitivo
                    </h3>
                    {data.runs
                      .filter(run => run.state === "preparazione")
                      .map(run => {
                        const draft = readLoadDraft(run.draft);
                        const draftGroup = data.groups.find(
                          item => item.id === run.groupId
                        );
                        const compatible =
                          draft &&
                          draftGroup &&
                          draft.recipeId === draftGroup.activeRecipeId &&
                          draft.headCount === draftGroup.nAnimali &&
                          draft.frequency === draftGroup.frequency;
                        return (
                          <div
                            key={run.id}
                            className="space-y-2 border-t border-white/10 py-3"
                          >
                            <p>
                              {groupName(data, run.groupId)} ·{" "}
                              {dateTime(run.at)}
                            </p>
                            <button
                              disabled={!compatible || !canOperate || pending}
                              className={SECONDARY}
                              onClick={() => {
                                if (draft)
                                  selectGroup(run.groupId, {
                                    id: run.id,
                                    value: draft,
                                  });
                              }}
                            >
                              Riprendi bozza
                            </button>
                            {!compatible && (
                              <p className="text-sm text-orange-300">
                                Formato o ricetta/capi/frequenza non
                                compatibili: avvia un nuovo carico.
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </section>
                )}
              </>
            ) : (
              <>
                <button
                  disabled={pending || leftoverFrozen}
                  className={SECONDARY}
                  onClick={() => selectGroup("")}
                >
                  Cambia gruppo
                </button>
                <section className={`${PANEL} space-y-4`}>
                  <h3 className="text-xl font-semibold">{group.nome}</h3>
                  <p>
                    {recipe
                      ? `${recipe.nome} · versione ${recipe.version}`
                      : "Ricetta attiva mancante"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Capi attuali" value={qty(group.nAnimali)} />
                    <Stat
                      label="Previsto per carro"
                      value={qty(baseKg, "kg")}
                    />
                    <Stat
                      label="Frequenza giornaliera"
                      value={qty(group.frequency, "carri/giorno")}
                    />
                    <Stat
                      label="Ultima distribuzione"
                      value={
                        group.lastDistributionAt == null
                          ? "Non registrata"
                          : dateTime(group.lastDistributionAt)
                      }
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Frequenza: {group.frequencySource} · affidabilità:{" "}
                    {group.frequencyReliability}
                  </p>
                  {!recipe && (
                    <Hint danger>
                      Attiva una ricetta in Razioni prima del carico.
                    </Hint>
                  )}
                  {group.nAnimali <= 0 && (
                    <Hint danger>
                      Il gruppo non contiene animali: il carico è bloccato.
                    </Hint>
                  )}
                  {(group.frequency == null || group.frequency <= 0) && (
                    <Hint>
                      Frequenza sconosciuta. Configurala nell’accesso
                      secondario; non viene presunto un carro al giorno.
                    </Hint>
                  )}
                  {group.overlaps.length > 0 && (
                    <Hint>
                      Animali condivisi con altri gruppi:{" "}
                      {group.overlaps
                        .map(
                          id =>
                            data.groups.find(item => item.id === id)?.nome ?? id
                        )
                        .join(", ")}
                      . Sarà richiesta una conferma dedicata.
                    </Hint>
                  )}
                </section>
                <section className={`${PANEL} space-y-4`}>
                  <h3 className="font-semibold">
                    1. Avanzo della distribuzione precedente
                  </h3>
                  {!previous ? (
                    <>
                      <Hint>
                        Non risulta una distribuzione effettiva precedente per
                        questo gruppo. Non è possibile creare un avanzo
                        scollegato. Conferma l’assenza di avanzo prima di
                        proseguire; non sarà creato alcun record automatico.
                      </Hint>
                      <button
                        disabled={!canOperate || pending || previousIsConfirmed}
                        className={ACTION}
                        onClick={() =>
                          confirmation.ask(
                            "Confermare nessun avanzo precedente?",
                            `${group.nome}: nessuna distribuzione precedente registrata. Confermi che oggi non c’è avanzo da utilizzare? Questa dichiarazione abilita solo la preparazione e non crea dati artificiali.`,
                            async () => setPreviousConfirmed(previousToken)
                          )
                        }
                      >
                        {previousIsConfirmed
                          ? "Assenza di avanzo confermata"
                          : "Confermo zero avanzo precedente"}
                      </button>
                    </>
                  ) : previousLeftover && !leftoverFrozen ? (
                    <>
                      <p className="text-sm text-zinc-400">
                        Distribuzione {previous.id} · {dateTime(previous.at)} ·{" "}
                        {qty(previous.kg, "kg")}
                      </p>
                      <p>
                        Avanzo già registrato: {qty(previousLeftover.kg, "kg")}{" "}
                        · {previousLeftover.destination}
                      </p>
                      <p className="text-sm text-zinc-400">
                        Disponibile per riutilizzo:{" "}
                        {qty(availableLeftover(previousLeftover), "kg")} ·
                        composizione{" "}
                        {previousLeftover.compositionKnown
                          ? "nota"
                          : "non nota"}
                      </p>
                      <button
                        disabled={!canOperate || pending || previousIsConfirmed}
                        className={ACTION}
                        onClick={() =>
                          confirmation.ask(
                            "Riconfermare l’avanzo precedente?",
                            `Distribuzione ${previous.id}. Avanzo registrato ${qty(previousLeftover.kg, "kg")}, destinazione ${previousLeftover.destination}. Confermi di aver verificato il dato? Non verrà duplicata la registrazione.`,
                            async () => setPreviousConfirmed(previousToken)
                          )
                        }
                      >
                        {previousIsConfirmed
                          ? "Avanzo verificato"
                          : "Verifico e riconfermo"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-400">
                        Collegamento reale: distribuzione {previous.id} ·{" "}
                        {dateTime(previous.at)} · {qty(previous.kg, "kg")}
                      </p>
                      {settings.length > 0 && (
                        <button
                          disabled={pending || leftoverFrozen}
                          className={SECONDARY}
                          onClick={useSuggestions}
                        >
                          Riprendi suggerimenti salvati · da riconfermare
                        </button>
                      )}
                      <Field label="Come misuri l’avanzo?">
                        <select
                          className={INPUT}
                          value={leftoverForm.method}
                          disabled={leftoverFrozen || pending}
                          onChange={event =>
                            setLeftover({
                              method: event.target
                                .value as LeftoverForm["method"],
                              known: false,
                              compatible: false,
                            })
                          }
                        >
                          <option value="nessuno">
                            Nessun avanzo · zero esplicito
                          </option>
                          <option value="kg">Peso diretto in kg</option>
                          <option value="contenitore">
                            Contenitore calibrato
                          </option>
                        </select>
                      </Field>
                      {leftoverForm.method === "kg" && (
                        <Field label="Peso effettivo dell’avanzo (kg)">
                          <input
                            inputMode="decimal"
                            className={INPUT}
                            value={leftoverForm.kg}
                            disabled={leftoverFrozen || pending}
                            onChange={event =>
                              setLeftover({ kg: event.target.value })
                            }
                          />
                        </Field>
                      )}
                      {leftoverForm.method === "contenitore" && (
                        <>
                          {!eligibleContainers.length && (
                            <Hint>
                              Nessun contenitore calibrato compatibile. Usa il
                              peso diretto oppure chiedi al responsabile di
                              configurare una calibrazione reale.
                            </Hint>
                          )}
                          <Field label="Contenitore e calibrazione">
                            <select
                              className={INPUT}
                              disabled={leftoverFrozen || pending}
                              value={leftoverForm.containerId}
                              onChange={event =>
                                setLeftover({
                                  containerId: event.target.value,
                                  compatible: false,
                                })
                              }
                            >
                              <option value="">
                                Seleziona un contenitore reale
                              </option>
                              {eligibleContainers.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.nome} · {qty(item.kg, "kg/pieno")}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Numero contenitori · anche frazioni">
                            <input
                              className={INPUT}
                              inputMode="decimal"
                              value={leftoverForm.count}
                              disabled={leftoverFrozen || pending}
                              onChange={event =>
                                setLeftover({ count: event.target.value })
                              }
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 1, 1.5, 2].map(count => (
                              <button
                                disabled={leftoverFrozen || pending}
                                key={count}
                                className={SECONDARY}
                                onClick={() =>
                                  setLeftover({ count: String(count) })
                                }
                              >
                                {qty(count)}
                              </button>
                            ))}
                          </div>
                          {container && (
                            <p className="text-xs text-zinc-400">
                              Calibrato il {dateTime(container.calibratedAt)}.
                              Il peso varia con ricetta e umidità: verificare la
                              calibrazione prima della conferma.
                            </p>
                          )}
                        </>
                      )}
                      <Stat
                        label="Peso equivalente da confermare"
                        value={qty(leftoverWeight, "kg")}
                      />
                      {leftoverForm.method !== "nessuno" && (
                        <Field label="Destinazione">
                          <select
                            className={INPUT}
                            value={leftoverForm.destination}
                            disabled={leftoverFrozen || pending}
                            onChange={event =>
                              setLeftover({
                                destination: event.target
                                  .value as LeftoverForm["destination"],
                                known: false,
                                compatible: false,
                              })
                            }
                          >
                            <option value="rimosso">
                              Rimosso · non riutilizzato
                            </option>
                            <option value="scartato">Scartato</option>
                            <option value="riutilizzo">
                              Disponibile per riutilizzo
                            </option>
                          </select>
                        </Field>
                      )}
                      {leftoverForm.method !== "nessuno" &&
                        leftoverForm.destination === "riutilizzo" && (
                          <>
                            <Consent
                              disabled={leftoverFrozen || pending}
                              checked={leftoverForm.known}
                              onChange={known => setLeftover({ known })}
                            >
                              Conosco la composizione dell’avanzo della
                              distribuzione indicata.
                            </Consent>
                            <Consent
                              disabled={leftoverFrozen || pending}
                              checked={leftoverForm.compatible}
                              onChange={compatible =>
                                setLeftover({ compatible })
                              }
                            >
                              Ho verificato la sicurezza alimentare e la
                              compatibilità secondo le procedure aziendali.
                              Nessun riutilizzo automatico.
                            </Consent>
                            {recipe &&
                              !data.runs.some(
                                run =>
                                  run.id === previous.runId &&
                                  sameRecipeSnapshot(run.recipeSnapshot, recipe)
                              ) && (
                                <Hint danger>
                                  La distribuzione precedente utilizza uno
                                  snapshot diverso dalla ricetta attiva: il
                                  riutilizzo in questo carico è bloccato.
                                </Hint>
                              )}
                          </>
                        )}
                      <Field label="Note avanzo">
                        <textarea
                          className={`${INPUT} min-h-24 py-3`}
                          maxLength={2000}
                          value={leftoverForm.note}
                          disabled={leftoverFrozen || pending}
                          onChange={event =>
                            setLeftover({ note: event.target.value })
                          }
                        />
                      </Field>
                      {leftoverWeight != null &&
                        leftoverWeight > previous.kg && (
                          <Hint danger>
                            L’avanzo non può superare il peso della
                            distribuzione collegata.
                          </Hint>
                        )}
                      <button
                        disabled={
                          !canOperate ||
                          pending ||
                          (!leftoverFrozen &&
                            (leftoverWeight == null ||
                              leftoverWeight > previous.kg ||
                              (leftoverForm.method !== "nessuno" &&
                                leftoverWeight <= 0) ||
                              (leftoverForm.method !== "nessuno" &&
                                leftoverForm.destination === "riutilizzo" &&
                                (!leftoverForm.known ||
                                  !leftoverForm.compatible))))
                        }
                        className={ACTION}
                        onClick={() => {
                          const payload: LeftoverInput =
                            leftoverAttempt.current ?? {
                              key: leftoverKey,
                              distributionId: previous.id,
                              at: Date.now(),
                              method: leftoverForm.method,
                              kg: leftoverWeight ?? 0,
                              containerId: container?.id ?? null,
                              ...(containerCount != null
                                ? { containerCount }
                                : {}),
                              destination:
                                leftoverForm.method === "nessuno"
                                  ? "rimosso"
                                  : leftoverForm.destination,
                              compositionKnown: leftoverForm.known,
                              compatibleReuse: leftoverForm.compatible,
                              note: leftoverForm.note || null,
                              confirm: true,
                            };
                          confirmation.ask(
                            "Registrare l’avanzo effettivo?",
                            `Gruppo ${group.nome}. Distribuzione ${payload.distributionId}. ${qty(leftoverWeight, "kg")} · ${payload.destination}. Il peso dei contenitori viene ricalcolato dal server. La quantità di oggi è stata verificata?`,
                            async () => {
                              leftoverAttempt.current = payload;
                              setLeftoverFrozen(true);
                              try {
                                await leftoverMutation.mutateAsync(payload);
                              } catch (error) {
                                if (definitiveFeedRejection(error)) {
                                  leftoverAttempt.current = null;
                                  setLeftoverFrozen(false);
                                }
                                throw error;
                              }
                              setPreviousConfirmed(previousToken);
                              leftoverAttempt.current = null;
                              setLeftoverFrozen(false);
                              setLeftoverKey(crypto.randomUUID());
                              await reload();
                            }
                          );
                        }}
                      >
                        {leftoverFrozen
                          ? "Riprova stessa registrazione"
                          : "Conferma avanzo di oggi"}
                      </button>
                      {leftoverFrozen && (
                        <Hint>
                          Richiesta già inviata: pesi e chiave sono bloccati.
                          Riprova senza duplicare la registrazione.
                        </Hint>
                      )}
                    </>
                  )}
                </section>
                {previousIsConfirmed && (
                  <section className={`${PANEL} space-y-4`}>
                    <h3 className="font-semibold">
                      2. Preparazione fresca e riutilizzo
                    </h3>
                    {savedSequence && (
                      <Consent
                        checked={useSavedSequence}
                        disabled={pending}
                        onChange={setUseSavedSequence}
                      >
                        Uso e riconfermo la sequenza suggerita:{" "}
                        {savedSequence
                          .map(
                            id =>
                              data.products.find(item => item.id === id)
                                ?.nome ?? "Alimento non disponibile"
                          )
                          .join(" → ")}
                        . In assenza di consenso viene usato l’ordine della
                        ricetta.
                      </Consent>
                    )}
                    <Consent
                      disabled={pending || !reusable}
                      checked={reuseRequested}
                      onChange={value => {
                        setReuseRequested(value);
                        setReuseConsent(false);
                      }}
                    >
                      Riutilizzare parte dell’avanzo disponibile · mai
                      selezionato automaticamente
                    </Consent>
                    {!reusable && (
                      <p className="text-sm text-zinc-400">
                        Riutilizzo non disponibile: servono una distribuzione
                        reale, composizione nota, destinazione riutilizzo e
                        identico snapshot della ricetta attiva.
                      </p>
                    )}
                    {reuseRequested && (
                      <>
                        <Field
                          label={`Avanzo da riutilizzare in questo carro (massimo ${qty(previousLeftover ? Math.min(availableLeftover(previousLeftover), baseKg ?? 0) : null, "kg")})`}
                        >
                          <input
                            className={INPUT}
                            inputMode="decimal"
                            value={reuseKg}
                            onChange={event => {
                              setReuseKg(event.target.value);
                              setReuseConsent(false);
                            }}
                          />
                        </Field>
                        <Consent
                          checked={reuseConsent}
                          onChange={setReuseConsent}
                        >
                          Confermo composizione nota, stesso snapshot e
                          compatibilità alimentare di questa quantità. Gli
                          ingredienti freschi saranno ridotti proporzionalmente.
                        </Consent>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Stat
                        label="Razione totale prevista"
                        value={qty(baseKg, "kg")}
                      />
                      <Stat
                        label="Fresco previsto"
                        value={qty(
                          baseKg == null || requestedReuse == null
                            ? null
                            : Math.max(0, baseKg - requestedReuse),
                          "kg"
                        )}
                      />
                    </div>
                    {reuseProblem && (
                      <Hint danger>
                        Verifica quantità disponibile e compatibilità: il
                        riutilizzo non è ancora autorizzato.
                      </Hint>
                    )}
                    <button
                      className={`${ACTION} w-full`}
                      disabled={
                        !canOperate ||
                        pending ||
                        !recipe ||
                        group.nAnimali <= 0 ||
                        baseKg == null ||
                        baseKg <= 0 ||
                        !!reuseProblem ||
                        !!leftoverFrozen
                      }
                      onClick={() =>
                        confirmation.ask(
                          "Iniziare il carico guidato?",
                          `${group.nome} · ${recipe?.nome ?? ""}. Fresco previsto ${qty(baseKg == null ? null : baseKg - (requestedReuse ?? 0), "kg")}; riutilizzo ${qty(requestedReuse, "kg")}. Questa azione apre la preparazione: nessun movimento di Magazzino fino a CONFERMA CARRO.`,
                          async () => beginLoad()
                        )
                      }
                    >
                      Inizia carico guidato
                    </button>
                  </section>
                )}
                {recipe && (
                  <section className={`${PANEL} space-y-3`}>
                    <h3 className="font-semibold">
                      Preferenze · solo suggerimenti
                    </h3>
                    <Field label="Ambito preferenze">
                      <select
                        className={INPUT}
                        value={preferenceScope}
                        onChange={event =>
                          setPreferenceScope(
                            event.target.value as typeof preferenceScope
                          )
                        }
                      >
                        <option value="operatore">Operatore</option>
                        {canManage && (
                          <>
                            <option value="gruppo">Gruppo</option>
                            <option value="azienda">Azienda</option>
                          </>
                        )}
                      </select>
                    </Field>
                    <button
                      className={SECONDARY}
                      disabled={
                        (preferenceScope === "operatore"
                          ? !canOperate
                          : !canManage) ||
                        pending ||
                        leftoverFrozen
                      }
                      onClick={savePreferences}
                    >
                      Salva preferenze esplicitamente
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {area === "carico" && wizard && (
          <section className={`${PANEL} space-y-4`}>
            <div>
              <p className="text-sm text-green-400">
                Preparazione · nessuno scarico definitivo
              </p>
              <h3 className="text-xl font-semibold">{wizard.group.nome}</h3>
              <p className="text-sm text-zinc-400">
                {wizard.recipe.nome} · v{wizard.recipe.version} ·{" "}
                {qty(wizard.group.nAnimali)} capi
              </p>
            </div>
            {wizardChanged && !loadFrozen && (
              <Hint danger>
                Ricetta, composizione del gruppo o frequenza sono cambiati
                durante la preparazione. Abbandona e riavvia: lo snapshot non
                viene aggiornato silenziosamente.
              </Hint>
            )}
            {loadFrozen && (
              <Hint>
                Conferma già inviata. In caso di errore o risposta persa,
                riprova lo stesso payload con la stessa chiave UUID; non
                modificare il carico.
              </Hint>
            )}
            <div
              className="h-3 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-label="Ingredienti verificati"
              aria-valuemin={0}
              aria-valuemax={wizard.expected.length}
              aria-valuenow={
                Object.values(wizard.checked).filter(Boolean).length
              }
            >
              <div
                className="h-full bg-green-500"
                style={{
                  width: `${(Object.values(wizard.checked).filter(Boolean).length / wizard.expected.length) * 100}%`,
                }}
              />
            </div>
            {!wizard.review && currentLine ? (
              <>
                <p className="text-sm text-zinc-400">
                  Ingrediente {wizard.index + 1} di {wizard.expected.length}
                </p>
                {currentProduct?.immagineUrl ? (
                  <img
                    src={currentProduct.immagineUrl}
                    alt=""
                    className="h-36 w-full rounded-xl object-cover"
                  />
                ) : (
                  <Package className="text-green-400" size={40} />
                )}
                <h4 className="break-words text-2xl font-bold">
                  {currentLine.nome}
                </h4>
                <p className="text-sm text-zinc-400">Fresco da caricare</p>
                <p className="text-4xl font-bold text-green-400">
                  {qty(currentLine.kg, "kg")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Stat
                    label="Disponibile in Magazzino"
                    value={qty(currentProduct?.quantityKg, "kg")}
                  />
                  <Stat
                    label="Autonomia aziendale alimento"
                    value={
                      currentProduct?.autonomyStatus === "Non in uso"
                        ? "Non in uso"
                        : qty(currentProduct?.autonomyDays, "giorni")
                    }
                  />
                </div>
                {!currentProduct && (
                  <Hint danger>
                    L’ingrediente non è più disponibile nel Magazzino aziendale.
                  </Hint>
                )}
                <Field label="Peso effettivamente caricato (kg)">
                  <input
                    autoFocus
                    className={`${INPUT} min-h-16 text-2xl`}
                    inputMode="decimal"
                    value={currentWeight}
                    disabled={pending || loadFrozen}
                    onChange={event =>
                      changeWizard({
                        weights: {
                          ...wizard.weights,
                          [currentLine.productId]: event.target.value,
                        },
                        checked: {
                          ...wizard.checked,
                          [currentLine.productId]: false,
                        },
                      })
                    }
                  />
                </Field>
                <Stat
                  label="Differenza effettivo − previsto"
                  value={qty(
                    feedNumber(currentWeight) == null
                      ? null
                      : (feedNumber(currentWeight) ?? 0) - currentLine.kg,
                    "kg"
                  )}
                />
                {currentProblem && <Hint danger>{currentProblem}</Hint>}
                {feedNumber(currentWeight) != null &&
                  Math.abs((feedNumber(currentWeight) ?? 0) - currentLine.kg) >
                    Math.max(currentLine.kg * 0.1, 0.1) && (
                    <Hint>
                      Differenza superiore al 10% del previsto: controlla il
                      peso. Sarà mostrata anche nella conferma finale.
                    </Hint>
                  )}
                <button
                  className={`${ACTION} w-full min-h-14`}
                  disabled={
                    !canOperate ||
                    pending ||
                    loadFrozen ||
                    !!currentProblem ||
                    wizardChanged
                  }
                  onClick={() =>
                    confirmation.ask(
                      "Confermare ingrediente?",
                      `${currentLine.nome}: previsto ${qty(currentLine.kg, "kg")}, effettivo ${qty(feedNumber(currentWeight), "kg")}. Nessuno scarico fino alla conferma finale del carro.`,
                      async () =>
                        setWizard(value =>
                          value
                            ? {
                                ...value,
                                checked: {
                                  ...value.checked,
                                  [currentLine.productId]: true,
                                },
                                index: Math.min(
                                  value.index + 1,
                                  value.expected.length - 1
                                ),
                                review:
                                  value.index === value.expected.length - 1,
                              }
                            : value
                        )
                    )
                  }
                >
                  <Check className="mr-2 inline" size={20} />
                  Conferma ingrediente
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={SECONDARY}
                    disabled={pending || loadFrozen || wizard.index === 0}
                    onClick={() => changeWizard({ index: wizard.index - 1 })}
                  >
                    <ArrowLeft className="mr-1 inline" size={18} />
                    Precedente
                  </button>
                  <button
                    className={SECONDARY}
                    disabled={
                      pending ||
                      loadFrozen ||
                      !wizard.checked[currentLine.productId]
                    }
                    onClick={() =>
                      changeWizard(
                        wizard.index === wizard.expected.length - 1
                          ? { review: true }
                          : { index: wizard.index + 1 }
                      )
                    }
                  >
                    Successivo
                    <ArrowRight className="ml-1 inline" size={18} />
                  </button>
                </div>
                <button
                  className={`${SECONDARY} w-full`}
                  disabled={pending || loadFrozen}
                  onClick={() => changeWizard({ review: true })}
                >
                  Controlla riepilogo
                </button>
              </>
            ) : (
              <>
                <h4 className="text-xl font-semibold">
                  Riepilogo prima dello scarico
                </h4>
                {wizard.expected.map((line, index) => {
                  const actual = feedNumber(
                    wizard.weights[line.productId] ?? ""
                  );
                  const problem = ingredientProblem(
                    wizard.weights[line.productId] ?? "",
                    data.products.find(product => product.id === line.productId)
                      ?.quantityKg
                  );
                  return (
                    <div
                      className="space-y-2 rounded-xl border border-white/10 p-3"
                      key={line.productId}
                    >
                      <p className="break-words font-semibold">{line.nome}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-zinc-400">
                          Previsto: {qty(line.kg, "kg")}
                        </span>
                        <span>Effettivo: {qty(actual, "kg")}</span>
                        <span className="col-span-2 text-zinc-400">
                          Differenza:{" "}
                          {qty(actual == null ? null : actual - line.kg, "kg")}{" "}
                          ·{" "}
                          {wizard.checked[line.productId]
                            ? "Verificato"
                            : "Da confermare"}
                        </span>
                      </div>
                      {problem && <Hint danger>{problem}</Hint>}
                      <button
                        disabled={pending || loadFrozen}
                        className={SECONDARY}
                        onClick={() => changeWizard({ index, review: false })}
                      >
                        Correggi / verifica peso
                      </button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Totale fresco" value={qty(freshKg, "kg")} />
                  <Stat
                    label="Avanzo riutilizzato"
                    value={qty(wizard.reusedKg, "kg")}
                  />
                  <Stat
                    label="Peso complessivo carro"
                    value={qty(freshKg + wizard.reusedKg, "kg")}
                  />
                  {canSeeCosts && (
                    <Stat
                      label="Costo fresco · stima corrente"
                      value={eur(loadCost)}
                    />
                  )}
                </div>
                {canSeeCosts && (
                  <p className="text-xs text-zinc-400">
                    Il costo definitivo viene fissato dal server al momento
                    dello scarico e conservato nello snapshot storico.
                  </p>
                )}
                {wizard.group.overlaps.length > 0 && (
                  <Consent
                    checked={wizard.overlap}
                    disabled={pending || loadFrozen}
                    onChange={overlap => changeWizard({ overlap })}
                  >
                    Ho verificato gli animali condivisi con altri gruppi;
                    confermo che questo carico non duplica l’alimentazione.
                  </Consent>
                )}
                <button
                  className={`${ACTION} w-full min-h-14`}
                  disabled={
                    !canOperate ||
                    pending ||
                    (!loadFrozen &&
                      (!wizardComplete ||
                        wizardChanged ||
                        freshKg + wizard.reusedKg <= 0 ||
                        (wizard.group.overlaps.length > 0 && !wizard.overlap)))
                  }
                  onClick={() => {
                    const payload: LoadInput = loadAttempt.current ?? {
                      key: wizard.key,
                      draftId: wizard.draftId ?? draftId,
                      groupId: wizard.group.id,
                      recipeId: wizard.recipe.id,
                      at: Date.now(),
                      ingredients: wizard.expected.map(line => ({
                        productId: line.productId,
                        actualKg:
                          feedNumber(wizard.weights[line.productId] ?? "") ?? 0,
                      })),
                      leftoverId: wizard.leftoverId,
                      reusedKg: wizard.reusedKg,
                      compatibleReuse: wizard.reusedKg > 0,
                      acknowledgeOverlap: wizard.overlap,
                      note: wizard.note || null,
                      confirm: true,
                    };
                    const summary = wizard.expected
                      .map(
                        line =>
                          `${line.nome}: previsto ${qty(line.kg, "kg")}, effettivo ${qty(feedNumber(wizard.weights[line.productId] ?? ""), "kg")}`
                      )
                      .join("\n");
                    confirmation.ask(
                      "CONFERMA CARRO · scarico Magazzino",
                      `${wizard.group.nome} · ${wizard.recipe.nome} v${wizard.recipe.version}\n${summary}\nFresco ${qty(freshKg, "kg")}; riutilizzo ${qty(wizard.reusedKg, "kg")}; totale ${qty(freshKg + wizard.reusedKg, "kg")}.\nSaranno scaricate SOLO le quantità fresche. La distribuzione è un evento successivo distinto.`,
                      async () => {
                        loadAttempt.current = payload;
                        setLoadFrozen(true);
                        let result;
                        try {
                          result = await loadMutation.mutateAsync(payload);
                        } catch (error) {
                          if (definitiveFeedRejection(error)) {
                            loadAttempt.current = null;
                            setLoadFrozen(false);
                          }
                          throw error;
                        }
                        setWizard(null);
                        setLoadFrozen(false);
                        loadAttempt.current = null;
                        setDraftId(undefined);
                        setResumeDraft(null);
                        setGroupId("");
                        setSelectedRunId(result.id);
                        setDistributionGroup(payload.groupId);
                        setDistributedKg("");
                        setOtherAuthorized(false);
                        distributionAttempt.current = null;
                        setDistributionFrozen(false);
                        setDistributionKey(crypto.randomUUID());
                        setArea("distribuzione");
                        await reload();
                      }
                    );
                  }}
                >
                  {loadFrozen
                    ? "Riprova CONFERMA CARRO · stessa chiave"
                    : "CONFERMA CARRO"}
                </button>
                {!wizardComplete && !loadFrozen && (
                  <Hint>
                    Carico incompleto: verifica ogni ingrediente e la
                    disponibilità corrente prima di confermare.
                  </Hint>
                )}
              </>
            )}
            <Field label="Note del carico">
              <textarea
                className={`${INPUT} min-h-24 py-3`}
                disabled={pending || loadFrozen}
                maxLength={2000}
                value={wizard.note}
                onChange={event => changeWizard({ note: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                disabled={!canOperate || pending || loadFrozen || wizardChanged}
                className={SECONDARY}
                onClick={() =>
                  confirmation.ask(
                    "Salvare una bozza?",
                    `${wizard.group.nome}: saranno conservati i pesi inseriti, ma non verrà scaricato il Magazzino. Riprendendo la bozza dovrai riconfermare l’avanzo e verificare gli ingredienti.`,
                    async () => {
                      if (
                        wizard.group.frequency == null ||
                        wizard.group.frequency <= 0
                      )
                        throw new Error(
                          "Frequenza mancante: bozza non salvabile."
                        );
                      const result = await draftMutation.mutateAsync({
                        groupId: wizard.group.id,
                        recipeId: wizard.recipe.id,
                        draft: {
                          version: 1,
                          recipeId: wizard.recipe.id,
                          headCount: wizard.group.nAnimali,
                          frequency: wizard.group.frequency,
                          weights: wizard.weights,
                          note: wizard.note,
                        } satisfies Draft,
                        confirm: true,
                      });
                      setDraftId(result.id);
                      changeWizard({ draftId: result.id });
                      await reload();
                    }
                  )
                }
              >
                <ClipboardList className="mr-2 inline" size={18} />
                Salva bozza · nessuno scarico
              </button>
              <button
                disabled={pending || loadFrozen}
                className={SECONDARY}
                onClick={() =>
                  confirmation.ask(
                    "Abbandonare il carico?",
                    "I pesi non salvati saranno persi; nessuno scarico definitivo è stato effettuato. Le bozze già salvate e l’avanzo eventualmente registrato rimangono nello storico.",
                    async () => {
                      setWizard(null);
                      selectGroup("");
                    }
                  )
                }
              >
                Abbandona preparazione
              </button>
            </div>
            <p className="break-all text-xs text-zinc-500">
              Chiave tentativo: {wizard.key}. Inserimento manuale; nessuna
              compatibilità con pese non verificate dichiarata.
            </p>
          </section>
        )}

        {area === "distribuzione" && (
          <>
            <p className="text-sm text-zinc-400">
              Registra il peso effettivo distribuito. Questa operazione non
              scarica nuovamente il Magazzino.
            </p>
            {!readyRuns.length && (
              <Hint>
                Nessun carro caricato con residuo disponibile. Prepara e
                conferma un carro, oppure consulta lo storico.
              </Hint>
            )}
            <div className="space-y-3">
              {readyRuns.map(run => (
                <button
                  disabled={pending || distributionFrozen || !canOperate}
                  className={`${PANEL} w-full space-y-2 text-left ${selectedRunId === run.id ? "border-green-500/70" : ""}`}
                  key={run.id}
                  onClick={() => chooseRun(run)}
                >
                  <p className="break-words font-semibold">
                    {groupName(data, run.groupId)} · {run.recipeSnapshot.nome}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {dateTime(run.at)} · operatore {run.operatorId} ·{" "}
                    {run.state === "parziale"
                      ? "Parzialmente distribuito"
                      : "Caricato"}
                  </p>
                  <p>
                    Caricato {qty(run.totalKg, "kg")} · residuo{" "}
                    <strong className="text-green-400">
                      {qty(run.remainingKg, "kg")}
                    </strong>
                  </p>
                  <p className="break-all text-xs text-zinc-500">
                    Carro {run.id}
                  </p>
                </button>
              ))}
            </div>
            {selectedRun && (
              <section className={`${PANEL} space-y-4`}>
                <h3 className="font-semibold">
                  Distribuzione del carro {selectedRun.id}
                </h3>
                <Field label="Gruppo destinatario">
                  <select
                    className={INPUT}
                    value={distributionGroup}
                    disabled={pending || distributionFrozen}
                    onChange={event => {
                      setDistributionGroup(event.target.value);
                      setOtherAuthorized(false);
                    }}
                  >
                    <option value="">Seleziona gruppo reale</option>
                    {data.groups.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nome} · {qty(item.nAnimali)} capi
                        {item.id === selectedRun.groupId ? " · previsto" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {distributionGroup &&
                  distributionGroup !== selectedRun.groupId && (
                    <>
                      <Hint>
                        Destinatario diverso dal gruppo previsto. Verifica la
                        compatibilità della razione e l’autorizzazione
                        aziendale; il server applica i controlli di permesso.
                      </Hint>
                      <Consent
                        checked={otherAuthorized}
                        disabled={pending || distributionFrozen}
                        onChange={setOtherAuthorized}
                      >
                        Sono autorizzato a distribuire questa razione nel gruppo
                        selezionato e ne ho verificato la compatibilità
                        alimentare.
                      </Consent>
                    </>
                  )}
                <Field label="Peso effettivamente distribuito (kg)">
                  <input
                    className={`${INPUT} min-h-16 text-2xl`}
                    inputMode="decimal"
                    value={distributedKg}
                    disabled={pending || distributionFrozen}
                    onChange={event => setDistributedKg(event.target.value)}
                  />
                </Field>
                <button
                  disabled={
                    pending ||
                    distributionFrozen ||
                    selectedRun.remainingKg <= 0
                  }
                  className={SECONDARY}
                  onClick={() =>
                    setDistributedKg(String(selectedRun.remainingKg))
                  }
                >
                  Tutto il residuo · {qty(selectedRun.remainingKg, "kg")}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Stat
                    label="Saldo disponibile"
                    value={qty(selectedRun.remainingKg, "kg")}
                  />
                  <Stat
                    label="Residuo dopo distribuzione"
                    value={qty(
                      distributionAmount == null
                        ? null
                        : selectedRun.remainingKg - distributionAmount,
                      "kg"
                    )}
                  />
                </div>
                {distributionAmount != null &&
                  distributionAmount > selectedRun.remainingKg && (
                    <Hint danger>
                      La distribuzione supera il residuo disponibile. Operazione
                      bloccata.
                    </Hint>
                  )}
                <Field label="Note distribuzione">
                  <textarea
                    className={`${INPUT} min-h-24 py-3`}
                    maxLength={2000}
                    value={distributionNote}
                    disabled={pending || distributionFrozen}
                    onChange={event => setDistributionNote(event.target.value)}
                  />
                </Field>
                <button
                  disabled={
                    !canOperate ||
                    pending ||
                    (!distributionFrozen && !canDistribute)
                  }
                  className={`${ACTION} w-full`}
                  onClick={() => {
                    const payload: DistributionInput =
                      distributionAttempt.current ?? {
                        key: distributionKey,
                        runId: selectedRun.id,
                        groupId: distributionGroup,
                        kg: distributionAmount ?? 0,
                        at: Date.now(),
                        authorizeOtherGroup: otherAuthorized,
                        note: distributionNote || null,
                        confirm: true,
                      };
                    confirmation.ask(
                      "Confermare distribuzione effettiva?",
                      `Carro ${payload.runId} → ${groupName(data, payload.groupId)}. Peso ${qty(payload.kg, "kg")}. Saldo previsto ${qty(selectedRun.remainingKg - payload.kg, "kg")}. Nessun nuovo prelievo di Magazzino.`,
                      async () => {
                        distributionAttempt.current = payload;
                        setDistributionFrozen(true);
                        try {
                          await distributeMutation.mutateAsync(payload);
                        } catch (error) {
                          if (definitiveFeedRejection(error)) {
                            distributionAttempt.current = null;
                            setDistributionFrozen(false);
                          }
                          throw error;
                        }
                        distributionAttempt.current = null;
                        setDistributionFrozen(false);
                        setSelectedRunId("");
                        setDistributedKg("");
                        setOtherAuthorized(false);
                        setDistributionKey(crypto.randomUUID());
                        await reload();
                      }
                    );
                  }}
                >
                  {distributionFrozen
                    ? "Riprova stessa distribuzione"
                    : "Conferma distribuzione"}
                </button>
                {distributionFrozen && (
                  <Hint>
                    Esito da verificare: riprova lo stesso peso e la stessa
                    chiave, anche se il saldo letto è cambiato.
                  </Hint>
                )}
                <RunLog
                  data={data}
                  run={selectedRun}
                  canSeeCosts={canSeeCosts}
                />
              </section>
            )}
            {selectedRunId && !selectedRun && (
              <Hint>
                Carro non disponibile nella lettura corrente. Aggiorna i dati
                prima di procedere.
              </Hint>
            )}
          </>
        )}

        {(area === "consumi" || area === "storico") && (
          <>
            <section
              className={`${PANEL} grid grid-cols-1 gap-3 sm:grid-cols-2`}
            >
              <Field label="Periodo">
                <select
                  className={INPUT}
                  value={period}
                  onChange={event => setPeriod(event.target.value as Period)}
                >
                  <option value="tutto">Tutto lo storico</option>
                  <option value="oggi">Oggi</option>
                  <option value="7">Ultimi 7 giorni</option>
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="365">Ultimo anno</option>
                  <option value="personalizzato">Personalizzato</option>
                </select>
              </Field>
              <Field label="Gruppo">
                <select
                  className={INPUT}
                  value={periodGroup}
                  onChange={event => setPeriodGroup(event.target.value)}
                >
                  <option value="">Tutti i gruppi</option>
                  {data.groups.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Alimento">
                <select
                  className={INPUT}
                  value={periodProduct}
                  onChange={event => setPeriodProduct(event.target.value)}
                >
                  <option value="">Tutti gli alimenti</option>
                  {data.products.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </Field>
              {period === "personalizzato" && (
                <>
                  <Field label="Dal">
                    <input
                      type="date"
                      className={INPUT}
                      value={fromDate}
                      onChange={event => setFromDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Al">
                    <input
                      type="date"
                      className={INPUT}
                      value={toDate}
                      onChange={event => setToDate(event.target.value)}
                    />
                  </Field>
                </>
              )}
            </section>
            {!periodBounds.valid && (
              <Hint danger>
                Periodo non valido: inserisci entrambe le date e una data finale
                non precedente a quella iniziale.
              </Hint>
            )}
            {periodBounds.valid && area === "consumi" && (
              <>
                {!consumptionRuns.length &&
                !consumptionDistributions.length &&
                !consumptionLeftovers.length ? (
                  <Hint>
                    Nessuna registrazione operativa nel periodo e nei filtri
                    selezionati. Non vengono mostrati consumi fittizi.
                  </Hint>
                ) : (
                  <>
                    {periodProduct && (
                      <Hint>
                        Il filtro alimento seleziona il prelievo fresco di
                        quell’alimento. Distribuzioni, avanzi e riutilizzi si
                        riferiscono ai carri che lo contengono, non al peso del
                        singolo ingrediente.
                      </Hint>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Stat
                        label="Prelievo fresco Magazzino"
                        value={qty(loadedKg, "kg")}
                      />
                      <Stat
                        label="Distribuito · peso razione"
                        value={qty(totalDistributed, "kg")}
                      />
                      <Stat
                        label="Avanzi registrati"
                        value={qty(
                          consumptionLeftovers.reduce(
                            (sum, item) => sum + item.kg,
                            0
                          ),
                          "kg"
                        )}
                      />
                      <Stat
                        label="Scartato"
                        value={qty(
                          consumptionLeftovers.reduce(
                            (sum, item) => sum + item.discardedKg,
                            0
                          ),
                          "kg"
                        )}
                      />
                      <Stat
                        label="Riutilizzato nei carichi"
                        value={qty(
                          consumptionRuns.reduce(
                            (sum, item) => sum + item.reusedKg,
                            0
                          ),
                          "kg"
                        )}
                      />
                      <Stat
                        label="Ingestione stimata · non misurata"
                        value={qty(ingestion, "kg")}
                      />
                      {canSeeCosts && (
                        <>
                          <Stat
                            label="Costo fresco prelevato · storico"
                            value={eur(
                              sumKnown(
                                consumptionRuns.flatMap(run =>
                                  run.ingredients
                                    .filter(
                                      line =>
                                        !periodProduct ||
                                        line.productId === periodProduct
                                    )
                                    .map(line =>
                                      line.costCents == null
                                        ? null
                                        : line.costCents / 100
                                    )
                                )
                              )
                            )}
                          />
                          <Stat
                            label="Costo distribuito · storico"
                            value={eur(
                              sumKnown(
                                consumptionDistributions.map(item =>
                                  item.costCents == null
                                    ? null
                                    : item.costCents / 100
                                )
                              )
                            )}
                          />
                        </>
                      )}
                    </div>
                    <Hint>
                      Prelievo, distribuito e ingerito non sono sinonimi.
                      L’ingestione è una stima di distribuito meno avanzi
                      collegati, disponibile solo se tutte le distribuzioni
                      selezionate hanno un avanzo registrato. I dati non
                      misurano l’ingestione effettiva. Periodi di carico,
                      distribuzione e avanzo possono differire.
                    </Hint>
                    <section className={`${PANEL} space-y-3`}>
                      <h3 className="font-semibold">
                        Prelievi freschi per alimento
                      </h3>
                      {Array.from(
                        new Set(
                          consumptionRuns.flatMap(run =>
                            run.ingredients.map(line => line.productId)
                          )
                        )
                      )
                        .filter(id => !periodProduct || id === periodProduct)
                        .map(id => {
                          const lines = consumptionRuns.flatMap(run =>
                            run.ingredients.filter(
                              line => line.productId === id
                            )
                          );
                          return (
                            <div
                              className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3"
                              key={id}
                            >
                              <span className="break-words">
                                {lines[0]?.nome ?? id}
                              </span>
                              <span>
                                {qty(
                                  lines.reduce(
                                    (sum, line) => sum + line.actualKg,
                                    0
                                  ),
                                  "kg"
                                )}
                                {canSeeCosts &&
                                  ` · ${eur(sumKnown(lines.map(line => (line.costCents == null ? null : line.costCents / 100))))}`}
                              </span>
                            </div>
                          );
                        })}
                    </section>
                    <section className={`${PANEL} space-y-3`}>
                      <h3 className="font-semibold">
                        Distribuito per gruppo destinatario
                      </h3>
                      {Array.from(
                        new Set(
                          consumptionDistributions.map(item => item.groupId)
                        )
                      ).map(id => (
                        <div
                          className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3"
                          key={id}
                        >
                          <span>{groupName(data, id)}</span>
                          <span>
                            {qty(
                              consumptionDistributions
                                .filter(item => item.groupId === id)
                                .reduce((sum, item) => sum + item.kg, 0),
                              "kg"
                            )}
                          </span>
                        </div>
                      ))}
                    </section>
                  </>
                )}
              </>
            )}
            {periodBounds.valid && area === "storico" && (
              <>
                {!filteredRuns.length && (
                  <Hint>
                    Nessun carro nel periodo selezionato. Cambia i filtri per
                    consultare registrazioni precedenti.
                  </Hint>
                )}
                {filteredRuns
                  .slice()
                  .sort((a, b) => b.at - a.at)
                  .map(run => (
                    <button
                      key={run.id}
                      disabled={pending || rectifyFrozen}
                      className={`${PANEL} w-full space-y-2 text-left ${historyRunId === run.id ? "border-green-500/70" : ""}`}
                      onClick={() => chooseHistory(run)}
                    >
                      <p className="break-words font-semibold">
                        {groupName(data, run.groupId)} ·{" "}
                        {run.recipeSnapshot.nome}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {dateTime(run.at)} · {run.state} · operatore{" "}
                        {run.operatorId}
                      </p>
                      <p>
                        {qty(run.totalKg, "kg")} totali ·{" "}
                        {qty(run.remainingKg, "kg")} residui
                      </p>
                      <p className="break-all text-xs text-zinc-500">
                        {run.id}
                      </p>
                    </button>
                  ))}
                {historyRun && (
                  <section className={`${PANEL} space-y-4`}>
                    <h3 className="text-xl font-semibold">
                      Snapshot storico del carro
                    </h3>
                    <p className="break-all text-sm text-zinc-400">
                      {historyRun.id} · {dateTime(historyRun.at)} · operatore{" "}
                      {historyRun.operatorId}
                    </p>
                    <p>
                      {groupName(data, historyRun.groupId)} ·{" "}
                      {qty(historyRun.headCount)} capi al carico
                    </p>
                    <p className="break-words">
                      Ricetta {historyRun.recipeSnapshot.nome} · versione{" "}
                      {historyRun.recipeSnapshot.version} · ID{" "}
                      {historyRun.recipeSnapshot.id}
                    </p>
                    <p className="text-sm text-zinc-400">
                      Responsabile:{" "}
                      {historyRun.recipeSnapshot.responsible ??
                        "Non registrato"}{" "}
                      · stato {historyRun.state}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat
                        label="Fresco storico"
                        value={qty(historyRun.freshKg, "kg")}
                      />
                      <Stat
                        label="Riutilizzo storico"
                        value={qty(historyRun.reusedKg, "kg")}
                      />
                      <Stat
                        label="Totale storico"
                        value={qty(historyRun.totalKg, "kg")}
                      />
                      {canSeeCosts && (
                        <Stat
                          label="Costo storico carro"
                          value={eur(
                            historyRun.totalCostCents == null
                              ? null
                              : historyRun.totalCostCents / 100
                          )}
                        />
                      )}
                    </div>
                    {historyRun.note && (
                      <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
                        {historyRun.note}
                      </p>
                    )}
                    <details className="rounded-xl border border-white/10 p-3">
                      <summary className="min-h-12 cursor-pointer py-3 font-semibold">
                        Animali dello snapshot ({historyRun.animalIds.length})
                      </summary>
                      <p className="break-words text-sm text-zinc-400">
                        {historyRun.animalIds.length
                          ? historyRun.animalIds.join(", ")
                          : "Identificativi non disponibili"}
                      </p>
                    </details>
                    <h4 className="font-semibold">
                      Ingredienti e analisi fissati al carico
                    </h4>
                    {!historyRun.ingredients.length && (
                      <Hint>
                        {historyRun.state === "preparazione"
                          ? "Bozza senza movimenti definitivi: i pesi non sono uno scarico."
                          : "Snapshot ingredienti non disponibile."}
                      </Hint>
                    )}
                    {historyRun.ingredients.map(line => (
                      <div
                        key={line.productId}
                        className="space-y-2 rounded-xl border border-white/10 p-3"
                      >
                        <p className="break-words font-semibold">{line.nome}</p>
                        <p className="text-sm">
                          Previsto {qty(line.expectedKg, "kg")} · effettivo{" "}
                          {qty(line.actualKg, "kg")}
                        </p>
                        <p className="text-sm text-zinc-400">
                          SS storica {qty(line.dryMatter, "%")} · analisi{" "}
                          {line.nirId ?? "non disponibile"}
                        </p>
                        {canSeeCosts && (
                          <p className="text-sm">
                            Prezzo storico{" "}
                            {eur(
                              line.unitCostCentsPerKg == null
                                ? null
                                : line.unitCostCentsPerKg / 100
                            )}
                            /kg · costo{" "}
                            {eur(
                              line.costCents == null
                                ? null
                                : line.costCents / 100
                            )}
                          </p>
                        )}
                        <p className="break-all text-xs text-zinc-500">
                          Movimento Magazzino:{" "}
                          {line.movementId ?? "Non disponibile"}
                        </p>
                        <details>
                          <summary className="min-h-12 cursor-pointer py-3 text-sm text-green-400">
                            Parametri nutrizionali dello snapshot
                          </summary>
                          {!Object.keys(line.params).length ? (
                            <p className="text-sm text-zinc-400">
                              Nessuna analisi nutrizionale disponibile al
                              momento del carico.
                            </p>
                          ) : (
                            Object.entries(line.params).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex flex-wrap justify-between gap-2 border-t border-white/10 py-2 text-sm"
                              >
                                <span className="break-words">{key}</span>
                                <span>
                                  {qty(value.value, value.unit)} · base{" "}
                                  {value.basis}
                                  {value.method ? ` · ${value.method}` : ""}
                                  {value.hours != null
                                    ? ` · ${value.hours} h`
                                    : ""}
                                </span>
                              </div>
                            ))
                          )}
                        </details>
                      </div>
                    ))}
                    {historyRun.leftoverId && (
                      <div className="rounded-xl bg-black p-3 text-sm">
                        <p className="break-all">
                          Avanzo incorporato: {historyRun.leftoverId}
                        </p>
                        <p>
                          {qty(historyRun.reusedKg, "kg")} · non scaricato una
                          seconda volta
                        </p>
                      </div>
                    )}
                    <RunLog
                      data={data}
                      run={historyRun}
                      canSeeCosts={canSeeCosts}
                    />
                    {canManage &&
                      (historyRun.state === "caricato" || rectifyFrozen) &&
                      (!data.distributions.some(
                        item => item.runId === historyRun.id
                      ) ||
                        rectifyFrozen) && (
                        <div className="space-y-3 rounded-xl border border-red-500/25 p-3">
                          <h4 className="font-semibold text-red-200">
                            Rettifica autorizzata · annullamento tracciato
                          </h4>
                          <Hint>
                            L’annullamento genera movimenti compensativi e
                            conserva l’audit. È consentito solo se nessuna
                            distribuzione effettiva è stata registrata.
                          </Hint>
                          <Field label="Motivazione obbligatoria · almeno 5 caratteri">
                            <textarea
                              className={`${INPUT} min-h-24 py-3`}
                              disabled={pending || rectifyFrozen}
                              maxLength={2000}
                              value={reason}
                              onChange={event => setReason(event.target.value)}
                            />
                          </Field>
                          <button
                            disabled={
                              pending ||
                              (!rectifyFrozen && reason.trim().length < 5)
                            }
                            className={`${SECONDARY} text-red-200`}
                            onClick={() => {
                              const payload = rectifyAttempt.current ?? {
                                key: crypto.randomUUID(),
                                runId: historyRun.id,
                                reason: reason.trim(),
                                confirm: true as const,
                              };
                              confirmation.ask(
                                "Confermare rettifica del carro?",
                                `Carro ${payload.runId}. Motivo: ${payload.reason}. Saranno conservati il carico originale e le compensazioni. Questa operazione è riservata ai responsabili.`,
                                async () => {
                                  rectifyAttempt.current = payload;
                                  setRectifyFrozen(true);
                                  try {
                                    await rectifyMutation.mutateAsync(payload);
                                  } catch (error) {
                                    if (definitiveFeedRejection(error)) {
                                      rectifyAttempt.current = null;
                                      setRectifyFrozen(false);
                                    }
                                    throw error;
                                  }
                                  rectifyAttempt.current = null;
                                  setRectifyFrozen(false);
                                  setReason("");
                                  await reload();
                                }
                              );
                            }}
                          >
                            {rectifyFrozen
                              ? "Riprova stessa rettifica"
                              : "Conferma rettifica con motivazione"}
                          </button>
                        </div>
                      )}
                    {historyRun.state === "annullato" && (
                      <Hint>
                        Carro annullato/rettificato. I movimenti e le note
                        storiche sono conservati; le quantità non sono
                        conteggiate come consumi attivi.
                      </Hint>
                    )}
                    {data.distributions.some(
                      item =>
                        item.runId === historyRun.id &&
                        !item.annulled &&
                        item.kg > 0
                    ) && (
                      <p className="text-sm text-zinc-400">
                        Rettifica del carico non disponibile: esistono
                        distribuzioni effettive.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {area === "frequenze" && (
          <>
            <Hint>
              Le frequenze sono basate sulle distribuzioni effettive, non sui
              soli carichi. Sono ammesse frequenze inferiori a un carro al
              giorno. Nessun valore iniziale viene inventato.
            </Hint>
            {!data.groups.length && (
              <Hint>Nessun gruppo aziendale configurabile.</Hint>
            )}
            {data.groups.map(item => {
              const mode = frequencyMode[item.id] ?? "daily";
              const number = feedNumber(frequencyInput[item.id] ?? "");
              const frequency =
                number == null || number <= 0
                  ? null
                  : mode === "interval"
                    ? 1 / number
                    : number;
              return (
                <section key={item.id} className={`${PANEL} space-y-3`}>
                  <h3 className="font-semibold">{item.nome}</h3>
                  <p className="text-sm text-zinc-400">
                    Attuale {qty(item.frequency, "carri/giorno")} · fonte{" "}
                    {item.frequencySource} · affidabilità{" "}
                    {item.frequencyReliability}
                  </p>
                  <p className="text-sm text-zinc-400">
                    Ultima:{" "}
                    {item.lastDistributionAt == null
                      ? "Non registrata"
                      : dateTime(item.lastDistributionAt)}{" "}
                    · prossima:{" "}
                    {item.nextDistributionAt == null
                      ? "Non calcolabile"
                      : dateTime(item.nextDistributionAt)}
                  </p>
                  {canManage && (
                    <>
                      <Field label="Modalità frequenza">
                        <select
                          className={INPUT}
                          disabled={pending}
                          value={mode}
                          onChange={event =>
                            setFrequencyMode(value => ({
                              ...value,
                              [item.id]: event.target.value as
                                | "daily"
                                | "interval",
                            }))
                          }
                        >
                          <option value="daily">Numero carri al giorno</option>
                          <option value="interval">
                            Un carro ogni N giorni
                          </option>
                        </select>
                      </Field>
                      <Field
                        label={
                          mode === "interval"
                            ? "Intervallo in giorni"
                            : "Carri al giorno · anche frazioni"
                        }
                      >
                        <input
                          className={INPUT}
                          inputMode="decimal"
                          disabled={pending}
                          value={frequencyInput[item.id] ?? ""}
                          onChange={event =>
                            setFrequencyInput(value => ({
                              ...value,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <p className="text-sm text-zinc-400">
                        Nuova media da confermare:{" "}
                        {qty(frequency, "carri/giorno")}
                      </p>
                      {frequency != null &&
                        (frequency < 0.1 || frequency > 12) && (
                          <Hint danger>
                            Il server accetta da 0,1 a 12 carri/giorno
                            (intervalli massimi di 10 giorni). Chiedi al
                            responsabile se servono frequenze fuori da questi
                            limiti.
                          </Hint>
                        )}
                      <button
                        className={ACTION}
                        disabled={
                          pending ||
                          frequency == null ||
                          !Number.isFinite(frequency) ||
                          frequency < 0.1 ||
                          frequency > 12
                        }
                        onClick={() =>
                          confirmation.ask(
                            "Configurare la frequenza?",
                            `${item.nome}: ${qty(frequency, "carri/giorno")}${mode === "interval" ? ` · un carro ogni ${qty(number)} giorni` : ""}. La fonte manuale sarà registrata; lo storico effettivo rimane distinto.`,
                            async () => {
                              if (frequency == null) return;
                              await frequencyMutation.mutateAsync({
                                groupId: item.id,
                                runsPerDay: frequency,
                                confirm: true,
                              });
                              await reload();
                            }
                          )
                        }
                      >
                        Conferma frequenza
                      </button>
                    </>
                  )}
                </section>
              );
            })}
            <section className={`${PANEL} space-y-4`}>
              <h3 className="font-semibold">
                Contenitori e calibrazioni reali
              </h3>
              <p className="text-sm text-zinc-400">
                Pesi netti in kg. Nessuna carriola, benna o capacità
                dimostrativa viene creata automaticamente.
              </p>
              {!data.containers.length && (
                <Hint>
                  Nessun contenitore configurato. La registrazione degli avanzi
                  rimane disponibile tramite peso diretto o zero esplicito.
                </Hint>
              )}
              {data.containers.map(item => (
                <div
                  className="space-y-2 rounded-xl border border-white/10 p-3"
                  key={item.id}
                >
                  <p>
                    {item.nome} · {qty(item.kg, "kg/pieno")}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {item.groupId
                      ? groupName(data, item.groupId)
                      : "Tutti i gruppi"}{" "}
                    ·{" "}
                    {item.recipeId
                      ? (data.recipes.find(
                          recipe => recipe.id === item.recipeId
                        )?.nome ?? `Ricetta ${item.recipeId}`)
                      : "Tutte le ricette"}{" "}
                    · {dateTime(item.calibratedAt)}
                  </p>
                  {(canManage ||
                    (canOperate &&
                      item.operatorId === data.permissions.userUuid)) && (
                    <button
                      disabled={pending}
                      className={SECONDARY}
                      onClick={() =>
                        setContainerEdit({
                          id: item.id,
                          nome: item.nome,
                          kg: String(item.kg),
                          groupId: item.groupId ?? "",
                          recipeId: item.recipeId ?? "",
                        })
                      }
                    >
                      Modifica calibrazione
                    </button>
                  )}
                </div>
              ))}
              {canOperate ? (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <h4 className="font-semibold">
                    {containerEdit.id
                      ? "Modifica contenitore"
                      : "Nuovo contenitore"}
                  </h4>
                  <Field label="Nome del contenitore">
                    <input
                      className={INPUT}
                      disabled={pending}
                      maxLength={255}
                      value={containerEdit.nome}
                      onChange={event =>
                        setContainerEdit(value => ({
                          ...value,
                          nome: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Peso netto pieno realmente misurato (kg)">
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      disabled={pending}
                      value={containerEdit.kg}
                      onChange={event =>
                        setContainerEdit(value => ({
                          ...value,
                          kg: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Calibrazione per gruppo">
                    <select
                      className={INPUT}
                      disabled={pending}
                      value={containerEdit.groupId}
                      onChange={event =>
                        setContainerEdit(value => ({
                          ...value,
                          groupId: event.target.value,
                          recipeId: "",
                        }))
                      }
                    >
                      <option value="">Aziendale · tutti i gruppi</option>
                      {data.groups.map(item => (
                        <option value={item.id} key={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Calibrazione per snapshot ricetta">
                    <select
                      className={INPUT}
                      disabled={pending}
                      value={containerEdit.recipeId}
                      onChange={event =>
                        setContainerEdit(value => ({
                          ...value,
                          recipeId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Tutte le ricette · verificare densità
                      </option>
                      {data.recipes
                        .filter(
                          item =>
                            !containerEdit.groupId ||
                            item.groupId === containerEdit.groupId
                        )
                        .map(item => (
                          <option value={item.id} key={item.id}>
                            {item.nome} · v{item.version}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={ACTION}
                      disabled={
                        pending ||
                        !containerEdit.nome.trim() ||
                        feedNumber(containerEdit.kg) == null ||
                        (feedNumber(containerEdit.kg) ?? 0) <= 0
                      }
                      onClick={() =>
                        confirmation.ask(
                          "Salvare la calibrazione misurata?",
                          `${containerEdit.nome.trim()}: ${qty(feedNumber(containerEdit.kg), "kg/pieno")}. Ambito ${containerEdit.groupId ? groupName(data, containerEdit.groupId) : "azienda"}. Verifica peso netto, ricetta e umidità: questo valore sarà proposto nelle registrazioni successive.`,
                          async () => {
                            const weight = feedNumber(containerEdit.kg);
                            if (weight == null || weight <= 0)
                              throw new Error("Peso non valido.");
                            await containerMutation.mutateAsync({
                              ...(containerEdit.id
                                ? { id: containerEdit.id }
                                : {}),
                              nome: containerEdit.nome.trim(),
                              kg: weight,
                              groupId: containerEdit.groupId || null,
                              recipeId: containerEdit.recipeId || null,
                              confirm: true,
                            });
                            setContainerEdit({
                              id: "",
                              nome: "",
                              kg: "",
                              groupId: "",
                              recipeId: "",
                            });
                            await reload();
                          }
                        )
                      }
                    >
                      Conferma calibrazione
                    </button>
                    {containerEdit.id && (
                      <button
                        disabled={pending}
                        className={SECONDARY}
                        onClick={() =>
                          setContainerEdit({
                            id: "",
                            nome: "",
                            kg: "",
                            groupId: "",
                            recipeId: "",
                          })
                        }
                      >
                        Nuovo contenitore
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <Hint>
                  Solo i responsabili possono configurare frequenze e
                  calibrazioni. Gli operatori possono utilizzare quelle già
                  registrate.
                </Hint>
              )}
            </section>
          </>
        )}
      </div>
      {confirmation.dialog}
    </FeedPage>
  );
}

function RunLog({
  data,
  run,
  canSeeCosts,
}: {
  data: FeedData;
  run: FeedRun;
  canSeeCosts: boolean;
}) {
  const distributions = data.distributions
    .filter(item => item.runId === run.id)
    .sort((a, b) => a.at - b.at);
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h4 className="font-semibold">Registro distribuzioni e avanzi</h4>
      {!distributions.length && (
        <p className="text-sm text-zinc-400">
          Nessuna distribuzione registrata per questo carro.
        </p>
      )}
      {distributions.map(item => {
        const leftovers = data.leftovers.filter(
          leftover => leftover.distributionId === item.id
        );
        return (
          <div
            className="space-y-2 rounded-xl border border-white/10 p-3"
            key={item.id}
          >
            <p className="break-words font-semibold">
              {groupName(data, item.groupId)} · {qty(item.kg, "kg")}
              {item.annulled ? " · annullata" : ""}
            </p>
            <p className="text-xs text-zinc-400">
              {dateTime(item.at)} · operatore {item.operatorId} ·{" "}
              {qty(item.headCount)} capi
            </p>
            {canSeeCosts && (
              <p className="text-sm">
                Costo storico attribuito:{" "}
                {eur(item.costCents == null ? null : item.costCents / 100)}
              </p>
            )}
            {item.note && (
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
                {item.note}
              </p>
            )}
            <p className="break-all text-xs text-zinc-500">
              Distribuzione {item.id}
            </p>
            {!leftovers.length && (
              <p className="text-sm text-orange-300">
                Avanzo non ancora registrato · non presumere zero
              </p>
            )}
            {leftovers.map(leftover => (
              <div
                className="space-y-1 border-t border-white/10 pt-2 text-sm"
                key={leftover.id}
              >
                <p>
                  Avanzo {qty(leftover.kg, "kg")} · {leftover.destination} ·
                  metodo {leftover.method}
                </p>
                {leftover.method === "contenitore" && (
                  <p className="text-zinc-400">
                    {qty(leftover.containerCount)} contenitori ×{" "}
                    {qty(leftover.containerWeightKg, "kg")} · peso storico della
                    calibrazione
                  </p>
                )}
                <p className="text-zinc-400">
                  Riutilizzato {qty(leftover.reusedKg, "kg")} · scartato{" "}
                  {qty(leftover.discardedKg, "kg")} · {dateTime(leftover.at)}
                </p>
                {leftover.note && (
                  <p className="whitespace-pre-wrap break-words">
                    {leftover.note}
                  </p>
                )}
                <p className="break-all text-xs text-zinc-500">
                  Avanzo {leftover.id} · operatore {leftover.operatorId}
                </p>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
