import { useOfficinaPermissions } from "./OfficinaLayout";
import { matchesWork } from "./filters";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Wrench, Plus, Trash2, CheckCircle2, X, User, Clock, Euro, Package, AlertTriangle, Play, Search, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  C, STATO_INTERVENTO, PRIORITA, TIPO_INTERVENTO_LABEL, STATO_SCORTA, eur, dataIT, CodicePill,
} from "./shared";

const TIPI = ["manutenzione", "riparazione", "revisione", "tagliando", "straordinario"] as const;
const PRIORITA_KEYS = ["urgente", "alta", "media", "bassa"] as const;
const TABS: [string, string][] = [
  ["pianificato", "Pianificati"],
  ["in_corso", "In corso"],
  ["straordinario", "Straordinari"],
  ["completato", "Completati"],
];

const EMPTY_I = {
  macchinaId: "", tipo: "manutenzione", descrizione: "",
  data: new Date().toISOString().split("T")[0], dataPianificata: "",
  priorita: "media", operatore: "", tempoStimato: "", costoOrario: "35",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: C.textDim }}>{label}</label>
    {children}
  </div>
);

type RigaRicambio = { ricambioId?: string; nomeRicambio?: string; quantitaRichiesta: number };

export default function InterventiTab() {
  const { canEdit, canSeeCosts } = useOfficinaPermissions();
  const params = new URLSearchParams(window.location.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [periodo, setPeriodo] = useState(params.get("periodo") || "tutti");
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [detailId, setDetailId] = useState<string | null>(params.get("dettaglio"));
  const { data: workDetail, isError: detailError } = trpc.officina.interventi.detail.useQuery({ id: detailId! }, { enabled: !!detailId });
  const [tab, setTab] = useState(params.get("stato") || "tutti");
  const [filtroMezzo, setFiltroMezzo] = useState("tutti");
  const [filtroPriorita, setFiltroPriorita] = useState("tutte");
  const [filtroOperatore, setFiltroOperatore] = useState("tutti");
  const [ricerca, setRicerca] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [openCompleta, setOpenCompleta] = useState(false);
  const [completaId, setCompletaId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_I });
  const [righe, setRighe] = useState<RigaRicambio[]>([]);

  // Stato workflow completamento
  const [oreLavoro, setOreLavoro] = useState("");
  const [costoOrarioFin, setCostoOrarioFin] = useState("35");
  const [noteFin, setNoteFin] = useState("");
  const [usati, setUsati] = useState<Record<string, number>>({});

  const utils = trpc.useUtils();
  const { data: mezzi = [] } = trpc.officina.macchine.list.useQuery();
  const { data: ricambi = [] } = trpc.officina.ricambi.list.useQuery();
  const { data: interventi = [], isLoading, isError, refetch } = trpc.officina.interventi.list.useQuery();
  const { data: completaDetail } = trpc.officina.interventi.detail.useQuery(
    { id: completaId! }, { enabled: !!completaId });

  const invalidate = () => {
    utils.officina.interventi.list.invalidate();
    utils.officina.dashboard.invalidate();
    utils.officina.macchine.list.invalidate();
    utils.officina.ricambi.list.invalidate();
    utils.officina.operatore.catalogo.invalidate();
    utils.officina.interventi.detail.invalidate();
    utils.magazzino.invalidate();
  };

  const createI = trpc.officina.interventi.create.useMutation({
    onSuccess: () => { invalidate(); setOpenForm(false); setForm({ ...EMPTY_I }); setRighe([]); toast.success("Intervento creato"); },
    onError: () => toast.error("Errore durante la creazione"),
  });
  const updateStato = trpc.officina.interventi.updateStato.useMutation({
    onSuccess: () => { invalidate(); toast.success("Stato aggiornato"); },
    onError: () => toast.error("Errore"),
  });
  const completaI = trpc.officina.interventi.completa.useMutation({
    onSuccess: (res) => { invalidate(); setOpenCompleta(false); setCompletaId(null); toast.success(canSeeCosts ? `Intervento completato · ${eur(res.costoFinale)}` : "Intervento completato"); },
    onError: () => toast.error("Errore durante il completamento"),
  });
  const deleteI = trpc.officina.interventi.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("Intervento eliminato"); },
  });

  const mezziMap = useMemo(() => {
    const map: Record<string, any> = {};
    (mezzi as any[]).forEach((m) => { map[m.id] = m; });
    return map;
  }, [mezzi]);

  const operatori = useMemo(() => {
    const set = new Set<string>();
    (interventi as any[]).forEach((i) => { if (i.operatore) set.add(i.operatore); });
    return Array.from(set).sort();
  }, [interventi]);

  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const list = (interventi as any[]).filter((i) => matchesWork({ ...i, nomeMezzo: mezziMap[i.macchinaId]?.nome }, { ricerca, mezzo: filtroMezzo, stato: tab, priorita: filtroPriorita, tipo: filtroTipo, periodo, da, a, operatore: filtroOperatore }));
  const filterCount = [filtroMezzo !== "tutti", filtroPriorita !== "tutte", filtroTipo !== "tutti", periodo !== "tutti", filtroOperatore !== "tutti"].filter(Boolean).length;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (interventi as any[]).forEach((i) => { c[i.stato] = (c[i.stato] ?? 0) + 1; });
    return c;
  }, [interventi]);

  function isInRitardo(i: any) {
    const d = i.dataPianificata ?? i.data;
    return i.stato !== "completato" && d && new Date(d) < oggi;
  }

  function openCompletamento(i: any) {
    setCompletaId(i.id);
    setOreLavoro(i.tempoStimato ? String(i.tempoStimato) : "");
    setCostoOrarioFin(i.costoOrario ? String(i.costoOrario) : "35");
    setNoteFin(i.note ?? "");
    setUsati({});
    setOpenCompleta(true);
  }

  // Costo finale anteprima
  const costoRicambiPreview = useMemo(() => {
    if (!completaDetail) return 0;
    let tot = 0;
    for (const r of (completaDetail.ricambiNecessari ?? [])) {
      const q = Number(r.quantitaUtilizzata) > 0 ? Number(r.quantitaUtilizzata) : usati[r.id] ?? 0;
      const cu = Number(r.costoUnitario ?? 0) || (r.ricambioId ? Number((ricambi as any[]).find((rc) => rc.id === r.ricambioId)?.costoMedio ?? 0) : 0);
      tot += q * cu;
    }
    return tot;
  }, [completaDetail, usati, ricambi]);
  const costoManodoperaPreview = (Number(oreLavoro) || 0) * (Number(costoOrarioFin) || 0);
  const costoFinalePreview = costoManodoperaPreview + costoRicambiPreview;

  function addRiga() { setRighe((r) => [...r, { quantitaRichiesta: 1 }]); }
  function submitCreate() {
    if (!form.macchinaId) { toast.error("Seleziona un mezzo"); return; }
    if (!form.descrizione.trim()) { toast.error("Descrizione obbligatoria"); return; }
    const statoIniziale = form.tipo === "straordinario" ? "straordinario" : "pianificato";
    createI.mutate({
      macchinaId: form.macchinaId,
      tipo: form.tipo as any,
      descrizione: form.descrizione.trim(),
      data: form.data,
      dataPianificata: form.dataPianificata || undefined,
      priorita: form.priorita as any,
      stato: statoIniziale as any,
      operatore: form.operatore || undefined,
      tempoStimato: form.tempoStimato ? Number(form.tempoStimato) : undefined,
      costoOrario: form.costoOrario ? Number(form.costoOrario) : undefined,
      ricambi: righe.filter((r) => r.ricambioId || r.nomeRicambio).map((r) => {
        const rc = (ricambi as any[]).find((x) => x.id === r.ricambioId);
        return { ricambioId: r.ricambioId, nomeRicambio: r.nomeRicambio || rc?.nome, codiceRicambio: rc?.codice, quantitaRichiesta: r.quantitaRichiesta, obbligatorio: true };
      }),
    });
  }
  function submitCompleta() {
    if (!completaDetail) return;
    completaI.mutate({
      id: completaDetail.id,
      oreLavoro: Number(oreLavoro) || 0,
      costoOrario: Number(costoOrarioFin) || undefined,
      note: noteFin || undefined,
      ricambiUtilizzati: (completaDetail.ricambiNecessari ?? [])
        .filter((r: any) => Number(r.quantitaUtilizzata) === 0 && (usati[r.id] ?? 0) > 0)
        .map((r: any) => ({
          rigaId: r.id,
          prodottoId: r.prodottoId ?? undefined,
          ricambioId: r.ricambioId ?? undefined,
          codiceRicambio: r.codiceRicambio ?? undefined,
          nomeRicambio: r.nomeRicambio ?? undefined,
          quantitaUtilizzata: usati[r.id],
          costoUnitario: r.costoUnitario != null ? Number(r.costoUnitario) : undefined,
        })),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textDim }} /><Input aria-label="Cerca interventi" value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Codice, descrizione o mezzo…" className="h-11 w-full bg-input border-border pl-9 text-sm" /></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} className="min-h-11 flex-1 gap-2"><SlidersHorizontal size={16} /> Filtri{filterCount ? ` · ${filterCount}` : ""}</Button>{canEdit && <Button onClick={() => { setForm({ ...EMPTY_I }); setRighe([]); setOpenForm(true); }} className="min-h-11 flex-1 gap-1 px-2" style={{ background: C.green, color: C.bgDeep }}><Plus size={15} /> Nuovo intervento</Button>}</div>
      </div>
      {filtersOpen && <div className="grid grid-cols-2 gap-3 rounded-xl border p-3" style={{ borderColor: C.border, background: C.panel }}>
        <Field label="Mezzo"><FilterSelect value={filtroMezzo} onChange={setFiltroMezzo} options={[["tutti", "Tutti i mezzi"], ...(mezzi as any[]).map((m) => [m.id, m.nome] as [string,string])]} /></Field>
        <Field label="Stato"><FilterSelect value={tab} onChange={setTab} options={[["tutti", "Tutti"], ["aperti", "Aperti"], ...TABS]} /></Field>
        <Field label="Priorità"><FilterSelect value={filtroPriorita} onChange={setFiltroPriorita} options={[["tutte", "Tutte"], ...PRIORITA_KEYS.map((v) => [v, PRIORITA[v].label] as [string,string])]} /></Field>
        <Field label="Tipologia"><FilterSelect value={filtroTipo} onChange={setFiltroTipo} options={[["tutti", "Tutte"], ...TIPI.map((v) => [v, TIPO_INTERVENTO_LABEL[v]] as [string,string])]} /></Field>
        <Field label="Periodo"><FilterSelect value={periodo} onChange={setPeriodo} options={[["tutti", "Tutti"], ["oggi", "Oggi"], ["mese", "Questo mese"], ["ritardo", "In ritardo"], ["personalizzato", "Personalizzato"]]} /></Field>
        {operatori.length > 0 && <Field label="Operatore"><FilterSelect value={filtroOperatore} onChange={setFiltroOperatore} options={[["tutti", "Tutti"], ...operatori.map((v) => [v,v] as [string,string])]} /></Field>}
        {periodo === "personalizzato" && <><Field label="Da"><Input type="date" value={da} max={a || undefined} onChange={(e) => setDa(e.target.value)} className="h-11 w-full min-w-0 bg-input border-border" /></Field><Field label="A"><Input type="date" value={a} min={da || undefined} onChange={(e) => setA(e.target.value)} className="h-11 w-full min-w-0 bg-input border-border" /></Field></>}
        <button onClick={() => { setTab("tutti"); setFiltroMezzo("tutti"); setFiltroPriorita("tutte"); setFiltroTipo("tutti"); setPeriodo("tutti"); setFiltroOperatore("tutti"); setDa(""); setA(""); }} className="col-span-2 min-h-10 text-xs" style={{ color: C.green }}>Azzera filtri</button>
      </div>}
      <div className="grid grid-cols-2 gap-2" aria-label="Stati intervento">{TABS.map(([v,l]) => <button key={v} onClick={() => setTab(tab === v ? "tutti" : v)} aria-pressed={tab === v} className="min-h-11 rounded-lg border px-2 text-xs" style={{ color: tab === v ? C.green : C.textDim, background: C.inner, borderColor: tab === v ? C.green : C.border }}>{l} · {counts[v] ?? 0}</button>)}</div>
      {isError ? <button onClick={() => refetch()} className="w-full p-5 text-sm" style={{ color: C.gold }}>Impossibile caricare gli interventi · Riprova</button> : isLoading ? <p className="py-8 text-center text-sm" style={{ color: C.textDim }}>Caricamento…</p> : list.length === 0 ? <div className="rounded-xl border p-6 text-center" style={{ background: C.panel, borderColor: C.border }}><Wrench size={25} className="mx-auto mb-2" style={{ color: C.blue }} /><p className="text-sm" style={{ color: C.textDim }}>Nessun intervento in questa selezione</p>{canEdit && <button onClick={() => { setForm({ ...EMPTY_I }); setRighe([]); setOpenForm(true); }} className="mt-2 min-h-11 text-xs" style={{ color: C.green }}>Crea un nuovo intervento</button>}</div> : <div className="space-y-3">{list.map((i) => { const sc = STATO_INTERVENTO[i.stato] ?? STATO_INTERVENTO.pianificato; const pri = PRIORITA[i.priorita] ?? PRIORITA.media; return <button key={i.id} onClick={() => setDetailId(i.id)} className="w-full rounded-xl border p-3 text-left" style={{ background: C.panel, borderColor: isInRitardo(i) ? C.red : C.border }}><div className="flex items-start gap-3"><sc.icon size={20} className="mt-1 shrink-0" style={{ color: sc.color }} /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold leading-tight" style={{ color: C.text }}>{i.descrizione || TIPO_INTERVENTO_LABEL[i.tipo]}</h2><p className="mt-1 text-xs" style={{ color: C.textDim }}>{mezziMap[i.macchinaId]?.nome || "Mezzo"} · {TIPO_INTERVENTO_LABEL[i.tipo] || i.tipo}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px]"><span style={{ color: sc.color }}>{sc.label}</span><span style={{ color: pri.color }}>{pri.label}</span>{isInRitardo(i) && <span style={{ color: C.red }}>In ritardo</span>}<span style={{ color: C.textDim }}>{dataIT(i.stato === "completato" ? i.dataCompletamento || i.data : i.dataPianificata || i.data)}</span>{canSeeCosts && i.costoFinale != null && <span style={{ color: C.gold }}>{eur(i.stato === "completato" ? i.costoFinale : Number(i.costoRicambi || 0) + Number(i.costoManodopera || 0))}</span>}</div></div></div></button>; })}</div>}

      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}><SheetContent side="right" className="w-full sm:max-w-[440px] p-0 flex flex-col" style={{ background: C.panelDark }}><SheetHeader className="px-5 pt-5 pb-3 text-left"><SheetTitle style={{ color: C.text }}>Dettaglio intervento</SheetTitle></SheetHeader><div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">{workDetail ? <>
        <h2 className="text-lg font-semibold" style={{ color: C.text }}>{workDetail.descrizione}</h2><p className="text-sm" style={{ color: C.textDim }}>{mezziMap[workDetail.macchinaId]?.nome} · {workDetail.codice}</p>
        <div className="grid grid-cols-2 gap-3 text-xs">{[["Stato", STATO_INTERVENTO[workDetail.stato]?.label], ["Tipologia", TIPO_INTERVENTO_LABEL[workDetail.tipo]], ["Priorità", PRIORITA[workDetail.priorita]?.label], ["Data", dataIT(workDetail.dataPianificata || workDetail.data)], ["Operatore", workDetail.operatore || "—"], ["Ore lavoro", workDetail.oreLavoro || workDetail.tempoStimato || "—"]].map(([k,v]) => <div key={k} className="rounded-lg p-3" style={{ background: C.inner }}><span style={{ color: C.textDim }}>{k}</span><p className="mt-1 font-medium" style={{ color: C.text }}>{v}</p></div>)}</div>
        <h3 className="text-sm font-semibold" style={{ color: C.blue }}>Materiali e prelievi</h3>{workDetail.ricambiNecessari.length ? workDetail.ricambiNecessari.map((part: any) => <div key={part.id} className="rounded-xl border p-3 text-xs" style={{ borderColor: C.border, background: C.inner }}><strong style={{ color: C.text }}>{part.nomeRicambio || "Ricambio"}</strong><p className="mt-1" style={{ color: C.textDim }}>{part.codice || "Senza codice"} · {Number(part.quantitaUtilizzata) > 0 ? `Prelevati ${Number(part.quantitaUtilizzata)}` : `Richiesti ${Number(part.quantitaRichiesta)}`}</p>{canSeeCosts && <p className="mt-1" style={{ color: C.gold }}>{eur(Number(part.costoUnitario || 0) * Number(part.quantitaUtilizzata || 0))}</p>}</div>) : <p className="text-xs" style={{ color: C.textDim }}>Nessun materiale associato</p>}
        {canSeeCosts && <div className="rounded-xl p-3 text-sm" style={{ background: C.inner, color: C.gold }}>Materiali {eur(workDetail.costoRicambi)} · Manodopera {eur(workDetail.costoManodopera)}<p className="mt-1 font-semibold">Totale attribuito {eur(workDetail.stato === "completato" ? workDetail.costoFinale : Number(workDetail.costoRicambi || 0) + Number(workDetail.costoManodopera || 0))}</p></div>}
        {workDetail.note && <p className="text-sm" style={{ color: C.textDim }}>{workDetail.note}</p>}{workDetail.foto && <img src={workDetail.foto} alt="Foto dell’intervento" className="w-full rounded-xl" />}
      </> : <p className="py-6 text-sm" style={{ color: C.textDim }}>{detailError ? "Intervento non disponibile" : "Caricamento…"}</p>}</div>
      {canEdit && workDetail && <div className="shrink-0 space-y-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ borderColor: C.border }}>{workDetail.stato !== "completato" && <>{workDetail.stato === "pianificato" && <Button onClick={() => { if (window.confirm("Avviare questo intervento?")) updateStato.mutate({ id: workDetail.id, stato: "in_corso" }); }} disabled={updateStato.isPending} className="min-h-11 w-full" style={{ background: C.blue, color: C.bgDeep }}>Avvia intervento</Button>}<Button onClick={() => { openCompletamento(workDetail); setDetailId(null); }} className="min-h-11 w-full" style={{ background: C.green, color: C.bgDeep }}>Completa intervento</Button></>}<button onClick={() => { if (window.confirm("Eliminare questo intervento? Lo storico dei prelievi resterà conservato.")) { deleteI.mutate({ id: workDetail.id }); setDetailId(null); } }} className="min-h-11 w-full text-xs" style={{ color: C.red }}>Elimina intervento</button></div>}
      </SheetContent></Sheet>

      {/* Sheet nuovo intervento */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          <SheetHeader className="px-6 py-5 border-b text-left" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}18` }}>
                <Wrench size={15} style={{ color: C.gold }} />
              </div>
              <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>Nuovo intervento</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="Mezzo *">
              <select value={form.macchinaId} onChange={(e) => setForm((f) => ({ ...f, macchinaId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: "oklch(0.14 0.007 145)", color: C.text, border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="">Seleziona mezzo…</option>
                {(mezzi as any[]).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <div className="grid grid-cols-3 gap-2">
                {TIPI.map((t) => (
                  <button key={t} onClick={() => setForm((f) => ({ ...f, tipo: t }))} className="py-2 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: form.tipo === t ? `${C.green}18` : C.inner, color: form.tipo === t ? C.green : C.textDim, border: `1px solid ${form.tipo === t ? C.green + "40" : "transparent"}` }}>
                    {TIPO_INTERVENTO_LABEL[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Descrizione *"><Input value={form.descrizione} onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Data pianificata"><Input type="date" value={form.dataPianificata} onChange={(e) => setForm((f) => ({ ...f, dataPianificata: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <Field label="Priorità">
              <div className="grid grid-cols-4 gap-2">
                {PRIORITA_KEYS.map((p) => (
                  <button key={p} onClick={() => setForm((f) => ({ ...f, priorita: p }))} className="py-2 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: form.priorita === p ? `${PRIORITA[p].color}18` : C.inner, color: form.priorita === p ? PRIORITA[p].color : C.textDim, border: `1px solid ${form.priorita === p ? PRIORITA[p].color + "40" : "transparent"}` }}>
                    {PRIORITA[p].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Operatore"><Input value={form.operatore} onChange={(e) => setForm((f) => ({ ...f, operatore: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tempo stimato (h)"><Input type="number" step="0.5" value={form.tempoStimato} onChange={(e) => setForm((f) => ({ ...f, tempoStimato: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              {canSeeCosts && <Field label="Costo orario (€)"><Input type="number" value={form.costoOrario} onChange={(e) => setForm((f) => ({ ...f, costoOrario: e.target.value }))} className="bg-input border-border text-sm" /></Field>}
            </div>

            {/* Ricambi necessari */}
            <div className="pt-2 border-t" style={{ borderColor: C.borderSoft }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: C.blue }}><Package size={12} /> Ricambi necessari</span>
                <button onClick={addRiga} className="text-xs flex items-center gap-1" style={{ color: C.green }}><Plus size={12} /> Aggiungi</button>
              </div>
              {righe.length === 0 ? (
                <p className="text-xs" style={{ color: C.textFaint }}>Nessun ricambio. Verranno sempre mostrati al completamento.</p>
              ) : (
                <div className="space-y-2">
                  {righe.map((r, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={r.ricambioId ?? ""} onChange={(e) => setRighe((rs) => rs.map((x, i) => i === idx ? { ...x, ricambioId: e.target.value || undefined } : x))}
                        className="flex-1 px-2 py-2 rounded-lg text-xs" style={{ background: "oklch(0.14 0.007 145)", color: C.text, border: "1px solid oklch(0.22 0.01 145)" }}>
                        <option value="">Ricambio dal magazzino…</option>
                        {(ricambi as any[]).map((rc) => <option key={rc.id} value={rc.id}>{rc.nome} (disp. {rc.quantitaDisponibile})</option>)}
                      </select>
                      <Input type="number" value={r.quantitaRichiesta} onChange={(e) => setRighe((rs) => rs.map((x, i) => i === idx ? { ...x, quantitaRichiesta: Number(e.target.value) } : x))} className="w-16 bg-input border-border text-sm" />
                      <button onClick={() => setRighe((rs) => rs.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg" style={{ color: C.red }}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
            <Button onClick={submitCreate} disabled={!canEdit || createI.isPending} className="w-full" style={{ background: C.green, color: C.bgDeep }}>
              {createI.isPending ? "Salvataggio…" : "Crea intervento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet completamento */}
      <Sheet open={openCompleta} onOpenChange={setOpenCompleta}>
        <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          <SheetHeader className="px-6 py-5 border-b text-left" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.green}18` }}>
                <CheckCircle2 size={15} style={{ color: C.green }} />
              </div>
              <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>Completa intervento</SheetTitle>
            </div>
          </SheetHeader>
          {completaDetail ? (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="p-3 rounded-lg" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: C.text }}>{TIPO_INTERVENTO_LABEL[completaDetail.tipo] ?? completaDetail.tipo}</p>
                    {completaDetail.codice && <CodicePill codice={completaDetail.codice} />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: C.textDim }}>{completaDetail.descrizione}</p>
                </div>

                {/* Alert ricambi obbligatori mancanti */}
                {(completaDetail.ricambiObbligatoriMancanti?.length ?? 0) > 0 && (
                  <div className="p-3 rounded-lg flex gap-2.5" style={{ background: `${C.red}10`, border: `1px solid ${C.red}30` }}>
                    <AlertTriangle size={16} style={{ color: C.red }} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: C.red }}>Ricambi obbligatori mancanti: intervento non pronto</p>
                      <p className="text-[11px] mt-1" style={{ color: C.textDim }}>
                        {completaDetail.ricambiObbligatoriMancanti.map((r: any) => r.nomeRicambio || r.codice || "ricambio").join(", ")}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: C.textFaint }}>Puoi completare comunque, ma verra' richiesta conferma.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ore lavoro"><Input type="number" step="0.5" value={oreLavoro} onChange={(e) => setOreLavoro(e.target.value)} className="bg-input border-border text-sm" /></Field>
                  {canSeeCosts && <Field label="Costo orario (€)"><Input type="number" value={costoOrarioFin} onChange={(e) => setCostoOrarioFin(e.target.value)} className="bg-input border-border text-sm" /></Field>}
                </div>

                {/* Ricambi utilizzati */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: C.blue }}><Package size={12} /> Ricambi utilizzati</span>
                  {(completaDetail.ricambiNecessari ?? []).length === 0 ? (
                    <p className="text-xs" style={{ color: C.textFaint }}>Nessun ricambio associato a questo intervento.</p>
                  ) : (
                    <div className="space-y-2">
                      {(completaDetail.ricambiNecessari ?? []).map((r: any) => {
                        const sc = STATO_SCORTA[r.statoDisponibilita] ?? STATO_SCORTA.disponibile;
                        return (
                          <div key={r.id} className="p-2.5 rounded-lg" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-medium truncate" style={{ color: C.text }}>{r.nomeRicambio || "Ricambio"}</p>
                                  {r.obbligatorio && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: `${C.red}18`, color: C.red }}>OBBL.</span>}
                                </div>
                                {r.codice && <CodicePill codice={r.codice} />}
                                <p className="text-[11px] mt-0.5" style={{ color: sc.color }}>{sc.label} · disp. {r.disponibile} · rich. {Number(r.quantitaRichiesta)}</p>
                              </div>
                              {Number(r.quantitaUtilizzata) > 0 ? <span className="text-xs" style={{ color: C.green }}>Già prelevato ×{Number(r.quantitaUtilizzata)}</span> : <Input type="number" value={usati[r.id] ?? ""} placeholder="0" onChange={(e) => setUsati((u) => ({ ...u, [r.id]: Number(e.target.value) }))} className="w-16 bg-input border-border text-sm shrink-0" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field label="Note finali"><Input value={noteFin} onChange={(e) => setNoteFin(e.target.value)} className="bg-input border-border text-sm" /></Field>

                {/* Riepilogo costo */}
                {canSeeCosts && <div className="p-4 rounded-xl space-y-1.5" style={{ background: `${C.green}0d`, border: `1px solid ${C.green}25` }}>
                  <div className="flex justify-between text-xs" style={{ color: C.textDim }}><span>Manodopera</span><span>{eur(costoManodoperaPreview)}</span></div>
                  <div className="flex justify-between text-xs" style={{ color: C.textDim }}><span>Ricambi</span><span>{eur(costoRicambiPreview)}</span></div>
                  <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: C.green + "25" }}>
                    <span className="text-sm font-semibold" style={{ color: C.text }}>Costo finale</span>
                    <span className="text-base font-bold" style={{ color: C.green, fontFamily: "var(--font-display)" }}>{eur(costoFinalePreview)}</span>
                  </div>
                  <p className="text-[10px] pt-1" style={{ color: C.textFaint }}>Costo attribuito al mezzo · prelievi già registrati non scaricati nuovamente</p>
                </div>}
              </div>
              <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
                <Button onClick={() => {
                  const mancanti = completaDetail.ricambiObbligatoriMancanti?.length ?? 0;
                  if (mancanti > 0 && !window.confirm(`Mancano ${mancanti} ricambi obbligatori. Completare comunque l'intervento?`)) return;
                  submitCompleta();
                }} disabled={!canEdit || completaI.isPending} className="w-full gap-2" style={{ background: C.green, color: C.bgDeep }}>
                  <CheckCircle2 size={15} /> {completaI.isPending ? "Completamento…" : "Conferma completamento"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.textFaint }}>Caricamento…</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string,string][] }) {
  return <select aria-label={options[0]?.[1]} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg px-2 text-xs" style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}>{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
