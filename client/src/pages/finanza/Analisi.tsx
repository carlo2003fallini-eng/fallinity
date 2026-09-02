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
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  FilterX,
  Lightbulb,
  Minus,
  Scale,
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
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(cents ?? 0) / 100);
}

function fmtCompact(cents: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

function fmtPeriod(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function Delta({ value, invert = false }: { value: number | null | undefined; invert?: boolean }) {
  if (value === null || value === undefined) return <span className="text-[11px] text-muted-foreground">Nessun confronto</span>;
  const positive = invert ? value <= 0 : value >= 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
      <Icon className="size-3" />{value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, delta, tone, invert }: {
  label: string;
  value: string;
  delta?: number | null;
  tone: "green" | "red" | "gold" | "blue";
  invert?: boolean;
}) {
  const palette = {
    green: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400",
    red: "border-red-500/20 bg-red-500/[0.06] text-red-400",
    gold: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
    blue: "border-blue-500/20 bg-blue-500/[0.06] text-blue-400",
  }[tone];
  return (
    <Card className={`border ${palette}`}>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-bold text-foreground">{value}</p>
        <div className="mt-1"><Delta value={delta} invert={invert} /></div>
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} style={{ color: item.color }}>{item.name}: {fmtMoney(item.value)}</p>
      ))}
    </div>
  );
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

  const { data: soggetti = [] } = trpc.finanza.soggetti.list.useQuery(undefined);
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: categorieCentri = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const categoryQueryInput = useMemo(() => ({
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
    categoriaCentroId: centroCostoId === "all" && categoriaCentroId !== "all" ? categoriaCentroId : undefined,
  }), [centroCostoId, categoriaCentroId]);
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery(categoryQueryInput);
  const centriFiltrati = useMemo(() => (centriCosto as any[]).filter((centro) => categoriaCentroId === "all" || centro.categoriaCentroId === categoriaCentroId), [centriCosto, categoriaCentroId]);

  const queryInput = useMemo(() => ({
    dataInizio,
    dataFine,
    confrontoInizio,
    confrontoFine,
    granularita,
    soggettoId: soggettoId === "all" ? undefined : soggettoId,
    categoriaId: categoriaId === "all" ? undefined : categoriaId,
    categoriaCentroId: categoriaCentroId === "all" ? undefined : categoriaCentroId,
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
  }), [dataInizio, dataFine, confrontoInizio, confrontoFine, granularita, soggettoId, categoriaId, categoriaCentroId, centroCostoId]);

  const { data, isLoading, isError } = trpc.finanza.analytics.overview.useQuery(queryInput);

  function applicaPreset(next: Preset) {
    if (next === "personalizzato") {
      setCustomInizio(dataInizio);
      setCustomFine(dataFine);
      setCustomError("");
      setCustomEditorOpen(true);
      return;
    }
    setPreset(next);
    setCustomEditorOpen(false);
    const range = rangeForPreset(next);
    setDataInizio(range.inizio);
    setDataFine(range.fine);
    setConfrontoInizio(range.precedente.inizio);
    setConfrontoFine(range.precedente.fine);
    setGranularita("mese");
  }

  function intervalloValido(inizio: string, fine: string) {
    return Boolean(inizio && fine && inizio <= fine);
  }

  function selezionaCustom() {
    if (!intervalloValido(customInizio, customFine)) {
      setCustomError("Inserisci un intervallo valido: la data finale non può precedere quella iniziale.");
      return;
    }
    const prev = previousRange(new Date(`${customInizio}T12:00:00`), new Date(`${customFine}T12:00:00`));
    setPreset("personalizzato");
    setDataInizio(customInizio);
    setDataFine(customFine);
    setConfrontoInizio(prev.inizio);
    setConfrontoFine(prev.fine);
    setCustomEditorOpen(false);
  }

  function apriConfronto() {
    setDraftDataInizio(dataInizio);
    setDraftDataFine(dataFine);
    setDraftConfrontoInizio(confrontoInizio);
    setDraftConfrontoFine(confrontoFine);
    setCompareError("");
    setCompareOpen(true);
  }

  function selezionaConfronto() {
    if (!intervalloValido(draftDataInizio, draftDataFine) || !intervalloValido(draftConfrontoInizio, draftConfrontoFine)) {
      setCompareError("Controlla le date: ogni intervallo deve avere una data iniziale precedente o uguale alla finale.");
      return;
    }
    setDataInizio(draftDataInizio);
    setDataFine(draftDataFine);
    setConfrontoInizio(draftConfrontoInizio);
    setConfrontoFine(draftConfrontoFine);
    setPreset("personalizzato");
    setCustomEditorOpen(false);
    setCompareOpen(false);
  }

  const filtriAttivi = [soggettoId, categoriaCentroId, centroCostoId, categoriaId].filter((id) => id !== "all").length;
  const comparisonRows = data ? [
    { label: "Entrate", current: data.kpi.entrate.valore, previous: data.kpi.entrate.precedente, difference: data.kpi.entrate.differenza },
    { label: "Uscite", current: data.kpi.uscite.valore, previous: data.kpi.uscite.precedente, difference: data.kpi.uscite.differenza },
    { label: "Risultato", current: data.kpi.utile.valore, previous: data.kpi.utile.precedente, difference: data.kpi.utile.differenza },
  ] : [];
  const dimensionData = data ? (
    dimensione === "categorie" ? data.sottocategorie : dimensione === "categorie_centri" ? data.categorieCentri : dimensione === "soggetti" ? data.soggetti : data.centriCosto
  ).slice(0, 8).map((item: any) => ({ ...item, valore: item.totale })) : [];
  const pieData = data?.sottocategorie.filter((item: any) => item.tipo === "uscita").slice(0, 8) ?? [];

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href="/finanza" aria-label="Torna alla Finanza" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Analisi finanziaria</h1>
            <p className="truncate text-xs text-muted-foreground">Confronti rapidi e dati spiegabili</p>
          </div>
          {filtriAttivi > 0 && <Badge variant="secondary">{filtriAttivi} filtri</Badge>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Periodo analizzato</p>
                <p className="mt-1 text-lg font-semibold">{fmtPeriod(dataInizio)} — {fmtPeriod(dataFine)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Confronto: {fmtPeriod(confrontoInizio)} — {fmtPeriod(confrontoFine)}</p>
              </div>
              <CalendarRange className="size-6 shrink-0 text-amber-300" />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(["mese", "anno", "dodici_mesi", "personalizzato"] as Preset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applicaPreset(key)}
                  className={`rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${(preset === key || (key === "personalizzato" && customEditorOpen)) ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}
                >
                  {key === "mese" ? "Mese" : key === "anno" ? "Anno" : key === "dodici_mesi" ? "12 mesi" : "Custom"}
                </button>
              ))}
            </div>
            {customEditorOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-400/25 bg-black/20 p-3">
                <div>
                  <p className="text-sm font-semibold">Periodo Custom</p>
                  <p className="text-xs text-muted-foreground">Scegli le date da usare nell’analisi.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Da</Label><Input type="date" value={customInizio} onChange={(event) => { setCustomInizio(event.target.value); setCustomError(""); }} className="mt-1" /></div>
                  <div><Label className="text-xs">A</Label><Input type="date" value={customFine} onChange={(event) => { setCustomFine(event.target.value); setCustomError(""); }} className="mt-1" /></div>
                </div>
                {customError && <p role="alert" className="text-xs leading-relaxed text-red-400">{customError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setCustomEditorOpen(false)}><ArrowLeft className="mr-2 size-4" />Indietro</Button>
                  <Button type="button" onClick={selezionaCustom}>Seleziona</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-2">
            <Select value={granularita} onValueChange={(value) => setGranularita(value as "mese" | "anno")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="mese">Andamento mensile</SelectItem><SelectItem value="anno">Andamento annuale</SelectItem></SelectContent>
            </Select>
            </CardContent>
          </Card>
          <Button type="button" variant="outline" className="h-full min-h-14 bg-card" onClick={apriConfronto}><Scale className="mr-2 size-4 text-amber-300" />Confronta</Button>
        </div>

        <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
          <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader className="text-left">
              <SheetTitle>Confronta periodi</SheetTitle>
              <SheetDescription>Seleziona il periodo principale e quello con cui confrontarlo. I dati cambieranno solo dopo la conferma.</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 py-5">
              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Periodo analizzato</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Da</Label><Input type="date" value={draftDataInizio} onChange={(event) => { setDraftDataInizio(event.target.value); setCompareError(""); }} className="mt-1" /></div>
                  <div><Label className="text-xs">A</Label><Input type="date" value={draftDataFine} onChange={(event) => { setDraftDataFine(event.target.value); setCompareError(""); }} className="mt-1" /></div>
                </div>
              </div>
              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Periodo di confronto</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Confronta da</Label><Input type="date" value={draftConfrontoInizio} onChange={(event) => { setDraftConfrontoInizio(event.target.value); setCompareError(""); }} className="mt-1" /></div>
                  <div><Label className="text-xs">Confronta a</Label><Input type="date" value={draftConfrontoFine} onChange={(event) => { setDraftConfrontoFine(event.target.value); setCompareError(""); }} className="mt-1" /></div>
                </div>
              </div>
              {compareError && <p role="alert" className="text-sm leading-relaxed text-red-400">{compareError}</p>}
            </div>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setCompareOpen(false)}><ArrowLeft className="mr-2 size-4" />Indietro</Button>
              <Button type="button" onClick={selezionaConfronto}>Seleziona</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Filtri analisi</CardTitle>
            {filtriAttivi > 0 && <Button variant="ghost" size="sm" onClick={() => { setSoggettoId("all"); setCategoriaId("all"); setCategoriaCentroId("all"); setCentroCostoId("all"); }}><FilterX className="mr-1 size-4" />Azzera</Button>}
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={soggettoId} onValueChange={setSoggettoId}>
              <SelectTrigger><SelectValue placeholder="Tutti i soggetti" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutti i soggetti</SelectItem>{(soggetti as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.nomeBreve || s.ragioneSociale}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoriaCentroId} onValueChange={(value) => { setCategoriaCentroId(value); setCentroCostoId("all"); setCategoriaId("all"); }}>
              <SelectTrigger><SelectValue placeholder="Categorie dei centri" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutte le categorie dei centri</SelectItem>{(categorieCentri as any[]).filter((c) => c.attivo !== false).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={centroCostoId} onValueChange={(value) => { setCentroCostoId(value); setCategoriaId("all"); const centro = (centriCosto as any[]).find((item) => item.id === value); if (centro?.categoriaCentroId) setCategoriaCentroId(centro.categoriaCentroId); }}>
              <SelectTrigger><SelectValue placeholder="Tutti i centri" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutti i centri di costo</SelectItem>{centriFiltrati.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder="Tutte le sottocategorie" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutte le sottocategorie</SelectItem>{(categorie as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3"><div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div><Skeleton className="h-64 rounded-xl" /></div>
        ) : isError || !data ? (
          <Card><CardContent className="py-12 text-center"><BarChart3 className="mx-auto mb-3 size-10 text-muted-foreground" /><p className="font-medium">Analisi non disponibile</p><p className="mt-1 text-sm text-muted-foreground">Controlla i periodi selezionati e riprova.</p></CardContent></Card>
        ) : (
          <>
            <section>
              <div className="mb-2 flex items-center gap-2"><CircleDollarSign className="size-4 text-amber-300" /><h2 className="text-sm font-semibold">Sintesi del periodo</h2></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Entrate" value={fmtMoney(data.kpi.entrate.valore)} delta={data.kpi.entrate.percentuale} tone="green" />
                <KpiCard label="Uscite" value={fmtMoney(data.kpi.uscite.valore)} delta={data.kpi.uscite.percentuale} tone="red" invert />
                <KpiCard label="Risultato" value={fmtMoney(data.kpi.utile.valore)} delta={data.kpi.utile.percentuale} tone="gold" />
                <KpiCard label="Margine" value={data.kpi.margine.valore == null ? "—" : `${data.kpi.margine.valore.toFixed(1)}%`} delta={data.kpi.margine.differenza} tone="blue" />
              </div>
            </section>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Andamento entrate, uscite e risultato</CardTitle></CardHeader>
              <CardContent>
                {data.trend.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                        <XAxis dataKey="periodo" tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtCompact} tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="entrate" name="Entrate" fill={GREEN} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="uscite" name="Uscite" fill={RED} radius={[3, 3, 0, 0]} />
                        <Area type="monotone" dataKey="risultato" name="Risultato" stroke={GOLD} fill={GOLD} fillOpacity={0.08} strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-12 text-center text-sm text-muted-foreground">Nessun movimento nel periodo selezionato.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Confronto diretto</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Voce</span><span className="text-right">Periodo</span><span className="text-right">Confronto</span><span className="text-right">Delta</span>
                </div>
                {comparisonRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2 border-t py-2 text-xs">
                    <span className="font-medium">{row.label}</span><span className="text-right">{fmtMoney(row.current)}</span><span className="text-right text-muted-foreground">{fmtMoney(row.previous)}</span><span className={`text-right font-medium ${row.difference >= 0 ? "text-emerald-400" : "text-red-400"}`}>{row.difference >= 0 ? "+" : ""}{fmtMoney(row.difference)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Composizione delle uscite</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length ? <>
                    <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="totale" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2}>{pieData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value: number) => fmtMoney(value)} /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-1.5">{pieData.slice(0, 5).map((item: any, index: number) => <div key={`${item.id}-${item.tipo}`} className="flex items-center justify-between text-xs"><span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} /><span className="truncate">{item.nome}</span></span><span className="font-medium">{fmtMoney(item.totale)}</span></div>)}</div>
                  </> : <p className="py-12 text-center text-sm text-muted-foreground">Nessuna uscita da distribuire.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Confronta dimensioni</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["categorie", "categorie_centri", "soggetti", "centri"] as Dimensione[]).map((item) => <button key={item} type="button" onClick={() => setDimensione(item)} className={`rounded-lg px-2 py-2 text-xs font-medium ${dimensione === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{item === "categorie" ? "Sottocategorie" : item === "categorie_centri" ? "Categorie centri" : item === "soggetti" ? "Soggetti" : "Centri"}</button>)}
                  </div>
                  {dimensionData.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={dimensionData} layout="vertical" margin={{ top: 0, right: 8, left: 10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,.08)" /><XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: "#8a8a8a", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="nome" width={90} tick={{ fill: "#a3a3a3", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => fmtMoney(value)} /><Bar dataKey="valore" name="Totale" fill={BLUE} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-muted-foreground">Nessun dato per il confronto.</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="border-blue-500/20 bg-blue-500/[0.04]">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="size-4 text-blue-400" />Lettura rapida dei dati</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.insight.map((item, index) => (
                  <div key={`${item.titolo}-${index}`} className="flex gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                    {item.livello === "positivo" ? <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : item.livello === "attenzione" ? <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-red-400" /> : <Scale className="mt-0.5 size-4 shrink-0 text-blue-400" />}
                    <div><p className="text-sm font-medium">{item.titolo}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.messaggio}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-xl border bg-card p-3"><Users className="mb-2 size-4 text-blue-400" /><p className="font-medium text-foreground">{data.kpi.movimenti.valore} movimenti</p><p>nel periodo analizzato</p></div>
              <div className="rounded-xl border bg-card p-3"><BarChart3 className="mb-2 size-4 text-amber-300" /><p className="font-medium text-foreground">{dimensionData.length} voci</p><p>nel confronto attivo</p></div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
