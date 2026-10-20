import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { STALLA_AREAS } from "@/lib/stallaAreas";

const TEXT_BRIGHT = "oklch(0.96 0.004 145)";

export default function Stalla() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-5">
      <header className="px-1 pt-1">
        <button
          type="button"
          onClick={() => setLocation("/azienda")}
          className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ color: "oklch(0.72 0.18 145)" }}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Azienda
        </button>
        <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)" }}>Stalla</h1>
      </header>

      <section className="grid grid-cols-2 gap-3" aria-label="Aree operative della Stalla">
        {STALLA_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setLocation(`/stalla/${area.id}`)}
              aria-label={area.visualDescription ? `Apri ${area.title}. ${area.visualDescription}` : `Apri ${area.title}`}
              className="group relative flex min-h-[180px] w-full select-none flex-col items-center justify-start gap-2 overflow-hidden rounded-2xl border px-3 pt-7 text-center transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{
                minHeight: "11.25rem",
                backgroundImage: `linear-gradient(180deg, oklch(0.055 0.01 145 / .90) 0%, oklch(0.055 0.01 145 / .72) 42%, oklch(0.055 0.01 145 / .30) 100%), url(${area.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: area.backgroundPosition,
                borderColor: "oklch(0.24 0.02 145)",
                boxShadow: "0 8px 20px oklch(0.03 0.01 145 / .22)",
              }}
            >
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-2xl border backdrop-blur-sm"
                style={{ background: "oklch(0.07 0.01 145 / .62)", borderColor: `${area.color}55`, color: area.color }}
              >
                <Icon size={26} strokeWidth={1.85} />
              </span>
              <span className="text-lg font-semibold tracking-tight" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)", textShadow: "0 2px 12px oklch(0.02 0.005 145 / .95)" }}>
                {area.title}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
