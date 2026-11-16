import { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Link } from "wouter";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  FileText,
  History,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addInvoiceToDemo,
  changeAlias,
  confirmDemoImport,
  initialDemoState,
  linkDemoDelivery,
  payDemoInvoice,
  recordDemoDelivery,
  registerDemoFinance,
  returnDemoPart,
  withdrawDemoPart,
} from "@shared/inventory-invoice/engine";
import { DEMO_INVOICE_PRESETS } from "@shared/inventory-invoice/fixtures";
import InvoiceAliasEditor from "./InvoiceAliasEditor";
import type {
  Classification,
  DemoState,
  ImportConfirmation,
  InvoiceReview,
  ReviewRow,
  WarehouseInvoice,
} from "@shared/inventory-invoice/types";

const PANEL =
  "min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5";
const BUTTON = "min-h-11 h-auto whitespace-normal break-words py-2 text-center";
const CONTROL =
  "min-h-11 w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50";
const GREEN = `${BUTTON} bg-green-700 text-white hover:bg-green-600`;
const BLUE = `${BUTTON} border border-sky-800 bg-sky-950/40 text-sky-200 hover:bg-sky-950`;
const KEYS = ["categoria", "reparto", "famiglia", "sottocategoria"] as const;
const TITLES: Record<keyof Classification, string> = {
  categoria: "Categoria",
  reparto: "Reparto",
  famiglia: "Famiglia",
  sottocategoria: "Sottocategoria",
};
const number = z.number().finite();
const nonnegative = number.nonnegative();
const classificationSchema = z.object({
  categoria: z.string(),
  reparto: z.string(),
  famiglia: z.string(),
  sottocategoria: z.string(),
});
const rowSchema = classificationSchema.extend({
  lineId: z.string(),
  productId: z.string().nullable(),
  createNew: z.boolean(),
  name: z.string(),
  unit: z.string(),
  factor: number.positive().nullable(),
  receiveQuantity: nonnegative,
  physicalQuantity: nonnegative.nullable(),
  included: z.boolean(),
  verified: z.boolean(),
  matchStatus: z.enum(["riconosciuto", "nuovo", "verifica", "escluso"]),
  matchReason: z.string(),
  candidateIds: z.array(z.string()),
  receivedQuantity: nonnegative,
  linkedMovementIds: z.array(z.string()),
});
const adjustmentSchema = z.object({
  type: z.enum(["SC", "MG"]),
  percent: number.nullable(),
  amountCents: number.nullable(),
});
const invoiceSchema = z.object({
  id: z.string(),
  sourceHash: z.string(),
  number: z.string(),
  date: z.string(),
  currency: z.string(),
  type: z.string(),
  supplierKey: z.string(),
  supplierName: z.string(),
  supplierVat: z.string().nullable(),
  totalCents: number,
  ddts: z.array(
    z.object({
      number: z.string(),
      date: z.string(),
      lineNumbers: z.array(number),
    })
  ),
  orderRefs: z.array(z.string()),
  lines: z.array(
    z.object({
      id: z.string(),
      number,
      name: z.string(),
      quantity: number.nullable(),
      unit: z.string().nullable(),
      unitPriceCents: number,
      totalCents: number,
      vatRate: number,
      codes: z.array(z.object({ type: z.string(), value: z.string() })),
      adjustments: z.array(adjustmentSchema),
      ddtRefs: z.array(z.string()),
      kind: z.enum([
        "materiale",
        "servizio",
        "accessorio",
        "sconto",
        "incerto",
      ]),
    })
  ),
});
const demoSchema = z.object({
  version: z.literal(1),
  companyScope: z.string(),
  products: z.array(
    classificationSchema.extend({
      id: z.string(),
      nome: z.string(),
      codice: z.string(),
      description: z.string(),
      unit: z.string(),
      quantity: nonnegative,
      valuationUnitCents: number,
      lastPurchaseCents: number.nullable(),
      identifiers: z.array(z.string()),
    })
  ),
  reviews: z.array(
    z.object({
      invoice: invoiceSchema,
      mode: z.enum(["acquisto", "inventario"]),
      rows: z.array(rowSchema),
      financeRegistered: z.boolean(),
      paid: z.boolean(),
    })
  ),
  aliases: z.array(
    z.object({
      id: z.string(),
      supplierKey: z.string(),
      supplierName: z.string(),
      code: z.string(),
      productId: z.string(),
      invoiceUnit: z.string(),
      productUnit: z.string(),
      factor: number.positive(),
      active: z.boolean(),
      confirmedAt: z.string(),
    })
  ),
  movements: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      delta: number,
      kind: z.enum(["carico", "rettifica", "scarico", "reso", "annullamento"]),
      invoiceId: z.string().nullable(),
      lineId: z.string().nullable(),
      reference: z.string(),
      unitCostCents: number,
      quantityBefore: nonnegative,
      quantityAfter: nonnegative,
      date: z.string(),
      linkedQuantity: nonnegative,
    })
  ),
  prices: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      supplierKey: z.string(),
      supplierName: z.string(),
      invoiceId: z.string(),
      lineId: z.string(),
      date: z.string(),
      quantity: nonnegative,
      unitPriceCents: number,
      adjustments: z.array(adjustmentSchema),
    })
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      action: z.string(),
      reference: z.string(),
      details: z.string(),
    })
  ),
  operations: z.array(z.string()),
  machine: z.object({
    id: z.string(),
    name: z.string(),
    materialCostCents: number,
  }),
  financeExpensesCents: number,
});
const sessionSchema = z.object({
  version: z.literal(1),
  scope: z.string(),
  state: demoSchema,
  drafts: z.record(z.string(), z.array(rowSchema)),
  receipts: z.record(z.string(), z.boolean()),
});
type Session = {
  state: DemoState;
  drafts: Record<string, ReviewRow[]>;
  receipts: Record<string, boolean>;
};
type Suggestion = Classification & {
  lineId: string;
  productId: string | null;
  reason: string;
  confidence: number;
};
type Confirmation = {
  title: string;
  description: string;
  label: string;
  content?: ReactNode;
  execute: () => void;
};

function money(cents: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
function qty(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 }).format(
    value
  );
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("it-IT");
}
function operation() {
  return `demo-${crypto.randomUUID()}`;
}
function fieldNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}
function rowGroup(row: ReviewRow) {
  return (
    row.productId ??
    `new:${row.name.trim().toLocaleLowerCase("it-IT")}:${row.unit.toLowerCase()}`
  );
}
function remaining(review: InvoiceReview, row: ReviewRow) {
  const line = review.invoice.lines.find(item => item.id === row.lineId);
  return line?.quantity != null
    ? Math.max(0, line.quantity - row.receivedQuantity)
    : null;
}
function rowComplete(review: InvoiceReview, row: ReviewRow, state: DemoState) {
  return review.mode === "inventario"
    ? Boolean(
        row.productId &&
          state.movements.some(
            movement =>
              movement.kind === "rettifica" &&
              movement.invoiceId === review.invoice.id &&
              movement.productId === row.productId
          )
      )
    : remaining(review, row) === 0;
}
function finished(review: InvoiceReview, state: DemoState) {
  return review.rows.every(
    row => !row.included || rowComplete(review, row, state)
  );
}
function loadSession(scope: string, key: string): Session {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const saved = sessionSchema.safeParse(JSON.parse(raw));
      if (
        saved.success &&
        saved.data.scope === scope &&
        saved.data.state.companyScope === scope
      ) {
        const state = saved.data.state;
        const ids = new Set(state.products.map(product => product.id));
        const valid =
          new Set(state.reviews.map(review => review.invoice.id)).size ===
            state.reviews.length &&
          ids.size === state.products.length &&
          state.movements.every(item => ids.has(item.productId)) &&
          state.aliases.every(item => ids.has(item.productId));
        if (valid)
          return {
            state,
            drafts: saved.data.drafts,
            receipts: saved.data.receipts,
          };
      }
      sessionStorage.removeItem(key);
    }
  } catch {
    /* Uno stato assente o non valido non viene riutilizzato. */
  }
  return { state: initialDemoState(scope), drafts: {}, receipts: {} };
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block min-w-0 space-y-1.5 text-sm text-zinc-300">
      <span id={`${id}-label`} className="block break-words">{label}</span>
      {Children.map(children, child => isValidElement(child) && (child.type === "select" || child.type === "input" || child.type === Input) ? cloneElement(child as ReactElement<{ id?: string; "aria-labelledby"?: string; "aria-describedby"?: string }>, { id, "aria-labelledby": `${id}-label`, "aria-describedby": hint ? `${id}-hint` : undefined }) : child)}
      {hint && (
        <span id={`${id}-hint`} className="block text-xs leading-relaxed text-zinc-400">
          {hint}
        </span>
      )}
    </label>
  );
}
function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md py-2 text-sm leading-relaxed">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-green-600 disabled:opacity-50"
      />
      <span className="break-words">{label}</span>
    </label>
  );
}
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800 bg-black p-3">
      <p className="text-xs leading-relaxed text-zinc-400">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

/** Le sole API utilizzate sono autenticazione/permessi, lettura XML e suggerimenti: nessuna API di stock, Finanza o Officina. */
export default function ImportaDaFatturaDemo() {
  const auth = useAuth();
  const access = trpc.access.me.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const permissions = trpc.magazzino.importazione.permessi.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
  });
  const heading = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Percorso" className="text-sm text-zinc-400">
          <Link href="/magazzino" className="text-amber-300 hover:underline">
            Magazzino
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-white">Importa</span>
        </nav>
        <Button asChild variant="outline" className={BUTTON}>
          <Link href="/magazzino">
            <ArrowLeft className="size-4" />
            Indietro
          </Link>
        </Button>
      </div>
      <h1 className="flex items-start gap-3 text-2xl font-bold text-white sm:text-3xl">
        <FilePlus2 className="mt-1 size-7 shrink-0 text-amber-400" />
        Importa da fattura
      </h1>
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="font-semibold text-amber-200">
            Demo isolata — nessuna modifica ai dati aziendali
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">
            Solo dati simulati. Carichi, anagrafica, Finanza e Officina
            rimangono nella sessione di questa scheda, separati per utente e
            azienda.
          </p>
        </div>
      </div>
    </div>
  );
  const profileCosts = Boolean(
    access.data?.isCompanyAdmin ||
      access.data?.modules.some(module => module.startsWith("finanza."))
  );
  const identityReady = Boolean(
    permissions.data &&
      auth.user &&
      access.data &&
      (!auth.user.activeCompanyId ||
        auth.user.activeCompanyId === permissions.data.companyId)
  );
  useEffect(() => {
    if (
      auth.user?.activeCompanyId &&
      permissions.data &&
      auth.user.activeCompanyId !== permissions.data.companyId
    ) {
      void permissions.refetch();
      void access.refetch();
    }
  }, [auth.user?.activeCompanyId, permissions.data?.companyId]);
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 px-3 py-5 text-white sm:px-6">
      {heading}
      {!auth.loading && !auth.user ? (
        <div className={PANEL} role="alert">
          Accedi a Fallinity per aprire la demo isolata per utente e azienda.
        </div>
      ) : auth.loading ||
        access.isLoading ||
        permissions.isLoading ||
        (!identityReady && !access.error && !permissions.error) ? (
        <div className={`${PANEL} flex items-center gap-3`} role="status">
          <Loader2 className="size-5 animate-spin text-amber-400" />
          Verifica accesso e sessione demo…
        </div>
      ) : access.error || permissions.error ? (
        <div className={PANEL} role="alert">
          <p className="text-red-300">
            Impossibile verificare i permessi. Nessuna operazione demo è
            disponibile.
          </p>
          <Button
            className={`${BUTTON} mt-3`}
            variant="outline"
            onClick={() => {
              void access.refetch();
              void permissions.refetch();
            }}
          >
            Riprova
          </Button>
        </div>
      ) : !permissions.data?.canView ? (
        <div className={PANEL}>
          Non hai il permesso di consultare l’importazione da fattura.
        </div>
      ) : identityReady && permissions.data ? (
        <DemoWorkspace
          key={`${permissions.data.companyId}:${permissions.data.userId}`}
          scope={`${permissions.data.companyId}:${permissions.data.userId}`}
          canEdit={
            permissions.data.canEdit &&
            !permissions.isFetching &&
            !access.isFetching
          }
          canSeeCosts={permissions.data.canSeeCosts && profileCosts}
        />
      ) : null}
    </div>
  );
}

function DemoWorkspace({
  scope,
  canEdit,
  canSeeCosts,
}: {
  scope: string;
  canEdit: boolean;
  canSeeCosts: boolean;
}) {
  const storageKey = `fallinity:invoice-demo:v1:${encodeURIComponent(scope)}`;
  const [initial] = useState(() => loadSession(scope, storageKey));
  const [state, setState] = useState(initial.state);
  const [drafts, setDrafts] = useState(initial.drafts);
  const [receipts, setReceipts] = useState(initial.receipts);
  const [activeId, setActiveId] = useState(
    initial.state.reviews.find(review => !finished(review, initial.state))
      ?.invoice.id ??
      initial.state.reviews[0]?.invoice.id ??
      ""
  );
  const [presetId, setPresetId] = useState(DEMO_INVOICE_PRESETS[0]?.id ?? "");
  const [mode, setMode] = useState<InvoiceReview["mode"]>(
    DEMO_INVOICE_PRESETS[0]?.mode ?? "acquisto"
  );
  const [files, setFiles] = useState<File[]>([]);
  const [manualConsent, setManualConsent] = useState(false);
  const [busy, setBusy] = useState<"preset" | "files" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [suggestions, setSuggestions] = useState<
    Record<string, { suggestions: Suggestion[]; model: string }>
  >({});
  const [delivery, setDelivery] = useState({
    productId: state.products[0]?.id ?? "",
    quantity: "10",
    reference: "DEMO-DDT-10",
  });
  const [workshopPath, setWorkshopPath] = useState<Classification>({
    categoria: "Ricambi",
    reparto: "",
    famiglia: "",
    sottocategoria: "",
  });
  const [partId, setPartId] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [returnForm, setReturnForm] = useState({
    productId: state.products[0]?.id ?? "",
    quantity: "1",
    reason: "Reso fisico al fornitore",
  });
  const alive = useRef(true);
  const currentState = useRef(state);
  currentState.current = state;
  const parseXml = trpc.magazzino.importazione.leggiXml.useMutation();
  const ai = trpc.magazzino.importazione.suggerisciAI.useMutation();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, scope, state, drafts, receipts })
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [storageKey, scope, state, drafts, receipts]);
  const active = state.reviews.find(review => review.invoice.id === activeId);
  const rows = active ? (drafts[activeId] ?? active.rows) : [];
  const structure = useMemo(() => {
    const result: Classification[] = [
      {
        categoria: "Ricambi",
        reparto: "Elettronica",
        famiglia: "Fusibili",
        sottocategoria: "Piccoli",
      },
      {
        categoria: "Ricambi",
        reparto: "Motore",
        famiglia: "Filtri",
        sottocategoria: "Olio",
      },
      {
        categoria: "Ricambi",
        reparto: "Elettronica",
        famiglia: "Sensori",
        sottocategoria: "",
      },
    ];
    for (const product of state.products)
      result.push(
        Object.fromEntries(
          KEYS.map(key => [key, product[key]])
        ) as Classification
      );
    for (const reviewRows of Object.values(drafts))
      for (const row of reviewRows)
        result.push(
          Object.fromEntries(KEYS.map(key => [key, row[key]])) as Classification
        );
    return Array.from(
      new Map(
        result.map(item => [KEYS.map(key => item[key]).join("|"), item])
      ).values()
    );
  }, [state.products, drafts]);
  const pending = state.reviews.filter(review => !finished(review, state));
  const completed = state.reviews.filter(review => finished(review, state));
  const workshopProducts = state.products.filter(
    product =>
      product.quantity > 0 &&
      KEYS.every(
        key => !workshopPath[key] || product[key] === workshopPath[key]
      )
  );
  const selectedPart = workshopProducts.find(product => product.id === partId);

  function change(
    action: (current: DemoState) => DemoState,
    success: string
  ): DemoState | null {
    if (!canEdit) {
      setError("Accesso in sola lettura: nessuna modifica demo consentita.");
      return null;
    }
    try {
      const before = currentState.current;
      const next = action(before);
      currentState.current = next;
      setState(current => (current === before ? next : action(current)));
      setError("");
      setNotice(success);
      return next;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Operazione demo non riuscita."
      );
      return null;
    }
  }
  function presetLabel(preset: (typeof DEMO_INVOICE_PRESETS)[number], short = false) {
    if (short) return ({ base: "Ricambi e servizi", storico: "Inventario iniziale", "acquisto-400": "Acquisto di 10 filtri", "alias-successivo": "Codice già associato", ddt: "Fattura e DDT", parziale: "Ricezione parziale", confezioni: "Confezioni e unità", sconto: "Sconti e prezzo netto", credito: "Nota di credito" } as Record<string, string>)[preset.id] ?? "Scenario demo";
    if (canSeeCosts) return preset.label;
    if (preset.id === "acquisto-400") return "Acquisto demo: dieci filtri";
    if (preset.id === "sconto") return "Fattura demo: due filtri";
    if (preset.id === "credito")
      return "Nota di credito: nessun reso automatico";
    return preset.label;
  }
  function downloadPreset() {
    const preset = DEMO_INVOICE_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    const url = URL.createObjectURL(
      new Blob([preset.xml], { type: "application/xml;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fallinity-demo-${preset.id}.xml`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function ask(value: Confirmation) {
    if (canEdit) {
      setError("");
      setConfirmation(value);
    }
  }
  function patchRow(lineId: string, patch: Partial<ReviewRow>) {
    if (!active || !canEdit) return;
    setDrafts(current => {
      const previous = current[activeId] ?? active.rows;
      const changed = previous.map(row =>
        row.lineId === lineId ? { ...row, ...patch } : row
      );
      // Un unico target fisico per prodotto evita la somma delle righe storiche ripetute.
      if (active.mode === "inventario" && "physicalQuantity" in patch) {
        const row = changed.find(item => item.lineId === lineId)!;
        return {
          ...current,
          [activeId]: changed.map(item =>
            rowGroup(item) === rowGroup(row)
              ? {
                  ...item,
                  physicalQuantity: patch.physicalQuantity ?? null,
                  verified: false,
                }
              : item
          ),
        };
      }
      return { ...current, [activeId]: changed };
    });
  }
  function selectProduct(lineId: string, value: string) {
    const row = rows.find(item => item.lineId === lineId)!;
    const product = state.products.find(item => item.id === value);
    const line = active?.invoice.lines.find(item => item.id === lineId);
    const sameUnit =
      product &&
      line?.unit?.trim().toLowerCase() === product.unit.trim().toLowerCase();
    const siblingTarget = product
      ? rows.find(
          item =>
            item.lineId !== lineId &&
            item.productId === product.id &&
            item.physicalQuantity != null
        )?.physicalQuantity
      : null;
    patchRow(
      lineId,
      product
        ? {
            productId: product.id,
            createNew: false,
            name: product.nome,
            unit: product.unit,
            factor: sameUnit ? 1 : null,
            receiveQuantity: 0,
            physicalQuantity: siblingTarget ?? null,
            verified: false,
            matchStatus: "verifica",
            matchReason:
              "Associazione manuale: controlla codici, caratteristiche e conversione.",
            ...Object.fromEntries(KEYS.map(key => [key, product[key]])),
          }
        : {
            productId: null,
            createNew: true,
            name: line?.name ?? row.name,
            physicalQuantity: null,
            verified: false,
            matchStatus: "nuovo",
            matchReason:
              "Creazione proposta: verifica prima che il materiale non esista già.",
          }
    );
  }
  async function readXml(xml: string, name: string) {
    const encoded = new TextEncoder().encode(xml);
    let binary = "";
    for (let index = 0; index < encoded.length; index += 8192)
      binary += String.fromCharCode(
        ...Array.from(encoded.subarray(index, index + 8192))
      );
    return (await parseXml.mutateAsync({
      nomeFile: name,
      contenutoBase64: btoa(binary),
      dimensione: encoded.length,
    })) as WarehouseInvoice;
  }
  async function importFiles(kind: "preset" | "files") {
    if (!canEdit || busy) return;
    setBusy(kind);
    setError("");
    setNotice("");
    const chosenMode = mode;
    let added = 0;
    try {
      const preset = DEMO_INVOICE_PRESETS.find(item => item.id === presetId);
      const sources =
        kind === "preset" && preset
          ? [{ name: `${preset.id}.xml`, xml: preset.xml }]
          : [];
      if (kind === "files") {
        if (!manualConsent)
          throw new Error(
            "Conferma di utilizzare soltanto file simulati prima della lettura."
          );
        if (!files.length)
          throw new Error("Seleziona almeno un file XML demo.");
        for (const file of files) {
          if (
            !file.name.toLowerCase().endsWith(".xml") ||
            file.size > 5 * 1024 * 1024
          )
            throw new Error(
              `${file.name}: seleziona un XML demo di massimo 5 MB.`
            );
          sources.push({ name: file.name, xml: await file.text() });
        }
      }
      for (const source of sources) {
        const invoice = await readXml(source.xml, source.name);
        if (!alive.current) return;
        const duplicate = currentState.current.reviews.find(
          review =>
            review.invoice.id === invoice.id ||
            review.invoice.sourceHash === invoice.sourceHash ||
            (review.invoice.supplierKey === invoice.supplierKey &&
              review.invoice.number === invoice.number &&
              review.invoice.date === invoice.date &&
              review.invoice.type === invoice.type)
        );
        const next = change(
          current =>
            duplicate
              ? current
              : addInvoiceToDemo(current, invoice, chosenMode),
          duplicate
            ? "Fattura già presente: aperta la revisione esistente, nessun secondo carico."
            : "XML letto. Controlla le righe: le giacenze non sono ancora cambiate."
        );
        if (next) {
          added += 1;
          setActiveId(
            next.reviews.find(
              review =>
                review.invoice.id === invoice.id ||
                review.invoice.sourceHash === invoice.sourceHash
            )?.invoice.id ??
              duplicate?.invoice.id ??
              invoice.id
          );
        }
      }
    } catch (cause) {
      if (alive.current)
        setError(
          `${added ? `${added} file già letto/i. ` : ""}${cause instanceof Error ? cause.message : "Impossibile leggere il file XML demo."}`
        );
    } finally {
      if (alive.current) setBusy(null);
    }
  }
  function previews(review: InvoiceReview, staged: ReviewRow[]) {
    const groups = new Map<
      string,
      {
        name: string;
        unit: string;
        before: number;
        delta: number;
        after: number;
      }
    >();
    for (const row of staged.filter(
      item =>
        item.included && item.verified && !rowComplete(review, item, state)
    )) {
      const product = state.products.find(item => item.id === row.productId);
      const key = rowGroup(row);
      const previous = groups.get(key);
      const before = product?.quantity ?? 0;
      if (review.mode === "inventario") {
        if (row.physicalQuantity != null)
          groups.set(key, {
            name: product?.nome ?? row.name,
            unit: row.unit,
            before,
            delta: row.physicalQuantity - before,
            after: row.physicalQuantity,
          });
      } else {
        const delta =
          (previous?.delta ?? 0) + row.receiveQuantity * (row.factor ?? 0);
        if (row.receiveQuantity > 0)
          groups.set(key, {
            name: product?.nome ?? row.name,
            unit: row.unit,
            before,
            delta,
            after: before + delta,
          });
      }
    }
    return Array.from(groups.values());
  }
  function confirmImport() {
    if (!active) return;
    const snapshot = structuredClone(rows);
    const ready = snapshot.filter(
      row =>
        row.included &&
        row.verified &&
        !rowComplete(active, row, state) &&
        (active.mode === "inventario"
          ? row.physicalQuantity != null
          : row.receiveQuantity > 0)
    );
    if (!ready.length) {
      setError("Verifica almeno una riga e indica la quantità da confermare.");
      return;
    }
    if (active.mode === "acquisto" && !receipts[activeId]) {
      setError("Conferma l’avvenuta ricezione della merce prima del carico.");
      return;
    }
    if (
      ready.some(
        row =>
          row.factor == null ||
          row.factor <= 0 ||
          !row.unit.trim() ||
          !row.name.trim() ||
          !row.categoria.trim() ||
          !row.reparto.trim() ||
          !row.famiglia.trim()
      )
    ) {
      setError(
        "Completa nome, unità, conversione e classificazione delle righe verificate. Il contenuto delle confezioni non viene inventato."
      );
      return;
    }
    const summary = previews(active, snapshot);
    const invoiceId = activeId;
    const confirmationData: ImportConfirmation = {
      operationId: operation(),
      invoiceId,
      receiptConfirmed: Boolean(receipts[activeId]),
      rows: snapshot.map(row =>
        rowComplete(active, row, state)
          ? { ...row, verified: false, receiveQuantity: 0 }
          : row
      ),
      expectedStock: Object.fromEntries(
        state.products.map(product => [product.id, product.quantity])
      ),
    };
    ask({
      title:
        active.mode === "inventario"
          ? "Conferma inventario iniziale"
          : "Conferma carico magazzino",
      description:
        active.mode === "inventario"
          ? "Il target fisico sostituisce la giacenza, non si somma alle quantità storiche. Nessun nuovo acquisto finanziario."
          : "Solo le righe incluse e verificate saranno caricate, per la quantità ricevuta indicata. Le altre resteranno in sospeso. Nessuna registrazione finanziaria automatica.",
      label: "Conferma nella demo",
      content: (
        <div className="space-y-2">
          {summary.map(item => (
            <div
              key={item.name}
              className="rounded-lg border border-zinc-800 p-3 text-sm"
            >
              <p className="break-words font-medium">{item.name}</p>
              <p className="mt-1 text-zinc-300">
                {qty(item.before)} → {item.delta >= 0 ? "+" : ""}
                {qty(item.delta)} →{" "}
                <strong className="text-green-300">
                  {qty(item.after)} {item.unit}
                </strong>
              </p>
            </div>
          ))}
        </div>
      ),
      execute: () => {
        const next = change(
          current => confirmDemoImport(current, confirmationData),
          "Conferma registrata nella demo. Magazzino e catalogo Officina aggiornati insieme."
        );
        if (next) {
          const updated = next.reviews.find(
            review => review.invoice.id === invoiceId
          )!;
          setDrafts(current => ({
            ...current,
            [invoiceId]: updated.rows.map(row => {
              const staged = snapshot.find(item => item.lineId === row.lineId);
              return staged && !ready.some(item => item.lineId === row.lineId)
                ? {
                    ...staged,
                    receivedQuantity: row.receivedQuantity,
                    linkedMovementIds: row.linkedMovementIds,
                  }
                : row;
            }),
          }));
          setReceipts(current => ({ ...current, [invoiceId]: false }));
        }
      },
    });
  }
  async function requestSuggestions() {
    if (!active || !canEdit || ai.isPending) return;
    const invoiceId = activeId;
    setError("");
    try {
      const result = await ai.mutateAsync({
        invoice: {
          lines: active.invoice.lines
            .slice(0, 50)
            .map(({ id, name, codes }) => ({
              id,
              name: name.slice(0, 1200),
              codes: codes.slice(0, 30),
            })),
        },
        products: state.products
          .slice(0, 150)
          .map(
            ({
              id,
              nome,
              codice,
              description,
              identifiers,
              categoria,
              reparto,
              famiglia,
              sottocategoria,
            }) => ({
              id,
              nome,
              codice,
              description: description.slice(0, 1200),
              identifiers: identifiers.slice(0, 30),
              categoria,
              reparto,
              famiglia,
              sottocategoria,
            })
          ),
        structure: structure.slice(0, 150),
      });
      if (alive.current)
        setSuggestions(current => ({ ...current, [invoiceId]: result }));
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Suggerimenti IA non disponibili: puoi continuare la revisione manuale."
        );
    }
  }
  function acceptSuggestion(suggestion: Suggestion) {
    const product = state.products.find(
      item => item.id === suggestion.productId
    );
    if (product) selectProduct(suggestion.lineId, product.id);
    patchRow(suggestion.lineId, {
      ...Object.fromEntries(KEYS.map(key => [key, suggestion[key]])),
      verified: false,
      matchStatus: "verifica",
      matchReason: `Suggerimento IA accettato, da verificare: ${suggestion.reason}`,
    });
    setSuggestions(current => ({
      ...current,
      [activeId]: {
        ...current[activeId],
        suggestions: current[activeId].suggestions.filter(
          item => item.lineId !== suggestion.lineId
        ),
      },
    }));
  }

  return (
    <>
      {!canEdit && (
        <div
          className="rounded-lg border border-sky-800 bg-sky-950/30 p-4 text-sm text-sky-200"
          role="status"
        >
          Sola lettura: puoi consultare la demo, ma non modificare dati,
          caricare XML o confermare operazioni.
        </div>
      )}
      {storageError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-700 p-3 text-sm text-amber-200"
        >
          Salvataggio nella sessione non disponibile. La demo resta isolata ma
          le modifiche potrebbero andare perse ricaricando la pagina.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="break-words rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-900 bg-green-950/20 p-3 text-sm text-green-200"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{notice}</span>
        </div>
      )}
      <section className={PANEL} aria-labelledby="demo-import-title">
        <h2
          id="demo-import-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <FileText className="size-5 text-sky-300" />
          1. Leggi una fattura demo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          XML strutturato per quantità e prezzi; IA soltanto per suggerire
          associazioni e classificazioni. Nessun carico senza revisione e
          conferma.
        </p>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
          <Field label="Modalità prima dell’importazione">
            <select
              value={mode}
              disabled={!canEdit || Boolean(busy)}
              onChange={event =>
                setMode(event.target.value as InvoiceReview["mode"])
              }
              className={CONTROL}
            >
              <option value="acquisto">Nuovo acquisto</option>
              <option value="inventario">Inventario iniziale</option>
            </select>
          </Field>
          <Field label="Fattura XML simulata">
            <select
              value={presetId}
              disabled={!canEdit || Boolean(busy)}
              onChange={event => {
                setPresetId(event.target.value);
                setMode(
                  DEMO_INVOICE_PRESETS.find(
                    item => item.id === event.target.value
                  )?.mode ?? "acquisto"
                );
              }}
              className={CONTROL}
            >
              {DEMO_INVOICE_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {presetLabel(preset, true)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button
          className={`${BLUE} mt-4 w-full sm:w-auto`}
          disabled={!canEdit || Boolean(busy) || !presetId}
          onClick={() => void importFiles("preset")}
        >
          {busy === "preset" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FilePlus2 className="size-4" />
          )}
          {busy === "preset"
            ? "Lettura fattura simulata…"
            : "Leggi fattura simulata"}
        </Button>
        {canSeeCosts && (
          <Button
            variant="outline"
            className={`${BUTTON} mt-3 w-full sm:ml-3 sm:w-auto`}
            disabled={!presetId}
            onClick={downloadPreset}
          >
            Scarica XML simulato
          </Button>
        )}
        <p className="mt-3 break-words text-sm leading-relaxed text-sky-200">
          Scenario selezionato:{" "}
          {DEMO_INVOICE_PRESETS.find(item => item.id === presetId)
            ? presetLabel(
                DEMO_INVOICE_PRESETS.find(item => item.id === presetId)!
              )
            : "nessuno"}
        </p>
        {canSeeCosts && (
          <details className="mt-4 rounded-lg border border-zinc-800 p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-sky-200">
              Esempio finanziario guidato · 10 × 40 €
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              La demo normale parte da due filtri. Per verificare esattamente 10
              acquistati → 9 rimasti, prepara una sessione dimostrativa con
              stock zero, leggi la fattura da 400 €, verifica e carica 10
              filtri, registra una sola fattura in Finanza, poi preleva un
              filtro per Fendt 822: costo materiali 40 €, spese sempre 400 €.
            </p>
            <Button
              variant="outline"
              className={`${BLUE} mt-3 w-full`}
              disabled={!canEdit || Boolean(busy) || ai.isPending}
              onClick={() =>
                ask({
                  title: "Prepara esempio finanziario isolato",
                  description:
                    "Ripristina soltanto questa sessione demo con giacenza iniziale zero. Seleziona la fattura simulata 10 filtri × 40 €. Nessuna lettura XML o registrazione verrà eseguita automaticamente.",
                  label: "Prepara scenario demo",
                  execute: () => {
                    const prepared = initialDemoState(scope);
                    prepared.products = prepared.products.map(product => ({
                      ...product,
                      quantity: 0,
                    }));
                    currentState.current = prepared;
                    setState(() => prepared);
                    setDrafts({});
                    setReceipts({});
                    setSuggestions({});
                    setActiveId("");
                    setPartId("");
                    setPresetId("acquisto-400");
                    setMode("acquisto");
                    setNotice(
                      "Scenario finanziario pronto con stock iniziale zero. Leggi la fattura simulata e conferma il carico di 10 filtri."
                    );
                    setError("");
                  },
                })
              }
            >
              Prepara caso 10 filtri → 9 (stock iniziale 0)
            </Button>
          </details>
        )}
        <details className="mt-4 rounded-lg border border-zinc-800 p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-sky-200">
            Carica manualmente XML demo (anche multipli)
          </summary>
          <div className="mt-2 space-y-3">
            <p className="text-sm leading-relaxed text-zinc-400">
              Il file viene letto dal parser, ma non registrato nei dati
              aziendali. Usa esclusivamente fatture simulate: non caricare XML
              reali o dati riservati. L’IA, se richiesta, analizza le
              descrizioni.
            </p>
            <Field label="Seleziona XML simulati · massimo 5 MB ciascuno">
              <Input
                type="file"
                accept=".xml,application/xml,text/xml"
                multiple
                className={`${CONTROL} h-auto file:mr-2 file:text-sky-200`}
                disabled={!canEdit || Boolean(busy)}
                onChange={event =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
            </Field>
            {files.length > 0 && (
              <ul className="space-y-1 text-xs text-zinc-400">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="break-all">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
            <Check
              label="Confermo che i file contengono soltanto dati simulati"
              checked={manualConsent}
              disabled={!canEdit || Boolean(busy)}
              onChange={setManualConsent}
            />
            <Button
              className={`${BLUE} w-full sm:w-auto`}
              disabled={
                !canEdit || Boolean(busy) || !manualConsent || !files.length
              }
              onClick={() => void importFiles("files")}
            >
              {busy === "files" && <Loader2 className="size-4 animate-spin" />}
              {busy === "files"
                ? "Lettura XML demo…"
                : "Leggi XML demo selezionati"}
            </Button>
          </div>
        </details>
        <p className="mt-4 text-xs leading-relaxed text-amber-200/90">
          Produzione e carico automatico non attivi. Acquisizione SDI:
          integrazione futura tramite servizi autorizzati, non collegata in
          questa demo.
        </p>
      </section>

      <section className={PANEL} aria-labelledby="review-list-title">
        <h2 id="review-list-title" className="text-lg font-semibold">
          2. Revisioni fatture
        </h2>
        <div className="mt-3 space-y-3">
          {[
            { title: "In attesa di revisione", list: pending },
            { title: "Importazioni completate", list: completed },
          ].map(group => (
            <details
              key={group.title}
              open={group.title === "In attesa di revisione"}
              className="rounded-lg border border-zinc-800 p-3"
            >
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-amber-200">
                {group.title} ({group.list.length})
              </summary>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                {group.list.map(review => (
                  <button
                    key={review.invoice.id}
                    type="button"
                    onClick={() => setActiveId(review.invoice.id)}
                    aria-pressed={activeId === review.invoice.id}
                    className={`min-h-11 min-w-0 rounded-lg border p-3 text-left text-sm transition-colors ${activeId === review.invoice.id ? "border-amber-500/60 bg-amber-950/20" : "border-zinc-800 hover:bg-zinc-900"}`}
                  >
                    <span className="block break-words font-medium">
                      {review.invoice.supplierName}
                    </span>
                    <span className="mt-1 block break-words text-xs text-zinc-400">
                      Fattura {review.invoice.number} ·{" "}
                      {date(review.invoice.date)} ·{" "}
                      {review.mode === "inventario"
                        ? "Inventario iniziale"
                        : "Nuovo acquisto"}
                    </span>
                  </button>
                ))}
                {group.list.length === 0 && (
                  <p className="py-2 text-sm text-zinc-400">
                    Nessuna fattura in questa sezione.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {active && (
        <section
          className={`${PANEL} space-y-4`}
          aria-labelledby="invoice-review-title"
        >
          <div className="min-w-0">
            <h2
              id="invoice-review-title"
              className="break-words text-xl font-semibold"
            >
              Fattura {active.invoice.number} — {active.invoice.supplierName}
            </h2>
            <p className="mt-1 break-words text-sm text-zinc-400">
              {date(active.invoice.date)} ·{" "}
              {active.mode === "inventario"
                ? "Inventario iniziale"
                : "Nuovo acquisto"}
              {active.invoice.supplierVat
                ? ` · P. IVA ${active.invoice.supplierVat}`
                : ""}
            </p>
            <details className="mt-2 text-xs text-zinc-400">
              <summary className="min-h-11 cursor-pointer py-2 text-sky-200">
                Identificativo e riferimenti documento
              </summary>
              <p className="break-all">ID: {active.invoice.id}</p>
              <p className="mt-1 break-words">
                DDT:{" "}
                {active.invoice.ddts
                  .map(ddt => `${ddt.number} (${date(ddt.date)})`)
                  .join(", ") || "non indicati"}
              </p>
              <p className="mt-1 break-words">
                Ordini: {active.invoice.orderRefs.join(", ") || "non indicati"}
              </p>
            </details>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Righe analizzate" value={rows.length} />
            <Stat
              label="Articoli riconosciuti"
              value={
                rows.filter(
                  row => row.included && row.matchStatus === "riconosciuto"
                ).length
              }
            />
            <Stat
              label="Nuovi articoli proposti"
              value={rows.filter(row => row.included && row.createNew).length}
            />
            <Stat
              label="Da verificare"
              value={rows.filter(row => row.included && !row.verified).length}
            />
          </div>
          {active.invoice.type === "TD04" && (
            <p className="rounded-lg border border-amber-800 p-3 text-sm text-amber-200">
              Nota di credito: non genera scarichi automatici. Per una
              restituzione reale del materiale usa la funzione «Reso fisico
              demo» in basso.
            </p>
          )}
          {active.mode === "inventario" && (
            <p className="rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-sm leading-relaxed text-amber-200">
              Le quantità storiche non sono le giacenze attuali. Indica un solo
              target fisico per articolo: verrà condiviso tra le righe dello
              stesso prodotto e registrato come rettifica, senza nuova spesa
              aziendale.
            </p>
          )}
          <Button
            variant="outline"
            className={`${BLUE} w-full sm:w-auto`}
            disabled={!canEdit || ai.isPending}
            onClick={() => void requestSuggestions()}
          >
            {ai.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {ai.isPending
              ? "Richiesta suggerimenti…"
              : "Suggerisci associazioni con IA"}
          </Button>
          <p className="text-xs leading-relaxed text-zinc-400">
            Facoltativo. Nessun suggerimento viene applicato senza accettazione;
            l’IA non modifica quantità, prezzi o giacenze.
          </p>
          {suggestions[activeId] && (
            <div className="space-y-2 rounded-lg border border-sky-900 p-3">
              <p className="break-words text-xs text-sky-200">
                Suggerimenti · {suggestions[activeId].model}
              </p>
              {suggestions[activeId].suggestions.map(suggestion => (
                <div
                  key={suggestion.lineId}
                  className="space-y-2 rounded-lg bg-black p-3 text-sm"
                >
                  <p className="break-words font-medium">
                    {
                      active.invoice.lines.find(
                        line => line.id === suggestion.lineId
                      )?.name
                    }
                  </p>
                  <p className="break-words text-zinc-300">
                    {state.products.find(
                      product => product.id === suggestion.productId
                    )?.nome ?? "Classificazione proposta"}{" "}
                    ·{" "}
                    {KEYS.map(key => suggestion[key])
                      .filter(Boolean)
                      .join(" → ")}
                  </p>
                  <p className="break-words text-xs text-zinc-400">
                    {suggestion.reason} · affidabilità{" "}
                    {Math.round(suggestion.confidence * 100)}%
                  </p>
                  <Button
                    variant="outline"
                    className={BLUE}
                    disabled={!canEdit}
                    onClick={() => acceptSuggestion(suggestion)}
                  >
                    Accetta suggerimento da verificare
                  </Button>
                </div>
              ))}
              {suggestions[activeId].suggestions.length === 0 && (
                <p className="text-sm text-zinc-400">
                  Nessun suggerimento da accettare.
                </p>
              )}
            </div>
          )}
          <div className="space-y-3">
            {rows.map(row => (
              <ReviewCard
                key={`${activeId}:${row.lineId}`}
                review={active}
                row={row}
                state={state}
                structure={structure}
                canEdit={canEdit && active.invoice.type !== "TD04"}
                canSeeCosts={canSeeCosts}
                onPatch={patch => patchRow(row.lineId, patch)}
                onProduct={value => selectProduct(row.lineId, value)}
                onLink={(movementId, quantity) => {
                  const invoiceId = activeId;
                  const lineId = row.lineId;
                  const movement = state.movements.find(
                    item => item.id === movementId
                  );
                  ask({
                    title: "Collega un carico già registrato",
                    description: `${qty(quantity)} ${active.invoice.lines.find(line => line.id === row.lineId)?.unit ?? "UM fattura"} (${qty(quantity * (row.factor ?? 0))} ${row.unit}) dalla movimentazione ${movement?.reference ?? movementId}. La fattura viene collegata al DDT: la giacenza non aumenta nuovamente.`,
                    label: "Conferma collegamento demo",
                    execute: () => {
                      const next = change(current => {
                        const staged = confirmDemoImport(current, {
                          operationId: `stage-ddt:${invoiceId}:${lineId}:${movementId}:${quantity}:${current.operations.length}`,
                          invoiceId,
                          receiptConfirmed: false,
                          rows: rows.map(item => ({
                            ...item,
                            receiveQuantity: 0,
                            verified:
                              item.lineId === lineId ? row.verified : false,
                          })),
                        });
                        return linkDemoDelivery(staged, {
                          invoiceId,
                          lineId,
                          movementId,
                          quantity,
                          operationId: `link-ddt:${invoiceId}:${lineId}:${movementId}:${quantity}:${current.operations.length}`,
                        });
                      }, "Carico precedente collegato. Nessun secondo incremento della giacenza.");
                      if (next)
                        setDrafts(current => {
                          const canonical = next.reviews.find(
                            item => item.invoice.id === invoiceId
                          )!.rows;
                          return {
                            ...current,
                            [invoiceId]: (current[invoiceId] ?? canonical).map(
                              item => {
                                const updated = canonical.find(
                                  candidate => candidate.lineId === item.lineId
                                )!;
                                return item.lineId === lineId
                                  ? {
                                      ...item,
                                      receivedQuantity:
                                        updated.receivedQuantity,
                                      linkedMovementIds:
                                        updated.linkedMovementIds,
                                      receiveQuantity: updated.receiveQuantity,
                                      verified: updated.verified,
                                    }
                                  : item;
                              }
                            ),
                          };
                        });
                    },
                  });
                }}
              />
            ))}
          </div>
          <div className="space-y-3 rounded-xl border border-green-900 bg-green-950/10 p-4">
            <h3 className="font-semibold text-green-200">
              Anteprima finale · prima → variazione → dopo
            </h3>
            {previews(active, rows).map(item => (
              <div
                key={`${item.name}:${item.unit}`}
                className="min-w-0 rounded-lg border border-zinc-800 p-3"
              >
                <p className="break-words text-sm font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {qty(item.before)} → {item.delta >= 0 ? "+" : ""}
                  {qty(item.delta)} →{" "}
                  <strong className="text-green-300">
                    {qty(item.after)} {item.unit}
                  </strong>
                </p>
              </div>
            ))}
            {previews(active, rows).length === 0 && (
              <p className="text-sm text-zinc-400">
                Nessuna quantità pronta: includi e verifica le righe da
                confermare.
              </p>
            )}
            <p className="text-xs leading-relaxed text-zinc-400">
              {rows.filter(row => row.included && !row.verified).length} righe
              da verificare restano pendenti. Le anteprime sono nell’unità del
              Magazzino dopo conversione; ricezione e collegamento DDT sono
              nell’UM della fattura.
            </p>
            {active.mode === "acquisto" && (
              <Check
                label="Confermo che la merce indicata è stata effettivamente ricevuta"
                checked={Boolean(receipts[activeId])}
                disabled={!canEdit}
                onChange={checked =>
                  setReceipts(current => ({ ...current, [activeId]: checked }))
                }
              />
            )}
            <Button
              className={`${GREEN} w-full`}
              disabled={
                !canEdit ||
                active.invoice.type === "TD04" ||
                previews(active, rows).length === 0 ||
                (active.mode === "acquisto" && !receipts[activeId])
              }
              onClick={confirmImport}
            >
              <CheckCircle2 className="size-4" />
              {active.mode === "inventario"
                ? "Conferma inventario iniziale"
                : "Conferma carico magazzino"}
            </Button>
          </div>
          {canSeeCosts && (
            <div className="space-y-3 rounded-lg border border-sky-900 p-4">
              <h3 className="font-semibold text-sky-200">
                Finanza demo · distinta dal carico
              </h3>
              <p className="text-sm">
                Totale documento:{" "}
                <strong>
                  {money(active.invoice.totalCents, active.invoice.currency)}
                </strong>
              </p>
              <p className="text-sm text-zinc-400">
                {active.financeRegistered
                  ? "Fattura già registrata: nessuna doppia spesa."
                  : "Fattura non registrata nella Finanza demo."}{" "}
                {active.paid
                  ? "Pagamento demo già registrato."
                  : "Pagamento non registrato."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className={BLUE}
                  disabled={
                    !canEdit ||
                    active.financeRegistered ||
                    active.mode === "inventario"
                  }
                  onClick={() => {
                    const id = activeId;
                    ask({
                      title: "Registra fattura in Finanza demo",
                      description: `Registra una sola spesa documentale di ${money(active.invoice.type === "TD04" ? -Math.abs(active.invoice.totalCents) : active.invoice.totalCents, active.invoice.currency)}. Nessuna giacenza viene modificata e nessun pagamento viene effettuato.`,
                      label: "Registra spesa demo",
                      execute: () => {
                        change(
                          current => registerDemoFinance(current, id),
                          "Spesa fattura registrata una volta nella Finanza demo."
                        );
                      },
                    });
                  }}
                >
                  Registra fattura demo
                </Button>
                <Button
                  className={BLUE}
                  disabled={
                    !canEdit || !active.financeRegistered || active.paid
                  }
                  onClick={() => {
                    const id = activeId;
                    ask({
                      title: "Registra pagamento demo",
                      description:
                        "Il pagamento è soltanto uno stato simulato, distinto dalla registrazione della fattura. Non genera una nuova spesa né trasferimenti reali.",
                      label: "Conferma pagamento demo",
                      execute: () => {
                        change(
                          current => payDemoInvoice(current, id),
                          "Pagamento simulato registrato. Spese aziendali invariate."
                        );
                      },
                    });
                  }}
                >
                  Segna pagata nella demo
                </Button>
              </div>
              {active.mode === "inventario" && (
                <p className="text-xs text-amber-200">
                  Inventario iniziale: acquisto storico, nessuna nuova
                  registrazione finanziaria.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className={PANEL} aria-labelledby="delivery-title">
        <h2
          id="delivery-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Truck className="size-5 text-sky-300" />
          DDT demo · merce prima della fattura
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Registra un ricevimento simulato, poi collegalo alla riga della
          fattura con il pulsante dedicato. Il collegamento non effettua un
          secondo carico.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Articolo ricevuto">
            <select
              value={delivery.productId}
              disabled={!canEdit}
              className={CONTROL}
              onChange={event =>
                setDelivery(current => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
            >
              {state.products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantità ricevuta nell’UM del Magazzino">
            <Input
              className={CONTROL}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={delivery.quantity}
              disabled={!canEdit}
              onChange={event =>
                setDelivery(current => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Riferimento DDT simulato">
            <Input
              className={CONTROL}
              value={delivery.reference}
              disabled={!canEdit}
              onChange={event =>
                setDelivery(current => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <Button
          className={`${BLUE} mt-4 w-full sm:w-auto`}
          disabled={
            !canEdit ||
            !delivery.productId ||
            !(Number(delivery.quantity) > 0) ||
            !delivery.reference.trim()
          }
          onClick={() => {
            const data = {
              productId: delivery.productId,
              quantity: Number(delivery.quantity),
              reference: delivery.reference.trim(),
              operationId: operation(),
            };
            const product = state.products.find(
              item => item.id === data.productId
            )!;
            ask({
              title: "Conferma ricevimento DDT demo",
              description: `${product.nome}: ${qty(product.quantity)} → ${qty(product.quantity + data.quantity)} ${product.unit}. Registra soltanto un carico fisico simulato con riferimento ${data.reference}.`,
              label: "Conferma ricevimento demo",
              execute: () => {
                change(
                  current => recordDemoDelivery(current, data),
                  "DDT demo caricato. Collega la fattura senza ricaricare la stessa merce."
                );
              },
            });
          }}
        >
          <Truck className="size-4" />
          Registra ricevimento DDT demo
        </Button>
      </section>

      <section className={PANEL} aria-labelledby="catalog-title">
        <h2
          id="catalog-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Package className="size-5 text-amber-300" />
          3. Anagrafica unica · Magazzino demo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Questi stessi articoli alimentano il Menù operatore, senza creare una
          seconda anagrafica. Valore dimostrativo al costo di riferimento demo
          fissato, distinto dall’ultimo prezzo; metodo definitivo da progettare
          con Finanza.
        </p>
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
          {state.products.map(product => (
            <article
              key={product.id}
              className="min-w-0 rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words font-medium">
                  {product.nome}
                </h3>
                <span className="shrink-0 text-sm font-semibold text-green-300">
                  {qty(product.quantity)} {product.unit}
                </span>
              </div>
              <p className="mt-2 break-words text-xs text-amber-200">
                {KEYS.map(key => product[key])
                  .filter(Boolean)
                  .join(" → ")}
              </p>
              <p className="mt-1 break-words text-xs text-zinc-400">
                Codice: {product.codice || "—"}
              </p>
              {canSeeCosts && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p className="text-zinc-400">
                    Ultimo acquisto
                    <strong className="mt-1 block text-white">
                      {product.lastPurchaseCents == null
                        ? "—"
                        : money(product.lastPurchaseCents)}
                    </strong>
                  </p>
                  <p className="text-zinc-400">
                    Costo di riferimento demo / {product.unit}
                    <strong className="mt-1 block text-white">
                      {money(product.valuationUnitCents)}
                    </strong>
                  </p>
                  <p className="text-zinc-400">
                    Valore scorte demo
                    <strong className="mt-1 block text-white">
                      {money(product.quantity * product.valuationUnitCents)}
                    </strong>
                  </p>
                </div>
              )}
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm text-sky-200">
                  Codici fornitori e conversioni
                </summary>
                <div className="space-y-2 text-xs text-zinc-400">
                  {state.aliases
                    .filter(alias => alias.productId === product.id)
                    .map(alias => (
                      <p key={alias.id} className="break-words">
                        {alias.supplierName} · {alias.code} · 1{" "}
                        {alias.invoiceUnit} = {qty(alias.factor)}{" "}
                        {alias.productUnit} ·{" "}
                        {alias.active ? "associazione attiva" : "storica"}
                      </p>
                    ))}
                  {state.aliases.every(
                    alias => alias.productId !== product.id
                  ) && <p>Nessun codice fornitore confermato.</p>}
                  <p className="break-words">
                    Identificativi:{" "}
                    {product.identifiers.join(", ") || "non disponibili"}
                  </p>
                </div>
              </details>
              {canSeeCosts && (
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm text-sky-200">
                    Storico prezzi e fatture
                  </summary>
                  <div className="space-y-2 text-xs text-zinc-400">
                    {state.prices
                      .filter(price => price.productId === product.id)
                      .map(price => (
                        <p key={price.id} className="break-words">
                          {date(price.date)} · {price.supplierName} ·{" "}
                          {qty(price.quantity)} {product.unit} ·{" "}
                          {money(price.unitPriceCents)} / {product.unit} ·
                          fattura{" "}
                          {state.reviews.find(
                            review => review.invoice.id === price.invoiceId
                          )?.invoice.number ?? price.invoiceId}
                          {price.adjustments.length
                            ? ` · ${price.adjustments.map(adjustment => `${adjustment.type === "SC" ? "sconto" : "maggiorazione"} ${adjustment.percent != null ? `${adjustment.percent}%` : adjustment.amountCents != null ? money(adjustment.amountCents) : ""}`).join(", ")}`
                            : ""}
                        </p>
                      ))}
                    {state.prices.every(
                      price => price.productId !== product.id
                    ) && <p>Nessun acquisto importato nella demo.</p>}
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>

      <section
        className={`${PANEL} space-y-4`}
        aria-labelledby="workshop-title"
      >
        <h2
          id="workshop-title"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Wrench className="size-5 text-green-300" />
          4. Officina F-006 · Menù operatore demo
        </h2>
        <p className="text-sm text-zinc-400">
          Trattori → 822 → materiali. Il catalogo è filtrato in tempo reale per
          classificazione e giacenza maggiore di zero.
        </p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KEYS.map((key, index) => {
            const options = Array.from(
              new Set(
                state.products
                  .filter(
                    product =>
                      product.quantity > 0 &&
                      KEYS.slice(0, index).every(
                        parent =>
                          !workshopPath[parent] ||
                          product[parent] === workshopPath[parent]
                      )
                  )
                  .map(product => product[key])
                  .filter(Boolean)
              )
            ).sort();
            return (
              <Field key={key} label={TITLES[key]}>
                <select
                  value={workshopPath[key]}
                  className={CONTROL}
                  onChange={event => {
                    setWorkshopPath(
                      current =>
                        Object.fromEntries(
                          KEYS.map((field, fieldIndex) => [
                            field,
                            field === key
                              ? event.target.value
                              : fieldIndex > index
                                ? ""
                                : current[field],
                          ])
                        ) as Classification
                    );
                    setPartId("");
                  }}
                >
                  <option value="">Tutte</option>
                  {options.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            );
          })}
        </div>
        <p className="break-words text-sm text-amber-200">
          {KEYS.map(key => workshopPath[key])
            .filter(Boolean)
            .join(" → ") || "Tutti i materiali disponibili"}{" "}
          · {workshopProducts.length} articoli
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ricambio disponibile">
            <select
              className={CONTROL}
              value={partId}
              onChange={event => setPartId(event.target.value)}
            >
              <option value="">Seleziona un ricambio</option>
              {workshopProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nome} · {qty(product.quantity)} {product.unit}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantità da prelevare">
            <Input
              className={CONTROL}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={partQuantity}
              disabled={!canEdit}
              onChange={event => setPartQuantity(event.target.value)}
            />
          </Field>
        </div>
        {selectedPart && (
          <div className="rounded-lg border border-zinc-800 p-3 text-sm">
            <p className="break-words">
              {selectedPart.nome} · disponibili{" "}
              <strong className="text-green-300">
                {qty(selectedPart.quantity)} {selectedPart.unit}
              </strong>
            </p>
            {canSeeCosts && (
              <p className="mt-1 text-zinc-400">
                Costo materiali del prelievo:{" "}
                {money(
                  Number(partQuantity || 0) * selectedPart.valuationUnitCents
                )}
              </p>
            )}
          </div>
        )}
        <Button
          className={`${GREEN} w-full sm:w-auto`}
          disabled={
            !canEdit ||
            !selectedPart ||
            !(Number(partQuantity) > 0) ||
            Number(partQuantity) > (selectedPart?.quantity ?? 0)
          }
          onClick={() => {
            if (!selectedPart) return;
            const data = {
              productId: selectedPart.id,
              quantity: Number(partQuantity),
              operationId: operation(),
            };
            ask({
              title: "Conferma prelievo per Fendt 822",
              description: `${selectedPart.nome}: preleva ${qty(data.quantity)} ${selectedPart.unit}. Giacenza ${qty(selectedPart.quantity)} → ${qty(selectedPart.quantity - data.quantity)}. Il materiale viene attribuito al mezzo e all’intervento demo; le spese aziendali non aumentano.`,
              label: "Conferma prelievo demo",
              execute: () => {
                change(
                  current => withdrawDemoPart(current, data),
                  "Prelievo registrato per Fendt 822. Costo materiali attribuito al mezzo, spese aziendali invariate."
                );
              },
            });
          }}
        >
          <Wrench className="size-4" />
          Preleva per Fendt 822
        </Button>
        {canSeeCosts && (
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Costi materiali Fendt 822 / intervento demo"
              value={money(state.machine.materialCostCents)}
            />
            <Stat
              label="Spese totali aziendali demo"
              value={money(state.financeExpensesCents)}
            />
            <Stat
              label="Valore residuo scorte demo"
              value={money(
                state.products.reduce(
                  (total, product) =>
                    total + product.quantity * product.valuationUnitCents,
                  0
                )
              )}
            />
            <Stat label="Spese dal prelievo" value="0,00 €" />
          </div>
        )}
        <details className="rounded-lg border border-zinc-800 p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-sky-200">
            Storico materiali dell’intervento Fendt 822
          </summary>
          <div className="mt-2 space-y-2">
            {state.movements
              .filter(movement => movement.kind === "scarico")
              .map(movement => (
                <div
                  key={movement.id}
                  className="rounded-md bg-black p-3 text-sm"
                >
                  <p className="break-words">
                    {
                      state.products.find(
                        product => product.id === movement.productId
                      )?.nome
                    }{" "}
                    · {qty(-movement.delta)} unità · {date(movement.date)}
                  </p>
                  <p className="mt-1 break-words text-xs text-zinc-400">
                    {movement.reference} · stock {qty(movement.quantityBefore)}{" "}
                    → {qty(movement.quantityAfter)}
                    {canSeeCosts
                      ? ` · costo storico ${money(-movement.delta * movement.unitCostCents)}`
                      : ""}
                  </p>
                </div>
              ))}
            {state.movements.every(movement => movement.kind !== "scarico") && (
              <p className="text-sm text-zinc-400">
                Nessun prelievo ancora registrato.
              </p>
            )}
          </div>
        </details>
      </section>

      <details className={PANEL}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-amber-200">
          Reso fisico demo · senza scarico automatico da nota di credito
        </summary>
        <p className="mt-2 text-sm text-zinc-400">
          Restituzione reale simulata al fornitore. Lo storico resta
          consultabile; non modifica automaticamente spese o pagamenti.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Articolo restituito">
            <select
              className={CONTROL}
              value={returnForm.productId}
              disabled={!canEdit}
              onChange={event =>
                setReturnForm(current => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
            >
              {state.products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantità da restituire">
            <Input
              className={CONTROL}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={returnForm.quantity}
              disabled={!canEdit}
              onChange={event =>
                setReturnForm(current => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Motivo e riferimento">
            <Input
              className={CONTROL}
              value={returnForm.reason}
              disabled={!canEdit}
              onChange={event =>
                setReturnForm(current => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <Button
          variant="outline"
          className={`${BUTTON} mt-4 w-full sm:w-auto`}
          disabled={
            !canEdit ||
            !(Number(returnForm.quantity) > 0) ||
            !returnForm.reason.trim()
          }
          onClick={() => {
            const data = {
              productId: returnForm.productId,
              quantity: Number(returnForm.quantity),
              reason: returnForm.reason.trim(),
              operationId: operation(),
            };
            const product = state.products.find(
              item => item.id === data.productId
            );
            ask({
              title: "Conferma reso fisico demo",
              description: `${product?.nome}: restituzione di ${qty(data.quantity)} ${product?.unit}. Viene creata una movimentazione tracciata, non cancellato lo storico.`,
              label: "Conferma reso demo",
              execute: () => {
                change(
                  current => returnDemoPart(current, data),
                  "Reso fisico demo registrato e tracciato nello storico."
                );
              },
            });
          }}
        >
          Registra reso fisico demo
        </Button>
      </details>

      <InvoiceAliasEditor state={state} canEdit={canEdit} onConfirm={input => ask({ title: "Correggi associazione fornitore nella demo", description: `Collega il codice del fornitore a ${state.products.find(p => p.id === input.productId)?.nome}. Conversione: 1 ${input.invoiceUnit} = ${input.factor} ${state.products.find(p => p.id === input.productId)?.unit}. Motivo: ${input.reason}. La versione precedente resta nello storico; nessuna giacenza o spesa sarà modificata.`, label: "Conferma correzione demo", execute: () => { change(current => changeAlias(current, input), "Associazione aggiornata per le prossime fatture. Storico e costi passati preservati."); } })} />

      <section className={PANEL}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <History className="size-5 text-sky-300" />
          Storico verificabile della demo
        </h2>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-sky-200">
            Movimentazioni ({state.movements.length})
          </summary>
          <div className="mt-2 space-y-2">
            {[...state.movements].reverse().map(movement => (
              <div
                key={movement.id}
                className="min-w-0 rounded-lg border border-zinc-800 p-3 text-sm"
              >
                <p className="break-words font-medium">
                  {
                    state.products.find(
                      product => product.id === movement.productId
                    )?.nome
                  }{" "}
                  · {movement.kind}
                </p>
                <p className="mt-1 break-words text-xs text-zinc-400">
                  {date(movement.date)} · {movement.reference} ·{" "}
                  {qty(movement.quantityBefore)} →{" "}
                  {movement.delta >= 0 ? "+" : ""}
                  {qty(movement.delta)} → {qty(movement.quantityAfter)} · già
                  collegati {qty(movement.linkedQuantity)}
                  {canSeeCosts
                    ? ` · costo unitario storico ${money(movement.unitCostCents)}`
                    : ""}
                </p>
                {movement.invoiceId && (
                  <button
                    type="button"
                    className="min-h-11 break-all py-2 text-left text-xs text-sky-300 hover:underline"
                    onClick={() => setActiveId(movement.invoiceId!)}
                  >
                    Apri fattura{" "}
                    {state.reviews.find(
                      review => review.invoice.id === movement.invoiceId
                    )?.invoice.number ?? movement.invoiceId}
                  </button>
                )}
              </div>
            ))}
            {state.movements.length === 0 && (
              <p className="text-sm text-zinc-400">
                Nessuna movimentazione: la lettura XML non carica il Magazzino.
              </p>
            )}
          </div>
        </details>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-sky-200">
            Registro operazioni ({state.audit.length})
          </summary>
          <ol className="mt-2 space-y-2">
            {[...state.audit].reverse().map(item => (
              <li
                key={item.id}
                className="min-w-0 rounded-lg border border-zinc-800 p-3 text-xs"
              >
                <p className="break-words text-zinc-200">
                  {date(item.date)} · {item.action}
                </p>
                <p className="mt-1 break-words text-zinc-400">
                  {item.reference}
                </p>
                {canSeeCosts && (
                  <p className="mt-1 break-words text-zinc-400">
                    {item.details}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      </section>
      <div className="flex flex-col items-start gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-zinc-400">
          La sessione è solo di questa scheda. Nessuna attivazione della
          funzionalità in produzione.
        </p>
        <Button
          variant="outline"
          className={`${BUTTON} w-full border-red-900 text-red-300 hover:bg-red-950 sm:w-auto`}
          disabled={!canEdit || Boolean(busy) || ai.isPending}
          onClick={() =>
            ask({
              title: "Ripristina la demo isolata",
              description:
                "Saranno cancellati soltanto fatture, bozze e movimenti simulati di questa sessione utente/azienda. I dati reali aziendali non vengono toccati.",
              label: "Ripristina demo",
              execute: () => {
                const next = initialDemoState(scope);
                currentState.current = next;
                setState(() => next);
                setDrafts({});
                setReceipts({});
                setSuggestions({});
                setActiveId("");
                setPartId("");
                setWorkshopPath({
                  categoria: "Ricambi",
                  reparto: "",
                  famiglia: "",
                  sottocategoria: "",
                });
                setError("");
                setNotice("Demo ripristinata. Nessuna modifica ai dati reali.");
              },
            })
          }
        >
          Ripristina demo
        </Button>
      </div>
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={open => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto border-zinc-800 bg-zinc-950 p-4 text-white sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words text-left">
              {confirmation?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words text-left leading-relaxed text-zinc-300">
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation?.content}
          <p className="text-xs text-amber-200">
            Operazione solo demo — nessuna modifica ai dati aziendali.
          </p>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className={`${BUTTON} border-zinc-700 bg-black text-white hover:bg-zinc-900`}
            >
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              className={GREEN}
              disabled={!canEdit}
              onClick={() => {
                const action = confirmation?.execute;
                setConfirmation(null);
                if (canEdit) action?.();
              }}
            >
              {confirmation?.label ?? "Conferma demo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReviewCard({
  review,
  row,
  state,
  structure,
  canEdit,
  canSeeCosts,
  onPatch,
  onProduct,
  onLink,
}: {
  review: InvoiceReview;
  row: ReviewRow;
  state: DemoState;
  structure: Classification[];
  canEdit: boolean;
  canSeeCosts: boolean;
  onPatch: (patch: Partial<ReviewRow>) => void;
  onProduct: (value: string) => void;
  onLink: (movementId: string, quantity: number) => void;
}) {
  const line = review.invoice.lines.find(item => item.id === row.lineId)!;
  const product = state.products.find(item => item.id === row.productId);
  const [search, setSearch] = useState("");
  const [movementId, setMovementId] = useState("");
  const [linkQuantity, setLinkQuantity] = useState("");
  const left = remaining(review, row);
  const choices = state.products.filter(
    item =>
      item.id === row.productId ||
      `${item.nome} ${item.codice} ${item.identifiers.join(" ")}`
        .toLocaleLowerCase("it-IT")
        .includes(search.toLocaleLowerCase("it-IT"))
  );
  const deliveries = state.movements.filter(
    movement =>
      movement.productId === row.productId &&
      movement.kind === "carico" &&
      !movement.invoiceId &&
      movement.delta > movement.linkedQuantity
  );
  const selectedDelivery = deliveries.find(
    movement => movement.id === movementId
  );
  const incomingPrice = line.quantity != null && line.quantity > 0 && row.factor != null && row.factor > 0 ? Math.round(line.totalCents / (line.quantity * row.factor)) : null;
  const previousPrice = product?.lastPurchaseCents ?? null;
  const priceVariation = incomingPrice != null && previousPrice != null && previousPrice > 0 ? (incomingPrice - previousPrice) / previousPrice * 100 : null;
  const before = product?.quantity ?? 0;
  const delta =
    review.mode === "inventario"
      ? row.physicalQuantity == null
        ? null
        : row.physicalQuantity - before
      : row.factor == null
        ? null
        : row.receiveQuantity * row.factor;
  const completed = rowComplete(review, row, state);
  const status = !row.included
    ? "Riga non destinata al magazzino"
    : row.linkedMovementIds.length > 0 && left === 0
      ? "Carico già registrato e collegato"
      : completed
        ? "Carico completato"
        : row.receivedQuantity > 0
          ? "Ricezione parziale · residuo da ricevere"
          : row.matchStatus === "riconosciuto"
            ? "Articolo riconosciuto"
            : row.createNew
              ? "Nuovo articolo proposto"
              : "Associazione da verificare";
  const id = `review-${row.lineId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <article
      className={`min-w-0 rounded-xl border p-3 sm:p-4 ${!row.included ? "border-zinc-800 bg-black" : row.verified ? "border-green-900 bg-green-950/10" : "border-amber-900/60 bg-black"}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-xs text-zinc-300">
          {line.number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{line.name}</h3>
          <p
            className={`mt-1 text-xs leading-relaxed ${row.included ? "text-amber-200" : "text-zinc-400"}`}
          >
            {status}
          </p>
          <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">
            {row.matchReason}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <p className="break-words text-zinc-400">
          Quantità fatturata{" "}
          <strong className="block text-zinc-100">
            {line.quantity == null
              ? "Non indicata"
              : `${qty(line.quantity)} ${line.unit ?? "UM non indicata"}`}
          </strong>
        </p>
        <p className="break-words text-zinc-400">
          Destinazione XML{" "}
          <strong className="block text-zinc-100">{line.kind}</strong>
        </p>
        {canSeeCosts && (
          <>
            <p className="text-zinc-400">
              Prezzo unitario XML{" "}
              <strong className="block text-white">
                {money(line.unitPriceCents, review.invoice.currency)}
              </strong>
            </p>
            <p className="text-zinc-400">
              Totale riga / IVA{" "}
              <strong className="block text-white">
                {money(line.totalCents, review.invoice.currency)} /{" "}
                {qty(line.vatRate / 100)}%
              </strong>
            </p>
          </>
        )}
      </div>
      {line.codes.length > 0 && (
        <p className="mt-2 break-words text-xs text-sky-200">
          Codici:{" "}
          {line.codes.map(code => `${code.type}: ${code.value}`).join(" · ")}
        </p>
      )}
      {canSeeCosts && incomingPrice != null && previousPrice != null && priceVariation != null && <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${Math.abs(priceVariation) >= 10 ? "border-amber-700/50 text-amber-200" : "border-zinc-800 text-zinc-300"}`}><p>Ultimo acquisto: {money(previousPrice)} / {row.unit} · netto proposto: {money(incomingPrice)} / {row.unit}</p><p>Variazione prezzo: {priceVariation >= 0 ? "+" : ""}{qty(priceVariation)}%{Math.abs(priceVariation) >= 10 ? " — controlla prezzo e contenuto della confezione." : "."}</p><p className="mt-1 text-zinc-400">Solo confronto: il costo di riferimento delle scorte e i materiali già utilizzati non vengono rivalutati.</p></div>}
      <Check
        label="Includi questa riga nel Magazzino"
        checked={row.included}
        disabled={!canEdit || Boolean(completed)}
        onChange={included =>
          onPatch({
            included,
            verified: false,
            matchStatus: included ? "verifica" : "escluso",
          })
        }
      />
      {row.included && (
        <details open={!completed} className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-sky-200">
            Associazione, quantità e verifica
          </summary>
          <fieldset
            disabled={!canEdit || Boolean(completed)}
            className="mt-3 min-w-0 space-y-3 disabled:opacity-80"
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Cerca nell’anagrafica demo">
                <Input
                  className={CONTROL}
                  placeholder="Nome o codice articolo"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </Field>
              <Field label="Articolo esistente o nuovo">
                <select
                  className={CONTROL}
                  value={row.productId ?? "__new"}
                  onChange={event => onProduct(event.target.value)}
                >
                  <option value="__new">Proponi un nuovo articolo</option>
                  {choices.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nome} · {qty(item.quantity)} {item.unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome articolo">
                <Input
                  className={CONTROL}
                  value={row.name}
                  onChange={event =>
                    onPatch({ name: event.target.value, verified: false })
                  }
                />
              </Field>
              <Field label="Unità di misura Magazzino">
                <Input
                  className={CONTROL}
                  list={`${id}-units`}
                  value={row.unit}
                  onChange={event =>
                    onPatch({
                      unit: event.target.value,
                      factor: null,
                      receiveQuantity: 0,
                      verified: false,
                    })
                  }
                />
                <datalist id={`${id}-units`}>
                  {["pz", "kg", "l", "m", "conf", "scatola"].map(unit => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {KEYS.map(key => (
                <Field
                  key={key}
                  label={TITLES[key]}
                  hint={
                    key === "sottocategoria"
                      ? "Facoltativa. Usa le voci esistenti o specifica una nuova voce."
                      : undefined
                  }
                >
                  <Input
                    className={CONTROL}
                    list={`${id}-${key}`}
                    value={row[key]}
                    onChange={event =>
                      onPatch({ [key]: event.target.value, verified: false })
                    }
                  />
                  <datalist id={`${id}-${key}`}>
                    {Array.from(
                      new Set(structure.map(item => item[key]).filter(Boolean))
                    )
                      .sort()
                      .map(value => (
                        <option key={value} value={value} />
                      ))}
                  </datalist>
                </Field>
              ))}
            </div>
            <Field
              label={`Fattore conversione · 1 ${line.unit ?? "UM fattura"} = quante ${row.unit || "UM Magazzino"}?`}
              hint={
                row.factor == null
                  ? "Conversione mancante: indicarla e verificarla. Nessun contenuto confezione inventato."
                  : `Quantità storica convertita: ${line.quantity == null ? "non disponibile" : qty(line.quantity * row.factor)} ${row.unit}. Inserisci la ricezione nell’UM fattura; il motore applica il fattore una sola volta.`
              }
            >
              <Input
                className={CONTROL}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="Da verificare"
                value={row.factor ?? ""}
                onChange={event =>
                  onPatch({
                    factor: fieldNumber(event.target.value),
                    receiveQuantity: 0,
                    verified: false,
                  })
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Giacenza attuale"
                value={`${qty(before)} ${row.unit}`}
              />
              <Stat
                label="Già ricevuti / collegati"
                value={`${qty(row.receivedQuantity)} ${line.unit ?? "UM fattura"}`}
              />
            </div>
            {review.mode === "inventario" ? (
              <Field
                label="Quantità fisicamente presente (target, non somma)"
                hint="Lasciata vuota finché non verificata. Il target viene condiviso con le altre righe dello stesso articolo."
              >
                <Input
                  className={CONTROL}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.physicalQuantity ?? ""}
                  placeholder="Es. 7, non i 20 acquistati"
                  onChange={event =>
                    onPatch({
                      physicalQuantity: fieldNumber(event.target.value),
                      verified: false,
                    })
                  }
                />
              </Field>
            ) : (
              <Field
                label={`Quantità ricevuta oggi in ${line.unit || "UM fattura"}`}
                hint={`Ancora da ricevere: ${left == null ? "conversione da definire" : `${qty(left)} ${line.unit ?? "UM fattura"}`}. Per una ricezione parziale indica soltanto il materiale arrivato oggi.`}
              >
                <Input
                  className={CONTROL}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={left ?? undefined}
                  step="any"
                  value={row.receiveQuantity}
                  onChange={event =>
                    onPatch({
                      receiveQuantity: fieldNumber(event.target.value) ?? 0,
                      verified: false,
                    })
                  }
                />
              </Field>
            )}
            <div className="rounded-lg border border-zinc-800 p-3 text-sm">
              <p className="text-xs text-zinc-400">
                Anteprima riga · prima → variazione → dopo
              </p>
              <p className="mt-1">
                {qty(before)} →{" "}
                {delta == null
                  ? "da definire"
                  : `${delta >= 0 ? "+" : ""}${qty(delta)}`}{" "}
                →{" "}
                <strong className="text-green-300">
                  {delta == null ? "—" : qty(before + delta)} {row.unit}
                </strong>
              </p>
              {review.mode === "inventario" && (
                <p className="mt-1 text-xs text-zinc-400">
                  Le righe dello stesso prodotto vengono raggruppate
                  nell’anteprima finale.
                </p>
              )}
            </div>
            <Check
              label="Ho verificato identità articolo, classificazione, unità e quantità"
              checked={row.verified}
              onChange={verified => onPatch({ verified })}
            />
          </fieldset>
          {review.mode === "acquisto" && row.productId && !completed && (
            <div className="mt-4 space-y-3 rounded-lg border border-sky-900 p-3">
              <h4 className="text-sm font-medium text-sky-200">
                Collega un DDT / carico già effettuato
              </h4>
              <p className="text-xs leading-relaxed text-zinc-400">
                Carichi disponibili dello stesso articolo. Nessun incremento di
                stock al collegamento. Conferma prima l’associazione al prodotto
                e la conversione.
              </p>
              <Field label="Carico precedente">
                <select
                  value={movementId}
                  className={CONTROL}
                  disabled={!canEdit}
                  onChange={event => {
                    setMovementId(event.target.value);
                    setLinkQuantity("");
                  }}
                >
                  <option value="">Seleziona un carico</option>
                  {deliveries.map(movement => (
                    <option key={movement.id} value={movement.id}>
                      {movement.reference} · disponibili{" "}
                      {qty(movement.delta - movement.linkedQuantity)} {row.unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={`Quantità da collegare in ${line.unit ?? "UM fattura"}`}
              >
                <Input
                  className={CONTROL}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={linkQuantity}
                  disabled={!canEdit || !selectedDelivery}
                  onChange={event => setLinkQuantity(event.target.value)}
                />
              </Field>
              <Button
                className={`${BLUE} w-full`}
                disabled={
                  !canEdit ||
                  !row.verified ||
                  row.factor == null ||
                  !selectedDelivery ||
                  !(Number(linkQuantity) > 0) ||
                  Number(linkQuantity) * (row.factor ?? 0) >
                    (selectedDelivery
                      ? selectedDelivery.delta - selectedDelivery.linkedQuantity
                      : 0) ||
                  (left != null && Number(linkQuantity) > left)
                }
                onClick={() => onLink(movementId, Number(linkQuantity))}
              >
                Conferma collegamento al carico
              </Button>
              {deliveries.length === 0 && (
                <p className="text-xs text-zinc-400">
                  Nessun carico precedente disponibile. Puoi crearne uno nel
                  modulo DDT demo.
                </p>
              )}
            </div>
          )}
        </details>
      )}
      {row.receivedQuantity > 0 && (
        <p className="mt-2 break-words text-xs text-green-200">
          Già ricevuti: {qty(row.receivedQuantity)} {line.unit ?? "UM fattura"}{" "}
          · da ricevere {left == null ? "da verificare" : qty(left)}
          {row.linkedMovementIds.length
            ? ` · ${row.linkedMovementIds.length} carichi collegati`
            : ""}
        </p>
      )}
    </article>
  );
}
