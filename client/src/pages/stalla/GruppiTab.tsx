import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Beef, Bot, ChevronRight, Filter, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BORDER, GREEN, SURFACE, SURFACE2, TIPOLOGIA_GRUPPO } from "./shared";
import GroupEditorSheet from "./GroupEditorSheet";
import type { GroupMode, GroupSummary } from "./group-types";

const GROUP_BACKGROUND: Record<string, string> = {
  lattazione: "/manus-storage/dati-stalla-dashboard_e7198686.jpg",
  asciutta: "/manus-storage/gruppi_81c45d0c.jpg",
  rimonta: "/manus-storage/gruppi_81c45d0c.jpg",
  infermeria: "/manus-storage/sanita_9ab86209.jpg",
  vitelli: "/manus-storage/vitelli_fb9a167e.jpg",
  manze: "/manus-storage/alimentazione_71b16042.jpg",
  pre_parto: "/manus-storage/riproduzione_e5015a4c.jpg",
  post_parto: "/manus-storage/riproduzione_e5015a4c.jpg",
  personalizzato: "/manus-storage/gruppi_81c45d0c.jpg",
};

function categoriaGruppo(tipologia: string) {
  if (tipologia === "lattazione") return "Produttivo";
  if (["asciutta", "pre_parto", "post_parto"].includes(tipologia)) return "Fisiologico";
  if (["vitelli", "manze", "rimonta"].includes(tipologia)) return "Giovani";
  if (tipologia === "infermeria") return "Sanitario";
  return "Personale";
}

export default function GruppiTab({ onBack, onOpenAllAnimals, onOpenDetail, onOpenDemo }: { onBack?: () => void; onOpenAllAnimals?: () => void; onOpenDetail?: (id: string) => void; onOpenDemo?: () => void }) {
  const [mode, setMode] = useState<GroupMode>(() => new URLSearchParams(window.location.search).get("mode") === "automatici" ? "automatico" : "manuale");
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [tipologia, setTipologia] = useState<string | null>(null);
  const [ricercaAnimale, setRicercaAnimale] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: allGroups = [], isLoading } = trpc.stalla.gruppi.list.useQuery(undefined);
  const { data: matches = [] } = trpc.stalla.ricerca.useQuery({ query: ricercaAnimale.trim() }, { enabled: ricercaAnimale.trim().length > 0 });
  const gruppi = useMemo(() => (allGroups as GroupSummary[]).filter((gruppo) => gruppo.tipoGestione === mode && (!tipologia || gruppo.tipologia === tipologia)), [allGroups, mode, tipologia]);
  const counts = useMemo(() => ({ manuale: (allGroups as GroupSummary[]).filter((gruppo) => gruppo.tipoGestione === "manuale").length, automatico: (allGroups as GroupSummary[]).filter((gruppo) => gruppo.tipoGestione === "automatico").length }), [allGroups]);
  const totaleAnimali = useMemo(() => gruppi.reduce((total, gruppo) => total + gruppo.nAnimali, 0), [gruppi]);
  const ricercaAttiva = ricercaAnimale.trim().length > 0;

  function setDashboardMode(next: GroupMode) {
    setMode(next);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", next === "automatico" ? "automatici" : "manuali");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  return <div className="space-y-4">
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onBack && <button type="button" onClick={onBack} className="mb-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold" style={{ color: GREEN }}><ArrowLeft size={17} /> Stalla</button>}
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "var(--font-display)" }}>Gruppi</h1>
          <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: "oklch(0.62 0.01 145)" }}><span>{gruppi.length} gruppi</span><span>·</span><span>{totaleAnimali}</span><Beef size={17} /></p>
        </div>
        <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setShowFilters((value) => !value)} aria-pressed={showFilters} className="flex min-h-[4.25rem] min-w-[4.25rem] flex-col items-center justify-center rounded-xl border px-2 text-xs font-medium" style={{ background: showFilters ? `${GREEN}12` : SURFACE, borderColor: showFilters ? `${GREEN}88` : BORDER, color: showFilters ? GREEN : "oklch(0.80 0.006 145)" }}><SlidersHorizontal size={21} /><span className="mt-1">Filtri</span></button><button type="button" onClick={() => setShowLegend((value) => !value)} aria-pressed={showLegend} className="flex min-h-[4.25rem] min-w-[4.25rem] flex-col items-center justify-center rounded-xl border px-2 text-xs font-medium" style={{ background: showLegend ? `${GREEN}12` : SURFACE, borderColor: showLegend ? `${GREEN}88` : BORDER, color: showLegend ? GREEN : "oklch(0.80 0.006 145)" }}><BarChart3 size={21} /><span className="mt-1">Legenda</span></button></div>
      </div>

      <div className="grid grid-cols-2 rounded-xl border p-1" style={{ background: SURFACE, borderColor: BORDER }} aria-label="Tipo gestione gruppi">
        <Segment selected={mode === "manuale"} onClick={() => setDashboardMode("manuale")} label="Manuali" count={counts.manuale} />
        <Segment selected={mode === "automatico"} onClick={() => setDashboardMode("automatico")} label="Automatici" count={counts.automatico} icon={<Bot size={15} />} />
      </div>

      {showFilters && <section className="rounded-xl border p-3" style={{ background: SURFACE, borderColor: BORDER }}><p className="mb-2 text-xs font-bold uppercase tracking-[.14em]" style={{ color: "oklch(0.52 0.01 145)" }}>Tipologia</p><div className="flex flex-wrap gap-2"><FilterChip active={!tipologia} onClick={() => setTipologia(null)} label="Tutte" />{Array.from(new Set((allGroups as GroupSummary[]).filter((gruppo) => gruppo.tipoGestione === mode).map((gruppo) => gruppo.tipologia))).map((id) => <FilterChip key={id} active={tipologia === id} onClick={() => setTipologia(tipologia === id ? null : id)} label={TIPOLOGIA_GRUPPO[id]?.label ?? id} />)}</div></section>}
      {showLegend && <section className="rounded-xl border p-3" style={{ background: SURFACE, borderColor: BORDER }}><p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: "oklch(0.52 0.01 145)" }}>Legenda</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ color: "oklch(0.65 0.01 145)" }}><span><b style={{ color: GREEN }}>Manuale</b> · spostamenti confermati</span><span><b style={{ color: GREEN }}>Automatico</b> · regola server</span><span><b>Operativo</b> · un gruppo alla volta</span><span><b>Personale</b> · appartenenze sovrapposte</span></div>{onOpenDemo && <button type="button" onClick={onOpenDemo} className="mt-3 min-h-10 rounded-lg border px-3 text-xs font-bold" style={{ borderColor: BORDER, color: "oklch(0.72 0.01 145)" }}>Apri demo Stalla isolata</button>}</section>}

      <div className="flex gap-3"><div className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2" style={{ color: "oklch(0.56 0.01 145)" }} /><input className="min-h-12 w-full rounded-xl border py-3 pl-12 pr-10 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/35" style={{ background: SURFACE, borderColor: BORDER, color: "oklch(0.90 0.006 145)" }} placeholder="Cerca animale…" aria-label="Cerca animale per matricola o numero aziendale" value={ricercaAnimale} onChange={(event) => setRicercaAnimale(event.target.value)} />{ricercaAnimale && <button type="button" onClick={() => setRicercaAnimale("")} className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center"><X size={17} style={{ color: "oklch(0.55 0.01 145)" }} /></button>}</div><Button onClick={() => setEditorOpen(true)} className="min-h-12 shrink-0 rounded-xl px-4 text-base font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><Plus className="mr-1.5 size-5" /> Nuovo</Button></div>
      {onOpenAllAnimals && <button type="button" onClick={onOpenAllAnimals} className="flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 text-left" style={{ background: SURFACE, borderColor: BORDER }}><span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${GREEN}18`, color: GREEN }}><Beef size={21} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold" style={{ color: "oklch(0.91 0.006 145)" }}>Tutti gli animali</span><span className="mt-0.5 block text-xs" style={{ color: "oklch(0.57 0.01 145)" }}>Visualizza e cerca nell’intera mandria</span></span><ChevronRight size={19} style={{ color: "oklch(0.66 0.01 145)" }} /></button>}
    </header>

    {ricercaAttiva ? <section className="overflow-hidden rounded-xl border" style={{ background: SURFACE, borderColor: BORDER }}><div className="border-b px-4 py-3" style={{ borderColor: BORDER }}><p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Animali trovati</p><p className="mt-0.5 text-xs" style={{ color: "oklch(0.53 0.01 145)" }}>Apri il gruppo operativo dell’animale selezionato.</p></div>{matches.length === 0 ? <p className="p-7 text-center text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun animale trovato.</p> : <div className="divide-y" style={{ borderColor: BORDER }}>{matches.map((animal: any) => <button key={animal.id} type="button" disabled={!animal.gruppoId} onClick={() => animal.gruppoId && onOpenDetail?.(animal.gruppoId)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left disabled:opacity-50"><span className="flex size-10 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${GREEN}18`, color: GREEN }}>{animal.matricola.slice(-2)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>{animal.nome || animal.matricola}</span><span className="block truncate text-xs" style={{ color: "oklch(0.53 0.01 145)" }}>{animal.matricola}{animal.numeroAziendale ? ` · N° ${animal.numeroAziendale}` : ""}</span></span><ChevronRight size={19} style={{ color: "oklch(0.62 0.01 145)" }} /></button>)}</div>}</section> : isLoading ? <p className="py-12 text-center text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Caricamento gruppi…</p> : gruppi.length === 0 ? <EmptyGroupState automatico={mode === "automatico"} onCreate={() => setEditorOpen(true)} /> : <div className="grid grid-cols-2 gap-3" aria-label="Elenco gruppi">{gruppi.map((group) => <GroupCard key={group.id} group={group} onClick={() => onOpenDetail?.(group.id)} />)}</div>}
    <GroupEditorSheet open={editorOpen} onOpenChange={setEditorOpen} onSaved={() => utils.stalla.gruppi.invalidate()} />
  </div>;
}

function Segment({ selected, onClick, label, count, icon }: { selected: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) { return <button type="button" onClick={onClick} className="min-h-11 rounded-lg px-3 text-sm font-bold" style={{ background: selected ? `${GREEN}18` : "transparent", color: selected ? GREEN : "oklch(0.62 0.01 145)" }}>{icon && <span className="mr-1 inline-block align-[-2px]">{icon}</span>}{label} <span className="ml-1 opacity-75">{count}</span></button>; }
function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: active ? GREEN : BORDER, background: active ? `${GREEN}18` : "transparent", color: active ? GREEN : "oklch(0.67 0.01 145)" }}>{label}</button>; }
function GroupCard({ group, onClick }: { group: GroupSummary; onClick: () => void }) { const type = TIPOLOGIA_GRUPPO[group.tipologia] ?? TIPOLOGIA_GRUPPO.personalizzato; const color = group.colore || type.color; return <button type="button" onClick={onClick} className="group relative min-h-44 overflow-hidden rounded-2xl border p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[.98]" style={{ backgroundImage: `linear-gradient(180deg, oklch(0.04 0.008 145 / .08) 0%, oklch(0.04 0.008 145 / .22) 38%, oklch(0.04 0.008 145 / .92) 100%), url(${GROUP_BACKGROUND[group.tipologia] ?? GROUP_BACKGROUND.personalizzato})`, backgroundPosition: "center", backgroundSize: "cover", borderColor: BORDER }}>
  {group.tipoGestione === "automatico" && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold" style={{ background: "oklch(0.14 0.03 145 / .9)", color: GREEN }}><Bot size={12} /> Automatico</span>}
  <div className="absolute inset-x-3 bottom-3"><h2 className="truncate text-lg font-bold tracking-tight" style={{ color: "oklch(0.97 0.004 145)", fontFamily: "var(--font-display)", textShadow: "0 2px 10px oklch(0.02 0.005 145 / .98)" }}>{group.nome}</h2><div className="mt-1.5 flex items-center gap-2"><span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${color}99`, background: `${color}28`, color }}>{categoriaGruppo(group.tipologia)}</span><span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "oklch(0.96 0.004 145)" }}><Beef size={15} /> {group.nAnimali}</span><ChevronRight className="ml-auto size-5" style={{ color: "oklch(0.88 0.01 145)" }} /></div></div>
</button>; }
function EmptyGroupState({ automatico, onCreate }: { automatico: boolean; onCreate: () => void }) { return <div className="rounded-xl border p-10 text-center" style={{ background: SURFACE, borderColor: BORDER }}><Users className="mx-auto size-10" style={{ color: "oklch(0.30 0.008 145)" }} /><p className="mt-3 text-sm font-semibold" style={{ color: "oklch(0.70 0.01 145)" }}>{automatico ? "Nessun gruppo automatico" : "Nessun gruppo manuale"}</p><p className="mt-1 text-xs" style={{ color: "oklch(0.47 0.01 145)" }}>{automatico ? "Crea una regola per Alta produzione o Post-parto." : "Crea il primo gruppo per organizzare la mandria."}</p><Button onClick={onCreate} size="sm" className="mt-4" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><Plus className="mr-1 size-4" /> Crea gruppo</Button></div>; }
