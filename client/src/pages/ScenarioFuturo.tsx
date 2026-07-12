import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  TrendingUp,
  Plus,
  ArrowLeft,
  Calculator,
  BarChart2,
  Layers,
  Trash2,
  Archive,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── Design tokens (coerenti con Officina/Stalla) ──────────────────────────
const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const RED = "oklch(0.65 0.22 25)";
const BLUE = "oklch(0.65 0.18 240)";
const PURPLE = "oklch(0.65 0.18 300)";
const SURFACE = "oklch(0.10 0.006 145)";
const BORDER = "oklch(0.18 0.008 145)";
const TEXT_DIM = "oklch(0.5 0.01 145)";
const TEXT_BRIGHT = "oklch(0.97 0.005 145)";

const MODELLO_LABELS: Record<string, { label: string; color: string }> = {
  personalizzato: { label: "Personalizzato", color: GREEN },
  espansione: { label: "Espansione", color: BLUE },
  riduzione_costi: { label: "Riduzione Costi", color: GOLD },
  nuovo_investimento: { label: "Nuovo Investimento", color: PURPLE },
  cambio_produzione: { label: "Cambio Produzione", color: RED },
};

const STATO_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  bozza: { label: "Bozza", bg: "oklch(0.3 0.01 145)", text: "oklch(0.7 0.01 145)" },
  calcolato: { label: "Calcolato", bg: "oklch(0.72 0.22 145 / 0.15)", text: GREEN },
  archiviato: { label: "Archiviato", bg: "oklch(0.78 0.15 85 / 0.15)", text: GOLD },
};

// ─── Step IDs ────────────────────────────────────────────────────────────────
type ViewMode = "list" | "create" | "detail" | "confronta";

export default function ScenarioFuturo() {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confrontaIds, setConfrontaIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Hero */}
      <div
        className="relative rounded-2xl overflow-hidden min-h-[120px] flex flex-col justify-end p-5"
        style={{
          background: `linear-gradient(135deg, oklch(0.08 0.02 145) 0%, oklch(0.12 0.04 240) 50%, oklch(0.08 0.02 300) 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, oklch(0.72 0.22 145 / 0.4) 0%, transparent 50%), radial-gradient(circle at 20% 80%, oklch(0.65 0.18 240 / 0.3) 0%, transparent 50%)" }} />
        <div className="relative z-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: GREEN }}>
            Simulazione What-If
          </p>
          <h2
            className="text-xl sm:text-2xl font-bold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: TEXT_BRIGHT }}
          >
            Scenario Futuro
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.65 0.01 145)" }}>
            Crea ipotesi, calcola l'impatto, confronta e decidi.
          </p>
        </div>
      </div>

      {/* Workflow steps indicator */}
      <WorkflowSteps active={view} />

      {/* Content */}
      {view === "list" && (
        <ScenarioList
          onSelect={(id) => { setSelectedId(id); setView("detail"); }}
          onCreate={() => setCreateOpen(true)}
          onConfronta={(ids) => { setConfrontaIds(ids); setView("confronta"); }}
        />
      )}
      {view === "detail" && selectedId && (
        <ScenarioDetail
          id={selectedId}
          onBack={() => { setSelectedId(null); setView("list"); }}
        />
      )}
      {view === "confronta" && (
        <ConfrontaView
          ids={confrontaIds}
          onBack={() => setView("list")}
        />
      )}

      {/* Sheet creazione */}
      <CreateScenarioSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => { setCreateOpen(false); setSelectedId(id); setView("detail"); }}
      />
    </div>
  );
}

// ─── WORKFLOW STEPS ──────────────────────────────────────────────────────────
function WorkflowSteps({ active }: { active: ViewMode }) {
  const steps = [
    { id: "list", label: "Scenari", icon: Layers },
    { id: "create", label: "Ipotesi", icon: Target },
    { id: "detail", label: "Calcola", icon: Calculator },
    { id: "confronta", label: "Confronta", icon: Scale },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const isActive = s.id === active || (active === "detail" && s.id === "create");
        return (
          <div key={s.id} className="flex items-center">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: isActive ? "oklch(0.72 0.22 145 / 0.12)" : "transparent",
                border: isActive ? `1px solid oklch(0.72 0.22 145 / 0.3)` : "1px solid transparent",
                color: isActive ? GREEN : TEXT_DIM,
              }}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-3 h-3 mx-0.5 flex-shrink-0" style={{ color: "oklch(0.3 0.01 145)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SCENARIO LIST ───────────────────────────────────────────────────────────
function ScenarioList({
  onSelect,
  onCreate,
  onConfronta,
}: {
  onSelect: (id: string) => void;
  onCreate: () => void;
  onConfronta: (ids: string[]) => void;
}) {
  const { data: scenari = [], isLoading } = trpc.scenario.list.useQuery();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const calcolati = useMemo(() => scenari.filter((s: any) => s.stato === "calcolato"), [scenari]);

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={onCreate}
          className="gap-1.5 text-xs font-semibold"
          style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Nuovo Scenario
        </Button>
        {selected.length >= 2 && (
          <Button
            onClick={() => onConfronta(selected)}
            variant="outline"
            className="gap-1.5 text-xs font-semibold"
            style={{ borderColor: BLUE, color: BLUE }}
          >
            <Scale className="w-3.5 h-3.5" />
            Confronta ({selected.length})
          </Button>
        )}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: SURFACE }} />
          ))}
        </div>
      ) : scenari.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.72 0.22 145 / 0.1)" }}>
            <Sparkles className="w-8 h-8" style={{ color: GREEN }} />
          </div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: TEXT_BRIGHT }}>Nessuno scenario</h3>
          <p className="text-sm max-w-xs" style={{ color: TEXT_DIM }}>
            Crea il tuo primo scenario what-if per simulare l'impatto di nuove decisioni sulla tua azienda.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {scenari.map((s: any) => {
            const badge = STATO_BADGE[s.stato] ?? STATO_BADGE.bozza;
            const modello = MODELLO_LABELS[s.modello] ?? MODELLO_LABELS.personalizzato;
            const isSelected = selected.includes(s.id);
            return (
              <div
                key={s.id}
                className="rounded-xl p-4 transition-all cursor-pointer active:scale-[0.98]"
                style={{
                  background: SURFACE,
                  border: `1px solid ${isSelected ? GREEN : BORDER}`,
                  boxShadow: isSelected ? `0 0 0 1px ${GREEN}` : "none",
                }}
                onClick={() => onSelect(s.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold truncate" style={{ color: TEXT_BRIGHT }}>{s.nome}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_DIM }}>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: `${modello.color}15`, color: modello.color }}>
                        {modello.label}
                      </span>
                      {s.descrizione && <span className="truncate">{s.descrizione}</span>}
                    </div>
                    {s.risultato && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-semibold" style={{ color: s.risultato.deltaUtileAnnuo >= 0 ? GREEN : RED }}>
                          {s.risultato.deltaUtileAnnuo >= 0 ? "+" : ""}{formatCurrency(s.risultato.deltaUtileAnnuo)}/anno
                        </span>
                        {s.risultato.roi !== null && (
                          <span className="text-xs" style={{ color: GOLD }}>
                            ROI {s.risultato.roi}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Checkbox per confronto */}
                  {s.stato === "calcolato" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                      style={{
                        borderColor: isSelected ? GREEN : "oklch(0.3 0.01 145)",
                        background: isSelected ? GREEN : "transparent",
                      }}
                    >
                      {isSelected && <span className="text-[10px] font-bold" style={{ color: "oklch(0.08 0.01 145)" }}>✓</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {calcolati.length >= 2 && selected.length === 0 && (
        <p className="text-xs text-center" style={{ color: TEXT_DIM }}>
          Seleziona 2-5 scenari calcolati per confrontarli
        </p>
      )}
    </div>
  );
}

// ─── CREATE SCENARIO SHEET ───────────────────────────────────────────────────
function CreateScenarioSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [modello, setModello] = useState("personalizzato");
  const [descrizione, setDescrizione] = useState("");
  const utils = trpc.useUtils();

  const createMut = trpc.scenario.create.useMutation({
    onSuccess: (data: any) => {
      utils.scenario.list.invalidate();
      toast.success("Scenario creato");
      onCreated(data.id);
      setNome("");
      setModello("personalizzato");
      setDescrizione("");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderColor: BORDER }}>
        <SheetHeader>
          <SheetTitle className="text-left" style={{ color: TEXT_BRIGHT }}>Nuovo Scenario</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Nome scenario</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="es. Espansione 20 capi"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1"
              style={{ background: SURFACE, borderColor: BORDER, color: TEXT_BRIGHT }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Modello</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(MODELLO_LABELS).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => setModello(key)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: modello === key ? `${color}20` : SURFACE,
                    border: `1px solid ${modello === key ? color : BORDER}`,
                    color: modello === key ? color : TEXT_DIM,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Descrizione (opzionale)</label>
            <textarea
              value={descrizione}
              onChange={e => setDescrizione(e.target.value)}
              placeholder="Breve descrizione dello scenario..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none resize-none focus:ring-1"
              style={{ background: SURFACE, borderColor: BORDER, color: TEXT_BRIGHT }}
            />
          </div>
          <Button
            onClick={() => createMut.mutate({ nome, modello: modello as any, descrizione: descrizione || undefined })}
            disabled={!nome.trim() || createMut.isPending}
            className="w-full gap-1.5 font-semibold"
            style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
          >
            <Plus className="w-4 h-4" />
            {createMut.isPending ? "Creazione..." : "Crea Scenario"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── SCENARIO DETAIL (ipotesi + calcolo + risultati) ─────────────────────────
function ScenarioDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: scenario, isLoading } = trpc.scenario.detail.useQuery({ id });
  const { data: variabiliMeta } = trpc.scenario.variabiliMeta.useQuery();
  const [addOpen, setAddOpen] = useState(false);
  const utils = trpc.useUtils();

  const calcolaMut = trpc.scenario.calcola.useMutation({
    onSuccess: () => {
      utils.scenario.detail.invalidate({ id });
      utils.scenario.list.invalidate();
      toast.success("Impatto calcolato!");
    },
    onError: (err) => toast.error(err.message || "Errore nel calcolo"),
  });

  const deleteMut = trpc.scenario.delete.useMutation({
    onSuccess: () => {
      utils.scenario.list.invalidate();
      toast.success("Scenario eliminato");
      onBack();
    },
  });

  const archiviaMut = trpc.scenario.archivia.useMutation({
    onSuccess: () => {
      utils.scenario.detail.invalidate({ id });
      utils.scenario.list.invalidate();
      toast.success("Scenario archiviato");
    },
  });

  if (isLoading || !scenario) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded animate-pulse" style={{ background: SURFACE }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ background: SURFACE }} />
      </div>
    );
  }

  const badge = STATO_BADGE[scenario.stato] ?? STATO_BADGE.bozza;
  const risultato = scenario.risultato;

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg transition-colors" style={{ color: TEXT_DIM }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate" style={{ color: TEXT_BRIGHT }}>{scenario.nome}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: badge.bg, color: badge.text }}>
              {badge.label}
            </span>
            <span className="text-xs" style={{ color: TEXT_DIM }}>
              {MODELLO_LABELS[scenario.modello]?.label ?? scenario.modello}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {scenario.stato === "calcolato" && (
            <button onClick={() => archiviaMut.mutate({ id })} className="p-2 rounded-lg" style={{ color: GOLD }}>
              <Archive className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { if (confirm("Eliminare questo scenario?")) deleteMut.mutate({ id }); }} className="p-2 rounded-lg" style={{ color: RED }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ipotesi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold" style={{ color: TEXT_BRIGHT }}>Ipotesi ({scenario.ipotesi?.length ?? 0})</h4>
          {scenario.stato === "bozza" && (
            <Button
              onClick={() => setAddOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              style={{ borderColor: GREEN, color: GREEN }}
            >
              <Plus className="w-3 h-3" />
              Aggiungi
            </Button>
          )}
        </div>

        {(!scenario.ipotesi || scenario.ipotesi.length === 0) ? (
          <div className="rounded-xl p-6 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <Target className="w-8 h-8 mx-auto mb-2" style={{ color: TEXT_DIM }} />
            <p className="text-sm" style={{ color: TEXT_DIM }}>Nessuna ipotesi definita. Aggiungi variabili per simulare l'impatto.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {scenario.ipotesi.map((ip: any) => (
              <IpotesiCard key={ip.id} ipotesi={ip} variabiliMeta={variabiliMeta} />
            ))}
          </div>
        )}
      </div>

      {/* Calcola button */}
      {scenario.stato === "bozza" && scenario.ipotesi && scenario.ipotesi.length > 0 && (
        <Button
          onClick={() => calcolaMut.mutate({ scenarioId: id })}
          disabled={calcolaMut.isPending}
          className="w-full gap-2 font-semibold text-sm py-3"
          style={{ background: `linear-gradient(135deg, ${GREEN}, oklch(0.6 0.2 200))`, color: "oklch(0.08 0.01 145)" }}
        >
          <Zap className="w-4 h-4" />
          {calcolaMut.isPending ? "Calcolo in corso..." : "Calcola Impatto"}
        </Button>
      )}

      {/* Risultati */}
      {risultato && <RisultatoPanel risultato={risultato} />}

      {/* Add ipotesi sheet */}
      <AddIpotesiSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scenarioId={id}
        variabiliMeta={variabiliMeta}
        existingVariables={(scenario.ipotesi ?? []).map((ip: any) => ip.variabile)}
      />
    </div>
  );
}

// ─── IPOTESI CARD ────────────────────────────────────────────────────────────
function IpotesiCard({ ipotesi, variabiliMeta }: { ipotesi: any; variabiliMeta: any }) {
  const meta = variabiliMeta?.[ipotesi.variabile] ?? ipotesi.meta ?? { label: ipotesi.variabile, unita: ipotesi.unita };
  const variazione = ipotesi.valoreAttuale !== 0
    ? ((ipotesi.valoreIpotesi - ipotesi.valoreAttuale) / ipotesi.valoreAttuale) * 100
    : 0;
  const isPositive = variazione >= 0;

  return (
    <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: TEXT_BRIGHT }}>{meta.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: TEXT_DIM }}>
              {formatNumber(ipotesi.valoreAttuale)} → <span style={{ color: isPositive ? GREEN : RED }}>{formatNumber(ipotesi.valoreIpotesi)}</span> {meta.unita}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span
            className="text-sm font-bold"
            style={{ color: isPositive ? GREEN : RED }}
          >
            {isPositive ? "+" : ""}{variazione.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── ADD IPOTESI SHEET ───────────────────────────────────────────────────────
function AddIpotesiSheet({
  open,
  onClose,
  scenarioId,
  variabiliMeta,
  existingVariables,
}: {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  variabiliMeta: any;
  existingVariables: string[];
}) {
  const [variabile, setVariabile] = useState("");
  const [valoreAttuale, setValoreAttuale] = useState("");
  const [valoreIpotesi, setValoreIpotesi] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const addMut = trpc.scenario.addIpotesi.useMutation({
    onSuccess: () => {
      utils.scenario.detail.invalidate({ id: scenarioId });
      toast.success("Ipotesi aggiunta");
      setVariabile("");
      setValoreAttuale("");
      setValoreIpotesi("");
      setNote("");
      onClose();
    },
    onError: () => toast.error("Errore nell'aggiunta"),
  });

  const availableVars = useMemo(() => {
    if (!variabiliMeta) return [];
    return Object.entries(variabiliMeta)
      .filter(([key]) => !existingVariables.includes(key))
      .map(([key, meta]: [string, any]) => ({ key, ...meta }));
  }, [variabiliMeta, existingVariables]);

  const selectedMeta = variabiliMeta?.[variabile];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderColor: BORDER }}>
        <SheetHeader>
          <SheetTitle className="text-left" style={{ color: TEXT_BRIGHT }}>Aggiungi Ipotesi</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Variabile selector */}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Variabile</label>
            <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
              {availableVars.map((v: any) => (
                <button
                  key={v.key}
                  onClick={() => setVariabile(v.key)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: variabile === v.key ? "oklch(0.72 0.22 145 / 0.1)" : SURFACE,
                    border: `1px solid ${variabile === v.key ? GREEN : BORDER}`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: variabile === v.key ? GREEN : TEXT_BRIGHT }}>{v.label}</span>
                  <span className="text-[10px]" style={{ color: TEXT_DIM }}>{v.unita}</span>
                </button>
              ))}
            </div>
          </div>

          {variabile && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Valore attuale</label>
                  <input
                    type="number"
                    value={valoreAttuale}
                    onChange={e => setValoreAttuale(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                    style={{ background: SURFACE, borderColor: BORDER, color: TEXT_BRIGHT }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Valore ipotesi</label>
                  <input
                    type="number"
                    value={valoreIpotesi}
                    onChange={e => setValoreIpotesi(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                    style={{ background: SURFACE, borderColor: BORDER, color: TEXT_BRIGHT }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: TEXT_DIM }}>Note (opzionale)</label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Motivazione o fonte..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{ background: SURFACE, borderColor: BORDER, color: TEXT_BRIGHT }}
                />
              </div>
              <Button
                onClick={() => addMut.mutate({
                  scenarioId,
                  variabile: variabile as any,
                  valoreAttuale: Number(valoreAttuale),
                  valoreIpotesi: Number(valoreIpotesi),
                  unita: selectedMeta?.unita ?? "€",
                  note: note || undefined,
                })}
                disabled={!valoreAttuale || !valoreIpotesi || addMut.isPending}
                className="w-full font-semibold"
                style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
              >
                {addMut.isPending ? "Salvataggio..." : "Aggiungi Ipotesi"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── RISULTATO PANEL ─────────────────────────────────────────────────────────
function RisultatoPanel({ risultato }: { risultato: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4" style={{ color: GREEN }} />
        <h4 className="text-sm font-semibold" style={{ color: TEXT_BRIGHT }}>Risultati Simulazione</h4>
      </div>

      {/* KPI principali */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Delta Utile/Anno"
          value={formatCurrency(risultato.deltaUtileAnnuo)}
          prefix={risultato.deltaUtileAnnuo >= 0 ? "+" : ""}
          color={risultato.deltaUtileAnnuo >= 0 ? GREEN : RED}
        />
        <KpiCard
          label="Delta Ricavi/Anno"
          value={formatCurrency(risultato.deltaRicaviAnnuo)}
          prefix={risultato.deltaRicaviAnnuo >= 0 ? "+" : ""}
          color={risultato.deltaRicaviAnnuo >= 0 ? GREEN : RED}
        />
        <KpiCard
          label="Delta Costi/Anno"
          value={formatCurrency(risultato.deltaCostiAnnuo)}
          prefix={risultato.deltaCostiAnnuo > 0 ? "+" : ""}
          color={risultato.deltaCostiAnnuo > 0 ? RED : GREEN}
        />
        {risultato.roi !== null && (
          <KpiCard
            label="ROI"
            value={`${risultato.roi}%`}
            color={risultato.roi >= 0 ? GREEN : RED}
          />
        )}
      </div>

      {/* Payback */}
      {risultato.paybackMesi !== null && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <TrendingUp className="w-5 h-5 flex-shrink-0" style={{ color: GOLD }} />
          <div>
            <p className="text-xs" style={{ color: TEXT_DIM }}>Payback Period</p>
            <p className="text-sm font-bold" style={{ color: GOLD }}>{risultato.paybackMesi} mesi</p>
          </div>
        </div>
      )}

      {/* Variazioni dettaglio */}
      {risultato.variazioni && risultato.variazioni.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-3 py-2" style={{ background: "oklch(0.12 0.006 145)" }}>
            <p className="text-xs font-semibold" style={{ color: TEXT_DIM }}>Variazioni per variabile</p>
          </div>
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {risultato.variazioni.map((v: any) => (
              <div key={v.variabile} className="flex items-center justify-between px-3 py-2" style={{ background: SURFACE }}>
                <span className="text-xs truncate flex-1" style={{ color: TEXT_BRIGHT }}>{v.variabile.replace(/_/g, " ")}</span>
                <span className="text-xs font-semibold ml-2" style={{ color: v.variazione >= 0 ? GREEN : RED }}>
                  {v.variazione >= 0 ? "+" : ""}{v.variazione}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, prefix, color }: { label: string; value: string; prefix?: string; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <p className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: TEXT_DIM }}>{label.toUpperCase()}</p>
      <p className="text-lg font-bold" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
        {prefix}{value}
      </p>
    </div>
  );
}

// ─── CONFRONTA VIEW ──────────────────────────────────────────────────────────
function ConfrontaView({ ids, onBack }: { ids: string[]; onBack: () => void }) {
  const [stableIds] = useState(ids);
  const { data: confronto, isLoading } = trpc.scenario.confronta.useQuery({ scenarioIds: stableIds });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded animate-pulse" style={{ background: SURFACE }} />
        <div className="h-60 rounded-xl animate-pulse" style={{ background: SURFACE }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg" style={{ color: TEXT_DIM }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold" style={{ color: TEXT_BRIGHT }}>Confronto Scenari</h3>
      </div>

      {!confronto || confronto.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: TEXT_DIM }}>Nessun scenario calcolato da confrontare.</p>
        </div>
      ) : (
        <>
          {/* Tabella confronto */}
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "oklch(0.12 0.006 145)" }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: TEXT_DIM }}>Metrica</th>
                  {confronto.map((s: any) => (
                    <th key={s.id} className="text-right px-3 py-2 font-semibold truncate max-w-[100px]" style={{ color: TEXT_BRIGHT }}>
                      {s.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: BORDER }}>
                {[
                  { key: "deltaUtileAnnuo", label: "Delta Utile/Anno" },
                  { key: "deltaRicaviAnnuo", label: "Delta Ricavi/Anno" },
                  { key: "deltaCostiAnnuo", label: "Delta Costi/Anno" },
                  { key: "roi", label: "ROI %" },
                  { key: "paybackMesi", label: "Payback (mesi)" },
                ].map(row => (
                  <tr key={row.key} style={{ background: SURFACE }}>
                    <td className="px-3 py-2 font-medium" style={{ color: TEXT_DIM }}>{row.label}</td>
                    {confronto.map((s: any) => {
                      const val = s.risultato?.[row.key];
                      const isCurrency = row.key.startsWith("delta");
                      const display = val === null || val === undefined
                        ? "—"
                        : isCurrency
                          ? `${val >= 0 ? "+" : ""}${formatCurrency(val)}`
                          : row.key === "roi"
                            ? `${val}%`
                            : val;
                      const color = val === null || val === undefined
                        ? TEXT_DIM
                        : row.key === "deltaCostiAnnuo"
                          ? (val > 0 ? RED : GREEN)
                          : (typeof val === "number" && val >= 0 ? GREEN : RED);
                      return (
                        <td key={s.id} className="px-3 py-2 text-right font-semibold" style={{ color }}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Best scenario highlight */}
          {confronto.length >= 2 && (() => {
            const best = [...confronto].sort((a: any, b: any) => (b.risultato?.deltaUtileAnnuo ?? 0) - (a.risultato?.deltaUtileAnnuo ?? 0))[0];
            return (
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "oklch(0.72 0.22 145 / 0.08)", border: `1px solid oklch(0.72 0.22 145 / 0.2)` }}>
                <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: GREEN }}>Scenario migliore</p>
                  <p className="text-sm font-bold" style={{ color: TEXT_BRIGHT }}>{best.nome}</p>
                  <p className="text-xs" style={{ color: TEXT_DIM }}>
                    +{formatCurrency(best.risultato?.deltaUtileAnnuo ?? 0)}/anno
                    {best.risultato?.roi !== null && ` · ROI ${best.risultato.roi}%`}
                  </p>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M €`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}k €`;
  return `${val.toLocaleString("it-IT")} €`;
}

function formatNumber(val: number): string {
  return val.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}
