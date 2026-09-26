import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MovimentoActions } from "@/components/finance/MovimentoActions";
import {
  ArrowDownRight, ArrowUpRight, Search, Calendar, Receipt,
  Clock, CheckCircle2, XCircle, AlertTriangle, SlidersHorizontal, X, FilterX,
  Banknote, ListChecks, WalletCards,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const RED = "oklch(0.55 0.22 25)";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }); }
  catch { return d; }
};

const statoIcon: Record<string, React.ReactNode> = {
  registrato: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  pagato: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  incassato: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  annullato: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
  scaduto: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  parzialmente_regolato: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  bozza: <Receipt className="w-3.5 h-3.5 text-muted-foreground" />,
};

const statoLabel: Record<string, string> = {
  registrato: "Da regolare",
  pagato: "Pagato",
  incassato: "Incassato",
  annullato: "Annullato",
  scaduto: "Scaduto",
  parzialmente_regolato: "Parziale",
  bozza: "Bozza",
};

type TabFilter = "tutti" | "entrate" | "uscite" | "da_regolare";
const STATI_PAGABILI = ["registrato", "parzialmente_regolato", "scaduto"] as const;

const oggi = () => new Date().toISOString().slice(0, 10);

export default function ListaMovimenti() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabFilter>("tutti");
  const [search, setSearch] = useState("");
  const [soggettoId, setSoggettoId] = useState("all");
  const [categoriaId, setCategoriaId] = useState("all");
  const [categoriaCentroId, setCategoriaCentroId] = useState("all");
  const [centroCostoId, setCentroCostoId] = useState("all");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [pagamentoMultiploOpen, setPagamentoMultiploOpen] = useState(false);
  const [pagamentoMultiplo, setPagamentoMultiplo] = useState({
    contoId: "",
    metodoId: "__none__",
    data: oggi(),
    riferimento: "",
    note: "",
  });

  const { data: soggetti = [] } = trpc.finanza.soggetti.list.useQuery(undefined);
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();
  const utils = trpc.useUtils();
  const categoryQueryInput = useMemo(() => ({
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
    categoriaCentroId: centroCostoId === "all" && categoriaCentroId !== "all" ? categoriaCentroId : undefined,
  }), [centroCostoId, categoriaCentroId]);
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery(categoryQueryInput);
  const { data: categorieCentri = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const centriFiltrati = useMemo(() => (centriCosto as any[]).filter((centro) => categoriaCentroId === "all" || centro.categoriaCentroId === categoriaCentroId), [centriCosto, categoriaCentroId]);

  const tipoFilter: "entrata" | "uscita" | undefined = tab === "entrate" ? "entrata" : tab === "uscite" ? "uscita" : undefined;
  const queryInput = useMemo(() => ({
    tipo: tab === "da_regolare" ? "uscita" : tipoFilter,
    stati: tab === "da_regolare" ? [...STATI_PAGABILI] : undefined,
    search: search || undefined,
    soggettoId: soggettoId === "all" ? undefined : soggettoId,
    categoriaId: categoriaId === "all" ? undefined : categoriaId,
    categoriaCentroId: categoriaCentroId === "all" ? undefined : categoriaCentroId,
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
    dataInizio: dataInizio || undefined,
    dataFine: dataFine || undefined,
  }), [tipoFilter, tab, search, soggettoId, categoriaId, categoriaCentroId, centroCostoId, dataInizio, dataFine]);
  const { data: movimenti = [], isLoading } = trpc.finanza.movimenti.list.useQuery(queryInput);

  const registraMultipli = trpc.finanza.pagamenti.registraMultipli.useMutation({
    onSuccess: async (result) => {
      await utils.finanza.invalidate();
      toast.success(`${result.documentiPagati} fatture pagate · ${fmtCents(result.totale)}`);
      setSelezionati([]);
      setPagamentoMultiploOpen(false);
      setPagamentoMultiplo((form) => ({ ...form, riferimento: "", note: "" }));
    },
    onError: (error) => toast.error(error.message),
  });

  const fatturePagabili = useMemo(() => (movimenti as any[]).filter((movimento) => (
    movimento.tipo === "uscita"
    && STATI_PAGABILI.includes(movimento.stato)
    && Number(movimento.residuo ?? movimento.totale) > 0
  )), [movimenti]);
  const fattureSelezionate = useMemo(() => {
    const ids = new Set(selezionati);
    return fatturePagabili.filter((movimento) => ids.has(movimento.id));
  }, [fatturePagabili, selezionati]);
  const totaleSelezionato = useMemo(
    () => fattureSelezionate.reduce((somma, movimento) => somma + Number(movimento.residuo ?? movimento.totale), 0),
    [fattureSelezionate],
  );
  const contoSelezionato = (conti as any[]).find((conto) => conto.id === pagamentoMultiplo.contoId);
  const saldoPrevisto = contoSelezionato ? Number(contoSelezionato.saldoAttuale) - totaleSelezionato : null;
  const contiAttivi = (conti as any[]).filter((conto) => conto.attivo !== false);
  const metodiAttivi = (metodi as any[]).filter((metodo) => metodo.attivo !== false);
  const tutteSelezionate = fatturePagabili.length > 0 && fattureSelezionate.length === fatturePagabili.length;

  useEffect(() => {
    const disponibili = new Set(fatturePagabili.map((movimento) => movimento.id));
    setSelezionati((correnti) => {
      const aggiornati = correnti.filter((id) => disponibili.has(id));
      return aggiornati.length === correnti.length ? correnti : aggiornati;
    });
  }, [fatturePagabili]);

  useEffect(() => {
    if (tab !== "da_regolare") setSelezionati([]);
  }, [tab]);

  const cambiaSelezione = (id: string, selezionato: boolean) => {
    setSelezionati((correnti) => selezionato
      ? Array.from(new Set([...correnti, id]))
      : correnti.filter((corrente) => corrente !== id));
  };
  const selezionaTutte = (selezionate: boolean) => {
    setSelezionati(selezionate ? fatturePagabili.map((movimento) => movimento.id) : []);
  };

  const labelFor = (items: any[], id: string, fallback: string) => {
    const item = items.find((candidate) => candidate.id === id);
    return item?.nomeBreve || item?.ragioneSociale || item?.nome || fallback;
  };
  const activeFilters = [
    soggettoId !== "all" ? { key: "soggetto", label: labelFor(soggetti as any[], soggettoId, "Soggetto"), clear: () => setSoggettoId("all") } : null,
    categoriaCentroId !== "all" ? { key: "categoriaCentro", label: labelFor(categorieCentri as any[], categoriaCentroId, "Categoria del centro"), clear: () => { setCategoriaCentroId("all"); setCentroCostoId("all"); setCategoriaId("all"); } } : null,
    centroCostoId !== "all" ? { key: "centro", label: labelFor(centriCosto as any[], centroCostoId, "Centro di costo"), clear: () => setCentroCostoId("all") } : null,
    categoriaId !== "all" ? { key: "sottocategoria", label: labelFor(categorie as any[], categoriaId, "Sottocategoria"), clear: () => setCategoriaId("all") } : null,
    dataInizio ? { key: "inizio", label: `Dal ${fmtDate(dataInizio)}`, clear: () => setDataInizio("") } : null,
    dataFine ? { key: "fine", label: `Al ${fmtDate(dataFine)}`, clear: () => setDataFine("") } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const clearFilters = () => {
    setSoggettoId("all");
    setCategoriaId("all");
    setCategoriaCentroId("all");
    setCentroCostoId("all");
    setDataInizio("");
    setDataFine("");
  };

  // Raggruppamento per mese
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const m of movimenti as any[]) {
      const date = new Date(m.dataDocumento);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...m, monthLabel: label });
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [movimenti]);

  // Totali per tab
  const totali = useMemo(() => {
    let entrate = 0, uscite = 0;
    for (const m of movimenti as any[]) {
      if (m.tipo === "entrata") entrate += m.totale;
      else uscite += m.totale;
    }
    return { entrate, uscite, saldo: entrate - uscite };
  }, [movimenti]);

  return (
    <div className="space-y-4">
      {/* Riepilogo rapido */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Entrate</p>
          <p className="text-sm font-bold text-emerald-600">{fmtCents(totali.entrate)}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Uscite</p>
          <p className="text-sm font-bold text-red-600">{fmtCents(totali.uscite)}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-sm font-bold ${totali.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmtCents(totali.saldo)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="tutti">Tutti</TabsTrigger>
          <TabsTrigger value="entrate">Entrate</TabsTrigger>
          <TabsTrigger value="uscite">Uscite</TabsTrigger>
          <TabsTrigger value="da_regolare">Scadenze</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Ricerca e filtri */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Descrizione, fornitore, centro, sottocategoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative shrink-0 bg-card">
              <SlidersHorizontal className="mr-2 size-4" />Filtri
              {activeFilters.length > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeFilters.length}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader className="text-left">
              <SheetTitle>Filtra i movimenti</SheetTitle>
              <SheetDescription>Combina più criteri per isolare esattamente i dati che ti servono.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Cliente o fornitore</Label>
                <Select value={soggettoId} onValueChange={setSoggettoId}>
                  <SelectTrigger><SelectValue placeholder="Tutti i soggetti" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutti i soggetti</SelectItem>{(soggetti as any[]).map((item) => <SelectItem key={item.id} value={item.id}>{item.nomeBreve || item.ragioneSociale}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria del centro</Label>
                <Select value={categoriaCentroId} onValueChange={(value) => { setCategoriaCentroId(value); setCentroCostoId("all"); setCategoriaId("all"); }}>
                  <SelectTrigger><SelectValue placeholder="Tutte le categorie dei centri" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutte le categorie dei centri</SelectItem>{(categorieCentri as any[]).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centro di costo</Label>
                <Select value={centroCostoId} onValueChange={(value) => { setCentroCostoId(value); setCategoriaId("all"); const centro = (centriCosto as any[]).find((item) => item.id === value); if (centro?.categoriaCentroId) setCategoriaCentroId(centro.categoriaCentroId); }}>
                  <SelectTrigger><SelectValue placeholder="Tutti i centri" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutti i centri di costo</SelectItem>{centriFiltrati.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sottocategoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Tutte le sottocategorie" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutte le sottocategorie</SelectItem>{(categorie as any[]).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Dal</Label><Input type="date" value={dataInizio} onChange={(event) => setDataInizio(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Al</Label><Input type="date" value={dataFine} onChange={(event) => setDataFine(event.target.value)} /></div>
              </div>
            </div>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={clearFilters}><FilterX className="mr-2 size-4" />Azzera filtri</Button>
              <SheetClose asChild><Button type="button">Mostra risultati</Button></SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtri attivi">
          {activeFilters.map((filter) => (
            <button key={filter.key} type="button" onClick={filter.clear} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <span className="max-w-40 truncate">{filter.label}</span><X className="size-3" aria-hidden="true" />
              <span className="sr-only">Rimuovi filtro {filter.label}</span>
            </button>
          ))}
          {activeFilters.length > 1 && <button type="button" onClick={clearFilters} className="px-2 py-1 text-xs text-muted-foreground underline underline-offset-2">Azzera tutti</button>}
        </div>
      )}

      {tab === "da_regolare" && (
        <section className="sticky top-2 z-10 rounded-2xl border border-amber-400/25 bg-background/95 p-3 shadow-lg shadow-black/15 backdrop-blur" aria-label="Pagamento multiplo fatture">
          <div className="flex items-start gap-3">
            <Checkbox
              id="seleziona-tutte-fatture"
              checked={tutteSelezionate}
              onCheckedChange={(checked) => selezionaTutte(checked === true)}
              disabled={!fatturePagabili.length}
              className="mt-1 size-5"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="seleziona-tutte-fatture" className="cursor-pointer text-sm font-semibold">Pagamento multiplo</label>
              <p className="mt-0.5 text-xs text-muted-foreground">Seleziona le fatture di uscita e saldale con un unico conto, metodo e data.</p>
            </div>
            {selezionati.length > 0 && <Badge variant="secondary" className="shrink-0">{selezionati.length}</Badge>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-400/10 p-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Totale selezionato</p>
              <p className="truncate text-base font-bold text-amber-300">{fmtCents(totaleSelezionato)}</p>
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 bg-amber-400 font-semibold text-black hover:bg-amber-300"
              disabled={fattureSelezionate.length < 2}
              onClick={() => setPagamentoMultiploOpen(true)}
            >
              <Banknote className="mr-2 size-4" />Paga {fattureSelezionate.length || ""} fatture
            </Button>
          </div>
          {fattureSelezionate.length < 2 && <p className="mt-2 text-xs text-muted-foreground">Seleziona almeno due fatture per usare il pagamento multiplo.</p>}
        </section>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{activeFilters.length || search ? "Nessun movimento corrisponde ai filtri" : "Nessun movimento"}</p>
          <p className="text-sm mt-1">{activeFilters.length || search ? "Modifica o rimuovi uno dei criteri attivi." : "Premi + per registrare il primo"}</p>
          {(activeFilters.length > 0 || search) && <Button variant="outline" size="sm" className="mt-4" onClick={() => { clearFilters(); setSearch(""); }}>Azzera ricerca e filtri</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {items[0].monthLabel}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((m: any) => {
                  const selezionabile = tab === "da_regolare"
                    && m.tipo === "uscita"
                    && STATI_PAGABILI.includes(m.stato)
                    && Number(m.residuo ?? m.totale) > 0;
                  const selezionata = selezionati.includes(m.id);
                  const residuo = Number(m.residuo ?? m.totale);
                  return (
                  <div
                    key={m.id}
                    className={`flex w-full items-center rounded-xl border bg-card pr-1 transition-colors hover:bg-accent/50 ${selezionata ? "border-amber-400/60 bg-amber-400/5" : ""}`}
                  >
                    {selezionabile && (
                      <div className="flex shrink-0 self-stretch items-center pl-3 pr-1">
                        <Checkbox
                          checked={selezionata}
                          onCheckedChange={(checked) => cambiaSelezione(m.id, checked === true)}
                          aria-label={`Seleziona ${m.descrizione || m.codiceInterno || "fattura"} per il pagamento`}
                          className="size-5"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setLocation(`/finanza/movimento/${m.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                      aria-label={`Apri ${m.descrizione || m.tipoDocumento || "movimento"}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        m.tipo === "entrata" ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}>
                        {m.tipo === "entrata"
                          ? <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          : <ArrowUpRight className="w-4 h-4 text-red-600" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.descrizione || m.tipoDocumento || (m.tipo === "entrata" ? "Entrata" : "Uscita")}
                        </p>
                        {m.soggettoNome && <p className="truncate text-xs text-muted-foreground">{m.soggettoNome}{m.categoriaCentroNome ? ` · ${m.categoriaCentroNome}` : ""}{m.centroCostoNome ? ` / ${m.centroCostoNome}` : ""}</p>}
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {statoIcon[m.stato]}
                          <span className="text-xs text-muted-foreground">{statoLabel[m.stato] || m.stato}</span>
                          <span className="text-xs text-muted-foreground">• {fmtDate(m.dataDocumento)}</span>
                        </div>
                        {selezionabile && <p className="mt-1 text-xs font-medium text-amber-300">Da pagare: {fmtCents(residuo)}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold" style={{ color: m.tipo === "entrata" ? GREEN : RED }}>
                          {m.tipo === "entrata" ? "+" : "-"}{fmtCents(m.totale)}
                        </p>
                        {m.sottocategoriaNome && (
                          <Badge variant="outline" className="mt-0.5 text-[10px]">{m.sottocategoriaNome}</Badge>
                        )}
                      </div>
                    </button>
                    <MovimentoActions movimento={m} />
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={pagamentoMultiploOpen} onOpenChange={setPagamentoMultiploOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Conferma pagamento multiplo</SheetTitle>
            <SheetDescription>Ogni fattura selezionata sarà saldata per il suo residuo. L’operazione registra un pagamento distinto e tracciabile per ciascuna fattura.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-5">
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Da pagare</p>
                  <p className="mt-1 text-2xl font-bold text-amber-200">{fmtCents(totaleSelezionato)}</p>
                </div>
                <Badge className="bg-amber-400 text-black">{fattureSelezionate.length} fatture</Badge>
              </div>
              <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-lg bg-black/15 p-2">
                {fattureSelezionate.map((fattura) => (
                  <div key={fattura.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">{fattura.codiceInterno ?? fattura.numero ?? fattura.descrizione ?? "Fattura"}</span>
                    <span className="shrink-0 font-semibold">{fmtCents(Number(fattura.residuo ?? fattura.totale))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Conto di addebito *</Label>
              <Select value={pagamentoMultiplo.contoId} onValueChange={(contoId) => setPagamentoMultiplo((form) => ({ ...form, contoId }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona il conto" /></SelectTrigger>
                <SelectContent>
                  {contiAttivi.map((conto) => <SelectItem key={conto.id} value={conto.id}>{conto.nome} · {fmtCents(Number(conto.saldoAttuale))}</SelectItem>)}
                </SelectContent>
              </Select>
              {contoSelezionato && (
                <p className={`text-xs ${Number(saldoPrevisto) < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  Saldo previsto dopo il pagamento: <strong>{fmtCents(Number(saldoPrevisto))}</strong>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Metodo di pagamento</Label>
              <Select value={pagamentoMultiplo.metodoId} onValueChange={(metodoId) => setPagamentoMultiplo((form) => ({ ...form, metodoId }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non specificato</SelectItem>
                  {metodiAttivi.map((metodo) => <SelectItem key={metodo.id} value={metodo.id}>{metodo.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data pagamento *</Label>
                <Input type="date" value={pagamentoMultiplo.data} onChange={(event) => setPagamentoMultiplo((form) => ({ ...form, data: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Riferimento</Label>
                <Input value={pagamentoMultiplo.riferimento} onChange={(event) => setPagamentoMultiplo((form) => ({ ...form, riferimento: event.target.value }))} placeholder="Es. bonifico #123" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nota comune</Label>
              <Textarea rows={3} value={pagamentoMultiplo.note} onChange={(event) => setPagamentoMultiplo((form) => ({ ...form, note: event.target.value }))} placeholder="Facoltativa: verrà salvata su ogni pagamento" />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2"><WalletCards className="mt-0.5 size-4 shrink-0 text-amber-300" /><p>Confermando, saranno aggiornati insieme residui, scadenze, saldo del conto e movimenti di cassa. Se una fattura non è più pagabile, nessun pagamento verrà registrato.</p></div>
            </div>
          </div>

          <SheetFooter className="grid grid-cols-2 gap-2">
            <SheetClose asChild><Button type="button" variant="outline">Indietro</Button></SheetClose>
            <Button
              type="button"
              disabled={fattureSelezionate.length < 2 || !pagamentoMultiplo.contoId || !pagamentoMultiplo.data || registraMultipli.isPending}
              onClick={() => {
                if (fattureSelezionate.length < 2) return toast.error("Seleziona almeno due fatture");
                if (!pagamentoMultiplo.contoId) return toast.error("Seleziona un conto di addebito");
                registraMultipli.mutate({
                  documentoIds: fattureSelezionate.map((fattura) => fattura.id),
                  contoId: pagamentoMultiplo.contoId,
                  metodoId: pagamentoMultiplo.metodoId === "__none__" ? undefined : pagamentoMultiplo.metodoId,
                  data: pagamentoMultiplo.data,
                  riferimento: pagamentoMultiplo.riferimento.trim() || undefined,
                  note: pagamentoMultiplo.note.trim() || undefined,
                });
              }}
            >
              {registraMultipli.isPending ? "Registrazione..." : "Conferma pagamento"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
