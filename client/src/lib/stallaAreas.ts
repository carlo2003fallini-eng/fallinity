import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Beef,
  CalendarClock,
  Dna,
  Euro,
  Footprints,
  HeartPulse,
  History,
  Milk,
  Pill,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TestTube2,
  Thermometer,
  TrendingUp,
  UsersRound,
  Utensils,
  Wheat,
} from "lucide-react";

export type StallaAreaId = "dati-latte" | "riproduzione" | "vitelli" | "gruppi" | "sanita" | "alimentazione";

export type StallaTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type StallaArea = {
  id: StallaAreaId;
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  color: string;
  backgroundImage: string;
  backgroundPosition: string;
  tabs: StallaTab[];
};

export const STALLA_AREAS: StallaArea[] = [
  {
    id: "dati-latte",
    title: "Dati stalla",
    eyebrow: "Produzione e qualità",
    description: "Raccogli produzione, parametri qualitativi e analisi del latte in un unico punto.",
    icon: Milk,
    color: "oklch(0.72 0.18 185)",
    backgroundImage: "/manus-storage/dati-stalla_1a2d7071.jpg",
    backgroundPosition: "30% center",
    tabs: [
      { id: "produzione", label: "Produzione", icon: Milk },
      { id: "qualita", label: "Qualità", icon: TestTube2 },
      { id: "temperatura", label: "Temperatura", icon: Thermometer },
      { id: "analisi", label: "Analisi", icon: BarChart3 },
      { id: "storico", label: "Storico", icon: History },
    ],
  },
  {
    id: "riproduzione",
    title: "Riproduzione",
    eyebrow: "Ciclo riproduttivo",
    description: "Segui fecondazioni, diagnosi, trattamenti e prossime scadenze riproduttive.",
    icon: HeartPulse,
    color: "oklch(0.68 0.18 315)",
    backgroundImage: "/manus-storage/riproduzione_e5015a4c.jpg",
    backgroundPosition: "70% center",
    tabs: [
      { id: "animali", label: "Animali", icon: Beef },
      { id: "gravidanze", label: "Gravidanze", icon: HeartPulse },
      { id: "fecondazioni", label: "Fecondazioni", icon: Syringe },
      { id: "diagnosi", label: "Diagnosi", icon: Stethoscope },
      { id: "sincronizzazioni", label: "Sincronizzazioni", icon: Activity },
      { id: "scadenze", label: "Scadenze", icon: CalendarClock },
    ],
  },
  {
    id: "vitelli",
    title: "Vitelli",
    eyebrow: "Rimonta e crescita",
    description: "Consulta le schede dei vitelli e organizza crescita, svezzamento e stato sanitario.",
    icon: Beef,
    color: "oklch(0.74 0.17 80)",
    backgroundImage: "/manus-storage/vitelli_fb9a167e.jpg",
    backgroundPosition: "30% center",
    tabs: [
      { id: "elenco", label: "Elenco", icon: Beef },
      { id: "crescita", label: "Crescita", icon: TrendingUp },
      { id: "alimentazione", label: "Alimentazione", icon: Utensils },
      { id: "svezzamento", label: "Svezzamento", icon: Activity },
      { id: "sanita", label: "Sanità", icon: ShieldCheck },
    ],
  },
  {
    id: "gruppi",
    title: "Gruppi",
    eyebrow: "Mandria e genetica",
    description: "Organizza la mandria, confronta i gruppi e consulta la genetica senza duplicare le schede animali.",
    icon: UsersRound,
    color: "oklch(0.67 0.18 145)",
    backgroundImage: "/manus-storage/gruppi_81c45d0c.jpg",
    backgroundPosition: "center",
    tabs: [
      { id: "gruppi", label: "Gruppi", icon: UsersRound },
      { id: "animali", label: "Animali", icon: Beef },
      { id: "produzione", label: "Produzione", icon: BarChart3 },
      { id: "genetica", label: "Genetica", icon: Dna },
    ],
  },
  {
    id: "sanita",
    title: "Sanità",
    eyebrow: "Prevenzione e cure",
    description: "Monitora le segnalazioni, i trattamenti e la salute della mandria.",
    icon: Stethoscope,
    color: "oklch(0.67 0.2 28)",
    backgroundImage: "/manus-storage/sanita_9ab86209.jpg",
    backgroundPosition: "70% center",
    tabs: [
      { id: "casi", label: "Casi aperti", icon: Stethoscope },
      { id: "mastiti", label: "Mastiti", icon: HeartPulse },
      { id: "zoppie", label: "Zoppie", icon: Footprints },
      { id: "trattamenti", label: "Trattamenti", icon: Pill },
      { id: "farmaci", label: "Farmaci", icon: ShieldCheck },
      { id: "scadenze", label: "Scadenze", icon: CalendarClock },
    ],
  },
  {
    id: "alimentazione",
    title: "Alimentazione",
    eyebrow: "Razioni e consumi",
    description: "Gestisci razioni, ingredienti, consumi e costi alimentari per gruppo.",
    icon: Wheat,
    color: "oklch(0.7 0.16 118)",
    backgroundImage: "/manus-storage/alimentazione_71b16042.jpg",
    backgroundPosition: "70% center",
    tabs: [
      { id: "razioni", label: "Razioni", icon: Wheat },
      { id: "gruppi", label: "Per gruppo", icon: UsersRound },
      { id: "ingredienti", label: "Ingredienti", icon: Utensils },
      { id: "consumi", label: "Consumi", icon: BarChart3 },
      { id: "costi", label: "Costi", icon: Euro },
      { id: "storico", label: "Storico", icon: History },
    ],
  },
];

export function getStallaArea(id: string | undefined) {
  return STALLA_AREAS.find((area) => area.id === id);
}
