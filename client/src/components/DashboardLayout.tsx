import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Home,
  LogOut,
  Package,
  Settings,
  Sprout,
  Tractor,
  Wallet,
  Bell,
  Activity,
  RefreshCw,
  Grid3x3,
  X,
  Users,
  Building,
  ShieldCheck,
  DatabaseBackup,
  LifeBuoy,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { FallinityHeader, FallinityBottomNavigation } from "./fallinity";

// Funzioni di sistema dell'hub "Altro" (alcune in arrivo nelle prossime release)
type SystemItem = { icon: typeof Home; label: string; path?: string; soon?: boolean };
const systemItems: SystemItem[] = [
  { icon: BarChart3,   label: "Report",            path: "/report" },
  { icon: Bot,         label: "AI Copilot",        path: "/ai" },
  { icon: Users,       label: "Gestione utenti",   soon: true },
  { icon: Building,    label: "Gestione aziende",  soon: true },
  { icon: Settings,    label: "Impostazioni",      soon: true },
  { icon: ShieldCheck, label: "Audit log",         soon: true },
  { icon: DatabaseBackup, label: "Backup",          soon: true },
  { icon: LifeBuoy,    label: "Supporto",          soon: true },
];
// Moduli operativi accessibili anche dall'hub (oltre che da Azienda)
const operativePaths = ["/campi", "/magazzino", "/officina", "/calendario", "/stalla"];

const LOGO_URL = "/manus-storage/fallinity-logo_8c31d682.png";

const GREEN = "oklch(0.65 0.18 142)";
const TEXT_DIM = "oklch(0.5 0.01 145)";
const TEXT_BRIGHT = "oklch(0.9 0.01 145)";
const PANEL = "oklch(0.09 0.006 145)";
const BORDER = "oklch(0.18 0.008 145)";
const GOLD = "oklch(0.72 0.15 75)";

type MenuItem = { icon: typeof Home; label: string; path: string; desc: string };

const allItems: MenuItem[] = [
  { icon: Home,        label: "Home",       path: "/",           desc: "Dashboard principale" },
  { icon: Building2,   label: "Azienda",    path: "/azienda",    desc: "Anagrafica e contatti" },
  { icon: Wallet,      label: "Finanza",    path: "/finanza",    desc: "Entrate, uscite, budget" },
  { icon: Sprout,      label: "Campi",      path: "/campi",      desc: "Appezzamenti e colture" },
  { icon: Package,     label: "Magazzino",  path: "/magazzino",  desc: "Scorte e movimenti" },
  { icon: Tractor,     label: "Officina",   path: "/officina",   desc: "Macchine e manutenzioni" },
  { icon: CalendarDays,label: "Calendario", path: "/calendario", desc: "Pianificazione attività" },
  { icon: BarChart3,   label: "Report",     path: "/report",     desc: "Enterprise Metrics" },
  { icon: Bot,         label: "AI",         path: "/ai",         desc: "Assistente Explainable AI" },
  { icon: Activity,    label: "Stalla",     path: "/stalla",     desc: "Gestione animali" },
  { icon: RefreshCw,   label: "Reintegrazione", path: "/reintegrazione", desc: "Fondi macchine" },
];

// Bottom bar definitiva a 4 voci: Home, Azienda, Finanza, Altro.
// Reintegrazione NON e' una voce separata: vive dentro Finanza (tab dedicata).
const primaryPaths = ["/", "/azienda", "/finanza"];
const primaryItems = primaryPaths.map(p => allItems.find(i => i.path === p)!);
// Drawer "Altro": sezione moduli operativi (sotto-aree di Azienda) + sezione sistema/strumenti.
const moreItems = allItems.filter(i => operativePaths.includes(i.path));
const systemPaths = systemItems.filter(s => s.path).map(s => s.path!);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-sm w-full text-center">
          <img src={LOGO_URL} alt="Fallinity" className="w-32 h-auto" />
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Bentornato in Fallinity</h1>
            <p className="text-sm text-muted-foreground">
              Accedi al tuo account e gestisci la tua azienda agricola.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Accedi
          </Button>
        </div>
      </div>
    );
  }

  return <FEOSLayout>{children}</FEOSLayout>;
}

function FEOSLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeItem = allItems.find(item => item.path === location);
  const isMoreActive = moreItems.some(i => i.path === location) || systemPaths.includes(location);

  const navigate = (path: string) => {
    setLocation(path);
    setMoreOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top header (componente design-system) */}
      <FallinityHeader
        logoUrl={LOGO_URL}
        subtitle={activeItem?.label ?? "Enterprise OS"}
        onLogoClick={() => navigate("/")}
        actions={
          <>
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: TEXT_DIM }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Bell size={18} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: GREEN, boxShadow: `0 0 4px ${GREEN}` }}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <Avatar className="h-7 w-7 border" style={{ borderColor: "oklch(0.65 0.18 142 / 0.4)" }}>
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: GREEN }}
                    >
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Impostazioni
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Main content (con padding inferiore per la bottom bar) */}
      <main className="flex-1 p-4 sm:p-6 pb-24">{children}</main>

      {/* "Altro" drawer overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t p-4 pb-24 animate-in slide-in-from-bottom duration-300"
            style={{ background: PANEL, borderColor: BORDER }}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="font-semibold text-sm" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)" }}>
                Altro
              </h3>
              <button onClick={() => setMoreOpen(false)} className="p-1 rounded-md" style={{ color: TEXT_DIM }}>
                <X size={18} />
              </button>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              {/* Sezione 1: moduli operativi (sotto-aree di Azienda, accesso rapido) */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: GOLD }}>Moduli operativi</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {moreItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150 active:scale-[0.97]"
                        style={{
                          background: isActive ? "oklch(0.65 0.18 142 / 0.12)" : "oklch(0.12 0.008 145)",
                          border: isActive ? `1px solid ${GREEN}` : "1px solid transparent",
                        }}
                      >
                        <item.icon size={22} style={{ color: isActive ? GREEN : TEXT_DIM }} />
                        <span className="text-xs font-medium text-center leading-tight" style={{ color: isActive ? GREEN : "oklch(0.7 0.01 145)" }}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sezione 2: sistema & strumenti */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: GOLD }}>Sistema & Strumenti</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {systemItems.map(item => {
                    const isActive = !!item.path && location === item.path;
                    return (
                      <button
                        key={item.label}
                        onClick={() => item.path ? navigate(item.path) : toast.info(`${item.label} — disponibile in una prossima release`)}
                        className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150 active:scale-[0.97]"
                        style={{
                          background: isActive ? "oklch(0.65 0.18 142 / 0.12)" : "oklch(0.12 0.008 145)",
                          border: isActive ? `1px solid ${GREEN}` : "1px solid transparent",
                          opacity: item.soon ? 0.7 : 1,
                        }}
                      >
                        {item.soon && (
                          <span className="absolute top-1 right-1 text-[8px] px-1 rounded" style={{ background: "oklch(0.2 0.008 145)", color: GOLD }}>soon</span>
                        )}
                        <item.icon size={22} style={{ color: isActive ? GREEN : TEXT_DIM }} />
                        <span className="text-xs font-medium text-center leading-tight" style={{ color: isActive ? GREEN : "oklch(0.7 0.01 145)" }}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar (componente design-system) */}
      <FallinityBottomNavigation
        items={primaryItems.map(i => ({ icon: i.icon, label: i.label, path: i.path }))}
        activePath={location}
        onNavigate={navigate}
        onMore={() => setMoreOpen(true)}
        moreActive={isMoreActive}
        moreIcon={Grid3x3}
      />
    </div>
  );
}
