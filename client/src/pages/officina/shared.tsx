import { Clock, Wrench, CheckCircle2, Zap, AlertTriangle } from "lucide-react";

// Design tokens condivisi col resto di Fallinity (dark + verde/oro)
export const C = {
  green: "oklch(0.65 0.18 142)",
  gold: "oklch(0.72 0.15 75)",
  red: "oklch(0.6 0.22 25)",
  blue: "oklch(0.62 0.15 220)",
  orange: "oklch(0.7 0.18 55)",
  text: "oklch(0.92 0.005 145)",
  textDim: "oklch(0.6 0.01 145)",
  textFaint: "oklch(0.45 0.01 145)",
  panel: "oklch(0.11 0.006 145)",
  panelDark: "oklch(0.10 0.005 145)",
  inner: "oklch(0.09 0.005 145)",
  border: "oklch(0.18 0.008 145)",
  borderSoft: "oklch(0.16 0.007 145)",
  bgDeep: "oklch(0.08 0.005 145)",
};

export const STATO_MACCHINA: Record<string, { label: string; color: string }> = {
  operativo: { label: "Operativo", color: C.green },
  manutenzione: { label: "In manutenzione", color: C.gold },
  fermo: { label: "Fermo", color: C.red },
  riposo: { label: "A riposo", color: C.textDim },
};

export const STATO_INTERVENTO: Record<string, { label: string; color: string; icon: any }> = {
  pianificato: { label: "Pianificato", color: C.gold, icon: Clock },
  in_corso: { label: "In corso", color: C.blue, icon: Wrench },
  straordinario: { label: "Straordinario", color: C.orange, icon: Zap },
  completato: { label: "Completato", color: C.green, icon: CheckCircle2 },
};

export const PRIORITA: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: C.red },
  alta: { label: "Alta", color: C.orange },
  media: { label: "Media", color: C.gold },
  bassa: { label: "Bassa", color: C.textDim },
};

export const TIPO_INTERVENTO_LABEL: Record<string, string> = {
  manutenzione: "Manutenzione",
  riparazione: "Riparazione",
  revisione: "Revisione",
  tagliando: "Tagliando",
  straordinario: "Straordinario",
};

export const CATEGORIE_RICAMBIO = [
  "Filtri olio",
  "Filtri aria",
  "Filtri carburante",
  "Lubrificanti",
  "Idraulica",
  "Elettrico",
  "Freni",
  "Trasmissione",
  "Altro",
] as const;

export const STATO_SCORTA: Record<string, { label: string; color: string }> = {
  disponibile: { label: "Disponibile", color: C.green },
  sotto_scorta: { label: "Sotto scorta", color: C.gold },
  non_disponibile: { label: "Esaurito", color: C.red },
  insufficiente: { label: "Insufficiente", color: C.orange },
  da_ordinare: { label: "Da ordinare", color: C.orange },
  ordinato: { label: "Ordinato", color: C.blue },
};

/** Pill compatta per i codici tracciabili (MEZ-/INT-/RIC-/OPR-). */
export function CodicePill({ codice }: { codice?: string | null }) {
  if (!codice) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
      style={{
        background: "oklch(0.16 0.008 145)",
        color: C.textDim,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
      }}
    >
      {codice}
    </span>
  );
}

export function eur(n: number | string | null | undefined) {
  return `€${Number(n ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function dataIT(d: string | number | Date | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export function healthColor(score: number) {
  if (score >= 75) return C.green;
  if (score >= 45) return C.gold;
  return C.red;
}

/** Anello SVG per l'Health Score. */
export function HealthRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  const col = healthColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.borderSoft} strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color: col, fontFamily: "var(--font-display)" }}>{score}</span>
      </div>
    </div>
  );
}

export function urgenzaIcon(priorita: string) {
  return priorita === "urgente" || priorita === "alta" ? AlertTriangle : Clock;
}
