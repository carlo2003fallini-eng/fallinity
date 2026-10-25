import { useEffect, useState } from "react";
import { ArrowLeft, Beef, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BORDER, GREEN, SURFACE, SURFACE2 } from "./shared";

const KEY = "fallinity:stalla:gruppi-demo:v1";
type DemoGroup = { id: string; nome: string; tipo: "manuale" | "automatico"; animali: number; descrizione: string };
const INITIAL: DemoGroup[] = [
  { id: "demo-lattazione", nome: "Lattazione demo", tipo: "manuale", animali: 18, descrizione: "Spostamenti simulati, nessuna scrittura reale" },
  { id: "demo-alta", nome: "Alta produzione demo", tipo: "automatico", animali: 7, descrizione: "Regola simulata: almeno 35 L/giorno" },
  { id: "demo-post", nome: "Post-parto demo", tipo: "automatico", animali: 4, descrizione: "Regola simulata: ultimi 21 giorni" },
];

function loadDemo() {
  try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) as DemoGroup[] : INITIAL; } catch { return INITIAL; }
}

export default function GruppiDemo({ onBack }: { onBack: () => void }) {
  const [groups, setGroups] = useState<DemoGroup[]>(loadDemo);
  useEffect(() => { sessionStorage.setItem(KEY, JSON.stringify(groups)); }, [groups]);
  function simulate() { setGroups((previous) => previous.map((group) => group.id === "demo-lattazione" ? { ...group, animali: group.animali + 1 } : group)); }
  function reset() { sessionStorage.removeItem(KEY); setGroups(INITIAL); }
  return <div className="space-y-4"><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold" style={{ color: GREEN }}><ArrowLeft size={17} /> Gruppi reali</button><section className="rounded-2xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${GREEN}18`, color: GREEN }}><ShieldCheck size={21} /></span><div><h1 className="text-xl font-bold" style={{ color: "oklch(0.96 0.005 145)" }}>Demo Stalla</h1><p className="mt-1 text-sm" style={{ color: "oklch(0.60 0.01 145)" }}>Ambiente isolato: le simulazioni restano solo in questa sessione del browser e non leggono né scrivono dati aziendali.</p></div></div></section><div className="grid grid-cols-2 gap-3">{groups.map((group) => <article key={group.id} className="rounded-2xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}><p className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: group.tipo === "automatico" ? GREEN : "oklch(0.65 0.01 145)" }}>{group.tipo}</p><h2 className="mt-2 text-sm font-bold" style={{ color: "oklch(0.90 0.006 145)" }}>{group.nome}</h2><p className="mt-1 text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>{group.descrizione}</p><p className="mt-4 flex items-center gap-1 text-lg font-bold" style={{ color: GREEN }}><Beef size={17} /> {group.animali}</p></article>)}</div><div className="flex gap-3"><Button onClick={simulate} className="min-h-12 flex-1 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><Plus className="mr-1 size-4" /> Simula aggiunta</Button><Button variant="outline" onClick={reset} className="min-h-12" style={{ borderColor: BORDER, color: "oklch(0.77 0.01 145)" }}><RotateCcw className="mr-1 size-4" /> Ripristina</Button></div><p className="rounded-xl px-3 py-2 text-xs" style={{ background: SURFACE2, color: "oklch(0.58 0.01 145)" }}>Le modifiche demo non entrano nel database, non generano movimenti, né cambiano i gruppi reali.</p></div>;
}
