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
        <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "oklch(0.78 0.15 85)" }}>Gestione zootecnica</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)" }}>Stalla</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed" style={{ color: "oklch(0.60 0.01 145)" }}>
          I dati della mandria, organizzati per lavorare in modo semplice e veloce.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3" aria-label="Aree operative della Stalla">
        {STALLA_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setLocation(`/stalla/${area.id}`)}
              className="group relative aspect-[1.1/1] w-full overflow-hidden rounded-[1.35rem] border text-center transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{
                backgroundImage: `linear-gradient(180deg, oklch(0.055 0.01 145 / .12) 0%, oklch(0.055 0.01 145 / .18) 42%, oklch(0.025 0.006 145 / .82) 100%), url(${area.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderColor: "oklch(0.24 0.02 145)",
                boxShadow: "0 10px 24px oklch(0.03 0.01 145 / .30)",
              }}
            >
              <span
                className="absolute left-1/2 top-[46%] flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.2rem] border backdrop-blur-md"
                style={{ background: "oklch(0.035 0.007 145 / .86)", borderColor: `${area.color}66`, color: area.color, boxShadow: "0 8px 22px oklch(0.02 0.005 145 / .46)" }}
              >
                <Icon size={30} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="absolute inset-x-2 bottom-3 text-xl font-bold tracking-tight" style={{ color: TEXT_BRIGHT, fontFamily: "var(--font-display)", textShadow: "0 3px 14px oklch(0.02 0.005 145 / .98)" }}>
                {area.title}
              </span>
              <span className="sr-only">Apri {area.title}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
