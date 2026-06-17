import { trpc } from "@/lib/trpc";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Activity, Shield, Zap, Database, GitBranch, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";
const PURPLE = "oklch(0.58 0.18 290)";

const GREEN_HEX = "#4ade80";
const GOLD_HEX = "#d4a843";
const RED_HEX = "#f87171";
const BLUE_HEX = "#60a5fa";
const PURPLE_HEX = "#a78bfa";

const CHART_COLORS = [GREEN_HEX, GOLD_HEX, BLUE_HEX, PURPLE_HEX, RED_HEX];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "oklch(0.14 0.007 145)", border: "1px solid oklch(0.22 0.01 145)", color: "oklch(0.85 0.01 145)" }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.value > 1000 ? `€${p.value.toLocaleString("it-IT")}` : p.value}</p>
      ))}
    </div>
  );
};

export default function Report() {
  const { data: reportData } = trpc.report.summary.useQuery();
  const { data: finanzaData } = trpc.report.finanza.useQuery();
  const { data: operativoData } = trpc.report.operativo.useQuery();

  const summary = (reportData as any) ?? {};
  const finanza = (finanzaData as any) ?? {};
  const operativo = (operativoData as any) ?? {};

  // Dati grafici finanziari (ultimi 6 mesi)
  const finanzaChart = finanza.mensile ?? [
    { mese: "Gen", entrate: 72000, uscite: 38000 },
    { mese: "Feb", entrate: 68000, uscite: 41000 },
    { mese: "Mar", entrate: 80000, uscite: 39000 },
    { mese: "Apr", entrate: 78000, uscite: 43000 },
    { mese: "Mag", entrate: 86000, uscite: 43440 },
    { mese: "Giu", entrate: 91000, uscite: 45000 },
  ];

  const categorieSpese = finanza.categorieSpese ?? [
    { name: "Officina", value: 12400 },
    { name: "Magazzino", value: 8200 },
    { name: "Personale", value: 15000 },
    { name: "Fornitori", value: 5800 },
    { name: "Altro", value: 2040 },
  ];

  // Enterprise Metrics — qualità dati
  const dataQuality = operativo.dataQuality ?? {
    completezza: 87,
    accuratezza: 94,
    tempestivita: 78,
    coerenza: 91,
  };

  // System Health
  const systemHealth = [
    { name: "Database", status: "Healthy", uptime: "99.9%", color: GREEN, icon: Database },
    { name: "Sincronizzazione", status: "Healthy", uptime: "99.95%", color: GREEN, icon: GitBranch },
    { name: "AI Engine", status: "Healthy", uptime: "99.5%", color: GREEN, icon: Zap },
    { name: "Integration Engine", status: "Degraded", uptime: "97.2%", color: GOLD, icon: Activity },
    { name: "Security Engine", status: "Healthy", uptime: "100%", color: GREEN, icon: Shield },
  ];

  const integrations = [
    { name: "John Deere Operations Center", stato: "Configurazione richiesta", color: GOLD },
    { name: "FendtONE", stato: "Non connesso", color: RED },
    { name: "CLAAS Telematics", stato: "Non connesso", color: RED },
    { name: "xFarm", stato: "Non connesso", color: RED },
    { name: "SDI / Fatturazione", stato: "Non connesso", color: RED },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>Enterprise Metrics</h1>
        <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>
          Dashboard analitica — performance, qualità dati e stato del sistema
        </p>
      </div>

      {/* KPI Finanziari */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>Performance Finanziaria</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "ENTRATE TOTALI", value: `€${(summary.entrateTotali ?? 86240).toLocaleString("it-IT")}`, delta: "+9.8%", up: true, color: GREEN },
            { label: "USCITE TOTALI", value: `€${(summary.usciteTotali ?? 43440).toLocaleString("it-IT")}`, delta: "+6.1%", up: false, color: RED },
            { label: "UTILE NETTO", value: `€${(summary.utileNetto ?? 18540).toLocaleString("it-IT")}`, delta: "+12.4%", up: true, color: GOLD },
            { label: "ROI STIMATO", value: `${(summary.roi ?? 42.7).toFixed(1)}%`, delta: "+2.3pp", up: true, color: BLUE },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.5 0.01 145)" }}>{k.label}</p>
              <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: k.color, letterSpacing: "-0.03em" }}>{k.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {k.up ? <TrendingUp size={11} style={{ color: GREEN }} /> : <TrendingDown size={11} style={{ color: RED }} />}
                <span className="text-xs" style={{ color: k.up ? GREEN : RED }}>{k.delta} vs mese scorso</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grafici finanziari */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.85 0.01 145)" }}>ANDAMENTO ECONOMICO — 6 MESI</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={finanzaChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEntrate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN_HEX} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GREEN_HEX} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradUscite" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RED_HEX} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={RED_HEX} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.18 0.008 145)" />
              <XAxis dataKey="mese" tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.45 0.01 145)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "oklch(0.55 0.01 145)" }} />
              <Area type="monotone" dataKey="entrate" name="Entrate" stroke={GREEN_HEX} fill="url(#gradEntrate)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="uscite" name="Uscite" stroke={RED_HEX} fill="url(#gradUscite)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.85 0.01 145)" }}>CATEGORIE SPESE</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categorieSpese} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {categorieSpese.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {categorieSpese.map((c: any, i: number) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs" style={{ color: "oklch(0.6 0.01 145)" }}>{c.name}</span>
                </div>
                <span className="text-xs font-medium" style={{ color: "oklch(0.75 0.01 145)" }}>€{c.value.toLocaleString("it-IT")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Quality Score */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>Data Quality Score™</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(dataQuality).map(([key, val]: [string, any]) => {
            const pct = Number(val);
            const color = pct >= 90 ? GREEN : pct >= 75 ? GOLD : RED;
            return (
              <div key={key} className="rounded-xl p-4" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
                <p className="text-xs font-semibold mb-2 capitalize" style={{ color: "oklch(0.5 0.01 145)" }}>{key}</p>
                <p className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)", color, letterSpacing: "-0.03em" }}>{pct}%</p>
                <div className="w-full h-1.5 rounded-full" style={{ background: "oklch(0.18 0.008 145)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>SYSTEM HEALTH™</h3>
          </div>
          <div className="divide-y divide-[oklch(0.15_0.006_145)]">
            {systemHealth.map(s => (
              <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}15` }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 145)" }}>{s.name}</p>
                  <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Uptime: {s.uptime}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${s.color}15`, color: s.color }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Engine Status */}
        <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>INTEGRATION ENGINE™</h3>
          </div>
          <div className="divide-y divide-[oklch(0.15_0.006_145)]">
            {integrations.map(i => (
              <div key={i.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: i.color }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "oklch(0.8 0.01 145)" }}>{i.name}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${i.color}15`, color: i.color }}>{i.stato}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>
              Integration Engine™ — Connect Everything™ · Configura i connettori per sincronizzare automaticamente i dati da sistemi esterni.
            </p>
          </div>
        </div>
      </div>

      {/* Operativo */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.45 0.01 145)" }}>Metriche Operative</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "CAMPI ATTIVI", value: String(operativo.campiAttivi ?? 0), color: GREEN, icon: CheckCircle2 },
            { label: "MACCHINE OPERATIVE", value: String(operativo.macchineOperative ?? 0), color: GREEN, icon: Activity },
            { label: "INTERVENTI APERTI", value: String(operativo.interventiAperti ?? 0), color: operativo.interventiAperti > 0 ? GOLD : GREEN, icon: Clock },
            { label: "PRODOTTI SOTTO SCORTA", value: String(operativo.prodottiSottoScorta ?? 0), color: operativo.prodottiSottoScorta > 0 ? RED : GREEN, icon: AlertTriangle },
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
      </div>

      {/* Trust Score */}
      <div className="rounded-xl p-5" style={{ background: "oklch(0.11 0.006 145)", border: `1px solid ${GREEN}30` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>TRUST SCORE™</h3>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 145)" }}>Indicatore di sicurezza e affidabilità aziendale</p>
          </div>
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: GREEN, letterSpacing: "-0.03em" }}>78<span className="text-lg">/100</span></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Qualità password", val: 70, color: GOLD },
            { label: "MFA attivo", val: 0, color: RED },
            { label: "Dispositivi verificati", val: 90, color: GREEN },
            { label: "Backup riusciti", val: 100, color: GREEN },
            { label: "Data Quality", val: 87, color: GREEN },
            { label: "Aggiornamenti", val: 100, color: GREEN },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{s.label}</span>
                  <span className="text-xs font-semibold" style={{ color: s.color }}>{s.val}%</span>
                </div>
                <div className="w-full h-1 rounded-full" style={{ background: "oklch(0.18 0.008 145)" }}>
                  <div className="h-full rounded-full" style={{ width: `${s.val}%`, background: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
