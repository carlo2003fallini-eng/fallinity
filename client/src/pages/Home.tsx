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
import { FallinityInsightCard, FallinityMissionCard, FallinityEmptyState } from "@/components/fallinity";
import { CalendarCheck, CheckCircle2 } from "lucide-react";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";
const GREEN_HEX = "#4ade80";
const RED_HEX = "#f87171";
const BLUE_HEX = "#60a5fa";

const fmt = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);



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
  const { data: todayData } = trpc.calendario.today.useQuery();
  const eventiOggi: any[] = Array.isArray(todayData) ? todayData : ((todayData as any)?.eventi ?? []);

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



  const utile = kpi?.utile ?? 0;
  const entrate = kpi?.entrate ?? 0;
  const uscite = kpi?.uscite ?? 0;
  const cashflow = entrate - uscite;
  const margine = entrate > 0 ? (utile / entrate) * 100 : 0;
  const fondo = fondoTot?.totale ?? 0;
  const zoppieAttive = (kpi as any)?.zoppieAttive ?? 0;

  // ── Missione di oggi: attività prioritarie + avanzamento ──
  const missioneItems = [
    (kpi?.interventiAperti ?? 0) > 0,
    (kpi?.prodottiSottoScorta ?? 0) > 0,
    zoppieAttive > 0,
    eventiOggi.length > 0,
  ];
  const missione = (() => {
    const totale = missioneItems.filter(Boolean).length;
    // "completate" = priorità risolte (qui derivate: eventi già segnati completati)
    const completate = eventiOggi.filter((e: any) => e.completato).length;
    const pct = totale > 0 ? Math.round((completate / totale) * 100) : 0;
    return { totale, completate, pct };
  })();

  // ── Alert cross-modulo: Officina, Magazzino, Stalla, Finanza ──
  const alerts: { value: number | string; label: string; color: string; path: string }[] = [];
  if ((kpi?.interventiAperti ?? 0) > 0) alerts.push({ value: kpi!.interventiAperti, label: "interventi aperti", color: GOLD, path: "/officina" });
  if ((kpi?.prodottiSottoScorta ?? 0) > 0) alerts.push({ value: kpi!.prodottiSottoScorta, label: "prodotti sotto scorta", color: GOLD, path: "/magazzino" });
  if (zoppieAttive > 0) alerts.push({ value: zoppieAttive, label: "zoppie da trattare", color: GOLD, path: "/stalla" });
  if (utile < 0) alerts.push({ value: fmt(utile), label: "utile negativo nel mese", color: RED, path: "/finanza" });
  const proposteDaEsaminare = (kpi as any)?.proposteDaEsaminare ?? 0;
  if (proposteDaEsaminare > 0) alerts.push({ value: proposteDaEsaminare, label: "proposte da esaminare", color: "oklch(0.65 0.15 280)", path: "/finanza/proposte" });

  // ── Insight AI contestuale ──


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



      {/* ── CALENDARIO OGGI + MISSIONE DI OGGI ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FallinityInsightCard
          title="Oggi in agenda"
          subtitle={now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          legend={
            <button onClick={() => setLocation("/calendario")} className="text-xs font-medium flex items-center gap-1" style={{ color: BLUE }}>
              Apri Calendario <ChevronRight size={13} />
            </button>
          }
        >
          {eventiOggi.length === 0 ? (
            <FallinityEmptyState
              icon={CalendarCheck}
              color={BLUE}
              title="Nessun evento per oggi"
              description="Pianifica attività, scadenze o promemoria dal Calendario."
            />
          ) : (
            <div className="space-y-2.5">
              {eventiOggi.slice(0, 5).map((ev: any, i: number) => (
                <div key={ev.id ?? i} className="flex items-center gap-3">
                  <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: BLUE }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{ev.titolo ?? ev.descrizione ?? "Evento"}</p>
                    <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                      {ev.tipo ?? "attività"}{ev.ora ? ` · ${ev.ora}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FallinityInsightCard>

        <FallinityInsightCard
          title="Missione di oggi"
          subtitle={missione.totale > 0 ? `${missione.completate}/${missione.totale} completate` : "Tutto sotto controllo"}
        >
          {/* Barra di avanzamento */}
          {missione.totale > 0 && (
            <div className="mb-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.18 0.008 145)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${missione.pct}%`, background: missione.pct === 100 ? GREEN : GOLD }} />
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            {(kpi?.interventiAperti ?? 0) > 0 && (
              <FallinityMissionCard
                icon={Wrench}
                accent={GOLD}
                title={`${kpi?.interventiAperti} interventi da gestire`}
                detail="Officina · manutenzioni aperte"
                onClick={() => setLocation("/officina")}
              />
            )}
            {(kpi?.prodottiSottoScorta ?? 0) > 0 && (
              <FallinityMissionCard
                icon={Package}
                accent={GOLD}
                title={`${kpi?.prodottiSottoScorta} prodotti sotto scorta`}
                detail="Magazzino · da riordinare"
                onClick={() => setLocation("/magazzino")}
              />
            )}
            {zoppieAttive > 0 && (
              <FallinityMissionCard
                icon={Activity}
                accent={GOLD}
                title={`${zoppieAttive} zoppie da trattare`}
                detail="Stalla · benessere animale"
                onClick={() => setLocation("/stalla")}
              />
            )}
            {eventiOggi.length > 0 && (
              <FallinityMissionCard
                icon={CalendarCheck}
                accent={BLUE}
                title={`${eventiOggi.length} eventi in agenda`}
                detail="Calendario · attività di oggi"
                onClick={() => setLocation("/calendario")}
              />
            )}
            {missione.totale === 0 && (
              <FallinityEmptyState
                icon={CheckCircle2}
                color={GREEN}
                title="Nessuna azione urgente"
                description="Non ci sono attività prioritarie per oggi. Buon lavoro."
              />
            )}
          </div>
        </FallinityInsightCard>
      </div>

      {/* ── ALERT BANNER (Officina/Magazzino/Stalla/Finanza) ───────────────── */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: "oklch(0.72 0.15 75 / 0.07)", border: "1px solid oklch(0.72 0.15 75 / 0.25)" }}>
          <AlertTriangle size={15} style={{ color: GOLD, flexShrink: 0 }} />
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "oklch(0.7 0.01 145)" }}>
            {alerts.map((a, i) => (
              <span key={i}><span style={{ color: a.color, fontWeight: 700 }}>{a.value}</span> {a.label}</span>
            ))}
          </div>
          <button onClick={() => setLocation(alerts[0].path)} className="ml-auto text-xs font-medium flex items-center gap-1" style={{ color: GOLD }}>
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
        <FallinityInsightCard
          className="lg:col-span-2"
          title="Andamento Economico"
          subtitle="Ultimi 6 mesi"
          legend={
            <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
              {[["Entrate", GREEN_HEX], ["Uscite", RED_HEX], ["Utile", BLUE_HEX]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          }
        >
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
            <div className="h-[220px] flex items-center justify-center flex-col gap-2 text-center px-6" style={{ color: "oklch(0.4 0.01 145)" }}>
              <BarChart3 size={32} className="opacity-20" />
              <p className="text-sm font-medium" style={{ color: "oklch(0.6 0.01 145)" }}>Nessun andamento da mostrare</p>
              <p className="text-xs">Aggiungi transazioni in Finanza per vedere il trend economico.</p>
            </div>
          )}
        </FallinityInsightCard>


      </div>



    </div>
  );
}
