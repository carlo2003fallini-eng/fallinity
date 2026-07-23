import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Lightbulb, Clock, TrendingUp } from "lucide-react";
import { Link } from "wouter";

const statiLabel: Record<string, string> = {
  idea: "Idea", da_valutare: "Da valutare", approvato: "Approvato",
  pianificato: "Pianificato", in_corso: "In corso", completato: "Completato", annullato: "Annullato",
};

export default function InvestimentiPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [filtroStato, setFiltroStato] = useState<string>("");

  const { data: investments, isLoading, refetch } = trpc.finanza.investments.list.useQuery({ stato: filtroStato || undefined } as any);
  const createMut = trpc.finanza.investments.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); } });

  const [form, setForm] = useState({
    nome: "", categoria: "macchinario" as any, descrizione: "", importoStimato: "",
    dataPrevista: "", durata: "60", fornitore: "", finanziamentoPrevisto: "0",
    anticipo: "0", rate: "0", contributi: "0", valoreResiduo: "0",
    risparmioPrevisto: "0", ricavoAggiuntivo: "0", costiOperativi: "0",
    stato: "idea" as any, priorita: "media" as any,
  });

  const handleCreate = () => {
    createMut.mutate({
      nome: form.nome, categoria: form.categoria, descrizione: form.descrizione || undefined,
      importoStimato: Number(form.importoStimato), dataPrevista: form.dataPrevista || undefined,
      durata: Number(form.durata), fornitore: form.fornitore || undefined,
      finanziamentoPrevisto: Number(form.finanziamentoPrevisto),
      anticipo: Number(form.anticipo), rate: Number(form.rate),
      contributi: Number(form.contributi), valoreResiduo: Number(form.valoreResiduo),
      risparmioPrevisto: Number(form.risparmioPrevisto),
      ricavoAggiuntivo: Number(form.ricavoAggiuntivo),
      costiOperativi: Number(form.costiOperativi),
      priorita: form.priorita,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Investimenti</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Nuovo</Button>
        </div>
      </div>

      {/* Filtri */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        <Button variant={!filtroStato ? "default" : "outline"} size="sm" onClick={() => setFiltroStato("")} className="shrink-0">Tutti</Button>
        {["idea", "da_valutare", "approvato", "in_corso", "completato"].map(s => (
          <Button key={s} variant={filtroStato === s ? "default" : "outline"} size="sm"
            onClick={() => setFiltroStato(s)} className="shrink-0 text-xs">
            {statiLabel[s]}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-3">
        {isLoading && <p className="text-center text-muted-foreground py-8">Caricamento...</p>}
        {!isLoading && (!investments || investments.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nessun investimento registrato</p>
          </div>
        )}
        {investments?.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium">{inv.nome}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{inv.categoria} • {inv.fornitore || "—"}</p>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">{statiLabel[inv.stato] || inv.stato}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Importo</p>
                  <p className="font-medium">€{Number(inv.importoStimato ?? 0).toLocaleString("it-IT")}</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Durata</p>
                  <p className="font-medium">{inv.durata} mesi</p>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground">Priorità</p>
                  <p className="font-medium capitalize">{inv.priorita}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sheet Creazione */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Nuovo Investimento</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Nuovo trattore" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macchinario">Macchinario</SelectItem>
                    <SelectItem value="struttura">Struttura</SelectItem>
                    <SelectItem value="terreno">Terreno</SelectItem>
                    <SelectItem value="tecnologia">Tecnologia</SelectItem>
                    <SelectItem value="animali">Animali</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={form.stato} onValueChange={v => setForm(f => ({ ...f, stato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">Idea</SelectItem>
                    <SelectItem value="da_valutare">Da valutare</SelectItem>
                    <SelectItem value="approvato">Approvato</SelectItem>
                    <SelectItem value="pianificato">Pianificato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Importo Stimato (€)</Label><Input type="number" value={form.importoStimato} onChange={e => setForm(f => ({ ...f, importoStimato: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Prevista</Label><Input type="date" value={form.dataPrevista} onChange={e => setForm(f => ({ ...f, dataPrevista: e.target.value }))} /></div>
              <div><Label>Durata (mesi)</Label><Input type="number" value={form.durata} onChange={e => setForm(f => ({ ...f, durata: e.target.value }))} /></div>
            </div>
            <div><Label>Fornitore</Label><Input value={form.fornitore} onChange={e => setForm(f => ({ ...f, fornitore: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Finanziamento (€)</Label><Input type="number" value={form.finanziamentoPrevisto} onChange={e => setForm(f => ({ ...f, finanziamentoPrevisto: e.target.value }))} /></div>
              <div><Label>Contributi (€)</Label><Input type="number" value={form.contributi} onChange={e => setForm(f => ({ ...f, contributi: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Risparmio Previsto (€/anno)</Label><Input type="number" value={form.risparmioPrevisto} onChange={e => setForm(f => ({ ...f, risparmioPrevisto: e.target.value }))} /></div>
              <div><Label>Ricavo Aggiuntivo (€/anno)</Label><Input type="number" value={form.ricavoAggiuntivo} onChange={e => setForm(f => ({ ...f, ricavoAggiuntivo: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Priorità</Label>
              <Select value={form.priorita} onValueChange={v => setForm(f => ({ ...f, priorita: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="bassa">Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrizione</Label><Textarea value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={!form.nome || !form.importoStimato || createMut.isPending}>
              {createMut.isPending ? "Creazione..." : "Crea Investimento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
