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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Shield, Wallet, PiggyBank, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function ReintegrazionePage() {
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [tab, setTab] = useState("dashboard");

  const { data: dashboard } = trpc.finanza.replacement.dashboard.useQuery();
  const { data: plans, refetch: refetchPlans } = trpc.finanza.replacement.plans.list.useQuery();
  const { data: accounts, refetch: refetchAccounts } = trpc.finanza.replacement.accounts.list.useQuery();

  const createPlanMut = trpc.finanza.replacement.plans.create.useMutation({ onSuccess: () => { refetchPlans(); setShowCreatePlan(false); } });
  const createAccountMut = trpc.finanza.replacement.accounts.create.useMutation({ onSuccess: () => { refetchAccounts(); setShowCreateAccount(false); } });

  // Form plan
  const [planForm, setPlanForm] = useState({
    nome: "", valoreSostituzione: "", dataSostituzione: "", vitaUtile: "10",
    valoreResiduo: "0", accantonamentoMensileEffettivo: "", priorita: "media" as any, note: "",
  });

  // Form account
  const [accForm, setAccForm] = useState({
    tassoInteresse: "2", periodicita: "mensile" as any, note: "",
  });

  const handleCreatePlan = () => {
    createPlanMut.mutate({
      nome: planForm.nome,
      valoreSostituzione: Number(planForm.valoreSostituzione),
      dataSostituzione: planForm.dataSostituzione,
      vitaUtile: Number(planForm.vitaUtile),
      valoreResiduo: Number(planForm.valoreResiduo),
      accantonamentoMensileEffettivo: Number(planForm.accantonamentoMensileEffettivo) || undefined,
      priorita: planForm.priorita,
      note: planForm.note || undefined,
    });
  };

  const handleCreateAccount = () => {
    createAccountMut.mutate({
      tassoInteresse: Number(accForm.tassoInteresse),
      periodicita: accForm.periodicita,
      note: accForm.note || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Fondo Reintegrazione</h1>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="piani">Piani</TabsTrigger>
          <TabsTrigger value="conti">Conti</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="px-4 py-3 space-y-4">
          {dashboard && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <PiggyBank className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-muted-foreground">Accantonato</p>
                    <p className="text-lg font-bold">€{Number(dashboard.capitaleAccantonato ?? 0).toLocaleString("it-IT")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Target className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-muted-foreground">Necessario</p>
                    <p className="text-lg font-bold">€{Number(dashboard.capitaleNecessario ?? 0).toLocaleString("it-IT")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Shield className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-muted-foreground">Copertura</p>
                    <p className="text-lg font-bold">{Number(dashboard.coperturaMedia ?? 0).toFixed(0)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-xs text-muted-foreground">Saldo Conti</p>
                    <p className="text-lg font-bold">€{Number(dashboard.saldoConti ?? 0).toLocaleString("it-IT")}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardContent className="p-3">
                  <p className="text-sm font-medium mb-2">Copertura Totale</p>
                  <Progress value={Math.min(Number(dashboard.coperturaMedia ?? 0), 100)} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {dashboard.plans?.length ?? 0} piani attivi • €{Number(dashboard.versamentoMensileEffettivo ?? 0).toLocaleString("it-IT")}/mese
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Piani */}
        <TabsContent value="piani" className="px-4 py-3 space-y-3">
          <Button size="sm" onClick={() => setShowCreatePlan(true)} className="w-full"><Plus className="w-4 h-4 mr-1" />Nuovo Piano</Button>
          {plans?.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{p.nome}</h3>
                    <p className="text-xs text-muted-foreground">Scadenza: {String(p.dataSostituzione ?? '')}</p>
                  </div>
                  <Badge variant={Number(p.percentualeCopertura) >= 80 ? "default" : Number(p.percentualeCopertura) >= 50 ? "secondary" : "destructive"}>
                    {Number(p.percentualeCopertura ?? 0).toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={Math.min(Number(p.percentualeCopertura ?? 0), 100)} className="h-2 mb-2" />
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Accantonato: €{Number(p.capitaleAccantonato ?? 0).toLocaleString("it-IT")}</span>
                  <span>Obiettivo: €{Number(p.valoreSostituzione ?? 0).toLocaleString("it-IT")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!plans || plans.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nessun piano di reintegrazione</p>
            </div>
          )}
        </TabsContent>

        {/* Conti */}
        <TabsContent value="conti" className="px-4 py-3 space-y-3">
          <Button size="sm" onClick={() => setShowCreateAccount(true)} className="w-full"><Plus className="w-4 h-4 mr-1" />Nuovo Conto</Button>
          {accounts?.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4" />Conto Deposito
                    </h3>
                    <p className="text-xs text-muted-foreground">Tasso: {Number(a.tassoInteresse ?? 0).toFixed(2)}% • {a.periodicita}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <span>Versato: €{Number(a.capitaleVersato ?? 0).toLocaleString("it-IT")}</span>
                  <span>Interessi: €{Number(a.interesseNetto ?? 0).toLocaleString("it-IT")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!accounts || accounts.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nessun conto deposito configurato</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet Crea Piano */}
      <Sheet open={showCreatePlan} onOpenChange={setShowCreatePlan}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Nuovo Piano Reintegrazione</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Nome</Label><Input value={planForm.nome} onChange={e => setPlanForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Trattore John Deere" /></div>
            <div><Label>Valore Sostituzione (€)</Label><Input type="number" value={planForm.valoreSostituzione} onChange={e => setPlanForm(f => ({ ...f, valoreSostituzione: e.target.value }))} /></div>
            <div><Label>Data Sostituzione</Label><Input type="date" value={planForm.dataSostituzione} onChange={e => setPlanForm(f => ({ ...f, dataSostituzione: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vita Utile (anni)</Label><Input type="number" value={planForm.vitaUtile} onChange={e => setPlanForm(f => ({ ...f, vitaUtile: e.target.value }))} /></div>
              <div><Label>Valore Residuo (€)</Label><Input type="number" value={planForm.valoreResiduo} onChange={e => setPlanForm(f => ({ ...f, valoreResiduo: e.target.value }))} /></div>
            </div>
            <div><Label>Accantonamento Mensile (€)</Label><Input type="number" value={planForm.accantonamentoMensileEffettivo} onChange={e => setPlanForm(f => ({ ...f, accantonamentoMensileEffettivo: e.target.value }))} placeholder="Lascia vuoto per calcolo automatico" /></div>
            <div>
              <Label>Priorità</Label>
              <Select value={planForm.priorita} onValueChange={v => setPlanForm(f => ({ ...f, priorita: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="bassa">Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Note</Label><Textarea value={planForm.note} onChange={e => setPlanForm(f => ({ ...f, note: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleCreatePlan} disabled={!planForm.nome || !planForm.valoreSostituzione || !planForm.dataSostituzione || createPlanMut.isPending}>
              {createPlanMut.isPending ? "Creazione..." : "Crea Piano"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet Crea Conto */}
      <Sheet open={showCreateAccount} onOpenChange={setShowCreateAccount}>
        <SheetContent side="bottom" className="h-[50vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Nuovo Conto Deposito</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Tasso Interesse (%)</Label><Input type="number" step="0.01" value={accForm.tassoInteresse} onChange={e => setAccForm(f => ({ ...f, tassoInteresse: e.target.value }))} /></div>
            <div>
              <Label>Periodicità Interessi</Label>
              <Select value={accForm.periodicita} onValueChange={v => setAccForm(f => ({ ...f, periodicita: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensile">Mensile</SelectItem>
                  <SelectItem value="trimestrale">Trimestrale</SelectItem>
                  <SelectItem value="semestrale">Semestrale</SelectItem>
                  <SelectItem value="annuale">Annuale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Note</Label><Textarea value={accForm.note} onChange={e => setAccForm(f => ({ ...f, note: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleCreateAccount} disabled={createAccountMut.isPending}>
              {createAccountMut.isPending ? "Creazione..." : "Crea Conto"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Target(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
