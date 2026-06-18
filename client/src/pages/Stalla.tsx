import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Plus, ChevronRight, Activity, Heart, Baby, Stethoscope,
  AlertTriangle, Syringe, Milk, Users, CheckCircle2, Clock,
  ArrowRight, X, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { FAL_IMAGES } from "@/lib/assets";

const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const RED = "oklch(0.65 0.22 25)";
const BLUE = "oklch(0.65 0.18 250)";
const PURPLE = "oklch(0.65 0.18 300)";
const ORANGE = "oklch(0.72 0.18 60)";
const TEAL = "oklch(0.68 0.16 185)";
const SURFACE = "oklch(0.10 0.006 145)";
const SURFACE2 = "oklch(0.13 0.007 145)";
const BORDER = "oklch(0.18 0.008 145)";

type StallaSub = "dashboard" | "gruppi" | "sincronizzazioni" | "gravidanze" | "zoppie" | "trattamenti" | "parti" | "asciutta" | "infermeria";

const MODULI: { id: StallaSub; label: string; color: string; icon: React.ElementType; desc: string }[] = [
  { id: "gruppi",         label: "Gruppi",          color: GREEN,   icon: Users,          desc: "Gestione gruppi di produzione" },
  { id: "sincronizzazioni", label: "Sincronizzazioni", color: BLUE,  icon: Activity,       desc: "Protocolli ormonali in corso" },
  { id: "gravidanze",     label: "Gravidanze",      color: PURPLE,  icon: Heart,          desc: "Gravidanze monitorate" },
  { id: "zoppie",         label: "Zoppie",          color: ORANGE,  icon: AlertTriangle,  desc: "Casi di zoppia attivi" },
  { id: "trattamenti",    label: "Trattamenti",     color: TEAL,    icon: Syringe,        desc: "Trattamenti pianificati" },
  { id: "parti",          label: "Parti",           color: GOLD,    icon: Baby,           desc: "Parti previsti questo mese" },
  { id: "asciutta",       label: "Asciutta",        color: RED,     icon: Milk,           desc: "Vacche in asciutta" },
  { id: "infermeria",     label: "Infermeria",      color: RED,     icon: Stethoscope,    desc: "Animali in infermeria" },
];

export default function Stalla() {
  const [sub, setSub] = useState<StallaSub>("dashboard");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ matricola: "", nome: "", gruppo: "", razza: "", stato: "attiva" as const });

  const { data: animaliList = [], refetch } = trpc.stalla.list.useQuery();
  const { data: stats } = trpc.stalla.stats.useQuery();
  const addMutation = trpc.stalla.add.useMutation({
    onSuccess: () => { refetch(); setSheetOpen(false); toast.success("Animale aggiunto"); setForm({ matricola: "", nome: "", gruppo: "", razza: "", stato: "attiva" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const eseguiMutation = trpc.stalla.eseguiTrattamento.useMutation({
    onSuccess: () => { refetch(); toast.success("Trattamento eseguito"); },
  });

  const vacche = animaliList.filter(a => a.sesso === "femmina");
  const attive = vacche.filter(a => a.stato === "attiva");
  const asciutta = vacche.filter(a => a.stato === "asciutta");
  const gravide = vacche.filter(a => a.stato === "gravida");
  const infermeria = vacche.filter(a => a.stato === "infermeria");

  const modCounts: Record<string, number> = {
    gruppi: new Set(animaliList.map(a => a.gruppo).filter(Boolean)).size,
    sincronizzazioni: stats?.sincronizzazioniOggi ?? 0,
    gravidanze: gravide.length,
    zoppie: stats?.zoppieAperte ?? 0,
    trattamenti: stats?.trattamentiPianificati ?? 0,
    parti: stats?.partiMese ?? 0,
    asciutta: asciutta.length,
    infermeria: infermeria.length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {sub !== "dashboard" ? (
            <button onClick={() => setSub("dashboard")} className="flex items-center gap-2 text-sm mb-1 hover:opacity-80 transition-opacity" style={{ color: GREEN }}>
              <ArrowRight className="w-4 h-4 rotate-180" /> Stalla
            </button>
          ) : null}
          <h1 className="text-2xl font-bold" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
            {sub === "dashboard" ? "Stalla" : MODULI.find(m => m.id === sub)?.label}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>
            {sub === "dashboard" ? `${attive.length} vacche attive · ${animaliList.length} totali` : MODULI.find(m => m.id === sub)?.desc}
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="flex items-center gap-2 font-semibold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
          <Plus className="w-4 h-4" />
          Nuova attività
        </Button>
      </div>

      {sub === "dashboard" && (
        <>
          {/* Hero stalla */}
          <div className="relative rounded-2xl overflow-hidden min-h-[150px] flex flex-col justify-end p-6"
            style={{ backgroundImage: `linear-gradient(90deg, oklch(0.08 0.006 145 / 0.92) 0%, oklch(0.08 0.006 145 / 0.55) 100%), url(${FAL_IMAGES.stallaCows})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: GREEN }}>Gestione Zootecnica</p>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "oklch(0.97 0.005 145)" }}>
              {attive.length} vacche in produzione
            </h2>
            <p className="text-sm mt-1" style={{ color: "oklch(0.78 0.01 145)" }}>
              {gravide.length} gravide · {asciutta.length} in asciutta · {infermeria.length} in infermeria
            </p>
          </div>

          {/* KPI rapidi */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Vacche Attive", value: attive.length, color: GREEN, icon: Activity },
              { label: "Gravide", value: gravide.length, color: PURPLE, icon: Heart },
              { label: "Asciutta", value: asciutta.length, color: GOLD, icon: Milk },
              { label: "Infermeria", value: infermeria.length, color: RED, icon: Stethoscope },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${k.color}20` }}>
                    <k.icon className="w-4 h-4" style={{ color: k.color }} />
                  </div>
                </div>
                <div className="text-3xl font-bold" style={{ color: k.color, fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Grid moduli — card 2x2 glow premium */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULI.map(mod => {
              const count = modCounts[mod.id] ?? 0;
              const hasAlert = (mod.id === "zoppie" || mod.id === "infermeria") && count > 0;
              return (
              <button
                key={mod.id}
                onClick={() => setSub(mod.id)}
                className="relative rounded-2xl p-5 text-left transition-all duration-300 group overflow-hidden hover:-translate-y-1"
                style={{
                  background: `linear-gradient(155deg, ${mod.color}14 0%, ${SURFACE2} 55%)`,
                  border: `1px solid ${mod.color}28`,
                  boxShadow: `0 0 0 0 ${mod.color}00`,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 30px -8px ${mod.color}55, inset 0 0 40px -20px ${mod.color}40`; e.currentTarget.style.borderColor = `${mod.color}55`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 0 0 ${mod.color}00`; e.currentTarget.style.borderColor = `${mod.color}28`; }}
              >
                {/* Illustrazione semitrasparente di sfondo */}
                <mod.icon className="absolute -right-3 -bottom-3 w-24 h-24 transition-transform duration-500 group-hover:scale-110" style={{ color: mod.color, opacity: 0.07 }} />
                {/* Glow radiale d'angolo */}
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-300 opacity-40 group-hover:opacity-70" style={{ background: mod.color }} />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${mod.color}22`, border: `1px solid ${mod.color}40`, backdropFilter: "blur(4px)" }}>
                      <mod.icon className="w-5 h-5" style={{ color: mod.color }} />
                    </div>
                    {hasAlert
                      ? <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: mod.color, boxShadow: `0 0 8px ${mod.color}` }} />
                      : <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: "oklch(0.4 0.008 145)" }} />}
                  </div>
                  <div className="text-4xl font-bold mb-1" style={{ color: mod.color, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em" }}>
                    {count}
                  </div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.9 0.006 145)" }}>{mod.label}</div>
                  <div className="text-xs" style={{ color: "oklch(0.5 0.008 145)" }}>{mod.desc}</div>
                </div>
              </button>
            );})}
          </div>

          {/* Lista animali recenti */}
          {animaliList.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
                <h3 className="font-semibold text-sm" style={{ color: "oklch(0.88 0.006 145)" }}>Registro Animali</h3>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${GREEN}15`, color: GREEN }}>{animaliList.length} totali</span>
              </div>
              <div className="divide-y" style={{ borderColor: BORDER }}>
                {animaliList.slice(0, 8).map(a => {
                  const statoColor = { attiva: GREEN, asciutta: GOLD, gravida: PURPLE, infermeria: RED, venduta: "oklch(0.50 0.01 145)", morta: "oklch(0.35 0.008 145)" }[a.stato] ?? GREEN;
                  return (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${statoColor}20`, color: statoColor }}>
                        {a.matricola.slice(-2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "oklch(0.88 0.006 145)" }}>
                          {a.nome || `Vacca ${a.matricola}`}
                        </div>
                        <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                          {a.matricola} {a.gruppo ? `· ${a.gruppo}` : ""} {a.razza ? `· ${a.razza}` : ""}
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${statoColor}15`, color: statoColor }}>
                        {a.stato.charAt(0).toUpperCase() + a.stato.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {animaliList.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.30 0.008 145)" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.65 0.01 145)" }}>Nessun animale registrato</p>
              <p className="text-xs mb-4" style={{ color: "oklch(0.40 0.008 145)" }}>Aggiungi il primo animale per iniziare a gestire la stalla</p>
              <Button onClick={() => setSheetOpen(true)} size="sm" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
                <Plus className="w-4 h-4 mr-2" /> Aggiungi animale
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── SUB: SINCRONIZZAZIONI ─────────────────────────────────────────────── */}
      {sub === "sincronizzazioni" && (
        <SincronizzazioniView animali={animaliList} onEsegui={(id) => eseguiMutation.mutate({ animaleId: id })} />
      )}

      {/* ── SUB: ZOPPIE ──────────────────────────────────────────────────────── */}
      {sub === "zoppie" && <ZoppieView />}

      {/* ── SUB: ALTRI (placeholder) ─────────────────────────────────────────── */}
      {sub !== "dashboard" && sub !== "sincronizzazioni" && sub !== "zoppie" && (
        <SubModuloView sub={sub} animali={animaliList} color={MODULI.find(m => m.id === sub)?.color ?? GREEN} />
      )}

      {/* Sheet aggiungi animale */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Nuovo Animale</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "matricola", label: "Matricola *", placeholder: "IT001..." },
              { key: "nome", label: "Nome", placeholder: "Opzionale" },
              { key: "gruppo", label: "Gruppo", placeholder: "es. Alta produzione" },
              { key: "razza", label: "Razza", placeholder: "es. Frisona" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>{f.label}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Stato</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                value={form.stato}
                onChange={e => setForm(p => ({ ...p, stato: e.target.value as any }))}
              >
                {["attiva", "asciutta", "gravida", "infermeria"].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <Button
              className="w-full font-bold py-3 mt-2"
              style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                if (!form.matricola) { toast.error("Matricola obbligatoria"); return; }
                addMutation.mutate(form);
              }}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Salvataggio..." : "Aggiungi Animale"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── SINCRONIZZAZIONI VIEW ─────────────────────────────────────────────────────
function SincronizzazioniView({ animali, onEsegui }: { animali: any[]; onEsegui: (id: string) => void }) {
  const [eseguiti, setEseguiti] = useState<Set<number>>(new Set());
  const daSincronizzare = animali.filter(a => a.stato === "attiva").slice(0, 6);

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Da sincronizzare oggi", value: daSincronizzare.length, color: BLUE },
          { label: "Veterinario", value: "Dr. Rossi", color: GREEN, isText: true },
          { label: "Domani", value: Math.max(0, daSincronizzare.length - eseguiti.size), color: GOLD },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="text-xs font-semibold mb-2 tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</div>
            <div className="text-2xl font-bold" style={{ color: k.color, fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Lista vacche */}
      <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: BORDER }}>
          <h3 className="font-semibold text-sm" style={{ color: "oklch(0.88 0.006 145)" }}>Lista Sincronizzazioni</h3>
        </div>
        {daSincronizzare.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: GREEN }} />
            <p className="text-sm" style={{ color: "oklch(0.65 0.01 145)" }}>Nessuna sincronizzazione pianificata</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {daSincronizzare.map((a, i) => {
              const done = eseguiti.has(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-4 px-5 py-4 transition-all ${done ? "opacity-50" : ""}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${BLUE}20`, color: BLUE }}>
                    {a.matricola.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>
                      {a.nome || `Vacca ${a.matricola}`}
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                      {a.matricola} · Farmaco: GnRH · Ore: {8 + i}:00
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "oklch(0.40 0.008 145)" }}>
                      Prossimo: +48h
                    </div>
                  </div>
                  {done ? (
                    <span className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: `${GREEN}15`, color: GREEN }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Eseguito
                    </span>
                  ) : (
                    <button
                      onClick={() => { onEsegui(a.id); setEseguiti(prev => { const s = new Set(Array.from(prev)); s.add(a.id); return s; }); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                      style={{ background: BLUE, color: "white" }}
                    >
                      Esegui
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completati */}
      {eseguiti.size > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
          <span className="text-sm" style={{ color: GREEN }}>{eseguiti.size} sincronizzazioni completate oggi</span>
        </div>
      )}
    </div>
  );
}

// ── ZOPPIE VIEW ───────────────────────────────────────────────────────────────
function ZoppieView() {
  const { data: zoppieList = [] } = trpc.stalla.zoppie.useQuery();

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <h3 className="font-semibold text-sm" style={{ color: "oklch(0.88 0.006 145)" }}>Casi di Zoppia</h3>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${ORANGE}15`, color: ORANGE }}>
            {zoppieList.filter((z: any) => z.stato !== "risolta").length} attivi
          </span>
        </div>
        {zoppieList.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: GREEN }} />
            <p className="text-sm" style={{ color: "oklch(0.65 0.01 145)" }}>Nessun caso di zoppia attivo</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {zoppieList.map((z: any) => {
              const statoColor = { aperta: RED, in_trattamento: ORANGE, risolta: GREEN }[z.stato as string] ?? ORANGE;
              return (
                <div key={z.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${statoColor}20` }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: statoColor }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>
                      Animale #{z.animaleId} · Score {z.score}/5
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                      {z.zampa || "Zampa non specificata"} · {z.dataRilevazione}
                    </div>
                    {z.diagnosi && <div className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.008 145)" }}>{z.diagnosi}</div>}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${statoColor}15`, color: statoColor }}>
                    {z.stato.replace("_", " ")}
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

// ── SUB MODULO GENERICO ───────────────────────────────────────────────────────
function SubModuloView({ sub, animali, color }: { sub: StallaSub; animali: any[]; color: string }) {
  const mod = MODULI.find(m => m.id === sub);
  const filtered = sub === "asciutta" ? animali.filter(a => a.stato === "asciutta")
    : sub === "infermeria" ? animali.filter(a => a.stato === "infermeria")
    : sub === "gravidanze" ? animali.filter(a => a.stato === "gravida")
    : animali;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
        {mod && <mod.icon className="w-5 h-5" style={{ color }} />}
        <h3 className="font-semibold text-sm" style={{ color: "oklch(0.88 0.006 145)" }}>{mod?.label}</h3>
        <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{ background: `${color}15`, color }}>
          {filtered.length}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          {mod && <mod.icon className="w-10 h-10 mx-auto mb-2" style={{ color: "oklch(0.30 0.008 145)" }} />}
          <p className="text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun elemento in questa sezione</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: BORDER }}>
          {filtered.map((a: any) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${color}20`, color }}>
                {a.matricola.slice(-2)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: "oklch(0.88 0.006 145)" }}>{a.nome || `Vacca ${a.matricola}`}</div>
                <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>{a.matricola} {a.razza ? `· ${a.razza}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
