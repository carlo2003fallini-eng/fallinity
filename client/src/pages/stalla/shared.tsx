import { Activity, Heart, Baby, Stethoscope, AlertTriangle, Syringe, Milk, Users } from "lucide-react";

// ── Design tokens ──
export const GREEN = "oklch(0.72 0.22 145)";
export const GOLD = "oklch(0.78 0.15 85)";
export const RED = "oklch(0.65 0.22 25)";
export const BLUE = "oklch(0.65 0.18 250)";
export const PURPLE = "oklch(0.65 0.18 300)";
export const ORANGE = "oklch(0.72 0.18 60)";
export const TEAL = "oklch(0.68 0.16 185)";
export const SURFACE = "oklch(0.10 0.006 145)";
export const SURFACE2 = "oklch(0.13 0.007 145)";
export const BORDER = "oklch(0.18 0.008 145)";

// ── Stati produttivi ──
export const STATO_PRODUTTIVO: Record<string, { label: string; color: string }> = {
  in_lattazione: { label: "In lattazione", color: GREEN },
  asciutta: { label: "Asciutta", color: GOLD },
  rimonta: { label: "Rimonta", color: BLUE },
  vitello: { label: "Vitello", color: TEAL },
  manza: { label: "Manza", color: PURPLE },
  riformata: { label: "Riformata", color: ORANGE },
  venduta: { label: "Venduta", color: "oklch(0.50 0.01 145)" },
  deceduta: { label: "Deceduta", color: "oklch(0.35 0.008 145)" },
};

// ── Stati riproduttivi ──
export const STATO_RIPRODUTTIVO: Record<string, { label: string; color: string }> = {
  vuota: { label: "Vuota", color: "oklch(0.55 0.01 145)" },
  inseminata: { label: "Inseminata", color: BLUE },
  gravida: { label: "Gravida", color: PURPLE },
  da_controllare: { label: "Da controllare", color: ORANGE },
  persa: { label: "Persa", color: RED },
  non_idonea: { label: "Non idonea", color: "oklch(0.45 0.01 145)" },
};

// ── Tipologie gruppo ──
export const TIPOLOGIA_GRUPPO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  lattazione: { label: "Lattazione", color: GREEN, icon: Milk },
  asciutta: { label: "Asciutta", color: GOLD, icon: Activity },
  rimonta: { label: "Rimonta", color: BLUE, icon: Users },
  infermeria: { label: "Infermeria", color: RED, icon: Stethoscope },
  vitelli: { label: "Vitelli", color: TEAL, icon: Baby },
  manze: { label: "Manze", color: PURPLE, icon: Heart },
  pre_parto: { label: "Pre-parto", color: ORANGE, icon: AlertTriangle },
  post_parto: { label: "Post-parto", color: GOLD, icon: Syringe },
  personalizzato: { label: "Personalizzato", color: "oklch(0.55 0.01 145)", icon: Users },
};

// ── Badge stato ──
export function StatoBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1" style={{ background: `${color}15`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── Health ring mini ──
export function HealthDot({ score }: { score: number | null | undefined }) {
  const s = score ?? 100;
  const color = s >= 80 ? GREEN : s >= 60 ? GOLD : RED;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {s}
    </span>
  );
}

// ── Codice pill ──
export function CodicePill({ codice }: { codice?: string | null }) {
  if (!codice) return null;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "oklch(0.15 0.008 145)", color: "oklch(0.55 0.01 145)" }}>
      {codice}
    </span>
  );
}
