import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, ArrowLeft, Plus, Calendar, Activity, Syringe, ArrowRightLeft, Stethoscope, FileText, AlertTriangle, Baby, Milk, Heart, MoreHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { GREEN, GOLD, SURFACE, SURFACE2, BORDER, STATO_PRODUTTIVO, STATO_RIPRODUTTIVO, StatoBadge, HealthDot, RED, BLUE, PURPLE, ORANGE } from "./shared";

type ActionType = "trattamento" | "sincronizzazione" | "inseminazione" | "controllo_gravidanza" | "sposta_gruppo" | "zoppia" | "infermeria" | "asciutta" | "parto" | "nota" | "scheda" | null;

const AZIONI_ANIMALE: Array<{ id: ActionType; label: string; icon: React.ElementType; color: string }> = [
  { id: "trattamento", label: "Aggiungi trattamento", icon: Syringe, color: BLUE },
  { id: "sincronizzazione", label: "Registra sincronizzazione", icon: Activity, color: PURPLE },
  { id: "inseminazione", label: "Registra inseminazione", icon: Heart, color: PURPLE },
  { id: "controllo_gravidanza", label: "Controllo gravidanza", icon: Stethoscope, color: ORANGE },
  { id: "sposta_gruppo", label: "Sposta gruppo", icon: ArrowRightLeft, color: GREEN },
  { id: "zoppia", label: "Registra zoppia", icon: AlertTriangle, color: RED },
  { id: "infermeria", label: "Sposta in Infermeria", icon: Stethoscope, color: RED },
  { id: "asciutta", label: "Imposta asciutta", icon: Milk, color: GOLD },
  { id: "parto", label: "Registra parto", icon: Baby, color: GREEN },
  { id: "nota", label: "Aggiungi nota", icon: FileText, color: "oklch(0.55 0.01 145)" },
  { id: "scheda", label: "Apri scheda completa", icon: MoreHorizontal, color: "oklch(0.55 0.01 145)" },
];

export default function AnimaliTab() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActionType>(null);
  const [actionAnimaleId, setActionAnimaleId] = useState<string | null>(null);
  const [form, setForm] = useState({ matricola: "", nome: "", razza: "", sesso: "femmina" as string, statoProduttivo: "in_lattazione" as string, statoRiproduttivo: "vuota" as string, numeroAziendale: "", rfid: "", gruppoId: "", dataNascita: "", note: "", confermaFattori: true });
  const [trattamentoForm, setTrattamentoForm] = useState({ tipo: "farmaco" as string, tipologia: "", motivo: "", farmaco: "", prodotto: "", dose: "", unitaMisura: "ml", viaSomministrazione: "", dataTrattamento: new Date().toISOString().slice(0, 16), dataFine: "", tempiSospensione: "", operatore: "", veterinario: "", note: "" });
  const [spostaGruppoId, setSpostaGruppoId] = useState("");
  const [notaText, setNotaText] = useState("");

  const { data: animaliList = [], refetch: refetchList } = trpc.stalla.list.useQuery();
  const { data: searchResults = [] } = trpc.stalla.ricerca.useQuery({ query }, { enabled: query.length >= 2 });
  const { data: scheda, refetch: refetchScheda } = trpc.stalla.animali.scheda.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: gruppiList = [] } = trpc.stalla.gruppi.list.useQuery(undefined);
  const { data: anteprimaData } = trpc.stalla.anteprimaFattori.useQuery(
    { animaleId: actionAnimaleId ?? undefined, gruppoDestinazioneId: spostaGruppoId },
    { enabled: !!actionAnimaleId && !!spostaGruppoId && actionSheet === "sposta_gruppo" }
  );

  const createMut = trpc.stalla.animali.create.useMutation({ onSuccess: () => { refetchList(); setSheetOpen(false); toast.success("Animale registrato"); resetForm(); } });
  const addEventoMut = trpc.stalla.addEvento.useMutation({ onSuccess: () => { refetchScheda(); refetchList(); toast.success("Evento registrato"); } });
  const createTrattamentoMut = trpc.stalla.trattamenti.create.useMutation({ onSuccess: () => { refetchScheda(); refetchList(); toast.success("Trattamento registrato"); setActionSheet(null); } });
  const spostaGruppoMut = trpc.stalla.animali.spostaGruppo.useMutation({ onSuccess: () => { refetchScheda(); refetchList(); toast.success("Spostamento completato"); setActionSheet(null); } });

  function resetForm() { setForm({ matricola: "", nome: "", razza: "", sesso: "femmina", statoProduttivo: "in_lattazione", statoRiproduttivo: "vuota", numeroAziendale: "", rfid: "", gruppoId: "", dataNascita: "", note: "", confermaFattori: true }); }

  // Anteprima fattori per creazione (quando si seleziona un gruppo)
  const { data: anteprimaCreazione } = trpc.stalla.anteprimaFattori.useQuery(
    { gruppoDestinazioneId: form.gruppoId },
    { enabled: !!form.gruppoId && sheetOpen }
  );

  const displayList = query.length >= 2 ? searchResults : animaliList;

  // Animale selezionato per azione
  const actionAnimale = useMemo(() => {
    if (!actionAnimaleId) return null;
    return animaliList.find((a: any) => a.id === actionAnimaleId) ?? null;
  }, [actionAnimaleId, animaliList]);

  function openAction(animaleId: string, action: ActionType) {
    setActionAnimaleId(animaleId);
    if (action === "scheda") {
      setSelectedId(animaleId);
      return;
    }
    setActionSheet(action);
    setSpostaGruppoId("");
    setNotaText("");
    setTrattamentoForm({ tipo: "farmaco", tipologia: "", motivo: "", farmaco: "", prodotto: "", dose: "", unitaMisura: "ml", viaSomministrazione: "", dataTrattamento: new Date().toISOString().slice(0, 16), dataFine: "", tempiSospensione: "", operatore: "", veterinario: "", note: "" });
  }

  function handleQuickAction(animaleId: string, action: ActionType) {
    if (action === "infermeria") {
      // Sposta nel gruppo infermeria
      const infGruppo = gruppiList.find((g: any) => g.tipologia === "infermeria");
      if (infGruppo) {
        spostaGruppoMut.mutate({ animaleId, nuovoGruppoId: (infGruppo as any).id, confermaFattori: true });
      } else {
        toast.error("Nessun gruppo Infermeria configurato");
      }
      return;
    }
    if (action === "asciutta") {
      const ascGruppo = gruppiList.find((g: any) => g.tipologia === "asciutta");
      if (ascGruppo) {
        spostaGruppoMut.mutate({ animaleId, nuovoGruppoId: (ascGruppo as any).id, confermaFattori: true });
      } else {
        toast.error("Nessun gruppo Asciutta configurato");
      }
      return;
    }
    openAction(animaleId, action);
  }

  // ── Scheda animale ──
  if (selectedId && scheda) {
    const sp = STATO_PRODUTTIVO[scheda.statoProduttivo ?? "in_lattazione"] ?? STATO_PRODUTTIVO.in_lattazione;
    const sr = STATO_RIPRODUTTIVO[scheda.statoRiproduttivo ?? "vuota"] ?? STATO_RIPRODUTTIVO.vuota;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity" style={{ color: GREEN }}>
          <ArrowLeft className="w-4 h-4" /> Torna alla lista
        </button>
        {/* Header scheda */}
        <div className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {scheda.nome || `Animale ${scheda.matricola}`}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>
                {scheda.matricola} {scheda.numeroAziendale ? `· N° ${scheda.numeroAziendale}` : ""} {scheda.rfid ? `· RFID ${scheda.rfid}` : ""}
              </p>
            </div>
            <HealthDot score={scheda.healthScore} />
          </div>
          <div className="flex gap-2 mt-3">
            <StatoBadge label={sp.label} color={sp.color} />
            <StatoBadge label={sr.label} color={sr.color} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Produzione", value: scheda.produzioneOggi ? `${scheda.produzioneOggi} L` : "—" },
              { label: "GG Lattazione", value: scheda.giorniLattazione ?? "—" },
              { label: "GG Gravidanza", value: scheda.giorniGravidanza ?? "—" },
            ].map(k => (
              <div key={k.label} className="rounded-lg p-3 text-center" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <div className="text-sm font-bold" style={{ color: "oklch(0.88 0.006 145)", fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
                <div className="text-[10px] tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu azioni */}
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Azioni</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2">
            {AZIONI_ANIMALE.filter(a => a.id !== "scheda").map(a => (
              <button
                key={a.id}
                onClick={() => handleQuickAction(selectedId!, a.id)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/[0.04]"
              >
                <a.icon className="w-4 h-4 flex-shrink-0" style={{ color: a.color }} />
                <span className="text-xs font-medium" style={{ color: "oklch(0.78 0.01 145)" }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline eventi */}
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Timeline</h3>
          </div>
          {(!scheda.eventi || scheda.eventi.length === 0) ? (
            <div className="p-8 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-2" style={{ color: "oklch(0.30 0.008 145)" }} />
              <p className="text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun evento registrato</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: BORDER }}>
              {scheda.eventi.map((ev: any) => (
                <div key={ev.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: GREEN }} />
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: "oklch(0.88 0.006 145)" }}>
                      {ev.tipo.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </div>
                    {ev.descrizione && <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>{ev.descrizione}</p>}
                    {ev.statoProduttivoPrecedente && ev.statoProduttivoNuovo && (
                      <p className="text-xs mt-0.5" style={{ color: GOLD }}>
                        Stato: {ev.statoProduttivoPrecedente} → {ev.statoProduttivoNuovo}
                      </p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.40 0.008 145)" }}>
                      {new Date(ev.data).toLocaleDateString("it-IT")} {ev.operatore ? `· ${ev.operatore}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Lista / Ricerca ──
  return (
    <div className="space-y-4">
      {/* Barra ricerca */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(0.45 0.01 145)" }} />
          <input
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
            placeholder="Cerca per matricola, nome, n° aziendale, RFID..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5" style={{ color: "oklch(0.45 0.01 145)" }} /></button>}
        </div>
        <Button onClick={() => { resetForm(); setSheetOpen(true); }} style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
          <Plus className="w-4 h-4 mr-1" /> Nuovo
        </Button>
      </div>

      {query.length >= 2 && (
        <p className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>{searchResults.length} risultati per "{query}"</p>
      )}

      {/* Lista animali */}
      {displayList.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.30 0.008 145)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.65 0.01 145)" }}>
            {query.length >= 2 ? "Nessun risultato" : "Nessun animale registrato"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {displayList.slice(0, 30).map((a: any) => {
              const sp = STATO_PRODUTTIVO[a.statoProduttivo ?? "in_lattazione"] ?? STATO_PRODUTTIVO.in_lattazione;
              return (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <button onClick={() => setSelectedId(a.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${sp.color}20`, color: sp.color }}>
                      {a.matricola.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "oklch(0.88 0.006 145)" }}>
                        {a.nome || a.matricola}
                      </div>
                      <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                        {a.matricola} {a.gruppo ? `· ${a.gruppo}` : ""}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatoBadge label={sp.label} color={sp.color} />
                    <button onClick={() => openAction(a.id, "trattamento")} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Azioni">
                      <MoreHorizontal className="w-4 h-4" style={{ color: "oklch(0.50 0.01 145)" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sheet nuovo animale (gruppo obbligatorio + preview fattori) */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) resetForm(); setSheetOpen(v); }}>
        <SheetContent className="overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Nuovo Animale</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "matricola", label: "Matricola *", placeholder: "IT001..." },
              { key: "numeroAziendale", label: "N° Aziendale", placeholder: "Opzionale" },
              { key: "nome", label: "Nome", placeholder: "Opzionale" },
              { key: "rfid", label: "RFID / Transponder", placeholder: "Opzionale" },
              { key: "dataNascita", label: "Data di nascita", placeholder: "YYYY-MM-DD", type: "date" },
              { key: "razza", label: "Razza", placeholder: "es. Frisona" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>{f.label}</label>
                <input
                  type={(f as any).type || "text"}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            {/* Sesso */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Sesso</label>
              <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.sesso} onChange={e => setForm(p => ({ ...p, sesso: e.target.value }))}>
                <option value="femmina">Femmina</option>
                <option value="maschio">Maschio</option>
              </select>
            </div>
            {/* Gruppo OBBLIGATORIO */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: GREEN }}>Gruppo *</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: SURFACE2, border: `1px solid ${form.gruppoId ? GREEN : BORDER}`, color: "oklch(0.88 0.006 145)" }}
                value={form.gruppoId}
                onChange={e => setForm(p => ({ ...p, gruppoId: e.target.value }))}
              >
                <option value="">— Seleziona gruppo —</option>
                {gruppiList.map((g: any) => <option key={g.id} value={g.id}>{g.nome} ({g.codice})</option>)}
              </select>
            </div>
            {/* Preview fattori predefiniti */}
            {form.gruppoId && anteprimaCreazione && anteprimaCreazione.applicaFattori && (
              <div className="rounded-lg p-3" style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
                <p className="text-xs font-semibold mb-2" style={{ color: GREEN }}>Fattori predefiniti del gruppo "{anteprimaCreazione.gruppoNome}"</p>
                {anteprimaCreazione.effetti && anteprimaCreazione.effetti.length > 0 ? (
                  <div className="space-y-1">
                    {anteprimaCreazione.effetti.map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Check className="w-3 h-3" style={{ color: GREEN }} />
                        <span style={{ color: "oklch(0.75 0.01 145)" }}>{e.campo.replace(/([A-Z])/g, " $1")}: </span>
                        <span style={{ color: GOLD }}>{e.valoreNuovo}</span>
                        <span className="text-[10px]" style={{ color: "oklch(0.45 0.01 145)" }}>({e.modalita})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Nessuna modifica automatica prevista</p>
                )}
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.confermaFattori} onChange={e => setForm(p => ({ ...p, confermaFattori: e.target.checked }))} className="rounded" />
                  <span className="text-xs" style={{ color: "oklch(0.70 0.01 145)" }}>Applica fattori predefiniti</span>
                </label>
              </div>
            )}
            {form.gruppoId && anteprimaCreazione && !anteprimaCreazione.applicaFattori && (
              <div className="rounded-lg p-3" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Gruppo "{anteprimaCreazione.gruppoNome}" — nessun fattore predefinito attivo</p>
              </div>
            )}
            {/* Stati */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Stato produttivo</label>
              <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.statoProduttivo} onChange={e => setForm(p => ({ ...p, statoProduttivo: e.target.value }))}>
                {Object.entries(STATO_PRODUTTIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Stato riproduttivo</label>
              <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.statoRiproduttivo} onChange={e => setForm(p => ({ ...p, statoRiproduttivo: e.target.value }))}>
                {Object.entries(STATO_RIPRODUTTIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {/* Note */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <textarea className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" rows={2} style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </div>
            <Button
              className="w-full font-bold py-3 mt-2"
              style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                if (!form.matricola) { toast.error("Matricola obbligatoria"); return; }
                if (!form.gruppoId) { toast.error("Seleziona un gruppo"); return; }
                createMut.mutate(form as any);
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Salvataggio..." : "Registra Animale"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet azioni animale */}
      <Sheet open={actionSheet !== null && actionSheet !== "sposta_gruppo" && actionSheet !== "trattamento" && actionSheet !== "nota"} onOpenChange={v => { if (!v) setActionSheet(null); }}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Azioni Animale</SheetTitle>
          </SheetHeader>
          {actionAnimale && (
            <div className="mt-4 space-y-4">
              {/* Card riepilogativa */}
              <AnimaleSummaryCard animale={actionAnimale} />
              <div className="space-y-1">
                {AZIONI_ANIMALE.map(a => (
                  <button key={a.id} onClick={() => handleQuickAction(actionAnimaleId!, a.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-white/[0.04] transition-colors">
                    <a.icon className="w-4 h-4" style={{ color: a.color }} />
                    <span className="text-sm" style={{ color: "oklch(0.82 0.008 145)" }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet trattamento */}
      <Sheet open={actionSheet === "trattamento"} onOpenChange={v => { if (!v) setActionSheet(null); }}>
        <SheetContent className="overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Nuovo Trattamento</SheetTitle>
          </SheetHeader>
          {actionAnimale && (
            <div className="mt-4 space-y-4">
              <AnimaleSummaryCard animale={actionAnimale} />
              {[
                { key: "tipo", label: "Tipo", type: "select", options: [["sincronizzazione", "Sincronizzazione"], ["vaccino", "Vaccino"], ["farmaco", "Farmaco"], ["visita", "Visita"], ["altro", "Altro"]] },
                { key: "motivo", label: "Motivo", placeholder: "es. Mastite" },
                { key: "farmaco", label: "Farmaco / Prodotto", placeholder: "es. Ceftiofur" },
                { key: "dose", label: "Dose", placeholder: "es. 5" },
                { key: "unitaMisura", label: "Unità", type: "select", options: [["ml", "ml"], ["mg", "mg"], ["g", "g"], ["UI", "UI"], ["compresse", "Compresse"]] },
                { key: "viaSomministrazione", label: "Via somministrazione", placeholder: "es. Intramuscolare" },
                { key: "dataTrattamento", label: "Data inizio *", type: "datetime-local" },
                { key: "dataFine", label: "Data fine", type: "datetime-local" },
                { key: "tempiSospensione", label: "Tempi sospensione", placeholder: "es. 5 giorni latte" },
                { key: "operatore", label: "Operatore", placeholder: "Chi esegue" },
                { key: "veterinario", label: "Veterinario", placeholder: "Opzionale" },
                { key: "note", label: "Note", placeholder: "Opzionale" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={(trattamentoForm as any)[f.key]} onChange={e => setTrattamentoForm(p => ({ ...p, [f.key]: e.target.value }))}>
                      {(f.options as string[][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type || "text"}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                      placeholder={f.placeholder}
                      value={(trattamentoForm as any)[f.key]}
                      onChange={e => setTrattamentoForm(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <Button
                className="w-full font-bold py-3"
                style={{ background: BLUE, color: "white" }}
                onClick={() => {
                  if (!trattamentoForm.dataTrattamento) { toast.error("Data obbligatoria"); return; }
                  createTrattamentoMut.mutate({ animaleId: actionAnimaleId!, ...trattamentoForm } as any);
                }}
                disabled={createTrattamentoMut.isPending}
              >
                {createTrattamentoMut.isPending ? "Salvataggio..." : "Registra Trattamento"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet sposta gruppo */}
      <Sheet open={actionSheet === "sposta_gruppo"} onOpenChange={v => { if (!v) setActionSheet(null); }}>
        <SheetContent className="overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Sposta Gruppo</SheetTitle>
          </SheetHeader>
          {actionAnimale && (
            <div className="mt-4 space-y-4">
              <AnimaleSummaryCard animale={actionAnimale} />
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Gruppo destinazione</label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: SURFACE2, border: `1px solid ${spostaGruppoId ? GREEN : BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  value={spostaGruppoId}
                  onChange={e => setSpostaGruppoId(e.target.value)}
                >
                  <option value="">— Seleziona gruppo —</option>
                  {gruppiList.filter((g: any) => g.id !== (actionAnimale as any).gruppoId).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nome} ({g.codice})</option>
                  ))}
                </select>
              </div>
              {/* Anteprima fattori */}
              {spostaGruppoId && anteprimaData && (
                <div className="rounded-lg p-3" style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: GREEN }}>
                    Riepilogo spostamento → {anteprimaData.gruppoNome}
                  </p>
                  {anteprimaData.applicaFattori && anteprimaData.effetti && anteprimaData.effetti.length > 0 ? (
                    <div className="space-y-2">
                      {anteprimaData.effetti.map((e: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs rounded-md px-2 py-1.5" style={{ background: SURFACE2 }}>
                          <span style={{ color: "oklch(0.65 0.01 145)" }}>{e.campo === "statoProduttivo" ? "Stato produttivo" : "Stato riproduttivo"}</span>
                          <span>
                            <span style={{ color: RED }}>{e.valoreAttuale ?? "—"}</span>
                            <span style={{ color: "oklch(0.45 0.01 145)" }}> → </span>
                            <span style={{ color: GREEN }}>{e.valoreNuovo}</span>
                          </span>
                        </div>
                      ))}
                      {/* Mostra invariati */}
                      {!anteprimaData.effetti.find((e: any) => e.campo === "statoRiproduttivo") && (
                        <div className="flex items-center justify-between text-xs rounded-md px-2 py-1.5" style={{ background: SURFACE2 }}>
                          <span style={{ color: "oklch(0.65 0.01 145)" }}>Stato riproduttivo</span>
                          <span style={{ color: "oklch(0.55 0.01 145)" }}>Invariato</span>
                        </div>
                      )}
                    </div>
                  ) : anteprimaData.applicaFattori ? (
                    <p className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Nessuna modifica automatica</p>
                  ) : (
                    <p className="text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>Fattori predefiniti disattivati — solo cambio gruppo</p>
                  )}
                </div>
              )}
              <Button
                className="w-full font-bold py-3"
                style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
                onClick={() => {
                  if (!spostaGruppoId) { toast.error("Seleziona un gruppo"); return; }
                  spostaGruppoMut.mutate({ animaleId: actionAnimaleId!, nuovoGruppoId: spostaGruppoId, confermaFattori: true });
                }}
                disabled={spostaGruppoMut.isPending}
              >
                {spostaGruppoMut.isPending ? "Spostamento..." : "Conferma spostamento"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet nota */}
      <Sheet open={actionSheet === "nota"} onOpenChange={v => { if (!v) setActionSheet(null); }}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Aggiungi Nota</SheetTitle>
          </SheetHeader>
          {actionAnimale && (
            <div className="mt-4 space-y-4">
              <AnimaleSummaryCard animale={actionAnimale} />
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Nota</label>
                <textarea className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" rows={4} style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={notaText} onChange={e => setNotaText(e.target.value)} placeholder="Scrivi una nota..." />
              </div>
              <Button
                className="w-full font-bold py-3"
                style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
                onClick={() => {
                  if (!notaText.trim()) { toast.error("Scrivi una nota"); return; }
                  addEventoMut.mutate({ animaleId: actionAnimaleId!, tipo: "nota", data: new Date().toISOString(), descrizione: notaText });
                  setActionSheet(null);
                }}
                disabled={addEventoMut.isPending}
              >
                Salva nota
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Card riepilogativa animale (non modificabile) ──
function AnimaleSummaryCard({ animale }: { animale: any }) {
  const sp = STATO_PRODUTTIVO[animale.statoProduttivo ?? "in_lattazione"] ?? STATO_PRODUTTIVO.in_lattazione;
  const sr = STATO_RIPRODUTTIVO[animale.statoRiproduttivo ?? "vuota"] ?? STATO_RIPRODUTTIVO.vuota;
  return (
    <div className="rounded-lg p-3" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${sp.color}20`, color: sp.color }}>
          {animale.matricola?.slice(-2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "oklch(0.90 0.006 145)" }}>{animale.nome || animale.matricola}</div>
          <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
            {animale.matricola} {animale.numeroAziendale ? `· N° ${animale.numeroAziendale}` : ""} {animale.gruppo ? `· ${animale.gruppo}` : ""}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <StatoBadge label={sp.label} color={sp.color} />
        <StatoBadge label={sr.label} color={sr.color} />
      </div>
    </div>
  );
}
