import { ArrowLeft, ChevronRight, ClipboardList, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getStallaArea } from "@/lib/stallaAreas";
import GruppiTab from "./GruppiTab";
import AnimaliTab from "./AnimaliTab";
import { BORDER, GREEN, ORANGE, RED, SURFACE, SURFACE2 } from "./shared";

function SectionPlaceholder({ title, tabLabel, icon: Icon }: { title: string; tabLabel: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border p-7 text-center" style={{ background: SURFACE, borderColor: BORDER }}>
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl" style={{ background: "oklch(0.65 0.18 142 / .12)", color: GREEN }}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold" style={{ color: "oklch(0.90 0.006 145)" }}>{tabLabel}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 145)" }}>
        La sezione {title.toLowerCase()} è predisposta. I dati compariranno qui appena verranno registrati o collegati.
      </p>
    </div>
  );
}

function SanitaPanel({ activeTab }: { activeTab: string }) {
  const { data: stats } = trpc.stalla.stats.useQuery();
  const { data: zoppieList = [] } = trpc.stalla.zoppie.useQuery();

  if (activeTab !== "casi" && activeTab !== "zoppie") {
    return <SectionPlaceholder title="Sanità" tabLabel={activeTab === "trattamenti" ? "Trattamenti" : "Registro sanitario"} icon={Stethoscope} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "oklch(0.48 0.01 145)" }}>Zoppie aperte</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: ORANGE, fontFamily: "var(--font-display)" }}>{stats?.zoppieAperte ?? 0}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "oklch(0.48 0.01 145)" }}>Trattamenti pianificati</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: GREEN, fontFamily: "var(--font-display)" }}>{stats?.trattamentiPianificati ?? 0}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ background: SURFACE, borderColor: BORDER }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: BORDER }}>
          <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `${ORANGE}15`, color: ORANGE }}><Stethoscope size={16} aria-hidden="true" /></span>
          <h2 className="text-sm font-semibold" style={{ color: "oklch(0.9 0.006 145)" }}>Casi di zoppia</h2>
        </div>
        {zoppieList.length === 0 ? (
          <div className="p-8 text-center">
            <Stethoscope className="mx-auto size-9" style={{ color: "oklch(0.30 0.008 145)" }} aria-hidden="true" />
            <p className="mt-2 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun caso attivo</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {zoppieList.map((item: any) => {
              const color = item.stato === "risolta" ? GREEN : item.stato === "in_trattamento" ? ORANGE : RED;
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: `${color}18`, color }}><Stethoscope size={16} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.006 145)" }}>Score {item.score}/5{item.zampa ? ` · ${item.zampa}` : ""}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>{item.dataRilevazione}</p>
                  </div>
                  <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: `${color}15`, color }}>{(item.stato || "aperta").replaceAll("_", " ")}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function StallaSection({ sectionId }: { sectionId: string }) {
  const [, setLocation] = useLocation();
  const area = getStallaArea(sectionId);
  const [activeTab, setActiveTab] = useState(area?.tabs[0]?.id ?? "");

  useEffect(() => {
    if (!area) setLocation("/stalla");
  }, [area, setLocation]);

  useEffect(() => {
    setActiveTab(area?.tabs[0]?.id ?? "");
  }, [area?.id, area?.tabs]);

  if (!area) {
    return null;
  }

  if (area.id === "gruppi" && activeTab === "gruppi") {
    return <GruppiTab onBack={() => setLocation("/stalla")} onOpenAllAnimals={() => setLocation("/stalla/animali")} />;
  }

  const activeDefinition = area.tabs.find((tab) => tab.id === activeTab) ?? area.tabs[0]!;

  const renderContent = () => {
    if (area.id === "gruppi" && activeTab === "gruppi") return <GruppiTab />;
    if (area.id === "gruppi" && activeTab === "animali") return <AnimaliTab />;
    if (area.id === "vitelli" && activeTab === "elenco") return <AnimaliTab />;
    if (area.id === "riproduzione" && activeTab === "animali") return <AnimaliTab />;
    if (area.id === "sanita") return <SanitaPanel activeTab={activeTab} />;
    return <SectionPlaceholder title={area.title} tabLabel={activeDefinition.label} icon={activeDefinition.icon} />;
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setLocation("/stalla")}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ color: "oklch(0.72 0.18 145)" }}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Tutte le aree
      </button>

      <section
        className="relative overflow-hidden rounded-2xl border p-5"
        style={{
          backgroundImage: `linear-gradient(90deg, oklch(0.055 0.01 145 / .82) 0%, oklch(0.055 0.01 145 / .46) 100%), url(${area.backgroundImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          borderColor: "oklch(0.24 0.02 145)",
        }}
      >
        <div className="relative flex min-h-24 flex-col justify-end">
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl border backdrop-blur-sm" style={{ background: "oklch(0.07 0.01 145 / .61)", borderColor: `${area.color}77`, color: area.color }}>
            <area.icon size={23} strokeWidth={1.85} aria-hidden="true" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: area.color }}>{area.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold" style={{ color: "oklch(0.97 0.004 145)", fontFamily: "var(--font-display)" }}>{area.title}</h1>
          <p className="mt-1 max-w-md text-sm" style={{ color: "oklch(0.88 0.01 145)" }}>{area.description}</p>
        </div>
      </section>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" aria-label={`Sezioni ${area.title}`}>
        {area.tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ background: selected ? `${area.color}18` : SURFACE, borderColor: selected ? `${area.color}88` : BORDER, color: selected ? area.color : "oklch(0.65 0.01 145)" }}
              aria-current={selected ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div key={`${area.id}-${activeTab}`} className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200">
        {renderContent()}
      </div>

      <button type="button" onClick={() => setLocation("/stalla")} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold" style={{ color: "oklch(0.60 0.01 145)" }}>
        Torna alla Stalla <ChevronRight size={16} className="rotate-180" aria-hidden="true" />
      </button>
    </div>
  );
}
