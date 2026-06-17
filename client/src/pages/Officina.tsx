import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Tractor, Wrench, AlertTriangle, CheckCircle2, Clock, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";

const statoMacchina: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativo", color: GREEN },
  manutenzione: { label: "Manutenzione", color: GOLD },
  fermo: { label: "Fermo", color: RED },
};
const prioritaConfig: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: RED },
  media: { label: "Media", color: GOLD },
  bassa: { label: "Bassa", color: GREEN },
};
const statoIntervento: Record<string, { label: string; color: string; icon: any }> = {
  pianificato: { label: "Pianificato", color: GOLD, icon: Clock },
  in_corso: { label: "In corso", color: BLUE, icon: Wrench },
  completato: { label: "Completato", color: GREEN, icon: CheckCircle2 },
};

export default function Officina() {
  const [selectedMacchina, setSelectedMacchina] = useState<number | null>(null);
  const [openMacchina, setOpenMacchina] = useState(false);
  const [openIntervento, setOpenIntervento] = useState(false);
  const [formM, setFormM] = useState({ nome: "", marca: "", modello: "", targa: "", telaio: "", anno: "", oreTotali: "", stato: "operativo" as "operativo"|"manutenzione"|"fermo", note: "" });
  const [formI, setFormI] = useState({ tipo: "manutenzione" as "manutenzione"|"riparazione"|"revisione", descrizione: "", data: new Date().toISOString().split("T")[0], priorita: "media" as "alta"|"media"|"bassa", stato: "pianificato" as "pianificato"|"in_corso"|"completato", costoManodopera: "", costoRicambi: "", operatore: "", note: "" });

  const { data: macchine = [], refetch: refetchM } = trpc.officina.macchine.list.useQuery();
  const { data: interventi = [], refetch: refetchI } = trpc.officina.interventi.list.useQuery(
    selectedMacchina ? { macchinaId: selectedMacchina } : {}
  );
  const { data: tuttiInterventi = [] } = trpc.officina.interventi.list.useQuery({});

  const createM = trpc.officina.macchine.create.useMutation({
    onSuccess: () => { refetchM(); setOpenMacchina(false); toast.success("Macchina aggiunta"); setFormM({ nome: "", marca: "", modello: "", targa: "", telaio: "", anno: "", oreTotali: "", stato: "operativo", note: "" }); },
    onError: () => toast.error("Errore"),
  });
  const deleteM = trpc.officina.macchine.delete.useMutation({
    onSuccess: () => { refetchM(); setSelectedMacchina(null); toast.success("Macchina eliminata"); },
  });
  const createI = trpc.officina.interventi.create.useMutation({
    onSuccess: () => { refetchI(); setOpenIntervento(false); toast.success("Intervento aggiunto"); },
    onError: () => toast.error("Errore"),
  });
  const updateStato = trpc.officina.interventi.updateStato.useMutation({
    onSuccess: () => { refetchI(); toast.success("Stato aggiornato"); },
  });

  const ferme = (macchine as any[]).filter((m: any) => m.stato === "fermo").length;
  const manutenzione = (macchine as any[]).filter((m: any) => m.stato === "manutenzione").length;
  const aperti = (tuttiInterventi as any[]).filter((i: any) => i.stato !== "completato").length;
  const selectedMacchinaData = (macchine as any[]).find((m: any) => m.id === selectedMacchina);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>Officina</h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>Macchine, manutenzioni e interventi</p>
        </div>
        <Dialog open={openMacchina} onOpenChange={setOpenMacchina}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              <Plus size={16} /> Nuova macchina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
            <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuova macchina</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Nome *" value={formM.nome} onChange={e => setFormM(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Marca" value={formM.marca} onChange={e => setFormM(f => ({ ...f, marca: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Modello" value={formM.modello} onChange={e => setFormM(f => ({ ...f, modello: e.target.value }))} className="bg-input border-border" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Targa" value={formM.targa} onChange={e => setFormM(f => ({ ...f, targa: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Anno" type="number" value={formM.anno} onChange={e => setFormM(f => ({ ...f, anno: e.target.value }))} className="bg-input border-border" />
              </div>
              <Input placeholder="Ore totali" type="number" value={formM.oreTotali} onChange={e => setFormM(f => ({ ...f, oreTotali: e.target.value }))} className="bg-input border-border" />
              <select value={formM.stato} onChange={e => setFormM(f => ({ ...f, stato: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="operativo">Operativo</option>
                <option value="manutenzione">In manutenzione</option>
                <option value="fermo">Fermo</option>
              </select>
              <Button onClick={() => { if (!formM.nome) { toast.error("Nome obbligatorio"); return; } createM.mutate({ ...formM, anno: formM.anno ? Number(formM.anno) : undefined }); }} disabled={createM.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                {createM.isPending ? "Salvataggio..." : "Salva macchina"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "MACCHINE", value: String((macchine as any[]).length), color: GREEN, icon: Tractor },
          { label: "FERME", value: String(ferme), color: ferme > 0 ? RED : GREEN, icon: AlertTriangle },
          { label: "IN MANUTENZIONE", value: String(manutenzione), color: manutenzione > 0 ? GOLD : GREEN, icon: Wrench },
          { label: "INTERVENTI APERTI", value: String(aperti), color: aperti > 0 ? GOLD : GREEN, icon: Clock },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "oklch(0.5 0.01 145)" }}>{k.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${k.color}15` }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: k.color, letterSpacing: "-0.03em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista macchine */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "oklch(0.45 0.01 145)" }}>I tuoi mezzi</h3>
          {(macchine as any[]).length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <Tractor size={32} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessuna macchina registrata</p>
            </div>
          ) : (
            (macchine as any[]).map((m: any) => {
              const cfg = statoMacchina[m.stato] ?? statoMacchina.operativo;
              return (
                <button key={m.id} onClick={() => setSelectedMacchina(m.id === selectedMacchina ? null : m.id)} className="w-full text-left rounded-xl p-4 transition-all"
                  style={{ background: selectedMacchina === m.id ? "oklch(0.13 0.007 145)" : "oklch(0.11 0.006 145)", border: `1px solid ${selectedMacchina === m.id ? GREEN + "40" : "oklch(0.18 0.008 145)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
                        <Tractor size={16} style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 145)" }}>{m.nome}</p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                          {m.marca ?? ""}{m.modello ? ` ${m.modello}` : ""}{m.oreTotali ? ` · ${m.oreTotali}h` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                      <ChevronRight size={14} style={{ color: "oklch(0.4 0.01 145)" }} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Dettaglio macchina + interventi */}
        <div className="lg:col-span-2">
          {!selectedMacchinaData ? (
            /* Tutti gli interventi aperti */
            <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>PRIORITÀ DI OGGI</h3>
              </div>
              {(tuttiInterventi as any[]).filter((i: any) => i.stato !== "completato").length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 size={32} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun intervento aperto</p>
                </div>
              ) : (
                <div className="divide-y divide-[oklch(0.15_0.006_145)]">
                  {(tuttiInterventi as any[]).filter((i: any) => i.stato !== "completato").map((i: any) => {
                    const pc = prioritaConfig[i.priorita] ?? prioritaConfig.media;
                    const sc = statoIntervento[i.stato] ?? statoIntervento.pianificato;
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${pc.color}15` }}>
                          <Wrench size={14} style={{ color: pc.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{i.descrizione}</p>
                          <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                            {i.tipo} · {new Date(i.data).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${pc.color}15`, color: pc.color }}>{pc.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${sc.color}15`, color: sc.color }}>{sc.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <div className="p-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>{selectedMacchinaData.nome}</h2>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                      {selectedMacchinaData.marca && <span>{selectedMacchinaData.marca}</span>}
                      {selectedMacchinaData.modello && <span>{selectedMacchinaData.modello}</span>}
                      {selectedMacchinaData.anno && <span>Anno {selectedMacchinaData.anno}</span>}
                      {selectedMacchinaData.oreTotali && <span>{selectedMacchinaData.oreTotali}h totali</span>}
                      {selectedMacchinaData.targa && <span>Targa: {selectedMacchinaData.targa}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={openIntervento} onOpenChange={setOpenIntervento}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                          <Plus size={14} /> Intervento
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                        <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo intervento</DialogTitle></DialogHeader>
                        <div className="space-y-3 mt-2">
                          <div className="flex gap-2">
                            {(["manutenzione","riparazione","revisione"] as const).map(t => (
                              <button key={t} onClick={() => setFormI(f => ({ ...f, tipo: t }))} className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                                style={{ background: formI.tipo === t ? `${GREEN}20` : "oklch(0.15 0.006 145)", color: formI.tipo === t ? GREEN : "oklch(0.55 0.01 145)", border: `1px solid ${formI.tipo === t ? GREEN + "40" : "transparent"}` }}>
                                {t}
                              </button>
                            ))}
                          </div>
                          <Input placeholder="Descrizione *" value={formI.descrizione} onChange={e => setFormI(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border" />
                          <Input type="date" value={formI.data} onChange={e => setFormI(f => ({ ...f, data: e.target.value }))} className="bg-input border-border" />
                          <div className="flex gap-2">
                            {(["alta","media","bassa"] as const).map(p => (
                              <button key={p} onClick={() => setFormI(f => ({ ...f, priorita: p }))} className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                                style={{ background: formI.priorita === p ? `${prioritaConfig[p].color}20` : "oklch(0.15 0.006 145)", color: formI.priorita === p ? prioritaConfig[p].color : "oklch(0.55 0.01 145)", border: `1px solid ${formI.priorita === p ? prioritaConfig[p].color + "40" : "transparent"}` }}>
                                {p}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Costo manodopera (€)" type="number" value={formI.costoManodopera} onChange={e => setFormI(f => ({ ...f, costoManodopera: e.target.value }))} className="bg-input border-border" />
                            <Input placeholder="Costo ricambi (€)" type="number" value={formI.costoRicambi} onChange={e => setFormI(f => ({ ...f, costoRicambi: e.target.value }))} className="bg-input border-border" />
                          </div>
                          <Input placeholder="Operatore" value={formI.operatore} onChange={e => setFormI(f => ({ ...f, operatore: e.target.value }))} className="bg-input border-border" />
                          <Button onClick={() => { if (!formI.descrizione) { toast.error("Descrizione obbligatoria"); return; } createI.mutate({ ...formI, macchinaId: selectedMacchina! }); }} disabled={createI.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                            {createI.isPending ? "Salvataggio..." : "Salva intervento"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="outline" onClick={() => deleteM.mutate({ id: selectedMacchina! })} className="gap-1.5 border-red-900/40 text-red-400 hover:bg-red-900/20">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>Interventi</h3>
                {(interventi as any[]).length === 0 ? (
                  <div className="text-center py-6">
                    <Wrench size={28} className="mx-auto mb-2 opacity-20" style={{ color: GOLD }} />
                    <p className="text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun intervento registrato</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(interventi as any[]).map((i: any) => {
                      const pc = prioritaConfig[i.priorita] ?? prioritaConfig.media;
                      const sc = statoIntervento[i.stato] ?? statoIntervento.pianificato;
                      const costoTot = (Number(i.costoManodopera ?? 0) + Number(i.costoRicambi ?? 0));
                      return (
                        <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.09 0.005 145)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${pc.color}15` }}>
                            <Wrench size={14} style={{ color: pc.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{i.descrizione}</p>
                            <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                              {new Date(i.data).toLocaleDateString("it-IT")}
                              {i.operatore ? ` · ${i.operatore}` : ""}
                              {costoTot > 0 ? ` · €${costoTot.toLocaleString("it-IT")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${pc.color}15`, color: pc.color }}>{pc.label}</span>
                            <button onClick={() => {
                              const next = i.stato === "pianificato" ? "in_corso" : i.stato === "in_corso" ? "completato" : "pianificato";
                              updateStato.mutate({ id: i.id, stato: next as any });
                            }} className="text-xs px-2 py-0.5 rounded-full transition-all hover:opacity-80" style={{ background: `${sc.color}15`, color: sc.color }}>
                              {sc.label}
                            </button>
                          </div>
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
