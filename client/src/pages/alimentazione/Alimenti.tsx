import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FileText, FlaskConical, Package, Search, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type {
  FeedNir,
  FeedProduct,
  NirInput,
  NirParams,
  NutrientValue,
} from "@shared/feeding/types";
import { canonicalNutrientKey, nirParamsSchema } from "@shared/feeding/math";
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

export const NIR_FIELDS = [
  { key: "ss", label: "Sostanza secca", unit: "%", basis: "TQ" },
  { key: "humidity", label: "Umidità", unit: "%", basis: "TQ" },
  { key: "protein", label: "Proteina grezza", unit: "%", basis: "SS" },
  { key: "ndf", label: "NDF", unit: "%", basis: "SS" },
  { key: "adf", label: "ADF", unit: "%", basis: "SS" },
  { key: "starch", label: "Amido", unit: "%", basis: "SS" },
  { key: "sugars", label: "Zuccheri", unit: "%", basis: "SS" },
  { key: "fat", label: "Grassi", unit: "%", basis: "SS" },
  { key: "ash", label: "Ceneri", unit: "%", basis: "SS" },
  { key: "lignin", label: "Lignina", unit: "%", basis: "SS" },
  { key: "ndfd", label: "Digeribilità NDF", unit: "%", basis: "NDF" },
  { key: "undf", label: "NDF indigeribile (uNDF)", unit: "%", basis: "SS" },
  {
    key: "enl",
    label: "Energia netta lattazione",
    unit: "Mcal/kg",
    basis: "SS",
  },
] satisfies Array<{
  key: string;
  label: string;
  unit: string;
  basis: NutrientValue["basis"];
}>;

export function completeNirParams(params: NirParams = {}): NirParams {
  const aliases: Record<string, string> = {
    umidita: "humidity",
    proteina: "protein",
    amido: "starch",
    zuccheri: "sugars",
    grassi: "fat",
    ceneri: "ash",
    lignina: "lignin",
  };
  const result: NirParams = Object.fromEntries(
    NIR_FIELDS.map(field => [
      field.key,
      { value: null, unit: field.unit, basis: field.basis },
    ])
  );
  const known = new Set(
    NIR_FIELDS.map(field => canonicalNutrientKey(field.key))
  );
  const multipleDigest = new Set(
    ["ndfd", "undf"].filter(
      canonical =>
        Object.entries(params).filter(
          ([key, value]) =>
            canonicalNutrientKey(key) === canonical && value.value != null
        ).length > 1
    )
  );
  multipleDigest.forEach(key => {
    delete result[key];
  });
  for (const [key, item] of Object.entries(params)) {
    const canonical = canonicalNutrientKey(key);
    const target = known.has(canonical)
      ? (aliases[canonical] ?? canonical)
      : key;
    const hoursFromKey = key.match(/(\d+)h?$/i);
    const digest = canonical === "ndfd" || canonical === "undf";
    const hasMultiple = multipleDigest.has(canonical);
    if (hasMultiple && item.value == null) continue;
    const resolvedKey = hasMultiple ? key : target;
    if (item.value == null && result[resolvedKey]?.value != null) continue;
    result[resolvedKey] = {
      ...item,
      unit: item.unit
        .trim()
        .replace(/^(%|g\/kg|Mcal\/kg|MJ\/kg)\s+(TQ|SS|NDF)$/i, "$1"),
      ...(digest && hoursFromKey && item.hours == null
        ? { hours: Number(hoursFromKey[1]) }
        : {}),
    };
  }
  return result;
}
/** Reciprocal moisture is computed only after an explicit edit, never while loading a report. */
export function changeNutrient(
  params: NirParams,
  key: string,
  patch: Partial<NutrientValue>
): NirParams {
  const next = completeNirParams(params);
  const old = next[key] ?? { value: null, unit: "%", basis: "SS" };
  const value = { ...old, ...patch };
  if (patch.unit && old.value != null && patch.value === undefined) {
    if (old.unit === "%" && patch.unit === "g/kg") value.value = old.value * 10;
    if (old.unit === "g/kg" && patch.unit === "%") value.value = old.value / 10;
    if (old.unit === "Mcal/kg" && patch.unit === "MJ/kg")
      value.value = old.value * 4.184;
    if (old.unit === "MJ/kg" && patch.unit === "Mcal/kg")
      value.value = old.value / 4.184;
  }
  next[key] = value;
  if (key === "ss" || key === "humidity") {
    value.basis = "TQ";
    const otherKey = key === "ss" ? "humidity" : "ss";
    const percent =
      value.value == null
        ? null
        : value.unit === "g/kg"
          ? value.value / 10
          : value.value;
    const reciprocal = percent == null ? null : 100 - percent;
    const other = next[otherKey];
    next[otherKey] = {
      ...other,
      basis: "TQ",
      value:
        reciprocal == null
          ? null
          : other.unit === "g/kg"
            ? reciprocal * 10
            : reciprocal,
    };
  }
  return next;
}

export function nirValidation(params: NirParams): string[] {
  const problems: string[] = [];
  const schema = nirParamsSchema.safeParse(params);
  if (!schema.success)
    problems.push(...schema.error.issues.map(issue => issue.message));
  for (const [key, item] of Object.entries(params)) {
    const label = NIR_FIELDS.find(field => field.key === key)?.label ?? key;
    if (
      item.value != null &&
      (!Number.isFinite(item.value) ||
        item.value < 0 ||
        (item.unit === "%" && item.value > 100) ||
        (item.unit === "g/kg" && item.value > 1000))
    )
      problems.push(`${label}: valore fuori intervallo per ${item.unit}.`);
    if (item.hours != null && (!Number.isFinite(item.hours) || item.hours <= 0))
      problems.push(`${label}: le ore di incubazione devono essere positive.`);
    if (
      (key === "ss" || key === "humidity") &&
      (item.basis !== "TQ" || !["%", "g/kg"].includes(item.unit))
    )
      problems.push(`${label}: utilizzare % o g/kg sul tal quale.`);
  }
  const ss = params.ss;
  const humidity = params.humidity;
  if (ss?.value != null && humidity?.value != null) {
    const total =
      (ss.unit === "g/kg" ? ss.value / 10 : ss.value) +
      (humidity.unit === "g/kg" ? humidity.value / 10 : humidity.value);
    if (Math.abs(total - 100) > 0.01)
      problems.push(
        "Sostanza secca e umidità non sono reciproche: verificare il referto."
      );
  }
  return problems;
}

export function nutrientText(item: NutrientValue | undefined): string {
  if (!item || item.value == null || !Number.isFinite(item.value))
    return "Dato non disponibile";
  return `${qty(item.value, item.unit)} su ${item.basis}${item.hours != null ? ` · ${qty(item.hours, "h")}` : ""}${item.method ? ` · ${item.method}` : ""}`;
}

export function NutrientEditor({
  params,
  onChange,
  disabled = false,
  prefix = "nir",
}: {
  params: NirParams;
  onChange: (params: NirParams) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  const all = completeNirParams(params);
  const fields = [
    ...NIR_FIELDS.filter(field => all[field.key]),
    ...Object.keys(all)
      .filter(key => !NIR_FIELDS.some(field => field.key === key))
      .map(key => ({
        key,
        label: key,
        unit: all[key].unit,
        basis: all[key].basis,
      })),
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Campi vuoti = dati mancanti, non zero. SS e umidità sono reciproche. La
        base fa parte del dato; cambiarla non converte il valore del
        laboratorio.
      </p>
      {fields.map(field => {
        const item = all[field.key];
        const moisture = field.key === "ss" || field.key === "humidity";
        const digestibility = ["ndfd", "undf"].includes(
          canonicalNutrientKey(field.key)
        );
        const units = moisture
          ? ["%", "g/kg"]
          : field.key === "enl"
            ? ["Mcal/kg", "MJ/kg"]
            : ["%", "g/kg"];
        if (!units.includes(item.unit)) units.push(item.unit);
        const id = `${prefix}-${field.key}`;
        return (
          <fieldset
            key={field.key}
            disabled={disabled}
            className="min-w-0 rounded-xl border border-white/10 p-3"
          >
            <legend className="px-1 text-sm font-medium text-white">
              {field.label}
            </legend>
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Valore">
                <input
                  id={id}
                  className={INPUT}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  max={
                    item.unit === "%"
                      ? 100
                      : item.unit === "g/kg"
                        ? 1000
                        : undefined
                  }
                  placeholder="Non disponibile"
                  value={item.value ?? ""}
                  onChange={event =>
                    onChange(
                      changeNutrient(all, field.key, {
                        value:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    )
                  }
                />
              </Field>
              <Field label="Unità">
                <select
                  className={INPUT}
                  value={item.unit}
                  onChange={event =>
                    onChange(
                      changeNutrient(all, field.key, {
                        unit: event.target.value,
                      })
                    )
                  }
                >
                  {units.map(unit => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Base">
                <select
                  className={INPUT}
                  value={item.basis}
                  disabled={disabled || moisture}
                  onChange={event =>
                    onChange(
                      changeNutrient(all, field.key, {
                        basis: event.target.value as NutrientValue["basis"],
                      })
                    )
                  }
                >
                  <option value="TQ">Tal quale (TQ)</option>
                  {!moisture && (
                    <>
                      <option value="SS">Sostanza secca (SS)</option>
                      <option value="NDF">NDF</option>
                    </>
                  )}
                </select>
              </Field>
            </div>
            {digestibility && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Ore di incubazione (se riportate)">
                  <input
                    className={INPUT}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="any"
                    value={item.hours ?? ""}
                    onChange={event =>
                      onChange(
                        changeNutrient(all, field.key, {
                          hours:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                        })
                      )
                    }
                  />
                </Field>
                <Field label="Metodo di digeribilità (se riportato)">
                  <input
                    className={INPUT}
                    value={item.method ?? ""}
                    onChange={event =>
                      onChange(
                        changeNutrient(all, field.key, {
                          method: event.target.value || undefined,
                        })
                      )
                    }
                  />
                </Field>
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

function NirDocument({
  analysis,
  allowed,
}: {
  analysis: FeedNir;
  allowed: boolean;
}) {
  const [requested, setRequested] = useState(false);
  const query = trpc.alimentazione.documentNir.useQuery(
    { id: analysis.id },
    { enabled: requested && allowed && !!analysis.documentKey, retry: false }
  );
  if (!analysis.documentKey)
    return (
      <p className="text-sm text-zinc-400">Documento originale non presente.</p>
    );
  if (!allowed)
    return (
      <p className="text-sm text-zinc-400">
        Documento riservato: autorizzazione NIR necessaria.
      </p>
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/15 px-3 text-green-400 disabled:opacity-50"
        disabled={query.isFetching}
        onClick={() => {
          setRequested(true);
          if (requested) void query.refetch();
        }}
      >
        <FileText size={18} />
        {query.isFetching ? "Recupero documento…" : "Apri referto protetto"}
      </button>
      {query.error && (
        <p role="alert" className="text-sm text-red-300">
          {query.error.message}
        </p>
      )}
      {query.data?.url && (
        <a
          className="inline-flex min-h-12 items-center px-3 text-green-400 underline"
          href={query.data.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Visualizza foto / PDF
        </a>
      )}
    </div>
  );
}

function ReportValues({
  analysis,
  previous,
}: {
  analysis: FeedNir;
  previous?: FeedNir;
}) {
  const currentParams = completeNirParams(analysis.params);
  const previousParams = previous ? completeNirParams(previous.params) : {};
  const fields = [
    ...NIR_FIELDS.map(field => ({ key: field.key, label: field.label })),
    ...Object.keys(currentParams)
      .filter(key => !NIR_FIELDS.some(field => field.key === key))
      .map(key => ({ key, label: key })),
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(field => {
        const current = currentParams[field.key];
        const before = previousParams[field.key];
        const comparable =
          current?.value != null &&
          before?.value != null &&
          current.unit === before.unit &&
          current.basis === before.basis &&
          current.hours === before.hours &&
          current.method === before.method;
        return (
          <div key={field.key} className="min-w-0 rounded-xl bg-black p-3">
            <dt className="text-sm text-zinc-400">{field.label}</dt>
            <dd className="mt-1 break-words text-sm text-white">
              {nutrientText(current)}
            </dd>
            {previous && (
              <p className="mt-1 text-xs text-zinc-400">
                {comparable
                  ? `Δ precedente: ${qty(current!.value! - before!.value!, current!.unit)}`
                  : "Differenza non calcolabile (dato, base, unità o metodo diversi)."}
              </p>
            )}
          </div>
        );
      })}
    </dl>
  );
}

type NirDraft = {
  productId: string;
  date: string;
  responsible: string;
  laboratory: string;
  lot: string;
  trench: string;
  sample: string;
  method: string;
  note: string;
  params: NirParams;
  documentKey: string | null;
  documentUrl: string | null;
  extracted: boolean;
  reviewed: boolean;
  extractionNotes: string[];
  activate: boolean;
};
const today = () => {
  const at = new Date();
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
};
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Impossibile leggere il documento."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(","))
        reject(new Error("Documento non valido."));
      else resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
export function autonomyLabel(product: FeedProduct): string {
  if (
    product.dailyUseKg === 0 ||
    ["non_in_uso", "non in uso"].includes(product.autonomyStatus.toLowerCase())
  )
    return "Non in uso";
  return product.autonomyDays == null
    ? "Autonomia non ancora calcolabile"
    : qty(product.autonomyDays, "giorni");
}

export default function Alimenti() {
  const feed = useFeed();
  const confirm = useFeedConfirm();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("nome");
  const [descending, setDescending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NirDraft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = trpc.alimentazione.saveNir.useMutation();
  const activate = trpc.alimentazione.activateNir.useMutation();
  const upload = trpc.alimentazione.uploadNirDocument.useMutation();
  const extract = trpc.alimentazione.extractNir.useMutation();
  const data = feed.data;
  const costs = data?.permissions.canSeeCosts ?? false;
  const canNir = data?.permissions.canNir ?? false;
  const products = useMemo(() => {
    const items = (data?.products ?? []).filter(item =>
      `${item.nome} ${item.codice ?? ""} ${item.categoria ?? ""} ${item.fornitore ?? ""}`
        .toLocaleLowerCase("it-IT")
        .includes(search.trim().toLocaleLowerCase("it-IT"))
    );
    return items.sort((a, b) => {
      if (sort === "nome" || (sort === "costo" && !costs))
        return (descending ? -1 : 1) * a.nome.localeCompare(b.nome, "it");
      const value = (item: FeedProduct) =>
        sort === "scorta"
          ? item.quantityKg
          : sort === "autonomia"
            ? item.autonomyDays
            : sort === "consumo"
              ? item.dailyUseKg
              : item.prezzoKg;
      const av = value(a);
      const bv = value(b);
      if (av == null || !Number.isFinite(av))
        return bv == null || !Number.isFinite(bv)
          ? a.nome.localeCompare(b.nome, "it")
          : 1;
      if (bv == null || !Number.isFinite(bv)) return -1;
      return (
        (descending ? -1 : 1) * (av - bv) || a.nome.localeCompare(b.nome, "it")
      );
    });
  }, [data?.products, search, sort, descending, costs]);
  const selected = data?.products.find(item => item.id === selectedId);
  const analyses = useMemo(
    () =>
      (data?.nirAnalyses ?? [])
        .filter(item => item.productId === selectedId)
        .sort((a, b) => b.at - a.at),
    [data?.nirAnalyses, selectedId]
  );
  const recipes = (data?.recipes ?? []).filter(recipe =>
    recipe.ingredients.some(item => item.productId === selectedId)
  );
  const busy =
    confirm.pending ||
    save.isPending ||
    activate.isPending ||
    upload.isPending ||
    extract.isPending;
  const totalStock =
    data?.products.reduce(
      (total, product) => total + (product.quantityKg ?? 0),
      0
    ) ?? 0;
  const missingStock =
    data?.products.filter(product => product.quantityKg == null).length ?? 0;
  const lowStock =
    data?.products.filter(
      product =>
        product.autonomyDays != null &&
        product.autonomyDays < 7 &&
        product.dailyUseKg != null &&
        product.dailyUseKg > 0
    ).length ?? 0;
  function beginNir(product: FeedProduct) {
    const lastResponsible =
      [...(data?.nirAnalyses ?? [])]
        .sort((a, b) => b.at - a.at)
        .find(item => item.responsible)?.responsible ?? "";
    setDraft({
      productId: product.id,
      date: today(),
      responsible: lastResponsible,
      laboratory: "",
      lot: "",
      trench: "",
      sample: "",
      method: "",
      note: "",
      params: completeNirParams(),
      documentKey: null,
      documentUrl: null,
      extracted: false,
      reviewed: false,
      extractionNotes: [],
      activate: false,
    });
    setFile(null);
    setFileError(null);
    setFormError(null);
  }
  function chooseFile(next: File | null) {
    setFileError(null);
    if (
      next &&
      (!next.size ||
        next.size > 5 * 1024 * 1024 ||
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          next.type
        ))
    ) {
      setFile(null);
      setFileError(
        "Scegli una foto JPG, PNG, WebP o un PDF non vuoto, massimo 5 MB."
      );
      return;
    }
    setFile(next);
    if (draft)
      setDraft({
        ...draft,
        documentKey: null,
        documentUrl: null,
        extracted: false,
        reviewed: false,
        extractionNotes: [],
      });
  }
  function requestSave() {
    if (!draft || !canNir || busy) return;
    const problems = nirValidation(draft.params);
    const at = new Date(`${draft.date}T12:00:00`).getTime();
    if (!Number.isFinite(at))
      problems.push("Inserisci una data di analisi valida.");
    if (!Object.values(draft.params).some(item => item.value != null))
      problems.push("Inserisci almeno un valore del referto.");
    if (file && !draft.documentKey)
      problems.push(
        "Carica il documento selezionato prima del salvataggio, oppure rimuovilo."
      );
    if (draft.extracted && !draft.reviewed)
      problems.push("Verifica e conferma i valori estratti dall’IA.");
    if (problems.length) {
      setFormError(problems.join("\n"));
      return;
    }
    const input: NirInput = {
      productId: draft.productId,
      at,
      responsible: draft.responsible.trim() || null,
      laboratory: draft.laboratory.trim() || null,
      lot: draft.lot.trim() || null,
      trench: draft.trench.trim() || null,
      sample: draft.sample.trim() || null,
      method: draft.method.trim() || null,
      note: draft.note.trim() || null,
      params: draft.params,
      documentKey: draft.documentKey,
      activate: draft.activate,
      confirm: true,
    };
    confirm.ask(
      "Salvare l’analisi NIR?",
      `${selected?.nome ?? "Alimento"} · ${draft.date}\n${draft.activate ? "L’analisi diventerà attiva per i calcoli correnti. Non cambieranno quantità delle ricette o carichi storici." : "L’analisi sarà conservata nello storico senza sostituire quella attiva."}\n${Object.entries(
        draft.params
      )
        .filter(([, item]) => item.value != null)
        .map(
          ([key, item]) =>
            `${NIR_FIELDS.find(field => field.key === key)?.label ?? key}: ${nutrientText(item)}`
        )
        .join("\n")}`,
      async () => {
        await save.mutateAsync(input);
        setDraft(null);
        setFile(null);
        await feed.refresh();
      }
    );
  }
  return (
    <FeedPage title="Alimenti e analisi alimenti">
      {confirm.dialog}
      <FeedStatus query={feed} />
      {!feed.isLoading && !feed.error && !data && (
        <div className={PANEL}>
          Dati aziendali non disponibili. Seleziona un’azienda autorizzata.
        </div>
      )}
      {data && !data.permissions.canView && (
        <div role="alert" className={PANEL}>
          Non sei autorizzato a consultare gli alimenti aziendali.
        </div>
      )}
      {data?.permissions.canView && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={PANEL}>
              <p className="text-sm text-zinc-400">
                Scorta alimentare {missingStock ? "convertibile" : "totale"}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {data.products.length
                  ? qty(
                      data.products.some(product => product.quantityKg != null)
                        ? totalStock
                        : null,
                      "kg"
                    )
                  : "Nessun alimento"}
              </p>
              {missingStock > 0 && (
                <p className="mt-2 text-sm text-orange-300">
                  Totale parziale: {missingStock} alimenti senza conversione in
                  kg.
                </p>
              )}
            </div>
            <div className={PANEL}>
              <p className="text-sm text-zinc-400">Autonomia aziendale</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {qty(data.summary.autonomyDays, "giorni")}
              </p>
              <p className="mt-2 break-words text-sm text-zinc-400">
                Limitante:{" "}
                {data.summary.limitingProduct ?? "Non identificabile"}
              </p>
            </div>
            <div className={PANEL}>
              <p className="text-sm text-zinc-400">Alimenti in esaurimento</p>
              <p className="mt-2 text-xl font-semibold text-orange-300">
                {lowStock}
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Soglia di lettura: autonomia inferiore a 7 giorni. Solo alimenti
                in uso con dati disponibili.
              </p>
            </div>
          </div>
          {data.summary.warnings.length > 0 && (
            <div role="status" className={`${PANEL} text-sm text-orange-300`}>
              <ul className="space-y-2">
                {data.summary.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/alimentazione/confronto"
              className={`${ACTION} inline-flex items-center justify-center`}
            >
              Confronta nuovo prodotto
            </Link>
            <Link
              href="/alimentazione/confronto?storico=1"
              className="inline-flex min-h-12 items-center rounded-xl border border-white/15 px-4 text-green-400"
            >
              Confronti salvati ({data.comparisons.length})
            </Link>
          </div>
          <section
            className={`${PANEL} space-y-4`}
            aria-label="Alimenti di Magazzino"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_150px]">
              <Field label="Cerca alimento, codice, categoria o fornitore">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-4 text-zinc-500"
                    size={18}
                  />
                  <input
                    className={`${INPUT} pl-10`}
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Cerca in Magazzino"
                  />
                </div>
              </Field>
              <Field label="Ordina per">
                <select
                  className={INPUT}
                  value={sort === "costo" && !costs ? "nome" : sort}
                  onChange={event => setSort(event.target.value)}
                >
                  <option value="nome">Nome</option>
                  <option value="scorta">Scorta in kg</option>
                  <option value="autonomia">Autonomia</option>
                  <option value="consumo">Consumo</option>
                  {costs && <option value="costo">Costo</option>}
                </select>
              </Field>
              <Field label="Direzione">
                <select
                  className={INPUT}
                  value={descending ? "desc" : "asc"}
                  onChange={event =>
                    setDescending(event.target.value === "desc")
                  }
                >
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </Field>
            </div>
            {!data.products.length ? (
              <div className="rounded-xl border border-dashed border-white/15 p-5 text-zinc-300">
                <Package className="mb-3 text-green-400" />
                Nessun alimento aziendale presente in Magazzino. L’anagrafica
                non viene duplicata qui.
                <Link
                  href="/magazzino"
                  className="mt-3 flex min-h-12 items-center text-green-400 underline"
                >
                  Apri Magazzino
                </Link>
              </div>
            ) : !products.length ? (
              <p className="py-4 text-zinc-400">
                Nessun alimento corrisponde alla ricerca.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {products.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    aria-expanded={selectedId === product.id}
                    onClick={() => {
                      setSelectedId(product.id);
                      setDraft(null);
                      setFile(null);
                      setFormError(null);
                    }}
                    className={`min-h-12 min-w-0 rounded-xl border bg-black p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${selectedId === product.id ? "border-green-500" : "border-white/10 hover:border-green-500/50"}`}
                  >
                    <div className="flex items-start gap-3">
                      {product.immagineUrl ? (
                        <img
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                          src={product.immagineUrl}
                          alt={product.nome}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-900">
                          <Package
                            className="text-zinc-500"
                            aria-label="Foto non disponibile"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold text-white">
                          {product.nome}
                        </h2>
                        <p className="mt-1 text-xs text-zinc-400">
                          {product.categoria ?? "Categoria non indicata"} ·{" "}
                          {product.codice ?? "Codice non indicato"}
                        </p>
                        <p
                          className={`mt-2 text-xs ${product.nirId ? "text-green-400" : "text-orange-300"}`}
                        >
                          {product.nirId
                            ? "Analisi NIR attiva"
                            : "Analisi NIR attiva mancante"}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-zinc-400">Scorta</dt>
                        <dd className="text-white">
                          {qty(
                            product.quantity,
                            product.unitaMisura ?? "unità non indicata"
                          )}
                        </dd>
                        {product.quantityKg == null && (
                          <p className="text-xs text-orange-300">
                            Conversione in kg mancante
                          </p>
                        )}
                      </div>
                      <div>
                        <dt className="text-zinc-400">Consumo aziendale</dt>
                        <dd className="text-white">
                          {qty(product.dailyUseKg, "kg/giorno")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">Autonomia</dt>
                        <dd
                          className={
                            product.autonomyDays != null &&
                            product.autonomyDays < 7
                              ? "text-orange-300"
                              : "text-white"
                          }
                        >
                          {autonomyLabel(product)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-zinc-400">Sostanza secca</dt>
                        <dd className="text-white">
                          {qty(product.dryMatter, "%")}
                        </dd>
                      </div>
                      {costs && (
                        <div className="col-span-2">
                          <dt className="text-zinc-400">
                            Costo medio effettivo
                          </dt>
                          <dd className="text-white">
                            {eur(product.prezzoKg)}
                            {product.prezzoKg != null ? " / kg TQ" : ""}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </button>
                ))}
              </div>
            )}
          </section>
          {selectedId && !selected && (
            <div role="alert" className={PANEL}>
              L’alimento selezionato non è più disponibile per questa azienda.
            </div>
          )}
          {selected && (
            <section
              className={`${PANEL} space-y-5`}
              aria-label={`Dettaglio ${selected.nome}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="break-words text-xl font-semibold text-white">
                  {selected.nome}
                </h2>
                <button
                  type="button"
                  className="min-h-12 rounded-xl border border-white/15 px-3 text-zinc-300"
                  onClick={() => {
                    setSelectedId(null);
                    setDraft(null);
                  }}
                >
                  Chiudi dettaglio
                </button>
              </div>
              {selected.immagineUrl && (
                <img
                  src={selected.immagineUrl}
                  alt={selected.nome}
                  className="max-h-56 w-full rounded-xl object-cover"
                />
              )}
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-zinc-400">Giacenza Magazzino</dt>
                  <dd className="text-white">
                    {qty(
                      selected.quantity,
                      selected.unitaMisura ?? "unità non indicata"
                    )}{" "}
                    · {qty(selected.quantityKg, "kg")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-400">
                    Categoria / fornitore
                  </dt>
                  <dd className="text-white">
                    {selected.categoria ?? "Non indicata"} /{" "}
                    {selected.fornitore ?? "Non disponibile"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-400">
                    Consumo medio di tutti i gruppi
                  </dt>
                  <dd className="text-white">
                    {qty(selected.dailyUseKg, "kg/giorno")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-zinc-400">
                    Autonomia / esaurimento stimato
                  </dt>
                  <dd className="text-white">
                    {autonomyLabel(selected)}
                    {selected.autonomyDays != null &&
                      selected.dailyUseKg != null &&
                      selected.dailyUseKg > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          {new Date(
                            Date.now() + selected.autonomyDays * 86400000
                          ).toLocaleDateString("it-IT")}
                        </>
                      )}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-zinc-400">
                Giacenze per lotto/trincea non esposte dalla fonte Magazzino.
                Lotto e trincea dei campioni sono riportati nello storico NIR.
                Le stime non includono consegne future non registrate.
              </p>
              <div className="flex flex-wrap gap-3">
                {canNir && (
                  <button
                    type="button"
                    className={ACTION}
                    disabled={busy}
                    onClick={() => beginNir(selected)}
                  >
                    <FlaskConical className="mr-2 inline" size={18} />
                    Nuova analisi NIR
                  </button>
                )}
                <a
                  href="#storico-nir"
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/15 px-3 text-green-400"
                >
                  Storico analisi
                </a>
                <Link
                  href={`/alimentazione/confronto?productId=${encodeURIComponent(selected.id)}`}
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/15 px-3 text-green-400"
                >
                  Confronta questo alimento
                </Link>
              </div>
              {!canNir && (
                <p className="text-sm text-zinc-400">
                  La registrazione e l’attivazione NIR richiedono
                  autorizzazione.
                </p>
              )}
              <div>
                <h3 className="mb-3 font-semibold text-white">
                  Gruppi e ricette che utilizzano l’alimento
                </h3>
                {!recipes.length ? (
                  <p className="text-sm text-zinc-400">
                    Non presente nelle ricette aziendali.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recipes.map(recipe => {
                      const group = data.groups.find(
                        item => item.id === recipe.groupId
                      );
                      const ingredient = recipe.ingredients.find(
                        item => item.productId === selected.id
                      );
                      return (
                        <li
                          key={recipe.id}
                          className="rounded-xl bg-black p-3 text-sm text-zinc-300"
                        >
                          <p className="break-words text-white">
                            {group?.nome ?? "Gruppo non disponibile"} ·{" "}
                            {recipe.nome} v{recipe.version}
                          </p>
                          <p className="mt-1">
                            {recipe.status === "attiva"
                              ? "In uso"
                              : recipe.status}{" "}
                            · {qty(ingredient?.kgPerHead, "kg/capo/giorno")}
                          </p>
                          <Link
                            href="/alimentazione/razioni"
                            className="mt-1 inline-flex min-h-12 items-center text-green-400"
                          >
                            Apri razioni
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {costs && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">
                    Costi e prezzi fatture
                  </h3>
                  <p className="text-sm text-zinc-300">
                    Costo medio: {eur(selected.prezzoKg)} / kg TQ · Ultimo
                    prezzo: {eur(selected.lastPriceKg)} / kg TQ
                  </p>
                  <p className="text-sm text-zinc-400">
                    Fonte costo: {selected.costSource || "Non disponibile"}.
                    Prezzi e scorte si modificano esclusivamente in Magazzino e
                    Fatture.
                  </p>
                  {!selected.purchases.length ? (
                    <p className="text-sm text-zinc-400">
                      Nessuna riga di acquisto associata all’alimento.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {[...selected.purchases]
                        .sort(
                          (a, b) =>
                            (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)
                        )
                        .map(purchase => (
                          <li
                            key={`${purchase.invoiceId}-${purchase.lineId}`}
                            className="rounded-xl bg-black p-3 text-sm"
                          >
                            <p className="break-words text-white">
                              {purchase.supplier || "Fornitore non disponibile"}{" "}
                              ·{" "}
                              {Number.isFinite(Date.parse(purchase.at))
                                ? new Date(purchase.at).toLocaleDateString(
                                    "it-IT"
                                  )
                                : "Data non disponibile"}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              {qty(purchase.quantityKg, "kg")} ·{" "}
                              {eur(purchase.priceKg)} / kg TQ
                            </p>
                            <p className="mt-1 break-all text-xs text-zinc-400">
                              Fattura {purchase.invoiceId} · riga{" "}
                              {purchase.lineId}
                            </p>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
              {draft && draft.productId === selected.id && canNir && (
                <form
                  className="space-y-4 rounded-xl border border-green-600/50 bg-black p-3 sm:p-4"
                  onSubmit={event => {
                    event.preventDefault();
                    requestSave();
                  }}
                >
                  <h3 className="text-lg font-semibold text-white">
                    Nuova analisi: bozza non salvata
                  </h3>
                  <fieldset disabled={busy} className="min-w-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Data analisi">
                        <input
                          className={INPUT}
                          type="date"
                          required
                          value={draft.date}
                          onChange={event =>
                            setDraft({ ...draft, date: event.target.value })
                          }
                        />
                      </Field>
                      {(
                        [
                          ["responsible", "Alimentarista"],
                          ["laboratory", "Laboratorio"],
                          ["lot", "Lotto campione"],
                          ["trench", "Trincea"],
                          ["sample", "Provenienza campione"],
                          ["method", "Metodo di analisi"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            className={INPUT}
                            maxLength={255}
                            value={draft[key]}
                            onChange={event =>
                              setDraft({ ...draft, [key]: event.target.value })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <div className="space-y-3 rounded-xl border border-white/10 p-3">
                      <Field label="Documento originale: foto / PDF, massimo 5 MB">
                        <input
                          className={`${INPUT} py-3 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:p-2 file:text-white`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={event =>
                            chooseFile(event.target.files?.[0] ?? null)
                          }
                        />
                      </Field>
                      {fileError && (
                        <p role="alert" className="text-sm text-red-300">
                          {fileError}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400">
                        Upload privato con verifica aziendale. Caricare un
                        documento non registra un’analisi né modifica il
                        Magazzino.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="min-h-12 rounded-xl border border-white/15 px-3 text-green-400 disabled:opacity-40"
                          disabled={!file || !!draft.documentKey}
                          onClick={() => {
                            if (!file) return;
                            const chosen = file;
                            const productId = draft.productId;
                            confirm.ask(
                              "Caricare il referto protetto?",
                              `${chosen.name} · ${qty(chosen.size / 1024 / 1024, "MB")}\nIl documento sarà associato a questo alimento aziendale. I valori NIR non saranno salvati.`,
                              async () => {
                                const result = await upload.mutateAsync({
                                  productId,
                                  name: chosen.name,
                                  mime: chosen.type as
                                    | "application/pdf"
                                    | "image/jpeg"
                                    | "image/png"
                                    | "image/webp",
                                  base64: await fileBase64(chosen),
                                });
                                setDraft(current =>
                                  current?.productId === productId
                                    ? {
                                        ...current,
                                        documentKey: result.documentKey,
                                        documentUrl: result.url,
                                        reviewed: false,
                                      }
                                    : current
                                );
                              }
                            );
                          }}
                        >
                          <Upload className="mr-2 inline" size={18} />
                          {draft.documentKey
                            ? "Documento caricato"
                            : "Carica documento"}
                        </button>
                        {file && (
                          <button
                            type="button"
                            className="min-h-12 rounded-xl border border-white/15 px-3 text-zinc-300"
                            onClick={() => chooseFile(null)}
                          >
                            Rimuovi dalla bozza
                          </button>
                        )}
                        <button
                          type="button"
                          className="min-h-12 rounded-xl border border-white/15 px-3 text-green-400 disabled:opacity-40"
                          disabled={!draft.documentKey}
                          onClick={() => {
                            if (!draft.documentKey) return;
                            const productId = draft.productId;
                            const documentKey = draft.documentKey;
                            confirm.ask(
                              "Estrarre i valori con l’IA?",
                              "Il referto verrà letto dall’IA. I valori proposti sostituiranno i campi della bozza e dovranno essere verificati sul documento prima del salvataggio. Nessuna analisi verrà salvata automaticamente.",
                              async () => {
                                const result = await extract.mutateAsync({
                                  productId,
                                  documentKey,
                                });
                                setDraft(current =>
                                  current?.productId === productId &&
                                  current.documentKey === documentKey
                                    ? {
                                        ...current,
                                        params: completeNirParams(
                                          result.params
                                        ),
                                        extracted: true,
                                        reviewed: false,
                                        extractionNotes: Array.isArray(
                                          result.notes
                                        )
                                          ? result.notes.map(String)
                                          : result.notes
                                            ? [String(result.notes)]
                                            : [],
                                      }
                                    : current
                                );
                              }
                            );
                          }}
                        >
                          Estrai valori con IA
                        </button>
                      </div>
                      {draft.documentKey && (
                        <p className="text-sm text-green-400">
                          Documento originale collegato alla bozza. Verrà
                          conservato con l’analisi al salvataggio.
                        </p>
                      )}
                      {draft.documentUrl && (
                        <a
                          href={draft.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-12 items-center text-green-400 underline"
                        >
                          Apri referto caricato e verifica i valori
                        </a>
                      )}
                      {draft.extractionNotes.length > 0 && (
                        <ul className="space-y-1 text-sm text-orange-300">
                          {draft.extractionNotes.map((note, index) => (
                            <li key={index}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <NutrientEditor
                      params={draft.params}
                      onChange={params =>
                        setDraft({ ...draft, params, reviewed: false })
                      }
                      prefix="nuova-analisi"
                    />
                    <Field label="Note">
                      <textarea
                        className={`${INPUT} min-h-24 py-3`}
                        maxLength={8000}
                        value={draft.note}
                        onChange={event =>
                          setDraft({ ...draft, note: event.target.value })
                        }
                      />
                    </Field>
                    {draft.extracted && (
                      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-orange-500/40 p-3 text-sm text-orange-200">
                        <input
                          type="checkbox"
                          className="h-6 w-6 shrink-0 accent-green-500"
                          checked={draft.reviewed}
                          onChange={event =>
                            setDraft({
                              ...draft,
                              reviewed: event.target.checked,
                            })
                          }
                        />
                        Ho verificato e corretto valori, unità, basi, metodi e
                        tempi sul documento originale.
                      </label>
                    )}
                    <label className="flex min-h-12 items-center gap-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-green-500"
                        checked={draft.activate}
                        onChange={event =>
                          setDraft({ ...draft, activate: event.target.checked })
                        }
                      />
                      Rendi attiva dopo il salvataggio (non modifica lo
                      storico).
                    </label>
                  </fieldset>
                  {formError && (
                    <p
                      role="alert"
                      className="whitespace-pre-wrap text-sm text-red-300"
                    >
                      {formError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" className={ACTION} disabled={busy}>
                      Verifica e salva analisi
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-white/15 px-3 text-zinc-300"
                      onClick={() => {
                        setDraft(null);
                        setFile(null);
                      }}
                    >
                      Abbandona bozza
                    </button>
                  </div>
                </form>
              )}
              <div id="storico-nir" className="scroll-mt-20 space-y-4">
                <h3 className="font-semibold text-white">
                  Analisi NIR attiva e storico ({analyses.length})
                </h3>
                {!analyses.length && (
                  <p className="text-sm text-zinc-400">
                    Nessuna analisi NIR registrata. I valori mancanti non
                    vengono stimati.
                  </p>
                )}
                {analyses.map((analysis, index) => (
                  <details
                    key={analysis.id}
                    open={analysis.id === selected.nirId}
                    className="rounded-xl border border-white/10 bg-black p-3"
                  >
                    <summary className="min-h-12 cursor-pointer break-words py-3 font-medium text-white focus-visible:outline-green-500">
                      {dateTime(analysis.at)} ·{" "}
                      {analysis.id === selected.nirId
                        ? "Attiva"
                        : analysis.active
                          ? "Attiva su altro ambito"
                          : "Storica"}{" "}
                      · {analysis.responsible ?? "Alimentarista non indicato"} ·{" "}
                      {analysis.lot
                        ? `Lotto ${analysis.lot}`
                        : "Lotto non indicato"}
                    </summary>
                    <div className="space-y-4 pt-3">
                      <p className="break-words text-sm text-zinc-400">
                        Laboratorio: {analysis.laboratory ?? "Non indicato"} ·
                        Trincea: {analysis.trench ?? "Non indicata"} · Campione:{" "}
                        {analysis.sample ?? "Non indicato"} · Metodo:{" "}
                        {analysis.method ?? "Non indicato"}
                      </p>
                      <ReportValues
                        analysis={analysis}
                        previous={analyses[index + 1]}
                      />
                      {analysis.note && (
                        <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
                          {analysis.note}
                        </p>
                      )}
                      <NirDocument analysis={analysis} allowed={canNir} />
                      {canNir && analysis.id !== selected.nirId && (
                        <button
                          type="button"
                          className={ACTION}
                          disabled={busy}
                          onClick={() =>
                            confirm.ask(
                              "Attivare questa analisi?",
                              `${selected.nome} · ${dateTime(analysis.at)}\nAggiorna i dati NIR correnti e i calcoli collegati. Non cambia le quantità delle ricette né le analisi dei carichi già registrati.`,
                              async () => {
                                await activate.mutateAsync({
                                  id: analysis.id,
                                  confirm: true,
                                });
                                await feed.refresh();
                              }
                            )
                          }
                        >
                          Rendi attiva
                        </button>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </FeedPage>
  );
}
