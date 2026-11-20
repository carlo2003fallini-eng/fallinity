import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Archive,
  CalendarClock,
  Check,
  Copy,
  Pencil,
  Plus,
  Wheat,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type {
  FeedData,
  FeedGroup,
  FeedProduct,
  FeedRecipe,
  RecipeIngredient,
  RecipeInput,
} from "@shared/feeding/types";
import { calculateRecipe } from "@shared/feeding/math";
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
  "min-h-12 min-w-12 rounded-xl border border-white/15 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 hover:border-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-40";
const ILLUSTRATIVE_GROUP_PHOTO = "/manus-storage/gruppi_81c45d0c.jpg";
const STATUS: Record<FeedRecipe["status"], string> = {
  salvata: "Salvata",
  attiva: "Attiva",
  programmata: "Programmata",
  archiviata: "Archiviata",
};
type QuantityView = "capo" | "gruppo" | "carro";
type IngredientDraft = { productId: string; quantity: string; note: string };
type RecipeDraft = {
  mode: "nuova" | "versione" | "copia";
  sourceId?: string;
  nome: string;
  responsible: string;
  note: string;
  ingredients: IngredientDraft[];
};

/** Un campo vuoto non è zero; si accetta anche la virgola decimale italiana. */
export function parseRecipeNumber(value: string): number | null {
  const text = value.trim();
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function validateRecipeDraft(
  draft: RecipeDraft,
  products: FeedProduct[]
): string[] {
  const errors: string[] = [];
  if (!draft.nome.trim()) errors.push("Inserire il nome della ricetta.");
  if (draft.nome.trim().length > 200)
    errors.push("Il nome della ricetta deve avere al massimo 200 caratteri.");
  if (!draft.ingredients.length)
    errors.push("Aggiungere almeno un alimento dal Magazzino.");
  const seen = new Set<string>();
  draft.ingredients.forEach((line, index) => {
    if (!products.some(product => product.id === line.productId))
      errors.push(
        `Ingrediente ${index + 1}: alimento non più disponibile nell'anagrafica Magazzino.`
      );
    if (seen.has(line.productId))
      errors.push(
        `Ingrediente ${index + 1}: alimento duplicato. Unire le quantità nella stessa riga.`
      );
    seen.add(line.productId);
    const amount = parseRecipeNumber(line.quantity);
    if (amount == null || amount <= 0)
      errors.push(
        `Ingrediente ${index + 1}: inserire kg tal quale per capo al giorno maggiori di zero.`
      );
  });
  return errors;
}

export function moveRecipeIngredient<T>(
  ingredients: T[],
  index: number,
  direction: -1 | 1
): T[] {
  const next = index + direction;
  if (
    index < 0 ||
    index >= ingredients.length ||
    next < 0 ||
    next >= ingredients.length
  )
    return ingredients;
  const result = [...ingredients];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

function recipeDraft(recipe?: FeedRecipe, copy = false): RecipeDraft {
  return {
    mode: recipe ? (copy ? "copia" : "versione") : "nuova",
    sourceId: recipe?.id,
    nome: recipe ? `${recipe.nome}${copy ? " — copia" : ""}` : "",
    responsible: recipe?.responsible ?? "",
    note: recipe?.note ?? "",
    ingredients: recipe
      ? [...recipe.ingredients]
          .sort((a, b) => a.order - b.order)
          .map(line => ({
            productId: line.productId,
            quantity: String(line.kgPerHead),
            note: line.note ?? "",
          }))
      : [],
  };
}

function draftIngredients(draft: RecipeDraft): RecipeIngredient[] {
  return draft.ingredients.map((line, order) => ({
    productId: line.productId,
    kgPerHead: parseRecipeNumber(line.quantity)!,
    order,
    ...(line.note.trim() ? { note: line.note.trim() } : {}),
  }));
}

function GroupPhoto({ group }: { group: FeedGroup }) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const illustrative = !group.foto || failed;
  return (
    <>
      {!fallbackFailed && (
        <img
          src={illustrative ? ILLUSTRATIVE_GROUP_PHOTO : group.foto!}
          alt={
            illustrative
              ? "Ambiente agricolo illustrativo"
              : `Foto del gruppo ${group.nome}`
          }
          onError={() =>
            illustrative ? setFallbackFailed(true) : setFailed(true)
          }
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
      {illustrative && (
        <span className="relative block text-[10px] font-medium text-zinc-200">
          {fallbackFailed ? "Foto non disponibile" : "Sfondo illustrativo"}
        </span>
      )}
    </>
  );
}

function ProductPhoto({ product }: { product?: FeedProduct }) {
  const [failed, setFailed] = useState(false);
  return product?.immagineUrl && !failed ? (
    <img
      src={product.immagineUrl}
      alt=""
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
    />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-950 text-green-400">
      <Wheat size={24} aria-hidden="true" />
    </span>
  );
}

function RecipeStatus({
  recipe,
  group,
}: {
  recipe: FeedRecipe;
  group: FeedGroup;
}) {
  const active = group.activeRecipeId === recipe.id;
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs ${active ? "border-green-500/40 bg-green-950 text-green-300" : recipe.status === "programmata" ? "border-orange-400/30 text-orange-300" : "border-white/15 text-zinc-300"}`}
    >
      {active
        ? "Ricetta attiva del gruppo"
        : recipe.status === "attiva"
          ? "Precedente attivazione"
          : recipe.status === "programmata" &&
              recipe.validFrom != null &&
              recipe.validFrom <= Date.now()
            ? "Programmazione precedente"
            : STATUS[recipe.status]}
    </span>
  );
}

function FrequencyInfo({ group }: { group: FeedGroup }) {
  const valid =
    group.frequency != null &&
    Number.isFinite(group.frequency) &&
    group.frequency > 0;
  return (
    <div className="space-y-2 text-sm">
      <p className={valid ? "text-green-300" : "text-orange-300"}>
        {valid
          ? `${qty(group.frequency)} carri/giorno`
          : "Configurare la frequenza: quantità per carro non calcolabile."}
      </p>
      <p className="break-words text-zinc-400">
        Fonte: {group.frequencySource || "Non disponibile"} · Affidabilità:{" "}
        {group.frequencyReliability || "Non disponibile"}
      </p>
      <p className="text-zinc-400">
        Ultima distribuzione:{" "}
        {group.lastDistributionAt != null
          ? dateTime(group.lastDistributionAt)
          : "Nessuna distribuzione registrata"}
      </p>
      <p className="text-zinc-400">
        Prossima prevista:{" "}
        {group.nextDistributionAt != null
          ? dateTime(group.nextDistributionAt)
          : "Previsione non disponibile"}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 break-words text-base font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function ProductFacts({
  product,
  canSeeCosts,
}: {
  product?: FeedProduct;
  canSeeCosts: boolean;
}) {
  if (!product)
    return (
      <p role="alert" className="text-sm text-red-300">
        Alimento non disponibile in Magazzino. Le quantità storiche restano
        visibili, ma questa ricetta va verificata prima di riutilizzarla.
      </p>
    );
  const validDm =
    product.dryMatter != null &&
    Number.isFinite(product.dryMatter) &&
    product.dryMatter >= 0 &&
    product.dryMatter <= 100;
  return (
    <div className="space-y-2 text-sm text-zinc-300">
      <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
        <p>
          Scorta:{" "}
          {product.quantityKg != null
            ? qty(product.quantityKg, "kg")
            : `${qty(product.quantity, product.unitaMisura ?? "")} · Conversione in kg mancante`}
        </p>
        <p>
          SS:{" "}
          {validDm ? qty(product.dryMatter, "% TQ") : "Dato non disponibile"}
        </p>
        <p>
          Autonomia aziendale:{" "}
          {["non_in_uso", "non in uso"].includes(
            product.autonomyStatus.trim().toLowerCase()
          )
            ? "Non in uso"
            : product.autonomyDays == null
              ? "Non ancora calcolabile"
              : qty(product.autonomyDays, "giorni")}
        </p>
        <p>
          NIR:{" "}
          {product.nirId
            ? "Analisi attiva collegata"
            : "Nessuna analisi attiva"}
        </p>
        {canSeeCosts && (
          <>
            <p>
              Costo unitario:{" "}
              {product.prezzoKg == null
                ? "Costo non disponibile"
                : `${eur(product.prezzoKg)}/kg TQ`}
            </p>
            <p className="break-words">
              Fonte costo: {product.costSource || "Non disponibile"}
            </p>
          </>
        )}
      </div>
      {product.quantityKg != null && product.quantityKg <= 0 && (
        <p className="text-orange-300">
          Scorta esaurita. Salvare una ricetta non movimenta il Magazzino; il
          carico effettivo richiede disponibilità.
        </p>
      )}
      <details className="rounded-xl border border-white/10 bg-black px-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-green-400">
          Parametri dell'analisi NIR attiva
        </summary>
        {product.nirId && Object.keys(product.params).length > 0 ? (
          <dl className="space-y-2 pb-3">
            {Object.entries(product.params).map(([key, nutrient]) => (
              <div key={key} className="grid grid-cols-2 gap-2">
                <dt className="break-words text-zinc-400">{key}</dt>
                <dd className="break-words">
                  {qty(nutrient.value, nutrient.unit)} · base {nutrient.basis}
                  {nutrient.method ? ` · ${nutrient.method}` : ""}
                  {nutrient.hours != null ? ` · ${qty(nutrient.hours)} h` : ""}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="pb-3 text-zinc-400">
            Parametri non disponibili. Registrare o attivare un'analisi in
            Alimenti e analisi alimenti.
          </p>
        )}
        <Link
          href="/alimentazione/alimenti"
          className="mb-2 inline-flex min-h-12 items-center text-green-400"
        >
          Apri Alimenti e analisi alimenti
        </Link>
      </details>
    </div>
  );
}

function RecipeCalculations({
  recipe,
  group,
  products,
  canSeeCosts,
  view,
  setView,
}: {
  recipe: FeedRecipe;
  group: FeedGroup;
  products: FeedProduct[];
  canSeeCosts: boolean;
  view: QuantityView;
  setView: (view: QuantityView) => void;
}) {
  const result = useMemo(
    () => calculateRecipe(recipe, group, products),
    [recipe, group, products]
  );
  const frequencyKnown =
    group.frequency != null &&
    Number.isFinite(group.frequency) &&
    group.frequency > 0;
  return (
    <section className="space-y-4" aria-label="Calcoli della razione">
      <p className="text-sm text-zinc-400">
        Stima corrente con {qty(group.nAnimali)} animali e analisi/scorte
        attuali del Magazzino. I carri già registrati conservano i propri
        snapshot storici.
      </p>
      {group.nAnimali === 0 && (
        <p className="rounded-xl border border-orange-400/20 bg-orange-950/20 p-3 text-sm text-orange-300">
          Il gruppo non contiene animali: quantità per gruppo pari a zero. La
          ricetta non registra alimentazione né carichi.
        </p>
      )}
      {!frequencyKnown && (
        <p className="rounded-xl border border-orange-400/20 bg-orange-950/20 p-3 text-sm text-orange-300">
          Configurare la frequenza del gruppo. Nessuna ipotesi automatica di un
          carro al giorno.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label="Tal quale / capo / giorno"
          value={qty(result.kgPerHead, "kg")}
        />
        <Metric
          label="Tal quale / gruppo / giorno"
          value={qty(result.kgPerDay, "kg")}
        />
        <Metric
          label="Tal quale / singolo carro"
          value={
            frequencyKnown
              ? qty(result.kgPerRun, "kg")
              : "Configurare frequenza"
          }
        />
        <Metric
          label="Sostanza secca / capo / giorno"
          value={qty(result.ssKgPerHead, "kg SS")}
        />
        <Metric
          label="Sostanza secca razione"
          value={qty(result.ssPercent, "% TQ")}
        />
        {canSeeCosts && (
          <>
            <Metric
              label="Costo / capo / giorno"
              value={eur(result.costPerHead)}
            />
            <Metric
              label="Costo / gruppo / giorno"
              value={eur(result.costPerDay)}
            />
          </>
        )}
      </div>
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Quantità ingredienti visualizzate"
      >
        {(["capo", "gruppo", "carro"] as const).map(value => (
          <button
            type="button"
            key={value}
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={view === value ? ACTION : SECONDARY}
          >
            Per {value}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400">
        Per capo e per gruppo: quantità giornaliere. Per carro: quantità
        giornaliera del gruppo divisa per carri/giorno. SS e costo per capo
        restano riferiti al giorno.
      </p>
      {!recipe.ingredients.length && (
        <p className={PANEL}>
          Nessun ingrediente in questa versione della ricetta.
        </p>
      )}
      {[...recipe.ingredients]
        .sort((a, b) => a.order - b.order)
        .map((ingredient, index) => {
          const product = products.find(
            item => item.id === ingredient.productId
          );
          const line = result.lines.find(
            item => item.productId === ingredient.productId
          );
          const quantity =
            view === "capo"
              ? (line?.kgPerHead ?? ingredient.kgPerHead)
              : view === "gruppo"
                ? line?.kgPerDay
                : line?.kgPerRun;
          const shortage =
            line?.kgPerRun != null &&
            product?.quantityKg != null &&
            line.kgPerRun > product.quantityKg;
          return (
            <article
              key={`${ingredient.productId}-${index}`}
              className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/50 p-3"
            >
              <div className="flex items-start gap-3">
                <ProductPhoto
                  key={product?.immagineUrl ?? ingredient.productId}
                  product={product}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400">
                    Sequenza di carico {index + 1}
                  </p>
                  <h3 className="break-words font-semibold text-white">
                    {product?.nome ??
                      `Alimento non disponibile (${ingredient.productId})`}
                  </h3>
                  <p className="mt-1 text-lg font-bold text-green-300">
                    {view === "carro" && !frequencyKnown
                      ? "Configurare frequenza"
                      : qty(quantity, "kg TQ")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm min-[390px]:grid-cols-2">
                <p>
                  Per capo/giorno:{" "}
                  {qty(line?.kgPerHead ?? ingredient.kgPerHead, "kg TQ")}
                </p>
                <p>Per gruppo/giorno: {qty(line?.kgPerDay, "kg TQ")}</p>
                <p>
                  Per carro:{" "}
                  {frequencyKnown
                    ? qty(line?.kgPerRun, "kg TQ")
                    : "Configurare frequenza"}
                </p>
                <p>SS/capo/giorno: {qty(line?.ssKgPerHead, "kg SS")}</p>
                {canSeeCosts && (
                  <p>
                    Costo nella razione/capo/giorno: {eur(line?.costPerHead)}
                  </p>
                )}
              </div>
              <ProductFacts product={product} canSeeCosts={canSeeCosts} />
              {shortage && (
                <p className="text-sm text-orange-300">
                  La scorta attuale non copre un carro previsto per questo
                  gruppo. Il carico effettivo verifica tutte le disponibilità.
                </p>
              )}
              {ingredient.note && (
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-400">
                  Nota di carico: {ingredient.note}
                </p>
              )}
            </article>
          );
        })}
    </section>
  );
}

function GroupWorkspace({
  data,
  group,
  refresh,
  onBack,
}: {
  data: FeedData;
  group: FeedGroup;
  refresh: () => Promise<unknown>;
  onBack: () => void;
}) {
  const confirmation = useFeedConfirm();
  const save = trpc.alimentazione.saveRecipe.useMutation();
  const activate = trpc.alimentazione.activateRecipe.useMutation();
  const archive = trpc.alimentazione.archiveRecipe.useMutation();
  const configure = trpc.alimentazione.configureFrequency.useMutation();
  const [selectedId, setSelectedId] = useState<string | null>(
    group.activeRecipeId
  );
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [view, setView] = useState<QuantityView>("capo");
  const [productId, setProductId] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [activationId, setActivationId] = useState<string | null>(null);
  const [activationMode, setActivationMode] = useState<"ora" | "futuro">("ora");
  const [activationDate, setActivationDate] = useState("");
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [frequencyMode, setFrequencyMode] = useState<
    "giornaliera" | "intervallo"
  >("giornaliera");
  const [frequencyValue, setFrequencyValue] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const canManage = data.permissions.canManage;
  const canSeeCosts = data.permissions.canSeeCosts;
  const pending =
    confirmation.pending ||
    save.isPending ||
    activate.isPending ||
    archive.isPending ||
    configure.isPending;
  const recipes = useMemo(
    () =>
      data.recipes
        .filter(recipe => recipe.groupId === group.id)
        .sort((a, b) => b.createdAt - a.createdAt || b.version - a.version),
    [data.recipes, group.id]
  );
  const visibleRecipes = showHistory
    ? recipes
    : recipes.filter(recipe => recipe.status !== "archiviata");
  const selected = recipes.find(recipe => recipe.id === selectedId);
  const activating = recipes.find(recipe => recipe.id === activationId);
  const active = recipes.find(recipe => recipe.id === group.activeRecipeId);
  const draftErrors = draft ? validateRecipeDraft(draft, data.products) : [];
  const previewRecipe = useMemo<FeedRecipe | null>(
    () =>
      draft && draftErrors.length === 0
        ? {
            id: draft.sourceId ?? "",
            rootId: "",
            groupId: group.id,
            nome: draft.nome.trim(),
            version: 0,
            status: "salvata",
            validFrom: null,
            createdAt: 0,
            updatedAt: 0,
            responsible: draft.responsible.trim() || null,
            note: draft.note.trim() || null,
            ingredients: draftIngredients(draft),
          }
        : null,
    [draft, group.id, draftErrors.length]
  );

  function startDraft(recipe?: FeedRecipe, copy = false) {
    if (!canManage || pending) return;
    setDraft(recipeDraft(recipe, copy));
    setDiscarding(false);
    setFormErrors([]);
    setProductId("");
    setActivationId(null);
    setActionError(null);
  }

  function updateIngredient(index: number, update: Partial<IngredientDraft>) {
    setDraft(current =>
      current
        ? {
            ...current,
            ingredients: current.ingredients.map((line, i) =>
              i === index ? { ...line, ...update } : line
            ),
          }
        : null
    );
    setFormErrors([]);
  }

  function addIngredient() {
    if (
      !draft ||
      !canManage ||
      !productId ||
      draft.ingredients.some(line => line.productId === productId) ||
      !data.products.some(product => product.id === productId)
    )
      return;
    setDraft({
      ...draft,
      ingredients: [
        ...draft.ingredients,
        { productId, quantity: "", note: "" },
      ],
    });
    setProductId("");
    setFormErrors([]);
  }

  async function refreshAfterMutation() {
    try {
      await refresh();
    } catch (error) {
      setActionError(
        `La modifica è stata salvata, ma l'elenco non è stato aggiornato. Non ripetere il salvataggio. Ricaricare i dati. ${error instanceof Error ? error.message : ""}`
      );
    }
  }

  function askSave() {
    if (!draft || !canManage || pending) return;
    const errors = validateRecipeDraft(draft, data.products);
    const source = draft.sourceId
      ? recipes.find(recipe => recipe.id === draft.sourceId)
      : undefined;
    if (
      draft.mode === "versione" &&
      (!source || source.status === "archiviata")
    )
      errors.push(
        "La versione di origine è mancante o archiviata. Riaprire una versione disponibile oppure duplicarla."
      );
    if (errors.length) {
      setFormErrors(errors);
      return;
    }
    const input: RecipeInput & { confirm: true } = {
      ...(draft.mode === "versione" ? { recipeId: draft.sourceId } : {}),
      groupId: group.id,
      nome: draft.nome.trim(),
      responsible: draft.responsible.trim() || null,
      note: draft.note.trim() || null,
      ingredients: draftIngredients(draft),
      confirm: true,
    };
    const lines = input.ingredients
      .map(
        (line, index) =>
          `${index + 1}. ${data.products.find(product => product.id === line.productId)!.nome}: ${qty(line.kgPerHead)} kg TQ/capo/giorno${line.note ? ` — ${line.note}` : ""}`
      )
      .join("\n");
    const modeText =
      draft.mode === "versione"
        ? `Nuova versione di «${source!.nome}», v${source!.version}. La versione precedente resta conservata.`
        : draft.mode === "copia"
          ? "Duplicazione come nuova ricetta indipendente. L'originale resta invariato."
          : "Creazione di una nuova ricetta.";
    confirmation.ask(
      "Conferma salvataggio ricetta",
      `${modeText}\nGruppo: ${group.nome} (${qty(group.nAnimali)} animali).\nRicetta: ${input.nome}\n${lines}\nResponsabile: ${input.responsible || "Non indicato"}\nNote: ${input.note || "Nessuna"}\nLa ricetta sarà salvata, non attivata. Nessun movimento di Magazzino.`,
      async () => {
        const result = await save.mutateAsync(input);
        setDraft(null);
        setSelectedId(result.id);
        setShowHistory(false);
        setFormErrors([]);
        await refreshAfterMutation();
      }
    );
  }

  function askActivation() {
    if (!canManage || !activating || pending) return;
    const errors = validateRecipeDraft(recipeDraft(activating), data.products);
    if (activating.status === "archiviata")
      errors.push(
        "Una ricetta archiviata non può essere attivata. Duplicarla prima."
      );
    if (errors.length) {
      setActionError(errors.join(" "));
      return;
    }
    if (activationMode === "futuro" && group.activeRecipeId === activating.id) {
      setActionError(
        "Questa versione è già attiva. Per una decorrenza futura, salvarne una nuova versione o duplicarla e programmare la versione salvata, senza spostare la decorrenza di quella corrente."
      );
      return;
    }
    const validFrom =
      activationMode === "futuro"
        ? new Date(activationDate).getTime()
        : undefined;
    if (
      activationMode === "futuro" &&
      (!activationDate ||
        !Number.isFinite(validFrom) ||
        validFrom! <= Date.now())
    ) {
      setActionError("Inserire una data e un'ora future valide.");
      return;
    }
    setActionError(null);
    confirmation.ask(
      activationMode === "futuro"
        ? "Conferma programmazione futura"
        : "Conferma attivazione ricetta",
      `Gruppo: ${group.nome}.\nRicetta: ${activating.nome}, versione ${activating.version}.\n${validFrom != null ? `Decorrenza: ${dateTime(validFrom)}. La ricetta attuale resta valida fino alla decorrenza.` : "Decorrenza immediata: sostituisce la ricetta attiva per i prossimi carichi."}\nI carri già registrati non cambiano. Nessuno scarico di Magazzino.`,
      async () => {
        if (validFrom != null && validFrom <= Date.now()) {
          throw new Error(
            "La decorrenza selezionata non è più futura. Annullare la conferma e scegliere una nuova data e ora."
          );
        }
        await activate.mutateAsync({
          id: activating.id,
          ...(validFrom != null ? { validFrom } : {}),
          confirm: true,
        });
        setActivationId(null);
        setActivationDate("");
        setSelectedId(activating.id);
        await refreshAfterMutation();
      }
    );
  }

  function askArchive(recipe: FeedRecipe) {
    if (!canManage || pending) return;
    confirmation.ask(
      "Conferma archiviazione ricetta",
      `Archiviare «${recipe.nome}», versione ${recipe.version}, del gruppo ${group.nome}?\n${group.activeRecipeId === recipe.id ? "È la ricetta attiva: il gruppo resterà senza questa versione attiva. Una precedente attivazione ancora valida potrebbe tornare effettiva: verificare la ricetta attiva dopo l'archiviazione, prima del prossimo carico.\n" : ""}La ricetta e i carichi storici non saranno eliminati. Nessun movimento di Magazzino.`,
      async () => {
        await archive.mutateAsync({ id: recipe.id, confirm: true });
        setShowHistory(true);
        setActivationId(null);
        await refreshAfterMutation();
      }
    );
  }

  function askFrequency() {
    if (!canManage || pending) return;
    const value = parseRecipeNumber(frequencyValue);
    const runsPerDay =
      value != null && value > 0
        ? frequencyMode === "intervallo"
          ? 1 / value
          : value
        : null;
    if (runsPerDay == null || !Number.isFinite(runsPerDay) || runsPerDay <= 0) {
      setActionError(
        "Inserire una frequenza o un intervallo strettamente maggiore di zero."
      );
      return;
    }
    setActionError(null);
    confirmation.ask(
      "Conferma frequenza del gruppo",
      `Gruppo: ${group.nome}.\n${frequencyMode === "intervallo" ? `Un carro ogni ${qty(value)} giorni: ` : ""}${qty(runsPerDay)} carri/giorno.\nConfigurazione manuale iniziale; lo storico delle distribuzioni effettive contribuirà alla frequenza rilevata.\nLe quantità previste per carro saranno ricalcolate. Nessun carico o distribuzione sarà registrato.`,
      async () => {
        await configure.mutateAsync({
          groupId: group.id,
          runsPerDay,
          confirm: true,
        });
        setFrequencyOpen(false);
        await refreshAfterMutation();
      }
    );
  }

  return (
    <div className="space-y-5 text-white">
      {confirmation.dialog}
      <button
        type="button"
        className={SECONDARY}
        onClick={onBack}
        disabled={pending || !!draft}
      >
        <ArrowLeft size={18} className="mr-2 inline" />
        Tutti i gruppi
      </button>
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold">{group.nome}</h2>
            <p className="mt-1 break-words text-sm text-zinc-400">
              {group.tipologia || "Tipologia non indicata"} ·{" "}
              {qty(group.nAnimali)} animali
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              className={ACTION}
              onClick={() => startDraft()}
              disabled={pending || !!draft}
            >
              <Plus size={18} className="mr-1 inline" />
              Nuova ricetta
            </button>
          )}
        </div>
        <p className="my-3 break-words text-sm">
          Ricetta attiva:{" "}
          <span className={active ? "text-green-300" : "text-orange-300"}>
            {active
              ? `${active.nome} · v${active.version}`
              : group.activeRecipeId
                ? "Riferimento non disponibile: verificare la configurazione"
                : "Nessuna ricetta attiva"}
          </span>
        </p>
        {!canManage && (
          <p className="mb-3 text-sm text-zinc-400">
            Modalità consultazione: non hai il permesso di gestire ricette e
            frequenze.
          </p>
        )}
        <FrequencyInfo group={group} />
        {!!group.overlaps.length && (
          <p className="mt-3 text-sm text-orange-300">
            Il gruppo contiene animali presenti anche in altri gruppi (
            {group.overlaps.length} sovrapposizioni). Verificare la composizione
            in Stalla prima dell'alimentazione.
          </p>
        )}
        {canManage && (
          <button
            type="button"
            className={`${SECONDARY} mt-3 w-full sm:w-auto`}
            disabled={pending || !!draft}
            aria-expanded={frequencyOpen}
            onClick={() => {
              setFrequencyOpen(!frequencyOpen);
              setFrequencyMode("giornaliera");
              setFrequencyValue(
                group.frequency != null && group.frequency > 0
                  ? String(group.frequency)
                  : ""
              );
              setActionError(null);
            }}
          >
            {frequencyOpen ? "Chiudi frequenza" : "Configura frequenza carri"}
          </button>
        )}
        {frequencyOpen && canManage && (
          <div className="mt-4 space-y-3 rounded-xl border border-green-600/30 bg-black p-3">
            <Field label="Modalità frequenza">
              <select
                className={INPUT}
                value={frequencyMode}
                disabled={pending}
                onChange={event => {
                  setFrequencyMode(event.target.value as typeof frequencyMode);
                  setFrequencyValue("");
                  setActionError(null);
                }}
              >
                <option value="giornaliera">Carri al giorno</option>
                <option value="intervallo">Un carro ogni N giorni</option>
              </select>
            </Field>
            <Field
              label={
                frequencyMode === "giornaliera"
                  ? "Numero carri/giorno (anche frazionario)"
                  : "Intervallo in giorni fra un carro e il successivo"
              }
            >
              <input
                className={INPUT}
                inputMode="decimal"
                value={frequencyValue}
                disabled={pending}
                onChange={event => {
                  setFrequencyValue(event.target.value);
                  setActionError(null);
                }}
                autoComplete="off"
              />
            </Field>
            <p className="text-xs text-zinc-400">
              Inserire il ritmo reale del gruppo. Nessun valore viene applicato
              senza conferma.
            </p>
            <button
              type="button"
              className={`${ACTION} w-full`}
              onClick={askFrequency}
              disabled={pending}
            >
              Rivedi e conferma frequenza
            </button>
          </div>
        )}
      </section>
      {actionError && (
        <div role="alert" className={`${PANEL} space-y-3 text-red-300`}>
          <p>{actionError}</p>
          <button
            type="button"
            className={SECONDARY}
            disabled={pending}
            onClick={() => {
              void refresh()
                .then(() => setActionError(null))
                .catch(error =>
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : "Aggiornamento non riuscito"
                  )
                );
            }}
          >
            Ricarica dati aziendali
          </button>
        </div>
      )}
      {draft ? (
        <section className={`${PANEL} space-y-4`} aria-label="Editor ricetta">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {draft.mode === "versione"
                ? "Modifica come nuova versione"
                : draft.mode === "copia"
                  ? "Duplica ricetta"
                  : "Nuova ricetta"}
            </h2>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => setDiscarding(true)}
              disabled={pending}
            >
              <X size={18} className="mr-1 inline" />
              Annulla modifiche
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            Gruppo: {group.nome}. Le modifiche restano locali fino alla conferma
            esplicita del salvataggio. Chiudere questa pagina prima del
            salvataggio le perde.
          </p>
          {draft.sourceId && (
            <p className="break-words text-sm text-zinc-400">
              Origine:{" "}
              {recipes.find(recipe => recipe.id === draft.sourceId)?.nome ??
                "Versione non più disponibile"}{" "}
              · v
              {recipes.find(recipe => recipe.id === draft.sourceId)?.version ??
                "—"}
            </p>
          )}
          {discarding && (
            <div className="space-y-3 rounded-xl border border-orange-400/30 p-3">
              <p className="text-sm text-orange-300">
                Scartare le modifiche non salvate? Nessun dato aziendale verrà
                modificato.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={SECONDARY}
                  onClick={() => setDiscarding(false)}
                >
                  Continua modifica
                </button>
                <button
                  type="button"
                  className={SECONDARY}
                  onClick={() => {
                    setDraft(null);
                    setDiscarding(false);
                    setFormErrors([]);
                  }}
                >
                  Scarta modifiche
                </button>
              </div>
            </div>
          )}
          <Field label="Nome della ricetta">
            <input
              className={INPUT}
              value={draft.nome}
              maxLength={200}
              disabled={pending || !canManage}
              onChange={event => {
                setDraft({ ...draft, nome: event.target.value });
                setFormErrors([]);
              }}
              autoComplete="off"
            />
          </Field>
          <Field label="Alimentarista responsabile (facoltativo)">
            <input
              className={INPUT}
              value={draft.responsible}
              disabled={pending || !canManage}
              onChange={event =>
                setDraft({ ...draft, responsible: event.target.value })
              }
              autoComplete="off"
            />
          </Field>
          <Field label="Note della ricetta (facoltative)">
            <textarea
              className={`${INPUT} min-h-24 py-3`}
              value={draft.note}
              disabled={pending || !canManage}
              onChange={event =>
                setDraft({ ...draft, note: event.target.value })
              }
            />
          </Field>
          <div className="space-y-3 rounded-xl border border-white/10 bg-black p-3">
            <h3 className="font-semibold">Ingredienti dal Magazzino</h3>
            {!data.products.length && (
              <p className="text-sm text-orange-300">
                Nessun alimento aziendale disponibile. Creare una materia prima
                in Magazzino e aggiornare l'elenco.
              </p>
            )}
            <Field label="Seleziona una materia prima esistente">
              <select
                className={INPUT}
                value={productId}
                disabled={pending || !canManage || !data.products.length}
                onChange={event => setProductId(event.target.value)}
              >
                <option value="">Seleziona alimento…</option>
                {[...data.products]
                  .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
                  .map(product => (
                    <option
                      key={product.id}
                      value={product.id}
                      disabled={draft.ingredients.some(
                        line => line.productId === product.id
                      )}
                    >
                      {product.nome}
                      {draft.ingredients.some(
                        line => line.productId === product.id
                      )
                        ? " — già aggiunto"
                        : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="button"
              className={`${ACTION} w-full`}
              disabled={pending || !canManage || !productId}
              onClick={addIngredient}
            >
              <Plus size={18} className="mr-1 inline" />
              Aggiungi ingrediente
            </button>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/magazzino"
                className={`${SECONDARY} inline-flex items-center text-green-400`}
              >
                Nuova materia prima in Magazzino
              </Link>
              <button
                type="button"
                className={SECONDARY}
                disabled={pending}
                onClick={() => {
                  void refresh().catch(error =>
                    setActionError(
                      error instanceof Error
                        ? error.message
                        : "Aggiornamento non riuscito"
                    )
                  );
                }}
              >
                Aggiorna alimenti
              </button>
            </div>
          </div>
          {!draft.ingredients.length && (
            <p className="text-sm text-zinc-400">
              Nessun ingrediente selezionato. Aggiungere alimenti e kg tal quale
              per capo al giorno.
            </p>
          )}
          {draft.ingredients.map((line, index) => {
            const product = data.products.find(
              item => item.id === line.productId
            );
            const invalid =
              parseRecipeNumber(line.quantity) == null ||
              (parseRecipeNumber(line.quantity) ?? 0) <= 0;
            return (
              <article
                key={`${line.productId}-${index}`}
                className="space-y-3 rounded-xl border border-white/10 bg-black p-3"
              >
                <div className="flex gap-3">
                  <ProductPhoto
                    key={product?.immagineUrl ?? line.productId}
                    product={product}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400">
                      Sequenza {index + 1} di {draft.ingredients.length}
                    </p>
                    <h3 className="break-words font-semibold">
                      {product?.nome ?? `Alimento mancante (${line.productId})`}
                    </h3>
                  </div>
                </div>
                <Field label="Kg tal quale per capo al giorno">
                  <input
                    className={INPUT}
                    value={line.quantity}
                    inputMode="decimal"
                    aria-invalid={invalid}
                    disabled={pending || !canManage}
                    onChange={event =>
                      updateIngredient(index, { quantity: event.target.value })
                    }
                    autoComplete="off"
                  />
                </Field>
                {invalid && (
                  <p className="text-xs text-orange-300">
                    Inserire una quantità positiva; un campo vuoto non equivale
                    a zero.
                  </p>
                )}
                <Field label="Nota di carico (facoltativa)">
                  <input
                    className={INPUT}
                    value={line.note}
                    disabled={pending || !canManage}
                    onChange={event =>
                      updateIngredient(index, { note: event.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className={`${SECONDARY} px-1 py-2 text-xs`}
                    disabled={pending || !canManage || index === 0}
                    aria-label={`Sposta ${product?.nome ?? "ingrediente"} prima nella sequenza`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        ingredients: moveRecipeIngredient(
                          draft.ingredients,
                          index,
                          -1
                        ),
                      })
                    }
                  >
                    <ArrowUp size={18} className="mx-auto mb-1 block" />
                    Prima
                  </button>
                  <button
                    type="button"
                    className={`${SECONDARY} px-1 py-2 text-xs`}
                    disabled={
                      pending ||
                      !canManage ||
                      index === draft.ingredients.length - 1
                    }
                    aria-label={`Sposta ${product?.nome ?? "ingrediente"} dopo nella sequenza`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        ingredients: moveRecipeIngredient(
                          draft.ingredients,
                          index,
                          1
                        ),
                      })
                    }
                  >
                    <ArrowDown size={18} className="mx-auto mb-1 block" />
                    Dopo
                  </button>
                  <button
                    type="button"
                    className={`${SECONDARY} px-1 py-2 text-xs`}
                    disabled={pending || !canManage}
                    aria-label={`Rimuovi ${product?.nome ?? "ingrediente"} dalla bozza`}
                    onClick={() => {
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.filter(
                          (_, i) => i !== index
                        ),
                      });
                      setFormErrors([]);
                    }}
                  >
                    <X size={18} className="mx-auto mb-1 block" />
                    Rimuovi
                  </button>
                </div>
                <ProductFacts product={product} canSeeCosts={canSeeCosts} />
              </article>
            );
          })}
          {formErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 p-3 text-sm text-red-300"
            >
              <ul className="list-inside list-disc space-y-1">
                {formErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {previewRecipe ? (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="font-semibold text-green-300">
                Anteprima calcolata — non ancora salvata
              </h3>
              <RecipeCalculations
                recipe={previewRecipe}
                group={group}
                products={data.products}
                canSeeCosts={canSeeCosts}
                view={view}
                setView={setView}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Anteprima non calcolabile: completare nome, ingredienti e quantità
              valide. Nessun dato nutrizionale mancante viene inventato.
            </p>
          )}
          {!canManage && (
            <p role="alert" className="text-orange-300">
              Il permesso di gestione non è più disponibile. Non è possibile
              salvare la bozza.
            </p>
          )}
          <button
            type="button"
            className={`${ACTION} w-full`}
            disabled={pending || !canManage}
            onClick={askSave}
          >
            Rivedi e salva{" "}
            {draft.mode === "versione" ? "nuova versione" : "ricetta"}
          </button>
        </section>
      ) : (
        <>
          <section className={`${PANEL} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Ricette del gruppo</h2>
              <button
                type="button"
                className={SECONDARY}
                aria-pressed={showHistory}
                onClick={() => setShowHistory(!showHistory)}
                disabled={pending}
              >
                {showHistory ? "Nascondi archiviate" : "Storico e archiviate"}
              </button>
            </div>
            <p className="text-sm text-zinc-400">
              Ogni modifica crea una nuova versione. Selezionare una versione
              per consultarne ingredienti, date e azioni.
            </p>
            {!visibleRecipes.length && (
              <p className="rounded-xl bg-black p-3 text-sm text-zinc-400">
                {recipes.length
                  ? "Tutte le ricette sono archiviate. Apri Storico e archiviate per consultarle o duplicarle."
                  : "Nessuna ricetta associata a questo gruppo."}
                {canManage
                  ? " Puoi creare una nuova ricetta dagli alimenti del Magazzino."
                  : " Un responsabile autorizzato può crearla."}
              </p>
            )}
            <div className="space-y-2">
              {visibleRecipes.map(recipe => (
                <button
                  type="button"
                  key={recipe.id}
                  aria-pressed={selectedId === recipe.id}
                  onClick={() => {
                    setSelectedId(recipe.id);
                    setActivationId(null);
                    setActionError(null);
                  }}
                  disabled={pending}
                  className={`min-h-12 w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${selectedId === recipe.id ? "border-green-500 bg-green-950/40" : "border-white/10 bg-black"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-semibold">
                      {recipe.nome} · v{recipe.version}
                    </span>
                    <RecipeStatus recipe={recipe} group={group} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    Creata: {dateTime(recipe.createdAt)}
                    {recipe.validFrom != null
                      ? ` · Decorrenza: ${dateTime(recipe.validFrom)}`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          </section>
          {selectedId && !selected && (
            <div role="alert" className={`${PANEL} text-orange-300`}>
              La ricetta selezionata non è più disponibile. Selezionare una
              versione dall'elenco aggiornato.
            </div>
          )}
          {selected && (
            <section className={`${PANEL} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 break-words text-xl font-bold">
                  {selected.nome} · v{selected.version}
                </h2>
                <RecipeStatus recipe={selected} group={group} />
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm text-zinc-300 min-[390px]:grid-cols-2">
                <div>
                  <dt className="text-zinc-400">Gruppo e animali attuali</dt>
                  <dd className="break-words">
                    {group.nome} · {qty(group.nAnimali)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Alimentarista responsabile</dt>
                  <dd className="break-words">
                    {selected.responsible || "Non indicato"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Data creazione</dt>
                  <dd>{dateTime(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Ultima modifica</dt>
                  <dd>{dateTime(selected.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Decorrenza</dt>
                  <dd>
                    {selected.validFrom != null
                      ? dateTime(selected.validFrom)
                      : "Non attivata / nessuna decorrenza"}
                  </dd>
                </div>
              </dl>
              {selected.note && (
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-400">
                  {selected.note}
                </p>
              )}
              {canManage && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {selected.status !== "archiviata" && (
                    <button
                      type="button"
                      className={SECONDARY}
                      onClick={() => startDraft(selected)}
                      disabled={pending}
                    >
                      <Pencil size={18} className="mr-1 inline" />
                      Modifica versione
                    </button>
                  )}
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => startDraft(selected, true)}
                    disabled={pending}
                  >
                    <Copy size={18} className="mr-1 inline" />
                    Duplica ricetta
                  </button>
                  {selected.status !== "archiviata" && (
                    <button
                      type="button"
                      className={ACTION}
                      onClick={() => {
                        setActivationId(selected.id);
                        setActivationMode(
                          group.activeRecipeId === selected.id
                            ? "futuro"
                            : "ora"
                        );
                        setActivationDate("");
                        setActionError(null);
                      }}
                      disabled={pending}
                    >
                      <CalendarClock size={18} className="mr-1 inline" />
                      Attiva / programma
                    </button>
                  )}
                  {selected.status !== "archiviata" && (
                    <button
                      type="button"
                      className={SECONDARY}
                      onClick={() => askArchive(selected)}
                      disabled={pending}
                    >
                      <Archive size={18} className="mr-1 inline" />
                      Archivia versione
                    </button>
                  )}
                </div>
              )}
              {selected.status === "archiviata" && (
                <p className="text-sm text-zinc-400">
                  Versione archiviata conservata per lo storico. Per
                  riutilizzarla, duplicarla e verificare ingredienti, NIR e
                  disponibilità attuali.
                </p>
              )}
              {activating && canManage && (
                <div
                  className="space-y-3 rounded-xl border border-green-600/30 bg-black p-3"
                  aria-label="Attivazione ricetta"
                >
                  <h3 className="break-words font-semibold">
                    Attivazione di {activating.nome} · v{activating.version}
                  </h3>
                  <Field label="Quando applicare la ricetta">
                    <select
                      className={INPUT}
                      value={activationMode}
                      disabled={pending}
                      onChange={event => {
                        setActivationMode(
                          event.target.value as typeof activationMode
                        );
                        setActionError(null);
                      }}
                    >
                      <option value="ora">Attiva subito</option>
                      <option value="futuro">
                        Programma una decorrenza futura
                      </option>
                    </select>
                  </Field>
                  {activationMode === "futuro" && (
                    <Field label="Data e ora future (ora locale)">
                      <input
                        type="datetime-local"
                        className={`${INPUT} max-w-full`}
                        value={activationDate}
                        disabled={pending}
                        onChange={event => {
                          setActivationDate(event.target.value);
                          setActionError(null);
                        }}
                      />
                    </Field>
                  )}
                  <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
                    <button
                      type="button"
                      className={SECONDARY}
                      disabled={pending}
                      onClick={() => {
                        setActivationId(null);
                        setActionError(null);
                      }}
                    >
                      Annulla attivazione
                    </button>
                    <button
                      type="button"
                      className={ACTION}
                      disabled={pending}
                      onClick={askActivation}
                    >
                      <Check size={18} className="mr-1 inline" />
                      Rivedi e conferma
                    </button>
                  </div>
                </div>
              )}
              <RecipeCalculations
                recipe={selected}
                group={group}
                products={data.products}
                canSeeCosts={canSeeCosts}
                view={view}
                setView={setView}
              />
              {recipes.filter(recipe => recipe.rootId === selected.rootId)
                .length > 1 && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <h3 className="font-semibold">
                    Versioni della stessa ricetta
                  </h3>
                  {recipes
                    .filter(recipe => recipe.rootId === selected.rootId)
                    .sort((a, b) => b.version - a.version)
                    .map(recipe => (
                      <button
                        type="button"
                        key={recipe.id}
                        disabled={pending}
                        className={`${SECONDARY} flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left`}
                        onClick={() => {
                          setSelectedId(recipe.id);
                          if (recipe.status === "archiviata")
                            setShowHistory(true);
                          setActivationId(null);
                          setActionError(null);
                        }}
                      >
                        <span className="break-words">
                          {recipe.nome} · v{recipe.version}
                        </span>
                        <RecipeStatus recipe={recipe} group={group} />
                        <span className="w-full text-xs text-zinc-400">
                          {dateTime(recipe.createdAt)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RazioniContent({
  data,
  refresh,
}: {
  data: FeedData;
  refresh: () => Promise<unknown>;
}) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const group = data.groups.find(item => item.id === groupId);
  if (group)
    return (
      <GroupWorkspace
        key={group.id}
        data={data}
        group={group}
        refresh={refresh}
        onBack={() => setGroupId(null)}
      />
    );
  return (
    <div className="space-y-4 text-white">
      {groupId && (
        <div role="alert" className={`${PANEL} text-orange-300`}>
          Il gruppo selezionato non è più disponibile. Selezionare un gruppo
          attuale.
        </div>
      )}
      <section className={PANEL}>
        <h2 className="font-semibold">Gruppi aziendali</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Fonte unica: Stalla → Gruppi. Animali e ricette si aggiornano dai dati
          aziendali. Seleziona un gruppo per gestire la razione.
        </p>
      </section>
      {!data.groups.length ? (
        <section className={`${PANEL} space-y-3`}>
          <p>Nessun gruppo presente in Stalla.</p>
          <p className="text-sm text-zinc-400">
            Prima di creare una ricetta occorre configurare un gruppo reale e
            associarvi gli animali.
          </p>
          <Link
            href="/stalla/gruppi"
            className={`${SECONDARY} inline-flex items-center text-green-400`}
          >
            Apri Stalla → Gruppi
          </Link>
        </section>
      ) : (
        <div
          className="grid grid-cols-2 gap-3"
          aria-label="Gruppi aziendali per razioni"
        >
          {data.groups.map(item => {
            const active = data.recipes.find(
              recipe =>
                recipe.id === item.activeRecipeId && recipe.groupId === item.id
            );
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setGroupId(item.id)}
                className="relative flex min-h-52 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 active:scale-[.98]"
              >
                <GroupPhoto
                  key={`${item.id}-${item.foto ?? "illustrativa"}`}
                  group={item}
                />
                <div className="relative mt-auto space-y-1 pt-10">
                  <h2 className="break-words text-base font-bold text-white sm:text-lg">
                    {item.nome}
                  </h2>
                  <p className="break-words text-xs text-zinc-200">
                    {item.tipologia || "Tipologia non indicata"}
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {qty(item.nAnimali)} animali
                  </p>
                  <p
                    className={`break-words text-xs ${active ? "text-green-300" : "text-orange-300"}`}
                  >
                    {active
                      ? `Attiva: ${active.nome} · v${active.version}`
                      : item.activeRecipeId
                        ? "Ricetta attiva non disponibile"
                        : "Nessuna ricetta attiva"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Razioni() {
  const feed = useFeed();
  return (
    <FeedPage title="Razioni">
      <FeedStatus query={feed} />
      {feed.error && (
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            void feed.refetch();
          }}
        >
          Riprova caricamento
        </button>
      )}
      {!feed.isLoading && !feed.error && !feed.data && (
        <div role="status" className={`${PANEL} text-zinc-300`}>
          Dati aziendali non disponibili. Verificare accesso e azienda
          selezionata.
        </div>
      )}
      {!feed.isLoading &&
        !feed.error &&
        feed.data &&
        (feed.data.permissions.canView ? (
          <RazioniContent
            key={feed.data.permissions.companyId}
            data={feed.data}
            refresh={feed.refresh}
          />
        ) : (
          <div role="alert" className={`${PANEL} text-orange-300`}>
            Non hai il permesso di consultare l'alimentazione di questa azienda.
          </div>
        ))}
    </FeedPage>
  );
}
