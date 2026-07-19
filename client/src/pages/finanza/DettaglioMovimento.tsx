import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowDownRight, ArrowUpRight, Calendar, Receipt,
  Clock, CheckCircle2, XCircle, AlertTriangle, CreditCard,
  Plus, Banknote, SplitSquareVertical, Trash2, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
const fmtDate = (d: string | Date) => {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return String(d); }
};

const statoColors: Record<string, string> = {
  registrato: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pagato: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  incassato: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  parzialmente_regolato: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  scaduto: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  annullato: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  bozza: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const statoLabels: Record<string, string> = {
  registrato: "Da regolare",
  pagato: "Pagato",
  incassato: "Incassato",
  parzialmente_regolato: "Parzialmente regolato",
  scaduto: "Scaduto",
  annullato: "Annullato",
  bozza: "Bozza",
};
const scadenzaStato: Record<string, string> = {
  aperta: "Da pagare",
  parzialmente_pagata: "Parziale",
  pagata: "Pagata",
  incassata: "Incassata",
  scaduta: "Scaduta",
  annullata: "Annullata",
};

export default function DettaglioMovimento() {
  const [, params] = useRoute("/finanza/movimento/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";

  const { data: doc, isLoading, refetch } = trpc.finanza.movimenti.detail.useQuery({ id }, { enabled: !!id });
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();

  // Sheet Registra Pagamento
  const [showPagamento, setShowPagamento] = useState(false);
  const [pagForm, setPagForm] = useState({ importo: "", contoId: "", metodoId: "", data: new Date().toISOString().split("T")[0], scadenzaId: "", note: "" });

  // Sheet Crea Rate
  const [showRate, setShowRate] = useState(false);
  const [rateForm, setRateForm] = useState({ numeroRate: "3", frequenza: "mensile", dataInizio: new Date().toISOString().split("T")[0] });

  // Dialog Annulla
  const [showAnnulla, setShowAnnulla] = useState(false);
  const [motivoAnnulla, setMotivoAnnulla] = useState("");

  const registraPagamento = trpc.finanza.pagamenti.registra.useMutation({
    onSuccess: (res) => {
      toast.success(`Pagamento registrato — residuo: ${fmtCents(res.residuo)}`);
      setShowPagamento(false);
      setPagForm({ importo: "", contoId: "", metodoId: "", data: new Date().toISOString().split("T")[0], scadenzaId: "", note: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const creaRate = trpc.finanza.scadenze.creaRate.useMutation({
    onSuccess: (res) => {
      toast.success(`Create ${res.numeroRate} rate`);
      setShowRate(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const annullaMut = trpc.finanza.movimenti.annulla.useMutation({
    onSuccess: () => {
      toast.success("Documento annullato");
      setShowAnnulla(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Documento non trovato</p>
        <Button variant="ghost" onClick={() => setLocation("/finanza")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Torna alla finanza
        </Button>
      </div>
    );
  }

  const isEntrata = doc.tipo === "entrata";
  const isChiuso = doc.stato === "pagato" || doc.stato === "incassato" || doc.stato === "annullato";
  const residuo = doc.residuo ?? (doc.totale - (doc.totalePagato ?? 0));

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/finanza")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-mono">{doc.codiceInterno ?? "—"}</p>
          <p className="font-semibold truncate">{doc.descrizione || doc.tipoDocumento || "Movimento"}</p>
        </div>
        <Badge className={statoColors[doc.stato] ?? ""}>{statoLabels[doc.stato] ?? doc.stato}</Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Card importo principale */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEntrata ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                  {isEntrata ? <ArrowDownRight className="w-5 h-5 text-emerald-600" /> : <ArrowUpRight className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <p className="text-2xl font-bold">{fmtCents(doc.totale)}</p>
                  <p className="text-xs text-muted-foreground">{isEntrata ? "Entrata" : "Uscita"} — {doc.tipoDocumento ?? "generico"}</p>
                </div>
              </div>
            </div>

            {/* Barra progresso pagamento */}
            {!isChiuso && doc.totalePagato != null && doc.totalePagato > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Pagato: {fmtCents(doc.totalePagato)}</span>
                  <span>Residuo: {fmtCents(residuo)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((doc.totalePagato ?? 0) / doc.totale) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Info aggiuntive */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Data documento</p>
                <p className="font-medium">{fmtDate(doc.dataDocumento)}</p>
              </div>
              {doc.numero && (
                <div>
                  <p className="text-muted-foreground text-xs">N. documento</p>
                  <p className="font-medium">{doc.numero}</p>
                </div>
              )}
              {doc.imponibile != null && (
                <div>
                  <p className="text-muted-foreground text-xs">Imponibile</p>
                  <p className="font-medium">{fmtCents(doc.imponibile)}</p>
                </div>
              )}
              {doc.importoIva != null && doc.importoIva > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs">IVA ({(doc.aliquotaIva ?? 0) / 100}%)</p>
                  <p className="font-medium">{fmtCents(doc.importoIva)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Azioni rapide */}
        {!isChiuso && (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setPagForm(prev => ({ ...prev, importo: String(residuo) }));
                setShowPagamento(true);
              }}
            >
              <Banknote className="w-4 h-4 mr-2" />
              {isEntrata ? "Registra incasso" : "Registra pagamento"}
            </Button>
            <Button variant="outline" onClick={() => setShowRate(true)}>
              <SplitSquareVertical className="w-4 h-4 mr-1" /> Rate
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowAnnulla(true)}>
              <XCircle className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}

        {/* Tabs: Scadenze / Pagamenti */}
        <Tabs defaultValue="scadenze">
          <TabsList className="w-full">
            <TabsTrigger value="scadenze" className="flex-1">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Scadenze ({doc.scadenze?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="pagamenti" className="flex-1">
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Pagamenti ({doc.pagamenti?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scadenze" className="mt-3 space-y-2">
            {(!doc.scadenze || doc.scadenze.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna scadenza</p>
            ) : (
              doc.scadenze.map((s: any, i: number) => (
                <Card key={s.id ?? i} className="border-l-4" style={{ borderLeftColor: s.stato === "aperta" ? "#3b82f6" : s.stato === "pagata" || s.stato === "incassata" ? "#10b981" : s.stato === "parzialmente_pagata" ? "#f59e0b" : "#6b7280" }}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Rata {s.numero ?? i + 1}{s.totaleRate ? `/${s.totaleRate}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(s.dataScadenza)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fmtCents(s.importo)}</p>
                        {s.importoPagato > 0 && (
                          <p className="text-xs text-emerald-600">Pagato: {fmtCents(s.importoPagato)}</p>
                        )}
                        <Badge variant="outline" className="text-xs mt-1">{scadenzaStato[s.stato] ?? s.stato}</Badge>
                      </div>
                    </div>
                    {/* Pulsante paga su scadenza aperta */}
                    {(s.stato === "aperta" || s.stato === "parzialmente_pagata") && !isChiuso && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full text-xs"
                        onClick={() => {
                          const residuoScad = s.residuo ?? (s.importo - (s.importoPagato ?? 0));
                          setPagForm(prev => ({ ...prev, importo: String(residuoScad), scadenzaId: s.id }));
                          setShowPagamento(true);
                        }}
                      >
                        <Banknote className="w-3 h-3 mr-1" /> Paga questa rata
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pagamenti" className="mt-3 space-y-2">
            {(!doc.pagamenti || doc.pagamenti.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun pagamento registrato</p>
            ) : (
              doc.pagamenti.map((p: any, i: number) => (
                <Card key={p.id ?? i}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${p.stato === "annullato" ? "text-muted-foreground" : "text-emerald-500"}`} />
                        <div>
                          <p className="text-sm font-medium">{fmtCents(p.importo)}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(p.data)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {p.riferimento && <p className="text-xs text-muted-foreground">{p.riferimento}</p>}
                        {p.stato === "annullato" && <Badge variant="outline" className="text-xs">Annullato</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Note */}
        {doc.note && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{doc.note}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sheet Registra Pagamento */}
      <Sheet open={showPagamento} onOpenChange={setShowPagamento}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEntrata ? "Registra incasso" : "Registra pagamento"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Importo (centesimi)</Label>
              <Input
                type="number"
                value={pagForm.importo}
                onChange={(e) => setPagForm(prev => ({ ...prev, importo: e.target.value }))}
                placeholder={`Max: ${residuo}`}
              />
              <p className="text-xs text-muted-foreground mt-1">Residuo disponibile: {fmtCents(residuo)}</p>
            </div>
            <div>
              <Label>Conto</Label>
              <Select value={pagForm.contoId} onValueChange={(v) => setPagForm(prev => ({ ...prev, contoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona conto" /></SelectTrigger>
                <SelectContent>
                  {conti.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({fmtCents(c.saldoAttuale)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metodo (opzionale)</Label>
              <Select value={pagForm.metodoId} onValueChange={(v) => setPagForm(prev => ({ ...prev, metodoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona metodo" /></SelectTrigger>
                <SelectContent>
                  {metodi.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={pagForm.data}
                onChange={(e) => setPagForm(prev => ({ ...prev, data: e.target.value }))}
              />
            </div>
            <div>
              <Label>Riferimento / Note</Label>
              <Input
                value={pagForm.note}
                onChange={(e) => setPagForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Es. bonifico #123"
              />
            </div>
            <Button
              className="w-full"
              disabled={!pagForm.importo || !pagForm.contoId || registraPagamento.isPending}
              onClick={() => {
                registraPagamento.mutate({
                  documentoId: id,
                  importo: Number(pagForm.importo),
                  contoId: pagForm.contoId,
                  metodoId: pagForm.metodoId || undefined,
                  data: pagForm.data,
                  scadenzaId: pagForm.scadenzaId || undefined,
                  note: pagForm.note || undefined,
                });
              }}
            >
              {registraPagamento.isPending ? "Registrazione..." : "Conferma pagamento"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet Crea Rate */}
      <Sheet open={showRate} onOpenChange={setShowRate}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Crea piano rate</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Suddividi il residuo di <strong>{fmtCents(residuo)}</strong> in rate automatiche.
            </p>
            <div>
              <Label>Numero rate</Label>
              <Input
                type="number"
                min={2}
                max={120}
                value={rateForm.numeroRate}
                onChange={(e) => setRateForm(prev => ({ ...prev, numeroRate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Frequenza</Label>
              <Select value={rateForm.frequenza} onValueChange={(v) => setRateForm(prev => ({ ...prev, frequenza: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensile">Mensile</SelectItem>
                  <SelectItem value="bimestrale">Bimestrale</SelectItem>
                  <SelectItem value="trimestrale">Trimestrale</SelectItem>
                  <SelectItem value="semestrale">Semestrale</SelectItem>
                  <SelectItem value="annuale">Annuale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data prima rata</Label>
              <Input
                type="date"
                value={rateForm.dataInizio}
                onChange={(e) => setRateForm(prev => ({ ...prev, dataInizio: e.target.value }))}
              />
            </div>
            {Number(rateForm.numeroRate) >= 2 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">Anteprima:</p>
                <p>{Number(rateForm.numeroRate)} rate da ~{fmtCents(Math.floor(residuo / Number(rateForm.numeroRate)))}</p>
              </div>
            )}
            <Button
              className="w-full"
              disabled={Number(rateForm.numeroRate) < 2 || creaRate.isPending}
              onClick={() => {
                creaRate.mutate({
                  documentoId: id,
                  numeroRate: Number(rateForm.numeroRate),
                  frequenza: rateForm.frequenza as any,
                  dataInizio: rateForm.dataInizio,
                });
              }}
            >
              {creaRate.isPending ? "Creazione..." : "Crea rate"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog Annulla */}
      <Dialog open={showAnnulla} onOpenChange={setShowAnnulla}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annulla documento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Questa azione annullerà il documento e stornerà eventuali pagamenti registrati.
          </p>
          <div>
            <Label>Motivo (opzionale)</Label>
            <Input value={motivoAnnulla} onChange={(e) => setMotivoAnnulla(e.target.value)} placeholder="Es. errore di registrazione" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAnnulla(false)}>Indietro</Button>
            <Button
              variant="destructive"
              disabled={annullaMut.isPending}
              onClick={() => annullaMut.mutate({ id, motivo: motivoAnnulla || undefined })}
            >
              Conferma annullamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
