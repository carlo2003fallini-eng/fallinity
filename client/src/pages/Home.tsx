import { trpc } from "@/lib/trpc";
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

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const moduleCards = [
  { icon: Building2, label: "Azienda",    path: "/azienda",    desc: "Anagrafica e contatti",   color: GREEN },
  { icon: Wallet,    label: "Finanza",    path: "/finanza",    desc: "Entrate, uscite, budget",  color: GOLD },
  { icon: Sprout,    label: "Campi",      path: "/campi",      desc: "Appezzamenti e colture",   color: GREEN },
  { icon: Package,   label: "Magazzino",  path: "/magazzino",  desc: "Scorte e movimenti",       color: GOLD },
  { icon: Tractor,   label: "Officina",   path: "/officina",   desc: "Macchine e manutenzioni",  color: RED },
  { icon: CalendarDays, label: "Calendario", path: "/calendario", desc: "Pianificazione",        color: BLUE },
  { icon: BarChart3, label: "Report",     path: "/report",     desc: "Enterprise Metrics",       color: GREEN },
  { icon: Bot,       label: "AI",         path: "/ai",         desc: "Explainable AI",           color: GOLD },
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

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}
          >
            {greeting}, {userName}
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>
            Ecco la panoramica della tua azienda —{" "}
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="UTILE NETTO"
          value={kpi ? fmt(kpi.utileNetto) : "—"}
          sub="mese corrente"
          trend={kpi && kpi.utileNetto >= 0 ? "up" : "down"}
          color={kpi && kpi.utileNetto >= 0 ? GREEN : RED}
          icon={TrendingUp}
          loading={kpiLoading}
        />
        <KpiCard
          label="ENTRATE"
          value={kpi ? fmt(kpi.entrate) : "—"}
          sub="mese corrente"
          trend="up"
          color={GREEN}
          icon={ArrowDownRight}
          loading={kpiLoading}
        />
        <KpiCard
          label="USCITE"
          value={kpi ? fmt(kpi.uscite) : "—"}
          sub="mese corrente"
          trend="down"
          color={RED}
          icon={ArrowUpRight}
          loading={kpiLoading}
        />
        <KpiCard
          label="CAMPI ATTIVI"
          value={kpi ? String(kpi.campiAttivi) : "—"}
          sub="appezzamenti"
          trend="neutral"
          color={GREEN}
          icon={Sprout}
          loading={kpiLoading}
        />
      </div>

      {/* Alert banner */}
      {kpi && (kpi.macchineFerme > 0 || kpi.prodottiSottoScorta > 0 || kpi.interventiAperti > 0) && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "oklch(0.72 0.15 75 / 0.08)", border: "1px solid oklch(0.72 0.15 75 / 0.2)" }}
        >
          <AlertTriangle size={16} style={{ color: GOLD, flexShrink: 0 }} />
          <div className="flex flex-wrap gap-4" style={{ color: "oklch(0.75 0.01 145)" }}>
            {kpi.macchineFerme > 0 && (
              <span>
                <span style={{ color: RED, fontWeight: 600 }}>{kpi.macchineFerme}</span> macchine ferme
              </span>
            )}
            {kpi.interventiAperti > 0 && (
              <span>
                <span style={{ color: GOLD, fontWeight: 600 }}>{kpi.interventiAperti}</span> interventi aperti
              </span>
            )}
            {kpi.prodottiSottoScorta > 0 && (
              <span>
                <span style={{ color: GOLD, fontWeight: 600 }}>{kpi.prodottiSottoScorta}</span> prodotti sotto scorta
              </span>
            )}
          </div>
          <button
            onClick={() => setLocation("/officina")}
            className="ml-auto text-xs font-medium flex items-center gap-1"
            style={{ color: GOLD }}
          >
            Vedi tutte <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Andamento economico */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>
                ANDAMENTO ECONOMICO
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 145)" }}>
                Ultimi 6 mesi
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
                Entrate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: RED }} />
                Uscite
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: BLUE }} />
                Utile
              </span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gEntrate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gUscite" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RED} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gUtile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.008 145)" />
                <XAxis dataKey="mese" tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.13 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, color: "oklch(0.85 0.01 145)", fontSize: 12 }}
                  formatter={(v: any) => [fmt(v), ""]}
                />
                <Area type="monotone" dataKey="entrate" stroke={GREEN} strokeWidth={2} fill="url(#gEntrate)" dot={false} />
                <Area type="monotone" dataKey="uscite" stroke={RED} strokeWidth={2} fill="url(#gUscite)" dot={false} />
                <Area type="monotone" dataKey="utile" stroke={BLUE} strokeWidth={2} fill="url(#gUtile)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center" style={{ color: "oklch(0.4 0.01 145)" }}>
              <div className="text-center">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessun dato disponibile</p>
                <p className="text-xs mt-1">Aggiungi transazioni nel modulo Finanza</p>
              </div>
            </div>
          )}
        </div>

        {/* Attività recenti */}
        <div
          className="rounded-xl p-5"
          style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>
              ATTIVITÀ RECENTI
            </h3>
          </div>
          <div className="space-y-3">
            {(recent && 'transazioni' in recent ? recent.transazioni : []).slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: t.tipo === "entrata" ? "oklch(0.65 0.18 142 / 0.12)" : "oklch(0.55 0.22 25 / 0.12)" }}
                >
                  {t.tipo === "entrata" ? (
                    <ArrowDownRight size={14} style={{ color: GREEN }} />
                  ) : (
                    <ArrowUpRight size={14} style={{ color: RED }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "oklch(0.75 0.01 145)" }}>
                    {t.categoria}
                  </p>
                  <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                    {new Date(t.data).toLocaleDateString("it-IT")}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold shrink-0"
                  style={{ color: t.tipo === "entrata" ? GREEN : RED }}
                >
                  {t.tipo === "entrata" ? "+" : "-"}{fmt(Number(t.importo))}
                </span>
              </div>
            ))}
            {(recent && 'interventi' in recent ? recent.interventi : []).slice(0, 2).map((i: any) => (
              <div key={`iv-${i.id}`} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.72 0.15 75 / 0.12)" }}
                >
                  <Wrench size={14} style={{ color: GOLD }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "oklch(0.75 0.01 145)" }}>
                    {i.descrizione?.slice(0, 30)}
                  </p>
                  <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                    {i.tipo} · {i.stato}
                  </p>
                </div>
              </div>
            ))}
            {(!(recent && 'transazioni' in recent && recent.transazioni.length) && !(recent && 'interventi' in recent && recent.interventi.length)) && (
              <p className="text-xs text-center py-4" style={{ color: "oklch(0.4 0.01 145)" }}>
                Nessuna attività recente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Moduli rapidi */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>
          Aree principali
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {moduleCards.map(mod => (
            <button
              key={mod.path}
              onClick={() => setLocation(mod.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-150 group"
              style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.13 0.007 145)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${mod.color} / 0.3`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.11 0.006 145)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(0.18 0.008 145)";
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${mod.color}1a` }}
              >
                <mod.icon size={20} style={{ color: mod.color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: "oklch(0.75 0.01 145)" }}>
                {mod.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  color,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | "neutral";
  color: string;
  icon: any;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1a` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded animate-pulse" style={{ background: "oklch(0.15 0.006 145)" }} />
      ) : (
        <div
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)", letterSpacing: "-0.03em" }}
        >
          {value}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {trend === "up" && <ArrowUpRight size={12} style={{ color: GREEN }} />}
        {trend === "down" && <ArrowDownRight size={12} style={{ color: RED }} />}
        <span className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
          {sub}
        </span>
      </div>
    </div>
  );
}
