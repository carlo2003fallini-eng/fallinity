import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, Plus, CreditCard, Archive, RotateCcw, Pencil,
} from "lucide-react";
import { toast } from "sonner";

export default function ImpostazioniMetodi() {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  const utils = trpc.useUtils();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();

  const createMut = trpc.finanza.metodi.create.useMutation({
    onSuccess: () => { utils.finanza.metodi.invalidate(); toast.success("Metodo creato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.finanza.metodi.update.useMutation({
    onSuccess: () => { utils.finanza.metodi.invalidate(); toast.success("Aggiornato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = metodi as any[];
    if (showArchived) return list.filter((m: any) => m.attivo === false);
    return list.filter((m: any) => m.attivo !== false);
  }, [metodi, showArchived]);

  function openCreate() { setEditId(null); setNome(""); setShowForm(true); }
  function openEdit(m: any) { setEditId(m.id); setNome(m.nome); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!nome.trim()) { toast.error("Nome obbligatorio"); return; }
    if (editId) { updateMut.mutate({ id: editId, nome }); }
    else { createMut.mutate({ nome }); }
  }
  function handleArchive(id: string) { updateMut.mutate({ id, attivo: false }); }
  function handleReactivate(id: string) { updateMut.mutate({ id, attivo: true }); }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza/impostazioni")} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Metodi di pagamento</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} {showArchived ? "archiviati" : "attivi"}</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" /> Nuovo</Button>
        </div>
      </div>
      <div className="px-4 pt-3">
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!showArchived ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}>Attivi</button>
          <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${showArchived ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground"}`}><Archive className="w-3 h-3 inline mr-1" />Archiviati</button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun metodo di pagamento</p>
          </div>
        )}
        {filtered.map((m: any) => (
          <Card key={m.id} className="p-3 border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1"><span className="font-medium text-sm">{m.nome}</span></div>
              <div className="flex items-center gap-1">
                {showArchived ? (
                  <button onClick={() => handleReactivate(m.id)} className="p-2 rounded-lg hover:bg-white/5"><RotateCcw className="w-4 h-4 text-green-400" /></button>
                ) : (
                  <>
                    <button onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-white/5"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => handleArchive(m.id)} className="p-2 rounded-lg hover:bg-white/5"><Archive className="w-4 h-4 text-muted-foreground" /></button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>{editId ? "Modifica metodo" : "Nuovo metodo di pagamento"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Bonifico bancario" className="mt-1" /></div>
            <Button onClick={handleSave} className="w-full" disabled={createMut.isPending || updateMut.isPending}>{editId ? "Salva" : "Crea metodo"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

