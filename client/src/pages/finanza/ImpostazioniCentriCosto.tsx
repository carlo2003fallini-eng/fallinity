import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, Plus, Search, Target, Archive, RotateCcw, Pencil,
} from "lucide-react";
import { toast } from "sonner";

export default function ImpostazioniCentriCosto() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [colore, setColore] = useState("#60a5fa");

  const utils = trpc.useUtils();
  const { data: centri = [] } = trpc.finanza.centriCosto.list.useQuery();

  const createMut = trpc.finanza.centriCosto.create.useMutation({
    onSuccess: () => { utils.finanza.centriCosto.invalidate(); toast.success("Centro di costo creato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.finanza.centriCosto.update.useMutation({
    onSuccess: () => { utils.finanza.centriCosto.invalidate(); toast.success("Aggiornato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = centri as any[];
    if (showArchived) list = list.filter((c: any) => c.attivo === false);
    else list = list.filter((c: any) => c.attivo !== false);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.nome.toLowerCase().includes(s) || c.codice?.toLowerCase().includes(s));
    }
    return list;
  }, [centri, search, showArchived]);

  function openCreate() { setEditId(null); setNome(""); setCodice(""); setDescrizione(""); setColore("#60a5fa"); setShowForm(true); }
  function openEdit(c: any) { setEditId(c.id); setNome(c.nome); setCodice(c.codice || ""); setDescrizione(c.descrizione || ""); setColore(c.colore || "#60a5fa"); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!nome.trim()) { toast.error("Nome obbligatorio"); return; }
    if (editId) { updateMut.mutate({ id: editId, nome, descrizione: descrizione || undefined, colore }); }
    else { createMut.mutate({ nome, codice: codice || undefined, descrizione: descrizione || undefined, colore }); }
  }
  function handleArchive(id: string) { updateMut.mutate({ id, attivo: false }); }
  function handleReactivate(id: string) { updateMut.mutate({ id, attivo: true }); }

  const COLORI = ["#60a5fa", "#4ade80", "#f59e0b", "#f87171", "#a78bfa", "#ec4899", "#14b8a6", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza/impostazioni")} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Centri di costo</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} {showArchived ? "archiviati" : "attivi"}</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" /> Nuovo</Button>
        </div>
      </div>
      <div className="px-4 pt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca centro di costo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!showArchived ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}>Attivi</button>
          <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${showArchived ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground"}`}><Archive className="w-3 h-3 inline mr-1" />Archiviati</button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun centro di costo</p>
          </div>
        )}
        {filtered.map((c: any) => (
          <Card key={c.id} className="p-3 border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c.colore || "#60a5fa"}20` }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.colore || "#60a5fa" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{c.nome}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{c.codice}</span>
                  {c.descrizione && <span className="text-[10px] text-muted-foreground truncate">{c.descrizione}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {showArchived ? (
                  <button onClick={() => handleReactivate(c.id)} className="p-2 rounded-lg hover:bg-white/5"><RotateCcw className="w-4 h-4 text-green-400" /></button>
                ) : (
                  <>
                    <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-white/5"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => handleArchive(c.id)} className="p-2 rounded-lg hover:bg-white/5"><Archive className="w-4 h-4 text-muted-foreground" /></button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>{editId ? "Modifica centro di costo" : "Nuovo centro di costo"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Stalla" className="mt-1" /></div>
            {!editId && <div><Label>Codice <span className="text-muted-foreground">(auto se vuoto)</span></Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="CDC-XXX" className="mt-1" /></div>}
            <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Colore</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLORI.map((col) => (
                  <button key={col} onClick={() => setColore(col)} className={`w-8 h-8 rounded-full border-2 transition-all ${colore === col ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: col }} />
                ))}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full" disabled={createMut.isPending || updateMut.isPending}>{editId ? "Salva" : "Crea"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
