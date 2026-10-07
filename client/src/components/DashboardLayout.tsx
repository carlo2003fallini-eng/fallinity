import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getLoginUrl } from "@/const";
import { firstAvailableOperationalPath, firstOperationalPath, hasModule, moduleForPath } from "@/lib/access";
import { trpc } from "@/lib/trpc";
import { BarChart3, Bot, Building2, Home, Wallet, Bell, Grid3x3, X, Users, Building, LifeBuoy, TrendingUp, Settings, ShieldAlert, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { FallinityHeader, FallinityBottomNavigation } from "./fallinity";

const LOGO_URL = "/manus-storage/fallinity-logo_8c31d682.png";
const GREEN = "oklch(0.65 0.18 142)";
const TEXT_DIM = "oklch(0.5 0.01 145)";
const TEXT_BRIGHT = "oklch(0.9 0.01 145)";
const PANEL = "oklch(0.09 0.006 145)";
const BORDER = "oklch(0.18 0.008 145)";
const GOLD = "oklch(0.72 0.15 75)";

type MenuItem = { icon: typeof Home; label: string; path: string; desc: string; area?: "azienda" | "finanza" };
type SystemItem = { icon: typeof Home; label: string; path: string; permission?: string; admin?: boolean; superAdmin?: boolean };

const allItems: MenuItem[] = [
  { icon: Home, label: "Home", path: "/", desc: "Dashboard principale" },
  { icon: Building2, label: "Azienda", path: "/azienda", desc: "Hub operativo", area: "azienda" },
  { icon: Wallet, label: "Finanza", path: "/finanza", desc: "Entrate, uscite, budget", area: "finanza" },
];
const systemItems: SystemItem[] = [
  { icon: BarChart3, label: "Report", path: "/report", permission: "strumenti.report" },
  { icon: Bot, label: "AI", path: "/ai", permission: "strumenti.ai" },
  { icon: TrendingUp, label: "Scenario Futuro", path: "/scenario-futuro", permission: "finanza.pianificazione" },
  { icon: Users, label: "Utenti", path: "/account/utenti", admin: true },
  { icon: Building, label: "Aziende", path: "/super-admin", superAdmin: true },
  { icon: Settings, label: "Impostazioni", path: "/account/impostazioni" },
  { icon: LifeBuoy, label: "Supporto", path: "/account", permission: "strumenti.ai" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex w-full max-w-sm flex-col items-center gap-8 p-8 text-center"><img src={LOGO_URL} alt="Fallinity" className="h-auto w-32" /><div><h1 className="mb-2 text-2xl font-bold text-foreground">Bentornato in Fallinity</h1><p className="text-sm text-muted-foreground">Accedi al tuo account e gestisci la tua azienda agricola.</p></div><Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90">Accedi</Button></div></div>;
  return <FEOSLayout>{children}</FEOSLayout>;
}

function FEOSLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: access, isLoading: accessLoading } = trpc.access.me.useQuery();
  const { data: company } = trpc.company.current.useQuery(undefined, { enabled: Boolean(access?.isSuperAdmin) });
  const modules = access?.modules ?? [];
  const directPath = useMemo(() => firstOperationalPath(modules), [modules]);
  const fallbackOperationalPath = useMemo(() => firstAvailableOperationalPath(modules), [modules]);

  const navigate = (path: string) => { setLocation(path); setMoreOpen(false); };
  useEffect(() => { if (!accessLoading && !access?.isCompanyAdmin && location === "/" && fallbackOperationalPath) navigate(fallbackOperationalPath); }, [accessLoading, access?.isCompanyAdmin, fallbackOperationalPath, location]);

  const canUseArea = (area?: "azienda" | "finanza") => !area || access?.isCompanyAdmin || modules.some((module) => module.startsWith(`${area}.`));
  const primaryItems = allItems.filter((item) => item.path === "/" ? Boolean(access?.isCompanyAdmin) : canUseArea(item.area));
  const systemVisible = systemItems.filter((item) => (!item.admin || access?.isCompanyAdmin) && (!item.superAdmin || access?.isSuperAdmin) && (!item.permission || access?.isCompanyAdmin || hasModule(modules, item.permission as any)));
  const activeItem = allItems.find((item) => item.path === location);
  const isMoreActive = systemVisible.some((item) => location === item.path);
  const requestedModule = moduleForPath(location);
  const isAccountRoute = location.startsWith("/account") || location === "/super-admin";
  const permittedRoute = !requestedModule || access?.isCompanyAdmin || hasModule(modules, requestedModule);

  if (!accessLoading && !isAccountRoute && !permittedRoute) {
    return <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center"><ShieldAlert size={34} style={{ color: GOLD }} /><h1 className="mt-4 text-xl font-bold">Accesso non abilitato</h1><p className="mt-2 max-w-xs text-sm" style={{ color: TEXT_DIM }}>Questa funzione non è inclusa nei tuoi accessi. Contatta l’amministratore della tua azienda.</p><button onClick={() => navigate(directPath || fallbackOperationalPath || "/account")} className="mt-6 rounded-xl px-4 py-3 font-semibold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>Vai alla tua area</button></div>;
  }

  return <div className="flex min-h-screen flex-col bg-background">
    <FallinityHeader logoUrl={LOGO_URL} subtitle={activeItem?.label ?? (location.startsWith("/account") ? "Account" : "Enterprise OS")} onLogoClick={() => navigate("/")} actions={<><button className="relative rounded-lg p-2 transition-colors" style={{ color: TEXT_DIM }} aria-label="Notifiche"><Bell size={18} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 4px ${GREEN}` }} /></button><button onClick={() => navigate("/account")} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors" aria-label="Apri pagina Account"><Avatar className="size-7 border" style={{ borderColor: "oklch(0.65 0.18 142 / 0.4)" }}><AvatarFallback className="text-xs font-semibold" style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: GREEN }}>{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar></button></>} />
    {access?.isSuperAdmin && !location.startsWith("/super-admin") && <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs" style={{ background: `${GOLD}12`, borderColor: `${GOLD}44`, color: GOLD }}><span className="flex min-w-0 items-center gap-2"><ShieldAlert size={14} /><span className="truncate">Modalità Super Admin — {company?.name || "Azienda attiva"}</span></span><button onClick={() => navigate("/super-admin")} className="inline-flex shrink-0 items-center gap-1 font-bold"><ArrowLeft size={13} /> Aziende</button></div>}
    <main className="flex-1 p-4 pb-24 sm:p-6">{children}</main>
    {moreOpen && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} /><div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t p-4 pb-24" style={{ background: PANEL, borderColor: BORDER }}><div className="mb-4 flex items-center justify-between px-1"><h3 className="text-sm font-semibold" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)" }}>Altro</h3><button onClick={() => setMoreOpen(false)} className="rounded-md p-1" style={{ color: TEXT_DIM }}><X size={18} /></button></div><div className="grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4">{systemVisible.map((item) => { const active = location === item.path; return <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-2 rounded-xl p-3 active:scale-[0.97]" style={{ background: active ? "oklch(0.65 0.18 142 / 0.12)" : "oklch(0.12 0.008 145)", border: active ? `1px solid ${GREEN}` : "1px solid transparent" }}><item.icon size={22} style={{ color: active ? GREEN : TEXT_DIM }} /><span className="text-center text-xs font-medium" style={{ color: active ? GREEN : "oklch(0.7 0.01 145)" }}>{item.label}</span></button>; })}</div></div></div>}
    <FallinityBottomNavigation items={primaryItems.map((item) => ({ icon: item.icon, label: item.label, path: item.path }))} activePath={location} onNavigate={navigate} onMore={() => setMoreOpen(true)} moreActive={isMoreActive} moreIcon={Grid3x3} />
  </div>;
}
