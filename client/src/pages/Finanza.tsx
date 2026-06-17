import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, ArrowDownRight, ArrowUpRight, TrendingUp, Trash2, Filter,
  Wallet, PiggyBank, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const GREEN = "oklch(0.65 0.18 142)";
const RED   = "oklch(0.55 0.22 25)";
const GOLD  = "oklch(0.72 0.15 75)";
const BLUE  = "oklch(0.6 0.15 220)";
const GREEN_HEX = "#4ade80";
const RED_HEX   = "#f87171";
const GOLD_HEX  = "#d4a843";
const BLUE_HEX  = "#60a5fa";
const PIE_COLORS = [GREEN_HEX, GOLD_HEX, BLUE_HEX, "#a78bfa", RED_HEX, "#34d399"];

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const CATEGORIE_ENTRATE = ["Vendita prodotti","Contributi PAC","Affitti attivi","Servizi conto terzi","Altro"];
const CATEGORIE_USCITE  = ["Carburante","Sementi","Fertilizzanti","Fitofarmaci","Manodopera","Manutenzioni","Affitti passivi","Utenze","Assicurazioni","Altro"];

const EMPTY_FORM = { categoria: "", descrizione: "", importo: "", data: new Date().toISOString().split("T")[0], note: "" };

export default function Finanza() {
  const [tab, setTab]   = useState<"all" | "entrata" | "uscita">("all");
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrata" | "uscita">("entrata");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: transazioni = [], refetch } = trpc.finanza.list.useQuery(
    tab === "all" ? { limit: 100 } : { tipo: tab, limit: 100 }
  );
  const { data: summary }        = trpc.finanza.summary.useQuery();
  const { data: byCategoria = [] } = trpc.finanza.byCategoria.useQuery();

  const createMutation = trpc.finanza.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); setForm({ ...EMPTY_FORM }); toast.success("Transazione aggiunta"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteMutation = trpc.finanza.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Transazione eliminata"); },
  });

  const handleSubmit = () => {
    if (!form.categoria || !form.importo || !form.data) { toast.error("Compila tutti i campi obbligatori"); return; }
    createMutation.mutate({ ...form, tipo });
  };

  const pieData = (byCategoria as any[])
    .filter((r: any) => r.tipo === "uscita")
    .slice(0, 6)
    .map((r: any) => ({ name: r.categoria, value: Number(r.totale) }));

  const utile = (summary?.totEntrate ?? 0) - (summary?.totUscite ?? 0);
  const categorie = tipo === "entrata" ? CATEGORIE_ENTRATE : CATEGORIE_USCITE;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Finanza
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            Entrate, uscite e analisi economica aziendale
          </p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(true); }}
          className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
          <Plus size={15} /> Nuova transazione
        </Button>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "ENTRATE TOTALI", value: fmt(summary?.totEntrate ?? 0), color: GREEN, icon: ArrowDownRight },
          { label: "USCITE TOTALI",  value: fmt(summary?.totUscite  ?? 0), color: RED,   icon: ArrowUpRight  },
          { label: "UTILE NETTO",    value: fmt(utile),                    color: utile >= 0 ? GREEN : RED, icon: TrendingUp },
          { label: "TRANSAZIONI",    value: String((summary?.cntEntrate ?? 0) + (summary?.cntUscite ?? 0)), color: GOLD, icon: Wallet },
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

      {/* ── MAIN LAYOUT: TABLE + PIE ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Tabella transazioni */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            {([["all","Tutte"], ["entrata","Entrate"], ["uscita","Uscite"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === v ? (v === "entrata" ? `${GREEN}15` : v === "uscita" ? `${RED}15` : "oklch(0.16 0.008 145)") : "transparent",
                  color: tab === v ? (v === "entrata" ? GREEN : v === "uscita" ? RED : "oklch(0.85 0.01 145)") : "oklch(0.5 0.01 145)",
                }}>
                {l}
              </button>
            ))}
            <Badge className="ml-auto text-xs px-2 py-0.5" style={{ background: "oklch(0.16 0.008 145)", color: "oklch(0.6 0.01 145)", border: "none" }}>
              {(transazioni as any[]).length}
            </Badge>
          </div>

          {(transazioni as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Wallet size={36} className="opacity-10" style={{ color: GREEN }} />
              <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>Nessuna transazione</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Tipo</TableHead>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Categoria</TableHead>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Descrizione</TableHead>
                  <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Data</TableHead>
                  <TableHead className="text-xs text-right" style={{ color: "oklch(0.45 0.01 145)" }}>Importo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transazioni as any[]).map((t: any) => (
                  <TableRow key={t.id} className="group" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: t.tipo === "entrata" ? `${GREEN}15` : `${RED}15` }}>
                          {t.tipo === "entrata"
                            ? <ArrowDownRight size={11} style={{ color: GREEN }} />
                            : <ArrowUpRight   size={11} style={{ color: RED }}   />}
                        </div>
                        <span className="text-xs font-medium capitalize" style={{ color: t.tipo === "entrata" ? GREEN : RED }}>
                          {t.tipo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium" style={{ color: "oklch(0.75 0.01 145)" }}>{t.categoria}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{t.descrizione ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                        {new Date(t.data).toLocaleDateString("it-IT")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold" style={{ color: t.tipo === "entrata" ? GREEN : RED }}>
                        {t.tipo === "entrata" ? "+" : "-"}{fmt(Number(t.importo))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => deleteMutation.mutate({ id: t.id })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded"
                        style={{ color: "oklch(0.55 0.22 25)" }}>
                        <Trash2 size={12} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pie chart spese */}
        <div className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>
            Distribuzione Uscite
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, color: "oklch(0.85 0.01 145)", fontSize: 11 }}
                    formatter={(v: any) => [fmt(Number(v)), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.slice(0, 5).map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs" style={{ color: "oklch(0.65 0.01 145)" }}>{d.name}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "oklch(0.75 0.01 145)" }}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: "oklch(0.4 0.01 145)" }}>
              <PiggyBank size={28} className="opacity-20" />
              <p className="text-xs">Nessun dato disponibile</p>
            </div>
          )}
        </div>
      </div>

      {/* ── SHEET FORM ─────────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}15` }}>
                <Wallet size={15} style={{ color: GREEN }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>
                Nuova transazione
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Tipo */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo</label>
              <div className="flex gap-2">
                {(["entrata", "uscita"] as const).map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: tipo === t ? (t === "entrata" ? `${GREEN}18` : `${RED}18`) : "oklch(0.14 0.007 145)",
                      color: tipo === t ? (t === "entrata" ? GREEN : RED) : "oklch(0.5 0.01 145)",
                      border: `1px solid ${tipo === t ? (t === "entrata" ? GREEN : RED) + "40" : "transparent"}`,
                    }}>
                    {t === "entrata" ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                    {t === "entrata" ? "Entrata" : "Uscita"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Categoria *</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "oklch(0.14 0.007 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
                <option value="">Seleziona categoria</option>
                {categorie.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Descrizione</label>
              <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Importo (€) *</label>
              <Input type="number" step="0.01" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Data *</label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>

          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full"
              style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createMutation.isPending ? "Salvataggio..." : "Salva transazione"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
