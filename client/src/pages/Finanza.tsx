import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown, Trash2,
  Wallet, PiggyBank, Percent, ChevronRight, RefreshCw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { FAL_IMAGES } from "@/lib/assets";

const GREEN = "oklch(0.65 0.18 142)";
const RED   = "oklch(0.55 0.22 25)";
const GOLD  = "oklch(0.72 0.15 75)";
const BLUE  = "oklch(0.6 0.15 220)";
const GREEN_HEX = "#4ade80";
const RED_HEX   = "#f87171";
const GOLD_HEX  = "#d4a843";
const BLUE_HEX  = "#60a5fa";
const PIE_COLORS = [GOLD_HEX, RED_HEX, BLUE_HEX, "#a78bfa", GREEN_HEX, "#34d399"];

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const CATEGORIE_ENTRATE = ["Vendita prodotti","Contributi PAC","Affitti attivi","Servizi conto terzi","Altro"];
const CATEGORIE_USCITE  = ["Carburante","Sementi","Fertilizzanti","Fitofarmaci","Manodopera","Manutenzioni","Affitti passivi","Utenze","Assicurazioni","Altro"];

const EMPTY_FORM = { categoria: "", descrizione: "", importo: "", data: new Date().toISOString().split("T")[0], note: "" };

export default function Finanza() {
  const [, setLocation] = useLocation();
  const [tab, setTab]   = useState<"all" | "entrata" | "uscita">("all");
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrata" | "uscita">("entrata");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: transazioni = [], refetch } = trpc.finanza.list.useQuery(
    tab === "all" ? { limit: 100 } : { tipo: tab, limit: 100 }
  );
  const { data: summary }          = trpc.finanza.summary.useQuery();
  const { data: byCategoria = [] }  = trpc.finanza.byCategoria.useQuery();
  const { data: chartRaw }          = trpc.dashboard.chartData.useQuery();
  const { data: fondoTot }          = trpc.reintegrazione.totale.useQuery();

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

  const chartData = Array.isArray(chartRaw)
    ? chartRaw.map((r: any) => ({
        mese: r.mese,
        entrate: Number(r.entrate ?? 0),
        uscite: Number(r.uscite ?? 0),
      }))
    : [];

  const entrate = summary?.totEntrate ?? 0;
  const uscite  = summary?.totUscite ?? 0;
  const utile   = entrate - uscite;
  const margine = entrate > 0 ? (utile / entrate) * 100 : 0;
  const roi     = uscite > 0 ? (utile / uscite) * 100 : 0;
  const categorie = tipo === "entrata" ? CATEGORIE_ENTRATE : CATEGORIE_USCITE;

  return (
    <div className="space-y-5 animate-fade-in-up pb-4">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="fal-eyebrow mb-1" style={{ color: GOLD }}>Controllo Economico</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Finanza
          </h1>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(true); }}
          className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
          <Plus size={15} /> Nuova transazione
        </Button>
      </div>

      {/* ── HERO ECONOMICA + KPI ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero utile */}
        <div className="lg:col-span-2 fal-hero fal-img-overlay min-h-[230px] flex flex-col justify-between p-7"
          style={{ backgroundImage: `url(${FAL_IMAGES.campiColture})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="relative z-10 flex items-start justify-between">
            <p className="fal-eyebrow" style={{ color: utile >= 0 ? GREEN : RED }}>Utile Netto complessivo</p>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "oklch(0.09 0.006 145 / 0.6)", color: GOLD, backdropFilter: "blur(8px)", border: "1px solid oklch(0.72 0.15 75 / 0.3)" }}>
              ROI {roi.toFixed(1)}%
            </span>
          </div>
          <div className="relative z-10">
            <div className="kpi-number-xl" style={{ color: utile >= 0 ? "oklch(0.97 0.005 145)" : RED }}>{fmt(utile)}</div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1.5" style={{ color: "oklch(0.8 0.01 145)" }}>
                <ArrowDownRight size={14} style={{ color: GREEN }} /> Entrate {fmt(entrate)}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "oklch(0.8 0.01 145)" }}>
                <ArrowUpRight size={14} style={{ color: RED }} /> Uscite {fmt(uscite)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI laterali */}
        <div className="flex flex-col gap-4">
          <div className="fal-card p-5 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>MARGINE</span>
              <Percent size={14} style={{ color: margine >= 0 ? GREEN : RED }} />
            </div>
            <div className="kpi-number" style={{ color: margine >= 0 ? GREEN : RED }}>{margine.toFixed(1)}%</div>
          </div>
          <div className="fal-card p-5 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>TRANSAZIONI</span>
              <Wallet size={14} style={{ color: GOLD }} />
            </div>
            <div className="kpi-number" style={{ color: "oklch(0.95 0.005 145)" }}>
              {(summary?.cntEntrate ?? 0) + (summary?.cntUscite ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHART ANDAMENTO + LINK REINTEGRAZIONE ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 fal-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>Andamento Mensile</h3>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 145)" }}>Entrate vs Uscite · ultimi 6 mesi</p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
              {[["Entrate", GREEN_HEX], ["Uscite", RED_HEX]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.008 145)" vertical={false} />
                <XAxis dataKey="mese" tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: "oklch(0.16 0.008 145 / 0.4)" }} contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, color: "oklch(0.85 0.01 145)", fontSize: 12 }} formatter={(v: any) => [fmt(v), ""]} />
                <Bar dataKey="entrate" fill={GREEN_HEX} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="uscite"  fill={RED_HEX}   radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center flex-col gap-2" style={{ color: "oklch(0.4 0.01 145)" }}>
              <TrendingUp size={32} className="opacity-20" />
              <p className="text-sm">Nessun dato — aggiungi transazioni</p>
            </div>
          )}
        </div>

        {/* Distribuzione uscite */}
        <div className="fal-card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>Distribuzione Uscite</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} dataKey="value" paddingAngle={2}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, color: "oklch(0.85 0.01 145)", fontSize: 11 }} formatter={(v: any) => [fmt(Number(v)), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.slice(0, 4).map((d: any, i: number) => (
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
              <p className="text-xs">Nessun dato</p>
            </div>
          )}
        </div>
      </div>

      {/* ── COLLEGAMENTO REINTEGRAZIONE ────────────────────────────────────── */}
      <button onClick={() => setLocation("/reintegrazione")}
        className="fal-card fal-card-hover fal-glow-gold w-full flex items-center gap-4 p-5 text-left">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.72 0.15 75 / 0.12)" }}>
          <RefreshCw size={20} style={{ color: GOLD }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.01 145)" }}>Fondo di Reintegrazione Macchine</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            {fmt(fondoTot?.totale ?? 0)} accantonati su {fondoTot?.fondiCount ?? 0} fondi · pianifica i versamenti per il rinnovo del parco macchine
          </p>
        </div>
        <ChevronRight size={18} style={{ color: GOLD }} />
      </button>

      {/* ── TABELLA TRANSAZIONI ────────────────────────────────────────────── */}
      <div className="fal-card overflow-hidden">
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
                  <TableCell><span className="text-xs font-medium" style={{ color: "oklch(0.75 0.01 145)" }}>{t.categoria}</span></TableCell>
                  <TableCell><span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{t.descrizione ?? "—"}</span></TableCell>
                  <TableCell><span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{new Date(t.data).toLocaleDateString("it-IT")}</span></TableCell>
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

      {/* ── SHEET FORM ─────────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}15` }}>
                <Wallet size={15} style={{ color: GREEN }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuova transazione</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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
