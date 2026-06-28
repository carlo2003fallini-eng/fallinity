import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Wrench, Plus, Trash2, CheckCircle2, X, User, Clock, Euro, Package, AlertTriangle, Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  C, STATO_INTERVENTO, PRIORITA, TIPO_INTERVENTO_LABEL, STATO_SCORTA, eur, dataIT,
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
  const [tab, setTab] = useState("pianificato");
  const [filtroMezzo, setFiltroMezzo] = useState("tutti");
  const [filtroPriorita, setFiltroPriorita] = useState("tutte");
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
  const { data: interventi = [], isLoading } = trpc.officina.interventi.list.useQuery();
  const { data: completaDetail } = trpc.officina.interventi.detail.useQuery(
    { id: completaId! }, { enabled: !!completaId });

  const invalidate = () => {
    utils.officina.interventi.list.invalidate();
    utils.officina.dashboard.invalidate();
    utils.officina.macchine.list.invalidate();
    utils.officina.ricambi.list.invalidate();
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
    onSuccess: (res) => { invalidate(); setOpenCompleta(false); setCompletaId(null); toast.success(`Intervento completato · ${eur(res.costoFinale)}`); },
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

  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const list = (interventi as any[]).filter((i) => {
    const okTab = i.stato === tab;
    const okMezzo = filtroMezzo === "tutti" || i.macchinaId === filtroMezzo;
    const okPri = filtroPriorita === "tutte" || i.priorita === filtroPriorita;
    return okTab && okMezzo && okPri;
  });

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
      const q = usati[r.id] ?? 0;
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
        .filter((r: any) => (usati[r.id] ?? 0) > 0)
        .map((r: any) => ({
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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 flex-1">
          <select value={filtroMezzo} onChange={(e) => setFiltroMezzo(e.target.value)} className="px-3 py-2 rounded-lg text-xs font-medium shrink-0"
            style={{ background: C.inner, color: C.textDim, border: `1px solid ${C.border}` }}>
            <option value="tutti">Tutti i mezzi</option>
            {(mezzi as any[]).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <select value={filtroPriorita} onChange={(e) => setFiltroPriorita(e.target.value)} className="px-3 py-2 rounded-lg text-xs font-medium shrink-0"
            style={{ background: C.inner, color: C.textDim, border: `1px solid ${C.border}` }}>
            <option value="tutte">Tutte le priorità</option>
            {PRIORITA_KEYS.map((p) => <option key={p} value={p}>{PRIORITA[p].label}</option>)}
          </select>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_I }); setRighe([]); setOpenForm(true); }} className="gap-2 shrink-0" style={{ background: C.green, color: C.bgDeep }}>
          <Plus size={15} /> Nuovo intervento
        </Button>
      </div>

      {/* Tab stati */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {TABS.map(([v, l]) => {
          const cfg = STATO_INTERVENTO[v];
          const active = tab === v;
          return (
            <button key={v} onClick={() => setTab(v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{ background: active ? `${cfg.color}18` : C.inner, color: active ? cfg.color : C.textDim, border: `1px solid ${active ? cfg.color + "40" : "transparent"}` }}>
              <cfg.icon size={13} /> {l}
              <span className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: active ? `${cfg.color}25` : C.border, color: active ? cfg.color : C.textFaint }}>{counts[v] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Lista interventi */}
      {isLoading ? (
        <div className="text-center py-16 text-sm" style={{ color: C.textFaint }}>Caricamento…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <CheckCircle2 size={36} className="opacity-10" style={{ color: C.green }} />
          <p className="text-sm" style={{ color: C.textFaint }}>Nessun intervento in questa sezione</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((i) => {
            const sc = STATO_INTERVENTO[i.stato] ?? STATO_INTERVENTO.pianificato;
            const pri = PRIORITA[i.priorita] ?? PRIORITA.media;
            const mezzo = mezziMap[i.macchinaId];
            const ritardo = isInRitardo(i);
            return (
              <div key={i.id} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${ritardo ? C.red + "40" : C.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sc.color}18` }}>
                    <sc.icon size={15} style={{ color: sc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: C.text }}>{TIPO_INTERVENTO_LABEL[i.tipo] ?? i.tipo}</p>
                      <Badge style={{ background: `${pri.color}18`, color: pri.color, border: "none", fontSize: 10 }}>{pri.label}</Badge>
                      {ritardo && <Badge className="gap-1" style={{ background: `${C.red}18`, color: C.red, border: "none", fontSize: 10 }}><AlertTriangle size={9} /> In ritardo</Badge>}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: C.textDim }}>{mezzo?.nome ?? "Mezzo"} · {i.descrizione}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap" style={{ color: C.textFaint }}>
                      {i.operatore && <span className="flex items-center gap-1"><User size={11} />{i.operatore}</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />{dataIT(i.dataPianificata ?? i.data)}</span>
                      {i.tempoStimato && <span>{Number(i.tempoStimato)}h stim.</span>}
                      {i.stato === "completato" && i.costoFinale != null
                        ? <span className="flex items-center gap-1" style={{ color: C.gold }}><Euro size={11} />{eur(i.costoFinale)}</span>
                        : i.costoPrevisto != null && Number(i.costoPrevisto) > 0
                          ? <span className="flex items-center gap-1" style={{ color: C.textDim }}><Euro size={11} />prev. {eur(i.costoPrevisto)}</span>
                          : null}
                    </div>
                  </div>
                  <button onClick={() => deleteI.mutate({ id: i.id })} className="p-1.5 rounded-lg shrink-0" style={{ color: C.red }}><Trash2 size={13} /></button>
                </div>
                {/* Azioni */}
                {i.stato !== "completato" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: C.borderSoft }}>
                    {i.stato === "pianificato" && (
                      <button onClick={() => updateStato.mutate({ id: i.id, stato: "in_corso" })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ background: `${C.blue}18`, color: C.blue }}>
                        <Play size={13} /> Avvia
                      </button>
                    )}
                    <button onClick={() => openCompletamento(i)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ background: `${C.green}18`, color: C.green }}>
                      <CheckCircle2 size={13} /> Completa
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              <Field label="Costo orario (€)"><Input type="number" value={form.costoOrario} onChange={(e) => setForm((f) => ({ ...f, costoOrario: e.target.value }))} className="bg-input border-border text-sm" /></Field>
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
            <Button onClick={submitCreate} disabled={createI.isPending} className="w-full" style={{ background: C.green, color: C.bgDeep }}>
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
                  <p className="text-sm font-medium" style={{ color: C.text }}>{TIPO_INTERVENTO_LABEL[completaDetail.tipo] ?? completaDetail.tipo}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.textDim }}>{completaDetail.descrizione}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ore lavoro"><Input type="number" step="0.5" value={oreLavoro} onChange={(e) => setOreLavoro(e.target.value)} className="bg-input border-border text-sm" /></Field>
                  <Field label="Costo orario (€)"><Input type="number" value={costoOrarioFin} onChange={(e) => setCostoOrarioFin(e.target.value)} className="bg-input border-border text-sm" /></Field>
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
                                <p className="text-xs font-medium truncate" style={{ color: C.text }}>{r.nomeRicambio || "Ricambio"}</p>
                                <p className="text-[11px]" style={{ color: sc.color }}>{sc.label} · disp. {r.disponibile} · rich. {Number(r.quantitaRichiesta)}</p>
                              </div>
                              <Input type="number" value={usati[r.id] ?? ""} placeholder="0" onChange={(e) => setUsati((u) => ({ ...u, [r.id]: Number(e.target.value) }))} className="w-16 bg-input border-border text-sm shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field label="Note finali"><Input value={noteFin} onChange={(e) => setNoteFin(e.target.value)} className="bg-input border-border text-sm" /></Field>

                {/* Riepilogo costo */}
                <div className="p-4 rounded-xl space-y-1.5" style={{ background: `${C.green}0d`, border: `1px solid ${C.green}25` }}>
                  <div className="flex justify-between text-xs" style={{ color: C.textDim }}><span>Manodopera</span><span>{eur(costoManodoperaPreview)}</span></div>
                  <div className="flex justify-between text-xs" style={{ color: C.textDim }}><span>Ricambi</span><span>{eur(costoRicambiPreview)}</span></div>
                  <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: C.green + "25" }}>
                    <span className="text-sm font-semibold" style={{ color: C.text }}>Costo finale</span>
                    <span className="text-base font-bold" style={{ color: C.green, fontFamily: "var(--font-display)" }}>{eur(costoFinalePreview)}</span>
                  </div>
                  <p className="text-[10px] pt-1" style={{ color: C.textFaint }}>Registrato in Finanza · scaricato dal magazzino · evento in Calendario</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
                <Button onClick={submitCompleta} disabled={completaI.isPending} className="w-full gap-2" style={{ background: C.green, color: C.bgDeep }}>
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
