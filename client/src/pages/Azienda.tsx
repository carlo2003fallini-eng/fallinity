import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { CompanyAreasGrid } from "@/components/azienda/CompanyAreasGrid";

export default function Azienda() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

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
      />
    </div>
  );
}
