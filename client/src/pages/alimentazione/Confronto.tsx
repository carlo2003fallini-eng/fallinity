import { useMemo, useState } from "react";
import { Link } from "wouter";
import { History, Package, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { calculateComparison } from "@shared/feeding/math";
import type {
  ComparisonSide,
  FeedComparison,
  FeedData,
  FeedProduct,
} from "@shared/feeding/types";
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
import {
  NIR_FIELDS,
  NutrientEditor,
  autonomyLabel,
  completeNirParams,
  nirValidation,
  nutrientText,
} from "./Alimenti";

type ComparisonResult = ReturnType<typeof calculateComparison>;
type AiResponse = {
  answer: string;
  sources: string[];
  missing: string[];
  context: string;
};
export function companyComparisonSide(
  product: FeedProduct,
  data: Pick<FeedData, "nirAnalyses">,
  costs: boolean
): ComparisonSide {
  const nir = data.nirAnalyses.find(item => item.id === product.nirId);
  return {
    productId: product.id,
    nome: product.nome,
    pricePerQuintal:
      costs && product.prezzoKg != null ? product.prezzoKg * 100 : null,
    params: product.params,
    source: `Magazzino · ${product.costSource || "Costo non disponibile"}${product.nirId ? ` · NIR ${product.nirId}` : " · NIR attiva mancante"}`,
    nirId: product.nirId,
    supplier: product.fornitore,
    lot: nir?.lot ?? null,
  };
}
const emptyOffer = (): ComparisonSide => ({
  productId: null,
  nome: "",
  pricePerQuintal: null,
  params: completeNirParams(),
  source: "Offerta non acquistata · dati inseriti manualmente",
  supplier: null,
  lot: null,
  nirId: null,
});
export function comparableSavedResult(
  value: unknown
): value is ComparisonResult {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const nullableNumber = (n: unknown) =>
    n === null || (typeof n === "number" && Number.isFinite(n));
  return (
    Array.isArray(item.nutrients) &&
    item.nutrients.every(
      row =>
        row &&
        typeof row === "object" &&
        typeof row.key === "string" &&
        typeof row.label === "string" &&
        typeof row.unit === "string" &&
        nullableNumber(row.left) &&
        nullableNumber(row.right) &&
        (row.warning == null || typeof row.warning === "string")
    ) &&
    Array.isArray(item.economic) &&
    item.economic.every(
      row =>
        row &&
        typeof row === "object" &&
        typeof row.key === "string" &&
        typeof row.label === "string" &&
        nullableNumber(row.left) &&
        nullableNumber(row.right) &&
        nullableNumber(row.diffPercent)
    ) &&
    nullableNumber(item.equivalentPrice) &&
    Array.isArray(item.warnings) &&
    item.warnings.every(warning => typeof warning === "string")
  );
}
const quickQuestions = [
  "Quale prodotto conviene?",
  "Quale prezzo dovrei trattare?",
  "Come cambia l’apporto di amido?",
  "Valuta la qualità della fibra",
  "Come cambierebbe il costo alimentare?",
  "Quali dati mancano per decidere?",
];
function SidePhoto({
  product,
  label,
}: {
  product?: FeedProduct;
  label: string;
}) {
  return product?.immagineUrl ? (
    <img
      src={product.immagineUrl}
      alt={product.nome}
      loading="lazy"
      className="mb-3 h-24 w-full rounded-xl object-cover sm:h-36"
    />
  ) : (
    <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-black sm:h-36">
      <Package
        className="text-zinc-500"
        size={30}
        aria-label={`Foto non disponibile: ${label}`}
      />
    </div>
  );
}
function SideDetails({
  side,
  product,
  costs,
  historic,
}: {
  side: ComparisonSide | null;
  product?: FeedProduct;
  costs: boolean;
  historic: boolean;
}) {
  if (!side)
    return <p className="py-3 text-sm text-zinc-400">Seleziona un alimento.</p>;
  return (
    <div className="space-y-3 text-sm">
      <h3 className="break-words font-semibold text-white">
        {side.nome || "Nome da inserire"}
      </h3>
      {costs && (
        <div>
          <p className="text-zinc-400">
            {historic
              ? "Prezzo dello snapshot"
              : side.productId
                ? "Costo medio effettivo (sola lettura)"
                : "Prezzo offerto"}
          </p>
          <p className="text-white">
            {eur(side.pricePerQuintal)}
            {side.pricePerQuintal != null ? " / q TQ" : ""}
          </p>
        </div>
      )}
      {product && !historic && (
        <div>
          <p className="text-zinc-400">Scorta attuale</p>
          <p className="text-white">
            {qty(product.quantity, product.unitaMisura ?? "unità non indicata")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{autonomyLabel(product)}</p>
        </div>
      )}
      {historic && (
        <p className="text-xs text-zinc-400">
          La giacenza storica non fa parte dello snapshot del confronto. I dati
          di Magazzino correnti non sostituiscono quelli salvati.
        </p>
      )}
      <p className="break-words text-zinc-400">
        Fornitore: {side.supplier || "Non indicato"}
        <br />
        Lotto: {side.lot || "Non indicato"}
      </p>
      <p className="break-words text-xs text-zinc-400">
        Fonte: {side.source || "Non indicata"}
      </p>
      {side.productId && (
        <Link
          href="/alimentazione/alimenti"
          className="inline-flex min-h-12 items-center break-words text-green-400 underline"
        >
          Collegato ad Alimenti / Magazzino
        </Link>
      )}
    </div>
  );
}
function ComparisonBars({ result }: { result: ComparisonResult }) {
  return (
    <div className="space-y-4">
      {result.nutrients.map(row => {
        const maximum = Math.max(row.left ?? 0, row.right ?? 0);
        const width = (value: number | null) =>
          value == null || !Number.isFinite(value) || maximum <= 0
            ? "0%"
            : `${Math.min(100, Math.max(0, (value / maximum) * 100))}%`;
        return (
          <div key={row.key} className="rounded-xl bg-black p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-medium text-white">{row.label}</h3>
              <span className="text-xs text-zinc-400">{row.unit}</span>
            </div>
            <div className="mt-3 space-y-3">
              {(
                [
                  { label: "Attuale", value: row.left, color: "bg-zinc-500" },
                  {
                    label: "Proposto",
                    value: row.right,
                    color: "bg-green-500",
                  },
                ] as const
              ).map(side => (
                <div key={side.label}>
                  <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs text-zinc-300">
                    <span>{side.label}</span>
                    <span>{qty(side.value, row.unit)}</span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-zinc-900"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full rounded-full ${side.color}`}
                      style={{ width: width(side.value) }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {row.warning && (
              <p className="mt-2 text-xs text-orange-300">{row.warning}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Confronto() {
  const feed = useFeed();
  const confirm = useFeedConfirm();
  const [initialParams] = useState(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search
      )
  );
  const [leftId, setLeftId] = useState(initialParams.get("productId") ?? "");
  const [rightMode, setRightMode] = useState<"nuovo" | "azienda" | "salvato">(
    "nuovo"
  );
  const [rightId, setRightId] = useState("");
  const [trialId, setTrialId] = useState("");
  const [offer, setOffer] = useState<ComparisonSide>(emptyOffer);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [includeAi, setIncludeAi] = useState(false);
  const [ai, setAi] = useState<AiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = trpc.alimentazione.saveComparison.useMutation();
  const intelligence = trpc.alimentazione.intelligence.useMutation();
  const data = feed.data;
  const costs = data?.permissions.canSeeCosts ?? false;
  const canNir = data?.permissions.canNir ?? false;
  const canAi = data?.permissions.canOperate ?? false;
  const canSave = data?.permissions.canNir ?? false;
  const history = data?.comparisons.find(item => item.id === historyId);
  const historical = !!historyId;
  const leftProduct = data?.products.find(item => item.id === leftId);
  const rightProduct = data?.products.find(item => item.id === rightId);
  const savedTrial = data?.comparisons.find(item => item.id === trialId);
  const left = useMemo<ComparisonSide | null>(
    () =>
      history
        ? {
            ...history.left,
            pricePerQuintal: costs ? history.left.pricePerQuintal : null,
          }
        : !historical && leftProduct && data
          ? companyComparisonSide(leftProduct, data, costs)
          : null,
    [history, costs, historical, leftProduct, data]
  );
  const right = useMemo<ComparisonSide | null>(() => {
    if (history)
      return {
        ...history.right,
        pricePerQuintal: costs ? history.right.pricePerQuintal : null,
      };
    if (historical) return null;
    if (rightMode === "azienda")
      return rightProduct && data
        ? companyComparisonSide(rightProduct, data, costs)
        : null;
    if (rightMode === "salvato")
      return savedTrial
        ? {
            ...savedTrial.right,
            productId: null,
            pricePerQuintal: costs ? savedTrial.right.pricePerQuintal : null,
            source: `Snapshot confronto ${savedTrial.id} · ${savedTrial.right.source}`,
          }
        : null;
    return { ...offer, pricePerQuintal: costs ? offer.pricePerQuintal : null };
  }, [
    history,
    costs,
    historical,
    rightMode,
    rightProduct,
    data,
    savedTrial,
    offer,
  ]);
  const calculated = useMemo(
    () => (left && right ? calculateComparison(left, right) : null),
    [left, right]
  );
  const result =
    history && comparableSavedResult(history.results)
      ? costs
        ? history.results
        : { ...history.results, economic: [], equivalentPrice: null }
      : calculated;
  const context = useMemo(
    () => (left && right ? JSON.stringify({ left, right }) : ""),
    [left, right]
  );
  const currentAi = ai?.context === context ? ai : null;
  const activeProductIds = new Set(
    (data?.recipes ?? [])
      .filter(recipe => recipe.status === "attiva")
      .flatMap(recipe => recipe.ingredients.map(item => item.productId))
  );
  const orderedProducts = [...(data?.products ?? [])].sort(
    (a, b) =>
      Number(activeProductIds.has(b.id)) - Number(activeProductIds.has(a.id)) ||
      a.nome.localeCompare(b.nome, "it")
  );
  const orderedHistory = [...(data?.comparisons ?? [])].sort(
    (a, b) => b.at - a.at
  );
  const busy = confirm.pending || save.isPending || intelligence.isPending;
  const ready = !!left && !!right && !!right.nome.trim();
  function resetFeedback() {
    setIncludeAi(false);
    setError(null);
    setAi(null);
  }
  function openHistory(item: FeedComparison) {
    setHistoryId(item.id);
    setParentId(null);
    setQuestion("");
    resetFeedback();
  }
  function newComparison() {
    setHistoryId(null);
    setParentId(null);
    setNotes("");
    setLeftId("");
    setRightId("");
    setTrialId("");
    setRightMode("nuovo");
    setOffer(emptyOffer());
    setQuestion("");
    resetFeedback();
  }
  function newVersion() {
    if (!history || !data) return;
    const currentLeft = data.products.find(
      item => item.id === history.left.productId
    );
    if (!currentLeft) {
      setError(
        "L’alimento attuale dello snapshot non è più disponibile nell’anagrafica aziendale. È possibile consultare lo storico, non ricalcolarlo con dati correnti."
      );
      return;
    }
    const currentRight = data.products.find(
      item => item.id === history.right.productId
    );
    setLeftId(currentLeft.id);
    if (currentRight) {
      setRightMode("azienda");
      setRightId(currentRight.id);
    } else {
      setRightMode("nuovo");
      setOffer({
        ...history.right,
        productId: null,
        nirId: null,
        source: `Offerta ripresa dal confronto ${history.id} · ${history.right.source}`,
      });
    }
    setNotes(history.notes ?? "");
    setParentId(history.id);
    setHistoryId(null);
    resetFeedback();
  }
  function requestSave() {
    if (!left || !right || !ready || !canSave || historical || busy) return;
    const problems = [
      ...nirValidation(left.params),
      ...nirValidation(right.params),
    ];
    if (!right.source.trim())
      problems.push("Indica la provenienza dei dati del proposto.");
    if (!left.productId)
      problems.push(
        "Il prodotto attuale deve essere selezionato da Magazzino."
      );
    if (right.nome.trim().length > 255)
      problems.push(
        "Il nome del proposto deve contenere al massimo 255 caratteri."
      );
    if (
      right.pricePerQuintal != null &&
      (!Number.isFinite(right.pricePerQuintal) || right.pricePerQuintal < 0)
    )
      problems.push(
        "Il prezzo offerto deve essere un numero finito non negativo."
      );
    if (rightMode === "nuovo" && !canNir)
      problems.push(
        "Per inserire una nuova analisi di offerta serve l’autorizzazione NIR."
      );
    if (problems.length) {
      setError(problems.join("\n"));
      return;
    }
    const payload = {
      ...(parentId ? { id: parentId } : {}),
      left,
      right: { ...right, nome: right.nome.trim() },
      notes: notes.trim() || undefined,
      ai:
        currentAi && includeAi
          ? `${currentAi.answer}\n\nFonti: ${currentAi.sources.join("; ")}\nDati mancanti: ${currentAi.missing.join("; ")}`.slice(
              0,
              2000
            )
          : undefined,
      confirm: true as const,
    };
    confirm.ask(
      parentId ? "Salvare una nuova versione?" : "Salvare questo confronto?",
      `${left.nome} → ${right.nome}\n${currentAi && includeAi ? "Includi la risposta IA (primi 12.000 caratteri, limite API).\n" : ""}${costs ? `Attuale: ${eur(left.pricePerQuintal)} / q TQ · Proposto: ${eur(right.pricePerQuintal)} / q TQ\n` : ""}Conserva prezzi, analisi, risultati e note come snapshot storico. Il lato attuale verrà riletto dal server alla conferma. Non genera acquisti, spese, ricette o movimenti di Magazzino.${parentId ? " Il confronto precedente non verrà sovrascritto." : ""}`,
      async () => {
        const saved = await save.mutateAsync(payload);
        await feed.refresh();
        setHistoryId(saved.id);
        setParentId(null);
      }
    );
  }
  function askAi(value: string) {
    if (!ready || !left || !right || busy || !canAi) return;
    const questionValue = value.trim();
    if (!questionValue || questionValue.length > 2000) {
      setError("Inserisci una domanda da 1 a 2.000 caratteri.");
      return;
    }
    const requestedContext = context;
    const comparison = { left, right };
    confirm.ask(
      "Chiedere a Fallinity Intelligence?",
      `${questionValue}\n\nL’IA leggerà questi prodotti e i dati reali della tua azienda nel rispetto dei permessi. Non modifica analisi, ricette o Magazzino. I suggerimenti vanno verificati con l’alimentarista.${historical ? " Il server rilegge i dati aziendali correnti: la risposta non è una ricostruzione della situazione storica." : ""}`,
      async () => {
        const response = await intelligence.mutateAsync({
          question: questionValue,
          comparison,
        });
        setAi({ ...response, context: requestedContext });
        setIncludeAi(false);
        setQuestion(questionValue);
        setError(null);
      }
    );
  }
  const relevantRecipes =
    data?.recipes.filter(
      recipe =>
        recipe.status === "attiva" &&
        recipe.ingredients.some(
          item =>
            item.productId === left?.productId ||
            item.productId === right?.productId
        )
    ) ?? [];
  const missing =
    result?.nutrients
      .filter(row => row.left == null || row.right == null)
      .map(row => `${row.label}: ${row.warning ?? "Dato non disponibile"}`) ??
    [];
  return (
    <FeedPage
      title="Confronto prodotti alimentari"
      back="/alimentazione/alimenti"
    >
      {confirm.dialog}
      <FeedStatus query={feed} />
      {!feed.isLoading && !feed.error && !data && (
        <div className={PANEL}>
          Dati non disponibili. Seleziona un’azienda autorizzata.
        </div>
      )}
      {data && !data.permissions.canView && (
        <div role="alert" className={PANEL}>
          Non sei autorizzato a consultare i confronti.
        </div>
      )}
      {data?.permissions.canView && (
        <>
          <p className="text-sm text-zinc-400">
            Un confronto non crea un alimento, un acquisto o una modifica alla
            razione. Il prezzo attuale e l’analisi attiva provengono dalle fonti
            aziendali, senza reinserimento manuale.
          </p>
          <details
            id="confronti-salvati"
            open={initialParams.get("storico") === "1" || historical}
            className={PANEL}
          >
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-white">
              <History size={18} className="text-green-400" />
              Confronti salvati ({orderedHistory.length})
            </summary>
            <div className="mt-3 space-y-3">
              {!orderedHistory.length ? (
                <p className="text-sm text-zinc-400">
                  Nessun confronto salvato in questa azienda.
                </p>
              ) : (
                orderedHistory.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    className={`block min-h-12 w-full rounded-xl border bg-black p-3 text-left focus-visible:ring-2 focus-visible:ring-green-500 ${historyId === item.id ? "border-green-500" : "border-white/10"}`}
                    onClick={() => openHistory(item)}
                  >
                    <p className="break-words text-sm font-medium text-white">
                      {item.left.nome} → {item.right.nome}
                    </p>
                    <p className="mt-1 break-words text-xs text-zinc-400">
                      {dateTime(item.at)} ·{" "}
                      {item.parentId
                        ? `Versione del confronto ${item.parentId}`
                        : "Versione iniziale"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </details>
          {historical && !history && (
            <div role="alert" className={PANEL}>
              Il confronto selezionato non è disponibile. Nessuno snapshot viene
              sostituito con dati correnti.
              <button
                type="button"
                className={`${ACTION} mt-3`}
                onClick={newComparison}
              >
                Nuovo confronto
              </button>
            </div>
          )}
          {history && (
            <div className={`${PANEL} space-y-3 border-green-500/30`}>
              <h2 className="font-semibold text-green-400">
                Snapshot storico · {dateTime(history.at)}
              </h2>
              <p className="text-sm text-zinc-300">
                Prezzi, analisi e fonti originali, in sola lettura. Per
                aggiornarli usa «Crea nuova versione»: l’originale rimane
                conservato.
              </p>
              {!comparableSavedResult(history.results) && (
                <p className="text-sm text-orange-300">
                  Risultati salvati non disponibili nel formato corrente:
                  grafici ricalcolati esclusivamente dai valori originali dello
                  snapshot.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={ACTION}
                  disabled={busy || !canSave}
                  onClick={newVersion}
                >
                  Crea nuova versione con dati attuali
                </button>
                <button
                  type="button"
                  className="min-h-12 rounded-xl border border-white/15 px-3 text-zinc-300"
                  disabled={busy}
                  onClick={newComparison}
                >
                  Nuovo confronto
                </button>
              </div>
            </div>
          )}
          {parentId && (
            <p
              role="status"
              className="rounded-xl border border-green-500/30 p-3 text-sm text-green-400"
            >
              Bozza nuova versione del confronto {parentId}. Dati aziendali
              aggiornati, offerta non acquistata da verificare. Nessuna modifica
              salvata.
            </p>
          )}
          <div
            className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4"
            aria-label="Prodotto attuale e prodotto proposto affiancati"
          >
            <section className={`${PANEL} min-w-0 !p-3 sm:!p-5`}>
              <h2 className="mb-3 break-words text-base font-semibold text-white">
                Prodotto attuale
              </h2>
              <SidePhoto
                product={!historical ? leftProduct : undefined}
                label="Attuale"
              />
              {!historical && (
                <Field label="Alimento aziendale">
                  <select
                    className={`${INPUT} mb-3 !px-2 text-sm`}
                    disabled={busy}
                    value={leftId}
                    onChange={event => {
                      setLeftId(event.target.value);
                      resetFeedback();
                    }}
                  >
                    <option value="">Seleziona alimento</option>
                    {orderedProducts.map(product => (
                      <option key={product.id} value={product.id}>
                        {activeProductIds.has(product.id) ? "In uso · " : ""}
                        {product.nome}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <SideDetails
                side={left}
                product={leftProduct}
                historic={historical}
                costs={costs}
              />
            </section>
            <section
              className={`${PANEL} min-w-0 !p-3 sm:!p-5 border-green-600/40`}
            >
              <h2 className="mb-3 break-words text-base font-semibold text-green-400">
                Prodotto proposto
              </h2>
              <SidePhoto
                product={
                  !historical && rightMode === "azienda"
                    ? rightProduct
                    : undefined
                }
                label="Proposto"
              />
              {!historical && (
                <div className="mb-3 space-y-3">
                  <Field label="Provenienza">
                    <select
                      className={`${INPUT} !px-2 text-sm`}
                      disabled={busy}
                      value={rightMode}
                      onChange={event => {
                        setRightMode(event.target.value as typeof rightMode);
                        resetFeedback();
                      }}
                    >
                      <option value="nuovo">Nuova offerta</option>
                      <option value="azienda">Alimento aziendale</option>
                      <option value="salvato">Prova già salvata</option>
                    </select>
                  </Field>
                  {rightMode === "azienda" && (
                    <Field label="Alimento da testare">
                      <select
                        className={`${INPUT} !px-2 text-sm`}
                        disabled={busy}
                        value={rightId}
                        onChange={event => {
                          setRightId(event.target.value);
                          resetFeedback();
                        }}
                      >
                        <option value="">Seleziona alimento</option>
                        {orderedProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {activeProductIds.has(product.id)
                              ? "In uso · "
                              : ""}
                            {product.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {rightMode === "salvato" && (
                    <Field label="Offerta / analisi salvata">
                      <select
                        className={`${INPUT} !px-2 text-sm`}
                        disabled={busy}
                        value={trialId}
                        onChange={event => {
                          setTrialId(event.target.value);
                          resetFeedback();
                        }}
                      >
                        <option value="">Seleziona prova</option>
                        {orderedHistory.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.right.nome} ·{" "}
                            {new Date(item.at).toLocaleDateString("it-IT")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {rightMode === "nuovo" && (
                    <>
                      <Field label="Nome offerta">
                        <input
                          className={`${INPUT} !px-2 text-sm`}
                          value={offer.nome}
                          disabled={busy || !canNir}
                          maxLength={255}
                          onChange={event => {
                            setOffer({ ...offer, nome: event.target.value });
                            resetFeedback();
                          }}
                        />
                      </Field>
                      {costs && (
                        <Field label="Prezzo offerto €/q TQ">
                          <input
                            className={`${INPUT} !px-2 text-sm`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={offer.pricePerQuintal ?? ""}
                            disabled={busy || !canNir}
                            placeholder="Non disponibile"
                            onChange={event => {
                              setOffer({
                                ...offer,
                                pricePerQuintal:
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value),
                              });
                              resetFeedback();
                            }}
                          />
                        </Field>
                      )}
                      <p className="text-xs text-zinc-400">
                        Offerta non inserita nel Magazzino.
                      </p>
                    </>
                  )}
                </div>
              )}
              <SideDetails
                side={right}
                product={rightMode === "azienda" ? rightProduct : undefined}
                historic={historical}
                costs={costs}
              />
            </section>
          </div>
          {!data.products.length && (
            <div className={PANEL}>
              Nessun alimento aziendale selezionabile. Il prodotto attuale deve
              esistere in Magazzino.
              <Link
                href="/magazzino"
                className="mt-3 flex min-h-12 items-center text-green-400 underline"
              >
                Apri Magazzino
              </Link>
            </div>
          )}
          {!historical &&
            rightMode === "azienda" &&
            rightId &&
            !rightProduct && (
              <p role="alert" className="text-orange-300">
                L’alimento proposto non è più disponibile per questa azienda.
              </p>
            )}
          {!historical && leftId && !leftProduct && (
            <p role="alert" className="text-orange-300">
              L’alimento attuale non è più disponibile per questa azienda.
            </p>
          )}
          <section className={`${PANEL} space-y-4`}>
            <h2 className="text-lg font-semibold text-white">
              1. Analisi del prodotto da testare
            </h2>
            {!historical && rightMode === "nuovo" ? (
              <>
                <p className="text-sm text-zinc-400">
                  Riporta l’analisi del fornitore. Nessun valore è precompilato
                  o inventato. Per acquisire un documento NIR di un alimento
                  aziendale usa la sua scheda Alimenti.
                </p>
                {!canNir && (
                  <p role="status" className="text-sm text-orange-300">
                    L’inserimento di analisi richiede autorizzazione NIR. Puoi
                    selezionare un alimento aziendale o una prova salvata.
                  </p>
                )}
                <fieldset
                  disabled={busy || !canNir}
                  className="min-w-0 space-y-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Fornitore offerta">
                      <input
                        className={INPUT}
                        maxLength={255}
                        value={offer.supplier ?? ""}
                        onChange={event => {
                          setOffer({
                            ...offer,
                            supplier: event.target.value || null,
                          });
                          resetFeedback();
                        }}
                      />
                    </Field>
                    <Field label="Lotto offerto">
                      <input
                        className={INPUT}
                        maxLength={255}
                        value={offer.lot ?? ""}
                        onChange={event => {
                          setOffer({
                            ...offer,
                            lot: event.target.value || null,
                          });
                          resetFeedback();
                        }}
                      />
                    </Field>
                  </div>
                  <Field label="Provenienza e riferimento analisi">
                    <input
                      className={INPUT}
                      maxLength={500}
                      value={offer.source}
                      onChange={event => {
                        setOffer({ ...offer, source: event.target.value });
                        resetFeedback();
                      }}
                    />
                  </Field>
                  <NutrientEditor
                    params={offer.params}
                    prefix="offerta"
                    onChange={params => {
                      setOffer({ ...offer, params });
                      resetFeedback();
                    }}
                  />
                </fieldset>
              </>
            ) : right ? (
              <>
                <p className="text-sm text-zinc-400">
                  {historical || rightMode === "salvato"
                    ? "Valori originali della prova salvata (non sostituiti da analisi correnti)."
                    : "Analisi attiva recuperata dall’alimento aziendale. Le modifiche si fanno nella scheda NIR."}
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ...NIR_FIELDS.map(field => ({
                      key: field.key,
                      label: field.label,
                    })),
                    ...Object.keys(completeNirParams(right.params))
                      .filter(
                        key => !NIR_FIELDS.some(field => field.key === key)
                      )
                      .map(key => ({ key, label: key })),
                  ].map(field => (
                    <div key={field.key} className="rounded-xl bg-black p-3">
                      <dt className="text-sm text-zinc-400">{field.label}</dt>
                      <dd className="mt-1 break-words text-sm text-white">
                        {nutrientText(
                          completeNirParams(right.params)[field.key]
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                Seleziona il prodotto proposto per visualizzare l’analisi.
              </p>
            )}
          </section>
          <section className={`${PANEL} space-y-4`}>
            <h2 className="text-lg font-semibold text-white">
              2. Confronto nutrizionale
            </h2>
            <p className="text-sm text-zinc-400">
              Grigio = attuale, verde = proposto. Il colore non indica qualità
              migliore. Barre su scala relativa per singolo parametro; unità e
              basi sono normalizzate dal calcolo condiviso.
            </p>
            {result && ready ? (
              <ComparisonBars result={result} />
            ) : (
              <p className="text-sm text-zinc-400">
                Seleziona l’alimento attuale e identifica il prodotto proposto.
                I parametri mancanti restano non disponibili.
              </p>
            )}
          </section>
          <section className={`${PANEL} space-y-4`}>
            <h2 className="text-lg font-semibold text-white">
              3. Confronto economico
            </h2>
            {!costs ? (
              <p className="text-sm text-zinc-400">
                Costi e prezzi riservati: autorizzazione necessaria. Il
                confronto nutrizionale resta consultabile.
              </p>
            ) : result && ready ? (
              <>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[560px] text-sm">
                    <caption className="sr-only">
                      Rapporti economici alternativi, non sommabili
                    </caption>
                    <thead className="bg-black text-left text-zinc-400">
                      <tr>
                        <th scope="col" className="p-3">
                          Parametro
                        </th>
                        <th scope="col" className="p-3">
                          Attuale
                        </th>
                        <th scope="col" className="p-3">
                          Proposto
                        </th>
                        <th scope="col" className="p-3">
                          Differenza %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.economic.map(row => (
                        <tr key={row.key} className="border-t border-white/10">
                          <th
                            scope="row"
                            className="p-3 text-left font-normal text-zinc-300"
                          >
                            {row.label}
                          </th>
                          <td className="p-3 text-white">
                            {row.left == null
                              ? "Non calcolabile"
                              : eur(row.left)}
                          </td>
                          <td className="p-3 text-white">
                            {row.right == null
                              ? "Non calcolabile"
                              : eur(row.right)}
                          </td>
                          <td
                            className={`p-3 ${row.diffPercent == null ? "text-zinc-400" : row.diffPercent < 0 ? "text-green-400" : row.diffPercent > 0 ? "text-red-300" : "text-zinc-300"}`}
                          >
                            {row.diffPercent == null
                              ? "Non calcolabile"
                              : `${row.diffPercent > 0 ? "+" : ""}${qty(row.diffPercent, "%")}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl border border-green-500/30 bg-black p-4">
                  <h3 className="text-sm font-medium uppercase text-green-400">
                    Prezzo equivalente a parità di sostanza secca
                  </h3>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {result.equivalentPrice == null
                      ? "Non calcolabile"
                      : `${eur(result.equivalentPrice)} / q TQ`}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Prezzo attuale × SS proposto ÷ SS attuale. Riguarda
                    esclusivamente la sostanza secca, non costituisce
                    valutazione definitiva della qualità o convenienza
                    dell’intero alimento.
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  I rapporti attribuiscono il costo totale a un singolo
                  nutriente: non vanno sommati. Dati mancanti e denominatori
                  nulli non producono costi zero.
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                Seleziona i prodotti per calcolare i rapporti economici
                disponibili.
              </p>
            )}
          </section>
          <section
            className={`${PANEL} space-y-4 border-green-500/25`}
            aria-label="Fallinity Intelligence"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Sparkles size={20} className="text-green-400" />
              4. Fallinity Intelligence
            </h2>
            <div className="rounded-xl bg-black p-4">
              <h3 className="font-medium text-green-400">
                Lettura iniziale deterministica · nessuna richiesta IA
              </h3>
              {result && ready ? (
                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                  <p>
                    Il confronto usa i valori{" "}
                    {historical
                      ? "originali salvati"
                      : "aziendali correnti e dell’offerta"}
                    . La convenienza nutrizionale dipende dalla razione completa
                    e non è deducibile dal colore delle barre.
                  </p>
                  {costs && (
                    <p>
                      {result.economic.find(row => row.key === "ss")
                        ?.diffPercent == null
                        ? "Costo relativo sulla sostanza secca non calcolabile con i dati disponibili."
                        : `Differenza del costo per kg di SS: ${qty(result.economic.find(row => row.key === "ss")!.diffPercent, "%")}. Una riduzione è un costo minore sulla sola SS, non una garanzia di qualità.`}
                    </p>
                  )}
                  <p>
                    Nessuna promessa di produzione o IOFC: le possibili
                    modifiche alimentari richiedono verifica dell’allevatore e
                    dell’alimentarista.
                  </p>
                  <ul className="space-y-1 text-xs text-orange-300">
                    {result.warnings
                      .filter(
                        warning => costs || !/prezz|cost|econom/i.test(warning)
                      )
                      .map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">
                  Completa la selezione per ottenere i calcoli iniziali. L’IA
                  non parte automaticamente.
                </p>
              )}
            </div>
            <details className="rounded-xl border border-white/10 p-3">
              <summary className="min-h-12 cursor-pointer py-3 text-sm text-white">
                Dati, fonti e mancanti del confronto
              </summary>
              <div className="space-y-3 pt-3 text-sm text-zinc-400">
                <p className="break-words">
                  Attuale: {left?.nome || "Non selezionato"} ·{" "}
                  {left?.source || "Fonte mancante"}
                </p>
                <p className="break-words">
                  Proposto: {right?.nome || "Non identificato"} ·{" "}
                  {right?.source || "Fonte mancante"}
                </p>
                <p>
                  {historical
                    ? "Snapshot nutrizionale storico; contesto aziendale e IA riletti ai valori correnti."
                    : "Contesto aziendale: ricette attive, gruppi Stalla, acquisti e giacenze Magazzino, carichi/distribuzioni/avanzi e Dati stalla sono riletti dal server quando chiedi all’IA."}
                </p>
                <p>
                  Ricette attive coinvolte:{" "}
                  {relevantRecipes.length
                    ? relevantRecipes
                        .map(
                          recipe =>
                            `${recipe.nome} v${recipe.version} (${data.groups.find(group => group.id === recipe.groupId)?.nome ?? "Gruppo non disponibile"})`
                        )
                        .join("; ")
                    : "Nessuna"}
                  .
                </p>
                {costs && (
                  <p>
                    Righe acquisto disponibili:{" "}
                    {leftProduct?.purchases.length ?? 0} per l’attuale;{" "}
                    {rightMode === "azienda"
                      ? (rightProduct?.purchases.length ?? 0)
                      : 0}{" "}
                    per il proposto.
                  </p>
                )}
                <p>
                  Registrazioni aziendali disponibili: {data.runs.length} carri,{" "}
                  {data.distributions.length} distribuzioni,{" "}
                  {data.leftovers.length} avanzi e {data.milkRecords.length}{" "}
                  rilevazioni latte. La presenza non garantisce copertura
                  sufficiente per stime causali.
                </p>
                {missing.length ? (
                  <ul className="space-y-1 text-orange-300">
                    {missing.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {ready
                      ? "Nessun parametro mancante fra quelli confrontati. Restano da verificare rappresentatività del campione, copertura temporale e razione completa."
                      : "Prodotti non ancora selezionati."}
                  </p>
                )}
                <p>
                  Calcoli certi: rapporti dai valori disponibili. Stime e
                  ipotesi: solo se esplicitate nella risposta. Suggerimenti: da
                  verificare, mai applicati automaticamente.
                </p>
              </div>
            </details>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickQuestions
                .filter(value => costs || !/convien|prezzo|costo/.test(value))
                .map(value => (
                  <button
                    key={value}
                    type="button"
                    className="min-h-12 rounded-xl border border-green-500/30 bg-black px-3 py-3 text-left text-sm text-green-400 disabled:opacity-40"
                    disabled={!ready || busy || !canAi}
                    onClick={() => askAi(value)}
                  >
                    {value}
                  </button>
                ))}
            </div>
            <Field label="Domanda personalizzata">
              <textarea
                className={`${INPUT} min-h-24 py-3`}
                maxLength={2000}
                value={question}
                disabled={busy}
                onChange={event => setQuestion(event.target.value)}
                placeholder="Fai una domanda sui prodotti e sui dati aziendali"
              />
            </Field>
            <button
              type="button"
              className={ACTION}
              disabled={!ready || busy || !canAi || !question.trim()}
              onClick={() => askAi(question)}
            >
              {intelligence.isPending
                ? "Analisi IA in corso…"
                : "Chiedi all’IA (con conferma)"}
            </button>
            {currentAi && (
              <div
                className="space-y-3 rounded-xl border border-green-500/30 bg-black p-4"
                aria-live="polite"
              >
                <h3 className="font-medium text-green-400">
                  Risposta IA richiesta esplicitamente
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
                  {currentAi.answer}
                </p>
                <h4 className="text-sm font-semibold text-white">
                  Fonti utilizzate
                </h4>
                {currentAi.sources.length ? (
                  <ul className="space-y-1 text-sm text-zinc-400">
                    {currentAi.sources.map((source, index) => (
                      <li key={index} className="break-words">
                        {source}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-orange-300">
                    Nessuna fonte dichiarata dalla risposta: verifica prima di
                    decidere.
                  </p>
                )}
                <h4 className="text-sm font-semibold text-white">
                  Dati mancanti dichiarati
                </h4>
                {currentAi.missing.length ? (
                  <ul className="space-y-1 text-sm text-orange-300">
                    {currentAi.missing.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Nessun dato mancante dichiarato: non equivale a validazione
                    nutrizionale.
                  </p>
                )}
                <p className="text-xs text-zinc-400">
                  {historical
                    ? "Risposta sul contesto corrente, non modifica il confronto storico. Per conservarla crea una nuova versione e richiedila sui nuovi dati."
                    : "La risposta non viene salvata automaticamente. Puoi includerne i primi 12.000 caratteri (limite API) con la scelta esplicita qui sotto e un salvataggio confermato. Se cambi i dati, richiedi nuovamente l’analisi."}
                </p>
              </div>
            )}
            {currentAi && !historical && costs && (
              <label className="flex min-h-12 items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0 accent-green-500"
                  checked={includeAi}
                  disabled={busy}
                  onChange={event => setIncludeAi(event.target.checked)}
                />
                Includi la risposta IA nel salvataggio (massimo 12.000
                caratteri, il testo oltre questo limite è dichiarato e non viene
                conservato).
              </label>
            )}
            {history?.ai && costs && (
              <details className="rounded-xl border border-white/10 bg-black p-3">
                <summary className="min-h-12 cursor-pointer py-3 text-sm text-zinc-300">
                  Risposta IA originale salvata nello snapshot
                </summary>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-400">
                  {history.ai}
                </p>
              </details>
            )}
            {history?.ai && !costs && (
              <p className="text-xs text-zinc-400">
                Il testo IA storico può includere dati economici ed è riservato
                agli utenti autorizzati ai costi.
              </p>
            )}
          </section>
          <section className={`${PANEL} space-y-4`}>
            <h2 className="text-lg font-semibold text-white">
              5. Salva confronto e note
            </h2>
            {history ? (
              <>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
                  {history.notes || "Nessuna nota salvata."}
                </p>
                <p className="text-xs text-zinc-400">
                  Operatore: {history.operatorId} · ID {history.id}
                  {history.parentId
                    ? ` · versione precedente ${history.parentId}`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <Field label="Note del confronto">
                  <textarea
                    className={`${INPUT} min-h-24 py-3`}
                    disabled={busy}
                    value={notes}
                    maxLength={8000}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Riferimenti, limiti dell’offerta e osservazioni"
                  />
                </Field>
                <button
                  type="button"
                  className={ACTION}
                  disabled={
                    busy ||
                    !ready ||
                    !canSave ||
                    (rightMode === "nuovo" && !canNir)
                  }
                  onClick={requestSave}
                >
                  {busy
                    ? "Operazione in corso…"
                    : parentId
                      ? "Salva nuova versione"
                      : "Salva confronto"}
                </button>
                {!canSave && (
                  <p className="text-sm text-zinc-400">
                    Il salvataggio richiede i permessi di gestione alimentazione
                    o NIR.
                  </p>
                )}
              </>
            )}
            {error && (
              <p
                role="alert"
                className="whitespace-pre-wrap text-sm text-red-300"
              >
                {error}
              </p>
            )}
          </section>
        </>
      )}
    </FeedPage>
  );
}
