import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Building2, Bell, ChevronRight, Plus, CheckCircle2, MapPin, Users } from "lucide-react";
import { useLocation } from "wouter";

const LOGO_URL = "/manus-storage/fallinity-logo_8c31d682.png";
const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const SURFACE = "oklch(0.10 0.006 145)";
const SURFACE2 = "oklch(0.13 0.007 145)";
const BORDER = "oklch(0.18 0.008 145)";

export default function SelezionaAzienda() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: aziendaData } = trpc.company.current.useQuery();

  // Simula lista aziende (in produzione verrebbe da un endpoint multi-tenant)
  const aziende = aziendaData
    ? [
        {
          id: 1,
          nome: aziendaData.name || "Azienda Agricola",
          provincia: aziendaData.provincia || "—",
          settore: aziendaData.settore || "Agricoltura",
          ruolo: user?.role === "admin" ? "Amministratore" : "Operatore",
          notifiche: 3,
          scorciatoie: 8,
          attiva: true,
        },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.07 0.006 145)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Fallinity" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base tracking-wide" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
            FALLINITY
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="text-sm" style={{ color: "oklch(0.70 0.01 145)" }}>{user?.name || "Utente"}</span>
        </div>
      </div>

      {/* Contenuto */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
              Seleziona Azienda
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.50 0.01 145)" }}>
              Scegli l'azienda con cui vuoi lavorare
            </p>
          </div>

          {/* Lista aziende */}
          <div className="space-y-3 mb-6">
            {aziende.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.35 0.01 145)" }} />
                <p className="text-sm mb-1" style={{ color: "oklch(0.65 0.01 145)" }}>Nessuna azienda configurata</p>
                <p className="text-xs" style={{ color: "oklch(0.40 0.008 145)" }}>Configura la tua azienda dal modulo Azienda</p>
              </div>
            ) : (
              aziende.map(az => (
                <button
                  key={az.id}
                  onClick={() => navigate("/")}
                  className="w-full text-left rounded-xl p-5 transition-all duration-200 group"
                  style={{
                    background: SURFACE2,
                    border: `1px solid ${az.attiva ? GREEN + "60" : BORDER}`,
                    boxShadow: az.attiva ? `0 0 20px oklch(0.72 0.22 145 / 0.08)` : "none",
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icona azienda */}
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                      background: "oklch(0.16 0.01 145)",
                      border: `1px solid ${BORDER}`
                    }}>
                      <Building2 className="w-7 h-7" style={{ color: GREEN }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base truncate" style={{ color: "oklch(0.92 0.006 145)" }}>
                          {az.nome}
                        </span>
                        {az.attiva && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{
                            background: `${GREEN}20`, color: GREEN
                          }}>
                            <CheckCircle2 className="w-3 h-3" />
                            ATTIVA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {az.provincia}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {az.ruolo}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{
                          background: "oklch(0.16 0.01 145)", color: "oklch(0.60 0.01 145)"
                        }}>
                          <Bell className="w-3 h-3" />
                          {az.notifiche} notifiche
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: "oklch(0.16 0.01 145)", color: "oklch(0.60 0.01 145)"
                        }}>
                          {az.scorciatoie} scorciatoie
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-1" style={{ color: "oklch(0.40 0.008 145)" }} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Richiedi accesso */}
          <button
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: "transparent",
              border: `1px dashed ${BORDER}`,
              color: "oklch(0.55 0.01 145)"
            }}
            onClick={() => alert("Funzione disponibile nella versione multi-tenant")}
          >
            <Plus className="w-4 h-4" />
            Richiedi accesso a nuova azienda
          </button>

          {/* Entra direttamente se c'è un'azienda */}
          {aziende.length > 0 && (
            <button
              onClick={() => navigate("/")}
              className="w-full mt-3 py-3.5 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${GREEN}, oklch(0.65 0.22 145))`,
                color: "oklch(0.08 0.01 145)",
              }}
            >
              Entra in {aziende[0].nome}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
