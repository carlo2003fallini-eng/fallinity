import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, Users, Truck, ShoppingCart, Plus, Trash2,
  Phone, Mail, MapPin, Search, Briefcase,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD  = "oklch(0.72 0.15 75)";
const BLUE  = "oklch(0.6 0.15 220)";

const tipoConfig: Record<string, { label: string; color: string; icon: any }> = {
  dipendente: { label: "Dipendenti",  color: GREEN, icon: Users },
  fornitore:  { label: "Fornitori",   color: GOLD,  icon: Truck },
  cliente:    { label: "Clienti",     color: BLUE,  icon: ShoppingCart },
};

const EMPTY_FORM = {
  tipo: "dipendente" as "dipendente" | "fornitore" | "cliente",
  nome: "", cognome: "", aziendaNome: "", email: "",
  telefono: "", citta: "", ruolo: "", note: "",
};

export default function Azienda() {
  const [tab, setTab]     = useState<"dipendente" | "fornitore" | "cliente">("dipendente");
  const [search, setSearch] = useState("");
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState({ ...EMPTY_FORM });

  const { data: contatti = [], refetch } = trpc.azienda.contatti.list.useQuery({ tipo: tab });
  const createMutation = trpc.azienda.contatti.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); setForm({ ...EMPTY_FORM }); toast.success("Contatto aggiunto"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteMutation = trpc.azienda.contatti.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Contatto eliminato"); },
  });

  const filtered = (contatti as any[]).filter(c =>
    `${c.nome} ${c.cognome ?? ""} ${c.aziendaNome ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.nome.trim()) { toast.error("Il nome è obbligatorio"); return; }
    createMutation.mutate({ ...form, tipo: tab });
  };

  const cfg = tipoConfig[tab];

  // Stats
  const dipCount = (contatti as any[]).length;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Azienda
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.5 0.01 145)" }}>
            Gestione anagrafica unificata — dipendenti, fornitori, clienti
          </p>
        </div>
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM, tipo: tab }); setOpen(true); }}
          className="gap-2"
          style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}
        >
          <Plus size={15} /> Nuovo contatto
        </Button>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {(["dipendente", "fornitore", "cliente"] as const).map(t => {
          const c = tipoConfig[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: tab === t ? `${c.color}0f` : "oklch(0.11 0.006 145)",
                border: `1px solid ${tab === t ? c.color + "40" : "oklch(0.18 0.008 145)"}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}15` }}>
                  <c.icon size={15} style={{ color: c.color }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.5 0.01 145)" }}>
                  {c.label}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: tab === t ? c.color : "oklch(0.85 0.01 145)", letterSpacing: "-0.03em" }}>
                {tab === t ? filtered.length : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── SEARCH ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.01 145)" }} />
        <Input
          placeholder={`Cerca ${cfg.label.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-input border-border text-sm"
        />
      </div>

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
        {/* Table header bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)", background: "oklch(0.10 0.005 145)" }}>
          <cfg.icon size={14} style={{ color: cfg.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <Badge className="ml-1 text-xs px-2 py-0.5" style={{ background: `${cfg.color}15`, color: cfg.color, border: "none" }}>
            {filtered.length}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <cfg.icon size={36} className="opacity-10" style={{ color: cfg.color }} />
            <p className="text-sm" style={{ color: "oklch(0.45 0.01 145)" }}>
              Nessun {cfg.label.slice(0, -1).toLowerCase()} trovato
            </p>
            <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, tipo: tab }); setOpen(true); }}
              style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              <Plus size={13} className="mr-1" /> Aggiungi
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Nome</TableHead>
                <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Ruolo / Azienda</TableHead>
                <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Email</TableHead>
                <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Telefono</TableHead>
                <TableHead className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Città</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id} className="group" style={{ borderColor: "oklch(0.16 0.007 145)" }}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}>
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium" style={{ color: "oklch(0.88 0.005 145)" }}>
                        {c.nome} {c.cognome ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {c.ruolo && <span className="text-xs font-medium" style={{ color: "oklch(0.7 0.01 145)" }}>{c.ruolo}</span>}
                      {c.aziendaNome && <span className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>{c.aziendaNome}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                        <Mail size={11} />{c.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.telefono && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                        <Phone size={11} />{c.telefono}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.citta && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>
                        <MapPin size={11} />{c.citta}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteMutation.mutate({ id: c.id })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded"
                      style={{ color: "oklch(0.55 0.22 25)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── SHEET FORM ─────────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
          style={{ background: "oklch(0.10 0.005 145)", border: "none", borderLeft: "1px solid oklch(0.18 0.008 145)" }}>
          <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
                <cfg.icon size={15} style={{ color: cfg.color }} />
              </div>
              <SheetTitle style={{ color: "oklch(0.92 0.005 145)", fontFamily: "var(--font-display)" }}>
                Nuovo contatto
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Tipo selector */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: "oklch(0.55 0.01 145)" }}>Tipo</label>
              <div className="flex gap-2">
                {(["dipendente", "fornitore", "cliente"] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.tipo === t ? `${tipoConfig[t].color}18` : "oklch(0.14 0.007 145)",
                      color: form.tipo === t ? tipoConfig[t].color : "oklch(0.5 0.01 145)",
                      border: `1px solid ${form.tipo === t ? tipoConfig[t].color + "40" : "transparent"}`,
                    }}>
                    {tipoConfig[t].label.slice(0, -1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Nome *</label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Cognome</label>
                <Input value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} className="bg-input border-border text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Azienda</label>
              <Input value={form.aziendaNome} onChange={e => setForm(f => ({ ...f, aziendaNome: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Ruolo</label>
              <Input value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Telefono</label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Città</label>
              <Input value={form.citta} onChange={e => setForm(f => ({ ...f, citta: e.target.value }))} className="bg-input border-border text-sm" />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.55 0.01 145)" }}>Note</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="bg-input border-border text-sm" />
            </div>
          </div>

          <div className="px-6 py-4 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full"
              style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              {createMutation.isPending ? "Salvataggio..." : "Salva contatto"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
