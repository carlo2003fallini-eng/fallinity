import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Sprout, MapPin, Ruler, Trash2, ChevronRight, Tractor } from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const BLUE = "oklch(0.6 0.15 220)";

const statoConfig: Record<string, { label: string; color: string }> = {
  attivo: { label: "Attivo", color: GREEN },
  a_riposo: { label: "A riposo", color: GOLD },
  in_lavorazione: { label: "In lavorazione", color: BLUE },
};

const COLTURE = ["Mais","Frumento","Orzo","Soia","Erba medica","Prato stabile","Sorgo","Girasole","Barbabietola","Patata","Vite","Olivo","Altro"];

export default function Campi() {
  const [selected, setSelected] = useState<number | null>(null);
  const [openCampo, setOpenCampo] = useState(false);
  const [openLav, setOpenLav] = useState(false);
  const [formCampo, setFormCampo] = useState({ nome: "", codice: "", ettari: "", comune: "", provincia: "", coltura: "", stato: "attivo" as "attivo"|"a_riposo"|"in_lavorazione", note: "" });
  const [formLav, setFormLav] = useState({ tipo: "", descrizione: "", data: new Date().toISOString().split("T")[0], operatore: "", costo: "", stato: "pianificata" as "pianificata"|"in_corso"|"completata", note: "" });

  const { data: campi = [], refetch: refetchCampi } = trpc.campi.list.useQuery();
  const { data: lavorazioni = [], refetch: refetchLav } = trpc.campi.lavorazioni.list.useQuery(
    selected ? { campoId: selected } : {}
  );

  const createCampo = trpc.campi.create.useMutation({
    onSuccess: () => { refetchCampi(); setOpenCampo(false); toast.success("Campo aggiunto"); setFormCampo({ nome: "", codice: "", ettari: "", comune: "", provincia: "", coltura: "", stato: "attivo", note: "" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteCampo = trpc.campi.delete.useMutation({
    onSuccess: () => { refetchCampi(); setSelected(null); toast.success("Campo eliminato"); },
  });
  const createLav = trpc.campi.lavorazioni.create.useMutation({
    onSuccess: () => { refetchLav(); setOpenLav(false); toast.success("Lavorazione aggiunta"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const totalEttari = (campi as any[]).reduce((s: number, c: any) => s + Number(c.ettari ?? 0), 0);
  const selectedCampo = (campi as any[]).find((c: any) => c.id === selected);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>Campi</h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>
            {(campi as any[]).length} appezzamenti · {totalEttari.toFixed(1)} ha totali
          </p>
        </div>
        <Dialog open={openCampo} onOpenChange={setOpenCampo}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              <Plus size={16} /> Nuovo campo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
            <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo campo</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome *" value={formCampo.nome} onChange={e => setFormCampo(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Codice" value={formCampo.codice} onChange={e => setFormCampo(f => ({ ...f, codice: e.target.value }))} className="bg-input border-border" />
              </div>
              <Input placeholder="Ettari *" type="number" step="0.01" value={formCampo.ettari} onChange={e => setFormCampo(f => ({ ...f, ettari: e.target.value }))} className="bg-input border-border" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Comune" value={formCampo.comune} onChange={e => setFormCampo(f => ({ ...f, comune: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Provincia" value={formCampo.provincia} onChange={e => setFormCampo(f => ({ ...f, provincia: e.target.value }))} className="bg-input border-border" />
              </div>
              <select value={formCampo.coltura} onChange={e => setFormCampo(f => ({ ...f, coltura: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="">Coltura in corso</option>
                {COLTURE.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={formCampo.stato} onChange={e => setFormCampo(f => ({ ...f, stato: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="attivo">Attivo</option>
                <option value="a_riposo">A riposo</option>
                <option value="in_lavorazione">In lavorazione</option>
              </select>
              <Button onClick={() => { if (!formCampo.nome || !formCampo.ettari) { toast.error("Nome ed ettari obbligatori"); return; } createCampo.mutate(formCampo as any); }} disabled={createCampo.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                {createCampo.isPending ? "Salvataggio..." : "Salva campo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista campi */}
        <div className="lg:col-span-1 space-y-2">
          {(campi as any[]).length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <Sprout size={32} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessun campo registrato</p>
            </div>
          ) : (
            (campi as any[]).map((c: any) => {
              const cfg = statoConfig[c.stato] ?? statoConfig.attivo;
              return (
                <button key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)} className="w-full text-left rounded-xl p-4 transition-all"
                  style={{ background: selected === c.id ? "oklch(0.13 0.007 145)" : "oklch(0.11 0.006 145)", border: `1px solid ${selected === c.id ? GREEN + "40" : "oklch(0.18 0.008 145)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
                        <Sprout size={16} style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 145)" }}>{c.nome}</p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>{c.ettari} ha{c.coltura ? ` · ${c.coltura}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                      <ChevronRight size={14} style={{ color: "oklch(0.4 0.01 145)" }} />
                    </div>
                  </div>
                  {c.comune && (
                    <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                      <MapPin size={11} />{c.comune}{c.provincia ? ` (${c.provincia})` : ""}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Dettaglio campo */}
        <div className="lg:col-span-2">
          {!selectedCampo ? (
            <div className="rounded-xl p-12 text-center h-full flex flex-col items-center justify-center" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <Sprout size={40} className="mb-3 opacity-20" style={{ color: GREEN }} />
              <p className="text-sm font-medium" style={{ color: "oklch(0.55 0.01 145)" }}>Seleziona un campo per vedere i dettagli</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              {/* Header campo */}
              <div className="p-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>{selectedCampo.nome}</h2>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}><Ruler size={11} />{selectedCampo.ettari} ha</span>
                      {selectedCampo.coltura && <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}><Sprout size={11} />{selectedCampo.coltura}</span>}
                      {selectedCampo.comune && <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}><MapPin size={11} />{selectedCampo.comune}</span>}
                      <Badge style={{ background: `${(statoConfig[selectedCampo.stato] ?? statoConfig.attivo).color}15`, color: (statoConfig[selectedCampo.stato] ?? statoConfig.attivo).color, border: "none", fontSize: 11 }}>
                        {(statoConfig[selectedCampo.stato] ?? statoConfig.attivo).label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={openLav} onOpenChange={setOpenLav}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                          <Plus size={14} /> Lavorazione
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                        <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuova lavorazione</DialogTitle></DialogHeader>
                        <div className="space-y-3 mt-2">
                          <Input placeholder="Tipo lavorazione *" value={formLav.tipo} onChange={e => setFormLav(f => ({ ...f, tipo: e.target.value }))} className="bg-input border-border" />
                          <Input placeholder="Descrizione" value={formLav.descrizione} onChange={e => setFormLav(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border" />
                          <Input type="date" value={formLav.data} onChange={e => setFormLav(f => ({ ...f, data: e.target.value }))} className="bg-input border-border" />
                          <Input placeholder="Operatore" value={formLav.operatore} onChange={e => setFormLav(f => ({ ...f, operatore: e.target.value }))} className="bg-input border-border" />
                          <Input placeholder="Costo (€)" type="number" value={formLav.costo} onChange={e => setFormLav(f => ({ ...f, costo: e.target.value }))} className="bg-input border-border" />
                          <select value={formLav.stato} onChange={e => setFormLav(f => ({ ...f, stato: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                            <option value="pianificata">Pianificata</option>
                            <option value="in_corso">In corso</option>
                            <option value="completata">Completata</option>
                          </select>
                          <Button onClick={() => { if (!formLav.tipo) { toast.error("Tipo obbligatorio"); return; } createLav.mutate({ ...formLav, campoId: selected! }); }} disabled={createLav.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                            {createLav.isPending ? "Salvataggio..." : "Salva lavorazione"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="outline" onClick={() => deleteCampo.mutate({ id: selected! })} className="gap-1.5 border-red-900/40 text-red-400 hover:bg-red-900/20">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lavorazioni */}
              <div className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>Lavorazioni</h3>
                {(lavorazioni as any[]).length === 0 ? (
                  <div className="text-center py-8">
                    <Tractor size={28} className="mx-auto mb-2 opacity-20" style={{ color: GOLD }} />
                    <p className="text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna lavorazione registrata</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(lavorazioni as any[]).map((l: any) => {
                      const sc = l.stato === "completata" ? GREEN : l.stato === "in_corso" ? BLUE : GOLD;
                      return (
                        <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.09 0.005 145)" }}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sc }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 145)" }}>{l.tipo}</p>
                            <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                              {new Date(l.data).toLocaleDateString("it-IT")}
                              {l.operatore ? ` · ${l.operatore}` : ""}
                              {l.costo ? ` · €${Number(l.costo).toLocaleString("it-IT")}` : ""}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${sc}15`, color: sc }}>
                            {l.stato.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
