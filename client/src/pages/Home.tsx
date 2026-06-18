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
  TrendingDown,
  Tractor,
  Wallet,
  AlertTriangle,
  Wrench,
  ChevronRight,
  Zap,
  Activity,
  RefreshCw,
  PiggyBank,
  Plus,
  FileText,
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
import { FAL_IMAGES } from "@/lib/assets";

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
  { icon: Building2,   label: "Azienda",    path: "/azienda",    color: GREEN },
  { icon: Wallet,      label: "Finanza",    path: "/finanza",    color: GOLD },
  { icon: Sprout,      label: "Campi",      path: "/campi",      color: GREEN },
  { icon: Package,     label: "Magazzino",  path: "/magazzino",  color: GOLD },
  { icon: Tractor,     label: "Officina",   path: "/officina",   color: RED },
  { icon: Activity,    label: "Stalla",     path: "/stalla",     color: GREEN },
  { icon: CalendarDays,label: "Calendario", path: "/calendario", color: BLUE },
  { icon: BarChart3,   label: "Report",     path: "/report",     color: GREEN },
  { icon: RefreshCw,   label: "Reintegr.",  path: "/reintegrazione", color: GOLD },
  { icon: Bot,         label: "AI Copilot", path: "/ai",         color: GOLD },
];

const quickActions = [
  { icon: Plus,    label: "Nuova Entrata",   path: "/finanza",  color: GREEN },
  { icon: ArrowUpRight, label: "Nuova Uscita", path: "/finanza", color: RED },
  { icon: Wrench,  label: "Intervento",      path: "/officina", color: GOLD },
  { icon: FileText,label: "Report",          path: "/report",   color: BLUE },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: kpi, isLoading: kpiLoading } = trpc.dashboard.kpi.useQuery();
  const { data: chartRaw } = trpc.dashboard.chartData.useQuery();
  const { data: recent } = trpc.dashboard.recentActivity.useQuery();
  const { data: fondoTot } = trpc.reintegrazione.totale.useQuery();

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

  const utile = kpi?.utileNetto ?? 0;
  const entrate = kpi?.entrate ?? 0;
  const uscite = kpi?.uscite ?? 0;
  const cashflow = entrate - uscite;
  const margine = entrate > 0 ? (utile / entrate) * 100 : 0;
  const fondo = fondoTot?.totale ?? 0;

  return (
    <div className="space-y-6 animate-fade-in-up pb-4">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="fal-eyebrow mb-1.5">Fallinity FEOS · Dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.96 0.005 145)", letterSpacing: "-0.03em" }}>
            {greeting}, {userName}
          </h1>
          <p className="text-sm mt-1 capitalize" style={{ color: "oklch(0.5 0.01 145)" }}>
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "oklch(0.65 0.18 142 / 0.08)", border: "1px solid oklch(0.65 0.18 142 / 0.2)" }}>
          <div className="w-2 h-2 rounded-full fal-pulse" style={{ background: GREEN }} />
          <span className="text-xs font-medium" style={{ color: GREEN }}>Sistema operativo</span>
        </div>
      </div>

      {/* ── HERO UTILE NETTO + CARD ECONOMICHE ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* HERO dominante */}
        <div className="lg:col-span-2 fal-hero fal-img-overlay min-h-[280px] flex flex-col justify-between p-7"
          style={{ backgroundImage: `url(${FAL_IMAGES.heroFarm})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="fal-eyebrow" style={{ color: utile >= 0 ? GREEN : RED }}>Utile Netto · Mese corrente</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: utile >= 0 ? "oklch(0.65 0.18 142 / 0.2)" : "oklch(0.55 0.22 25 / 0.2)", backdropFilter: "blur(8px)" }}>
                  {utile >= 0 ? <TrendingUp size={18} style={{ color: GREEN }} /> : <TrendingDown size={18} style={{ color: RED }} />}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full relative z-10" style={{ background: "oklch(0.09 0.006 145 / 0.6)", color: margine >= 0 ? GREEN : RED, backdropFilter: "blur(8px)", border: `1px solid ${margine >= 0 ? "oklch(0.65 0.18 142 / 0.3)" : "oklch(0.55 0.22 25 / 0.3)"}` }}>
              Margine {margine.toFixed(1)}%
            </span>
          </div>
          <div className="relative z-10">
            {kpiLoading ? (
              <div className="h-16 w-72 rounded animate-pulse" style={{ background: "oklch(0.2 0.01 145 / 0.5)" }} />
            ) : (
              <div className="kpi-number-xl" style={{ color: utile >= 0 ? "oklch(0.97 0.005 145)" : RED }}>
                {fmt(utile)}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1.5" style={{ color: "oklch(0.8 0.01 145)" }}>
                <ArrowDownRight size={14} style={{ color: GREEN }} /> {fmt(entrate)}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: "oklch(0.8 0.01 145)" }}>
                <ArrowUpRight size={14} style={{ color: RED }} /> {fmt(uscite)}
              </span>
              <button onClick={() => setLocation("/finanza")} className="ml-auto flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: GREEN, backdropFilter: "blur(8px)" }}>
                Apri Finanza <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Colonna card economiche */}
        <div className="flex flex-col gap-4">
          {/* Cashflow */}
          <div className="fal-card fal-card-hover fal-glow-blue flex-1 p-5 flex flex-col justify-between cursor-pointer" onClick={() => setLocation("/finanza")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>CASHFLOW</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.6 0.15 220 / 0.12)" }}>
                <Activity size={15} style={{ color: BLUE }} />
              </div>
            </div>
            <div className="kpi-number mt-2" style={{ color: cashflow >= 0 ? "oklch(0.95 0.005 145)" : RED }}>{fmt(cashflow)}</div>
            <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>flusso di cassa netto</p>
          </div>
          {/* Fondo Reintegrazione */}
          <div className="fal-card fal-card-hover fal-glow-gold flex-1 p-5 flex flex-col justify-between cursor-pointer" onClick={() => setLocation("/reintegrazione")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>FONDO REINTEGRAZIONE</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.72 0.15 75 / 0.12)" }}>
                <PiggyBank size={15} style={{ color: GOLD }} />
              </div>
            </div>
            <div className="kpi-number mt-2" style={{ color: GOLD }}>{fmt(fondo)}</div>
            <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>{fondoTot?.fondiCount ?? 0} fondi macchine attivi</p>
          </div>
        </div>
      </div>

      {/* ── KPI OPERATIVI SECONDARI ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "CAMPI ATTIVI", value: kpi ? String(kpi.campiAttivi) : "—", sub: "appezzamenti", color: GREEN, icon: Sprout, path: "/campi" },
          { label: "MACCHINE",     value: kpi ? String(kpi.macchine ?? 0) : "—", sub: `${kpi?.macchineFerme ?? 0} ferme`, color: kpi && (kpi.macchineFerme ?? 0) > 0 ? RED : GREEN, icon: Tractor, path: "/officina" },
          { label: "INTERVENTI",   value: kpi ? String(kpi.interventiAperti ?? 0) : "—", sub: "aperti", color: kpi && (kpi.interventiAperti ?? 0) > 0 ? GOLD : GREEN, icon: Wrench, path: "/officina" },
          { label: "SOTTO SCORTA", value: kpi ? String(kpi.prodottiSottoScorta ?? 0) : "—", sub: "prodotti", color: kpi && (kpi.prodottiSottoScorta ?? 0) > 0 ? GOLD : GREEN, icon: Package, path: "/magazzino" },
        ].map(k => (
          <div key={k.label} className="fal-card fal-card-hover p-5 cursor-pointer" onClick={() => setLocation(k.path)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}1a` }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
            </div>
            <div className="kpi-number" style={{ color: "oklch(0.95 0.005 145)" }}>{k.value}</div>
            <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 145)" }}>{k.sub}</p>
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

      {/* ── AZIONI RAPIDE ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => setLocation(a.path)}
            className="fal-card fal-card-hover flex items-center gap-3 p-4 text-left">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${a.color}1a` }}>
              <a.icon size={18} style={{ color: a.color }} />
            </div>
            <span className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 145)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── CHART + ACTIVITY ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Andamento economico */}
        <div className="lg:col-span-2 fal-card p-5">
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
            <ResponsiveContainer width="100%" height={220}>
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
            <div className="h-[220px] flex items-center justify-center flex-col gap-2" style={{ color: "oklch(0.4 0.01 145)" }}>
              <BarChart3 size={32} className="opacity-20" />
              <p className="text-sm">Nessun dato — aggiungi transazioni in Finanza</p>
            </div>
          )}
        </div>

        {/* Attività recenti */}
        <div className="fal-card p-5">
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
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
          {moduleCards.map(mod => (
            <button
              key={mod.path}
              onClick={() => setLocation(mod.path)}
              className="fal-card fal-card-hover flex flex-col items-center gap-2 p-4"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${mod.color}1a` }}>
                <mod.icon size={18} style={{ color: mod.color }} />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight" style={{ color: "oklch(0.7 0.01 145)" }}>{mod.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
