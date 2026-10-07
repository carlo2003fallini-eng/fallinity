import { ArrowLeft, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ImpostazioniAccount() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  return <div className="mx-auto w-full max-w-md animate-fade-in-up">
    <header className="mb-6 flex items-center gap-3"><button onClick={() => navigate("/account")} className="rounded-xl p-2" aria-label="Torna all’account"><ArrowLeft size={20} /></button><div><p className="fal-eyebrow">Account</p><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Impostazioni</h1></div></header>
    <div className="space-y-3">
      <section className="rounded-2xl border p-4" style={{ background: "oklch(0.11 0.009 145)", borderColor: "oklch(0.2 0.012 145)" }}><div className="flex gap-3"><UserRound size={19} style={{ color: "oklch(0.65 0.18 142)" }} /><div><p className="font-semibold">Identità account</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>{user?.name || "Utente Fallinity"}<br />{user?.email || "Email non disponibile"}</p></div></div></section>
      <section className="rounded-2xl border p-4" style={{ background: "oklch(0.11 0.009 145)", borderColor: "oklch(0.2 0.012 145)" }}><div className="flex gap-3"><Smartphone size={19} style={{ color: "oklch(0.72 0.15 75)" }} /><div><p className="font-semibold">Preferenze dispositivo</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Le preferenze personali vengono mantenute sul tuo account e sui dispositivi autorizzati.</p></div></div></section>
      <section className="rounded-2xl border p-4" style={{ background: "oklch(0.11 0.009 145)", borderColor: "oklch(0.2 0.012 145)" }}><div className="flex gap-3"><ShieldCheck size={19} style={{ color: "oklch(0.65 0.18 142)" }} /><div><p className="font-semibold">Sicurezza</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>L’accesso è gestito tramite il provider autenticato Fallinity.</p></div></div></section>
    </div>
  </div>;
}
