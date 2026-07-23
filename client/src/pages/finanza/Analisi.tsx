import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BarChart3, Milk, Tractor, Wheat, Users, Building2, Lightbulb } from "lucide-react";
import { Link } from "wouter";

export default function AnalisiPage() {
  const [tab, setTab] = useState("generale");
  const [periodo, setPeriodo] = useState<"mese" | "trimestre" | "semestre" | "anno">("anno");

  const { data: general } = trpc.finanza.analytics.general.useQuery({ periodo });
  const { data: dairy } = trpc.finanza.analytics.dairy.useQuery({ periodo });
  const { data: machinery } = trpc.finanza.analytics.machinery.useQuery({ periodo });
  const { data: crops } = trpc.finanza.analytics.crops.useQuery({ periodo });
  const { data: costCenters } = trpc.finanza.analytics.costCenters.useQuery({ periodo });
  const { data: suppliers } = trpc.finanza.analytics.suppliers.useQuery({ periodo });
  const { data: customers } = trpc.finanza.analytics.customers.useQuery({ periodo });
  const { data: insightsList } = trpc.finanza.insights.list.useQuery();

  const fmt = (v: number | null | undefined) => v != null ? `€${v.toLocaleString("it-IT")}` : "—";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/finanza"><a><ArrowLeft className="w-5 h-5" /></a></Link>
          <h1 className="text-lg font-semibold flex-1">Analisi</h1>
          <Select value={periodo} onValueChange={v => setPeriodo(v as any)}>
            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mese">Mese</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="semestre">Semestre</SelectItem>
              <SelectItem value="anno">Anno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto px-4 pt-2">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="generale" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Generale</TabsTrigger>
            <TabsTrigger value="stalla" className="text-xs"><Milk className="w-3 h-3 mr-1" />Stalla</TabsTrigger>
            <TabsTrigger value="macchinari" className="text-xs"><Tractor className="w-3 h-3 mr-1" />Macchinari</TabsTrigger>
            <TabsTrigger value="campi" className="text-xs"><Wheat className="w-3 h-3 mr-1" />Campi</TabsTrigger>
            <TabsTrigger value="fornitori" className="text-xs"><Building2 className="w-3 h-3 mr-1" />Fornitori</TabsTrigger>
            <TabsTrigger value="clienti" className="text-xs"><Users className="w-3 h-3 mr-1" />Clienti</TabsTrigger>
            <TabsTrigger value="insight" className="text-xs"><Lightbulb className="w-3 h-3 mr-1" />Insight</TabsTrigger>
          </TabsList>
        </div>

        {/* Generale */}
        <TabsContent value="generale" className="px-4 py-3 space-y-3">
          {general && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Ricavi" value={fmt(general.ricavi)} />
                <KpiCard label="Costi" value={fmt(general.costi)} />
                <KpiCard label="Utile" value={fmt(general.utile)} color={Number(general.utile ?? 0) >= 0 ? "green" : "red"} />
                <KpiCard label="Margine" value={general.margine != null ? `${general.margine.toFixed(1)}%` : "—"} />
                <KpiCard label="Liquidità" value={fmt(general.liquidita)} />
                <KpiCard label="Cashflow" value={fmt(general.cashflow)} color={Number(general.cashflow ?? 0) >= 0 ? "green" : "red"} />
                <KpiCard label="Crediti" value={fmt(general.crediti)} />
                <KpiCard label="Debiti" value={fmt(general.debiti)} />
              </div>
              <Card>
                <CardContent className="p-3 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">GG Incasso: </span><span className="font-medium">{general.giorniIncasso ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">GG Pagamento: </span><span className="font-medium">{general.giorniPagamento ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Budget attivi: </span><span className="font-medium">{general.budgetAttivi}</span></div>
                  <div><span className="text-muted-foreground">Cop. Reintegr.: </span><span className="font-medium">{Number(general.coperturaReintegrazione ?? 0).toFixed(0)}%</span></div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Stalla */}
        <TabsContent value="stalla" className="px-4 py-3 space-y-3">
          {dairy && (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Ricavo Latte" value={fmt(dairy.ricavoLatte)} />
              <KpiCard label="Costo Stalla" value={fmt(dairy.costoStalla)} />
              <KpiCard label="Margine" value={fmt(dairy.margine)} color={Number(dairy.margine ?? 0) >= 0 ? "green" : "red"} />
              <KpiCard label="Vacche" value={String(dairy.vacche)} />
              <KpiCard label="Ricavo/Vacca" value={fmt(dairy.ricavoPerVacca)} />
              <KpiCard label="Costo/Vacca" value={fmt(dairy.costoPerVacca)} />
              <KpiCard label="Margine/Vacca" value={fmt(dairy.marginePerVacca)} />
              <KpiCard label="Trattamenti" value={String(dairy.trattamenti)} />
            </div>
          )}
        </TabsContent>

        {/* Macchinari */}
        <TabsContent value="macchinari" className="px-4 py-3 space-y-3">
          {machinery && (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Macchine" value={String(machinery.totaleMacchine)} />
              <KpiCard label="Costo Manut." value={fmt(machinery.costoManutenzione)} />
              <KpiCard label="Interventi" value={String(machinery.interventi)} />
              <KpiCard label="Costo/Macchina" value={fmt(machinery.costoPerMacchina)} />
              <KpiCard label="Freq. Interv." value={machinery.frequenzaInterventi != null ? machinery.frequenzaInterventi.toFixed(1) : "—"} />
              <KpiCard label="Cop. Reintegr." value={`${Number(machinery.coperturaReintegrazione ?? 0).toFixed(0)}%`} />
            </div>
          )}
        </TabsContent>

        {/* Campi */}
        <TabsContent value="campi" className="px-4 py-3 space-y-3">
          {crops && (
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Ettari" value={crops.ettari != null ? `${crops.ettari} ha` : "—"} />
              <KpiCard label="Campi" value={String(crops.numCampi)} />
              <KpiCard label="Costo Totale" value={fmt(crops.costoTotale)} />
              <KpiCard label="Ricavi" value={fmt(crops.ricavi)} />
              <KpiCard label="Costo/Ettaro" value={fmt(crops.costoPerEttaro)} />
              <KpiCard label="Ricavo/Ettaro" value={fmt(crops.ricavoPerEttaro)} />
            </div>
          )}
        </TabsContent>

        {/* Fornitori */}
        <TabsContent value="fornitori" className="px-4 py-3 space-y-3">
          {suppliers?.map((s: any, i: number) => (
            <Card key={s.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{i + 1}. {s.nome}</p>
                  <p className="text-xs text-muted-foreground">{s.movimenti} movimenti</p>
                </div>
                <p className="font-semibold text-sm">{fmt(s.spesa)}</p>
              </CardContent>
            </Card>
          ))}
          {(!suppliers || suppliers.length === 0) && <p className="text-center text-muted-foreground py-8">Nessun fornitore</p>}
        </TabsContent>

        {/* Clienti */}
        <TabsContent value="clienti" className="px-4 py-3 space-y-3">
          {customers?.map((c: any, i: number) => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{i + 1}. {c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.movimenti} movimenti</p>
                </div>
                <p className="font-semibold text-sm text-green-600">{fmt(c.ricavi)}</p>
              </CardContent>
            </Card>
          ))}
          {(!customers || customers.length === 0) && <p className="text-center text-muted-foreground py-8">Nessun cliente</p>}
        </TabsContent>

        {/* Insight */}
        <TabsContent value="insight" className="px-4 py-3 space-y-3">
          {insightsList?.map((ins: any) => (
            <Card key={ins.id} className={ins.letto ? "opacity-60" : ""}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{ins.titolo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ins.messaggio}</p>
                    {ins.azioneSuggerita && (
                      <p className="text-xs text-blue-500 mt-1">→ {ins.azioneSuggerita}</p>
                    )}
                    <Badge variant="outline" className="mt-1 text-xs capitalize">{ins.livelloConfidenza}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!insightsList || insightsList.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nessun insight disponibile</p>
              <p className="text-xs mt-1">Gli insight vengono generati automaticamente</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-bold ${color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
