import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Tractor, Plus, Trash2, Wrench, AlertTriangle,
  CheckCircle2, Clock, XCircle, ChevronRight, Package,
} from "lucide-react";
import { toast } from "sonner";
import { FAL_IMAGES } from "@/lib/assets";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD  = "oklch(0.72 0.15 75)";
const RED   = "oklch(0.55 0.22 25)";
const BLUE  = "oklch(0.6 0.15 220)";

const statoMacchina: Record<string, { label: string; color: string }> = {
  operativo:    { label: "Operativo",    color: GREEN },
  manutenzione: { label: "Manutenzione", color: GOLD  },
  fermo:        { label: "Fermo",        color: RED   },
};
const statoIntervento: Record<string, { label: string; color: string; icon: any }> = {
  pianificato: { label: "Pianificato", color: GOLD, icon: Clock        },
  in_corso:    { label: "In corso",    color: BLUE, icon: Wrench       },
  completato:  { label: "Completato",  color: GREEN, icon: CheckCircle2 },
  annullato:   { label: "Annullato",   color: "oklch(0.45 0.01 145)", icon: XCircle },
};

const EMPTY_M = { nome: "", marca: "", modello: "", targa: "", anno: "", oreTotali: "", stato: "operativo" as "operativo"|"manutenzione"|"fermo", note: "" };
const EMPTY_I = { tipo: "manutenzione" as "manutenzione"|"riparazione"|"revisione", descrizione: "", data: new Date().toISOString().split("T")[0], priorita: "media" as "alta"|"media"|"bassa", stato: "pianificato" as "pianificato"|"in_corso"|"completato", costoManodopera: "", costoRicambi: "", operatore: "", note: "" };

export default function Officina() {
  const [selectedMacchina, setSelectedMacchina] = useState<string | null>(null);
  const [openMacchina, setOpenMacchina] = useState(false);
  const [openIntervento, setOpenIntervento] = useState(false);
  const [formM, setFormM] = useState({ ...EMPTY_M });
  const [formI, setFormI] = useState({ ...EMPTY_I });

  const { data: macchine = [], refetch: refetchM } = trpc.officina.macchine.list.useQuery();
  const { data: interventi = [], refetch: refetchI } = trpc.officina.interventi.list.useQuery(
    selectedMacchina ? { macchinaId: selectedMacchina } : undefined
  );
  const { data: tuttiInterventi = [] } = trpc.officina.interventi.list.useQuery(undefined);

  const createM = trpc.officina.macchine.create.useMutation({
    onSuccess: () => { refetchM(); setOpenMacchina(false); setFormM({ ...EMPTY_M }); toast.success("Macchina aggiunta"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteM = trpc.officina.macchine.delete.useMutation({
    onSuccess: () => { refetchM(); setSelectedMacchina(null); toast.success("Macchina eliminata"); },
  });
  const createI = trpc.officina.interventi.create.useMutation({
    onSuccess: () => { refetchI(); setOpenIntervento(false); setFormI({ ...EMPTY_I }); toast.success("Intervento aggiunto"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const macchineList = macchine as any[];
  const intervList   = interventi as any[];
  const tuttiList    = tuttiInterventi as any[];
  const selectedData = macchineList.find(m => m.id === selectedMacchina);

  const ferme      = macchineList.filter(m => m.stato === "fermo").length;
  const manuten    = macchineList.filter(m => m.stato === "manutenzione").length;
  const aperti     = tuttiList.filter(i => i.stato !== "completato").length;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HERO PREMIUM ───────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden min-h-[160px] flex items-end p-6"
        style={{ backgroundImage: `linear-gradient(90deg, oklch(0.08 0.006 145 / 0.94) 0%, oklch(0.08 0.006 145 / 0.5) 100%), url(${FAL_IMAGES.officinaTractor})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="flex items-end justify-between w-full flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: GOLD }}>Parco Mezzi & Manutenzioni</p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.97 0.005 145)", letterSpacing: "-0.02em" }}>
              Officina
            </h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.78 0.01 145)" }}>
              {macchineList.length} mezzi · {aperti} interventi aperti · {ferme} fermi
            </p>
          </div>
          <Button onClick={() => { setFormM({ ...EMPTY_M }); setOpenMacchina(true); }}
            className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
            <Plus size={15} /> Nuova macchina
          </Button>
        </div>
      </div>

      {/* ── KPI ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "MACCHINE",         value: String(macchineList.length), color: GREEN, icon: Tractor      },
          { label: "FERME",            value: String(ferme),               color: ferme > 0 ? RED : GREEN,  icon: AlertTriangle },
          { label: "IN MANUTENZIONE",  value: String(manuten),             color: manuten > 0 ? GOLD : GREEN, icon: Wrench      },
          { label: "INTERVENTI APERTI",value: String(aperti),              color: aperti > 0 ? GOLD : GREEN, icon: Clock       },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}1a` }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)", letterSpacing: "-0.03em" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN LAYOUT ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Lista macchine */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <Tractor size={13} style={{ color: GREEN }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GREEN }}>Parco Macchine</span>
            <Badge className="ml-auto text-xs px-2 py-0.5" style={{ background: `${GREEN}15`, color: GREEN, border: "none" }}>{macchineList.length}</Badge>
          </div>

          {macchineList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Tractor size={32} className="opacity-10" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessuna macchina</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
              {macchineList.map((m: any) => {
                const cfg = statoMacchina[m.stato] ?? statoMacchina.operativo;
                const isSel = selectedMacchina === m.id;
                return (
                  <div key={m.id} onClick={() => setSelectedMacchina(isSel ? null : m.id)}
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer group"
                    style={{
                      background: isSel ? `${GREEN}0a` : "transparent",
                      borderLeft: isSel ? `2px solid ${GREEN}` : "2px solid transparent",
                    }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${cfg.color}15` }}>
                      <Tractor size={16} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.88 0.005 145)" }}>{m.nome}</p>
                      <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
                        {[m.marca, m.modello, m.anno ? `Anno ${m.anno}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge style={{ background: `${cfg.color}15`, color: cfg.color, border: "none", fontSize: 10 }}>{cfg.label}</Badge>
                      <ChevronRight size={13} style={{ color: isSel ? GREEN : "oklch(0.35 0.01 145)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dettaglio + interventi */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          {!selectedData ? (
            /* Priorità del giorno */
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
                <Wrench size={13} style={{ color: GOLD }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Priorità del giorno</span>
              </div>
              {tuttiList.filter(i => i.stato !== "completato").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <CheckCircle2 size={36} className="opacity-10" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessun intervento aperto</p>
                  <p className="text-xs" style={{ color: "oklch(0.35 0.01 145)" }}>Seleziona una macchina per aggiungerne</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                  {tuttiList.filter(i => i.stato !== "completato").map((i: any) => {
                    const sc = statoIntervento[i.stato] ?? statoIntervento.pianificato;
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sc.color}15` }}>
                          <sc.icon size={13} style={{ color: sc.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{i.descrizione || i.tipo}</p>
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
                            {i.tipo} · {new Date(i.data).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Badge style={{ background: `${sc.color}15`, color: sc.color, border: "none", fontSize: 10 }}>{sc.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Macchina header */}
              <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.92 0.005 145)" }}>
                        {selectedData.nome}
                      </h2>
                      <Badge style={{ background: `${(statoMacchina[selectedData.stato] ?? statoMacchina.operativo).color}15`, color: (statoMacchina[selectedData.stato] ?? statoMacchina.operativo).color, border: "none", fontSize: 10 }}>
                        {(statoMacchina[selectedData.stato] ?? statoMacchina.operativo).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                      {selectedData.marca  && <span>{selectedData.marca}</span>}
                      {selectedData.modello && <span>{selectedData.modello}</span>}
                      {selectedData.anno   && <span>Anno {selectedData.anno}</span>}
                      {selectedData.oreTotali && <span>{selectedData.oreTotali}h</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setFormI({ ...EMPTY_I }); setOpenIntervento(true); }}
                      className="gap-1.5 text-xs" style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                      <Plus size={12} /> Intervento
                    </Button>
                    <button onClick={() => deleteM.mutate({ id: selectedData.id })}
                      className="p-2 rounded-lg" style={{ color: RED }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Interventi */}
              <div className="px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>
                  Interventi ({intervList.length})
                </h3>
                {intervList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Wrench size={28} className="opacity-10" style={{ color: GOLD }} />
                    <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun intervento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {intervList.map((i: any) => {
                      const sc = statoIntervento[i.stato] ?? statoIntervento.pianificato;
                      return (
                        <div key={i.id} className="flex items-center gap-3 px-3 py-3 rounded-xl"
                          style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.16 0.007 145)" }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sc.color}15` }}>
                            <sc.icon size={13} style={{ color: sc.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: "oklch(0.82 0.005 145)" }}>{i.tipo}</span>
                              <Badge style={{ background: `${sc.color}15`, color: sc.color, border: "none", fontSize: 10 }}>{sc.label}</Badge>
                            </div>
                            {i.descrizione && <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.55 0.01 145)" }}>{i.descrizione}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                              {new Date(i.data).toLocaleDateString("it-IT")}
                            </p>
                            {(i.costoManodopera || i.costoRicambi) && (
                              <p className="text-xs font-medium" style={{ color: GOLD }}>
                                €{(Number(i.costoManodopera ?? 0) + Number(i.costoRicambi ?? 0)).toLocaleString("it-IT")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── RICAMBI & COSTI ────────────────────────────────────────────────── */}
      {(() => {
        const totRicambi = tuttiList.reduce((s, i) => s + Number(i.costoRicambi ?? 0), 0);
        const totManodopera = tuttiList.reduce((s, i) => s + Number(i.costoManodopera ?? 0), 0);
        const perTipo: Record<string, number> = {};
        tuttiList.forEach(i => { perTipo[i.tipo] = (perTipo[i.tipo] ?? 0) + Number(i.costoRicambi ?? 0); });
        const tipiOrdinati = Object.entries(perTipo).sort((a, b) => b[1] - a[1]);
        const maxTipo = Math.max(1, ...Object.values(perTipo));
        return (
          <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
              <Package size={13} style={{ color: BLUE }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BLUE }}>Ricambi & Costi</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-5">
              <div className="rounded-xl p-4" style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.16 0.007 145)" }}>
                <p className="text-xs font-semibold tracking-wider mb-2" style={{ color: "oklch(0.45 0.01 145)" }}>COSTO RICAMBI TOTALE</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: GOLD }}>€{totRicambi.toLocaleString("it-IT")}</p>
                <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>su {tuttiList.length} interventi</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.16 0.007 145)" }}>
                <p className="text-xs font-semibold tracking-wider mb-2" style={{ color: "oklch(0.45 0.01 145)" }}>COSTO MANODOPERA</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: GREEN }}>€{totManodopera.toLocaleString("it-IT")}</p>
                <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>totale interventi</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.16 0.007 145)" }}>
                <p className="text-xs font-semibold tracking-wider mb-2" style={{ color: "oklch(0.45 0.01 145)" }}>SPESA OFFICINA TOTALE</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>€{(totRicambi + totManodopera).toLocaleString("it-IT")}</p>
                <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>ricambi + manodopera</p>
              </div>
            </div>
            {tipiOrdinati.length > 0 && (
              <div className="px-5 pb-5 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.45 0.01 145)" }}>Ricambi per tipo di intervento</p>
                {tipiOrdinati.map(([tipo, costo]) => (
                  <div key={tipo} className="flex items-center gap-3">
                    <span className="text-xs capitalize w-28 shrink-0" style={{ color: "oklch(0.6 0.01 145)" }}>{tipo}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.007 145)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(costo / maxTipo) * 100}%`, background: BLUE }} />
                    </div>
                    <span className="text-xs font-medium w-20 text-right shrink-0" style={{ color: GOLD }}>€{costo.toLocaleString("it-IT")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── SHEET: NUOVA MACCHINA ───────────────────────────────────────────── */}
      <Sheet open={openMacchina} onOpenChange={setOpenMacchina}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}15` }}>
                <Tractor size={15} style={{ color: GREEN }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuova macchina</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Nome *</label>
              <Input value={formM.nome} onChange={e => setFormM(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Marca</label>
                <Input value={formM.marca} onChange={e => setFormM(f => ({ ...f, marca: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Modello</label>
                <Input value={formM.modello} onChange={e => setFormM(f => ({ ...f, modello: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Anno</label>
                <Input type="number" value={formM.anno} onChange={e => setFormM(f => ({ ...f, anno: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Targa</label>
                <Input value={formM.targa} onChange={e => setFormM(f => ({ ...f, targa: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Ore totali</label>
              <Input type="number" value={formM.oreTotali} onChange={e => setFormM(f => ({ ...f, oreTotali: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Stato</label>
              <select value={formM.stato} onChange={e => setFormM(f => ({ ...f, stato: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="operativo">Operativo</option>
                <option value="manutenzione">In manutenzione</option>
                <option value="fermo">Fermo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={formM.note} onChange={e => setFormM(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formM.nome) { toast.error("Nome obbligatorio"); return; } createM.mutate({ nome: formM.nome, marca: formM.marca, modello: formM.modello, targa: formM.targa, stato: formM.stato, note: formM.note, anno: formM.anno ? Number(formM.anno) : undefined, oreTotali: formM.oreTotali ? Number(formM.oreTotali) : undefined }); }}
              disabled={createM.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createM.isPending ? "Salvataggio..." : "Salva macchina"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: NUOVO INTERVENTO ─────────────────────────────────────────── */}
      <Sheet open={openIntervento} onOpenChange={setOpenIntervento}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}15` }}>
                <Wrench size={15} style={{ color: GOLD }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>
                Intervento — {selectedData?.nome}
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo *</label>
              <div className="flex gap-2">
                {(["manutenzione","riparazione","revisione"] as const).map(t => (
                  <button key={t} onClick={() => setFormI(f => ({ ...f, tipo: t }))}
                    className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                    style={{
                      background: formI.tipo === t ? `${GREEN}18` : "oklch(0.14 0.007 145)",
                      color: formI.tipo === t ? GREEN : "oklch(0.5 0.01 145)",
                      border: `1px solid ${formI.tipo === t ? GREEN + "40" : "transparent"}`,
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Descrizione</label>
              <Input value={formI.descrizione} onChange={e => setFormI(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Data *</label>
              <Input type="date" value={formI.data} onChange={e => setFormI(f => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Costo manodopera (€)</label>
                <Input type="number" step="0.01" value={formI.costoManodopera} onChange={e => setFormI(f => ({ ...f, costoManodopera: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Costo ricambi (€)</label>
                <Input type="number" step="0.01" value={formI.costoRicambi} onChange={e => setFormI(f => ({ ...f, costoRicambi: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Operatore</label>
              <Input value={formI.operatore} onChange={e => setFormI(f => ({ ...f, operatore: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Stato</label>
              <select value={formI.stato} onChange={e => setFormI(f => ({ ...f, stato: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="pianificato">Pianificato</option>
                <option value="in_corso">In corso</option>
                <option value="completato">Completato</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={formI.note} onChange={e => setFormI(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formI.data || !selectedMacchina) { toast.error("Data obbligatoria"); return; } createI.mutate({ macchinaId: selectedMacchina, tipo: formI.tipo, descrizione: formI.descrizione, data: formI.data, priorita: formI.priorita, stato: formI.stato, operatore: formI.operatore, note: formI.note, costoManodopera: formI.costoManodopera ? Number(formI.costoManodopera) : undefined, costoRicambi: formI.costoRicambi ? Number(formI.costoRicambi) : undefined }); }}
              disabled={createI.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createI.isPending ? "Salvataggio..." : "Salva intervento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
