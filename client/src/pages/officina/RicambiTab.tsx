import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Package, Plus, Trash2, Search, Minus, AlertTriangle, ClipboardList, MapPin, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { C, STATO_SCORTA, CATEGORIE_RICAMBIO, eur } from "./shared";

const EMPTY_R = {
  id: "", codice: "", nome: "", categoria: "Altro", compatibilita: "",
  quantitaDisponibile: "", sogliaMinima: "", posizione: "", costoMedio: "", fornitore: "", note: "",
};

const FILTRI: [string, string][] = [
  ["tutti", "Tutti"],
  ["disponibili", "Disponibili"],
  ["sotto_scorta", "Sotto scorta"],
  ["non_disponibili", "Esauriti"],
  ["da_ordinare", "Da ordinare"],
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: C.textDim }}>{label}</label>
    {children}
  </div>
);

export default function RicambiTab() {
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("tutti");
  const [categoria, setCategoria] = useState("tutte");
  const [openForm, setOpenForm] = useState(false);
  const [openOrdine, setOpenOrdine] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_R });

  const utils = trpc.useUtils();
  const { data: ricambi = [], isLoading } = trpc.officina.ricambi.list.useQuery();
  const { data: ordine = [] } = trpc.officina.preparaOrdine.useQuery();

  const invalidate = () => {
    utils.officina.ricambi.list.invalidate();
    utils.officina.preparaOrdine.invalidate();
    utils.officina.dashboard.invalidate();
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

  const list = (ricambi as any[]).filter((r) => {
    const q = search.toLowerCase().trim();
    const okSearch = !q || [r.nome, r.codice, r.fornitore, r.compatibilita].filter(Boolean).join(" ").toLowerCase().includes(q);
    const okCat = categoria === "tutte" || r.categoria === categoria;
    let okFiltro = true;
    if (filtro === "disponibili") okFiltro = r.statoScorta === "disponibile";
    else if (filtro === "sotto_scorta") okFiltro = r.statoScorta === "sotto_scorta";
    else if (filtro === "non_disponibili") okFiltro = r.statoScorta === "non_disponibile";
    else if (filtro === "da_ordinare") okFiltro = r.statoScorta !== "disponibile";
    return okSearch && okCat && okFiltro;
  });

  const sottoScorta = (ricambi as any[]).filter((r) => r.statoScorta !== "disponibile").length;
  const totOrdine = (ordine as any[]).reduce((s, o) => s + Number(o.costoStimato ?? 0), 0);

  function openNew() { setForm({ ...EMPTY_R }); setEditing(false); setOpenForm(true); }
  function openEdit(r: any) {
    setForm({
      id: r.id, codice: r.codice ?? "", nome: r.nome ?? "", categoria: r.categoria ?? "Altro",
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome, codice, fornitore…" className="bg-input border-border text-sm pl-9" />
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0" style={{ background: C.green, color: C.bgDeep }}>
          <Plus size={15} /> Nuovo ricambio
        </Button>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {FILTRI.map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{ background: filtro === v ? `${C.green}18` : C.inner, color: filtro === v ? C.green : C.textDim, border: `1px solid ${filtro === v ? C.green + "40" : "transparent"}` }}>{l}</button>
        ))}
        <div className="w-px shrink-0" style={{ background: C.border }} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-3 py-2 rounded-lg text-xs font-medium shrink-0"
          style={{ background: C.inner, color: C.textDim, border: `1px solid ${C.border}` }}>
          <option value="tutte">Tutte le categorie</option>
          {CATEGORIE_RICAMBIO.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista ricambi */}
      {isLoading ? (
        <div className="text-center py-16 text-sm" style={{ color: C.textFaint }}>Caricamento…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <Package size={36} className="opacity-10" style={{ color: C.green }} />
          <p className="text-sm" style={{ color: C.textFaint }}>Nessun ricambio</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((r) => {
            const sc = STATO_SCORTA[r.statoScorta] ?? STATO_SCORTA.disponibile;
            return (
              <div key={r.id} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{r.nome}</p>
                      <Badge style={{ background: `${sc.color}18`, color: sc.color, border: "none", fontSize: 10 }}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.textFaint }}>
                      {[r.codice, r.categoria].filter(Boolean).join(" · ")}
                    </p>
                    {r.compatibilita && <p className="text-[11px] mt-1" style={{ color: C.textDim }}>Compatibile: {r.compatibilita}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: C.textFaint }}>
                      {r.posizione && <span className="flex items-center gap-1"><MapPin size={11} />{r.posizione}</span>}
                      {r.fornitore && <span>{r.fornitore}</span>}
                      {r.costoMedio != null && Number(r.costoMedio) > 0 && <span style={{ color: C.gold }}>{eur(r.costoMedio)}/pz</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg" style={{ color: C.gold }}><Pencil size={13} /></button>
                    <button onClick={() => deleteR.mutate({ id: r.id })} className="p-1.5 rounded-lg" style={{ color: C.red }}><Trash2 size={13} /></button>
                  </div>
                </div>
                {/* Stepper quantità */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: C.borderSoft }}>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: C.textFaint }}>
                    Scorta {r.sogliaMinima > 0 ? `· min ${r.sogliaMinima}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustR.mutate({ id: r.id, delta: -1 })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.inner, color: C.textDim, border: `1px solid ${C.border}` }}><Minus size={13} /></button>
                    <span className="text-base font-bold w-10 text-center" style={{ color: sc.color, fontFamily: "var(--font-display)" }}>{Number(r.quantitaDisponibile)}</span>
                    <button onClick={() => adjustR.mutate({ id: r.id, delta: 1 })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}30` }}><Plus size={13} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                {o.costoStimato > 0 && <p className="text-xs mt-1" style={{ color: C.gold }}>Stima: {eur(o.costoStimato)}</p>}
              </div>
            ))}
          </div>
          {(ordine as any[]).length > 0 && (
            <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider" style={{ color: C.textFaint }}>Totale stimato</span>
                <span className="text-lg font-bold" style={{ color: C.gold, fontFamily: "var(--font-display)" }}>{eur(totOrdine)}</span>
              </div>
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
                  {CATEGORIE_RICAMBIO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Compatibilità (mezzi)"><Input value={form.compatibilita} onChange={(e) => setForm((f) => ({ ...f, compatibilita: e.target.value }))} placeholder="Es. Trattori serie X, mietitrebbie…" className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantità disponibile"><Input type="number" value={form.quantitaDisponibile} onChange={(e) => setForm((f) => ({ ...f, quantitaDisponibile: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Soglia minima"><Input type="number" value={form.sogliaMinima} onChange={(e) => setForm((f) => ({ ...f, sogliaMinima: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posizione"><Input value={form.posizione} onChange={(e) => setForm((f) => ({ ...f, posizione: e.target.value }))} placeholder="Scaffale A3…" className="bg-input border-border text-sm" /></Field>
              <Field label="Costo medio (€)"><Input type="number" step="0.01" value={form.costoMedio} onChange={(e) => setForm((f) => ({ ...f, costoMedio: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <Field label="Fornitore"><Input value={form.fornitore} onChange={(e) => setForm((f) => ({ ...f, fornitore: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" /></Field>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
            <Button onClick={submit} disabled={createR.isPending || updateR.isPending} className="w-full" style={{ background: C.green, color: C.bgDeep }}>
              {createR.isPending || updateR.isPending ? "Salvataggio…" : editing ? "Aggiorna ricambio" : "Salva ricambio"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
