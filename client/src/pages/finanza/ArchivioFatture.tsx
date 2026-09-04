import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertTriangle, ArrowLeft, Archive, ChevronLeft, ChevronRight, FileSearch, Loader2, Search, SlidersHorizontal, X } from "lucide-react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ArchiveItem = RouterOutputs["finanza"]["fattureAutomatiche"]["archivio"]["items"][number];
type InvoiceState = "da_verificare" | "verificata" | "registrata" | "pagata" | "errore" | "annullata";
type TriState = "tutti" | "solo" | "nessuno";

const PAGE_SIZE = 30;
const REVIEW_SESSION_KEY = "fallinity_fattura_automatica_corrente";
const states: Array<{ value: InvoiceState; label: string }> = [
  { value: "da_verificare", label: "Da verificare" },
  { value: "verificata", label: "Verificata" },
  { value: "registrata", label: "Registrata" },
  { value: "pagata", label: "Pagata" },
  { value: "errore", label: "Con errore" },
  { value: "annullata", label: "Annullata" },
];
const stateStyle: Record<InvoiceState, string> = {
  da_verificare: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  verificata: "border-sky-300/25 bg-sky-300/10 text-sky-100",
  registrata: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  pagata: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  errore: "border-red-300/25 bg-red-300/10 text-red-100",
  annullata: "border-white/15 bg-white/[0.05] text-white/60",
};

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function euroToCents(value: string) {
  const parsed = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined;
}

export default function ArchivioFatture() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedStates, setSelectedStates] = useState<InvoiceState[]>([]);
  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [totaleMin, setTotaleMin] = useState("");
  const [totaleMax, setTotaleMax] = useState("");
  const [avvisi, setAvvisi] = useState<TriState>("tutti");
  const [duplicati, setDuplicati] = useState<TriState>("tutti");
  const [offset, setOffset] = useState(0);

  const queryInput = useMemo(() => ({
    search: search.trim() || undefined,
    stati: selectedStates.length ? selectedStates : undefined,
    dataDa: dataDa || undefined,
    dataA: dataA || undefined,
    totaleMin: totaleMin.trim() ? euroToCents(totaleMin) : undefined,
    totaleMax: totaleMax.trim() ? euroToCents(totaleMax) : undefined,
    conAvvisi: avvisi === "tutti" ? undefined : avvisi === "solo",
    conPossibileDuplicato: duplicati === "tutti" ? undefined : duplicati === "solo",
    limit: PAGE_SIZE,
    offset,
  }), [search, selectedStates, dataDa, dataA, totaleMin, totaleMax, avvisi, duplicati, offset]);
  const archiveQuery = trpc.finanza.fattureAutomatiche.archivio.useQuery(queryInput, { retry: false });
  const result = archiveQuery.data;

  const updateSearch = (value: string) => { setSearch(value); setOffset(0); };
  const toggleState = (state: InvoiceState) => {
    setSelectedStates((current) => current.includes(state) ? current.filter((value) => value !== state) : [...current, state]);
    setOffset(0);
  };
  const clearFilters = () => {
    setSearch(""); setSelectedStates([]); setDataDa(""); setDataA(""); setTotaleMin(""); setTotaleMax(""); setAvvisi("tutti"); setDuplicati("tutti"); setOffset(0);
  };
  const activeFilters = [
    ...selectedStates.map((state) => ({ key: `state-${state}`, label: states.find((item) => item.value === state)?.label ?? state, clear: () => { setSelectedStates((current) => current.filter((item) => item !== state)); setOffset(0); } })),
    dataDa ? { key: "from", label: `Dal ${formatDate(dataDa)}`, clear: () => { setDataDa(""); setOffset(0); } } : null,
    dataA ? { key: "to", label: `Al ${formatDate(dataA)}`, clear: () => { setDataA(""); setOffset(0); } } : null,
    totaleMin ? { key: "min", label: `Da ${totaleMin} €`, clear: () => { setTotaleMin(""); setOffset(0); } } : null,
    totaleMax ? { key: "max", label: `Fino a ${totaleMax} €`, clear: () => { setTotaleMax(""); setOffset(0); } } : null,
    avvisi !== "tutti" ? { key: "warnings", label: avvisi === "solo" ? "Con avvisi" : "Senza avvisi", clear: () => { setAvvisi("tutti"); setOffset(0); } } : null,
    duplicati !== "tutti" ? { key: "duplicates", label: duplicati === "solo" ? "Possibili duplicati" : "Senza duplicati", clear: () => { setDuplicati("tutti"); setOffset(0); } } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const openReview = (item: ArchiveItem) => {
    sessionStorage.setItem(REVIEW_SESSION_KEY, item.id);
    setLocation("/finanza/nuovo-automatico");
  };

  return (
    <div className="min-h-full bg-[#07110d] pb-28 text-white">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/[0.04] text-white" onClick={() => setLocation("/finanza/nuovo-automatico")} aria-label="Torna all’inserimento automatico"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/70">Finanza · Fatture XML</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Archivio acquisizioni</h1><p className="mt-1 text-sm text-white/55">Trova e riapri le fatture già acquisite.</p></div>
          </div>
          <Button type="button" className="h-11 rounded-2xl bg-emerald-300 px-3 text-sm font-semibold text-[#062016] hover:bg-emerald-200" onClick={() => setLocation("/finanza/nuovo-automatico")}>Importa</Button>
        </header>

        <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" /><Input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Cerca fattura…" aria-label="Cerca per fornitore, P. IVA, numero o nome file" className="h-11 border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/35" /></div>
            <Sheet>
              <SheetTrigger asChild><Button type="button" variant="outline" className="relative h-11 shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"><SlidersHorizontal className="mr-2 h-4 w-4" />Filtri{activeFilters.length > 0 && <span className="ml-1 rounded-full bg-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-[#062016]">{activeFilters.length}</span>}</Button></SheetTrigger>
              <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-white/10 bg-[#0b1712] pb-[calc(1rem+env(safe-area-inset-bottom))] text-white">
                <SheetHeader className="text-left"><SheetTitle className="text-white">Filtri avanzati</SheetTitle><SheetDescription className="text-white/55">Combina stato, periodo, importo, avvisi e possibili duplicati.</SheetDescription></SheetHeader>
                <div className="space-y-5 py-5">
                  <div className="space-y-2"><Label className="text-white/75">Stato dell’acquisizione</Label><div className="flex flex-wrap gap-2">{states.map((state) => { const active = selectedStates.includes(state.value); return <button key={state.value} type="button" onClick={() => toggleState(state.value)} className={`rounded-xl border px-3 py-2 text-sm transition ${active ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/65"}`}>{state.label}</button>; })}</div></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-white/75">Data documento dal</Label><Input type="date" value={dataDa} onChange={(event) => { setDataDa(event.target.value); setOffset(0); }} className="border-white/10 bg-black/20 text-white" /></div><div className="space-y-1.5"><Label className="text-white/75">Data documento al</Label><Input type="date" value={dataA} onChange={(event) => { setDataA(event.target.value); setOffset(0); }} className="border-white/10 bg-black/20 text-white" /></div></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-white/75">Totale minimo (€)</Label><Input inputMode="decimal" value={totaleMin} onChange={(event) => { setTotaleMin(event.target.value); setOffset(0); }} placeholder="0,00" className="border-white/10 bg-black/20 text-white placeholder:text-white/30" /></div><div className="space-y-1.5"><Label className="text-white/75">Totale massimo (€)</Label><Input inputMode="decimal" value={totaleMax} onChange={(event) => { setTotaleMax(event.target.value); setOffset(0); }} placeholder="Nessun limite" className="border-white/10 bg-black/20 text-white placeholder:text-white/30" /></div></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-white/75">Avvisi</Label><Select value={avvisi} onValueChange={(value) => { setAvvisi(value as TriState); setOffset(0); }}><SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tutti">Tutte</SelectItem><SelectItem value="solo">Solo con avvisi</SelectItem><SelectItem value="nessuno">Senza avvisi</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-white/75">Duplicati</Label><Select value={duplicati} onValueChange={(value) => { setDuplicati(value as TriState); setOffset(0); }}><SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tutti">Tutte</SelectItem><SelectItem value="solo">Possibili duplicati</SelectItem><SelectItem value="nessuno">Senza duplicati</SelectItem></SelectContent></Select></div></div>
                </div>
                <SheetFooter className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]" onClick={clearFilters}>Azzera</Button><SheetClose asChild><Button type="button" className="bg-emerald-300 text-[#062016] hover:bg-emerald-200">Mostra risultati</Button></SheetClose></SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
          {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtri attivi">{activeFilters.map((filter) => <button key={filter.key} type="button" onClick={filter.clear} className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-100"><span className="truncate">{filter.label}</span><X className="h-3 w-3" /></button>)}<button type="button" onClick={clearFilters} className="px-1 text-xs text-white/55 underline underline-offset-2">Azzera tutti</button></div>}
        </section>

        <div className="mt-5 flex items-center justify-between gap-3"><p className="text-sm text-white/55">{archiveQuery.isLoading ? "Ricerca in corso…" : `${result?.total ?? 0} fatture trovate`}</p>{result && result.total > 0 && <p className="text-xs text-white/40">{offset + 1}–{Math.min(offset + result.items.length, result.total)} di {result.total}</p>}</div>

        <section className="mt-3 space-y-3" aria-label="Risultati archivio fatture">
          {archiveQuery.isLoading ? <div className="grid min-h-56 place-items-center rounded-[26px] border border-white/8 bg-white/[0.035]"><Loader2 className="h-8 w-8 animate-spin text-emerald-300" /></div> : archiveQuery.isError ? <div className="rounded-[26px] border border-red-300/20 bg-red-300/[0.07] p-5 text-sm text-red-100"><AlertTriangle className="mb-3 h-5 w-5" /><p className="font-semibold">Non riesco ad aprire l’archivio</p><p className="mt-1 text-red-100/70">{archiveQuery.error.message}</p></div> : !result?.items.length ? <div className="grid min-h-64 place-items-center rounded-[26px] border border-white/8 bg-white/[0.035] p-7 text-center"><div><FileSearch className="mx-auto h-10 w-10 text-emerald-300/70" /><h2 className="mt-4 text-lg font-semibold">Nessuna fattura trovata</h2><p className="mt-2 max-w-xs text-sm text-white/50">Prova a modificare la ricerca o ad azzerare i filtri selezionati.</p>{activeFilters.length > 0 && <Button type="button" variant="outline" className="mt-5 border-white/10 bg-white/[0.04] text-white" onClick={clearFilters}>Azzera filtri</Button>}</div></div> : result.items.map((item) => <InvoiceArchiveCard key={item.id} item={item} onOpen={() => openReview(item)} />)}
        </section>

        {result && result.total > PAGE_SIZE && <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginazione archivio"><Button type="button" variant="outline" className="h-11 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" disabled={offset === 0} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}><ChevronLeft className="mr-1 h-4 w-4" />Precedenti</Button><Button type="button" variant="outline" className="h-11 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" disabled={!result.hasMore} onClick={() => setOffset((current) => current + PAGE_SIZE)}>Successive<ChevronRight className="ml-1 h-4 w-4" /></Button></nav>}
      </div>
    </div>
  );
}

function InvoiceArchiveCard({ item, onOpen }: { item: ArchiveItem; onOpen: () => void }) {
  const status = item.stato as InvoiceState;
  return <article className="rounded-[24px] border border-white/8 bg-white/[0.035] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-white/40">{formatDate(item.dataDocumento)}</p><h2 className="mt-1 truncate text-base font-semibold">{item.numeroDocumento}</h2><p className="mt-1 truncate text-sm text-white/60">{item.fornitoreRagioneSociale}</p></div><Badge className={`shrink-0 ${stateStyle[status]}`}>{states.find((state) => state.value === status)?.label ?? status}</Badge></div><div className="mt-4 flex items-end justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs text-white/40">P.IVA {item.fornitorePartitaIva || "non indicata"}</p><div className="mt-2 flex flex-wrap gap-1.5">{item.duplicatoDocumentoId && <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Possibile duplicato</Badge>}{item.avvisi.length > 0 && <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">{item.avvisi.length} avvis{item.avvisi.length === 1 ? "o" : "i"}</Badge>}{item.errore && <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Errore</Badge>}</div></div><div className="shrink-0 text-right"><p className="text-base font-semibold text-white">{money(item.totale, item.valuta)}</p><Button type="button" size="sm" className="mt-2 h-9 rounded-xl bg-emerald-300 px-3 text-xs font-semibold text-[#062016] hover:bg-emerald-200" onClick={onOpen}>Apri</Button></div></div></article>;
}
