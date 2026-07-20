import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, AlertTriangle,
  Calendar, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Bar, Line,
} from "recharts";

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

export default function Cashflow() {
  const [, setLocation] = useLocation();
  const [vista, setVista] = useState<"effettivo" | "previsto" | "mensile">("effettivo");
  const [orizzonte, setOrizzonte] = useState(90);

  const oggi = new Date();
  const dataFine = oggi.toISOString().split("T")[0];
  const dataInizio30 = new Date(oggi.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const dataInizio12m = new Date(oggi.getFullYear() - 1, oggi.getMonth(), 1).toISOString().split("T")[0];

  const { data: effettivo, isLoading: loadEff } = trpc.finanza.cashflow.effettivo.useQuery(
    { dataInizio: dataInizio30, dataFine },
    { enabled: vista === "effettivo" }
  );
  const { data: previsto, isLoading: loadPrev } = trpc.finanza.cashflow.previsto.useQuery(
    { orizzonteGiorni: orizzonte },
    { enabled: vista === "previsto" }
  );
  const { data: mensile, isLoading: loadMens } = trpc.finanza.cashflow.mensile.useQuery(
    { dataInizio: dataInizio12m, dataFine },
    { enabled: vista === "mensile" }
  );

  const effettivoData = useMemo(() => {
    if (!effettivo?.punti) return [];
    return (effettivo.punti as any[]).map((p: any) => ({
      data: String(p.data).substring(5),
      saldo: p.saldoCumulativo,
      entrate: p.entrateEffettive,
      uscite: p.usciteEffettive,
    }));
  }, [effettivo]);

  const previstoData = useMemo(() => {
    if (!previsto?.punti) return [];
    return (previsto.punti as any[]).map((p: any) => ({
      data: String(p.data).substring(5),
      saldo: p.saldoCumulativo,
      entrate: p.entratePrevisione,
      uscite: p.uscitePrevisione,
    }));
  }, [previsto]);

  const mensileData = useMemo(() => {
    if (!mensile?.punti) return [];
    return (mensile.punti as any[]).map((p: any) => ({
      mese: p.mese.substring(5),
      entrate: p.entrate,
      uscite: p.uscite,
      netto: p.netto,
    }));
  }, [mensile]);

  return (
    <div className="space-y-5 animate-fade-in-up pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/finanza")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <p className="fal-eyebrow mb-0.5" style={{ color: GOLD }}>Analisi</p>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Cashflow
          </h1>
        </div>
      </div>

      {/* Vista selector */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "oklch(0.13 0.006 145)" }}>
        {([["effettivo", "Effettivo"], ["previsto", "Previsto"], ["mensile", "Mensile"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)}
            className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
            style={{
              background: vista === v ? "oklch(0.18 0.01 145)" : "transparent",
              color: vista === v ? "oklch(0.9 0.005 145)" : "oklch(0.5 0.01 145)",
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VISTA EFFETTIVO ── */}
      {vista === "effettivo" && (
        <>
          <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Saldo attuale</span>
              <Badge variant="outline" className="text-[10px]">Ultimi 30gg</Badge>
            </div>
            {loadEff ? <Skeleton className="h-8 w-32" /> : (
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold" style={{ color: "oklch(0.95 0.005 145)" }}>
                  {fmt(effettivo?.saldoFinale ?? 0)}
                </p>
                <span className="text-xs font-medium" style={{ color: (effettivo?.variazione ?? 0) >= 0 ? GREEN : RED }}>
                  {(effettivo?.variazione ?? 0) >= 0 ? "+" : ""}{fmt(effettivo?.variazione ?? 0)}
                </span>
              </div>
            )}
          </Card>
          {effettivoData.length > 0 && (
            <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.8 0.005 145)" }}>Andamento Saldo</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={effettivoData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BLUE_HEX} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={BLUE_HEX} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.005 145)" />
                    <XAxis dataKey="data" tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.008 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <ReferenceLine y={0} stroke="oklch(0.3 0.005 145)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="saldo" stroke={BLUE_HEX} fill="url(#gradSaldo)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── VISTA PREVISTO ── */}
      {vista === "previsto" && (
        <>
          {/* Orizzonte selector */}
          <div className="flex items-center gap-2">
            {[30, 60, 90, 180, 365].map(g => (
              <button key={g} onClick={() => setOrizzonte(g)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: orizzonte === g ? "oklch(0.18 0.01 145)" : "oklch(0.13 0.006 145)",
                  color: orizzonte === g ? "oklch(0.9 0.005 145)" : "oklch(0.5 0.01 145)",
                }}>
                {g}gg
              </button>
            ))}
          </div>

          {/* Orizzonti KPI */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "7 giorni", value: previsto?.orizzonti?.["7gg"] },
              { label: "30 giorni", value: previsto?.orizzonti?.["30gg"] },
              { label: "90 giorni", value: previsto?.orizzonti?.["90gg"] },
            ].map(h => (
              <Card key={h.label} className="p-3 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
                <span className="text-[10px]" style={{ color: "oklch(0.5 0.01 145)" }}>{h.label}</span>
                {loadPrev ? <Skeleton className="h-5 w-16 mt-1" /> : (
                  <p className="text-sm font-bold mt-0.5" style={{ color: (h.value ?? 0) >= 0 ? GREEN : RED }}>
                    {fmt(h.value ?? 0)}
                  </p>
                )}
              </Card>
            ))}
          </div>

          {/* Punto minimo alert */}
          {previsto?.puntoMinimo?.saldo !== undefined && previsto.puntoMinimo.saldo < 0 && (
            <Card className="p-3 border-0 flex items-center gap-3" style={{ background: "oklch(0.11 0.006 145)", borderLeft: `3px solid ${RED}` }}>
              <AlertTriangle size={16} style={{ color: RED }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: RED }}>Saldo negativo previsto</p>
                <p className="text-[10px]" style={{ color: "oklch(0.55 0.01 145)" }}>
                  {fmt(previsto.puntoMinimo.saldo)} il {previsto.puntoMinimo.data}
                </p>
              </div>
            </Card>
          )}

          {/* Grafico previsione */}
          {previstoData.length > 0 && (
            <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.8 0.005 145)" }}>Proiezione Saldo</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={previstoData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD_HEX} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GOLD_HEX} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.005 145)" />
                    <XAxis dataKey="data" tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.008 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <ReferenceLine y={0} stroke={RED_HEX} strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="saldo" stroke={GOLD_HEX} fill="url(#gradPrev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Riepilogo entrate/uscite attese */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
              <span className="text-[10px]" style={{ color: "oklch(0.5 0.01 145)" }}>Entrate attese</span>
              <p className="text-sm font-bold mt-0.5" style={{ color: GREEN }}>
                {fmt(previsto?.totaleEntrateAttese ?? 0)}
              </p>
            </Card>
            <Card className="p-3 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
              <span className="text-[10px]" style={{ color: "oklch(0.5 0.01 145)" }}>Uscite attese</span>
              <p className="text-sm font-bold mt-0.5" style={{ color: RED }}>
                {fmt(previsto?.totaleUsciteAttese ?? 0)}
              </p>
            </Card>
          </div>
        </>
      )}

      {/* ── VISTA MENSILE ── */}
      {vista === "mensile" && (
        <>
          <Card className="p-4 border-0" style={{ background: "oklch(0.11 0.006 145)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.8 0.005 145)" }}>Flusso Mensile (12 mesi)</h3>
            {loadMens ? <Skeleton className="h-[200px]" /> : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mensileData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.005 145)" />
                    <XAxis dataKey="mese" tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "oklch(0.5 0.01 145)" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.008 145)", border: "1px solid oklch(0.22 0.01 145)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <ReferenceLine y={0} stroke="oklch(0.3 0.005 145)" strokeDasharray="3 3" />
                    <Bar dataKey="entrate" fill={GREEN_HEX} radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Bar dataKey="uscite" fill={RED_HEX} radius={[3, 3, 0, 0]} opacity={0.7} />
                    <Line type="monotone" dataKey="netto" stroke={GOLD_HEX} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
