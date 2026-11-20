import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { CompanyAreasGrid } from "@/components/azienda/CompanyAreasGrid";
import { trpc } from "@/lib/trpc";
import { Wheat } from "lucide-react";
import { hasModule } from "@/lib/access";

export default function Azienda() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: access } = trpc.access.me.useQuery();
  const allowedAreas = access?.isCompanyAdmin ? undefined : (["stalla", "magazzino", "officina", "campi"] as const).filter((area) => hasModule(access?.modules, `azienda.${area}` as any));

  return (
    <div className="mx-auto w-full max-w-md animate-fade-in-up pb-5">
      <header className="mb-5">
        <p className="fal-eyebrow mb-1" style={{ color: "oklch(0.72 0.15 75)" }}>Gestione aziendale</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
          Azienda
        </h1>
      </header>

      <CompanyAreasGrid
        onNavigate={setLocation}
        userKey={user?.openId ?? "dispositivo"}
        companyKey={user?.activeCompanyId ?? "azienda"}
        allowedAreas={allowedAreas ? [...allowedAreas] : undefined}
      />
      {(access?.isCompanyAdmin || hasModule(access?.modules, "azienda.stalla.alimentazione" as any)) && <button onClick={() => setLocation("/alimentazione")} className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-green-500/30 bg-green-950/20 px-4 text-left text-green-300"><Wheat size={23}/><span className="font-semibold">Alimentazione</span><span className="ml-auto text-xs text-zinc-400">Razioni e consumi</span></button>}
    </div>
  );
}
