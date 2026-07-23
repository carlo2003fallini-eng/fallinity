import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, ArrowDownRight, ArrowUpRight, TrendingUp, TrendingDown,
  Wallet, CreditCard, AlertTriangle, Bell, ChevronRight, BarChart3,
  Calendar, FileText, RefreshCw, Landmark, Banknote, CircleDollarSign, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Area,
} from "recharts";
import Reintegrazione from "./Reintegrazione";

// ── Design Tokens ──
const GREEN = "oklch(0.65 0.18 142)";
const RED = "oklch(0.55 0.22 25)";
const GOLD = "oklch(0.72 0.15 75)";
const BLUE = "oklch(0.6 0.15 220)";
const GREEN_HEX = "#4ade80";
const RED_HEX = "#f87171";
const GOLD_HEX = "#d4a843";
const BLUE_HEX = "#60a5fa";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// ── Periodi preimpostati ──
type PeriodoKey = "7gg" | "30gg" | "mese" | "trimestre" | "anno";
const PERIODI: { key: PeriodoKey; label: string; mesi: number }[] = [
  { key: "7gg", label: "7 giorni", mesi: 1 },
  { key: "30gg", label: "30 giorni", mesi: 1 },
  { key: "mese", label: "Mese", mesi: 1 },
  { key: "trimestre", label: "Trimestre", mesi: 3 },
  { key: "anno", label: "Anno", mesi: 12 },
];

function getDateRange(key: PeriodoKey): { dataInizio: string; dataFine: string } {
  const oggi = new Date();
  const dataFine = oggi.toISOString().split("T")[0];
  let inizio: Date;
  switch (key) {
    case "7gg": inizio = new Date(oggi.getTime() - 7 * 86400000); break;
    case "30gg": inizio = new Date(oggi.getTime() - 30 * 86400000); break;
    case "mese": inizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1); break;
    case "trimestre": inizio = new Date(oggi.getFullYear(), oggi.getMonth() - 2, 1); break;
    case "anno": inizio = new Date(oggi.getFullYear(), 0, 1); break;
  }
  return { dataInizio: inizio.toISOString().split("T")[0], dataFine };
}

export default function Finanza() {
  const [, setLocation] = useLocation();
  const [mainTab, setMainTab] = useState<"dashboard" | "reintegrazione">("dashboard");
  const [periodo, setPeriodo] = useState<PeriodoKey>("mese");
  const [modalita, setModalita] = useState<"cassa" | "competenza">("cassa");

  const dateRange = useMemo(() => getDateRange(periodo), [periodo]);
  const mesiTrend = useMemo(() => {
    switch (periodo) {
      case "7gg": case "30gg": case "mese": return 6;
      case "trimestre": return 6;
      case "anno": return 12;
    }
  }, [periodo]);

  // ── Queries ──
  const { data: summary, isLoading: loadingSummary } = trpc.finanza.dashboard.summary.useQuery({
    ...dateRange, modalita,
  });
  const { data: trend } = trpc.finanza.dashboard.trend.useQuery({ mesi: mesiTrend, modalita });
  const { data: deadlines } = trpc.finanza.dashboard.deadlines.useQuery();
  const { data: creditsDebts } = trpc.finanza.dashboard.creditsDebts.useQuery();
  const { data: accounts } = trpc.finanza.dashboard.accounts.useQuery();
  const { data: alertCount } = trpc.finanza.alerts.count.useQuery();
  const { data: alerts } = trpc.finanza.alerts.list.useQuery({ risolto: false, limit: 5 });
  const { data: costCenters } = trpc.finanza.dashboard.costCenters.useQuery({ ...dateRange, modalita });

  const calcolaMut = trpc.finanza.alerts.calcola.useMutation({
    onSuccess: () => toast.success("Alert ricalcolati"),
  });

  const trendData = useMemo(() => {
    if (!trend?.trend) return [];
    return trend.trend.map((p: any) => ({
      mese: p.mese.substring(5), // "MM"
      entrate: p.entrate,
      uscite: p.uscite,
      utile: p.utile,
    }));
  }, [trend]);

  if (mainTab === "reintegrazione") {
    return (
      <div className="space-y-5 animate-fade-in-up pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="fal-eyebrow mb-1" style={{ color: GOLD }}>Controllo Economico</p>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
              Finanza
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          {([["dashboard", "Dashboard", BarChart3], ["reintegrazione", "Reintegrazione", RefreshCw]] as const).map(([v, l, Icon]) => (
            <button key={v} onClick={() => setMainTab(v)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                background: mainTab === v ? `${GOLD}1f` : "transparent",
                color: mainTab === v ? GOLD : "oklch(0.55 0.01 145)",
              }}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>
        <Reintegrazione />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="fal-eyebrow mb-1" style={{ color: GOLD }}>Controllo Economico</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Finanza
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {alertCount && alertCount > 0 && (
            <Button variant="outline" size="sm" className="relative gap-1.5"
              style={{ borderColor: "oklch(0.22 0.01 25)", color: RED }}
              onClick={() => setLocation("/finanza/alerts")}>
              <Bell size={14} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                style={{ background: RED, color: "white" }}>{alertCount}</span>
            </Button>
          )}
          <Button onClick={() => setLocation("/finanza/nuovo")}
            className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
            <Plus size={15} /> Nuovo
          </Button>
        </div>
      </div>

      {/* ── TAB PRIMARIE ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
        {([["dashboard", "Dashboard", BarChart3], ["reintegrazione", "Reintegrazione", RefreshCw]] as const).map(([v, l, Icon]) => (
          <button key={v} onClick={() => setMainTab(v)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: mainTab === v ? `${GOLD}1f` : "transparent",
              color: mainTab === v ? GOLD : "oklch(0.55 0.01 145)",
            }}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      {/* ── FILTRI GLOBALI ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "oklch(0.13 0.006 145)" }}>
          {PERIODI.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: periodo === p.key ? "oklch(0.18 0.01 145)" : "transparent",
                color: periodo === p.key ? "oklch(0.9 0.005 145)" : "oklch(0.5 0.01 145)",
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "oklch(0.13 0.006 145)" }}>
          {(["cassa", "competenza"] as const).map(m => (
            <button key={m} onClick={() => setModalita(m)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
              style={{
                background: modalita === m ? "oklch(0.18 0.01 145)" : "transparent",
                color: modalita === m ? "oklch(0.9 0.005 145)" : "oklch(0.5 0.01 145)",
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── HERO: SALDO DISPONIBILE ── */}
      <Card className="p-5 border-0" style={{ background: "linear-gradient(135deg, oklch(0.14 0.015 145), oklch(0.11 0.008 220))" }}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={16} style={{ color: GOLD }} />
          <span className="text-xs font-medium" style={{ color: "oklch(0.6 0.01 145)" }}>Disponibilità Totale</span>
        </div>
        {loadingSummary ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <>
            <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
              {fmt(accounts?.saldoTotale ?? 0)}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                {accounts?.conti?.length ?? 0} conti attivi
              </span>
            </div>
          </>
        )}
      </Card>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          label="Entrate" icon={ArrowDownRight} color={GREEN}
          valore={summary?.entrate?.valore} percentuale={summary?.entrate?.percentuale ?? undefined}
          loading={loadingSummary}
        />
        <KPICard
          label="Uscite" icon={ArrowUpRight} color={RED}
          valore={summary?.uscite?.valore} percentuale={summary?.uscite?.percentuale ?? undefined}
          loading={loadingSummary}
        />
        <KPICard
          label="Utile Netto" icon={TrendingUp} color={GOLD}
          valore={summary?.utileNetto?.valore} percentuale={summary?.utileNetto?.percentuale ?? undefined}
          loading={loadingSummary}
        />
        <KPICard
          label="Margine"
          icon={(summary?.utileNetto?.valore ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(summary?.utileNetto?.valore ?? 0) >= 0 ? GREEN : RED}
          valore={summary?.entrate?.valore ? ((summary?.utileNetto?.valore ?? 0) / summary.entrate.valore * 100) : 0}
          isPercentage
          loading={loadingSummary}
        />
      </div>

      {/* ── ANDAMENTO ── */}
      {trendData.length > 0 && (
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Andamento</h3>
            <span className="text-[10px]" style={{ color: "oklch(0.5 0.01 145)" }}>Ultimi {mesiTrend} mesi</span>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.005 145)" />
                <XAxis dataKey="mese" tick={{ fontSize: 10, fill: "oklch(0.5 0.01 145)" }} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.01 145)" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.14 0.008 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "oklch(0.7 0.005 145)" }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="entrate" fill={GREEN_HEX} radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar dataKey="uscite" fill={RED_HEX} radius={[3, 3, 0, 0]} opacity={0.8} />
                <Line type="monotone" dataKey="utile" stroke={GOLD_HEX} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── SCADENZE + CREDITI/DEBITI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Scadenze */}
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: BLUE }} />
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Scadenze</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Da pagare (7gg)</span>
              <span className="text-sm font-semibold" style={{ color: RED }}>
                {fmt(deadlines?.daPagare7gg?.reduce((s: number, d: any) => s + Number(d.importo), 0) ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Da incassare (30gg)</span>
              <span className="text-sm font-semibold" style={{ color: GREEN }}>
                {fmt(deadlines?.daIncassare30gg?.reduce((s: number, d: any) => s + Number(d.importo), 0) ?? 0)}
              </span>
            </div>
            {(deadlines?.scadute?.length ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1" style={{ color: RED }}>
                  <AlertTriangle size={11} /> Scadute
                </span>
                <Badge variant="destructive" className="text-[10px]">{deadlines?.scadute?.length}</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Crediti / Debiti */}
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={14} style={{ color: GOLD }} />
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Crediti / Debiti</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Crediti residui</span>
              <span className="text-sm font-semibold" style={{ color: GREEN }}>
                {fmt(creditsDebts?.crediti?.totaleResiduo ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Debiti residui</span>
              <span className="text-sm font-semibold" style={{ color: RED }}>
                {fmt(creditsDebts?.debiti?.totaleResiduo ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Quota scaduta</span>
              <span className="text-sm font-semibold" style={{ color: "oklch(0.7 0.15 25)" }}>
                {fmt((creditsDebts?.crediti?.quotaScaduta ?? 0) + (creditsDebts?.debiti?.quotaScaduta ?? 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── DISPONIBILITÀ CONTI ── */}
      {accounts?.conti && accounts.conti.length > 0 && (
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={14} style={{ color: BLUE }} />
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Conti</h3>
          </div>
          <div className="space-y-2">
            {(accounts.conti as any[]).slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0"
                style={{ borderColor: "oklch(0.18 0.005 145)" }}>
                <div className="flex items-center gap-2">
                  <ContoIcon tipo={c.tipo} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.85 0.005 145)" }}>{c.nome}</p>
                    <p className="text-[10px]" style={{ color: "oklch(0.5 0.01 145)" }}>{c.tipo}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: Number(c.saldoAttuale) >= 0 ? GREEN : RED }}>
                  {fmt(Number(c.saldoAttuale))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── CENTRI DI COSTO ── */}
      {costCenters && (costCenters as any)?.centri?.length > 0 && (
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CircleDollarSign size={14} style={{ color: GOLD }} />
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Centri di Costo</h3>
          </div>
          <div className="space-y-2">
            {((costCenters as any)?.centri ?? []).slice(0, 5).map((c: any, i: number) => {
              const totaleMax = Math.max(...((costCenters as any)?.centri ?? []).map((x: any) => x.importo));
              const pct = totaleMax > 0 ? (c.importo / totaleMax) * 100 : 0;
              return (
                <div key={c.id || i}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs" style={{ color: "oklch(0.7 0.005 145)" }}>{c.nome || "Non assegnato"}</span>
                    <span className="text-xs font-medium" style={{ color: "oklch(0.85 0.005 145)" }}>{fmt(c.importo)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.005 145)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GOLD }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── ALERT ── */}
      {alerts && (alerts as any[]).length > 0 && (
        <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)", borderLeft: `3px solid ${RED}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: RED }} />
              <h3 className="text-sm font-semibold" style={{ color: "oklch(0.8 0.005 145)" }}>Alert</h3>
              <Badge variant="destructive" className="text-[10px] h-4">{alertCount}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]"
              onClick={() => calcolaMut.mutate()}
              disabled={calcolaMut.isPending}>
              <RefreshCw size={10} className={calcolaMut.isPending ? "animate-spin" : ""} /> Ricalcola
            </Button>
          </div>
          <div className="space-y-2">
            {(alerts as any[]).slice(0, 3).map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 py-1.5 border-b last:border-0"
                style={{ borderColor: "oklch(0.18 0.005 145)" }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: a.severita === "critico" ? RED : a.severita === "alto" ? GOLD : BLUE }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.005 145)" }}>{a.titolo}</p>
                  <p className="text-[10px] truncate" style={{ color: "oklch(0.5 0.01 145)" }}>{a.descrizione}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── AZIONI RAPIDE ── */}
      <div className="grid grid-cols-4 gap-2">
        <ActionButton icon={FileText} label="Movimenti" onClick={() => setLocation("/finanza/movimenti")} color={BLUE} />
        <ActionButton icon={BarChart3} label="Cashflow" onClick={() => setLocation("/finanza/cashflow")} color={GOLD} />
        <ActionButton icon={ClipboardList} label="Proposte" onClick={() => setLocation("/finanza/proposte")} color="oklch(0.65 0.15 280)" />
        <ActionButton icon={Plus} label="Nuovo" onClick={() => setLocation("/finanza/nuovo")} color={GREEN} />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        <ActionButton icon={Landmark} label="Budget" onClick={() => setLocation("/finanza/budget")} color="oklch(0.6 0.15 250)" />
        <ActionButton icon={RefreshCw} label="Reintegr." onClick={() => setLocation("/finanza/reintegrazione")} color={GOLD} />
        <ActionButton icon={CircleDollarSign} label="Investim." onClick={() => setLocation("/finanza/investimenti")} color="oklch(0.6 0.18 160)" />
        <ActionButton icon={Banknote} label="Scenari" onClick={() => setLocation("/finanza/scenari")} color="oklch(0.6 0.12 300)" />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        <ActionButton icon={BarChart3} label="Analisi" onClick={() => setLocation("/finanza/analisi")} color="oklch(0.65 0.12 200)" />
        <ActionButton icon={FileText} label="Report" onClick={() => setLocation("/finanza/report")} color="oklch(0.55 0.1 180)" />
      </div>
    </div>
  );
}

// ── Sub-components ──

function KPICard({ label, icon: Icon, color, valore, percentuale, loading, isPercentage }: {
  label: string; icon: any; color: string; valore?: number; percentuale?: number; loading: boolean; isPercentage?: boolean;
}) {
  return (
    <Card className="p-3.5 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} style={{ color }} />
        <span className="text-[11px] font-medium" style={{ color: "oklch(0.55 0.01 145)" }}>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <>
          <p className="text-lg font-bold" style={{ color: "oklch(0.92 0.005 145)" }}>
            {isPercentage ? `${(valore ?? 0).toFixed(1)}%` : fmt(valore ?? 0)}
          </p>
          {percentuale !== undefined && (
            <span className="text-[10px] font-medium" style={{ color: percentuale >= 0 ? GREEN : RED }}>
              {fmtPct(percentuale)} vs prec.
            </span>
          )}
        </>
      )}
    </Card>
  );
}

function ActionButton({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-[0.97]"
      style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
      <Icon size={18} style={{ color }} />
      <span className="text-[10px] font-medium" style={{ color: "oklch(0.7 0.005 145)" }}>{label}</span>
    </button>
  );
}

function ContoIcon({ tipo }: { tipo: string }) {
  const size = 14;
  switch (tipo) {
    case "bancario": return <Landmark size={size} style={{ color: BLUE }} />;
    case "cassa": return <Banknote size={size} style={{ color: GREEN }} />;
    case "carta": return <CreditCard size={size} style={{ color: GOLD }} />;
    default: return <Wallet size={size} style={{ color: "oklch(0.5 0.01 145)" }} />;
  }
}
