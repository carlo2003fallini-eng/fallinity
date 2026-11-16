import { useLocation } from "wouter";
import { ShoppingCart, Tractor, Wrench, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { C, eur } from "./officina/shared";
import { OFFICINA_IMAGES, OfficinaHeader, PhotoAreaCard, useOfficinaPermissions } from "./officina/OfficinaLayout";

const AREAS = [
  { id: "operatore", label: "Menù operatore", description: "Prelievo ricambi", icon: ShoppingCart, color: C.blue },
  { id: "mezzi", label: "Mezzi", description: "Parco aziendale", icon: Tractor, color: C.green },
  { id: "interventi", label: "Interventi", description: "Manutenzioni e riparazioni", icon: Wrench, color: C.blue },
  { id: "ricambi", label: "Ricambi", description: "Disponibilità materiali", icon: Package, color: C.gold },
] as const;

export default function Officina() {
  const [, navigate] = useLocation();
  const { canSeeCosts } = useOfficinaPermissions();
  const { data: dash, isLoading, isError, refetch } = trpc.officina.dashboard.useQuery();
  const rows = [
    { label: "Mezzi operativi", value: dash ? `${dash.mezziOperativi}/${dash.totaleMezzi}` : "—", path: "/officina/mezzi?stato=operativo" },
    { label: "Mezzi fermi", value: dash?.mezziFermi ?? "—", path: "/officina/mezzi?stato=fermo" },
    { label: "Interventi aperti", value: dash?.interventiAperti ?? "—", path: "/officina/interventi?stato=aperti" },
    { label: "Interventi in ritardo", value: dash?.interventiInRitardo ?? "—", path: "/officina/interventi?periodo=ritardo" },
    { label: "Ricambi sotto scorta", value: dash?.ricambiSottoScorta ?? "—", path: "/officina/ricambi?stato=sotto_scorta" },
    ...(canSeeCosts ? [{ label: "Costo manutenzioni mese", value: dash ? eur(dash.costoManutenzioneMese) : "—", path: "/officina/interventi?stato=completato&periodo=mese" }] : []),
  ];
  return <div className="officina-page mx-auto w-full max-w-md pb-5 animate-fade-in-up">
    <OfficinaHeader title="Officina" hub />
    <section aria-label="Aree Officina" className="grid grid-cols-2 gap-3">
      {AREAS.map((area) => <PhotoAreaCard key={area.id} title={area.label} description={area.description} icon={area.icon} image={OFFICINA_IMAGES[area.id]} color={area.color} onClick={() => navigate(`/officina/${area.id}`)} />)}
    </section>
    <section aria-labelledby="situazione-officina" className="mt-6 rounded-2xl border px-4 py-3" style={{ borderColor: C.border, background: C.panel }}>
      <h2 id="situazione-officina" className="mb-1 text-sm font-semibold" style={{ color: C.text }}>Situazione Officina</h2>
      {isError ? <button onClick={() => refetch()} className="min-h-11 text-sm" style={{ color: C.gold }}>Riepilogo non disponibile · Riprova</button> : <div aria-busy={isLoading}>{rows.map((row) => <button key={row.label} onClick={() => navigate(row.path)} className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-xs" style={{ color: C.textDim }}><span>{row.label}</span><strong className="text-sm tabular-nums" style={{ color: C.text }}>{row.value}</strong></button>)}</div>}
    </section>
  </div>;
}
