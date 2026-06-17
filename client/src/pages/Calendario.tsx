import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Calendar, Clock, Tag } from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const RED = "oklch(0.55 0.22 25)";
const BLUE = "oklch(0.6 0.15 220)";
const PURPLE = "oklch(0.58 0.18 290)";

const TIPO_COLORS: Record<string, string> = {
  lavorazione: GREEN,
  manutenzione: GOLD,
  scadenza: RED,
  trattamento: BLUE,
  altro: PURPLE,
};

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GIORNI_BREVI = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday-first
}

export default function Calendario() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [openEvento, setOpenEvento] = useState(false);
  const [form, setForm] = useState({
    titolo: "",
    tipo: "altro" as keyof typeof TIPO_COLORS,
    data: today.toISOString().split("T")[0],
    ora: "",
    descrizione: "",
    modulo: "",
    priorita: "normale" as "bassa"|"normale"|"alta",
  });

  const { data: eventi = [], refetch } = trpc.calendario.list.useQuery({
    anno: viewYear,
    mese: viewMonth + 1,
  });

  const createEvento = trpc.calendario.create.useMutation({
    onSuccess: () => { refetch(); setOpenEvento(false); toast.success("Evento aggiunto"); setForm({ titolo: "", tipo: "altro", data: today.toISOString().split("T")[0], ora: "", descrizione: "", modulo: "", priorita: "normale" }); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteEvento = trpc.calendario.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Evento eliminato"); },
  });

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Map eventi per giorno
  const eventiByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    (eventi as any[]).forEach((e: any) => {
      const d = new Date(e.data);
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(e);
    });
    return map;
  }, [eventi]);

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

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>Calendario</h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>Pianificazione attività, scadenze e lavorazioni</p>
        </div>
        <Dialog open={openEvento} onOpenChange={setOpenEvento}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              <Plus size={16} /> Nuovo evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
            <DialogHeader><DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo evento</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Titolo *" value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} className="bg-input border-border" />
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TIPO_COLORS) as (keyof typeof TIPO_COLORS)[]).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))} className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                    style={{ background: form.tipo === t ? `${TIPO_COLORS[t]}25` : "oklch(0.15 0.006 145)", color: form.tipo === t ? TIPO_COLORS[t] : "oklch(0.55 0.01 145)", border: `1px solid ${form.tipo === t ? TIPO_COLORS[t] + "50" : "transparent"}` }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="bg-input border-border" />
                <Input type="time" value={form.ora} onChange={e => setForm(f => ({ ...f, ora: e.target.value }))} className="bg-input border-border" placeholder="Ora (opzionale)" />
              </div>
              <Input placeholder="Descrizione" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Modulo (es. Officina, Campi...)" value={form.modulo} onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))} className="bg-input border-border" />
              <div className="flex gap-2">
                {(["bassa","normale","alta"] as const).map(p => (
                  <button key={p} onClick={() => setForm(f => ({ ...f, priorita: p }))} className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                    style={{ background: form.priorita === p ? `${p === "alta" ? RED : p === "normale" ? GOLD : GREEN}20` : "oklch(0.15 0.006 145)", color: form.priorita === p ? (p === "alta" ? RED : p === "normale" ? GOLD : GREEN) : "oklch(0.55 0.01 145)", border: `1px solid ${form.priorita === p ? (p === "alta" ? RED : p === "normale" ? GOLD : GREEN) + "40" : "transparent"}` }}>
                    {p}
                  </button>
                ))}
              </div>
              <Button onClick={() => { if (!form.titolo) { toast.error("Titolo obbligatorio"); return; } createEvento.mutate(form as any); }} disabled={createEvento.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                {createEvento.isPending ? "Salvataggio..." : "Salva evento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendario mensile */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          {/* Header mese */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5">
              <ChevronLeft size={16} style={{ color: "oklch(0.6 0.01 145)" }} />
            </button>
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.9 0.005 145)" }}>
              {MESI[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5">
              <ChevronRight size={16} style={{ color: "oklch(0.6 0.01 145)" }} />
            </button>
          </div>

          {/* Giorni settimana */}
          <div className="grid grid-cols-7 px-4 pt-3 pb-1">
            {GIORNI_BREVI.map(g => (
              <div key={g} className="text-center text-xs font-semibold py-1" style={{ color: "oklch(0.45 0.01 145)" }}>{g}</div>
            ))}
          </div>

          {/* Griglia giorni */}
          <div className="grid grid-cols-7 gap-0.5 px-4 pb-4">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              const isSelected = day === selectedDay;
              const dayEventi = eventiByDay[day] ?? [];
              return (
                <button key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className="relative aspect-square flex flex-col items-center justify-start pt-1.5 rounded-lg transition-all text-sm"
                  style={{
                    background: isSelected ? `${GREEN}20` : isToday ? "oklch(0.15 0.008 145)" : "transparent",
                    border: `1px solid ${isSelected ? GREEN + "50" : isToday ? GREEN + "30" : "transparent"}`,
                    color: isToday ? GREEN : "oklch(0.75 0.01 145)",
                    fontWeight: isToday ? 700 : 400,
                  }}>
                  <span>{day}</span>
                  {dayEventi.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayEventi.slice(0, 3).map((e: any, idx: number) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: TIPO_COLORS[e.tipo] ?? PURPLE }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-3 px-5 pb-4">
            {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
              <div key={tipo} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs capitalize" style={{ color: "oklch(0.5 0.01 145)" }}>{tipo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pannello dettaglio giorno / prossimi eventi */}
        <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>
              {selectedDay ? `${selectedDay} ${MESI[viewMonth]}` : "PROSSIMI EVENTI"}
            </h3>
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {selectedDay ? (
              selectedDayEventi.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={28} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun evento</p>
                  <Button size="sm" className="mt-3 gap-1.5" onClick={() => { setForm(f => ({ ...f, data: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` })); setOpenEvento(true); }} style={{ background: `${GREEN}20`, color: GREEN }}>
                    <Plus size={13} /> Aggiungi
                  </Button>
                </div>
              ) : (
                selectedDayEventi.map((e: any) => (
                  <EventCard key={e.id} evento={e} onDelete={() => deleteEvento.mutate({ id: e.id })} />
                ))
              )
            ) : (
              (eventi as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={28} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
                  <p className="text-sm" style={{ color: "oklch(0.4 0.01 145)" }}>Nessun evento questo mese</p>
                </div>
              ) : (
                [...(eventi as any[])].sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
                  .map((e: any) => <EventCard key={e.id} evento={e} onDelete={() => deleteEvento.mutate({ id: e.id })} />)
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ evento, onDelete }: { evento: any; onDelete: () => void }) {
  const color = TIPO_COLORS[evento.tipo] ?? PURPLE;
  const prioColor = evento.priorita === "alta" ? RED : evento.priorita === "normale" ? GOLD : GREEN;
  return (
    <div className="rounded-lg p-3 group" style={{ background: "oklch(0.09 0.005 145)", borderLeft: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.01 145)" }}>{evento.titolo}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>
              <Calendar size={10} />{new Date(evento.data).toLocaleDateString("it-IT")}
            </span>
            {evento.ora && <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.45 0.01 145)" }}><Clock size={10} />{evento.ora}</span>}
            {evento.modulo && <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.45 0.01 145)" }}><Tag size={10} />{evento.modulo}</span>}
          </div>
          {evento.descrizione && <p className="text-xs mt-1 line-clamp-2" style={{ color: "oklch(0.4 0.01 145)" }}>{evento.descrizione}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: `${color}15`, color }}>{evento.tipo}</span>
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded" style={{ color: RED, background: `${RED}10` }}>×</button>
        </div>
      </div>
    </div>
  );
}
