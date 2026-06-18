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
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Package,
  Settings,
  Sprout,
  TrendingUp,
  Tractor,
  Wallet,
  Bell,
  Activity,
  RefreshCw,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const LOGO_URL = "/manus-storage/fallinity-logo_8c31d682.png";

const menuItems = [
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

const SIDEBAR_WIDTH_KEY = "feos-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 320;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(false);
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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

  return (
    <FEOSLayout
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
    >
      {children}
    </FEOSLayout>
  );
}

function FEOSLayout({
  children,
  collapsed,
  setCollapsed,
  sidebarWidth,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const effectiveWidth = collapsed ? 68 : sidebarWidth;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const activeItem = menuItems.find(item => item.path === location);

  const SidebarContent = () => (
    <div
      className="flex flex-col h-full"
      style={{ width: effectiveWidth }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b"
        style={{ borderColor: "oklch(0.18 0.008 145)" }}
      >
        <img src={LOGO_URL} alt="Fallinity" className="w-8 h-8 object-contain shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div
              className="font-bold text-base tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}
            >
              FALLINITY
            </div>
            <div className="text-xs" style={{ color: "oklch(0.65 0.18 142)" }}>
              Enterprise OS
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {menuItems.map((item, i) => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                setLocation(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
              style={{
                animationDelay: `${i * 30}ms`,
                background: isActive ? "oklch(0.65 0.18 142 / 0.12)" : "transparent",
                color: isActive ? "oklch(0.65 0.18 142)" : "oklch(0.55 0.01 145)",
                borderLeft: isActive ? "2px solid oklch(0.65 0.18 142)" : "2px solid transparent",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)";
                  (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.85 0.01 145)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.55 0.01 145)";
                }
              }}
            >
              <item.icon
                className="shrink-0"
                size={18}
                style={{ color: isActive ? "oklch(0.65 0.18 142)" : "inherit" }}
              />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="truncate">{item.label}</div>
                  {isActive && (
                    <div className="text-xs truncate" style={{ color: "oklch(0.65 0.18 142 / 0.7)" }}>
                      {item.desc}
                    </div>
                  )}
                </div>
              )}
              {!collapsed && item.label === "AI" && (
                <Badge
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                  style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: "oklch(0.65 0.18 142)", border: "none" }}
                >
                  AI
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer utente */}
      <div
        className="p-3 border-t"
        style={{ borderColor: "oklch(0.18 0.008 145)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 w-full rounded-lg px-2 py-2 transition-colors text-left"
              style={{ background: "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Avatar className="h-8 w-8 shrink-0 border" style={{ borderColor: "oklch(0.65 0.18 142 / 0.4)" }}>
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: "oklch(0.65 0.18 142)" }}
                >
                  {user?.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>
                    {user?.name ?? "Utente"}
                  </p>
                  <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 145)" }}>
                    {user?.email ?? ""}
                  </p>
                </div>
              )}
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
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        {/* Mobile top bar */}
        <div
          className="flex items-center justify-between px-4 h-14 border-b sticky top-0 z-50"
          style={{ background: "oklch(0.09 0.006 145)", borderColor: "oklch(0.18 0.008 145)" }}
        >
          <button onClick={() => setMobileOpen(true)} className="p-1">
            <div className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 bg-foreground rounded" />
              <span className="block w-5 h-0.5 bg-foreground rounded" />
              <span className="block w-5 h-0.5 bg-foreground rounded" />
            </div>
          </button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Fallinity" className="w-6 h-6 object-contain" />
            <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
              {activeItem?.label ?? "FALLINITY"}
            </span>
          </div>
          <button className="p-1 relative">
            <Bell size={20} style={{ color: "oklch(0.55 0.01 145)" }} />
          </button>
        </div>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div
              className="relative z-10 h-full overflow-y-auto"
              style={{ background: "oklch(0.09 0.006 145)", borderRight: "1px solid oklch(0.18 0.008 145)" }}
            >
              <SidebarContent />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="relative flex-shrink-0 h-screen sticky top-0 overflow-hidden transition-all duration-200"
        style={{
          width: effectiveWidth,
          background: "oklch(0.09 0.006 145)",
          borderRight: "1px solid oklch(0.18 0.008 145)",
        }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all"
          style={{
            background: "oklch(0.15 0.008 145)",
            border: "1px solid oklch(0.22 0.01 145)",
            color: "oklch(0.55 0.01 145)",
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Resize handle */}
        {!collapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors hover:bg-primary/30"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Top bar */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-6 h-14 border-b"
          style={{
            background: "oklch(0.09 0.006 145 / 0.95)",
            borderColor: "oklch(0.18 0.008 145)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "oklch(0.85 0.01 145)" }}
              >
                {activeItem?.label ?? "Fallinity FEOS"}
              </h2>
              <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
                {activeItem?.desc ?? "Enterprise Operating System"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: "oklch(0.55 0.01 145)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Bell size={18} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: "oklch(0.65 0.18 142)", boxShadow: "0 0 4px oklch(0.65 0.18 142 / 0.8)" }}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.14 0.008 145)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <Avatar className="h-7 w-7 border" style={{ borderColor: "oklch(0.65 0.18 142 / 0.4)" }}>
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{ background: "oklch(0.65 0.18 142 / 0.15)", color: "oklch(0.65 0.18 142)" }}
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
          </div>
        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
