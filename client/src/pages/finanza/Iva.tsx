import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Plus, Receipt, Clock, Lock, Unlock, FileText } from "lucide-react";
import { toast } from "sonner";

// ──────────────────────────────────────────────────────────────────────────────
// PAGINA IVA — Posizione, Movimenti, Periodi, Alert
// ──────────────────────────────────────────────────────────────────────────────

export default function Iva() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("posizione");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showPeriodAction, setShowPeriodAction] = useState(false);

  // Query
  const { data: position } = trpc.fiscal.vatPosition.useQuery();
  const { data: alerts } = trpc.fiscal.vatAlerts.useQuery();
  const { data: entries } = trpc.fiscal.vatEntries.useQuery({});
  const { data: periods } = trpc.fiscal.vatPeriods.useQuery();
  const { data: summary } = trpc.fiscal.summary.useQuery();

  // Mutations
  const createEntry = trpc.fiscal.createVatEntry.useMutation({
    onSuccess: () => { toast.success("Movimento IVA registrato"); setShowNewEntry(false); },
    onError: (e) => toast.error(e.message),
  });
  const periodAction = trpc.fiscal.vatPeriodAction.useMutation({
    onSuccess: () => { toast.success("Periodo aggiornato"); setShowPeriodAction(false); },
    onError: (e) => toast.error(e.message),
  });

  const positionColor = position?.posizioneAttuale === "credito" ? "text-green-400" :
    position?.posizioneAttuale === "debito" ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/finanza")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">IVA</h1>
          <p className="text-xs text-muted-foreground">
            Regime: {summary?.taxProfile?.vatRegime?.replace(/_/g, " ") || "Non configurato"}
          </p>
        </div>
      </div>

      {/* Hero — Posizione IVA */}
      <Card className="mb-4 border-primary/20">
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Posizione IVA attuale</p>
            <p className={`text-2xl font-bold ${positionColor}`}>
              {position?.posizioneAttuale === "credito" && "+"}
              {position?.posizioneAttuale === "debito" && "-"}
              €{Math.abs(position?.saldoAttuale || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </p>
            <Badge variant={position?.posizioneAttuale === "credito" ? "default" : position?.posizioneAttuale === "debito" ? "destructive" : "secondary"} className="mt-1">
              {position?.posizioneAttuale === "credito" ? "Credito" : position?.posizioneAttuale === "debito" ? "Debito" : "Zero"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <div>
              <p className="text-muted-foreground">IVA Vendite</p>
              <p className="font-medium text-green-400">€{(position?.ivaVendite || 0).toLocaleString("it-IT")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">IVA Acquisti</p>
              <p className="font-medium text-red-400">€{(position?.ivaAcquisti || 0).toLocaleString("it-IT")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Compensazioni</p>
              <p className="font-medium">€{(position?.compensazioni || 0).toLocaleString("it-IT")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {alerts.map((alert: any, i: number) => (
            <Card key={i} className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{alert.titolo}</p>
                  <p className="text-xs text-muted-foreground">{alert.messaggio}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="posizione">Dettaglio</TabsTrigger>
          <TabsTrigger value="movimenti">Movimenti</TabsTrigger>
          <TabsTrigger value="periodi">Periodi</TabsTrigger>
        </TabsList>

        {/* Tab Dettaglio */}
        <TabsContent value="posizione" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Composizione posizione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Saldo iniziale</span>
                <span className="font-medium">€{(position?.saldoIniziale || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">+ IVA vendite</span>
                <span className="font-medium text-green-400">€{(position?.ivaVendite || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">- IVA acquisti</span>
                <span className="font-medium text-red-400">€{(position?.ivaAcquisti || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">+ Compensazioni</span>
                <span className="font-medium">€{(position?.compensazioni || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">- Versamenti</span>
                <span className="font-medium">€{(position?.versamenti || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">± Rettifiche</span>
                <span className="font-medium">€{(position?.rettifiche || 0).toLocaleString("it-IT")}</span>
              </div>
              <div className="flex justify-between py-2 font-semibold">
                <span>= Saldo attuale</span>
                <span className={positionColor}>€{(position?.saldoAttuale || 0).toLocaleString("it-IT")}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Configurazione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Regime</span>
                <span className="font-medium">{summary?.taxProfile?.vatRegime?.replace(/_/g, " ") || "N/D"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Periodicità</span>
                <span className="font-medium">{summary?.taxProfile?.settlementFrequency || "N/D"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Decorrenza</span>
                <span className="font-medium">{summary?.taxProfile?.effectiveFrom ? String(summary.taxProfile.effectiveFrom).slice(0, 10) : "N/D"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Movimenti */}
        <TabsContent value="movimenti" className="space-y-3">
          <Button size="sm" onClick={() => setShowNewEntry(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Nuovo movimento IVA
          </Button>

          {(!entries || entries.length === 0) ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nessun movimento IVA registrato
              </CardContent>
            </Card>
          ) : (
            entries.map((entry: any) => (
              <Card key={entry.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {entry.direction === "attiva" ? (
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{entry.description || entry.type?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{entry.referencePeriod} · {entry.referenceDate}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${entry.direction === "attiva" ? "text-green-400" : "text-red-400"}`}>
                      {entry.direction === "attiva" ? "+" : "-"}€{Math.abs(entry.amount || 0).toLocaleString("it-IT")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab Periodi */}
        <TabsContent value="periodi" className="space-y-3">
          {(!periods || periods.length === 0) ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nessun periodo IVA configurato
              </CardContent>
            </Card>
          ) : (
            periods.map((period: any) => (
              <Card key={period.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {period.status === "chiuso" ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : period.status === "in_verifica" ? (
                        <FileText className="h-4 w-4 text-yellow-400" />
                      ) : (
                        <Unlock className="h-4 w-4 text-green-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{period.period} {period.year}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.status === "chiuso" && `Chiuso il ${period.closedAt ? String(period.closedAt).slice(0, 10) : ""}`}
                          {period.status === "in_verifica" && "In verifica"}
                          {period.status === "aperto" && "Aperto"}
                          {period.status === "riaperto" && `Riaperto: ${period.reopenReason || ""}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      period.status === "chiuso" ? "secondary" :
                      period.status === "in_verifica" ? "outline" : "default"
                    }>
                      {period.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet — Nuovo Movimento IVA */}
      <NewVatEntrySheet open={showNewEntry} onClose={() => setShowNewEntry(false)} onSubmit={createEntry} />

      {/* Sheet — Azione Periodo */}
      {showPeriodAction && (
        <PeriodActionSheet open={showPeriodAction} onClose={() => setShowPeriodAction(false)} onSubmit={periodAction} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sheet: Nuovo Movimento IVA
// ──────────────────────────────────────────────────────────────────────────────

function NewVatEntrySheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: any }) {
  const [type, setType] = useState("vendita");
  const [direction, setDirection] = useState("attiva");
  const [amount, setAmount] = useState("");
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [referencePeriod, setReferencePeriod] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    onSubmit.mutate({
      type: type as any,
      direction: direction as any,
      amount: parseFloat(amount) || 0,
      referenceDate,
      referencePeriod: referencePeriod || undefined,
      description: description || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nuovo movimento IVA</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vendita">Vendita</SelectItem>
                <SelectItem value="acquisto">Acquisto</SelectItem>
                <SelectItem value="nota_credito">Nota credito</SelectItem>
                <SelectItem value="rettifica">Rettifica</SelectItem>
                <SelectItem value="versamento">Versamento</SelectItem>
                <SelectItem value="compensazione">Compensazione</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direzione</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attiva">Attiva (vendite)</SelectItem>
                <SelectItem value="passiva">Passiva (acquisti)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Importo (€)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Data riferimento</Label>
            <Input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
          </div>
          <div>
            <Label>Periodo (es. T1, M01)</Label>
            <Input value={referencePeriod} onChange={(e) => setReferencePeriod(e.target.value)} placeholder="T1" />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nota opzionale" />
          </div>
          <Button onClick={handleSubmit} disabled={onSubmit.isPending || !amount} className="w-full">
            {onSubmit.isPending ? "Registrazione..." : "Registra"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sheet: Azione Periodo
// ──────────────────────────────────────────────────────────────────────────────

function PeriodActionSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: any }) {
  const [period, setPeriod] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [action, setAction] = useState("chiudi");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    onSubmit.mutate({
      period,
      year: parseInt(year),
      action: action as any,
      reason: reason || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gestione periodo IVA</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Periodo</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="T1, M01, ecc." />
          </div>
          <div>
            <Label>Anno</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <Label>Azione</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chiudi">Chiudi periodo</SelectItem>
                <SelectItem value="verifica">Metti in verifica</SelectItem>
                <SelectItem value="riapri">Riapri periodo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === "riapri" && (
            <div>
              <Label>Motivazione riapertura</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo della riapertura" />
            </div>
          )}
          <Button onClick={handleSubmit} disabled={onSubmit.isPending || !period} className="w-full">
            {onSubmit.isPending ? "Elaborazione..." : "Conferma"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
