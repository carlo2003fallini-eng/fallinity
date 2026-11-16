import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { C } from "./shared";

export const OFFICINA_IMAGES = {
  operatore: "/manus-storage/officina-operatore-card_4486e69e.jpg",
  mezzi: "/manus-storage/officina-mezzi-card_2aaf0eca.jpg",
  interventi: "/manus-storage/officina-interventi-card_0cd91977.jpg",
  ricambi: "/manus-storage/officina-ricambi-card_7d786495.jpg",
};
export function useOfficinaPermissions() {
  const { data } = trpc.officina.permessi.useQuery(undefined, { staleTime: 30000 });
  return { canEdit: Boolean(data?.canEdit), canSeeCosts: Boolean(data?.canSeeCosts) };
}
export function OfficinaHeader({ title, hub = false }: { title: string; hub?: boolean }) {
  const [, navigate] = useLocation();
  return <header className="mb-5">
    <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: C.textDim }}>
      <button onClick={() => navigate("/azienda")} className="min-h-8">Azienda</button>
      <ChevronRight size={12} aria-hidden="true" />
      {hub ? <span>Officina</span> : <><button onClick={() => navigate("/officina")} className="min-h-8">Officina</button><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{title}</span></>}
    </div>
    <p className="mb-1 text-[10px] font-semibold tracking-[0.17em] uppercase" style={{ color: hub ? C.gold : title === "Menù operatore" ? C.blue : C.gold }}>{hub ? "Parco mezzi e manutenzioni" : title === "Menù operatore" ? "Prelievo ricambi" : "Officina"}</p>
    <div className="flex items-center gap-3">
      <button onClick={() => navigate(hub ? "/azienda" : "/officina")} aria-label={hub ? "Indietro ad Azienda" : "Indietro a Officina"} className="flex size-11 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: C.border, background: C.panel, color: C.text }}><ArrowLeft size={20} /></button>
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text, fontFamily: "var(--font-display)" }}>{title}</h1>
    </div>
  </header>;
}
export function OfficinaPage({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [title]);
  return <div className="officina-page mx-auto w-full max-w-3xl pb-6"><OfficinaHeader title={title} />{children}</div>;
}
export function PhotoAreaCard({ title, description, icon: Icon, image, color, onClick }: { title: string; description?: string; icon: LucideIcon; image: string; color: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative flex min-h-[180px] w-full flex-col items-center justify-start gap-2 overflow-hidden rounded-2xl border px-3 pt-7 text-center transition-transform duration-150 active:scale-[0.98]" style={{ minHeight: "11.25rem", backgroundImage: `linear-gradient(180deg, oklch(0.055 0.01 145 / .90) 0%, oklch(0.055 0.01 145 / .72) 42%, oklch(0.055 0.01 145 / .30) 100%), url(${image})`, backgroundSize: "cover", backgroundPosition: "center", borderColor: "oklch(0.20 0.015 145)", boxShadow: "0 8px 20px oklch(0.03 0.01 145 / .22)" }}>
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-sm" style={{ color, background: "oklch(0.07 0.01 145 / .62)", borderColor: color }}><Icon size={26} strokeWidth={1.85} /></span>
    <span className="text-lg font-semibold tracking-tight leading-tight" style={{ color: "oklch(0.96 0.004 145)", fontFamily: "var(--font-display)", textShadow: "0 2px 12px oklch(0.02 0.005 145 / .95)" }}>{title}</span>
    {description && <span className="text-[11px] leading-tight" style={{ color: "oklch(0.8 0.005 145)", textShadow: "0 2px 8px #000" }}>{description}</span>}
  </button>;
}
