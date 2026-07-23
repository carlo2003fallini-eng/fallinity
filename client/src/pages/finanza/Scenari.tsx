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
import { ArrowLeft, Plus, GitCompare, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";

const tipoColors: Record<string, string> = {
  prudente: "text-red-500", realistico: "text-blue-500", ottimistico: "text-green-500", personalizzato: "text-purple-500",
};

export default function ScenariPage() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: scenarios, isLoading, refetch } = trpc.finanza.scenarios.list.useQuery();
  const createMut = trpc.finanza.scenarios.create.useMutation({ onSuccess: () => { refetch(); setShowCreate(false); } });
  const deleteMut = trpc.finanza.scenarios.delete.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    nome: "", tipo: "realistico" as any, note: "",
    variazioneEntrate: "0", variazioneUscite: "0", entrateExtra: "0", usciteExtra: "0",
    investimentiPianificati: "0", contributiAttesi: "0", accantonamentoMensile: "0",
  });

  const handleCreate = () => {
    createMut.mutate({
      nome: form.nome, tipo: form.tipo, note: form.note || undefined,
      variabili: {
        variazioneEntrate: Number(form.variazioneEntrate),
        variazioneUscite: Number(form.variazioneUscite),
        entrateExtra: Number(form.entrateExtra),
        usciteExtra: Number(form.usciteExtra),
        investimentiPianificati: Number(form.investimentiPianificati),
        contributiAttesi: Number(form.contributiAttesi),
        accantonamentoMensile: Number(form.accantonamentoMensile),
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Scenari</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Nuovo</Button>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-3">
        {isLoading && <p className="text-center text-muted-foreground py-8">Caricamento...</p>}
        {!isLoading && (!scenarios || scenarios.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nessuno scenario creato</p>
            <p className="text-xs mt-1">Crea scenari per simulare l'andamento finanziario</p>
          </div>
        )}
        {scenarios?.map((s: any) => {
          const ris = s.risultati || {};
          return (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{s.nome}</h3>
                    <Badge variant="outline" className={`capitalize text-xs ${tipoColors[s.tipo] || ""}`}>{s.tipo}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive"
                    onClick={() => deleteMut.mutate({ id: s.id })}>Elimina</Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-green-500/10 rounded">
                    <TrendingUp className="w-3 h-3 mx-auto mb-0.5 text-green-500" />
                    <p className="text-muted-foreground">Entrate</p>
                    <p className="font-medium">€{Number(ris.entrateProiettate ?? 0).toLocaleString("it-IT")}</p>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded">
                    <TrendingDown className="w-3 h-3 mx-auto mb-0.5 text-red-500" />
                    <p className="text-muted-foreground">Uscite</p>
                    <p className="font-medium">€{Number(ris.usciteProiettate ?? 0).toLocaleString("it-IT")}</p>
                  </div>
                  <div className={`text-center p-2 rounded ${Number(ris.utile ?? 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <p className="text-muted-foreground">Utile</p>
                    <p className={`font-medium ${Number(ris.utile ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      €{Number(ris.utile ?? 0).toLocaleString("it-IT")}
                    </p>
                  </div>
                </div>
                {ris.coperturaReintegrazione != null && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Copertura Reintegrazione: {Number(ris.coperturaReintegrazione).toFixed(0)}% • Margine: {ris.margineOperativo != null ? `${ris.margineOperativo}%` : "—"}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sheet Creazione */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Nuovo Scenario</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Scenario ottimistico 2027" /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prudente">Prudente</SelectItem>
                  <SelectItem value="realistico">Realistico</SelectItem>
                  <SelectItem value="ottimistico">Ottimistico</SelectItem>
                  <SelectItem value="personalizzato">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Variabili</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Variazione Entrate (%)</Label><Input type="number" value={form.variazioneEntrate} onChange={e => setForm(f => ({ ...f, variazioneEntrate: e.target.value }))} /></div>
              <div><Label>Variazione Uscite (%)</Label><Input type="number" value={form.variazioneUscite} onChange={e => setForm(f => ({ ...f, variazioneUscite: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entrate Extra (€)</Label><Input type="number" value={form.entrateExtra} onChange={e => setForm(f => ({ ...f, entrateExtra: e.target.value }))} /></div>
              <div><Label>Uscite Extra (€)</Label><Input type="number" value={form.usciteExtra} onChange={e => setForm(f => ({ ...f, usciteExtra: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Investimenti (€)</Label><Input type="number" value={form.investimentiPianificati} onChange={e => setForm(f => ({ ...f, investimentiPianificati: e.target.value }))} /></div>
              <div><Label>Contributi (€)</Label><Input type="number" value={form.contributiAttesi} onChange={e => setForm(f => ({ ...f, contributiAttesi: e.target.value }))} /></div>
            </div>
            <div><Label>Accantonamento Mensile (€)</Label><Input type="number" value={form.accantonamentoMensile} onChange={e => setForm(f => ({ ...f, accantonamentoMensile: e.target.value }))} /></div>
            <div><Label>Note</Label><Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={!form.nome || createMut.isPending}>
              {createMut.isPending ? "Calcolo..." : "Crea e Calcola Scenario"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
