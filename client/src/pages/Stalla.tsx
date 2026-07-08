import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Activity, Heart, Milk, Stethoscope, Users, Search } from "lucide-react";
import { FAL_IMAGES } from "@/lib/assets";
import GruppiTab from "./stalla/GruppiTab";
import AnimaliTab from "./stalla/AnimaliTab";

const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const RED = "oklch(0.65 0.22 25)";
const PURPLE = "oklch(0.65 0.18 300)";
const SURFACE = "oklch(0.10 0.006 145)";
const BORDER = "oklch(0.18 0.008 145)";

type TabId = "gruppi" | "animali" | "salute";

export default function Stalla() {
  const [tab, setTab] = useState<TabId>("gruppi");
  const { data: animaliList = [] } = trpc.stalla.list.useQuery();
  const { data: stats } = trpc.stalla.stats.useQuery();

  const vacche = animaliList.filter((a: any) => a.sesso === "femmina");
  const attive = vacche.filter((a: any) => !["venduta", "morta"].includes(a.stato));
  const gravide = vacche.filter((a: any) => a.statoRiproduttivo === "gravida" || a.stato === "gravida");
  const inLattazione = vacche.filter((a: any) => a.statoProduttivo === "in_lattazione" || a.stato === "attiva");
  const infermeria = vacche.filter((a: any) => a.stato === "infermeria");

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden min-h-[130px] flex flex-col justify-end p-5"
        style={{ backgroundImage: `linear-gradient(90deg, oklch(0.08 0.006 145 / 0.92) 0%, oklch(0.08 0.006 145 / 0.55) 100%), url(${FAL_IMAGES.stallaCows})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: GREEN }}>Gestione Zootecnica</p>
        <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "oklch(0.97 0.005 145)" }}>
          {attive.length} capi attivi
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "oklch(0.78 0.01 145)" }}>
          {inLattazione.length} in lattazione · {gravide.length} gravide · {stats?.zoppieAperte ?? 0} zoppie
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "In lattazione", value: inLattazione.length, color: GREEN, icon: Milk },
          { label: "Gravide", value: gravide.length, color: PURPLE, icon: Heart },
          { label: "Infermeria", value: infermeria.length, color: RED, icon: Stethoscope },
          { label: "Parti mese", value: stats?.partiMese ?? 0, color: GOLD, icon: Activity },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</span>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: k.color, fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: SURFACE }}>
        {([
          { id: "gruppi" as TabId, label: "Gruppi", icon: Users },
          { id: "animali" as TabId, label: "Animali", icon: Search },
          { id: "salute" as TabId, label: "Salute", icon: Stethoscope },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === t.id ? GREEN : "transparent",
              color: tab === t.id ? "oklch(0.08 0.01 145)" : "oklch(0.55 0.01 145)",
            }}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "gruppi" && <GruppiTab />}
      {tab === "animali" && <AnimaliTab />}
      {tab === "salute" && <SaluteTab animali={animaliList} stats={stats} />}
    </div>
  );
}

// ── Tab Salute (zoppie + trattamenti legacy) ──
function SaluteTab({ animali, stats }: { animali: any[]; stats: any }) {
  const { data: zoppieList = [] } = trpc.stalla.zoppie.useQuery();
  const ORANGE = "oklch(0.72 0.18 60)";

  return (
    <div className="space-y-4">
      {/* KPI salute */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Zoppie aperte", value: stats?.zoppieAperte ?? 0, color: ORANGE },
          { label: "Trattamenti", value: stats?.trattamentiPianificati ?? 0, color: "oklch(0.68 0.16 185)" },
          { label: "Parti mese", value: stats?.partiMese ?? 0, color: GOLD },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</div>
            <div className="text-2xl font-bold" style={{ color: k.color, fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Zoppie */}
      <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: BORDER }}>
          <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Casi di Zoppia</h3>
        </div>
        {zoppieList.length === 0 ? (
          <div className="p-8 text-center">
            <Stethoscope className="w-10 h-10 mx-auto mb-2" style={{ color: "oklch(0.30 0.008 145)" }} />
            <p className="text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun caso attivo</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {zoppieList.map((z: any) => {
              const statoColor = { aperta: RED, in_trattamento: ORANGE, risolta: GREEN }[z.stato as string] ?? ORANGE;
              return (
                <div key={z.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${statoColor}20` }}>
                    <Stethoscope className="w-4 h-4" style={{ color: statoColor }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: "oklch(0.88 0.006 145)" }}>Score {z.score}/5 · {z.zampa || "—"}</div>
                    <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>{z.dataRilevazione}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statoColor}15`, color: statoColor }}>
                    {(z.stato || "aperta").replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
