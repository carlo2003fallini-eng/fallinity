import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowDownRight, ArrowUpRight, TrendingUp, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const GREEN = "oklch(0.65 0.18 142)";
const RED = "oklch(0.55 0.22 25)";
const GOLD = "oklch(0.72 0.15 75)";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const CATEGORIE_ENTRATE = ["Vendita prodotti","Contributi PAC","Affitti attivi","Servizi conto terzi","Altro"];
const CATEGORIE_USCITE = ["Carburante","Sementi","Fertilizzanti","Fitofarmaci","Manodopera","Manutenzioni","Affitti passivi","Utenze","Assicurazioni","Altro"];
const COLORS = [GREEN, GOLD, "oklch(0.6 0.15 220)", "oklch(0.65 0.18 300)", RED, "oklch(0.6 0.15 180)"];

export default function Finanza() {
  const [tab, setTab] = useState<"all" | "entrata" | "uscita">("all");
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrata" | "uscita">("entrata");
  const [form, setForm] = useState({ categoria: "", descrizione: "", importo: "", data: new Date().toISOString().split("T")[0], note: "" });

  const { data: transazioni = [], refetch } = trpc.finanza.list.useQuery(
    tab === "all" ? { limit: 100 } : { tipo: tab, limit: 100 }
  );
  const { data: summary } = trpc.finanza.summary.useQuery();
  const { data: byCategoria = [] } = trpc.finanza.byCategoria.useQuery();

  const createMutation = trpc.finanza.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Transazione aggiunta"); setForm({ categoria: "", descrizione: "", importo: "", data: new Date().toISOString().split("T")[0], note: "" }); },
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

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Finanza
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>Entrate, uscite e analisi economica</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              <Plus size={16} /> Nuova transazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuova transazione</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="flex gap-2">
                {(["entrata","uscita"] as const).map(t => (
                  <button key={t} onClick={() => setTipo(t)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: tipo === t ? (t === "entrata" ? `${GREEN}20` : `${RED}20`) : "oklch(0.15 0.006 145)", color: tipo === t ? (t === "entrata" ? GREEN : RED) : "oklch(0.55 0.01 145)", border: `1px solid ${tipo === t ? (t === "entrata" ? GREEN : RED) + "40" : "transparent"}` }}>
                    {t === "entrata" ? "Entrata" : "Uscita"}
                  </button>
                ))}
              </div>
              <select
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "oklch(0.15 0.006 145)", color: "oklch(0.85 0.01 145)", border: "1px solid oklch(0.22 0.01 145)" }}
              >
                <option value="">Seleziona categoria *</option>
                {(tipo === "entrata" ? CATEGORIE_ENTRATE : CATEGORIE_USCITE).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input placeholder="Descrizione" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Importo (€) *" type="number" step="0.01" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))} className="bg-input border-border" />
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="bg-input border-border" />
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                {createMutation.isPending ? "Salvataggio..." : "Salva transazione"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "ENTRATE TOTALI", value: fmt(summary?.totEntrate ?? 0), color: GREEN, icon: ArrowDownRight },
          { label: "USCITE TOTALI", value: fmt(summary?.totUscite ?? 0), color: RED, icon: ArrowUpRight },
          { label: "UTILE NETTO", value: fmt((summary?.totEntrate ?? 0) - (summary?.totUscite ?? 0)), color: (summary?.totEntrate ?? 0) >= (summary?.totUscite ?? 0) ? GREEN : RED, icon: TrendingUp },
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

      {/* Chart + Lista */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie uscite per categoria */}
        <div className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.85 0.01 145)" }}>USCITE PER CATEGORIA</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmt(v), ""]} contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, fontSize: 12, color: "oklch(0.85 0.01 145)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.slice(0, 4).map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: "oklch(0.65 0.01 145)" }}>{d.name}</span>
                    </div>
                    <span style={{ color: "oklch(0.75 0.01 145)" }}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun dato</div>
          )}
        </div>

        {/* Lista transazioni */}
        <div className="lg:col-span-2 rounded-xl" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Filter size={14} style={{ color: "oklch(0.45 0.01 145)" }} />
            {(["all","entrata","uscita"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: tab === t ? (t === "entrata" ? `${GREEN}15` : t === "uscita" ? `${RED}15` : "oklch(0.18 0.008 145)") : "transparent", color: tab === t ? (t === "entrata" ? GREEN : t === "uscita" ? RED : "oklch(0.85 0.01 145)") : "oklch(0.5 0.01 145)" }}>
                {t === "all" ? "Tutte" : t === "entrata" ? "Entrate" : "Uscite"}
              </button>
            ))}
          </div>
          <div className="divide-y divide-[oklch(0.15_0.006_145)]">
            {(transazioni as any[]).length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna transazione</div>
            ) : (
              (transazioni as any[]).map((t: any) => (
                <div key={t.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: t.tipo === "entrata" ? `${GREEN}15` : `${RED}15` }}>
                    {t.tipo === "entrata" ? <ArrowDownRight size={14} style={{ color: GREEN }} /> : <ArrowUpRight size={14} style={{ color: RED }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{t.categoria}</p>
                    <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                      {t.descrizione || "—"} · {new Date(t.data).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: t.tipo === "entrata" ? GREEN : RED }}>
                    {t.tipo === "entrata" ? "+" : "-"}{fmt(Number(t.importo))}
                  </span>
                  <button onClick={() => deleteMutation.mutate({ id: t.id })} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{ color: "oklch(0.55 0.22 25)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
