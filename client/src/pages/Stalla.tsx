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
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setLocation(`/stalla/${area.id}`)}
              className="group relative aspect-[1.5/1] w-full overflow-hidden rounded-[1.35rem] border text-center transition-[transform,box-shadow,border-color] duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{
                backgroundImage: `linear-gradient(180deg, oklch(0.02 0.005 145 / .18) 0%, oklch(0.02 0.005 145 / .10) 46%, oklch(0.02 0.005 145 / .35) 100%), url(${area.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderColor: "oklch(0.24 0.02 145)",
                boxShadow: "0 10px 24px oklch(0.03 0.01 145 / .30)",
              }}
            >
              <span className="sr-only">Apri {area.title}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
