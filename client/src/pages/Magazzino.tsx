import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, ArrowUp, ArrowDown, AlertTriangle, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";

const CATEGORIE = ["Sementi","Fertilizzanti","Fitofarmaci","Carburante","Lubrificanti","Ricambi","Attrezzature","Mangimi","Altro"];

export default function Magazzino() {
  const [search, setSearch] = useState("");
  const [openProdotto, setOpenProdotto] = useState(false);
  const [openMovimento, setOpenMovimento] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formP, setFormP] = useState({ nome: "", codice: "", categoria: "", unitaMisura: "pz", quantita: "0", quantitaMinima: "", prezzoUnitario: "", note: "" });
  const [formM, setFormM] = useState({ tipo: "carico" as "carico"|"scarico", quantita: "", data: new Date().toISOString().split("T")[0], descrizione: "", operatore: "" });

  const { data: prodotti = [], refetch } = trpc.magazzino.list.useQuery();
  const { data: movimenti = [] } = trpc.magazzino.movimenti.useQuery();

  const createP = trpc.magazzino.create.useMutation({
    onSuccess: () => { refetch(); setOpenProdotto(false); toast.success("Prodotto aggiunto"); setFormP({ nome: "", codice: "", categoria: "", unitaMisura: "pz", quantita: "0", quantitaMinima: "", prezzoUnitario: "", note: "" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteP = trpc.magazzino.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Prodotto eliminato"); },
  });
  const createM = trpc.magazzino.movimento.useMutation({
    onSuccess: () => { refetch(); setOpenMovimento(false); toast.success("Movimento registrato"); setFormM({ tipo: "carico", quantita: "", data: new Date().toISOString().split("T")[0], descrizione: "", operatore: "" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const filtered = (prodotti as any[]).filter((p: any) =>
    `${p.nome} ${p.codice ?? ""} ${p.categoria ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const sottoScorta = (prodotti as any[]).filter((p: any) => Number(p.quantitaMinima) > 0 && Number(p.quantita) <= Number(p.quantitaMinima));
  const valTotale = (prodotti as any[]).reduce((s: number, p: any) => s + Number(p.quantita) * Number(p.prezzoUnitario ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>Magazzino</h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>Gestione scorte, movimenti e prodotti</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openMovimento} onOpenChange={setOpenMovimento}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-border">
                <ArrowUp size={16} /> Movimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
              <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo movimento</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="flex gap-2">
                  {(["carico","scarico"] as const).map(t => (
                    <button key={t} onClick={() => setFormM(f => ({ ...f, tipo: t }))} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{ background: formM.tipo === t ? (t === "carico" ? `${GREEN}20` : `${RED}20`) : "oklch(0.15 0.006 145)", color: formM.tipo === t ? (t === "carico" ? GREEN : RED) : "oklch(0.55 0.01 145)", border: `1px solid ${formM.tipo === t ? (t === "carico" ? GREEN : RED) + "40" : "transparent"}` }}>
                      {t === "carico" ? "Carico" : "Scarico"}
                    </button>
                  ))}
                </div>
                <select value={selectedId ?? ""} onChange={e => setSelectedId(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                  <option value="">Seleziona prodotto *</option>
                  {(prodotti as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <Input placeholder="Quantità *" type="number" value={formM.quantita} onChange={e => setFormM(f => ({ ...f, quantita: e.target.value }))} className="bg-input border-border" />
                <Input type="date" value={formM.data} onChange={e => setFormM(f => ({ ...f, data: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Descrizione" value={formM.descrizione} onChange={e => setFormM(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Operatore" value={formM.operatore} onChange={e => setFormM(f => ({ ...f, operatore: e.target.value }))} className="bg-input border-border" />
                <Button onClick={() => { if (!selectedId || !formM.quantita) { toast.error("Prodotto e quantità obbligatori"); return; } createM.mutate({ ...formM, prodottoId: selectedId }); }} disabled={createM.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                  {createM.isPending ? "Salvataggio..." : "Registra movimento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openProdotto} onOpenChange={setOpenProdotto}>
            <DialogTrigger asChild>
              <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                <Plus size={16} /> Nuovo prodotto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
              <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo prodotto</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nome *" value={formP.nome} onChange={e => setFormP(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border" />
                  <Input placeholder="Codice" value={formP.codice} onChange={e => setFormP(f => ({ ...f, codice: e.target.value }))} className="bg-input border-border" />
                </div>
                <select value={formP.categoria} onChange={e => setFormP(f => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                  <option value="">Categoria</option>
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="U.M. (pz, kg, l...)" value={formP.unitaMisura} onChange={e => setFormP(f => ({ ...f, unitaMisura: e.target.value }))} className="bg-input border-border" />
                  <Input placeholder="Qtà iniziale" type="number" value={formP.quantita} onChange={e => setFormP(f => ({ ...f, quantita: e.target.value }))} className="bg-input border-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Qtà minima" type="number" value={formP.quantitaMinima} onChange={e => setFormP(f => ({ ...f, quantitaMinima: e.target.value }))} className="bg-input border-border" />
                  <Input placeholder="Prezzo unitario (€)" type="number" value={formP.prezzoUnitario} onChange={e => setFormP(f => ({ ...f, prezzoUnitario: e.target.value }))} className="bg-input border-border" />
                </div>
                <Button onClick={() => { if (!formP.nome) { toast.error("Nome obbligatorio"); return; } createP.mutate(formP as any); }} disabled={createP.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                  {createP.isPending ? "Salvataggio..." : "Salva prodotto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "PRODOTTI", value: String((prodotti as any[]).length), color: GREEN, icon: Package },
          { label: "SOTTO SCORTA", value: String(sottoScorta.length), color: sottoScorta.length > 0 ? RED : GREEN, icon: AlertTriangle },
          { label: "MOVIMENTI", value: String((movimenti as any[]).length), color: BLUE, icon: ArrowUp },
          { label: "VALORE TOTALE", value: `€${valTotale.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`, color: GOLD, icon: Package },
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

      {/* Alert sotto scorta */}
      {sottoScorta.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "oklch(0.55 0.22 25 / 0.08)", border: "1px solid oklch(0.55 0.22 25 / 0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: RED }} />
            <span className="text-sm font-semibold" style={{ color: RED }}>Prodotti sotto scorta minima</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sottoScorta.map((p: any) => (
              <span key={p.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: `${RED}15`, color: RED }}>
                {p.nome} ({p.quantita} {p.unitaMisura})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ricerca + Lista */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.01 145)" }} />
        <Input placeholder="Cerca prodotti..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-input border-border" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prodotti */}
        <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>PRODOTTI IN MAGAZZINO</h3>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun prodotto</div>
          ) : (
            <div className="divide-y divide-[oklch(0.15_0.006_145)]">
              {filtered.map((p: any) => {
                const sottoMin = Number(p.quantitaMinima) > 0 && Number(p.quantita) <= Number(p.quantitaMinima);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-white/[0.02] transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: sottoMin ? `${RED}15` : `${GREEN}15` }}>
                      <Package size={14} style={{ color: sottoMin ? RED : GREEN }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{p.nome}</p>
                        {sottoMin && <AlertTriangle size={12} style={{ color: RED, flexShrink: 0 }} />}
                      </div>
                      <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                        {p.categoria ?? "—"}{p.codice ? ` · ${p.codice}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold" style={{ color: sottoMin ? RED : GREEN }}>
                        {p.quantita} {p.unitaMisura}
                      </p>
                      {p.prezzoUnitario && (
                        <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                          €{Number(p.prezzoUnitario).toLocaleString("it-IT")} / {p.unitaMisura}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteP.mutate({ id: p.id })} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{ color: RED }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Movimenti recenti */}
        <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>MOVIMENTI RECENTI</h3>
          </div>
          {(movimenti as any[]).length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun movimento registrato</div>
          ) : (
            <div className="divide-y divide-[oklch(0.15_0.006_145)]">
              {(movimenti as any[]).slice(0, 15).map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.tipo === "carico" ? `${GREEN}15` : `${RED}15` }}>
                    {m.tipo === "carico" ? <ArrowDown size={13} style={{ color: GREEN }} /> : <ArrowUp size={13} style={{ color: RED }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "oklch(0.75 0.01 145)" }}>
                      {m.descrizione || (m.tipo === "carico" ? "Carico" : "Scarico")}
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>
                      {new Date(m.createdAt).toLocaleDateString("it-IT")}
                      {m.operatore ? ` · ${m.operatore}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: m.tipo === "carico" ? GREEN : RED }}>
                    {m.tipo === "carico" ? "+" : "-"}{m.quantita}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
