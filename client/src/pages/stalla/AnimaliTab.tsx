import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, ArrowLeft, Plus, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { GREEN, GOLD, SURFACE, SURFACE2, BORDER, STATO_PRODUTTIVO, STATO_RIPRODUTTIVO, StatoBadge, HealthDot } from "./shared";

export default function AnimaliTab() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ matricola: "", nome: "", razza: "", sesso: "femmina" as string, statoProduttivo: "in_lattazione" as string, statoRiproduttivo: "vuota" as string, numeroAziendale: "", rfid: "" });

  const { data: animaliList = [], refetch: refetchList } = trpc.stalla.list.useQuery();
  const { data: searchResults = [] } = trpc.stalla.ricerca.useQuery({ query }, { enabled: query.length >= 2 });
  const { data: scheda, refetch: refetchScheda } = trpc.stalla.animali.scheda.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const createMut = trpc.stalla.animali.create.useMutation({ onSuccess: () => { refetchList(); setSheetOpen(false); toast.success("Animale registrato"); resetForm(); } });
  const addEventoMut = trpc.stalla.addEvento.useMutation({ onSuccess: () => { refetchScheda(); toast.success("Evento registrato"); } });

  function resetForm() { setForm({ matricola: "", nome: "", razza: "", sesso: "femmina", statoProduttivo: "in_lattazione", statoRiproduttivo: "vuota", numeroAziendale: "", rfid: "" }); }

  const displayList = query.length >= 2 ? searchResults : animaliList;

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
          {/* Info rapide */}
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

        {/* Timeline eventi */}
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>Timeline</h3>
            <Button size="sm" variant="outline" onClick={() => {
              addEventoMut.mutate({ animaleId: selectedId!, tipo: "visita", data: new Date().toISOString(), descrizione: "Visita registrata" });
            }} style={{ borderColor: BORDER, color: "oklch(0.75 0.01 145)" }}>
              <Plus className="w-3 h-3 mr-1" /> Evento
            </Button>
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
          <p className="text-xs mb-4" style={{ color: "oklch(0.40 0.008 145)" }}>
            {query.length >= 2 ? "Prova con un altro termine" : "Aggiungi il primo animale"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {displayList.slice(0, 30).map((a: any) => {
              const sp = STATO_PRODUTTIVO[a.statoProduttivo ?? "in_lattazione"] ?? STATO_PRODUTTIVO.in_lattazione;
              return (
                <button key={a.id} onClick={() => setSelectedId(a.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: `${sp.color}20`, color: sp.color }}>
                    {a.matricola.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "oklch(0.88 0.006 145)" }}>
                      {a.nome || a.matricola}
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.50 0.01 145)" }}>
                      {a.matricola} {a.gruppo ? `· ${a.gruppo}` : ""} {a.razza ? `· ${a.razza}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.hasAlert && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "oklch(0.65 0.22 25)" }} />}
                    <StatoBadge label={sp.label} color={sp.color} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sheet nuovo animale */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) resetForm(); setSheetOpen(v); }}>
        <SheetContent style={{ background: "oklch(0.09 0.006 145)", borderLeft: `1px solid ${BORDER}` }}>
          <SheetHeader>
            <SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Nuovo Animale</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "matricola", label: "Matricola *", placeholder: "IT001..." },
              { key: "numeroAziendale", label: "N° Aziendale", placeholder: "Opzionale" },
              { key: "nome", label: "Nome", placeholder: "Opzionale" },
              { key: "rfid", label: "RFID", placeholder: "Opzionale" },
              { key: "razza", label: "Razza", placeholder: "es. Frisona" },
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
            <Button
              className="w-full font-bold py-3 mt-2"
              style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}
              onClick={() => {
                if (!form.matricola) { toast.error("Matricola obbligatoria"); return; }
                createMut.mutate(form as any);
              }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Salvataggio..." : "Registra Animale"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
