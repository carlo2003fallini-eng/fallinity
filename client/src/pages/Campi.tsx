import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Sprout, MapPin, Ruler, Trash2, ChevronRight,
  Tractor, Calendar, User, DollarSign, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD  = "oklch(0.72 0.15 75)";
const BLUE  = "oklch(0.6 0.15 220)";
const RED   = "oklch(0.55 0.22 25)";

const statoConfig: Record<string, { label: string; color: string; dot: string }> = {
  attivo:         { label: "Attivo",        color: GREEN, dot: "status-dot-green" },
  a_riposo:       { label: "A riposo",      color: GOLD,  dot: "status-dot-amber" },
  in_lavorazione: { label: "In lavorazione",color: BLUE,  dot: "status-dot-green" },
};

const lavStatoConfig: Record<string, { label: string; color: string; icon: any }> = {
  pianificata: { label: "Pianificata", color: GOLD,  icon: Clock },
  in_corso:    { label: "In corso",    color: BLUE,  icon: Tractor },
  completata:  { label: "Completata",  color: GREEN, icon: CheckCircle2 },
};

const COLTURE = ["Mais","Frumento","Orzo","Soia","Erba medica","Prato stabile","Sorgo","Girasole","Barbabietola","Patata","Vite","Olivo","Altro"];

const EMPTY_CAMPO = { nome: "", codice: "", ettari: "", comune: "", provincia: "", coltura: "", stato: "attivo" as "attivo"|"a_riposo"|"in_lavorazione", note: "" };
const EMPTY_LAV   = { tipo: "", descrizione: "", data: new Date().toISOString().split("T")[0], operatore: "", costo: "", stato: "pianificata" as "pianificata"|"in_corso"|"completata", note: "" };

export default function Campi() {
  const [selected, setSelected]     = useState<string | null>(null);
  const [openCampo, setOpenCampo]   = useState(false);
  const [openLav, setOpenLav]       = useState(false);
  const [formCampo, setFormCampo]   = useState({ ...EMPTY_CAMPO });
  const [formLav, setFormLav]       = useState({ ...EMPTY_LAV });

  const { data: campi = [], refetch: refetchCampi } = trpc.campi.list.useQuery();
  const { data: lavorazioni = [], refetch: refetchLav } = trpc.campi.lavorazioni.useQuery(
    { campoId: selected ?? "" },
    { enabled: !!selected }
  );

  const createCampo = trpc.campi.create.useMutation({
    onSuccess: () => { refetchCampi(); setOpenCampo(false); setFormCampo({ ...EMPTY_CAMPO }); toast.success("Campo aggiunto"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteCampo = trpc.campi.delete.useMutation({
    onSuccess: () => { refetchCampi(); setSelected(null); toast.success("Campo eliminato"); },
  });
  const createLav = trpc.campi.addLavorazione.useMutation({
    onSuccess: () => { refetchLav(); setOpenLav(false); setFormLav({ ...EMPTY_LAV }); toast.success("Lavorazione aggiunta"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const campiList   = campi as any[];
  const lavList     = lavorazioni as any[];
  const totalEttari = campiList.reduce((s: number, c: any) => s + Number(c.ettari ?? 0), 0);
  const selectedCampo = campiList.find((c: any) => c.id === selected);

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Campi
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            {campiList.length} appezzamenti · {totalEttari.toFixed(1)} ha totali
          </p>
        </div>
        <Button onClick={() => { setFormCampo({ ...EMPTY_CAMPO }); setOpenCampo(true); }}
          className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
          <Plus size={15} /> Nuovo campo
        </Button>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "TOTALE CAMPI",  value: String(campiList.length),                                                color: GREEN, icon: Sprout },
          { label: "ETTARI TOTALI", value: `${totalEttari.toFixed(1)} ha`,                                         color: GOLD,  icon: Ruler  },
          { label: "IN LAVORAZIONE",value: String(campiList.filter((c: any) => c.stato === "in_lavorazione").length), color: BLUE,  icon: Tractor },
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

      {/* ── MAIN LAYOUT: LIST + DETAIL ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Lista campi */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <Sprout size={13} style={{ color: GREEN }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GREEN }}>Appezzamenti</span>
            <Badge className="ml-auto text-xs px-2 py-0.5" style={{ background: `${GREEN}15`, color: GREEN, border: "none" }}>{campiList.length}</Badge>
          </div>

          {campiList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Sprout size={32} className="opacity-10" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessun campo</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
              {campiList.map((c: any) => {
                const sc = statoConfig[c.stato] ?? statoConfig.attivo;
                const isSelected = selected === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(isSelected ? null : c.id)}
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all group"
                    style={{
                      background: isSelected ? `${GREEN}0a` : "transparent",
                      borderLeft: isSelected ? `2px solid ${GREEN}` : "2px solid transparent",
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${sc.color}15` }}>
                      <Sprout size={16} style={{ color: sc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate" style={{ color: "oklch(0.88 0.005 145)" }}>{c.nome}</span>
                        {c.codice && <span className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>#{c.codice}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{Number(c.ettari).toFixed(1)} ha</span>
                        {c.coltura && <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{c.coltura}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${sc.dot}`} />
                      <ChevronRight size={13} style={{ color: isSelected ? GREEN : "oklch(0.35 0.01 145)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dettaglio campo */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          {!selectedCampo ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
              <Sprout size={40} className="opacity-10" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Seleziona un campo per vedere i dettagli</p>
            </div>
          ) : (
            <>
              {/* Campo header */}
              <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.92 0.005 145)" }}>
                        {selectedCampo.nome}
                      </h2>
                      <Badge style={{ background: `${statoConfig[selectedCampo.stato]?.color ?? GREEN}15`, color: statoConfig[selectedCampo.stato]?.color ?? GREEN, border: "none", fontSize: 10 }}>
                        {statoConfig[selectedCampo.stato]?.label ?? selectedCampo.stato}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                      <span className="flex items-center gap-1"><Ruler size={11} />{Number(selectedCampo.ettari).toFixed(2)} ha</span>
                      {selectedCampo.comune && <span className="flex items-center gap-1"><MapPin size={11} />{selectedCampo.comune}{selectedCampo.provincia ? ` (${selectedCampo.provincia})` : ""}</span>}
                      {selectedCampo.coltura && <span className="flex items-center gap-1"><Sprout size={11} />{selectedCampo.coltura}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setFormLav({ ...EMPTY_LAV }); setOpenLav(true); }}
                      className="gap-1.5 text-xs" style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                      <Plus size={12} /> Lavorazione
                    </Button>
                    <button onClick={() => deleteCampo.mutate({ id: selectedCampo.id })}
                      className="p-2 rounded-lg transition-colors" style={{ color: RED }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lavorazioni */}
              <div className="px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>
                  Lavorazioni ({lavList.length})
                </h3>
                {lavList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Tractor size={28} className="opacity-10" style={{ color: GREEN }} />
                    <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna lavorazione registrata</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lavList.map((l: any) => {
                      const lsc = lavStatoConfig[l.stato] ?? lavStatoConfig.pianificata;
                      return (
                        <div key={l.id} className="flex items-center gap-3 px-3 py-3 rounded-xl"
                          style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.16 0.007 145)" }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${lsc.color}15` }}>
                            <lsc.icon size={13} style={{ color: lsc.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: "oklch(0.82 0.005 145)" }}>{l.tipo}</span>
                              <Badge style={{ background: `${lsc.color}15`, color: lsc.color, border: "none", fontSize: 10 }}>{lsc.label}</Badge>
                            </div>
                            {l.descrizione && <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.55 0.01 145)" }}>{l.descrizione}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                              {new Date(l.data).toLocaleDateString("it-IT")}
                            </p>
                            {l.operatore && <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>{l.operatore}</p>}
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

      {/* ── SHEET: NUOVO CAMPO ─────────────────────────────────────────────── */}
      <Sheet open={openCampo} onOpenChange={setOpenCampo}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}15` }}>
                <Sprout size={15} style={{ color: GREEN }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuovo campo</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Nome *</label>
                <Input value={formCampo.nome} onChange={e => setFormCampo(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Codice</label>
                <Input value={formCampo.codice} onChange={e => setFormCampo(f => ({ ...f, codice: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Ettari *</label>
              <Input type="number" step="0.01" value={formCampo.ettari} onChange={e => setFormCampo(f => ({ ...f, ettari: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Comune</label>
                <Input value={formCampo.comune} onChange={e => setFormCampo(f => ({ ...f, comune: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Provincia</label>
                <Input value={formCampo.provincia} onChange={e => setFormCampo(f => ({ ...f, provincia: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Coltura</label>
              <select value={formCampo.coltura} onChange={e => setFormCampo(f => ({ ...f, coltura: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="">Seleziona coltura</option>
                {COLTURE.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Stato</label>
              <select value={formCampo.stato} onChange={e => setFormCampo(f => ({ ...f, stato: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="attivo">Attivo</option>
                <option value="a_riposo">A riposo</option>
                <option value="in_lavorazione">In lavorazione</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={formCampo.note} onChange={e => setFormCampo(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formCampo.nome || !formCampo.ettari) { toast.error("Nome e ettari obbligatori"); return; } createCampo.mutate({ ...formCampo, ettari: Number(formCampo.ettari) }); }}
              disabled={createCampo.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createCampo.isPending ? "Salvataggio..." : "Salva campo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: NUOVA LAVORAZIONE ────────────────────────────────────────── */}
      <Sheet open={openLav} onOpenChange={setOpenLav}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${BLUE}15` }}>
                <Tractor size={15} style={{ color: BLUE }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>
                Nuova lavorazione — {selectedCampo?.nome}
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo lavorazione *</label>
              <Input value={formLav.tipo} onChange={e => setFormLav(f => ({ ...f, tipo: e.target.value }))} placeholder="Es. Aratura, Semina, Raccolta..." className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Descrizione</label>
              <Input value={formLav.descrizione} onChange={e => setFormLav(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Data *</label>
              <Input type="date" value={formLav.data} onChange={e => setFormLav(f => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Operatore</label>
              <Input value={formLav.operatore} onChange={e => setFormLav(f => ({ ...f, operatore: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Costo (€)</label>
              <Input type="number" step="0.01" value={formLav.costo} onChange={e => setFormLav(f => ({ ...f, costo: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Stato</label>
              <select value={formLav.stato} onChange={e => setFormLav(f => ({ ...f, stato: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="pianificata">Pianificata</option>
                <option value="in_corso">In corso</option>
                <option value="completata">Completata</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formLav.tipo || !formLav.data || !selected) { toast.error("Tipo e data obbligatori"); return; } createLav.mutate({ campoId: selected, tipo: formLav.tipo, descrizione: formLav.descrizione, data: formLav.data, operatore: formLav.operatore, costo: formLav.costo ? Number(formLav.costo) : undefined }); }}
              disabled={createLav.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createLav.isPending ? "Salvataggio..." : "Salva lavorazione"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
