import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Tractor, Wrench, Package, AlertTriangle, Clock, CheckCircle2, Euro, Activity,
} from "lucide-react";
import { FAL_IMAGES } from "@/lib/assets";
import { C, eur } from "./officina/shared";
import MezziTab from "./officina/MezziTab";
import InterventiTab from "./officina/InterventiTab";
import RicambiTab from "./officina/RicambiTab";

const TABS: { id: string; label: string; icon: any }[] = [
  { id: "mezzi", label: "Mezzi", icon: Tractor },
  { id: "interventi", label: "Interventi", icon: Wrench },
  { id: "ricambi", label: "Ricambi", icon: Package },
];

export default function Officina() {
  const [tab, setTab] = useState("mezzi");
  const { data: dash } = trpc.officina.dashboard.useQuery();

  const kpi = [
    { label: "MEZZI OPERATIVI", value: `${dash?.mezziOperativi ?? 0}/${dash?.totaleMezzi ?? 0}`, color: C.green, icon: Tractor },
    { label: "MEZZI FERMI", value: String(dash?.mezziFermi ?? 0), color: (dash?.mezziFermi ?? 0) > 0 ? C.red : C.green, icon: AlertTriangle },
    { label: "INTERVENTI OGGI", value: String(dash?.manutenzioniOggi ?? 0), color: C.blue, icon: Clock },
    { label: "IN RITARDO", value: String(dash?.interventiInRitardo ?? 0), color: (dash?.interventiInRitardo ?? 0) > 0 ? C.orange : C.green, icon: Activity },
    { label: "RICAMBI SOTTO SCORTA", value: String(dash?.ricambiSottoScorta ?? 0), color: (dash?.ricambiSottoScorta ?? 0) > 0 ? C.gold : C.green, icon: Package },
    { label: "COSTO MANUT. MESE", value: eur(dash?.costoManutenzioneMese ?? 0), color: C.gold, icon: Euro },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* HERO */}
      <div className="relative rounded-2xl overflow-hidden min-h-[160px] flex items-end p-6"
        style={{ backgroundImage: `linear-gradient(90deg, oklch(0.08 0.006 145 / 0.94) 0%, oklch(0.08 0.006 145 / 0.5) 100%), url(${FAL_IMAGES.officinaHero})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="flex items-end justify-between w-full flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: C.gold }}>Parco Mezzi & Manutenzioni</p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.97 0.005 145)", letterSpacing: "-0.02em" }}>Officina</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.78 0.01 145)" }}>
              {dash?.totaleMezzi ?? 0} mezzi · {dash?.interventiAperti ?? 0} interventi aperti · {dash?.ricambiSottoScorta ?? 0} ricambi da ordinare
            </p>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpi.map((k) => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold tracking-wider leading-tight" style={{ color: C.textFaint }}>{k.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${k.color}1a` }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
            </div>
            <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)", letterSpacing: "-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alert attività prioritarie */}
      {dash && (dash.interventiInRitardo > 0 || dash.mezziFermi > 0) && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: `${C.red}10`, border: `1px solid ${C.red}30` }}>
          <AlertTriangle size={18} style={{ color: C.red }} className="shrink-0" />
          <p className="text-sm" style={{ color: C.text }}>
            {dash.interventiInRitardo > 0 && <span><strong>{dash.interventiInRitardo}</strong> interventi in ritardo</span>}
            {dash.interventiInRitardo > 0 && dash.mezziFermi > 0 && " · "}
            {dash.mezziFermi > 0 && <span><strong>{dash.mezziFermi}</strong> mezzi fermi richiedono attenzione</span>}
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: active ? C.green : "transparent", color: active ? C.bgDeep : C.textDim }}>
              <t.icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "mezzi" && <MezziTab />}
      {tab === "interventi" && <InterventiTab />}
      {tab === "ricambi" && <RicambiTab />}
    </div>
  );
}
