import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Package,
  Sprout,
  TrendingUp,
  Tractor,
  Wallet,
  AlertTriangle,
  Wrench,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";
const GREEN_HEX = "#4ade80";
const RED_HEX = "#f87171";
const BLUE_HEX = "#60a5fa";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const moduleCards = [
  { icon: Building2,   label: "Azienda",    path: "/azienda",    desc: "Anagrafica",        color: GREEN },
  { icon: Wallet,      label: "Finanza",    path: "/finanza",    desc: "Entrate & Uscite",  color: GOLD },
  { icon: Sprout,      label: "Campi",      path: "/campi",      desc: "Appezzamenti",      color: GREEN },
  { icon: Package,     label: "Magazzino",  path: "/magazzino",  desc: "Scorte",            color: GOLD },
  { icon: Tractor,     label: "Officina",   path: "/officina",   desc: "Macchine",          color: RED },
  { icon: CalendarDays,label: "Calendario", path: "/calendario", desc: "Pianificazione",    color: BLUE },
  { icon: BarChart3,   label: "Report",     path: "/report",     desc: "Enterprise Metrics",color: GREEN },
  { icon: Bot,         label: "AI",         path: "/ai",         desc: "Explainable AI",    color: GOLD },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: kpi, isLoading: kpiLoading } = trpc.dashboard.kpi.useQuery();
  const { data: chartRaw } = trpc.dashboard.chartData.useQuery();
  const { data: recent } = trpc.dashboard.recentActivity.useQuery();

  const chartData = Array.isArray(chartRaw)
    ? chartRaw.map((r: any) => ({
        mese: r.mese,
        entrate: Number(r.entrate ?? 0),
        uscite: Number(r.uscite ?? 0),
        utile: Number(r.entrate ?? 0) - Number(r.uscite ?? 0),
      }))
    : [];

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Buongiorno" : now.getHours() < 18 ? "Buon pomeriggio" : "Buonasera";
  const userName = user?.name?.split(" ")[0] ?? "Utente";

  const recentTx = (recent && "transazioni" in recent ? (recent.transazioni as any[]) : []).slice(0, 4);
  const recentIv = (recent && "interventi" in recent ? (recent.interventi as any[]) : []).slice(0, 2);
  const allRecent = [...recentTx.map((t: any) => ({ ...t, _type: "tx" })), ...recentIv.map((i: any) => ({ ...i, _type: "iv" }))];

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: GREEN }}>
            FALLINITY FEOS
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)", letterSpacing: "-0.03em" }}>
            {greeting}, {userName}
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "oklch(0.65 0.18 142 / 0.08)", border: "1px solid oklch(0.65 0.18 142 / 0.2)" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
          <span className="text-xs font-medium" style={{ color: GREEN }}>Sistema operativo</span>
        </div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "UTILE NETTO", value: kpi ? fmt(kpi.utileNetto) : "—", sub: "mese corrente", color: kpi && kpi.utileNetto >= 0 ? GREEN : RED, icon: TrendingUp, trend: kpi && kpi.utileNetto >= 0 ? "up" : "down" },
          { label: "ENTRATE",     value: kpi ? fmt(kpi.entrate)   : "—", sub: "mese corrente", color: GREEN, icon: ArrowDownRight, trend: "up" },
          { label: "USCITE",      value: kpi ? fmt(kpi.uscite)    : "—", sub: "mese corrente", color: RED,   icon: ArrowUpRight,   trend: "down" },
          { label: "CAMPI ATTIVI",value: kpi ? String(kpi.campiAttivi) : "—", sub: "appezzamenti", color: GREEN, icon: Sprout, trend: "neutral" },
          { label: "MACCHINE",    value: kpi ? String(kpi.macchine ?? 0) : "—", sub: `${kpi?.macchineFerme ?? 0} ferme`, color: kpi && (kpi.macchineFerme ?? 0) > 0 ? RED : GREEN, icon: Tractor, trend: "neutral" },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: `1px solid oklch(0.18 0.008 145)` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}1a` }}>
                <k.icon size={16} style={{ color: k.color }} />
              </div>
            </div>
            {kpiLoading ? (
              <div className="h-9 w-28 rounded animate-pulse mb-2" style={{ background: "oklch(0.15 0.006 145)" }} />
            ) : (
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)", letterSpacing: "-0.04em" }}>
                {k.value}
              </div>
            )}
            <div className="flex items-center gap-1">
              {k.trend === "up"   && <ArrowUpRight   size={11} style={{ color: GREEN }} />}
              {k.trend === "down" && <ArrowDownRight  size={11} style={{ color: RED }}   />}
              <span className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── ALERT BANNER ───────────────────────────────────────────────────── */}
      {kpi && (kpi.macchineFerme > 0 || kpi.prodottiSottoScorta > 0 || kpi.interventiAperti > 0) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: "oklch(0.72 0.15 75 / 0.07)", border: "1px solid oklch(0.72 0.15 75 / 0.25)" }}>
          <AlertTriangle size={15} style={{ color: GOLD, flexShrink: 0 }} />
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "oklch(0.7 0.01 145)" }}>
            {kpi.macchineFerme > 0 && <span><span style={{ color: RED, fontWeight: 700 }}>{kpi.macchineFerme}</span> macchine ferme</span>}
            {kpi.interventiAperti > 0 && <span><span style={{ color: GOLD, fontWeight: 700 }}>{kpi.interventiAperti}</span> interventi aperti</span>}
            {kpi.prodottiSottoScorta > 0 && <span><span style={{ color: GOLD, fontWeight: 700 }}>{kpi.prodottiSottoScorta}</span> prodotti sotto scorta</span>}
          </div>
          <button onClick={() => setLocation("/officina")} className="ml-auto text-xs font-medium flex items-center gap-1" style={{ color: GOLD }}>
            Vedi <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* ── CHART + ACTIVITY ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Andamento economico */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>Andamento Economico</h3>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 145)" }}>Ultimi 6 mesi</p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
              {[["Entrate", GREEN_HEX], ["Uscite", RED_HEX], ["Utile", BLUE_HEX]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  {[["gEnt", GREEN_HEX, 0.3], ["gUsc", RED_HEX, 0.2], ["gUti", BLUE_HEX, 0.2]].map(([id, c, op]) => (
                    <linearGradient key={id as string} id={id as string} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={c as string} stopOpacity={op as number} />
                      <stop offset="95%" stopColor={c as string} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.008 145)" />
                <XAxis dataKey="mese" tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, color: "oklch(0.85 0.01 145)", fontSize: 12 }} formatter={(v: any) => [fmt(v), ""]} />
                <Area type="monotone" dataKey="entrate" stroke={GREEN_HEX} strokeWidth={2} fill="url(#gEnt)" dot={false} />
                <Area type="monotone" dataKey="uscite"  stroke={RED_HEX}   strokeWidth={2} fill="url(#gUsc)" dot={false} />
                <Area type="monotone" dataKey="utile"   stroke={BLUE_HEX}  strokeWidth={2} fill="url(#gUti)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center flex-col gap-2" style={{ color: "oklch(0.4 0.01 145)" }}>
              <BarChart3 size={32} className="opacity-20" />
              <p className="text-sm">Nessun dato — aggiungi transazioni in Finanza</p>
            </div>
          )}
        </div>

        {/* Attività recenti */}
        <div className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>Attività Recenti</h3>
          </div>
          <div className="space-y-3">
            {allRecent.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna attività recente</p>
            ) : allRecent.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: item._type === "tx" ? (item.tipo === "entrata" ? "oklch(0.65 0.18 142 / 0.12)" : "oklch(0.55 0.22 25 / 0.12)") : "oklch(0.72 0.15 75 / 0.12)" }}>
                  {item._type === "tx"
                    ? (item.tipo === "entrata" ? <ArrowDownRight size={13} style={{ color: GREEN }} /> : <ArrowUpRight size={13} style={{ color: RED }} />)
                    : <Wrench size={13} style={{ color: GOLD }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "oklch(0.75 0.01 145)" }}>
                    {item._type === "tx" ? item.categoria : item.descrizione?.slice(0, 28)}
                  </p>
                  <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                    {item._type === "tx"
                      ? new Date(item.data).toLocaleDateString("it-IT")
                      : `${item.tipo} · ${item.stato}`}
                  </p>
                </div>
                {item._type === "tx" && (
                  <span className="text-xs font-semibold shrink-0" style={{ color: item.tipo === "entrata" ? GREEN : RED }}>
                    {item.tipo === "entrata" ? "+" : "-"}{fmt(Number(item.importo))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODULI RAPIDI ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: GREEN }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>Aree principali</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {moduleCards.map(mod => (
            <button
              key={mod.path}
              onClick={() => setLocation(mod.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-150"
              style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.11 0.006 145)"; }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${mod.color}1a` }}>
                <mod.icon size={18} style={{ color: mod.color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: "oklch(0.7 0.01 145)" }}>{mod.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
