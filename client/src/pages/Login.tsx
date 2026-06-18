import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

const LOGO_URL = "/manus-storage/fallinity-logo_8c31d682.png";

// Sfondo agricolo: gradiente scuro con overlay
const BG_STYLE: React.CSSProperties = {
  background: `
    radial-gradient(ellipse at 20% 80%, oklch(0.12 0.04 145 / 0.6) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, oklch(0.10 0.02 145 / 0.4) 0%, transparent 60%),
    oklch(0.06 0.008 145)
  `,
};

const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const SURFACE = "oklch(0.10 0.006 145)";
const BORDER = "oklch(0.18 0.008 145)";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const loginUrl = getLoginUrl();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={BG_STYLE}>
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5"
          style={{ background: `radial-gradient(circle, ${GREEN}, transparent)` }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-5"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent)` }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.9 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0 0) 1px, transparent 1px)`,
            backgroundSize: "60px 60px"
          }} />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Card principale */}
        <div className="rounded-2xl p-8 shadow-2xl" style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          boxShadow: `0 0 60px oklch(0.72 0.22 145 / 0.08), 0 25px 50px oklch(0 0 0 / 0.5)`
        }}>

          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{
              background: "oklch(0.14 0.01 145)",
              border: `1px solid oklch(0.22 0.015 145)`
            }}>
              <img src={LOGO_URL} alt="Fallinity" className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
              FALLINITY
            </h1>
            <p className="text-sm font-medium tracking-widest" style={{ color: GOLD }}>
              Agricoltura. Finanza. Futuro.
            </p>
          </div>

          {/* Titolo benvenuto */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold mb-1" style={{ color: "oklch(0.88 0.008 145)" }}>
              Bentornato in Fallinity
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.50 0.01 145)" }}>
              Enterprise Operating System per l'agricoltura moderna
            </p>
          </div>

          {/* Pulsante accesso principale */}
          <a
            href={loginUrl}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-200 mb-4"
            style={{
              background: `linear-gradient(135deg, ${GREEN}, oklch(0.65 0.22 145))`,
              color: "oklch(0.08 0.01 145)",
              boxShadow: `0 4px 20px oklch(0.72 0.22 145 / 0.35)`,
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            ACCEDI A FALLINITY
          </a>

          {/* Separatore */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: BORDER }} />
            <span className="text-xs" style={{ color: "oklch(0.40 0.008 145)" }}>oppure</span>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
          </div>

          {/* Accesso biometrico placeholder */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ background: "oklch(0.13 0.007 145)", border: `1px solid ${BORDER}`, color: "oklch(0.65 0.01 145)" }}
              onClick={() => alert("Face ID disponibile su dispositivo mobile")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                <path d="M9 3.5C9 3.5 9 2 12 2s3 1.5 3 1.5" />
                <path d="M8 8c0 0-1 0-1-1" />
                <path d="M16 8c0 0 1 0 1-1" />
              </svg>
              Face ID
            </button>
            <button
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-150"
              style={{ background: "oklch(0.13 0.007 145)", border: `1px solid ${BORDER}`, color: "oklch(0.65 0.01 145)" }}
              onClick={() => alert("Impronta digitale disponibile su dispositivo mobile")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M2 12a10 10 0 0 1 18-6" />
                <path d="M2 17c1 .5 2.5 1 4 1" />
                <path d="M22 6c0 0-3.5 1.5-5 3" />
                <path d="M22 13c0 5.5-4.78 10-10 10" />
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                <path d="M17.5 10c.7-1.7 1.5-2 1.5-2" />
              </svg>
              Impronta
            </button>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs" style={{ color: "oklch(0.38 0.008 145)" }}>
              Non hai un account?{" "}
              <a href="mailto:info@fallinity.it" className="underline" style={{ color: GOLD }}>
                Contattaci
              </a>
            </p>
          </div>
        </div>

        {/* Badge versione */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />
          <span className="text-xs" style={{ color: "oklch(0.38 0.008 145)" }}>
            Fallinity FEOS v1.1 — Enterprise Operating System
          </span>
        </div>
      </div>
    </div>
  );
}
