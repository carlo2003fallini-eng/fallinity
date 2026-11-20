import { Link } from "wouter";
import {
  Wheat,
  Tractor,
  FlaskConical,
  ChartNoAxesCombined,
  AlertTriangle,
} from "lucide-react";
import { FeedPage, FeedStatus, useFeed, PANEL, qty } from "./shared";
const areas = [
  {
    path: "razioni",
    title: "Razioni",
    icon: Wheat,
    image: "/manus-storage/feeding-razioni_2cdc04ba.jpg",
  },
  {
    path: "distribuzione",
    title: "Distribuzione e consumi",
    icon: Tractor,
    image: "/manus-storage/feeding-distribuzione_157e3648.jpg",
  },
  {
    path: "alimenti",
    title: "Alimenti e analisi alimenti",
    icon: FlaskConical,
    image: "/manus-storage/feeding-alimenti_abc971fd.jpg",
  },
  {
    path: "analisi",
    title: "Analisi",
    icon: ChartNoAxesCombined,
    image: "/manus-storage/feeding-analisi_9c56c92e.jpg",
  },
];
export default function Alimentazione() {
  const q = useFeed();
  const s = q.data?.summary;
  return (
    <FeedPage title="Alimentazione" back="/azienda">
      <section
        aria-label="Aree operative Alimentazione"
        className="grid grid-cols-2 gap-3"
      >
        {areas.map(a => (
          <Link
            key={a.path}
            href={`/alimentazione/${a.path}`}
            aria-label={`Apri ${a.title}`}
            className="group flex min-h-[180px] flex-col items-center gap-2 overflow-hidden rounded-2xl border border-white/10 px-3 pt-7 text-center transition-transform active:scale-[.98]"
            style={{
              backgroundImage: `linear-gradient(180deg,rgba(3,9,5,.92),rgba(3,9,5,.60),rgba(3,9,5,.25)),url(${a.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 8px 20px #0005",
            }}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl border border-green-500/40 bg-black/50 text-green-400">
              <a.icon size={26} />
            </span>
            <span
              className="text-lg font-semibold leading-snug text-white"
              style={{
                fontFamily: "var(--font-display)",
                textShadow: "0 2px 12px #000",
              }}
            >
              {a.title}
            </span>
          </Link>
        ))}
      </section>
      <FeedStatus query={q} />
      {s && (
        <section className={PANEL} aria-label="Situazione alimentare aziendale">
          <h2 className="mb-4 font-semibold text-white">
            Situazione alimentare
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <p className="text-xs text-zinc-400">Autonomia prevista</p>
              <p className="mt-1 text-xl font-bold text-green-400">
                {s.autonomyDays == null
                  ? "Non calcolabile"
                  : qty(s.autonomyDays, "giorni")}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {s.limitingProduct ?? "Attiva le ricette e verifica le scorte"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">
                Animali nei gruppi alimentati
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {qty(s.fedAnimals)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Carri medi / giorno</p>
              <p className="mt-1 text-lg font-bold text-white">
                {qty(s.averageRunsPerDay)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Carri preparati oggi</p>
              <p className="mt-1 text-lg font-bold text-white">
                {qty(s.todayRuns)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Da distribuire</p>
              <p className="mt-1 text-lg font-bold text-white">
                {qty(s.undistributedRuns)}
              </p>
            </div>
            {s.autonomyDays != null && (
              <div>
                <p className="text-xs text-zinc-400">Esaurimento previsto</p>
                <p className="mt-1 text-sm text-white">
                  {new Date(
                    Date.now() + s.autonomyDays * 86400000
                  ).toLocaleDateString("it-IT")}
                </p>
              </div>
            )}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-zinc-400">
            {s.coverage}
          </p>
          {s.warnings.map((w, i) => (
            <p key={i} className="mt-3 flex gap-2 text-sm text-orange-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </section>
      )}
    </FeedPage>
  );
}
