import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Download, Clock, Settings } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function ReportPage() {
  const [tab, setTab] = useState("genera");
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: history, refetch: refetchHistory } = trpc.finanza.reports.history.useQuery();
  const { data: configs } = trpc.finanza.reports.configs.list.useQuery();
  const generateMut = trpc.finanza.reports.generate.useMutation({
    onSuccess: (data) => { setResult(data); setShowResult(true); refetchHistory(); toast.success("Report generato"); },
  });

  const [form, setForm] = useState({
    tipo: "economico" as any, formato: "json" as any,
    dataInizio: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    dataFine: new Date().toISOString().split("T")[0],
    tipoFiltro: "cassa" as "cassa" | "competenza",
  });

  const handleGenerate = () => {
    generateMut.mutate({
      tipo: form.tipo, formato: form.formato,
      filtri: { dataInizio: form.dataInizio, dataFine: form.dataFine, tipo: form.tipoFiltro },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Report</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
          <TabsTrigger value="genera"><FileText className="w-3 h-3 mr-1" />Genera</TabsTrigger>
          <TabsTrigger value="storico"><Clock className="w-3 h-3 mr-1" />Storico</TabsTrigger>
          <TabsTrigger value="config"><Settings className="w-3 h-3 mr-1" />Config</TabsTrigger>
        </TabsList>

        {/* Genera */}
        <TabsContent value="genera" className="px-4 py-3 space-y-4">
          <div>
            <Label>Tipo Report</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="economico">Economico</SelectItem>
                <SelectItem value="cashflow">Cashflow</SelectItem>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="reintegrazione">Reintegrazione</SelectItem>
                <SelectItem value="fornitori">Fornitori</SelectItem>
                <SelectItem value="clienti">Clienti</SelectItem>
                <SelectItem value="centri_costo">Centri di Costo</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Da</Label><Input type="date" value={form.dataInizio} onChange={e => setForm(f => ({ ...f, dataInizio: e.target.value }))} /></div>
            <div><Label>A</Label><Input type="date" value={form.dataFine} onChange={e => setForm(f => ({ ...f, dataFine: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Criterio</Label>
              <Select value={form.tipoFiltro} onValueChange={v => setForm(f => ({ ...f, tipoFiltro: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cassa">Cassa</SelectItem>
                  <SelectItem value="competenza">Competenza</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={form.formato} onValueChange={v => setForm(f => ({ ...f, formato: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">Visualizza</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={handleGenerate} disabled={generateMut.isPending}>
            {generateMut.isPending ? "Generazione..." : "Genera Report"}
          </Button>
        </TabsContent>

        {/* Storico */}
        <TabsContent value="storico" className="px-4 py-3 space-y-3">
          {history?.map((h: any) => (
            <Card key={h.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{String(h.dataGenerazione)}</p>
                  <p className="text-xs text-muted-foreground">{h.id.slice(0, 8)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Completato</Badge>
              </CardContent>
            </Card>
          ))}
          {(!history || history.length === 0) && <p className="text-center text-muted-foreground py-8">Nessun report generato</p>}
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="px-4 py-3 space-y-3">
          {configs?.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.tipo} • {c.periodicita || "manuale"}</p>
                  </div>
                  <Badge variant={c.stato === "attivo" ? "default" : "secondary"}>{c.stato}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!configs || configs.length === 0) && <p className="text-center text-muted-foreground py-8">Nessuna configurazione salvata</p>}
        </TabsContent>
      </Tabs>

      {/* Sheet Risultato */}
      <Sheet open={showResult} onOpenChange={setShowResult}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Risultato Report</SheetTitle></SheetHeader>
          <div className="mt-4">
            {result?.csv && (
              <div>
                <Button variant="outline" size="sm" className="mb-3" onClick={() => {
                  const blob = new Blob([result.csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "report.csv"; a.click();
                }}>
                  <Download className="w-4 h-4 mr-1" />Scarica CSV
                </Button>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{result.csv}</pre>
              </div>
            )}
            {result?.risultati && !result.csv && (
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result.risultati, null, 2)}
              </pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
