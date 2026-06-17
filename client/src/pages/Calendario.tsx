import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock,
  CheckCircle2, Leaf, Tractor, AlertTriangle, Users, Tag, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const GREEN  = "oklch(0.65 0.18 142)";
const GOLD   = "oklch(0.72 0.15 75)";
const RED    = "oklch(0.55 0.22 25)";
const BLUE   = "oklch(0.6 0.15 220)";
const PURPLE = "oklch(0.58 0.18 290)";

const TIPO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  lavorazione:  { label: "Lavorazione",  color: GREEN,  icon: Leaf          },
  manutenzione: { label: "Manutenzione", color: GOLD,   icon: Tractor       },
  scadenza:     { label: "Scadenza",     color: RED,    icon: AlertTriangle  },
  trattamento:  { label: "Trattamento",  color: BLUE,   icon: Users         },
  altro:        { label: "Altro",        color: PURPLE, icon: Calendar      },
};

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GIORNI_BREVI = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

export default function Calendario() {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [openForm, setOpenForm]   = useState(false);
  const [form, setForm] = useState({
    titolo: "", tipo: "altro" as string,
    data: today.toISOString().split("T")[0],
    ora: "", descrizione: "", modulo: "", priorita: "normale" as string,
  });

  const { data: eventi = [], refetch } = trpc.calendario.list.useQuery({ anno: viewYear, mese: viewMonth + 1 });

  const createEvento = trpc.calendario.create.useMutation({
    onSuccess: () => { refetch(); setOpenForm(false); toast.success("Evento aggiunto"); setForm({ titolo: "", tipo: "altro", data: today.toISOString().split("T")[0], ora: "", descrizione: "", modulo: "", priorita: "normale" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteEvento = trpc.calendario.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Evento eliminato"); },
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = (() => { const d = new Date(viewYear, viewMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const eventiByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    (eventi as any[]).forEach((e: any) => {
      const d = new Date(e.dataInizio ?? e.data);
      const day = d.getDate();
      if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [eventi, viewMonth, viewYear]);

  const selectedDayEventi = selectedDay ? (eventiByDay[selectedDay] ?? []) : [];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const openNewForDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm(f => ({ ...f, titolo: "", data: dateStr }));
    setOpenForm(true);
  };

  const eventiList = eventi as any[];
  const prossimi = eventiList
    .filter(e => new Date(e.dataInizio ?? e.data) >= today)
    .sort((a, b) => new Date(a.dataInizio ?? a.data).getTime() - new Date(b.dataInizio ?? b.data).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Calendario
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            Pianificazione attività, scadenze e lavorazioni
          </p>
        </div>
        <Button onClick={() => { setForm(f => ({ ...f, titolo: "" })); setOpenForm(true); }}
          className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
          <Plus size={15} /> Nuova attività
        </Button>
      </div>

      {/* ── TIPO PILLS ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
          const count = eventiList.filter(e => e.tipo === tipo).length;
          return (
            <div key={tipo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: `${cfg.color}10`, border: `1px solid ${cfg.color}25` }}>
              <cfg.icon size={11} style={{ color: cfg.color }} />
              <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
              {count > 0 && <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}</span>}
            </div>
          );
        })}
      </div>

      {/* ── MAIN LAYOUT ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Calendario */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>

          {/* Nav mese */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              style={{ color: "oklch(0.6 0.01 145)" }}>
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.92 0.005 145)" }}>
              {MESI[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              style={{ color: "oklch(0.6 0.01 145)" }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Intestazione giorni */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
            {GIORNI_BREVI.map((g, i) => (
              <div key={g} className="py-2.5 text-center text-xs font-semibold"
                style={{ color: i >= 5 ? "oklch(0.5 0.01 145)" : "oklch(0.45 0.01 145)" }}>
                {g}
              </div>
            ))}
          </div>

          {/* Griglia giorni */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const day = idx - firstDay + 1;
              const isValid   = day >= 1 && day <= daysInMonth;
              const isToday   = isValid && day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSel     = isValid && day === selectedDay;
              const isWeekend = (idx % 7) >= 5;
              const dayEventi = isValid ? (eventiByDay[day] ?? []) : [];

              return (
                <div key={idx}
                  onClick={() => isValid && setSelectedDay(isSel ? null : day)}
                  className="border-r border-b min-h-[80px] p-1.5 transition-all"
                  style={{
                    borderColor: "oklch(0.14 0.006 145)",
                    background: !isValid ? "oklch(0.095 0.005 145)" : isSel ? `${GREEN}08` : isWeekend ? "oklch(0.10 0.005 145)" : "transparent",
                    cursor: isValid ? "pointer" : "default",
                  }}>
                  {isValid && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            background: isToday ? GREEN : "transparent",
                            color: isToday ? "oklch(0.08 0.005 145)" : isWeekend ? "oklch(0.5 0.01 145)" : "oklch(0.72 0.01 145)",
                          }}>
                          {day}
                        </span>
                        {dayEventi.length === 0 && (
                          <button onClick={e => { e.stopPropagation(); openNewForDay(day); }}
                            className="w-4 h-4 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            style={{ color: GREEN }}>
                            <Plus size={10} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEventi.slice(0, 2).map((ev: any) => {
                          const tc = TIPO_CONFIG[ev.tipo] ?? TIPO_CONFIG.altro;
                          return (
                            <div key={ev.id} className="text-xs px-1.5 py-0.5 rounded truncate"
                              style={{ background: `${tc.color}18`, color: tc.color, fontSize: 10 }}>
                              {ev.titolo}
                            </div>
                          );
                        })}
                        {dayEventi.length > 2 && (
                          <div className="text-xs px-1" style={{ color: "oklch(0.45 0.01 145)", fontSize: 10 }}>
                            +{dayEventi.length - 2}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
            <Calendar size={13} style={{ color: GOLD }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              {selectedDay
                ? `${selectedDay} ${MESI[viewMonth]}`
                : "Prossime attività"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedDay ? (
              <>
                <Button size="sm" onClick={() => openNewForDay(selectedDay)} className="w-full gap-1.5 text-xs mb-2"
                  style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}>
                  <Plus size={12} /> Aggiungi
                </Button>
                {selectedDayEventi.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Calendar size={24} className="opacity-10" style={{ color: GOLD }} />
                    <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna attività</p>
                  </div>
                ) : (
                  selectedDayEventi.map((ev: any) => <EventCard key={ev.id} evento={ev} onDelete={() => deleteEvento.mutate({ id: ev.id })} />)
                )}
              </>
            ) : (
              prossimi.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle2 size={24} className="opacity-10" style={{ color: GREEN }} />
                  <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna attività in programma</p>
                </div>
              ) : (
                prossimi.map((ev: any) => <EventCard key={ev.id} evento={ev} onDelete={() => deleteEvento.mutate({ id: ev.id })} />)
              )
            )}
          </div>
        </div>
      </div>

      {/* ── SHEET: NUOVA ATTIVITÀ ───────────────────────────────────────────── */}
      <Sheet open={openForm} onOpenChange={setOpenForm}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}15` }}>
                <Calendar size={15} style={{ color: GREEN }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>Nuova attività</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Titolo *</label>
              <Input value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => (
                  <button key={tipo} onClick={() => setForm(f => ({ ...f, tipo }))}
                    className="py-2 px-1 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all"
                    style={{
                      background: form.tipo === tipo ? `${cfg.color}18` : "oklch(0.14 0.007 145)",
                      color: form.tipo === tipo ? cfg.color : "oklch(0.5 0.01 145)",
                      border: `1px solid ${form.tipo === tipo ? cfg.color + "40" : "transparent"}`,
                    }}>
                    <cfg.icon size={12} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Data *</label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Ora</label>
                <Input type="time" value={form.ora} onChange={e => setForm(f => ({ ...f, ora: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Priorità</label>
              <div className="flex gap-2">
                {(["bassa","normale","alta"] as const).map(p => {
                  const c = p === "alta" ? RED : p === "normale" ? GOLD : GREEN;
                  return (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priorita: p }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                      style={{
                        background: form.priorita === p ? `${c}18` : "oklch(0.14 0.007 145)",
                        color: form.priorita === p ? c : "oklch(0.5 0.01 145)",
                        border: `1px solid ${form.priorita === p ? c + "40" : "transparent"}`,
                      }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Modulo</label>
              <Input value={form.modulo} onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))} placeholder="Es. Officina, Campi..." className="bg-input border-border text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Descrizione</label>
              <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>
          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={() => { if (!form.titolo) { toast.error("Titolo obbligatorio"); return; } createEvento.mutate(form as any); }}
              disabled={createEvento.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createEvento.isPending ? "Salvataggio..." : "Salva attività"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

function EventCard({ evento, onDelete }: { evento: any; onDelete: () => void }) {
  const tc = TIPO_CONFIG[evento.tipo] ?? TIPO_CONFIG.altro;
  const date = new Date(evento.dataInizio ?? evento.data);
  return (
    <div className="p-2.5 rounded-xl group" style={{ background: "oklch(0.09 0.005 145)", border: `1px solid oklch(0.16 0.007 145)`, borderLeft: `3px solid ${tc.color}` }}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "oklch(0.85 0.005 145)" }}>{evento.titolo}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.45 0.01 145)" }}>
              <Calendar size={9} />{date.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
            </span>
            {evento.ora && <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.45 0.01 145)" }}><Clock size={9} />{evento.ora}</span>}
            {evento.modulo && <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.45 0.01 145)" }}><Tag size={9} />{evento.modulo}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge style={{ background: `${tc.color}15`, color: tc.color, border: "none", fontSize: 9 }}>{tc.label}</Badge>
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{ color: RED }}>
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
