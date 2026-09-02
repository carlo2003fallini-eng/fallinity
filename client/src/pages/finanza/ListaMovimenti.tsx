import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MovimentoActions } from "@/components/finance/MovimentoActions";
import {
  ArrowDownRight, ArrowUpRight, Search, Calendar, Receipt,
  Clock, CheckCircle2, XCircle, AlertTriangle, SlidersHorizontal, X, FilterX,
} from "lucide-react";

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

  const { data: soggetti = [] } = trpc.finanza.soggetti.list.useQuery(undefined);
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
    tipo: tipoFilter,
    stato: tab === "da_regolare" ? "registrato" : undefined,
    search: search || undefined,
    soggettoId: soggettoId === "all" ? undefined : soggettoId,
    categoriaId: categoriaId === "all" ? undefined : categoriaId,
    categoriaCentroId: categoriaCentroId === "all" ? undefined : categoriaCentroId,
    centroCostoId: centroCostoId === "all" ? undefined : centroCostoId,
    dataInizio: dataInizio || undefined,
    dataFine: dataFine || undefined,
  }), [tipoFilter, tab, search, soggettoId, categoriaId, categoriaCentroId, centroCostoId, dataInizio, dataFine]);
  const { data: movimenti = [], isLoading } = trpc.finanza.movimenti.list.useQuery(queryInput);

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
                {items.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex w-full items-center rounded-xl border bg-card pr-1 transition-colors hover:bg-accent/50"
                  >
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
