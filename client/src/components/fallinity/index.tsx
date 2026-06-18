import { ReactNode } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";

/**
 * Fallinity Design System — componenti riutilizzabili.
 * Estraggono i pattern UI premium (precedentemente inline) in componenti tipizzati,
 * mantenendo le classi CSS condivise (fal-card, fal-hero, kpi-number, ...) come fondamento.
 */

const FALLINITY_COLORS = {
  green: "oklch(0.65 0.18 142)",
  gold: "oklch(0.72 0.15 75)",
  red: "oklch(0.55 0.22 25)",
  blue: "oklch(0.6 0.15 220)",
} as const;

export type FallinityColor = keyof typeof FALLINITY_COLORS;

export function falColor(c: FallinityColor | string): string {
  return (FALLINITY_COLORS as Record<string, string>)[c] ?? c;
}

const TEXT_PRIMARY = "oklch(0.95 0.005 145)";
const TEXT_MUTED = "oklch(0.45 0.01 145)";

// ─── FallinitySection ──────────────────────────────────────────────────────────
export function FallinitySection({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            {eyebrow && <p className="fal-eyebrow mb-1">{eyebrow}</p>}
            {title && (
              <h2
                className="text-lg font-semibold"
                style={{ color: "oklch(0.9 0.01 145)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
              >
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── FallinityKpiCard ───────────────────────────────────────────────────────────
export function FallinityKpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "green",
  glow,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: LucideIcon;
  color?: FallinityColor | string;
  glow?: "green" | "gold" | "blue" | "red";
  onClick?: () => void;
}) {
  const c = falColor(color);
  const glowClass = glow ? `fal-glow-${glow}` : "";
  return (
    <div
      className={`fal-card fal-card-hover ${glowClass} p-5 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wider" style={{ color: TEXT_MUTED }}>{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c}1a` }}>
            <Icon size={15} style={{ color: c }} />
          </div>
        )}
      </div>
      <div className="kpi-number" style={{ color: TEXT_PRIMARY }}>{value}</div>
      {sub && <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>{sub}</p>}
    </div>
  );
}

// ─── FallinityModuleCard ────────────────────────────────────────────────────────
export function FallinityModuleCard({
  label,
  description,
  value,
  icon: Icon,
  color = "green",
  image,
  onClick,
}: {
  label: string;
  description?: string;
  value?: ReactNode;
  icon?: LucideIcon;
  color?: FallinityColor | string;
  image?: string;
  onClick?: () => void;
}) {
  const c = falColor(color);
  return (
    <div
      className={`fal-card fal-card-hover ${image ? "fal-img-overlay" : ""} relative overflow-hidden p-5 ${onClick ? "cursor-pointer" : ""}`}
      style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${c}26`, backdropFilter: "blur(8px)" }}>
              <Icon size={17} style={{ color: c }} />
            </div>
          )}
          <span className="font-semibold" style={{ color: TEXT_PRIMARY, fontFamily: "var(--font-display)" }}>{label}</span>
        </div>
        {onClick && <ChevronRight size={18} style={{ color: "oklch(0.6 0.01 145)" }} />}
      </div>
      {value != null && <div className="relative z-10 kpi-number mt-3" style={{ color: c }}>{value}</div>}
      {description && <p className="relative z-10 text-xs mt-1.5" style={{ color: "oklch(0.6 0.01 145)" }}>{description}</p>}
    </div>
  );
}

// ─── FallinityEntityCard ────────────────────────────────────────────────────────
export function FallinityEntityCard({
  title,
  subtitle,
  badge,
  right,
  onClick,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={`fal-card fal-card-hover p-4 flex items-center gap-3 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate" style={{ color: "oklch(0.9 0.01 145)" }}>{title}</span>
          {badge}
        </div>
        {subtitle && <div className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{subtitle}</div>}
        {children}
      </div>
      {right}
    </div>
  );
}

// ─── FallinityInsightCard ───────────────────────────────────────────────────────
export function FallinityInsightCard({
  title,
  subtitle,
  legend,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`fal-card p-5 ${className}`}>
      {(title || legend) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)", fontFamily: "var(--font-display)" }}>{title}</h3>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>{subtitle}</p>}
          </div>
          {legend}
        </div>
      )}
      {children}
    </div>
  );
}
