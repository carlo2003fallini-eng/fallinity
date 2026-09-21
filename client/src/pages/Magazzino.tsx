import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.60 0.22 25)";
const SURFACE = "oklch(0.11 0.006 145)";
const SURFACE_RAISED = "oklch(0.14 0.007 145)";
const BORDER = "oklch(0.20 0.009 145)";
const INVENTORY_POSITION_KEY = "fallinity:magazzino:position:v1";

const CATEGORIE_PRODOTTO = [
  "Prodotti per stalla",
  "Mangimi",
  "Detersivi",
  "Lubrificanti",
  "Ricambi",
  "Sementi",
  "Fitofarmaci",
  "Fertilizzanti",
  "Carburanti",
  "Imballaggi",
  "Prodotti finiti",
  "Varie",
  "Altro",
];

type PosizioneMagazzino = {
  categoria: string;
  sottocategoria: string;
  ricerca: string;
};

type ScaricoForm = {
  quantita: string;
  causale: string;
  note: string;
};

const EMPTY_PRODUCT = {
  nome: "",
  categoria: "",
  sottocategoria: "",
  unitaMisura: "kg",
  quantita: "",
  quantitaMinima: "",
  prezzoUnitario: "",
  note: "",
};

const EMPTY_SCARICO: ScaricoForm = { quantita: "", causale: "", note: "" };

function posizioneIniziale(): PosizioneMagazzino {
  try {
    const saved = window.localStorage.getItem(INVENTORY_POSITION_KEY);
    if (!saved) return { categoria: "", sottocategoria: "", ricerca: "" };
    const parsed = JSON.parse(saved) as Partial<PosizioneMagazzino>;
    return {
      categoria: typeof parsed.categoria === "string" ? parsed.categoria : "",
      sottocategoria: typeof parsed.sottocategoria === "string" ? parsed.sottocategoria : "",
      ricerca: typeof parsed.ricerca === "string" ? parsed.ricerca : "",
    };
  } catch {
    return { categoria: "", sottocategoria: "", ricerca: "" };
  }
}

function formatQuantity(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(number);
}

function formatWhen(value: unknown) {
  if (!value) return "Data non disponibile";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Data non disponibile";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isLowStock(product: any) {
  return Number(product.quantitaMinima ?? 0) > 0 && Number(product.quantita) <= Number(product.quantitaMinima);
}

export default function Magazzino() {
  const initial = posizioneIniziale();
  const [search, setSearch] = useState(initial.ricerca);
  const [catFilter, setCatFilter] = useState(initial.categoria);
  const [subcatFilter, setSubcatFilter] = useState(initial.sottocategoria);
  const [openProd, setOpenProd] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [dischargeProductId, setDischargeProductId] = useState<string | null>(null);
  const [formProd, setFormProd] = useState({ ...EMPTY_PRODUCT });
  const [formScarico, setFormScarico] = useState<ScaricoForm>({ ...EMPTY_SCARICO });

  const utils = trpc.useUtils();
  const { data: prodotti = [] } = trpc.magazzino.list.useQuery();
  const { data: movimenti = [] } = trpc.magazzino.movimenti.useQuery(
    { prodottoId: detailProductId ?? "" },
    { enabled: Boolean(detailProductId) },
  );

  useEffect(() => {
    window.localStorage.setItem(INVENTORY_POSITION_KEY, JSON.stringify({
      categoria: catFilter,
      sottocategoria: subcatFilter,
      ricerca: search,
    }));
  }, [catFilter, search, subcatFilter]);

  const createProd = trpc.magazzino.create.useMutation({
    onSuccess: async () => {
      await utils.magazzino.list.invalidate();
      setOpenProd(false);
      setFormProd({ ...EMPTY_PRODUCT });
      toast.success("Prodotto aggiunto", { duration: 2_500 });
    },
    onError: (error) => toast.error(error.message || "Errore durante il salvataggio"),
  });

  const deleteProd = trpc.magazzino.delete.useMutation({
    onSuccess: async () => {
      await utils.magazzino.list.invalidate();
      setDetailProductId(null);
      setExpandedProductId(null);
      toast.success("Prodotto archiviato", { duration: 2_500 });
    },
    onError: (error) => toast.error(error.message || "Impossibile archiviare il prodotto"),
  });

  const scaricaRapido = trpc.magazzino.scaricaRapido.useMutation({
    onSuccess: async (result) => {
      utils.magazzino.list.setData(undefined, (current) => current?.map((product) => (
        product.id === result.prodotto.id
          ? { ...product, ...result.prodotto }
          : product
      )));
      setDischargeProductId(null);
      setFormScarico({ ...EMPTY_SCARICO });
      await Promise.all([
        utils.magazzino.list.invalidate(),
        utils.magazzino.movimenti.invalidate(),
      ]);
      toast.success("Scarico confermato", {
        description: `${formatQuantity(result.prodotto.quantita)} ${result.prodotto.unitaMisura ?? "pz"} disponibili`,
        duration: 2_500,
      });
    },
    onError: (error) => toast.error(error.message || "Impossibile registrare lo scarico"),
  });

  const productList = prodotti as any[];
  const categories = useMemo(
    () => Array.from(new Set(productList.map((product) => product.categoria).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "it")),
    [productList],
  );
  const subcategories = useMemo(
    () => Array.from(new Set(
      productList
        .filter((product) => !catFilter || product.categoria === catFilter)
        .map((product) => product.sottocategoria)
        .filter(Boolean),
    )).sort((a, b) => String(a).localeCompare(String(b), "it")),
    [catFilter, productList],
  );
  const filtered = productList.filter((product) => (
    product.nome.toLowerCase().includes(search.toLowerCase())
    && (!catFilter || product.categoria === catFilter)
    && (!subcatFilter || product.sottocategoria === subcatFilter)
  ));
  const lowStock = productList.filter(isLowStock).length;
  const dischargeProduct = productList.find((product) => product.id === dischargeProductId) ?? null;
  const detailProduct = productList.find((product) => product.id === detailProductId) ?? null;

  const selectCategory = (category: string) => {
    setCatFilter(category);
    setSubcatFilter("");
  };

  const openDischarge = (product: any) => {
    setExpandedProductId(product.id);
    setDischargeProductId(product.id);
    setFormScarico({
      quantita: product.ultimoScaricoQuantita ? String(Number(product.ultimoScaricoQuantita)) : "",
      causale: "",
      note: "",
    });
  };

  const confirmDischarge = () => {
    if (!dischargeProduct) return;
    const quantity = Number(formScarico.quantita.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Inserisci una quantità maggiore di zero");
      return;
    }
    if (quantity > Number(dischargeProduct.quantita)) {
      toast.error(`Disponibili solo ${formatQuantity(dischargeProduct.quantita)} ${dischargeProduct.unitaMisura ?? "pz"}`);
      return;
    }
    scaricaRapido.mutate({
      prodottoId: dischargeProduct.id,
      quantita: quantity,
      causale: formScarico.causale.trim() || undefined,
      note: formScarico.note.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-5 animate-fade-in-up">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div>
          <p className="fal-eyebrow" style={{ color: GOLD }}>OPERATIVITÀ QUOTIDIANA</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Magazzino
          </h1>
          <p className="mt-1 text-sm" style={{ color: "oklch(0.57 0.01 145)" }}>
            Scarica le scorte in pochi tocchi.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => { setFormProd({ ...EMPTY_PRODUCT }); setOpenProd(true); }}
          className="size-11 shrink-0 rounded-xl p-0 shadow-[0_0_24px_oklch(0.65_0.18_142_/_0.18)]"
          style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}
          aria-label="Aggiungi un nuovo prodotto"
          title="Nuovo prodotto"
        >
          <Plus className="size-5" />
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3" aria-label="Riepilogo Magazzino">
        <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "oklch(0.51 0.01 145)" }}>
            <Package className="size-3.5" style={{ color: GREEN }} /> Prodotti
          </div>
          <p className="mt-2 text-3xl font-bold" style={{ color: "oklch(0.94 0.005 145)", fontFamily: "var(--font-display)" }}>{productList.length}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: lowStock ? "oklch(0.55 0.22 25 / 0.09)" : SURFACE, border: `1px solid ${lowStock ? "oklch(0.55 0.22 25 / 0.30)" : BORDER}` }}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "oklch(0.51 0.01 145)" }}>
            <AlertTriangle className="size-3.5" style={{ color: lowStock ? RED : GOLD }} /> Sotto scorta
          </div>
          <p className="mt-2 text-3xl font-bold" style={{ color: lowStock ? RED : "oklch(0.94 0.005 145)", fontFamily: "var(--font-display)" }}>{lowStock}</p>
        </div>
      </section>

      {lowStock > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "oklch(0.55 0.22 25 / 0.08)", border: "1px solid oklch(0.55 0.22 25 / 0.24)" }}>
          <AlertTriangle className="size-4 shrink-0" style={{ color: RED }} />
          <p className="text-sm" style={{ color: "oklch(0.75 0.01 145)" }}>
            <strong style={{ color: RED }}>{lowStock} {lowStock === 1 ? "prodotto richiede" : "prodotti richiedono" }</strong> attenzione alla scorta.
          </p>
        </div>
      )}

      <section className="space-y-3" aria-label="Ricerca e filtri">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: "oklch(0.49 0.01 145)" }} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca un prodotto…"
            className="h-12 rounded-xl border pl-11 pr-10 text-base"
            style={{ background: SURFACE, borderColor: BORDER, color: "oklch(0.90 0.005 145)" }}
            aria-label="Cerca un prodotto"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md"
              style={{ color: "oklch(0.57 0.01 145)" }}
              aria-label="Cancella ricerca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" aria-label="Filtra per categoria">
          <button
            type="button"
            onClick={() => selectCategory("")}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
            style={{
              background: !catFilter ? "oklch(0.65 0.18 142 / 0.16)" : SURFACE,
              border: `1px solid ${!catFilter ? GREEN : BORDER}`,
              color: !catFilter ? GREEN : "oklch(0.64 0.01 145)",
            }}
          >
            Tutte
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={String(category)}
              onClick={() => selectCategory(String(category))}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: catFilter === category ? "oklch(0.65 0.18 142 / 0.16)" : SURFACE,
                border: `1px solid ${catFilter === category ? GREEN : BORDER}`,
                color: catFilter === category ? GREEN : "oklch(0.64 0.01 145)",
              }}
            >
              {String(category)}
            </button>
          ))}
        </div>

        {subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Filtra per sottocategoria">
            <span className="shrink-0 text-xs font-medium" style={{ color: "oklch(0.49 0.01 145)" }}>Sottocategorie</span>
            <button
              type="button"
              onClick={() => setSubcatFilter("")}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs"
              style={{ background: !subcatFilter ? `${GOLD}18` : "transparent", color: !subcatFilter ? GOLD : "oklch(0.58 0.01 145)" }}
            >
              Tutte
            </button>
            {subcategories.map((subcategory) => (
              <button
                type="button"
                key={String(subcategory)}
                onClick={() => setSubcatFilter(String(subcategory))}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs"
                style={{ background: subcatFilter === subcategory ? `${GOLD}18` : "transparent", color: subcatFilter === subcategory ? GOLD : "oklch(0.58 0.01 145)" }}
              >
                {String(subcategory)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl" style={{ background: SURFACE, border: `1px solid ${BORDER}` }} aria-label="Elenco prodotti">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: BORDER, background: "oklch(0.10 0.005 145)" }}>
          <div className="flex items-center gap-2">
            <Package className="size-4" style={{ color: GOLD }} />
            <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>Inventario</span>
          </div>
          <span className="text-xs" style={{ color: "oklch(0.53 0.01 145)" }}>{filtered.length} {filtered.length === 1 ? "prodotto" : "prodotti"}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="grid size-12 place-items-center rounded-2xl" style={{ background: `${GREEN}12` }}>
              <Package className="size-5" style={{ color: GREEN }} />
            </div>
            <h2 className="mt-4 font-semibold" style={{ color: "oklch(0.86 0.005 145)" }}>Nessun prodotto trovato</h2>
            <p className="mt-1 text-sm" style={{ color: "oklch(0.51 0.01 145)" }}>Modifica la ricerca o aggiungi un nuovo prodotto.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "oklch(0.17 0.008 145)" }}>
            {filtered.map((product) => {
              const expanded = expandedProductId === product.id;
              const low = isLowStock(product);
              const unit = product.unitaMisura ?? "pz";
              return (
                <article key={product.id} className="transition-colors" style={{ background: expanded ? "oklch(0.65 0.18 142 / 0.045)" : "transparent" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedProductId(expanded ? null : product.id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left active:scale-[0.99]"
                    aria-expanded={expanded}
                    aria-controls={`azioni-prodotto-${product.id}`}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: low ? `${RED}18` : `${GREEN}16`, border: `1px solid ${low ? `${RED}35` : `${GREEN}30`}` }}>
                      <Package className="size-[18px]" style={{ color: low ? RED : GREEN }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold" style={{ color: "oklch(0.91 0.005 145)" }}>{product.nome}</h2>
                        {low && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${RED}16`, color: RED }}>Bassa scorta</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs" style={{ color: "oklch(0.54 0.01 145)" }}>
                        {[product.sottocategoria, product.categoria].filter(Boolean).join(" · ") || "Senza categoria"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold" style={{ color: low ? RED : GREEN }}>{formatQuantity(product.quantita)} {unit}</p>
                      {Number(product.quantitaMinima ?? 0) > 0 && <p className="mt-0.5 text-[11px]" style={{ color: "oklch(0.49 0.01 145)" }}>min. {formatQuantity(product.quantitaMinima)}</p>}
                    </div>
                    {expanded ? <ChevronDown className="ml-0.5 size-4 shrink-0" style={{ color: GREEN }} /> : <ChevronRight className="ml-0.5 size-4 shrink-0" style={{ color: "oklch(0.48 0.01 145)" }} />}
                  </button>

                  {expanded && (
                    <div id={`azioni-prodotto-${product.id}`} className="px-4 pb-4" style={{ animation: "none" }}>
                      <div className="rounded-xl p-3" style={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}` }}>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pb-3 text-xs" style={{ color: "oklch(0.61 0.01 145)" }}>
                          {product.codice && <span>Codice: <strong style={{ color: "oklch(0.82 0.005 145)" }}>{product.codice}</strong></span>}
                          {product.ultimoScaricoQuantita && <span>Ultimo scarico: <strong style={{ color: "oklch(0.82 0.005 145)" }}>{formatQuantity(product.ultimoScaricoQuantita)} {unit}</strong></span>}
                        </div>
                        <div className="grid grid-cols-[1.35fr_1fr] gap-2">
                          <Button
                            type="button"
                            onClick={() => openDischarge(product)}
                            className="h-11 rounded-lg gap-2 text-sm font-bold"
                            style={{ background: RED, color: "white", boxShadow: "0 8px 22px oklch(0.55 0.22 25 / 0.18)" }}
                          >
                            <ArrowUpRight className="size-4" /> Scarico
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDetailProductId(product.id)}
                            className="h-11 rounded-lg gap-2 text-sm"
                            style={{ background: "oklch(0.18 0.009 145)", color: "oklch(0.86 0.005 145)", borderColor: "oklch(0.28 0.01 145)" }}
                          >
                            <FileText className="size-4" /> Dettagli
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={openProd} onOpenChange={setOpenProd}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:w-[420px] sm:max-w-[420px]" style={{ background: "oklch(0.10 0.005 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader className="border-b px-6 py-5 text-left" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl" style={{ background: `${GREEN}18` }}><Package className="size-4" style={{ color: GREEN }} /></div>
              <div>
                <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuovo prodotto</SheetTitle>
                <p className="mt-1 text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>Il carico viene gestito principalmente dalle fatture di acquisto.</p>
              </div>
            </div>
          </SheetHeader>
          <div className="space-y-4 px-6 py-5">
            <FieldLabel label="Nome prodotto *"><Input value={formProd.nome} onChange={(event) => setFormProd((value) => ({ ...value, nome: event.target.value }))} className="bg-input border-border" autoFocus /></FieldLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel label="Categoria"><select value={formProd.categoria} onChange={(event) => setFormProd((value) => ({ ...value, categoria: event.target.value }))} className="inventory-select"><option value="">Seleziona categoria</option>{Array.from(new Set([...CATEGORIE_PRODOTTO, ...categories.map(String)])).map((category) => <option key={category} value={category}>{category}</option>)}</select></FieldLabel>
              <FieldLabel label="Sottocategoria"><Input value={formProd.sottocategoria} onChange={(event) => setFormProd((value) => ({ ...value, sottocategoria: event.target.value }))} placeholder="Facoltativa" className="bg-input border-border" /></FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Quantità iniziale *"><Input type="number" min="0" step="0.001" inputMode="decimal" value={formProd.quantita} onChange={(event) => setFormProd((value) => ({ ...value, quantita: event.target.value }))} className="bg-input border-border" /></FieldLabel>
              <FieldLabel label="Unità"><select value={formProd.unitaMisura} onChange={(event) => setFormProd((value) => ({ ...value, unitaMisura: event.target.value }))} className="inventory-select">{["kg", "q", "t", "L", "pz", "m", "m²", "m³"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Scorta minima"><Input type="number" min="0" step="0.001" inputMode="decimal" value={formProd.quantitaMinima} onChange={(event) => setFormProd((value) => ({ ...value, quantitaMinima: event.target.value }))} className="bg-input border-border" /></FieldLabel>
              <FieldLabel label="Prezzo unitario (€)"><Input type="number" min="0" step="0.01" inputMode="decimal" value={formProd.prezzoUnitario} onChange={(event) => setFormProd((value) => ({ ...value, prezzoUnitario: event.target.value }))} className="bg-input border-border" /></FieldLabel>
            </div>
            <FieldLabel label="Note"><Textarea value={formProd.note} onChange={(event) => setFormProd((value) => ({ ...value, note: event.target.value }))} placeholder="Facoltative" className="min-h-20 bg-input border-border" /></FieldLabel>
          </div>
          <div className="sticky bottom-0 border-t bg-[oklch(0.10_0.005_145)] px-6 py-4" style={{ borderColor: BORDER }}>
            <Button
              type="button"
              disabled={createProd.isPending}
              onClick={() => {
                const quantity = Number(formProd.quantita.replace(",", "."));
                if (!formProd.nome.trim() || !Number.isFinite(quantity) || quantity < 0) {
                  toast.error("Inserisci nome e quantità iniziale valida");
                  return;
                }
                createProd.mutate({
                  nome: formProd.nome.trim(),
                  categoria: formProd.categoria || undefined,
                  sottocategoria: formProd.sottocategoria.trim() || undefined,
                  unitaMisura: formProd.unitaMisura,
                  quantita: quantity,
                  quantitaMinima: Number(formProd.quantitaMinima.replace(",", ".")) || 0,
                  prezzoUnitario: formProd.prezzoUnitario ? Number(formProd.prezzoUnitario.replace(",", ".")) : undefined,
                  note: formProd.note.trim() || undefined,
                });
              }}
              className="h-12 w-full rounded-xl font-bold"
              style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}
            >
              {createProd.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Salva prodotto
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(dischargeProduct)} onOpenChange={(open) => { if (!open && !scaricaRapido.isPending) setDischargeProductId(null); }}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[430px]" style={{ background: "oklch(0.10 0.005 145)", color: "oklch(0.92 0.005 145)", borderColor: "oklch(0.30 0.012 145)" }}>
          {dischargeProduct && (
            <>
              <DialogHeader className="border-b px-5 py-5 text-left" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-3 pr-6">
                  <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${RED}18`, border: `1px solid ${RED}35` }}><ArrowUpRight className="size-5" style={{ color: RED }} /></div>
                  <div>
                    <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Scarico prodotto</DialogTitle>
                    <DialogDescription className="mt-1" style={{ color: "oklch(0.57 0.01 145)" }}>{dischargeProduct.nome}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}` }}>
                  <span className="text-xs" style={{ color: "oklch(0.57 0.01 145)" }}>Disponibile</span>
                  <strong className="text-sm" style={{ color: GREEN }}>{formatQuantity(dischargeProduct.quantita)} {dischargeProduct.unitaMisura ?? "pz"}</strong>
                </div>
                <div>
                  <label htmlFor="quick-discharge-quantity" className="mb-2 block text-sm font-semibold" style={{ color: "oklch(0.82 0.005 145)" }}>Quantità da rimuovere</label>
                  <div className="relative">
                    <Input
                      id="quick-discharge-quantity"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={Number(dischargeProduct.quantita)}
                      step="0.001"
                      autoFocus
                      value={formScarico.quantita}
                      onChange={(event) => setFormScarico((value) => ({ ...value, quantita: event.target.value }))}
                      className="h-13 rounded-xl border pr-14 text-lg font-bold"
                      style={{ background: "oklch(0.14 0.007 145)", borderColor: BORDER, color: "oklch(0.94 0.005 145)" }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "oklch(0.58 0.01 145)" }}>{dischargeProduct.unitaMisura ?? "pz"}</span>
                  </div>
                  {dischargeProduct.ultimoScaricoQuantita ? (
                    <p className="mt-2 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                      Precompilato dall’ultimo scarico: {formatQuantity(dischargeProduct.ultimoScaricoQuantita)} {dischargeProduct.unitaMisura ?? "pz"}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Inserisci la quantità da rimuovere.</p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldLabel label="Causale (opzionale)"><Input value={formScarico.causale} onChange={(event) => setFormScarico((value) => ({ ...value, causale: event.target.value }))} placeholder="Es. Utilizzo in stalla" className="bg-input border-border" /></FieldLabel>
                  <FieldLabel label="Note (opzionali)"><Input value={formScarico.note} onChange={(event) => setFormScarico((value) => ({ ...value, note: event.target.value }))} placeholder="Aggiungi una nota" className="bg-input border-border" /></FieldLabel>
                </div>
              </div>
              <DialogFooter className="border-t px-5 py-4 sm:flex-row" style={{ borderColor: BORDER }}>
                <Button type="button" variant="outline" disabled={scaricaRapido.isPending} onClick={() => setDischargeProductId(null)} className="h-11 flex-1 rounded-xl" style={{ background: "oklch(0.18 0.009 145)", borderColor: "oklch(0.28 0.01 145)", color: "oklch(0.84 0.005 145)" }}>Annulla</Button>
                <Button type="button" disabled={scaricaRapido.isPending} onClick={confirmDischarge} className="h-11 flex-[1.3] rounded-xl font-bold" style={{ background: RED, color: "white" }}>
                  {scaricaRapido.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Salvataggio…</> : <><ArrowUpRight className="mr-2 size-4" /> Conferma scarico</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailProduct)} onOpenChange={(open) => { if (!open) setDetailProductId(null); }}>
        <DialogContent className="max-h-[84vh] overflow-y-auto p-0 sm:max-w-[480px]" style={{ background: "oklch(0.10 0.005 145)", color: "oklch(0.92 0.005 145)", borderColor: "oklch(0.30 0.012 145)" }}>
          {detailProduct && (
            <>
              <DialogHeader className="border-b px-5 py-5 text-left" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-3 pr-6">
                  <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${GREEN}18` }}><Package className="size-5" style={{ color: GREEN }} /></div>
                  <div>
                    <DialogTitle style={{ fontFamily: "var(--font-display)" }}>{detailProduct.nome}</DialogTitle>
                    <DialogDescription className="mt-1" style={{ color: "oklch(0.57 0.01 145)" }}>{[detailProduct.sottocategoria, detailProduct.categoria].filter(Boolean).join(" · ") || "Prodotto Magazzino"}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-5 px-5 py-5">
                <div className="grid grid-cols-2 gap-3">
                  <InfoTile label="Disponibile" value={`${formatQuantity(detailProduct.quantita)} ${detailProduct.unitaMisura ?? "pz"}`} accent={GREEN} />
                  <InfoTile label="Scorta minima" value={Number(detailProduct.quantitaMinima ?? 0) ? `${formatQuantity(detailProduct.quantitaMinima)} ${detailProduct.unitaMisura ?? "pz"}` : "Non impostata"} accent={isLowStock(detailProduct) ? RED : GOLD} />
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2"><History className="size-4" style={{ color: GOLD }} /><h3 className="text-sm font-semibold">Movimenti recenti</h3></div>
                  {(movimenti as any[]).length === 0 ? (
                    <p className="rounded-xl px-3 py-4 text-sm" style={{ background: SURFACE_RAISED, color: "oklch(0.55 0.01 145)" }}>Nessun movimento registrato.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
                      {(movimenti as any[]).slice(0, 8).map((movement) => (
                        <div key={movement.id} className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0" style={{ borderColor: BORDER, background: SURFACE_RAISED }}>
                          <div className="grid size-8 place-items-center rounded-lg" style={{ background: movement.tipo === "carico" ? `${GREEN}14` : `${RED}14` }}>
                            {movement.tipo === "carico" ? <ArrowDownLeft className="size-4" style={{ color: GREEN }} /> : <ArrowUpRight className="size-4" style={{ color: RED }} />}
                          </div>
                          <div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{movement.tipo}</p><p className="truncate text-xs" style={{ color: "oklch(0.54 0.01 145)" }}>{movement.causale || movement.note || movement.descrizione || "—"}</p></div>
                          <div className="text-right"><p className="text-sm font-bold" style={{ color: movement.tipo === "carico" ? GREEN : RED }}>{movement.tipo === "carico" ? "+" : "−"}{formatQuantity(movement.quantita)}</p><p className="text-[11px]" style={{ color: "oklch(0.49 0.01 145)" }}>{formatWhen(movement.dataOra || movement.data)}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {detailProduct.note && <p className="rounded-xl px-3 py-3 text-sm" style={{ background: SURFACE_RAISED, color: "oklch(0.64 0.01 145)" }}><strong style={{ color: "oklch(0.82 0.005 145)" }}>Note:</strong> {detailProduct.note}</p>}
                <button type="button" onClick={() => deleteProd.mutate({ id: detailProduct.id })} disabled={deleteProd.isPending} className="flex w-full items-center justify-center gap-2 py-2 text-xs font-medium" style={{ color: "oklch(0.68 0.08 25)" }}><Trash2 className="size-3.5" /> Archivia prodotto</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium" style={{ color: "oklch(0.60 0.01 145)" }}>{label}</span>{children}</label>;
}

function InfoTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <div className="rounded-xl p-3" style={{ background: SURFACE_RAISED, border: `1px solid ${BORDER}` }}><p className="text-xs" style={{ color: "oklch(0.54 0.01 145)" }}>{label}</p><p className="mt-1.5 text-sm font-bold" style={{ color: accent }}>{value}</p></div>;
}
