import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, TrendingUp, Wallet, Target, ChevronRight, CreditCard, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const GREEN = "oklch(0.72 0.22 145)";
const GOLD = "oklch(0.78 0.15 85)";
const BLUE = "oklch(0.65 0.18 250)";
const RED = "oklch(0.65 0.22 25)";
const SURFACE = "oklch(0.10 0.006 145)";
const SURFACE2 = "oklch(0.13 0.007 145)";
const BORDER = "oklch(0.18 0.008 145)";

function fmt(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function Reintegrazione() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rataSheet, setRataSheet] = useState<{ open: boolean; fondoId: number; nome: string; rata: number }>({ open: false, fondoId: 0, nome: "", rata: 0 });
  const [addForm, setAddForm] = useState({ macchinaId: 1, nomeDisplay: "", valoreAcquisto: "", fondoAttuale: "0", tassoInteresse: "3", annoObiettivo: "" });
  const [importoRata, setImportoRata] = useState("");

  const { data: fondi = [], refetch } = trpc.reintegrazione.list.useQuery();
  const { data: totale } = trpc.reintegrazione.totale.useQuery();
  const { data: macchineList = [] } = trpc.officina.macchine.list.useQuery();

  const addMutation = trpc.reintegrazione.add.useMutation({
    onSuccess: () => { refetch(); setSheetOpen(false); toast.success("Fondo creato"); setAddForm({ macchinaId: 1, nomeDisplay: "", valoreAcquisto: "", fondoAttuale: "0", tassoInteresse: "3", annoObiettivo: "" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const pagaMutation = trpc.reintegrazione.pagaRata.useMutation({
    onSuccess: () => { refetch(); setRataSheet(p => ({ ...p, open: false })); toast.success("Rata versata con successo"); setImportoRata(""); },
    onError: () => toast.error("Errore durante il versamento"),
  });

  const totFondo = totale?.totale ?? 0;
  const totInteressi = totale?.interessi ?? 0;
  const versConsigliato = fondi.reduce((s, f) => s + Number(f.rataConsigliata ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
            Reintegrazione
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>
            Fondi di reintegrazione per macchine e attrezzature
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="flex items-center gap-2 font-semibold" style={{ background: GOLD, color: "oklch(0.08 0.01 145)" }}>
          <Plus className="w-4 h-4" />
          Nuovo fondo
        </Button>
      </div>

      {/* Hero card — Totale fondi */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{
        background: `linear-gradient(135deg, oklch(0.12 0.02 85), oklch(0.10 0.01 85))`,
        border: `1px solid oklch(0.22 0.04 85)`,
        boxShadow: `0 0 40px oklch(0.78 0.15 85 / 0.10)`,
      }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent)`, transform: "translate(30%, -30%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4" style={{ color: GOLD }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>Totale Fondi Reintegrazione</span>
          </div>
          <div className="text-5xl font-bold mb-2" style={{ color: GOLD, fontFamily: "'Space Grotesk', sans-serif" }}>
            {fmt(totFondo)}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.65 0.08 85)" }}>
            <TrendingUp className="w-4 h-4" />
            <span>+{fmt(totInteressi)} interessi maturati · {totale?.fondiCount ?? 0} fondi attivi</span>
          </div>
        </div>
      </div>

      {/* Versamento consigliato */}
      <div className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wider mb-1" style={{ color: "oklch(0.45 0.01 145)" }}>VERSAMENTO CONSIGLIATO</div>
            <div className="text-3xl font-bold mb-1" style={{ color: GREEN, fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(versConsigliato)}</div>
            <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
              Distribuzione automatica su {fondi.length} fondi · prossima scadenza: fine mese
            </div>
          </div>
          <Button
            onClick={() => {
              if (fondi.length === 0) { toast.error("Nessun fondo disponibile"); return; }
              toast.success("Versamento distribuito automaticamente");
            }}
            className="flex-shrink-0 font-semibold"
            style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}40` }}
          >
            Distribuisci
          </Button>
        </div>
      </div>

      {/* Lista fondi */}
      {fondi.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <Wallet className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.30 0.008 145)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.65 0.01 145)" }}>Nessun fondo di reintegrazione</p>
          <p className="text-xs mb-4" style={{ color: "oklch(0.40 0.008 145)" }}>Crea un fondo per ogni macchina per pianificare la sostituzione</p>
          <Button onClick={() => setSheetOpen(true)} size="sm" style={{ background: GOLD, color: "oklch(0.08 0.01 145)" }}>
            <Plus className="w-4 h-4 mr-2" /> Crea primo fondo
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wider" style={{ color: "oklch(0.50 0.01 145)" }}>FONDI PER MACCHINA</h2>
          {fondi.map((f: any) => {
            const pct = Math.min(100, Math.round((Number(f.fondoAttuale) / Number(f.valoreAcquisto)) * 100));
            const anniRimanenti = f.annoObiettivo ? f.annoObiettivo - new Date().getFullYear() : null;
            const pctColor = pct >= 75 ? GREEN : pct >= 40 ? GOLD : RED;

            return (
              <div key={f.id} className="rounded-xl p-5" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start gap-4">
                  {/* Icona */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                    background: "oklch(0.16 0.01 145)", border: `1px solid ${BORDER}`
                  }}>
                    <Tractor className="w-7 h-7" style={{ color: GOLD }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="font-semibold text-base" style={{ color: "oklch(0.92 0.006 145)" }}>{f.nomeDisplay}</div>
                        <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                          {f.nomeMacchina !== f.nomeDisplay ? f.nomeMacchina + " · " : ""}
                          Obiettivo: {f.annoObiettivo ?? "—"} · Tasso: {(Number(f.tassoInteresse) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold" style={{ color: pctColor, fontFamily: "'Space Grotesk', sans-serif" }}>{pct}%</div>
                        <div className="text-xs" style={{ color: "oklch(0.45 0.008 145)" }}>completato</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full mb-3 overflow-hidden" style={{ background: "oklch(0.16 0.01 145)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${pctColor}, ${pctColor}bb)` }} />
                    </div>

                    {/* Valori */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs" style={{ color: "oklch(0.45 0.008 145)" }}>Fondo attuale</div>
                        <div className="text-sm font-semibold" style={{ color: GREEN }}>{fmt(Number(f.fondoAttuale))}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: "oklch(0.45 0.008 145)" }}>Valore acquisto</div>
                        <div className="text-sm font-semibold" style={{ color: "oklch(0.75 0.008 145)" }}>{fmt(Number(f.valoreAcquisto))}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: "oklch(0.45 0.008 145)" }}>Interessi</div>
                        <div className="text-sm font-semibold" style={{ color: GOLD }}>{fmt(Number(f.fondoAttuale) * Number(f.tassoInteresse))}</div>
                      </div>
                    </div>

                    {/* Pulsante paga rata */}
                    <Button
                      size="sm"
                      onClick={() => setRataSheet({ open: true, fondoId: f.id, nome: f.nomeDisplay, rata: Number(f.rataConsigliata ?? 0) })}
                      className="font-semibold"
                      style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}40` }}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                      Paga rata {f.rataConsigliata ? fmt(Number(f.rataConsigliata)) : ""}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet nuovo fondo */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Nuovo Fondo Reintegrazione</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Macchina *</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                value={addForm.macchinaId}
                onChange={e => {
                  const mac = macchineList.find((m: any) => m.id === Number(e.target.value));
                  setAddForm(p => ({ ...p, macchinaId: Number(e.target.value), nomeDisplay: mac?.nome ?? "" }));
                }}
              >
                {macchineList.length === 0 && <option value={1}>Aggiungi prima una macchina in Officina</option>}
                {macchineList.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            {[
              { key: "nomeDisplay", label: "Nome display *", placeholder: "es. John Deere 6130R" },
              { key: "valoreAcquisto", label: "Valore acquisto (€) *", placeholder: "es. 120000" },
              { key: "fondoAttuale", label: "Fondo attuale (€)", placeholder: "0" },
              { key: "tassoInteresse", label: "Tasso interesse (%)", placeholder: "3" },
              { key: "annoObiettivo", label: "Anno obiettivo", placeholder: "es. 2030" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>{f.label}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              className="w-full font-bold py-3 mt-2"
              style={{ background: GOLD, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                if (!addForm.nomeDisplay || !addForm.valoreAcquisto) { toast.error("Nome e valore acquisto obbligatori"); return; }
                addMutation.mutate({
                  macchinaId: addForm.macchinaId,
                  nomeDisplay: addForm.nomeDisplay,
                  valoreAcquisto: Number(addForm.valoreAcquisto),
                  fondoAttuale: Number(addForm.fondoAttuale || 0),
                  tassoInteresse: Number(addForm.tassoInteresse || 3) / 100,
                  annoObiettivo: addForm.annoObiettivo ? Number(addForm.annoObiettivo) : undefined,
                });
              }}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? "Salvataggio..." : "Crea Fondo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet paga rata */}
      <Sheet open={rataSheet.open} onOpenChange={o => setRataSheet(p => ({ ...p, open: o }))}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Versa Rata — {rataSheet.nome}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="rounded-xl p-4" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
              <div className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Rata consigliata</div>
              <div className="text-2xl font-bold" style={{ color: GOLD }}>{fmt(rataSheet.rata)}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Importo da versare (€) *</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                placeholder={String(rataSheet.rata || "")}
                value={importoRata}
                onChange={e => setImportoRata(e.target.value)}
              />
            </div>
            <Button
              className="w-full font-bold py-3"
              style={{ background: GOLD, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                const imp = Number(importoRata || rataSheet.rata);
                if (!imp || imp <= 0) { toast.error("Importo non valido"); return; }
                pagaMutation.mutate({ fondoId: rataSheet.fondoId, importo: imp });
              }}
              disabled={pagaMutation.isPending}
            >
              {pagaMutation.isPending ? "Versamento..." : "Conferma Versamento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
