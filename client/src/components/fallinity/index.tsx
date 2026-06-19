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


// ─── FallinityHeroCard ──────────────────────────────────────────────────────────
// Card "eroe" dominante (es. Utile Netto in Home, Totale Fondi in Reintegrazione).
export function FallinityHeroCard({
  eyebrow,
  value,
  label,
  trend,
  accent = "green",
  image,
  footer,
  children,
}: {
  eyebrow?: string;
  value: ReactNode;
  label?: string;
  trend?: { positive: boolean; text: string };
  accent?: FallinityColor | string;
  image?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const c = falColor(accent);
  return (
    <div
      className="fal-hero relative overflow-hidden rounded-3xl p-6"
      style={
        image
          ? { backgroundImage: `linear-gradient(160deg, oklch(0.18 0.02 150 / 0.92), oklch(0.12 0.02 150 / 0.96)), url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <div
        className="absolute -right-10 -top-10 w-44 h-44 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: c }}
      />
      <div className="relative z-10">
        {eyebrow && <p className="fal-eyebrow mb-2">{eyebrow}</p>}
        <div className="kpi-number-xl" style={{ color: TEXT_PRIMARY, lineHeight: 1 }}>{value}</div>
        {label && <p className="text-sm mt-2" style={{ color: "oklch(0.7 0.01 145)" }}>{label}</p>}
        {trend && (
          <div
            className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: trend.positive ? "oklch(0.65 0.18 142 / 0.15)" : "oklch(0.55 0.22 25 / 0.15)",
              color: trend.positive ? FALLINITY_COLORS.green : FALLINITY_COLORS.red,
            }}
          >
            {trend.text}
          </div>
        )}
        {children}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}

// ─── FallinityChartCard ─────────────────────────────────────────────────────────
// Wrapper per grafici (Recharts) con header e legenda coerenti.
export function FallinityChartCard({
  title,
  subtitle,
  legend,
  height = 220,
  children,
}: {
  title?: string;
  subtitle?: string;
  legend?: ReactNode;
  height?: number;
  children: ReactNode;
}) {
  return (
    <FallinityInsightCard title={title} subtitle={subtitle} legend={legend}>
      <div style={{ width: "100%", height }}>{children}</div>
    </FallinityInsightCard>
  );
}

// ─── FallinityEmptyState ────────────────────────────────────────────────────────
// Stato vuoto ricco: icona, titolo, descrizione e CTA opzionale.
export function FallinityEmptyState({
  icon: Icon,
  title,
  description,
  action,
  color = "green",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  color?: FallinityColor | string;
}) {
  const c = falColor(color);
  return (
    <div className="fal-card flex flex-col items-center justify-center text-center py-10 px-6">
      {Icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: `${c}1f` }}
        >
          <Icon size={26} style={{ color: c }} />
        </div>
      )}
      <h3 className="font-semibold text-base" style={{ color: "oklch(0.9 0.01 145)", fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm mt-1.5 max-w-xs" style={{ color: TEXT_MUTED }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── FallinityMissionCard ───────────────────────────────────────────────────────
// "Missione di oggi": evidenzia l'azione prioritaria del giorno con stato.
export function FallinityMissionCard({
  icon: Icon,
  title,
  detail,
  done,
  accent = "gold",
  onClick,
}: {
  icon?: LucideIcon;
  title: string;
  detail?: string;
  done?: boolean;
  accent?: FallinityColor | string;
  onClick?: () => void;
}) {
  const c = falColor(accent);
  return (
    <div
      className={`fal-card fal-card-hover p-4 flex items-center gap-3.5 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      style={{ borderLeft: `3px solid ${done ? FALLINITY_COLORS.green : c}` }}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c}1f` }}>
          <Icon size={18} style={{ color: c }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="font-medium truncate"
          style={{ color: "oklch(0.9 0.01 145)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}
        >
          {title}
        </p>
        {detail && <p className="text-xs mt-0.5 truncate" style={{ color: TEXT_MUTED }}>{detail}</p>}
      </div>
      {done && (
        <span className="text-xs font-semibold" style={{ color: FALLINITY_COLORS.green }}>Fatto</span>
      )}
    </div>
  );
}


// ─── FallinityBottomNavigation ──────────────────────────────────────────────────
// Bottom bar mobile-first a N voci primarie + bottone "Altro". Componente di presentazione:
// la logica di routing resta nel layout che lo usa.
export type FalNavItem = { icon: LucideIcon; label: string; path: string };

export function FallinityBottomNavigation({
  items,
  activePath,
  onNavigate,
  onMore,
  moreActive,
  moreIcon: MoreIcon,
}: {
  items: FalNavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  onMore: () => void;
  moreActive?: boolean;
  moreIcon: LucideIcon;
}) {
  const GREEN = FALLINITY_COLORS.green;
  const DIM = "oklch(0.5 0.01 145)";
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around h-16 border-t"
      style={{
        background: "oklch(0.08 0.006 145 / 0.97)",
        borderColor: "oklch(0.18 0.008 145)",
        backdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((item) => {
        const isActive = activePath === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 relative"
            style={{ color: isActive ? GREEN : DIM }}
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }}
              />
            )}
            <Icon size={20} style={{ transform: isActive ? "scale(1.05)" : "scale(1)" }} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onMore}
        className="flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 relative"
        style={{ color: moreActive ? GREEN : DIM }}
      >
        {moreActive && (
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
            style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }}
          />
        )}
        <MoreIcon size={20} />
        <span className="text-[10px] font-medium">Altro</span>
      </button>
    </nav>
  );
}

// ─── FallinityHeader ────────────────────────────────────────────────────────────
// Header sticky con logo + sottotitolo contestuale + slot azioni a destra.
export function FallinityHeader({
  logoUrl,
  subtitle,
  onLogoClick,
  actions,
}: {
  logoUrl: string;
  subtitle?: string;
  onLogoClick?: () => void;
  actions?: ReactNode;
}) {
  const GREEN = FALLINITY_COLORS.green;
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-14 border-b"
      style={{
        background: "oklch(0.09 0.006 145 / 0.95)",
        borderColor: "oklch(0.18 0.008 145)",
        backdropFilter: "blur(12px)",
      }}
    >
      <button onClick={onLogoClick} className="flex items-center gap-2.5">
        <img src={logoUrl} alt="Fallinity" className="w-8 h-8 object-contain" />
        <div className="text-left">
          <div
            className="font-bold text-base tracking-tight leading-none"
            style={{ fontFamily: "var(--font-display)", color: "oklch(0.9 0.01 145)" }}
          >
            FALLINITY
          </div>
          {subtitle && (
            <div className="text-[10px] leading-tight" style={{ color: GREEN }}>
              {subtitle}
            </div>
          )}
        </div>
      </button>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
