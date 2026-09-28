import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleDollarSign,
  FilterX,
  Lightbulb,
  ListFilter,
  Minus,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#4ade80";
const RED = "#f87171";
const GOLD = "#d4a843";
const BLUE = "#60a5fa";
const PURPLE = "#a78bfa";
const COLORS = [GREEN, GOLD, BLUE, PURPLE, RED, "#2dd4bf", "#fb923c", "#f472b6"];

type Preset = "mese" | "anno" | "dodici_mesi" | "personalizzato";
type Dimensione = "categorie" | "categorie_centri" | "soggetti" | "centri";
type Direzione = "tutto" | "entrate" | "uscite";
type FilterKey = "soggetto" | "categoriaCentro" | "centroCosto" | "categoria";
type FilterOption = { id: string; label: string; note?: string };

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousRange(inizio: Date, fine: Date) {
  const durata = fine.getTime() - inizio.getTime();
  const finePrecedente = new Date(inizio);
  finePrecedente.setDate(finePrecedente.getDate() - 1);
  const inizioPrecedente = new Date(finePrecedente.getTime() - durata);
  return { inizio: isoDate(inizioPrecedente), fine: isoDate(finePrecedente) };
}

function rangeForPreset(preset: Exclude<Preset, "personalizzato">) {
  const oggi = new Date();
  let inizio: Date;
  let fine: Date;
  if (preset === "mese") {
    inizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    fine = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
  } else if (preset === "anno") {
    inizio = new Date(oggi.getFullYear(), 0, 1);
    fine = new Date(oggi.getFullYear(), 11, 31);
  } else {
    inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 11, 1);
    fine = oggi;
  }
  return { inizio: isoDate(inizio), fine: isoDate(fine), precedente: previousRange(inizio, fine) };
}

function fmtMoney(cents: number | null | undefined) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(cents ?? 0) / 100);
}

function fmtCompact(cents: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

function fmtPeriod(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function shortLabel(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function Delta({ value, invert = false, comparisonAvailable = true }: { value: number | null | undefined; invert?: boolean; comparisonAvailable?: boolean }) {
  if (!comparisonAvailable) return <span className="text-[11px] text-muted-foreground">Nessun dato di confronto</span>;
  if (value === null || value === undefined) return <span className="text-[11px] text-muted-foreground">Confronto non disponibile</span>;
  const positive = invert ? value <= 0 : value >= 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}><Icon className="size-3" />{value > 0 ? "+" : ""}{value.toFixed(1)}%</span>;
}

function KpiCard({ label, value, delta, tone, invert, comparisonAvailable }: {
  label: string;
  value: string;
  delta?: number | null;
  tone: "green" | "red" | "gold" | "blue";
  invert?: boolean;
  comparisonAvailable: boolean;
}) {
  const palette = {
    green: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400",
    red: "border-red-500/20 bg-red-500/[0.06] text-red-400",
    gold: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
    blue: "border-blue-500/20 bg-blue-500/[0.06] text-blue-400",
  }[tone];
  return <Card className={`border ${palette}`}><CardContent className="p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-bold text-foreground">{value}</p><div className="mt-1"><Delta value={delta} invert={invert} comparisonAvailable={comparisonAvailable} /></div></CardContent></Card>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-36 rounded-xl border border-emerald-300/20 bg-[#0a1510]/95 p-3 text-xs text-emerald-50 shadow-[0_18px_45px_rgba(0,0,0,.45)] backdrop-blur"><p className="mb-2 font-semibold text-white">{label || "Dettaglio"}</p><div className="space-y-1.5">{payload.map((item: any) => <div key={`${item.dataKey}-${item.name}`} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5 text-white/70"><span className="size-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-semibold text-white">{fmtMoney(item.value)}</span></div>)}</div></div>;
}

function ComparisonUnavailable() {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/15 p-3"><Scale className="mt-0.5 size-4 shrink-0 text-amber-300" /><div><p className="text-sm font-medium">Periodo precedente non disponibile</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Non ci sono movimenti nel periodo selezionato per il confronto. Le variazioni non vengono calcolate.</p></div></div>;
}

function AnalysisSkeleton() {
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><Skeleton className="h-24 rounded-2xl bg-white/[0.055]" /><Skeleton className="h-24 rounded-2xl bg-white/[0.055]" /><Skeleton className="h-24 rounded-2xl bg-white/[0.055]" /><Skeleton className="h-24 rounded-2xl bg-white/[0.055]" /></div><Skeleton className="h-36 rounded-2xl bg-white/[0.04]" /><Skeleton className="h-56 rounded-2xl bg-white/[0.04]" /></div>;
}

export default function AnalisiPage() {
  const iniziale = useMemo(() => rangeForPreset("anno"), []);
  const [preset, setPreset] = useState<Preset>("anno");
  const [dataInizio, setDataInizio] = useState(iniziale.inizio);
  const [dataFine, setDataFine] = useState(iniziale.fine);
  const [confrontoInizio, setConfrontoInizio] = useState(iniziale.precedente.inizio);
  const [confrontoFine, setConfrontoFine] = useState(iniziale.precedente.fine);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [customInizio, setCustomInizio] = useState(iniziale.inizio);
  const [customFine, setCustomFine] = useState(iniziale.fine);
  const [customError, setCustomError] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [draftDataInizio, setDraftDataInizio] = useState(iniziale.inizio);
  const [draftDataFine, setDraftDataFine] = useState(iniziale.fine);
  const [draftConfrontoInizio, setDraftConfrontoInizio] = useState(iniziale.precedente.inizio);
  const [draftConfrontoFine, setDraftConfrontoFine] = useState(iniziale.precedente.fine);
  const [compareError, setCompareError] = useState("");
  const [granularita, setGranularita] = useState<"mese" | "anno">("mese");
  const [soggettoId, setSoggettoId] = useState("all");
  const [categoriaId, setCategoriaId] = useState("all");
  const [categoriaCentroId, setCategoriaCentroId] = useState("all");
  const [centroCostoId, setCentroCostoId] = useState("all");
  const [dimensione, setDimensione] = useState<Dimensione>("categorie");
  const [direzione, setDirezione] = useState<Direzione>("tutto");
  const [openFilterKey, setOpenFilterKey] = useState<FilterKey | null>(null);
  const [draftFilterValue, setDraftFilterValue] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const { data: soggetti = [] } = trpc.finanza.soggetti.list.useQuery(undefined);
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: categorieCentri = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const categoryQueryInput = useMemo(() => ({ centroCostoId: centroCostoId === "all" ? undefined : centroCostoId, categoriaCentroId: centroCostoId === "all" && categoriaCentroId !== "all" ? categoriaCentroId : undefined }), [centroCostoId, categoriaCentroId]);
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery(categoryQueryInput);
  const centriFiltrati = useMemo(() => (centriCosto as any[]).filter((centro) => categoriaCentroId === "all" || centro.categoriaCentroId === categoriaCentroId), [centriCosto, categoriaCentroId]);

  const queryInput = useMemo(() => ({
    dataInizio, dataFine, confrontoInizio, confrontoFine, granularita, direzione,
    soggettoId: soggettoId === "all" ? undefined : soggettoId,
    categoriaId: categoriaId === "all" ? undefined : categoriaId,
    categoriaCentroId: categoriaCentroId === "all" ? undefined : categoriaCentroId,
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
  }), [dataInizio, dataFine, confrontoInizio, confrontoFine, granularita, direzione, soggettoId, categoriaId, categoriaCentroId, centroCostoId]);
  const { data, isLoading, isError } = trpc.finanza.analytics.overview.useQuery(queryInput);

  const filterOptions = useMemo<Record<FilterKey, FilterOption[]>>(() => ({
    soggetto: [{ id: "all", label: "Tutti i soggetti" }, ...(soggetti as any[]).map((item) => ({ id: item.id, label: item.nomeBreve || item.ragioneSociale || "Senza nome", note: item.tipologia }))],
    categoriaCentro: [{ id: "all", label: "Tutte le categorie dei centri" }, ...(categorieCentri as any[]).filter((item) => item.attivo !== false).map((item) => ({ id: item.id, label: item.nome }))],
    centroCosto: [{ id: "all", label: "Tutti i centri di costo" }, ...centriFiltrati.filter((item: any) => item.attivo !== false).map((item: any) => ({ id: item.id, label: item.nome }))],
    categoria: [{ id: "all", label: "Tutte le sottocategorie" }, ...(categorie as any[]).filter((item) => item.attivo !== false).map((item) => ({ id: item.id, label: item.nome, note: item.tipo }))],
  }), [soggetti, categorieCentri, centriFiltrati, categorie]);

  const filterMeta: Record<FilterKey, { label: string; title: string; description: string }> = {
    soggetto: { label: "Soggetti", title: "Filtra per soggetto", description: "Cerca un cliente o un fornitore." },
    categoriaCentro: { label: "Categorie dei centri", title: "Categorie centri", description: "Riduce anche i centri e le sottocategorie disponibili." },
    centroCosto: { label: "Centri di costo", title: "Filtra per centro di costo", description: "Mostra solo i dati del centro selezionato." },
    categoria: { label: "Sottocategorie", title: "Filtra per sottocategoria", description: "Mostra solo i movimenti classificati con questa sottocategoria." },
  };

  const activeFilterValues = { soggetto: soggettoId, categoriaCentro: categoriaCentroId, centroCosto: centroCostoId, categoria: categoriaId };
  const filtriAttivi = Object.values(activeFilterValues).filter((value) => value !== "all").length;
  const filterLabel = filtriAttivi === 1 ? "1 filtro" : `${filtriAttivi} filtri`;
  const nomeDirezione = direzione === "entrate" ? "Entrate" : direzione === "uscite" ? "Uscite" : "Entrate e uscite";

  const comparisonRows = (data ? [
    { label: "Entrate", current: data.kpi.entrate.valore, previous: data.kpi.entrate.precedente, difference: data.kpi.entrate.differenza },
    { label: "Uscite", current: data.kpi.uscite.valore, previous: data.kpi.uscite.precedente, difference: data.kpi.uscite.differenza },
    { label: "Risultato", current: data.kpi.utile.valore, previous: data.kpi.utile.precedente, difference: data.kpi.utile.differenza },
  ] : []).filter((row) => direzione === "tutto" || (direzione === "entrate" ? row.label === "Entrate" : row.label === "Uscite"));
  const dimensionData = data ? (dimensione === "categorie" ? data.sottocategorie : dimensione === "categorie_centri" ? data.categorieCentri : dimensione === "soggetti" ? data.soggetti : data.centriCosto).slice(0, 8).map((item: any) => ({ ...item, valore: item.totale })) : [];
  const tipoGrafico = direzione === "entrate" ? "entrata" : "uscita";
  const pieData = data?.sottocategorie.filter((item: any) => item.tipo === tipoGrafico).slice(0, 8) ?? [];
  const confrontoDisponibile = Boolean(data?.confrontoDisponibile);
  const quickRead = useMemo(() => {
    if (!data) return [] as Array<{ livello: string; titolo: string; messaggio: string }>;
    const rows: Array<{ livello: string; titolo: string; messaggio: string }> = [];
    const topRevenue = data.sottocategorie.find((item: any) => item.tipo === "entrata");
    const topCost = data.sottocategorie.find((item: any) => item.tipo === "uscita");
    if (topRevenue && direzione !== "uscite") rows.push({ livello: "positivo", titolo: "Entrata principale", messaggio: `${topRevenue.nome}: ${fmtMoney(topRevenue.totale)} nel periodo.` });
    if (topCost && direzione !== "entrate") rows.push({ livello: "attenzione", titolo: "Costo principale", messaggio: `${topCost.nome}: ${fmtMoney(topCost.totale)} nel periodo.` });
    return [...data.insight, ...rows.filter((row) => !data.insight.some((insight: any) => insight.titolo === row.titolo))].slice(0, 3);
  }, [data, direzione]);

  function applicaPreset(next: Preset) {
    if (next === "personalizzato") { setCustomInizio(dataInizio); setCustomFine(dataFine); setCustomError(""); setCustomEditorOpen(true); return; }
    setPreset(next); setCustomEditorOpen(false);
    const range = rangeForPreset(next);
    setDataInizio(range.inizio); setDataFine(range.fine); setConfrontoInizio(range.precedente.inizio); setConfrontoFine(range.precedente.fine); setGranularita("mese");
  }
  function intervalloValido(inizio: string, fine: string) { return Boolean(inizio && fine && inizio <= fine); }
  function selezionaCustom() {
    if (!intervalloValido(customInizio, customFine)) { setCustomError("Inserisci un intervallo valido: la data finale non può precedere quella iniziale."); return; }
    const prev = previousRange(new Date(`${customInizio}T12:00:00`), new Date(`${customFine}T12:00:00`));
    setPreset("personalizzato"); setDataInizio(customInizio); setDataFine(customFine); setConfrontoInizio(prev.inizio); setConfrontoFine(prev.fine); setCustomEditorOpen(false);
  }
  function apriConfronto() { setDraftDataInizio(dataInizio); setDraftDataFine(dataFine); setDraftConfrontoInizio(confrontoInizio); setDraftConfrontoFine(confrontoFine); setCompareError(""); setCompareOpen(true); }
  function selezionaConfronto() {
    if (!intervalloValido(draftDataInizio, draftDataFine) || !intervalloValido(draftConfrontoInizio, draftConfrontoFine)) { setCompareError("Controlla le date: ogni intervallo deve avere una data iniziale precedente o uguale alla finale."); return; }
    setDataInizio(draftDataInizio); setDataFine(draftDataFine); setConfrontoInizio(draftConfrontoInizio); setConfrontoFine(draftConfrontoFine); setPreset("personalizzato"); setCustomEditorOpen(false); setCompareOpen(false);
  }
  function openFilter(key: FilterKey) { setOpenFilterKey(key); setDraftFilterValue(activeFilterValues[key]); setFilterSearch(""); }
  function applicaFiltro() {
    if (!openFilterKey) return;
    if (openFilterKey === "soggetto") setSoggettoId(draftFilterValue);
    if (openFilterKey === "categoriaCentro") { setCategoriaCentroId(draftFilterValue); setCentroCostoId("all"); setCategoriaId("all"); }
    if (openFilterKey === "centroCosto") { setCentroCostoId(draftFilterValue); setCategoriaId("all"); const centro = (centriCosto as any[]).find((item) => item.id === draftFilterValue); if (centro?.categoriaCentroId) setCategoriaCentroId(centro.categoriaCentroId); }
    if (openFilterKey === "categoria") setCategoriaId(draftFilterValue);
    setOpenFilterKey(null);
  }
  function resetFilters() { setSoggettoId("all"); setCategoriaId("all"); setCategoriaCentroId("all"); setCentroCostoId("all"); setOpenFilterKey(null); }

  const activeMeta = openFilterKey ? filterMeta[openFilterKey] : null;
  const visibleOptions = openFilterKey ? filterOptions[openFilterKey].filter((option) => option.label.toLocaleLowerCase("it-IT").includes(filterSearch.trim().toLocaleLowerCase("it-IT"))) : [];

  return <div className="min-h-screen bg-background pb-28">
    <header className="sticky top-0 z-20 border-b border-white/8 bg-background/95 px-4 py-2.5 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-3"><Link href="/finanza" aria-label="Torna alla Finanza" className="inline-flex size-9 items-center justify-center rounded-xl hover:bg-muted"><ArrowLeft className="size-5" /></Link><div className="min-w-0 flex-1"><h1 className="text-base font-semibold">Analisi finanziaria</h1><p className="truncate text-[11px] text-muted-foreground">Prima la risposta, poi l’approfondimento</p></div>{filtriAttivi > 0 && <Badge variant="secondary" className="shrink-0">{filterLabel}</Badge>}</div></header>

    <main className="mx-auto max-w-6xl space-y-3 px-4 py-3">
      <section className="rounded-2xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(212,168,67,.10),rgba(15,24,19,.75))] p-3 shadow-[0_12px_40px_rgba(0,0,0,.12)]">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Periodo analizzato</p><p className="mt-0.5 truncate text-sm font-semibold">{fmtPeriod(dataInizio)} — {fmtPeriod(dataFine)}</p><p className="mt-1 text-[11px] text-muted-foreground">{confrontoDisponibile ? `Confronto: ${fmtPeriod(confrontoInizio)} — ${fmtPeriod(confrontoFine)}` : "Periodo precedente da verificare"}</p></div><Button type="button" variant="outline" size="sm" className="h-9 shrink-0 border-amber-300/25 bg-black/10 text-amber-100 hover:bg-amber-300/10" onClick={apriConfronto}><Scale className="mr-1.5 size-3.5" />Confronta</Button></div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">{(["mese", "anno", "dodici_mesi", "personalizzato"] as Preset[]).map((key) => <button key={key} type="button" onClick={() => applicaPreset(key)} className={`min-h-9 rounded-lg px-1 text-[10px] font-semibold transition-colors ${(preset === key || (key === "personalizzato" && customEditorOpen)) ? "bg-amber-400 text-black" : "bg-black/15 text-muted-foreground hover:bg-white/5"}`}>{key === "mese" ? "Mese" : key === "anno" ? "Anno" : key === "dodici_mesi" ? "12 mesi" : "Custom"}</button>)}</div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><Select value={granularita} onValueChange={(value) => setGranularita(value as "mese" | "anno")}><SelectTrigger className="h-9 border-white/10 bg-black/10 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mese">Andamento mensile</SelectItem><SelectItem value="anno">Andamento annuale</SelectItem></SelectContent></Select><Button type="button" variant="outline" className="h-9 border-white/10 bg-black/10 px-3 text-xs" onClick={() => openFilter("soggetto")}><ListFilter className="mr-1.5 size-3.5" />{filtriAttivi ? filterLabel : "Filtri"}</Button></div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Direzione dei dati">{([{ value: "tutto", label: "Tutto", icon: Scale }, { value: "entrate", label: "Entrate", icon: ArrowDownRight }, { value: "uscite", label: "Uscite", icon: ArrowUpRight }] as const).map(({ value, label, icon: Icon }) => { const active = direzione === value; const tone = value === "entrate" ? "text-emerald-400" : value === "uscite" ? "text-red-400" : "text-amber-300"; return <button key={value} type="button" aria-pressed={active} onClick={() => setDirezione(value)} className={`flex h-9 items-center justify-center gap-1 rounded-lg border px-1 text-[10px] font-semibold transition-colors ${active ? "border-amber-400/60 bg-amber-400 text-black" : `border-white/8 bg-black/10 ${tone}`}`}><Icon className="size-3.5" />{label}</button>; })}</div>
      </section>

      <Sheet open={customEditorOpen} onOpenChange={setCustomEditorOpen}><SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"><SheetHeader className="text-left"><SheetTitle>Periodo Custom</SheetTitle><SheetDescription>Scegli le date da usare nell’analisi. Il confronto viene calcolato automaticamente sul periodo precedente equivalente.</SheetDescription></SheetHeader><div className="grid gap-3 py-5 sm:grid-cols-2"><div><Label className="text-xs">Da</Label><Input type="date" value={customInizio} onChange={(event) => { setCustomInizio(event.target.value); setCustomError(""); }} className="mt-1" /></div><div><Label className="text-xs">A</Label><Input type="date" value={customFine} onChange={(event) => { setCustomFine(event.target.value); setCustomError(""); }} className="mt-1" /></div></div>{customError && <p role="alert" className="text-xs leading-relaxed text-red-400">{customError}</p>}<SheetFooter className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={() => setCustomEditorOpen(false)}><ArrowLeft className="mr-2 size-4" />Indietro</Button><Button type="button" onClick={selezionaCustom}>Seleziona</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={compareOpen} onOpenChange={setCompareOpen}><SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"><SheetHeader className="text-left"><SheetTitle>Confronta periodi</SheetTitle><SheetDescription>Seleziona il periodo principale e quello con cui confrontarlo. I dati cambieranno solo dopo la conferma.</SheetDescription></SheetHeader><div className="space-y-4 py-5"><div className="space-y-3 rounded-xl border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Periodo analizzato</p><div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Da</Label><Input type="date" value={draftDataInizio} onChange={(event) => { setDraftDataInizio(event.target.value); setCompareError(""); }} className="mt-1" /></div><div><Label className="text-xs">A</Label><Input type="date" value={draftDataFine} onChange={(event) => { setDraftDataFine(event.target.value); setCompareError(""); }} className="mt-1" /></div></div></div><div className="space-y-3 rounded-xl border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Periodo di confronto</p><div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Confronta da</Label><Input type="date" value={draftConfrontoInizio} onChange={(event) => { setDraftConfrontoInizio(event.target.value); setCompareError(""); }} className="mt-1" /></div><div><Label className="text-xs">Confronta a</Label><Input type="date" value={draftConfrontoFine} onChange={(event) => { setDraftConfrontoFine(event.target.value); setCompareError(""); }} className="mt-1" /></div></div></div>{compareError && <p role="alert" className="text-sm leading-relaxed text-red-400">{compareError}</p>}</div><SheetFooter className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={() => setCompareOpen(false)}><ArrowLeft className="mr-2 size-4" />Indietro</Button><Button type="button" onClick={selezionaConfronto}>Seleziona</Button></SheetFooter></SheetContent></Sheet>

      <Sheet open={Boolean(openFilterKey)} onOpenChange={(open) => !open && setOpenFilterKey(null)}><SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"><SheetHeader className="text-left"><SheetTitle>Filtri analisi</SheetTitle><SheetDescription>{activeMeta?.description}</SheetDescription></SheetHeader><div className="grid grid-cols-2 gap-2 py-4">{(Object.keys(filterMeta) as FilterKey[]).map((key) => <button key={key} type="button" onClick={() => { setOpenFilterKey(key); setDraftFilterValue(activeFilterValues[key]); setFilterSearch(""); }} className={`min-h-10 rounded-xl border px-3 text-left text-xs font-medium ${openFilterKey === key ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-border bg-muted/40 text-muted-foreground"}`}><span className="block truncate">{filterMeta[key].label}</span><span className="mt-0.5 block truncate text-[10px] opacity-65">{filterOptions[key].find((item) => item.id === activeFilterValues[key])?.label}</span></button>)}</div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} placeholder={`Cerca ${activeMeta?.label.toLocaleLowerCase("it-IT") ?? ""}...`} className="pl-9" /></div><div className="mt-3 max-h-[42vh] space-y-1 overflow-y-auto pr-1">{visibleOptions.map((option) => { const selected = option.id === draftFilterValue; return <button key={option.id} type="button" onClick={() => setDraftFilterValue(option.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${selected ? "bg-emerald-400/12 text-emerald-50" : "hover:bg-muted/70"}`}><span className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? "border-emerald-300 bg-emerald-300 text-[#0a1510]" : "border-muted-foreground/35"}`}>{selected && <Check className="size-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{option.label}</span>{option.note && <span className="block truncate text-xs text-muted-foreground">{option.note}</span>}</span></button>; })}{visibleOptions.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nessun risultato per questa ricerca.</p>}</div><SheetFooter className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={resetFilters}><FilterX className="mr-2 size-4" />Azzera</Button><Button type="button" onClick={applicaFiltro}>Applica filtro</Button></SheetFooter></SheetContent></Sheet>

      {isLoading ? <AnalysisSkeleton /> : isError || !data ? <Card><CardContent className="py-12 text-center"><BarChart3 className="mx-auto mb-3 size-10 text-muted-foreground" /><p className="font-medium">Analisi non disponibile</p><p className="mt-1 text-sm text-muted-foreground">Controlla i periodi selezionati e riprova.</p></CardContent></Card> : <>
        <section><div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CircleDollarSign className="size-4 text-amber-300" /><h2 className="text-sm font-semibold">Risultato del periodo</h2></div><span className="text-[10px] text-muted-foreground">{nomeDirezione}</span></div><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{direzione !== "uscite" && <KpiCard label="Entrate" value={fmtMoney(data.kpi.entrate.valore)} delta={data.kpi.entrate.percentuale} tone="green" comparisonAvailable={confrontoDisponibile} />}{direzione !== "entrate" && <KpiCard label="Uscite" value={fmtMoney(data.kpi.uscite.valore)} delta={data.kpi.uscite.percentuale} tone="red" invert comparisonAvailable={confrontoDisponibile} />}{direzione === "tutto" && <KpiCard label="Risultato" value={fmtMoney(data.kpi.utile.valore)} delta={data.kpi.utile.percentuale} tone="gold" comparisonAvailable={confrontoDisponibile} />}{direzione === "tutto" && <KpiCard label="Margine" value={data.kpi.margine.valore == null ? "—" : `${data.kpi.margine.valore.toFixed(1)}%`} delta={data.kpi.margine.differenza} tone="blue" comparisonAvailable={confrontoDisponibile} />}</div></section>

        <Card className="overflow-hidden border-blue-400/20 bg-[linear-gradient(145deg,rgba(59,130,246,.10),rgba(10,20,16,.6))]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="size-4 text-blue-300" />Lettura rapida dei dati</CardTitle><p className="text-xs font-normal text-muted-foreground">Variazioni, voci principali e ciò che merita attenzione.</p></CardHeader><CardContent className="space-y-2">{quickRead.map((item, index) => <div key={`${item.titolo}-${index}`} className="flex gap-3 rounded-xl border border-white/8 bg-black/15 p-3">{item.livello === "positivo" ? <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : item.livello === "attenzione" ? <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-red-400" /> : <Scale className="mt-0.5 size-4 shrink-0 text-blue-300" />}<div className="min-w-0"><p className="text-sm font-medium">{item.titolo}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.messaggio}</p></div></div>)}</CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Confronto diretto</CardTitle></CardHeader><CardContent>{!confrontoDisponibile ? <ComparisonUnavailable /> : <div className="space-y-2"><div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground"><span>Voce</span><span className="text-right">Periodo</span><span className="text-right">Confronto</span><span className="text-right">Delta</span></div>{comparisonRows.map((row) => <div key={row.label} className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 border-t border-white/8 py-2 text-xs"><span className="font-medium">{row.label}</span><span className="text-right">{fmtMoney(row.current)}</span><span className="text-right text-muted-foreground">{fmtMoney(row.previous)}</span><span className={`text-right font-medium ${row.difference >= 0 ? "text-emerald-400" : "text-red-400"}`}>{row.difference >= 0 ? "+" : ""}{fmtMoney(row.difference)}</span></div>)}</div>}</CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Andamento: {nomeDirezione.toLowerCase()}</CardTitle></CardHeader><CardContent>{data.trend.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" /><XAxis dataKey="periodo" tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={fmtCompact} tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />{direzione !== "uscite" && <Bar dataKey="entrate" name="Entrate" fill={GREEN} radius={[3, 3, 0, 0]} />}{direzione !== "entrate" && <Bar dataKey="uscite" name="Uscite" fill={RED} radius={[3, 3, 0, 0]} />}{direzione === "tutto" && <Area type="monotone" dataKey="risultato" name="Risultato" stroke={GOLD} fill={GOLD} fillOpacity={0.08} strokeWidth={2} />}</ComposedChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-muted-foreground">Nessun movimento nel periodo selezionato.</p>}</CardContent></Card>

        <div className="grid gap-3 lg:grid-cols-2"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Composizione delle {tipoGrafico}</CardTitle></CardHeader><CardContent>{pieData.length ? <><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="totale" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2}>{pieData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer></div><div className="space-y-1.5">{pieData.slice(0, 5).map((item: any, index: number) => <div key={`${item.id}-${item.tipo}`} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} /><span className="truncate">{item.nome}</span></span><span className="shrink-0 font-medium">{fmtMoney(item.totale)}</span></div>)}</div></> : <p className="py-12 text-center text-sm text-muted-foreground">Nessun dato da distribuire.</p>}</CardContent></Card>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Confronta dimensioni</CardTitle><p className="text-xs font-normal text-muted-foreground">Le voci principali del filtro attivo, ordinate per importo.</p></CardHeader><CardContent><div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{(["categorie", "categorie_centri", "soggetti", "centri"] as Dimensione[]).map((item) => <button key={item} type="button" onClick={() => setDimensione(item)} className={`min-h-9 rounded-lg px-2 text-[10px] font-semibold ${dimensione === item ? "bg-emerald-400 text-[#07110d]" : "bg-muted text-muted-foreground"}`}>{item === "categorie" ? "Sottocategorie" : item === "categorie_centri" ? "Cat. centri" : item === "soggetti" ? "Soggetti" : "Centri"}</button>)}</div>{dimensionData.length ? <><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={dimensionData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,.08)" /><XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="nome" width={112} tickFormatter={(value) => shortLabel(String(value), 18)} tick={{ fill: "#a3a3a3", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="valore" name="Totale" fill={BLUE} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-3 space-y-1 border-t border-white/8 pt-2">{dimensionData.slice(0, 4).map((item: any, index: number) => <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-3 py-1 text-xs"><span className="min-w-0 truncate text-muted-foreground"><span className="mr-1.5 text-emerald-300">{index + 1}.</span>{item.nome}</span><span className="shrink-0 font-medium">{fmtMoney(item.valore)}</span></div>)}</div></> : <p className="py-12 text-center text-sm text-muted-foreground">Nessun dato per il confronto.</p>}</CardContent></Card></div>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground"><div className="rounded-xl border border-white/8 bg-card p-3"><Users className="mb-2 size-4 text-blue-400" /><p className="font-medium text-foreground">{data.kpi.movimenti.valore} movimenti</p><p>nel periodo analizzato</p></div><div className="rounded-xl border border-white/8 bg-card p-3"><BarChart3 className="mb-2 size-4 text-amber-300" /><p className="font-medium text-foreground">{dimensionData.length} voci</p><p>nel confronto attivo</p></div></div>
      </>}
    </main>
  </div>;
}
