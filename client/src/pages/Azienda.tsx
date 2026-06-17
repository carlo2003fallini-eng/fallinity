import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  Truck,
  ShoppingCart,
  Plus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const BLUE = "oklch(0.6 0.15 220)";

const tipoConfig: Record<string, { label: string; color: string; icon: any }> = {
  dipendente: { label: "Dipendente", color: GREEN, icon: Users },
  fornitore: { label: "Fornitore", color: GOLD, icon: Truck },
  cliente: { label: "Cliente", color: BLUE, icon: ShoppingCart },
};

export default function Azienda() {
  const [tab, setTab] = useState<"dipendente" | "fornitore" | "cliente">("dipendente");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "dipendente" as "dipendente" | "fornitore" | "cliente",
    nome: "",
    cognome: "",
    aziendaNome: "",
    email: "",
    telefono: "",
    citta: "",
    ruolo: "",
    note: "",
  });

  const { data: contatti = [], refetch } = trpc.azienda.contatti.list.useQuery({ tipo: tab });
  const createMutation = trpc.azienda.contatti.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Contatto aggiunto"); },
    onError: () => toast.error("Errore durante il salvataggio"),
  });
  const deleteMutation = trpc.azienda.contatti.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Contatto eliminato"); },
  });

  const filtered = contatti.filter(c =>
    `${c.nome} ${c.cognome ?? ""} ${c.aziendaNome ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.nome.trim()) { toast.error("Il nome è obbligatorio"); return; }
    createMutation.mutate({ ...form, tipo: tab });
  };

  const cfg = tipoConfig[tab];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.005 145)" }}>
            Azienda
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.5 0.01 145)" }}>
            Gestisci la tua azienda, ogni giorno.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
              <Plus size={16} />
              Nuovo contatto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" style={{ background: "oklch(0.12 0.006 145)", border: "1px solid oklch(0.22 0.01 145)" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "oklch(0.95 0.005 145)" }}>Nuovo contatto</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="flex gap-2">
                {(["dipendente","fornitore","cliente"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: form.tipo === t ? `${tipoConfig[t].color}20` : "oklch(0.15 0.006 145)",
                      color: form.tipo === t ? tipoConfig[t].color : "oklch(0.55 0.01 145)",
                      border: `1px solid ${form.tipo === t ? tipoConfig[t].color + "40" : "transparent"}`,
                    }}
                  >
                    {tipoConfig[t].label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="bg-input border-border" />
                <Input placeholder="Cognome" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} className="bg-input border-border" />
              </div>
              <Input placeholder="Azienda" value={form.aziendaNome} onChange={e => setForm(f => ({ ...f, aziendaNome: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Ruolo" value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className="bg-input border-border" />
              <Input placeholder="Città" value={form.citta} onChange={e => setForm(f => ({ ...f, citta: e.target.value }))} className="bg-input border-border" />
              <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full" style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}>
                {createMutation.isPending ? "Salvataggio..." : "Salva contatto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["dipendente","fornitore","cliente"] as const).map(t => {
          const c = tipoConfig[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t ? `${c.color}15` : "oklch(0.11 0.006 145)",
                color: tab === t ? c.color : "oklch(0.55 0.01 145)",
                border: `1px solid ${tab === t ? c.color + "30" : "oklch(0.18 0.008 145)"}`,
              }}
            >
              <c.icon size={14} />
              {c.label}i
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.01 145)" }} />
        <Input
          placeholder={`Cerca ${cfg.label.toLowerCase()}i...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-input border-border"
        />
      </div>

      {/* Lista contatti */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
        >
          <cfg.icon size={40} className="mx-auto mb-3 opacity-20" style={{ color: cfg.color }} />
          <p className="text-sm font-medium" style={{ color: "oklch(0.55 0.01 145)" }}>
            Nessun {cfg.label.toLowerCase()} trovato
          </p>
          <p className="text-xs mt-1" style={{ color: "oklch(0.4 0.01 145)" }}>
            Clicca "Nuovo contatto" per aggiungerne uno
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              className="rounded-xl p-4 space-y-3 group"
              style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `${cfg.color}15`, color: cfg.color }}
                  >
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 145)" }}>
                      {c.nome} {c.cognome ?? ""}
                    </p>
                    {c.aziendaNome && (
                      <p className="text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>{c.aziendaNome}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: c.id })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                  style={{ color: "oklch(0.55 0.22 25)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {c.ruolo && (
                <Badge style={{ background: `${cfg.color}15`, color: cfg.color, border: "none", fontSize: 11 }}>
                  {c.ruolo}
                </Badge>
              )}
              <div className="space-y-1.5">
                {c.email && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                    <Mail size={12} />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.telefono && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                    <Phone size={12} />
                    <span>{c.telefono}</span>
                  </div>
                )}
                {c.citta && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.5 0.01 145)" }}>
                    <MapPin size={12} />
                    <span>{c.citta}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
