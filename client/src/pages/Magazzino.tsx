import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package, Plus, Trash2, ArrowDownLeft, ArrowUpRight,
  AlertTriangle, Search, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD  = "oklch(0.72 0.15 75)";
const RED   = "oklch(0.55 0.22 25)";
const BLUE  = "oklch(0.6 0.15 220)";

const CATEGORIE = ["Sementi","Fertilizzanti","Fitofarmaci","Carburanti","Lubrificanti","Pezzi di ricambio","Imballaggi","Prodotti finiti","Altro"];

const EMPTY_PROD = { nome: "", categoria: "", unitaMisura: "kg", quantita: "", quantitaMinima: "", prezzoUnitario: "", note: "" };
const EMPTY_MOV  = { tipo: "carico" as "carico"|"scarico", quantita: "", note: "", data: new Date().toISOString().split("T")[0] };

export default function Magazzino() {
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [openProd, setOpenProd] = useState(false);
  const [openMov, setOpenMov]   = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formProd, setFormProd] = useState({ ...EMPTY_PROD });
  const [formMov, setFormMov]   = useState({ ...EMPTY_MOV });

  const { data: prodotti = [], refetch } = trpc.magazzino.list.useQuery();
  const { data: movimenti = [], refetch: refetchMov } = trpc.magazzino.movimenti.useQuery();

  const createProd = trpc.magazzino.create.useMutation({
    onSuccess: () => { refetch(); setOpenProd(false); setFormProd({ ...EMPTY_PROD }); toast.success("Prodotto aggiunto"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteProd = trpc.magazzino.delete.useMutation({
    onSuccess: () => { refetch(); setSelectedId(null); toast.success("Prodotto eliminato"); },
  });
  const createMov = trpc.magazzino.movimento.useMutation({
    onSuccess: () => { refetch(); refetchMov(); setOpenMov(false); setFormMov({ ...EMPTY_MOV }); toast.success("Movimento registrato"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });

  const prodList = prodotti as any[];
  const movList  = movimenti as any[];

  const filtered = prodList.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) &&
    (!catFilter || p.categoria === catFilter)
  );

  const sottoScorta = prodList.filter(p => p.quantitaMinima && Number(p.quantita) <= Number(p.quantitaMinima)).length;
  const categorie = Array.from(new Set(prodList.map(p => p.categoria).filter(Boolean)));
  const selectedProd = prodList.find(p => p.id === selectedId);

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Magazzino
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            Gestione scorte, movimenti e inventario
          </p>
        </div>
        <Button onClick={() => { setFormProd({ ...EMPTY_PROD }); setOpenProd(true); }}
          className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
          <Plus size={15} /> Nuovo prodotto
        </Button>
      </div>

      {/* ── KPI ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "PRODOTTI",     value: String(prodList.length), color: GREEN, icon: Package },
          { label: "SOTTO SCORTA", value: String(sottoScorta),   color: sottoScorta > 0 ? RED : GREEN, icon: AlertTriangle },
          { label: "CATEGORIE",    value: String(categorie.length), color: GOLD, icon: BarChart3 },
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

      {/* ── ALERT ──────────────────────────────────────────────────────────── */}
      {sottoScorta > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "oklch(0.55 0.22 25 / 0.07)", border: "1px solid oklch(0.55 0.22 25 / 0.25)" }}>
          <AlertTriangle size={14} style={{ color: RED, flexShrink: 0 }} />
          <span className="text-xs" style={{ color: "oklch(0.7 0.01 145)" }}>
            <span style={{ color: RED, fontWeight: 700 }}>{sottoScorta}</span> prodotti sotto la scorta minima
          </span>
        </div>
      )}

      {/* ── FILTRI ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.01 145)" }} />
          <Input placeholder="Cerca prodotto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-input border-border text-sm" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.75 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
          <option value="">Tutte le categorie</option>
          {categorie.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
        </select>
      </div>

      {/* ── MAIN LAYOUT ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Tabella prodotti */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <Package size={13} style={{ color: GOLD }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Inventario</span>
            <Badge className="ml-auto text-xs px-2 py-0.5" style={{ background: `${GOLD}15`, color: GOLD, border: "none" }}>{filtered.length}</Badge>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Package size={32} className="opacity-10" style={{ color: GOLD }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessun prodotto</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Prodotto</TableHead>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Categoria</TableHead>
                  <TableHead className="text-xs text-right" style={{ color: "oklch(0.45 0.01 145)" }}>Quantità</TableHead>
                  <TableHead className="text-xs text-right" style={{ color: "oklch(0.45 0.01 145)" }}>Scorta min.</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => {
                  const isSotto = p.quantitaMinima && Number(p.quantita) <= Number(p.quantitaMinima);
                  const isSel   = selectedId === p.id;
                  return (
                    <TableRow key={p.id} className="group cursor-pointer"
                      onClick={() => setSelectedId(isSel ? null : p.id)}
                      style={{ borderColor: "oklch(0.16 0.007 145)", background: isSel ? `${GREEN}08` : "transparent" }}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: isSotto ? `${RED}15` : `${GREEN}15` }}>
                            <Package size={12} style={{ color: isSotto ? RED : GREEN }} />
                          </div>
                          <div>
                            <span className="text-sm font-medium" style={{ color: "oklch(0.88 0.005 145)" }}>{p.nome}</span>
                            {isSotto && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <AlertTriangle size={9} style={{ color: RED }} />
                                <span className="text-xs" style={{ color: RED }}>Sotto scorta</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs" style={{ color: "oklch(0.6 0.01 145)" }}>{p.categoria ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold" style={{ color: isSotto ? RED : "oklch(0.88 0.005 145)" }}>
                          {Number(p.quantita).toFixed(1)} {p.unitaMisura}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                          {p.quantitaMinima ? `${Number(p.quantitaMinima).toFixed(1)} ${p.unitaMisura}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); setSelectedId(p.id); setFormMov({ ...EMPTY_MOV }); setOpenMov(true); }}
                            className="p-1.5 rounded" style={{ color: BLUE }}>
                            <ArrowDownLeft size={12} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteProd.mutate({ id: p.id }); }}
                            className="p-1.5 rounded" style={{ color: RED }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Movimenti */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <BarChart3 size={13} style={{ color: BLUE }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BLUE }}>
              {selectedProd ? `Movimenti — ${selectedProd.nome}` : "Movimenti"}
            </span>
          </div>

          {!selectedProd ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2">
              <Package size={28} className="opacity-10" style={{ color: BLUE }} />
              <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Seleziona un prodotto</p>
            </div>
          ) : movList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <BarChart3 size={28} className="opacity-10" style={{ color: BLUE }} />
              <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun movimento</p>
              <Button size="sm" onClick={() => { setFormMov({ ...EMPTY_MOV }); setOpenMov(true); }}
                style={{ background: `${BLUE}15`, color: BLUE, border: `1px solid ${BLUE}30` }}>
                <Plus size={12} className="mr-1" /> Registra
              </Button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
              {movList.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: m.tipo === "carico" ? `${GREEN}15` : `${RED}15` }}>
                    {m.tipo === "carico"
                      ? <ArrowDownLeft size={12} style={{ color: GREEN }} />
                      : <ArrowUpRight  size={12} style={{ color: RED }}   />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold capitalize" style={{ color: m.tipo === "carico" ? GREEN : RED }}>{m.tipo}</span>
                    {m.note && <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>{m.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold" style={{ color: m.tipo === "carico" ? GREEN : RED }}>
                      {m.tipo === "carico" ? "+" : "-"}{Number(m.quantita).toFixed(1)}
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                      {new Date(m.data).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SHEET: NUOVO PRODOTTO ───────────────────────────────────────────── */}
      <Sheet open={openProd} onOpenChange={setOpenProd}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}15` }}>
                <Package size={15} style={{ color: GOLD }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuovo prodotto</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Nome *</label>
              <Input value={formProd.nome} onChange={e => setFormProd(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Categoria</label>
              <select value={formProd.categoria} onChange={e => setFormProd(f => ({ ...f, categoria: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="">Seleziona categoria</option>
                {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Quantità *</label>
                <Input type="number" step="0.01" value={formProd.quantita} onChange={e => setFormProd(f => ({ ...f, quantita: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Unità</label>
                <select value={formProd.unitaMisura} onChange={e => setFormProd(f => ({ ...f, unitaMisura: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm"
                  style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                  {["kg","q","t","L","pz","m","m²","m³"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Scorta minima</label>
              <Input type="number" step="0.01" value={formProd.quantitaMinima} onChange={e => setFormProd(f => ({ ...f, quantitaMinima: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Prezzo unitario (€)</label>
              <Input type="number" step="0.01" value={formProd.prezzoUnitario} onChange={e => setFormProd(f => ({ ...f, prezzoUnitario: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={formProd.note} onChange={e => setFormProd(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formProd.nome || !formProd.quantita) { toast.error("Nome e quantità obbligatori"); return; } createProd.mutate(formProd); }}
              disabled={createProd.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createProd.isPending ? "Salvataggio..." : "Salva prodotto"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── SHEET: MOVIMENTO ────────────────────────────────────────────────── */}
      <Sheet open={openMov} onOpenChange={setOpenMov}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${BLUE}15` }}>
                <ArrowDownLeft size={15} style={{ color: BLUE }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>
                Movimento — {selectedProd?.nome}
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo</label>
              <div className="flex gap-2">
                {(["carico","scarico"] as const).map(t => (
                  <button key={t} onClick={() => setFormMov(f => ({ ...f, tipo: t }))}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: formMov.tipo === t ? (t === "carico" ? `${GREEN}18` : `${RED}18`) : "oklch(0.14 0.007 145)",
                      color: formMov.tipo === t ? (t === "carico" ? GREEN : RED) : "oklch(0.5 0.01 145)",
                      border: `1px solid ${formMov.tipo === t ? (t === "carico" ? GREEN : RED) + "40" : "transparent"}`,
                    }}>
                    {t === "carico" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                    {t === "carico" ? "Carico" : "Scarico"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Quantità *</label>
              <Input type="number" step="0.01" value={formMov.quantita} onChange={e => setFormMov(f => ({ ...f, quantita: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Data *</label>
              <Input type="date" value={formMov.data} onChange={e => setFormMov(f => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={formMov.note} onChange={e => setFormMov(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!formMov.quantita || !selectedId) { toast.error("Quantità obbligatoria"); return; } createMov.mutate({ ...formMov, prodottoId: selectedId }); }}
              disabled={createMov.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createMov.isPending ? "Salvataggio..." : "Registra movimento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
