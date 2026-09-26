import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, History, Landmark, WalletCards,
} from "lucide-react";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

function dateOnly(value: string | Date) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function fmtDate(value: string | Date) {
  const iso = dateOnly(value);
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function RegolarizzaScadenzeStoriche() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const [confermaOpen, setConfermaOpen] = useState(false);
  const [form, setForm] = useState({ contoId: "", metodoId: "__none__", riferimento: "", note: "" });

  const { data: fatture = [], isLoading, isError, error, refetch } = trpc.finanza.pagamenti.storicoInScadenza.useQuery({ limit: 500 });
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();
  const fattureDisponibili = fatture as any[];
  const contiAttivi = (conti as any[]).filter((conto) => conto.attivo !== false);
  const metodiAttivi = (metodi as any[]).filter((metodo) => metodo.attivo !== false);

  useEffect(() => {
    const disponibili = new Set(fattureDisponibili.map((fattura) => fattura.id));
    setSelezionati((correnti) => {
      const aggiornati = correnti.filter((id) => disponibili.has(id));
      return aggiornati.length === correnti.length ? correnti : aggiornati;
    });
  }, [fattureDisponibili]);

  const fattureSelezionate = useMemo(() => {
    const ids = new Set(selezionati);
    return fattureDisponibili.filter((fattura) => ids.has(fattura.id));
  }, [fattureDisponibili, selezionati]);
  const totale = useMemo(
    () => fattureSelezionate.reduce((somma, fattura) => somma + Number(fattura.residuo ?? fattura.totale), 0),
    [fattureSelezionate],
  );
  const tutteSelezionate = fattureDisponibili.length > 0 && fattureSelezionate.length === fattureDisponibili.length;
  const conto = contiAttivi.find((item) => item.id === form.contoId);
  const saldoPrevisto = conto ? Number(conto.saldoAttuale) - totale : null;
  const dateSelezionate = fattureSelezionate.map((fattura) => dateOnly(fattura.scadenzaFinale)).sort();
  const rangeDate = dateSelezionate.length
    ? { prima: dateSelezionate[0], ultima: dateSelezionate[dateSelezionate.length - 1] }
    : null;

  const regolarizza = trpc.finanza.pagamenti.regolarizzaStorico.useMutation({
    onSuccess: async (result) => {
      await utils.finanza.invalidate();
      toast.success(`${result.documentiRegolarizzati} fatture storiche regolarizzate · ${fmtCents(result.totale)}`);
      setSelezionati([]);
      setConfermaOpen(false);
      setForm((corrente) => ({ ...corrente, riferimento: "", note: "" }));
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  const cambiaSelezione = (id: string, checked: boolean) => {
    setSelezionati((correnti) => checked
      ? Array.from(new Set([...correnti, id]))
      : correnti.filter((corrente) => corrente !== id));
  };
  const selezionaTutte = (checked: boolean) => {
    setSelezionati(checked ? fattureDisponibili.map((fattura) => fattura.id) : []);
  };
  const apriConferma = () => {
    if (!fattureSelezionate.length) return toast.error("Seleziona almeno una fattura");
    if (!form.contoId) return toast.error("Seleziona il conto usato per i pagamenti storici");
    setConfermaOpen(true);
  };
  const confermaRegolarizzazione = () => {
    regolarizza.mutate({
      documentoIds: fattureSelezionate.map((fattura) => fattura.id),
      contoId: form.contoId,
      metodoId: form.metodoId === "__none__" ? undefined : form.metodoId,
      riferimento: form.riferimento.trim() || undefined,
      note: form.note.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 border-b border-border/30 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setLocation("/finanza/impostazioni")} aria-label="Torna alle impostazioni finanza">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Impostazioni Finanza</p>
            <h1 className="truncate text-lg font-bold">Regolarizza storico</h1>
          </div>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <Alert className="border-amber-400/30 bg-amber-400/10">
          <History className="size-4 text-amber-300" />
          <AlertTitle className="text-amber-200">Inserimento storico guidato</AlertTitle>
          <AlertDescription>
            Seleziona le fatture passive aperte: per ciascuna verrà usata automaticamente la sua <strong>ultima scadenza ancora aperta</strong>. La data documento non viene modificata.
          </AlertDescription>
        </Alert>

        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-0">
            <div className="flex items-start gap-3 border-b border-border/50 p-4">
              <Checkbox
                id="seleziona-tutte-storico"
                checked={tutteSelezionate}
                onCheckedChange={(checked) => selezionaTutte(checked === true)}
                disabled={isLoading || !fattureDisponibili.length}
                className="mt-1 size-5"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="seleziona-tutte-storico" className="cursor-pointer text-sm font-semibold">Seleziona tutte le fatture in scadenza</label>
                <p className="mt-0.5 text-xs text-muted-foreground">{fattureDisponibili.length} fatture con una scadenza residua disponibile.</p>
              </div>
              {fattureSelezionate.length > 0 && <Badge className="shrink-0 bg-amber-400 text-black">{fattureSelezionate.length}</Badge>}
            </div>

            {isLoading ? (
              <div className="space-y-3 p-4">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}</div>
            ) : isError ? (
              <div className="p-6 text-center">
                <CircleAlert className="mx-auto size-8 text-destructive" />
                <p className="mt-3 text-sm font-medium">Impossibile caricare le fatture</p>
                <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>Riprova</Button>
              </div>
            ) : fattureDisponibili.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto size-9 text-emerald-400" />
                <p className="mt-3 font-semibold">Nessuna fattura da regolarizzare</p>
                <p className="mt-1 text-sm text-muted-foreground">Tutte le fatture di uscita hanno già un saldo chiuso oppure non hanno rate aperte.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {fattureDisponibili.map((fattura) => {
                  const checked = selezionati.includes(fattura.id);
                  const residuo = Number(fattura.residuo ?? fattura.totale);
                  return (
                    <label key={fattura.id} className={`flex cursor-pointer gap-3 p-4 transition-colors ${checked ? "bg-amber-400/5" : "hover:bg-white/[0.025]"}`}>
                      <Checkbox checked={checked} onCheckedChange={(value) => cambiaSelezione(fattura.id, value === true)} className="mt-1 size-5" aria-label={`Seleziona ${fattura.codiceInterno ?? fattura.numero ?? "fattura"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{fattura.codiceInterno ?? fattura.numero ?? "Fattura"}</p>
                            <p className="truncate text-xs text-muted-foreground">{fattura.soggettoNome ?? fattura.descrizione ?? "Fornitore non specificato"}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-red-300">{fmtCents(residuo)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-amber-200"><CalendarDays className="size-3" />Ultima scadenza: {fmtDate(fattura.scadenzaFinale)}</span>
                          {fattura.scadenzeAperte > 1 && <span className="text-muted-foreground">{fattura.scadenzeAperte} rate aperte</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2"><Landmark className="size-4 text-amber-300" /><h2 className="text-sm font-semibold">Dati del pagamento storico</h2></div>
            <div className="space-y-1.5">
              <Label>Conto di addebito *</Label>
              <Select value={form.contoId} onValueChange={(contoId) => setForm((corrente) => ({ ...corrente, contoId }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona il conto" /></SelectTrigger>
                <SelectContent>{contiAttivi.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome} · {fmtCents(Number(item.saldoAttuale))}</SelectItem>)}</SelectContent>
              </Select>
              {conto && <p className={`text-xs ${Number(saldoPrevisto) < 0 ? "text-red-400" : "text-muted-foreground"}`}>Saldo previsto dopo la registrazione: <strong>{fmtCents(Number(saldoPrevisto))}</strong></p>}
            </div>
            <div className="space-y-1.5">
              <Label>Metodo di pagamento</Label>
              <Select value={form.metodoId} onValueChange={(metodoId) => setForm((corrente) => ({ ...corrente, metodoId }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">Non specificato</SelectItem>{metodiAttivi.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Riferimento comune</Label>
              <Input value={form.riferimento} maxLength={100} onChange={(event) => setForm((corrente) => ({ ...corrente, riferimento: event.target.value }))} placeholder="Es. registrazione storico 2025" />
            </div>
            <div className="space-y-1.5">
              <Label>Nota comune</Label>
              <Textarea rows={3} value={form.note} maxLength={1000} onChange={(event) => setForm((corrente) => ({ ...corrente, note: event.target.value }))} placeholder="Facoltativa: verrà salvata su ogni pagamento" />
            </div>
          </CardContent>
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background/95 px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{fattureSelezionate.length} fatture selezionate</p>
            <p className="truncate text-lg font-bold text-amber-200">{fmtCents(totale)}</p>
          </div>
          <Button type="button" className="h-11 bg-amber-400 font-semibold text-black hover:bg-amber-300" disabled={!fattureSelezionate.length || !form.contoId} onClick={apriConferma}>
            <WalletCards className="mr-2 size-4" />Regolarizza
          </Button>
        </div>
      </div>

      <AlertDialog open={confermaOpen} onOpenChange={setConfermaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regolarizzare {fattureSelezionate.length} fatture?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà registrato un pagamento per ogni fattura selezionata, utilizzando la data della sua ultima scadenza aperta. Nessuna data documento verrà modificata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Totale da registrare</span><strong className="text-amber-200">{fmtCents(totale)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Conto</span><strong className="truncate text-right">{conto?.nome ?? "—"}</strong></div>
            {rangeDate && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date applicate</span><strong className="text-right">{fmtDate(rangeDate.prima)}{rangeDate.prima !== rangeDate.ultima ? ` — ${fmtDate(rangeDate.ultima)}` : ""}</strong></div>}
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-muted/40 p-2 text-xs">
            {fattureSelezionate.map((fattura) => <div key={fattura.id} className="flex justify-between gap-3"><span className="truncate">{fattura.codiceInterno ?? fattura.numero ?? "Fattura"} · {fmtDate(fattura.scadenzaFinale)}</span><span className="shrink-0">{fmtCents(Number(fattura.residuo ?? fattura.totale))}</span></div>)}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regolarizza.isPending}>Indietro</AlertDialogCancel>
            <Button type="button" disabled={regolarizza.isPending} onClick={confermaRegolarizzazione} className="bg-amber-400 text-black hover:bg-amber-300">
              {regolarizza.isPending ? "Regolarizzazione..." : "Conferma e registra"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
