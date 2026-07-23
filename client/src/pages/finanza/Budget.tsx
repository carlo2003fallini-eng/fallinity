import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function BudgetPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [filtroStato, setFiltroStato] = useState<string>("attivo");

  const { data: budgets, isLoading, refetch } = trpc.finanza.budgetV2.list.useQuery({ stato: (filtroStato || undefined) as any });
  const createMut = trpc.finanza.budgetV2.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); } });
  const archiveMut = trpc.finanza.budgetV2.archive.useMutation({ onSuccess: () => refetch() });

  // Form state
  const [form, setForm] = useState({
    nome: "", tipo: "uscita" as "entrata" | "uscita", periodo: "annuale" as any,
    importoPrevisto: "", distribuzione: "uniforme" as any, note: "",
    dataInizio: new Date().getFullYear() + "-01-01",
    dataFine: new Date().getFullYear() + "-12-31",
  });

  const handleCreate = () => {
    createMut.mutate({
      nome: form.nome, tipo: form.tipo, periodo: form.periodo,
      importoPrevisto: Number(form.importoPrevisto), distribuzione: form.distribuzione,
      note: form.note || undefined, dataInizio: form.dataInizio, dataFine: form.dataFine,
    });
  };

  // Calcoli hero
  const totPrevisto = budgets?.reduce((s, b) => s + Number(b.importoPrevisto ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Budget</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Nuovo</Button>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 py-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-b">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Budget Totale</p>
            <p className="text-xl font-bold">€{totPrevisto.toLocaleString("it-IT")}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Budget Attivi</p>
            <p className="text-xl font-bold">{budgets?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        {["attivo", "bozza", "completato", "archiviato"].map(s => (
          <Button key={s} variant={filtroStato === s ? "default" : "outline"} size="sm"
            onClick={() => setFiltroStato(s)} className="capitalize shrink-0">
            {s}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-3">
        {isLoading && <p className="text-center text-muted-foreground py-8">Caricamento...</p>}
        {!isLoading && budgets?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nessun budget {filtroStato}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>Crea il primo budget</Button>
          </div>
        )}
        {budgets?.map(b => {
          const previsto = Number(b.importoPrevisto ?? 0);
          return (
            <Card key={b.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{b.nome}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{b.tipo} • {b.periodo}</p>
                  </div>
                  <Badge variant={b.tipo === "uscita" ? "destructive" : "default"} className="shrink-0">
                    {b.tipo === "uscita" ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    €{previsto.toLocaleString("it-IT")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{String(b.dataInizio)} → {String(b.dataFine)}</span>
                  {b.stato === "attivo" && (
                    <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs"
                      onClick={() => archiveMut.mutate({ id: b.id })}>Archivia</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sheet Creazione */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Nuovo Budget</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Mangimi 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uscita">Uscita</SelectItem>
                    <SelectItem value="entrata">Entrata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Periodo</Label>
                <Select value={form.periodo} onValueChange={v => setForm(f => ({ ...f, periodo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annuale">Annuale</SelectItem>
                    <SelectItem value="mensile">Mensile</SelectItem>
                    <SelectItem value="trimestrale">Trimestrale</SelectItem>
                    <SelectItem value="personalizzato">Personalizzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Importo Previsto (€)</Label>
              <Input type="number" value={form.importoPrevisto} onChange={e => setForm(f => ({ ...f, importoPrevisto: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Inizio</Label>
                <Input type="date" value={form.dataInizio} onChange={e => setForm(f => ({ ...f, dataInizio: e.target.value }))} />
              </div>
              <div>
                <Label>Data Fine</Label>
                <Input type="date" value={form.dataFine} onChange={e => setForm(f => ({ ...f, dataFine: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Distribuzione</Label>
              <Select value={form.distribuzione} onValueChange={v => setForm(f => ({ ...f, distribuzione: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniforme">Uniforme</SelectItem>
                  <SelectItem value="stagionale">Stagionale</SelectItem>
                  <SelectItem value="storica">Storica</SelectItem>
                  <SelectItem value="personalizzata">Personalizzata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note opzionali..." />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!form.nome || !form.importoPrevisto || createMut.isPending}>
              {createMut.isPending ? "Creazione..." : "Crea Budget"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
