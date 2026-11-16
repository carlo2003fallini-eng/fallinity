import { useLocation } from "wouter";
import { useOfficinaPermissions } from "./OfficinaLayout";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Tractor, Plus, Trash2, Wrench, Gauge, Calendar, FileText, History, Search, X, Pencil, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { FAL_IMAGES } from "@/lib/assets";
import {
  C, STATO_MACCHINA, STATO_INTERVENTO, TIPO_INTERVENTO_LABEL, eur, dataIT, HealthRing, CodicePill,
} from "./shared";

const EMPTY_M = {
  id: "", foto: "", nome: "", categoria: "", marca: "", modello: "", targa: "", telaio: "",
  anno: "", oreMotore: "", chilometri: "", stato: "operativo",
  ultimoTagliando: "", prossimaManutenzione: "", note: "",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium mb-1.5 block" style={{ color: C.textDim }}>{label}</label>
    {children}
  </div>
);

export default function MezziTab() {
  const [, navigate] = useLocation();
  const { canEdit, canSeeCosts } = useOfficinaPermissions();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statoFiltro, setStatoFiltro] = useState<string>(() => new URLSearchParams(window.location.search).get("stato") || "tutti");
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_M });
  const [editing, setEditing] = useState(false);

  const utils = trpc.useUtils();
  const { data: mezzi = [], isLoading, isError, refetch } = trpc.officina.macchine.list.useQuery();
  const { data: detail } = trpc.officina.macchine.detail.useQuery(
    { id: detailId! },
    { enabled: !!detailId },
  );

  const invalidateAll = () => {
    utils.officina.macchine.list.invalidate();
    utils.officina.dashboard.invalidate();
    if (detailId) utils.officina.macchine.detail.invalidate({ id: detailId });
  };

  const createM = trpc.officina.macchine.create.useMutation({
    onSuccess: () => { invalidateAll(); setOpenForm(false); setForm({ ...EMPTY_M }); toast.success("Mezzo salvato"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const updateM = trpc.officina.macchine.update.useMutation({
    onSuccess: () => { invalidateAll(); setOpenForm(false); setForm({ ...EMPTY_M }); setEditing(false); toast.success("Mezzo aggiornato"); },
    onError: () => toast.error("Errore durante l'aggiornamento"),
  });
  const deleteM = trpc.officina.macchine.delete.useMutation({
    onSuccess: () => { invalidateAll(); setOpenDetail(false); setDetailId(null); toast.success("Mezzo eliminato"); },
  });

  const list = (mezzi as any[]).filter((m) => {
    const okStato = statoFiltro === "tutti" || m.stato === statoFiltro;
    const q = search.toLowerCase().trim();
    const okSearch = !q || [m.nome, m.marca, m.modello, m.targa, m.categoria].filter(Boolean).join(" ").toLowerCase().includes(q);
    return okStato && okSearch;
  });

  function openNew() {
    setForm({ ...EMPTY_M });
    setEditing(false);
    setOpenForm(true);
  }
  function openEdit(m: any) {
    setForm({
      id: m.id, foto: m.foto ?? "", nome: m.nome ?? "", categoria: m.categoria ?? "", marca: m.marca ?? "",
      modello: m.modello ?? "", targa: m.targa ?? "", telaio: m.telaio ?? "",
      anno: m.anno ? String(m.anno) : "", oreMotore: m.oreMotore ? String(m.oreMotore) : "",
      chilometri: m.chilometri ? String(m.chilometri) : "", stato: m.stato ?? "operativo",
      ultimoTagliando: m.ultimoTagliando ? new Date(m.ultimoTagliando).toISOString().split("T")[0] : "",
      prossimaManutenzione: m.prossimaManutenzione ? new Date(m.prossimaManutenzione).toISOString().split("T")[0] : "",
      note: m.note ?? "",
    });
    setEditing(true);
    setOpenForm(true);
    setOpenDetail(false);
  }

  function submit() {
    if (!form.nome.trim()) { toast.error("Nome obbligatorio"); return; }
    const payload = {
      nome: form.nome.trim(),
      foto: form.foto || undefined,
      categoria: form.categoria || undefined,
      marca: form.marca || undefined,
      modello: form.modello || undefined,
      targa: form.targa || undefined,
      telaio: form.telaio || undefined,
      anno: form.anno ? Number(form.anno) : undefined,
      oreMotore: form.oreMotore ? Number(form.oreMotore) : undefined,
      chilometri: form.chilometri ? Number(form.chilometri) : undefined,
      stato: form.stato as any,
      ultimoTagliando: form.ultimoTagliando || undefined,
      prossimaManutenzione: form.prossimaManutenzione || undefined,
      note: form.note || undefined,
    };
    if (editing) updateM.mutate({ id: form.id, ...payload });
    else createM.mutate(payload);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textDim }} /><Input aria-label="Cerca mezzi" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, marca, modello o targa…" className="h-11 w-full bg-input border-border pl-9 text-sm" /></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} className="min-h-11 flex-1 gap-2"><SlidersHorizontal size={16} /> Filtri{statoFiltro !== "tutti" ? " · 1" : ""}</Button>{canEdit && <Button onClick={openNew} className="min-h-11 flex-1 gap-1 px-2" style={{ background: C.green, color: C.bgDeep }}><Plus size={16} /> Nuovo mezzo</Button>}</div>
        {filtersOpen && <div className="rounded-xl border p-3" style={{ borderColor: C.border, background: C.panel }}><label htmlFor="stato-mezzo" className="mb-1 block text-xs" style={{ color: C.textDim }}>Stato operativo</label><select id="stato-mezzo" value={statoFiltro} onChange={(e) => setStatoFiltro(e.target.value)} className="min-h-11 w-full rounded-lg px-3 text-sm" style={{ color: C.text, background: C.inner, border: `1px solid ${C.border}` }}>{[["tutti", "Tutti"], ["operativo", "Operativi"], ["manutenzione", "Manutenzione"], ["fermo", "Fermi"], ["riposo", "Riposo"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><button onClick={() => setStatoFiltro("tutti")} className="mt-1 min-h-10 text-xs" style={{ color: C.green }}>Azzera filtri</button></div>}
      </div>
      {isError ? <button onClick={() => refetch()} className="w-full rounded-xl p-5 text-sm" style={{ color: C.gold }}>Impossibile caricare i mezzi · Riprova</button> : isLoading ? <p className="py-8 text-center text-sm" style={{ color: C.textDim }}>Caricamento…</p> : list.length === 0 ? <div className="rounded-xl border p-6 text-center" style={{ borderColor: C.border, background: C.panel }}><Tractor size={25} className="mx-auto mb-2" style={{ color: C.green }} /><p className="text-sm" style={{ color: C.textDim }}>Nessun mezzo trovato</p>{canEdit && <button onClick={openNew} className="mt-2 min-h-11 text-xs" style={{ color: C.green }}>Crea un nuovo mezzo</button>}</div> : <div className="grid grid-cols-2 gap-3">
        {list.map((m) => { const cfg = STATO_MACCHINA[m.stato] ?? STATO_MACCHINA.operativo; return <button key={m.id} onClick={() => { setDetailId(m.id); setOpenDetail(true); }} className="overflow-hidden rounded-2xl border text-left transition-transform active:scale-[0.98]" style={{ borderColor: C.border, background: C.panel }}>
          <div className="relative h-20 sm:h-28"><img src={m.foto || FAL_IMAGES.officinaMezzo} alt={m.foto ? `Foto del mezzo ${m.nome}` : "Immagine illustrativa di un mezzo agricolo"} className="h-full w-full object-cover" />{!m.foto && <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] text-white">Illustrativa</span>}</div>
          <div className="p-3"><h2 className="text-sm font-bold leading-tight" style={{ color: C.text }}>{m.nome}</h2><p className="mt-1 text-[11px] leading-tight" style={{ color: C.textDim }}>{[m.marca, m.modello].filter(Boolean).join(" ") || m.categoria || "—"}</p><span className="mt-2 inline-block rounded-md px-1.5 py-1 text-[10px] font-semibold" style={{ color: cfg.color, background: C.inner }}>{cfg.label}</span><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]" style={{ color: C.textDim }}><span className="flex items-center gap-1"><Gauge size={12} />{Number(m.oreMotore) > 0 ? `${Number(m.oreMotore).toLocaleString("it-IT")} h` : Number(m.chilometri) > 0 ? `${Number(m.chilometri).toLocaleString("it-IT")} km` : "Ore n.d."}</span><span>Stato manut. {m.healthScore ?? 100}/100</span></div></div>
        </button>; })}
      </div>}

      {/* Sheet dettaglio mezzo */}
      <Sheet open={openDetail} onOpenChange={setOpenDetail}>
        <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          {detail ? (
            <>
              <div className="relative h-36 shrink-0" style={{
                backgroundImage: `linear-gradient(180deg, transparent 20%, ${C.panelDark} 100%), url(${detail.foto || FAL_IMAGES.officinaMezzo})`,
                backgroundSize: "cover", backgroundPosition: "center",
              }}>
                <button onClick={() => setOpenDetail(false)} className="absolute top-3 right-3 p-2 rounded-lg" style={{ background: "oklch(0.08 0.005 145 / 0.6)", color: C.text }}>
                  <X size={16} />
                </button>
              </div>
              <SheetHeader className="px-6 pt-4 pb-3 text-left">
                <div className="flex items-start gap-3">
                  <HealthRing score={detail.healthScore ?? 100} size={52} />
                  <div className="flex-1 min-w-0">
                    <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>{detail.nome}</SheetTitle>
                    <p className="text-xs mt-0.5" style={{ color: C.textDim }}>
                      {[detail.marca, detail.modello, detail.anno ? `Anno ${detail.anno}` : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <Badge className="mt-1.5" style={{ background: `${(STATO_MACCHINA[detail.stato] ?? STATO_MACCHINA.operativo).color}22`, color: (STATO_MACCHINA[detail.stato] ?? STATO_MACCHINA.operativo).color, border: "none", fontSize: 10 }}>
                      {(STATO_MACCHINA[detail.stato] ?? STATO_MACCHINA.operativo).label}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
                {/* Dati tecnici */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Categoria", detail.categoria || "—"],
                    ["Targa", detail.targa || "—"],
                    ["Telaio", detail.telaio || "—"],
                    ["Ore motore", detail.oreMotore ? `${Number(detail.oreMotore).toLocaleString("it-IT")} h` : "—"],
                    ["Chilometri", detail.chilometri ? `${Number(detail.chilometri).toLocaleString("it-IT")} km` : "—"],
                    ["Ultimo tagliando", dataIT(detail.ultimoTagliando)],
                    ["Prossima manut.", dataIT(detail.prossimaManutenzione)],
                    ...(canSeeCosts ? [["Costo totale", eur(detail.costoTotale)]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg p-3" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.textFaint }}>{k}</p>
                      <p className="text-sm font-medium" style={{ color: C.text }}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Storico interventi */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History size={13} style={{ color: C.gold }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.gold }}>Storico interventi</span>
                  </div>
                  {(!detail.storico || detail.storico.length === 0) ? (
                    <p className="text-xs py-3 text-center" style={{ color: C.textFaint }}>Nessun intervento registrato</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.storico.map((i: any) => {
                        const sc = STATO_INTERVENTO[i.stato] ?? STATO_INTERVENTO.pianificato;
                        return (
                          <button key={i.id} onClick={() => { setOpenDetail(false); navigate(`/officina/interventi?dettaglio=${i.id}`); }} className="flex w-full items-center gap-3 p-2.5 rounded-lg text-left" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sc.color}18` }}>
                              <sc.icon size={12} style={{ color: sc.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: C.text }}>{TIPO_INTERVENTO_LABEL[i.tipo] ?? i.tipo}</p>
                              <p className="text-[11px]" style={{ color: C.textFaint }}>{dataIT(i.data)}</p>
                            </div>
                            {canSeeCosts && i.costoFinale != null && Number(i.costoFinale) > 0 && (
                              <span className="text-xs font-medium" style={{ color: C.gold }}>{eur(i.costoFinale)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Documenti */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} style={{ color: C.blue }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.blue }}>Documenti</span>
                  </div>
                  {(!detail.documenti || detail.documenti.length === 0) ? (
                    <p className="text-xs py-3 text-center" style={{ color: C.textFaint }}>Nessun documento allegato</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.documenti.map((d: any) => (
                        <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: C.inner, border: `1px solid ${C.borderSoft}` }}>
                          <FileText size={13} style={{ color: C.blue }} />
                          <span className="text-xs truncate flex-1" style={{ color: C.text }}>{d.nome}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {detail.note && (
                  <p className="text-xs p-3 rounded-lg" style={{ background: C.inner, color: C.textDim, border: `1px solid ${C.borderSoft}` }}>{detail.note}</p>
                )}
              </div>
              {canEdit && <div className="px-6 py-4 border-t flex shrink-0 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ borderColor: C.border }}>
                <Button onClick={() => openEdit(detail)} className="flex-1 gap-2" style={{ background: `${C.gold}18`, color: C.gold, border: `1px solid ${C.gold}30` }}>
                  <Pencil size={14} /> Modifica
                </Button>
                <button onClick={() => { if (window.confirm(`Eliminare il mezzo ${detail.nome}? Lo storico resterà conservato.`)) deleteM.mutate({ id: detail.id }); }} aria-label="Elimina mezzo" className="p-2.5 rounded-lg" style={{ color: C.red, border: `1px solid ${C.red}30` }}>
                  <Trash2 size={16} />
                </button>
              </div>}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.textFaint }}>Caricamento…</div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet form mezzo */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[420px] p-0 flex flex-col"
          style={{ background: C.panelDark, border: "none", borderLeft: `1px solid ${C.border}` }}>
          <SheetHeader className="px-6 py-5 border-b text-left" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.green}18` }}>
                <Tractor size={15} style={{ color: C.green }} />
              </div>
              <SheetTitle style={{ color: C.text, fontFamily: "var(--font-display)" }}>{editing ? "Modifica mezzo" : "Nuovo mezzo"}</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="Nome *">
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" />
            </Field>
            <Field label="Foto del mezzo (URL)"><Input value={form.foto} onChange={(e) => setForm((f) => ({ ...f, foto: e.target.value }))} placeholder="https://…" className="bg-input border-border text-sm" /></Field>
            <Field label="Categoria">
              <Input value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Trattore, Mietitrebbia…" className="bg-input border-border text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca"><Input value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Modello"><Input value={form.modello} onChange={(e) => setForm((f) => ({ ...f, modello: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Anno"><Input type="number" value={form.anno} onChange={(e) => setForm((f) => ({ ...f, anno: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Targa"><Input value={form.targa} onChange={(e) => setForm((f) => ({ ...f, targa: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <Field label="Telaio"><Input value={form.telaio} onChange={(e) => setForm((f) => ({ ...f, telaio: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ore motore"><Input type="number" value={form.oreMotore} onChange={(e) => setForm((f) => ({ ...f, oreMotore: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Chilometri"><Input type="number" value={form.chilometri} onChange={(e) => setForm((f) => ({ ...f, chilometri: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ultimo tagliando"><Input type="date" value={form.ultimoTagliando} onChange={(e) => setForm((f) => ({ ...f, ultimoTagliando: e.target.value }))} className="bg-input border-border text-sm" /></Field>
              <Field label="Prossima manut."><Input type="date" value={form.prossimaManutenzione} onChange={(e) => setForm((f) => ({ ...f, prossimaManutenzione: e.target.value }))} className="bg-input border-border text-sm" /></Field>
            </div>
            <Field label="Stato">
              <select value={form.stato} onChange={(e) => setForm((f) => ({ ...f, stato: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: "oklch(0.14 0.007 145)", color: C.text, border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="operativo">Operativo</option>
                <option value="manutenzione">In manutenzione</option>
                <option value="fermo">Fermo</option>
                <option value="riposo">A riposo</option>
              </select>
            </Field>
            <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" /></Field>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: C.border }}>
            <Button onClick={submit} disabled={!canEdit || createM.isPending || updateM.isPending} className="w-full" style={{ background: C.green, color: C.bgDeep }}>
              {createM.isPending || updateM.isPending ? "Salvataggio…" : editing ? "Aggiorna mezzo" : "Salva mezzo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
