import { useOfficinaPermissions } from "./OfficinaLayout";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Package, Plus, Trash2, Search, Minus, AlertTriangle, ClipboardList, MapPin, Pencil, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { C, STATO_SCORTA, CATEGORIE_RICAMBIO, eur, CodicePill } from "./shared";

const EMPTY_R = {
  id: "", codice: "", nome: "", categoria: "Altro", compatibilita: "",
  reparto: "", famiglia: "", sottocategoria: "", immagineUrl: "",
  quantitaDisponibile: "", sogliaMinima: "", posizione: "", costoMedio: "", fornitore: "", note: "",
};

const FILTRI: [string, string][] = [
  ["tutti", "Tutti"],
  ["disponibili", "Disponibili"],
  ["sotto_scorta", "Sotto scorta"],
  ["non_disponibili", "Esauriti"],
  ["da_ordinare", "Da ordinare"],
  ["ordinati", "Ordinati"],
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: C.textDim }}>{label}</label>
    {children}
  </div>
);

export default function RicambiTab() {
  const { canEdit, canSeeCosts } = useOfficinaPermissions();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [repartoFiltro, setRepartoFiltro] = useState("tutti");
  const [famigliaFiltro, setFamigliaFiltro] = useState("tutte");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState(() => new URLSearchParams(window.location.search).get("stato") || "tutti");
  const [categoria, setCategoria] = useState("tutte");
  const [fornitore, setFornitore] = useState("tutti");
  const [openForm, setOpenForm] = useState(false);
  const [openOrdine, setOpenOrdine] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_R });

  const utils = trpc.useUtils();
  const { data: ricambi = [], isLoading, isError, refetch } = trpc.officina.ricambi.list.useQuery();
  const { data: ordine = [] } = trpc.officina.preparaOrdine.useQuery();

  const invalidate = () => {
    utils.officina.ricambi.list.invalidate();
    utils.officina.preparaOrdine.invalidate();
    utils.officina.dashboard.invalidate();
    utils.officina.operatore.catalogo.invalidate();
    utils.magazzino.invalidate();
  };

  const createR = trpc.officina.ricambi.create.useMutation({
    onSuccess: () => { invalidate(); setOpenForm(false); setForm({ ...EMPTY_R }); toast.success("Ricambio salvato"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const updateR = trpc.officina.ricambi.update.useMutation({
    onSuccess: () => { invalidate(); setOpenForm(false); setForm({ ...EMPTY_R }); setEditing(false); toast.success("Ricambio aggiornato"); },
    onError: () => toast.error("Errore durante l'aggiornamento"),
  });
  const adjustR = trpc.officina.ricambi.adjust.useMutation({
    onMutate: async ({ id, delta }) => {
      await utils.officina.ricambi.list.cancel();
      const prev = utils.officina.ricambi.list.getData();
      utils.officina.ricambi.list.setData(undefined, (old: any) =>
        (old ?? []).map((r: any) => r.id === id ? { ...r, quantitaDisponibile: String(Math.max(0, Number(r.quantitaDisponibile) + delta)) } : r));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.officina.ricambi.list.setData(undefined, ctx.prev); toast.error("Errore aggiornamento scorta"); },
    onSettled: () => invalidate(),
  });
  const deleteR = trpc.officina.ricambi.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("Ricambio eliminato"); },
  });
  const setOrdine = trpc.officina.ricambi.setStatoOrdine.useMutation({
    onSuccess: () => { invalidate(); toast.success("Stato ordine aggiornato"); },
    onError: () => toast.error("Errore"),
  });

  const fornitori = Array.from(new Set((ricambi as any[]).map((r) => r.fornitore).filter(Boolean))).sort();

  const list = (ricambi as any[]).filter((r) => {
    const q = search.toLowerCase().trim();
    const okSearch = !q || [r.nome, r.codice, r.fornitore, r.compatibilita].filter(Boolean).join(" ").toLowerCase().includes(q);
    const okCat = categoria === "tutte" || r.categoria === categoria;
    const okForn = fornitore === "tutti" || r.fornitore === fornitore;
    let okFiltro = true;
    if (filtro === "disponibili") okFiltro = Number(r.quantitaDisponibile) > 0;
    else if (filtro === "sotto_scorta") okFiltro = Number(r.quantitaDisponibile) <= 0 || (Number(r.sogliaMinima) > 0 && Number(r.quantitaDisponibile) <= Number(r.sogliaMinima));
    else if (filtro === "non_disponibili") okFiltro = r.statoScorta === "non_disponibile";
    else if (filtro === "da_ordinare") okFiltro = r.statoScorta !== "disponibile" && r.statoOrdine !== "ordinato";
    else if (filtro === "ordinati") okFiltro = r.statoOrdine === "ordinato";
    return okSearch && okCat && okForn && okFiltro && (repartoFiltro === "tutti" || r.reparto === repartoFiltro) && (famigliaFiltro === "tutte" || r.famiglia === famigliaFiltro);
  });

  const reparti = Array.from(new Set((ricambi as any[]).map((r) => r.reparto).filter(Boolean))).sort();
  const famiglie = Array.from(new Set((ricambi as any[]).filter((r) => repartoFiltro === "tutti" || r.reparto === repartoFiltro).map((r) => r.famiglia).filter(Boolean))).sort();
  const categorie = Array.from(new Set([...CATEGORIE_RICAMBIO, ...(ricambi as any[]).map((r) => r.categoria).filter(Boolean)])).sort();
  const sottoScorta = (ricambi as any[]).filter((r) => r.statoScorta !== "disponibile").length;
  const totOrdine = (ordine as any[]).reduce((s, o) => s + Number(o.costoStimato ?? 0), 0);

  function openNew() { setForm({ ...EMPTY_R }); setEditing(false); setOpenForm(true); }
  function openEdit(r: any) {
    setForm({
      id: r.id, codice: r.codice ?? "", nome: r.nome ?? "", categoria: r.categoria ?? "Altro",
      reparto: r.reparto ?? "", famiglia: r.famiglia ?? "", sottocategoria: r.sottocategoria ?? "", immagineUrl: r.immagineUrl ?? "",
      compatibilita: r.compatibilita ?? "", quantitaDisponibile: String(r.quantitaDisponibile ?? ""),
      sogliaMinima: String(r.sogliaMinima ?? ""), posizione: r.posizione ?? "",
      costoMedio: r.costoMedio != null ? String(r.costoMedio) : "", fornitore: r.fornitore ?? "", note: r.note ?? "",
    });
    setEditing(true); setOpenForm(true);
  }
  function submit() {
    if (!form.nome.trim()) { toast.error("Nome obbligatorio"); return; }
    const payload = {
      codice: form.codice || undefined,
      nome: form.nome.trim(),
      categoria: form.categoria as any,
      reparto: form.reparto || undefined,
      famiglia: form.famiglia || undefined,
      sottocategoria: form.sottocategoria || undefined,
      immagineUrl: form.immagineUrl || undefined,
      compatibilita: form.compatibilita || undefined,
      quantitaDisponibile: form.quantitaDisponibile ? Number(form.quantitaDisponibile) : 0,
      sogliaMinima: form.sogliaMinima ? Number(form.sogliaMinima) : 0,
      posizione: form.posizione || undefined,
      costoMedio: form.costoMedio ? Number(form.costoMedio) : undefined,
      fornitore: form.fornitore || undefined,
      note: form.note || undefined,
    };
    if (editing) updateR.mutate({ id: form.id, ...payload });
    else createR.mutate(payload);
  }

  return (
    <div className="space-y-4">
      {/* Alert sotto scorta */}
      {sottoScorta > 0 && (
        <button onClick={() => setOpenOrdine(true)}
          className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-transform active:scale-[0.99]"
          style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}30` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.gold}22` }}>
            <AlertTriangle size={16} style={{ color: C.gold }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: C.text }}>{sottoScorta} ricambi da riordinare</p>
            <p className="text-xs" style={{ color: C.textDim }}>Tocca per preparare la lista d'ordine</p>
          </div>
          <ClipboardList size={16} style={{ color: C.gold }} />
        </button>
      )}

      <div className="space-y-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textDim }} /><Input aria-label="Cerca ricambi" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome articolo, codice o fornitore…" className="h-11 w-full bg-input border-border pl-9 text-sm" /></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} className="min-h-11 flex-1 gap-2"><SlidersHorizontal size={16} /> Filtri</Button>{canEdit && <Button onClick={openNew} className="min-h-11 flex-1 gap-1 px-2" style={{ background: C.green, color: C.bgDeep }}><Plus size={15} /> Nuovo ricambio</Button>}</div>
      </div>
      {filtersOpen && <div className="grid grid-cols-2 gap-3 rounded-xl border p-3" style={{ borderColor: C.border, background: C.panel }}>
        <Field label="Disponibilità"><PartFilter value={filtro} onChange={setFiltro} options={FILTRI} /></Field>
        <Field label="Reparto"><PartFilter value={repartoFiltro} onChange={(v) => { setRepartoFiltro(v); setFamigliaFiltro("tutte"); }} options={[["tutti", "Tutti"], ...reparti.map((v) => [v,v] as [string,string])]} /></Field>
        <Field label="Famiglia"><PartFilter value={famigliaFiltro} onChange={setFamigliaFiltro} options={[["tutte", "Tutte"], ...famiglie.map((v) => [v,v] as [string,string])]} /></Field>
        <Field label="Categoria"><PartFilter value={categoria} onChange={setCategoria} options={[["tutte", "Tutte"], ...categorie.map((v) => [v,v] as [string,string])]} /></Field>
        {fornitori.length > 0 && <Field label="Fornitore"><PartFilter value={fornitore} onChange={setFornitore} options={[["tutti", "Tutti"], ...fornitori.map((v) => [v,v] as [string,string])]} /></Field>}
        <button onClick={() => { setFiltro("tutti"); setCategoria("tutte"); setFornitore("tutti"); setRepartoFiltro("tutti"); setFamigliaFiltro("tutte"); }} className="col-span-2 min-h-10 text-xs" style={{ color: C.green }}>Azzera filtri</button>
      </div>}
      <div className="grid grid-cols-2 gap-2" aria-label="Disponibilità ricambi">{FILTRI.slice(0,4).map(([v,l]) => <button key={v} onClick={() => setFiltro(v)} aria-pressed={filtro === v} className="min-h-11 rounded-lg border px-2 text-xs" style={{ background: C.inner, color: filtro === v ? C.green : C.textDim, borderColor: filtro === v ? C.green : C.border }}>{l}</button>)}</div>
      {isError ? <button onClick={() => refetch()} className="w-full p-5 text-sm" style={{ color: C.gold }}>Impossibile caricare i ricambi · Riprova</button> : isLoading ? <p className="py-8 text-center text-sm" style={{ color: C.textDim }}>Caricamento…</p> : list.length === 0 ? <div className="rounded-xl border p-6 text-center" style={{ borderColor: C.border, background: C.panel }}><Package size={25} className="mx-auto mb-2" style={{ color: C.gold }} /><p className="text-sm" style={{ color: C.textDim }}>Nessun ricambio in questa selezione</p>{canEdit && <button onClick={openNew} className="mt-2 min-h-11 text-xs" style={{ color: C.green }}>Crea un ricambio nel Magazzino</button>}</div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list.map((part) => { const sc = STATO_SCORTA[part.statoScorta] ?? STATO_SCORTA.disponibile; return <article key={part.id} className="rounded-xl border p-3" style={{ borderColor: C.border, background: C.panel }}>
        <div className="flex gap-3">{part.immagineUrl ? <img src={part.immagineUrl} alt={part.nome} loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" /> : <div className="flex size-12 shrink-0 items-center justify-center rounded-lg" style={{ background: C.inner, color: C.gold }}><Package size={22} /></div>}<div className="min-w-0 flex-1"><h2 className="text-sm font-semibold leading-tight" style={{ color: C.text }}>{part.nome}</h2><p className="mt-1 break-words text-[11px]" style={{ color: C.textDim }}>{part.codice || "Senza codice"} · {part.categoria}</p><p className="mt-1 text-[11px]" style={{ color: sc.color }}>{sc.label}{part.statoOrdine === "ordinato" ? " · Ordinato" : ""}</p>{canSeeCosts && part.costoMedio != null && <p className="mt-1 text-xs" style={{ color: C.gold }}>{eur(part.costoMedio)} / unità</p>}</div><div className="text-right"><strong className="text-lg tabular-nums" style={{ color: sc.color }}>{Number(part.quantitaDisponibile)}</strong><p className="text-[10px]" style={{ color: C.textDim }}>Giacenza</p></div></div>
        {(part.posizione || part.compatibilita || part.fornitore) && <p className="mt-2 text-[11px]" style={{ color: C.textDim }}>{[part.posizione, part.compatibilita, part.fornitore].filter(Boolean).join(" · ")}</p>}
        {canEdit && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2" style={{ borderColor: C.border }}><div className="flex gap-1"><button onClick={() => openEdit(part)} aria-label={`Modifica ${part.nome}`} className="flex size-11 items-center justify-center rounded-lg" style={{ color: C.gold }}><Pencil size={16} /></button><button onClick={() => { if (window.confirm(`Eliminare ${part.nome} dall’anagrafica condivisa? I movimenti storici rimangono conservati.`)) deleteR.mutate({ id: part.id }); }} aria-label={`Elimina ${part.nome}`} className="flex size-11 items-center justify-center rounded-lg" style={{ color: C.red }}><Trash2 size={16} /></button>{part.statoScorta !== "disponibile" && <button onClick={() => { if (window.confirm("Aggiornare lo stato ordine di questo ricambio?")) setOrdine.mutate({ id: part.id, statoOrdine: part.statoOrdine === "ordinato" ? "nessuno" : "ordinato" }); }} aria-label="Aggiorna stato ordine" className="flex size-11 items-center justify-center rounded-lg" style={{ color: C.blue }}><ClipboardList size={16} /></button>}</div><div className="flex items-center gap-2"><button disabled={adjustR.isPending || Number(part.quantitaDisponibile) < 1} onClick={() => { if (window.confirm(`Ridurre di 1 la giacenza di ${part.nome}?`)) adjustR.mutate({ id: part.id, delta: -1 }); }} aria-label={`Riduci giacenza ${part.nome}`} className="flex size-11 items-center justify-center rounded-lg border disabled:opacity-40" style={{ borderColor: C.border, color: C.text }}><Minus size={15} /></button><button disabled={adjustR.isPending} onClick={() => { if (window.confirm(`Aumentare di 1 la giacenza di ${part.nome} come rettifica? Non viene registrato un nuovo acquisto.`)) adjustR.mutate({ id: part.id, delta: 1 }); }} aria-label={`Aumenta giacenza ${part.nome}`} className="flex size-11 items-center justify-center rounded-lg border" style={{ borderColor: C.green, color: C.green }}><Plus size={15} /></button></div></div>}
      </article>; })}</div>}

      {/* Sheet prepara ordine */}
      <Sheet open={openOrdine} onOpenChange={setOpenOrdine}>
        <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[420px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          <SheetHeader className="px-6 py-5 border-b text-left" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}18` }}>
                <ClipboardList size={15} style={{ color: C.gold }} />
              </div>
              <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>Lista ordine ricambi</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
            {(ordine as any[]).length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: C.textFaint }}>Nessun ricambio da ordinare</p>
            ) : (ordine as any[]).map((o) => (
              <div key={o.id} className="p-3 rounded-lg" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: C.text }}>{o.nome}</p>
                  <Badge style={{ background: `${C.gold}18`, color: C.gold, border: "none", fontSize: 10 }}>+{o.quantitaConsigliata}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs" style={{ color: C.textFaint }}>
                  <span>{[o.codice, o.fornitore].filter(Boolean).join(" · ") || o.categoria}</span>
                  <span>disp. {o.quantitaDisponibile}/{o.sogliaMinima}</span>
                </div>
                {canSeeCosts && o.costoStimato > 0 && <p className="text-xs mt-1" style={{ color: C.gold }}>Stima: {eur(o.costoStimato)}</p>}
              </div>
            ))}
          </div>
          {(ordine as any[]).length > 0 && (
            <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
              {canSeeCosts && <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider" style={{ color: C.textFaint }}>Totale stimato</span>
                <span className="text-lg font-bold" style={{ color: C.gold, fontFamily: "var(--font-display)" }}>{eur(totOrdine)}</span>
              </div>}
              <Button onClick={() => { navigator.clipboard?.writeText((ordine as any[]).map((o) => `${o.quantitaConsigliata}x ${o.nome}${o.codice ? ` (${o.codice})` : ""}`).join("\n")); toast.success("Lista copiata negli appunti"); }}
                className="w-full" style={{ background: C.gold, color: C.bgDeep }}>Copia lista ordine</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet form ricambio */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[420px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          <SheetHeader className="px-6 py-5 border-b text-left" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.green}18` }}>
                <Package size={15} style={{ color: C.green }} />
              </div>
              <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>{editing ? "Modifica ricambio" : "Nuovo ricambio"}</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="Nome *"><Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codice"><Input value={form.codice} onChange={(e) => setForm((f) => ({ ...f, codice: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Categoria">
                <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: "oklch(0.14 0.007 145)", color: C.text, border: "1px solid oklch(0.22 0.01 145)" }}>
                  {categorie.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="rounded-xl p-3 space-y-3" style={{ background: C.inner, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-semibold" style={{ color: C.blue }}>Classificazione Menù operatore</p>
              <Field label="Reparto"><Input value={form.reparto} onChange={(e) => setForm((f) => ({ ...f, reparto: e.target.value }))} placeholder="Es. Idraulica" className="bg-input border-border text-sm" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Famiglia"><Input value={form.famiglia} onChange={(e) => setForm((f) => ({ ...f, famiglia: e.target.value }))} placeholder="Es. Tubi" className="bg-input border-border text-sm" /></Field>
                <Field label="Sottocategoria"><Input value={form.sottocategoria} onChange={(e) => setForm((f) => ({ ...f, sottocategoria: e.target.value }))} placeholder="Facoltativa" className="bg-input border-border text-sm" /></Field>
              </div>
              <Field label="URL immagine (facoltativo)"><Input value={form.immagineUrl} onChange={(e) => setForm((f) => ({ ...f, immagineUrl: e.target.value }))} placeholder="https://…" className="bg-input border-border text-sm" /></Field>
            </div>
            <Field label="Compatibilità (mezzi)"><Input value={form.compatibilita} onChange={(e) => setForm((f) => ({ ...f, compatibilita: e.target.value }))} placeholder="Es. Trattori serie X, mietitrebbie…" className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantità disponibile"><Input type="number" value={form.quantitaDisponibile} onChange={(e) => setForm((f) => ({ ...f, quantitaDisponibile: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Soglia minima"><Input type="number" value={form.sogliaMinima} onChange={(e) => setForm((f) => ({ ...f, sogliaMinima: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posizione"><Input value={form.posizione} onChange={(e) => setForm((f) => ({ ...f, posizione: e.target.value }))} placeholder="Scaffale A3…" className="bg-input border-border text-sm" /></Field>
              {canSeeCosts && <Field label="Costo medio (€)"><Input type="number" step="0.01" value={form.costoMedio} onChange={(e) => setForm((f) => ({ ...f, costoMedio: e.target.value }))} className="bg-input border-border text-sm" /></Field>}
            </div>
            <Field label="Fornitore"><Input value={form.fornitore} onChange={(e) => setForm((f) => ({ ...f, fornitore: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" /></Field>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
            <Button onClick={submit} disabled={!canEdit || createR.isPending || updateR.isPending} className="w-full" style={{ background: C.green, color: C.bgDeep }}>
              {createR.isPending || updateR.isPending ? "Salvataggio…" : editing ? "Aggiorna ricambio" : "Salva ricambio"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PartFilter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string,string][] }) {
  return <select aria-label={options[0]?.[1]} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg px-2 text-xs" style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}>{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
