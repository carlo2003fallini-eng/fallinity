import { useLocation } from "wouter";
import { Building2, ChevronRight, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const PANEL = "oklch(0.11 0.009 145)";
const BORDER = "oklch(0.2 0.012 145)";

function AccountRow({ icon: Icon, title, subtitle, accent = GREEN, onClick, destructive }: {
  icon: typeof UserRound; title: string; subtitle?: string; accent?: string; onClick: () => void; destructive?: boolean;
}) {
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-transform active:scale-[0.98]" style={{ background: PANEL, borderColor: BORDER }}>
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18`, color: accent }}><Icon size={20} /></span>
    <span className="min-w-0 flex-1"><span className="block font-semibold" style={{ color: destructive ? "oklch(0.7 0.2 25)" : "oklch(0.92 0.01 145)" }}>{title}</span>{subtitle && <span className="mt-0.5 block truncate text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>{subtitle}</span>}</span>
    {!destructive && <ChevronRight size={19} style={{ color: "oklch(0.45 0.01 145)" }} />}
  </button>;
}

export default function Account() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: access } = trpc.access.me.useQuery();
  const { data: company } = trpc.company.current.useQuery();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";

  return <div className="mx-auto w-full max-w-md animate-fade-in-up pb-6">
    <header className="mb-6 flex items-center gap-4 pt-2">
      <div className="flex size-16 items-center justify-center rounded-2xl border text-2xl font-bold" style={{ background: `${GREEN}16`, borderColor: `${GREEN}55`, color: GREEN }}>{initial}</div>
      <div className="min-w-0"><p className="fal-eyebrow" style={{ color: GOLD }}>Profilo Fallinity</p><h1 className="truncate text-2xl font-bold" style={{ color: "oklch(0.95 0.005 145)", fontFamily: "var(--font-display)" }}>{user?.name || "Account"}</h1><p className="truncate text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>{user?.email || "Email non disponibile"}</p></div>
    </header>

    <div className="space-y-3">
      <AccountRow icon={UserRound} title="Profilo" subtitle="Nome, email e identità account" onClick={() => navigate("/account/impostazioni")} />
      <AccountRow icon={Building2} title="Azienda collegata" subtitle={company?.name || "Azienda non disponibile"} accent={GOLD} onClick={() => navigate("/azienda")} />
      {access?.isCompanyAdmin && <AccountRow icon={ShieldCheck} title="Utenti e accessi" subtitle="Inviti, ruoli e permessi della tua azienda" accent={GOLD} onClick={() => navigate("/account/utenti")} />}
      {access?.isSuperAdmin && <AccountRow icon={Building2} title="Super Admin Fallinity" subtitle="Aziende, assistenza e configurazione piattaforma" accent="oklch(0.62 0.15 240)" onClick={() => navigate("/super-admin")} />}
      <AccountRow icon={Settings} title="Impostazioni" subtitle="Preferenze dell’applicazione" onClick={() => navigate("/account/impostazioni")} />
      <AccountRow icon={LogOut} title="Esci" subtitle="Chiudi la sessione su questo dispositivo" accent="oklch(0.7 0.2 25)" destructive onClick={async () => { await logout(); navigate("/"); }} />
    </div>
  </div>;
}
