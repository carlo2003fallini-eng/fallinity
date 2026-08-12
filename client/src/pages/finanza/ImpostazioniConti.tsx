import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, Plus, Search, Wallet, Archive, RotateCcw, Pencil, Building2,
} from "lucide-react";
import { toast } from "sonner";

const TIPI_CONTO = [
  { value: "bancario", label: "Conto bancario", icon: Building2 },
  { value: "cassa", label: "Cassa", icon: Wallet },
  { value: "carta", label: "Carta", icon: Wallet },
  { value: "deposito", label: "Conto deposito", icon: Wallet },
  { value: "altro", label: "Altro", icon: Wallet },
] as const;

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function ImpostazioniConti() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("bancario");
  const [banca, setBanca] = useState("");
  const [ibanMascherato, setIbanMascherato] = useState("");
  const [saldoIniziale, setSaldoIniziale] = useState("");
  const [valuta, setValuta] = useState("EUR");

  const utils = trpc.useUtils();
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();

  const createMut = trpc.finanza.conti.create.useMutation({
    onSuccess: () => { utils.finanza.conti.invalidate(); toast.success("Conto creato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.finanza.conti.update.useMutation({
    onSuccess: () => { utils.finanza.conti.invalidate(); toast.success("Aggiornato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = conti as any[];
    if (showArchived) list = list.filter((c: any) => c.attivo === false);
    else list = list.filter((c: any) => c.attivo !== false);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.nome.toLowerCase().includes(s) || c.banca?.toLowerCase().includes(s));
    }
    return list;
  }, [conti, search, showArchived]);

  function openCreate() { setEditId(null); setNome(""); setTipo("bancario"); setBanca(""); setIbanMascherato(""); setSaldoIniziale(""); setValuta("EUR"); setShowForm(true); }
  function openEdit(c: any) { setEditId(c.id); setNome(c.nome); setTipo(c.tipo); setBanca(c.banca || ""); setIbanMascherato(c.ibanMascherato || ""); setSaldoIniziale(""); setValuta(c.valuta || "EUR"); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!nome.trim()) { toast.error("Nome obbligatorio"); return; }
    if (editId) {
      updateMut.mutate({ id: editId, nome, banca: banca || undefined, ibanMascherato: ibanMascherato || undefined });
    } else {
      const saldo = saldoIniziale ? Math.round(parseFloat(saldoIniziale.replace(",", ".")) * 100) : 0;
      createMut.mutate({ nome, tipo: tipo as any, banca: banca || undefined, ibanMascherato: ibanMascherato || undefined, saldoIniziale: saldo, valuta });
    }
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
            <h1 className="text-lg font-bold">Conti finanziari</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} {showArchived ? "archiviati" : "attivi"}</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" /> Nuovo</Button>
        </div>
      </div>
      <div className="px-4 pt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca conto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!showArchived ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}>Attivi</button>
          <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${showArchived ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground"}`}><Archive className="w-3 h-3 inline mr-1" />Archiviati</button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun conto</p>
          </div>
        )}
        {filtered.map((c: any) => (
          <Card key={c.id} className="p-3 border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{c.nome}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{c.tipo}</Badge>
                  {c.banca && <span className="text-[10px] text-muted-foreground">{c.banca}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${c.saldoAttuale >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {fmtCents(c.saldoAttuale || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
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
          <SheetHeader><SheetTitle>{editId ? "Modifica conto" : "Nuovo conto"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Banca Aziendale" className="mt-1" /></div>
            {!editId && (
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPI_CONTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Banca</Label><Input value={banca} onChange={(e) => setBanca(e.target.value)} placeholder="es. Intesa Sanpaolo" className="mt-1" /></div>
            <div><Label>IBAN</Label><Input value={ibanMascherato} onChange={(e) => setIbanMascherato(e.target.value)} placeholder="IT60..." className="mt-1" /></div>
            {!editId && <div><Label>Saldo iniziale (€)</Label><Input value={saldoIniziale} onChange={(e) => setSaldoIniziale(e.target.value)} placeholder="0,00" className="mt-1" /></div>}
            <Button onClick={handleSave} className="w-full" disabled={createMut.isPending || updateMut.isPending}>{editId ? "Salva" : "Crea conto"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
