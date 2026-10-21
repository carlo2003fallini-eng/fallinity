import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Users, ChevronRight, ArrowLeft, Search, X, ArrowRightLeft, CheckSquare, Square, Filter, BarChart3, Beef, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { GREEN, GOLD, SURFACE, SURFACE2, BORDER, TIPOLOGIA_GRUPPO, StatoBadge, STATO_PRODUTTIVO, STATO_RIPRODUTTIVO, CodicePill, BLUE, RED } from "./shared";

const MODALITA_OPTIONS = [
  { value: "non_applicare", label: "Non applicare" },
  { value: "automatico", label: "Automatico" },
  { value: "conferma", label: "Con conferma" },
  { value: "suggerimento", label: "Solo suggerimento" },
];

const GROUP_BACKGROUND: Record<string, string> = {
  lattazione: "/manus-storage/dati-stalla-dashboard_e7198686.jpg",
  asciutta: "/manus-storage/gruppi_81c45d0c.jpg",
  rimonta: "/manus-storage/gruppi_81c45d0c.jpg",
  infermeria: "/manus-storage/sanita_9ab86209.jpg",
  vitelli: "/manus-storage/vitelli_fb9a167e.jpg",
  manze: "/manus-storage/alimentazione_71b16042.jpg",
  pre_parto: "/manus-storage/riproduzione_e5015a4c.jpg",
  post_parto: "/manus-storage/riproduzione_e5015a4c.jpg",
  personalizzato: "/manus-storage/gruppi_81c45d0c.jpg",
};

function statoGruppo(tipologia: string) {
  if (tipologia === "lattazione") return "Produttivo";
  if (["asciutta", "pre_parto", "post_parto"].includes(tipologia)) return "Fisiologico";
  if (["vitelli", "manze", "rimonta"].includes(tipologia)) return "Giovani";
  if (tipologia === "infermeria") return "Sanitario";
  return "Personalizzato";
}

export default function GruppiTab({ onBack, onOpenAllAnimals }: { onBack?: () => void; onOpenAllAnimals?: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [ricercaAnimale, setRicercaAnimale] = useState("");
  const [form, setForm] = useState({
    nome: "", tipologia: "personalizzato" as string, colore: "#4ade80", descrizione: "", capacitaMax: "" as string, note: "",
    applicaFattoriPredefiniti: false,
    statoProduttivoPredefinito: "" as string,
    modalitaStatoProduttivo: "non_applicare" as string,
    statoRiproduttivoPredefinito: "" as string,
    modalitaStatoRiproduttivo: "non_applicare" as string,
  });
  // Selezione multipla
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSpostaSheet, setBulkSpostaSheet] = useState(false);
  const [bulkGruppoId, setBulkGruppoId] = useState("");
  const [filtriAperti, setFiltriAperti] = useState(false);
  const [legendaAperta, setLegendaAperta] = useState(false);
  const [tipologiaFiltro, setTipologiaFiltro] = useState<string | null>(null);

  const { data: gruppiList = [], refetch } = trpc.stalla.gruppi.list.useQuery(undefined);
  const { data: animaliTrovati = [] } = trpc.stalla.ricerca.useQuery(
    { query: ricercaAnimale.trim() },
    { enabled: ricercaAnimale.trim().length > 0 }
  );
  const { data: detailData, refetch: refetchDetail } = trpc.stalla.gruppi.detail.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const createMut = trpc.stalla.gruppi.create.useMutation({ onSuccess: () => { refetch(); setSheetOpen(false); toast.success("Gruppo creato"); resetForm(); } });
  const updateMut = trpc.stalla.gruppi.update.useMutation({ onSuccess: () => { refetch(); refetchDetail(); setSheetOpen(false); toast.success("Gruppo aggiornato"); resetForm(); } });
  const archiveMut = trpc.stalla.gruppi.archive.useMutation({ onSuccess: () => { refetch(); setSelectedId(null); toast.success("Gruppo archiviato"); } });
  const spostaMultiploMut = trpc.stalla.animali.spostaMultiplo.useMutation({ onSuccess: () => { refetchDetail(); refetch(); setBulkSpostaSheet(false); setSelectionMode(false); setSelectedIds(new Set()); toast.success("Spostamento multiplo completato"); } });

  function resetForm() {
    setForm({ nome: "", tipologia: "personalizzato", colore: "#4ade80", descrizione: "", capacitaMax: "", note: "", applicaFattoriPredefiniti: false, statoProduttivoPredefinito: "", modalitaStatoProduttivo: "non_applicare", statoRiproduttivoPredefinito: "", modalitaStatoRiproduttivo: "non_applicare" });
    setEditId(null);
  }
  function openEdit(g: any) {
    setForm({
      nome: g.nome, tipologia: g.tipologia, colore: g.colore || "#4ade80", descrizione: g.descrizione || "", capacitaMax: g.capacitaMax?.toString() || "", note: g.note || "",
      applicaFattoriPredefiniti: g.applicaFattoriPredefiniti ?? false,
      statoProduttivoPredefinito: g.statoProduttivoPredefinito || "",
      modalitaStatoProduttivo: g.modalitaStatoProduttivo || "non_applicare",
      statoRiproduttivoPredefinito: g.statoRiproduttivoPredefinito || "",
      modalitaStatoRiproduttivo: g.modalitaStatoRiproduttivo || "non_applicare",
    });
    setEditId(g.id);
    setSheetOpen(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() {
    if (!detailData) return;
    if (selectedIds.size === detailData.membri.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(detailData.membri.map((a: any) => a.id)));
  }

  const filtered = useMemo(() => gruppiList.filter((g: any) => {
    const matchesTipologia = !tipologiaFiltro || g.tipologia === tipologiaFiltro;
    return matchesTipologia;
  }), [gruppiList, tipologiaFiltro]);

  const ricercaAnimaleAttiva = ricercaAnimale.trim().length > 0;

  const totaleAnimali = useMemo(() => gruppiList.reduce((totale: number, gruppo: any) => totale + Number(gruppo.nAnimali ?? 0), 0), [gruppiList]);

  // ── Dettaglio gruppo ──
  if (selectedId && detailData) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedId(null); setSelectionMode(false); setSelectedIds(new Set()); }} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity" style={{ color: GREEN }}>
          <ArrowLeft className="w-4 h-4" /> Tutti i gruppi
        </button>
        <div className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "'Space Grotesk', sans-serif" }}>{detailData.nome}</h2>
                <CodicePill codice={detailData.codice} />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>
                {TIPOLOGIA_GRUPPO[detailData.tipologia]?.label} · {detailData.stats.totale} animali
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(detailData)} style={{ borderColor: BORDER, color: "oklch(0.75 0.01 145)" }}>Modifica</Button>
              <Button size="sm" variant="outline" onClick={() => archiveMut.mutate({ id: detailData.id })} style={{ borderColor: BORDER, color: "oklch(0.65 0.22 25)" }}>Archivia</Button>
            </div>
          </div>
          {/* Fattori predefiniti info */}
          {detailData.applicaFattoriPredefiniti && (
            <div className="rounded-lg p-2.5 mt-3" style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
              <p className="text-xs font-semibold" style={{ color: GREEN }}>Fattori predefiniti attivi</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {detailData.statoProduttivoPredefinito && (
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: SURFACE2, color: "oklch(0.70 0.01 145)" }}>
                    Produttivo → {STATO_PRODUTTIVO[detailData.statoProduttivoPredefinito]?.label ?? detailData.statoProduttivoPredefinito} ({detailData.modalitaStatoProduttivo})
                  </span>
                )}
                {detailData.statoRiproduttivoPredefinito && (
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: SURFACE2, color: "oklch(0.70 0.01 145)" }}>
                    Riproduttivo → {STATO_RIPRODUTTIVO[detailData.statoRiproduttivoPredefinito]?.label ?? detailData.statoRiproduttivoPredefinito} ({detailData.modalitaStatoRiproduttivo})
                  </span>
                )}
              </div>
            </div>
          )}
          {/* KPI gruppo */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: "Totale", value: detailData.stats.totale, color: GREEN },
              { label: "In lattazione", value: detailData.stats.inLattazione, color: GREEN },
              { label: "Gravide", value: detailData.stats.gravide, color: "oklch(0.65 0.18 300)" },
              { label: "Prod. media", value: `${detailData.produzioneMedia} L`, color: "oklch(0.78 0.15 85)" },
            ].map(k => (
              <div key={k.label} className="rounded-lg p-3 text-center" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <div className="text-lg font-bold" style={{ color: k.color, fontFamily: "'Space Grotesk', sans-serif" }}>{k.value}</div>
                <div className="text-[10px] tracking-wider" style={{ color: "oklch(0.45 0.01 145)" }}>{k.label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Membri con selezione multipla */}
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Membri ({detailData.membri.length})</h3>
            {detailData.membri.length > 0 && (
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <button onClick={selectAll} className="text-xs font-medium px-2 py-1 rounded" style={{ color: GREEN }}>
                    {selectedIds.size === detailData.membri.length ? "Deseleziona" : "Seleziona"} tutti
                  </button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }} style={{ borderColor: BORDER, color: selectionMode ? GREEN : "oklch(0.65 0.01 145)" }}>
                  <CheckSquare className="w-3.5 h-3.5 mr-1" /> {selectionMode ? "Annulla" : "Seleziona"}
                </Button>
              </div>
            )}
          </div>
          {detailData.membri.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-10 h-10 mx-auto mb-2" style={{ color: "oklch(0.30 0.008 145)" }} />
              <p className="text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun animale in questo gruppo</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: BORDER }}>
              {detailData.membri.map((a: any) => {
                const sp = STATO_PRODUTTIVO[a.statoProduttivo] ?? STATO_PRODUTTIVO.in_lattazione;
                const sr = STATO_RIPRODUTTIVO[a.statoRiproduttivo] ?? STATO_RIPRODUTTIVO.vuota;
                const isSelected = selectedIds.has(a.id);
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors"
                    style={{ background: isSelected ? `${GREEN}08` : "transparent" }}
                    onClick={selectionMode ? () => toggleSelect(a.id) : undefined}
                  >
                    {selectionMode && (
                      <button className="flex-shrink-0" onClick={() => toggleSelect(a.id)}>
                        {isSelected ? <CheckSquare className="w-5 h-5" style={{ color: GREEN }} /> : <Square className="w-5 h-5" style={{ color: "oklch(0.40 0.008 145)" }} />}
                      </button>
                    )}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${sp.color}20`, color: sp.color }}>
                      {a.matricola.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "oklch(0.88 0.006 145)" }}>{a.nome || a.matricola}</div>
                      <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>{a.matricola} · {a.razza || "—"}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <StatoBadge label={sp.label} color={sp.color} />
                      <StatoBadge label={sr.label} color={sr.color} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra azioni bulk (sticky bottom) */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="sticky bottom-0 left-0 right-0 rounded-xl p-4 flex items-center justify-between" style={{ background: "oklch(0.12 0.008 145)", border: `1px solid ${GREEN}40`, boxShadow: "0 -4px 20px oklch(0 0 0 / 0.4)" }}>
            <span className="text-sm font-semibold" style={{ color: GREEN }}>
              {selectedIds.size} selezionat{selectedIds.size === 1 ? "o" : "i"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setBulkGruppoId(""); setBulkSpostaSheet(true); }} style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Sposta gruppo
              </Button>
            </div>
          </div>
        )}

        {/* Sheet spostamento multiplo */}
        <Sheet open={bulkSpostaSheet} onOpenChange={v => { if (!v) setBulkSpostaSheet(false); }}>
          <SheetContent className="overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
            <SheetHeader>
              <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Spostamento Multiplo</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg p-3" style={{ background: SURFACE2, border: `1px solid ${BORDER}` }}>
                <p className="text-xs font-semibold" style={{ color: "oklch(0.70 0.01 145)" }}>{selectedIds.size} animali selezionati</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(selectedIds).slice(0, 8).map(id => {
                    const a = detailData?.membri.find((m: any) => m.id === id);
                    return a ? (
                      <span key={id} className="text-[10px] px-2 py-0.5 rounded" style={{ background: SURFACE, color: "oklch(0.65 0.01 145)" }}>
                        {a.nome || a.matricola}
                      </span>
                    ) : null;
                  })}
                  {selectedIds.size > 8 && <span className="text-[10px] px-2 py-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>+{selectedIds.size - 8} altri</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Gruppo destinazione</label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: SURFACE2, border: `1px solid ${bulkGruppoId ? GREEN : BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  value={bulkGruppoId}
                  onChange={e => setBulkGruppoId(e.target.value)}
                >
                  <option value="">— Seleziona gruppo —</option>
                  {gruppiList.filter((g: any) => g.id !== selectedId).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nome} ({g.codice})</option>
                  ))}
                </select>
              </div>
              {bulkGruppoId && (
                <div className="rounded-lg p-3" style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
                  <p className="text-xs" style={{ color: GREEN }}>
                    I fattori predefiniti del gruppo destinazione verranno applicati a tutti gli animali selezionati (se configurati).
                  </p>
                </div>
              )}
              <Button
                className="w-full font-bold py-3"
                style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
                onClick={() => {
                  if (!bulkGruppoId) { toast.error("Seleziona un gruppo"); return; }
                  spostaMultiploMut.mutate({ animaleIds: Array.from(selectedIds), nuovoGruppoId: bulkGruppoId, confermaFattori: true });
                }}
                disabled={spostaMultiploMut.isPending}
              >
                {spostaMultiploMut.isPending ? "Spostamento..." : `Sposta ${selectedIds.size} animali`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // ── Lista gruppi ──
  return (
    <div className="space-y-4">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} className="mb-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: GREEN }}>
                <ArrowLeft size={17} aria-hidden="true" /> Stalla
              </button>
            )}
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "oklch(0.96 0.005 145)", fontFamily: "var(--font-display)" }}>Gruppi</h1>
            <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: "oklch(0.62 0.01 145)" }}>
              <span>{gruppiList.length} grupp{gruppiList.length === 1 ? "o" : "i"}</span><span aria-hidden="true">·</span><span>{totaleAnimali}</span><Beef size={17} aria-label="animali" />
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setFiltriAperti(value => !value)} aria-pressed={filtriAperti} className="flex min-h-[4.25rem] min-w-[4.25rem] flex-col items-center justify-center rounded-xl border px-2 text-xs font-medium transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ background: filtriAperti ? `${GREEN}12` : SURFACE, borderColor: filtriAperti ? `${GREEN}88` : BORDER, color: filtriAperti ? GREEN : "oklch(0.80 0.006 145)" }}>
              <Filter size={21} aria-hidden="true" /><span className="mt-1">Filtri</span>
            </button>
            <button type="button" onClick={() => setLegendaAperta(value => !value)} aria-pressed={legendaAperta} className="flex min-h-[4.25rem] min-w-[4.25rem] flex-col items-center justify-center rounded-xl border px-2 text-xs font-medium transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ background: legendaAperta ? `${GREEN}12` : SURFACE, borderColor: legendaAperta ? `${GREEN}88` : BORDER, color: legendaAperta ? GREEN : "oklch(0.80 0.006 145)" }}>
              <BarChart3 size={21} aria-hidden="true" /><span className="mt-1">Legenda</span>
            </button>
          </div>
        </div>

        {filtriAperti && (
          <section className="rounded-xl border p-3" aria-label="Filtri gruppi" style={{ background: SURFACE, borderColor: BORDER }}>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTipologiaFiltro(null)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: !tipologiaFiltro ? GREEN : BORDER, background: !tipologiaFiltro ? `${GREEN}18` : "transparent", color: !tipologiaFiltro ? GREEN : "oklch(0.67 0.01 145)" }}>Tutti</button>
              {Array.from(new Set(gruppiList.map((gruppo: any) => gruppo.tipologia))).map((tipologia: string) => {
                const tipo = TIPOLOGIA_GRUPPO[tipologia] ?? TIPOLOGIA_GRUPPO.personalizzato;
                const selected = tipologiaFiltro === tipologia;
                return <button key={tipologia} type="button" onClick={() => setTipologiaFiltro(selected ? null : tipologia)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: selected ? tipo.color : BORDER, background: selected ? `${tipo.color}18` : "transparent", color: selected ? tipo.color : "oklch(0.67 0.01 145)" }}>{tipo.label}</button>;
              })}
            </div>
          </section>
        )}

        {legendaAperta && (
          <section className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs" aria-label="Legenda stati gruppi" style={{ background: SURFACE, borderColor: BORDER }}>
            {[[GREEN, "Produttivo"], [GOLD, "Fisiologico"], [BLUE, "Giovani"], [RED, "Sanitario"]].map(([color, label]) => <span key={label} className="inline-flex items-center gap-2" style={{ color: "oklch(0.72 0.01 145)" }}><i className="size-2 rounded-full" style={{ background: color }} />{label}</span>)}
          </section>
        )}

        <div className="flex gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2" style={{ color: "oklch(0.56 0.01 145)" }} aria-hidden="true" />
            <input className="min-h-12 w-full rounded-xl border py-3 pl-12 pr-10 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/35" style={{ background: SURFACE, borderColor: BORDER, color: "oklch(0.90 0.006 145)" }} placeholder="Cerca animale..." aria-label="Cerca animale per matricola o numero aziendale" value={ricercaAnimale} onChange={e => setRicercaAnimale(e.target.value)} />
            {ricercaAnimale && <button type="button" onClick={() => setRicercaAnimale("")} className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="size-4" style={{ color: "oklch(0.55 0.01 145)" }} /><span className="sr-only">Cancella ricerca</span></button>}
          </div>
          <Button onClick={() => { resetForm(); setSheetOpen(true); }} className="min-h-12 shrink-0 rounded-xl px-4 text-base font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
            <Plus className="mr-1.5 size-5" /> Nuovo
          </Button>
        </div>

        <button type="button" onClick={onOpenAllAnimals} className="flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ background: SURFACE, borderColor: BORDER }}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${GREEN}18`, color: GREEN }}><Beef size={21} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold" style={{ color: "oklch(0.91 0.006 145)" }}>Tutti gli animali</span><span className="mt-0.5 block text-xs" style={{ color: "oklch(0.57 0.01 145)" }}>Visualizza e cerca nell’intera mandria</span></span>
          <ChevronRight className="size-5 shrink-0" style={{ color: "oklch(0.66 0.01 145)" }} aria-hidden="true" />
        </button>
      </header>

      {ricercaAnimaleAttiva ? (
        <section className="overflow-hidden rounded-xl border" aria-label="Risultati ricerca animali" style={{ background: SURFACE, borderColor: BORDER }}>
          <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
            <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Animali trovati</p>
            <p className="mt-0.5 text-xs" style={{ color: "oklch(0.53 0.01 145)" }}>Apri il gruppo dell’animale selezionato.</p>
          </div>
          {animaliTrovati.length === 0 ? (
            <div className="p-7 text-center"><p className="text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Nessun animale trovato.</p></div>
          ) : (
            <div className="divide-y" style={{ borderColor: BORDER }}>
              {animaliTrovati.map((animale: any) => (
                <button key={animale.id} type="button" disabled={!animale.gruppoId} onClick={() => animale.gruppoId && setSelectedId(animale.gruppoId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${GREEN}18`, color: GREEN }}>{animale.matricola.slice(-2)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>{animale.nome || animale.matricola}</span><span className="block truncate text-xs" style={{ color: "oklch(0.53 0.01 145)" }}>{animale.matricola}{animale.numeroAziendale ? ` · N° ${animale.numeroAziendale}` : ""}{animale.gruppo ? ` · ${animale.gruppo}` : ""}</span></span>
                  <ChevronRight className="size-5 shrink-0" style={{ color: "oklch(0.62 0.01 145)" }} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.30 0.008 145)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.65 0.01 145)" }}>{tipologiaFiltro ? "Nessun gruppo corrisponde ai filtri" : "Nessun gruppo creato"}</p>
          <p className="text-xs mb-4" style={{ color: "oklch(0.40 0.008 145)" }}>{tipologiaFiltro ? "Modifica o azzera i filtri per vedere altri gruppi." : "Crea il primo gruppo per organizzare la mandria."}</p>
          <Button onClick={() => { resetForm(); setSheetOpen(true); }} size="sm" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>
            <Plus className="w-4 h-4 mr-2" /> Crea gruppo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3" aria-label="Elenco gruppi">
          {filtered.map((g: any) => {
            const tip = TIPOLOGIA_GRUPPO[g.tipologia] ?? TIPOLOGIA_GRUPPO.personalizzato;
            const color = g.colore || tip.color;
            const hasAlert = Boolean(g.hasAlert);
            return (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className="group relative min-h-44 overflow-hidden rounded-2xl border p-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ backgroundImage: `linear-gradient(180deg, oklch(0.04 0.008 145 / .08) 0%, oklch(0.04 0.008 145 / .20) 38%, oklch(0.04 0.008 145 / .92) 100%), url(${GROUP_BACKGROUND[g.tipologia] ?? GROUP_BACKGROUND.personalizzato})`, backgroundPosition: "center", backgroundSize: "cover", borderColor: BORDER, boxShadow: "0 9px 20px oklch(0.02 0.005 145 / .24)" }}
              >
                {hasAlert && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold shadow-lg" style={{ background: RED, color: "white" }}><AlertTriangle className="size-3.5" aria-hidden="true" /> Avviso</span>}
                <div className="absolute inset-x-3 bottom-3">
                  <h2 className="truncate text-lg font-bold tracking-tight" style={{ color: "oklch(0.97 0.004 145)", fontFamily: "var(--font-display)", textShadow: "0 2px 10px oklch(0.02 0.005 145 / .98)" }}>{g.nome}</h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${color}99`, background: `${color}28`, color }}>{statoGruppo(g.tipologia)}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "oklch(0.96 0.004 145)" }}><Beef className="size-4" aria-hidden="true" /> {g.nAnimali}</span>
                    <ChevronRight className="ml-auto size-5 transition-transform group-hover:translate-x-0.5" style={{ color: "oklch(0.88 0.01 145)" }} aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Sheet crea/modifica gruppo (con fattori predefiniti) */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) resetForm(); setSheetOpen(v); }}>
        <SheetContent className="overflow-y-auto" style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>{editId ? "Modifica Gruppo" : "Nuovo Gruppo"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "nome", label: "Nome *", placeholder: "es. Alta produzione" },
              { key: "descrizione", label: "Descrizione", placeholder: "Opzionale" },
              { key: "capacitaMax", label: "Capacità max", placeholder: "es. 50" },
              { key: "note", label: "Note", placeholder: "Opzionale" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>{f.label}</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1.5 tracking-wider" style={{ color: "oklch(0.55 0.01 145)" }}>Tipologia</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }}
                value={form.tipologia}
                onChange={e => setForm(p => ({ ...p, tipologia: e.target.value }))}
              >
                {Object.entries(TIPOLOGIA_GRUPPO).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* ── Sezione Fattori Predefiniti ── */}
            <div className="rounded-xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.applicaFattoriPredefiniti}
                  onChange={e => setForm(p => ({ ...p, applicaFattoriPredefiniti: e.target.checked }))}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Fattori predefiniti</span>
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.01 145)" }}>Quando un animale entra in questo gruppo, applica automaticamente stati predefiniti</p>
                </div>
              </label>

              {form.applicaFattoriPredefiniti && (
                <div className="mt-4 space-y-3 pl-1">
                  {/* Stato produttivo */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 tracking-wider" style={{ color: "oklch(0.50 0.01 145)" }}>STATO PRODUTTIVO</label>
                      <select className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.statoProduttivoPredefinito} onChange={e => setForm(p => ({ ...p, statoProduttivoPredefinito: e.target.value }))}>
                        <option value="">Nessuna modifica</option>
                        {Object.entries(STATO_PRODUTTIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 tracking-wider" style={{ color: "oklch(0.50 0.01 145)" }}>MODALITÀ</label>
                      <select className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.modalitaStatoProduttivo} onChange={e => setForm(p => ({ ...p, modalitaStatoProduttivo: e.target.value }))}>
                        {MODALITA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Stato riproduttivo */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 tracking-wider" style={{ color: "oklch(0.50 0.01 145)" }}>STATO RIPRODUTTIVO</label>
                      <select className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.statoRiproduttivoPredefinito} onChange={e => setForm(p => ({ ...p, statoRiproduttivoPredefinito: e.target.value }))}>
                        <option value="">Nessuna modifica</option>
                        {Object.entries(STATO_RIPRODUTTIVO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 tracking-wider" style={{ color: "oklch(0.50 0.01 145)" }}>MODALITÀ</label>
                      <select className="w-full px-2 py-2 rounded-lg text-xs outline-none" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: "oklch(0.88 0.006 145)" }} value={form.modalitaStatoRiproduttivo} onChange={e => setForm(p => ({ ...p, modalitaStatoRiproduttivo: e.target.value }))}>
                        {MODALITA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px]" style={{ color: "oklch(0.45 0.01 145)" }}>
                    Automatico: applica senza chiedere · Con conferma: mostra anteprima · Solo suggerimento: mostra ma non applica
                  </p>
                </div>
              )}
            </div>

            <Button
              className="w-full font-bold py-3 mt-2"
              style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                if (!form.nome) { toast.error("Nome obbligatorio"); return; }
                const payload = {
                  ...form,
                  capacitaMax: form.capacitaMax ? parseInt(form.capacitaMax) : undefined,
                  statoProduttivoPredefinito: form.statoProduttivoPredefinito || null,
                  statoRiproduttivoPredefinito: form.statoRiproduttivoPredefinito || null,
                };
                if (editId) updateMut.mutate({ id: editId, ...payload } as any);
                else createMut.mutate(payload as any);
              }}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) ? "Salvataggio..." : editId ? "Salva modifiche" : "Crea Gruppo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
