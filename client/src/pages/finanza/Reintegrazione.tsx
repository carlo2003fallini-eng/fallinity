import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getUserErrorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  Plus,
  ShieldCheck,
  Target,
  Tractor,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

const GOLD = "oklch(0.72 0.15 75)";
const GREEN = "oklch(0.65 0.18 142)";
const BLUE = "oklch(0.6 0.15 220)";
const PURPLE = "oklch(0.65 0.15 290)";

const fmt = (value: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const today = () => new Date().toISOString().slice(0, 10);

type AccrualPlan = {
  id: string;
  nome: string;
  consigliato: number;
};

export default function ReintegrazionePage() {
  const utils = trpc.useUtils();
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accrualPlan, setAccrualPlan] = useState<AccrualPlan | null>(null);

  const dashboardQuery = trpc.finanza.replacement.dashboard.useQuery();
  const plansQuery = trpc.finanza.replacement.plans.list.useQuery();
  const accountsQuery = trpc.finanza.replacement.accounts.list.useQuery();
  const financialAccountsQuery = trpc.finanza.conti.list.useQuery();
  const machinesQuery = trpc.officina.macchine.list.useQuery();

  const dashboard = dashboardQuery.data;
  const plans = plansQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const financialAccounts = financialAccountsQuery.data ?? [];
  const machines = machinesQuery.data ?? [];
  const isLoading = dashboardQuery.isLoading || plansQuery.isLoading || accountsQuery.isLoading;

  const refreshAll = async () => {
    await Promise.all([
      utils.finanza.replacement.dashboard.invalidate(),
      utils.finanza.replacement.plans.list.invalidate(),
      utils.finanza.replacement.accounts.list.invalidate(),
    ]);
  };

  const createPlan = trpc.finanza.replacement.plans.create.useMutation({
    onSuccess: async () => {
      await refreshAll();
      setShowCreatePlan(false);
      toast.success("Piano di reintegrazione creato");
    },
    onError: (error) => toast.error(getUserErrorMessage(error)),
  });

  const createAccount = trpc.finanza.replacement.accounts.create.useMutation({
    onSuccess: async () => {
      await refreshAll();
      setShowCreateAccount(false);
      toast.success("Conto deposito collegato");
    },
    onError: (error) => toast.error(getUserErrorMessage(error)),
  });

  const accrue = trpc.finanza.replacement.accrue.useMutation({
    onSuccess: async (result) => {
      await refreshAll();
      setAccrualPlan(null);
      toast.success(`Accantonamento registrato · copertura ${Number(result.percentualeCopertura).toFixed(1)}%`);
    },
    onError: (error) => toast.error(getUserErrorMessage(error)),
  });

  const financialAccountNames = useMemo(
    () => new Map(financialAccounts.map((account: any) => [account.id, account.nome])),
    [financialAccounts],
  );

  const hasError = dashboardQuery.isError || plansQuery.isError || accountsQuery.isError;

  return (
    <section className="space-y-5 pb-6" aria-label="Reintegrazione">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="fal-eyebrow mb-1" style={{ color: GOLD }}>Pianificazione patrimoniale</p>
          <h2 className="text-xl font-bold">Fondo Reintegrazione</h2>
          <p className="mt-1 text-xs text-muted-foreground">Piani, fondi e accantonamenti in un unico posto.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreatePlan(true)} style={{ background: GOLD, color: "oklch(0.08 0.006 145)" }}>
          <Plus className="mr-1.5 size-4" /> Piano
        </Button>
      </div>

      {hasError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-red-400">Dati Reintegrazione non disponibili</p>
            <p className="mt-1 text-xs text-muted-foreground">Riprova: nessuna modifica è stata applicata ai tuoi dati.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refreshAll()}>Riprova</Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-card to-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
            <PiggyBank className="size-4" /> Capitale accantonato
          </div>
          {isLoading ? (
            <Skeleton className="mt-3 h-10 w-40" />
          ) : (
            <>
              <p className="mt-2 text-4xl font-bold tracking-tight" style={{ color: GOLD }}>{fmt(Number(dashboard?.capitaleAccantonato ?? 0))}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                su {fmt(Number(dashboard?.capitaleNecessario ?? 0))} necessari · {Number(dashboard?.totalePlans ?? 0)} piani attivi
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={ShieldCheck} label="Copertura" value={`${Number(dashboard?.coperturaMedia ?? 0).toFixed(1)}%`} color={GREEN} loading={isLoading} />
        <MetricCard icon={TrendingUp} label="Versamento/mese" value={fmt(Number(dashboard?.versamentoMensileConsigliato ?? 0))} color={BLUE} loading={isLoading} />
        <MetricCard icon={WalletCards} label="Conti deposito" value={fmt(Number(dashboard?.saldoConti ?? 0))} color={PURPLE} loading={isLoading} />
        <MetricCard icon={CircleDollarSign} label="Interessi" value={fmt(Number(dashboard?.interessiTotali ?? 0))} color={GOLD} loading={isLoading} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Copertura complessiva</span>
            <span className="font-bold" style={{ color: GREEN }}>{Number(dashboard?.coperturaMedia ?? 0).toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(100, Number(dashboard?.coperturaMedia ?? 0))} className="h-2.5" />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Effettivo: {fmt(Number(dashboard?.versamentoMensileEffettivo ?? 0))}/mese</span>
            <span className="text-right">Consigliato: {fmt(Number(dashboard?.versamentoMensileConsigliato ?? 0))}/mese</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Piani di reintegrazione</h3>
            <p className="text-xs text-muted-foreground">Obiettivi e accantonamenti per beni aziendali.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreatePlan(true)}><Plus className="mr-1 size-3.5" /> Nuovo</Button>
        </div>

        {!isLoading && plans.length === 0 ? (
          <EmptyState
            icon={Tractor}
            title="Nessun piano attivo"
            description="Crea il primo piano per pianificare la sostituzione di un mezzo o di un’attrezzatura."
            action="Crea piano"
            onAction={() => setShowCreatePlan(true)}
          />
        ) : (
          plans.map((plan: any) => {
            const coverage = Math.min(100, Number(plan.percentualeCopertura ?? 0));
            const machine = machines.find((item: any) => item.id === plan.macchinaId) as any;
            return (
              <Card key={plan.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-semibold">{plan.nome}</h4>
                        <Badge variant="outline" className="text-[10px] capitalize">{plan.priorita}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {machine?.nome ? `${machine.nome} · ` : ""}obiettivo {String(plan.dataSostituzione ?? "").slice(0, 10)}
                      </p>
                    </div>
                    <span className="text-lg font-bold" style={{ color: coverage >= 75 ? GREEN : GOLD }}>{coverage.toFixed(0)}%</span>
                  </div>
                  <Progress value={coverage} className="my-3 h-2" />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Value label="Accantonato" value={fmt(Number(plan.capitaleAccantonato ?? 0))} />
                    <Value label="Capitale necessario" value={fmt(Number(plan.capitaleNecessario ?? 0))} />
                    <Value label="Mensile consigliato" value={fmt(Number(plan.accantonamentoMensileConsigliato ?? 0))} />
                    <Value label="Mensile impostato" value={fmt(Number(plan.accantonamentoMensileEffettivo ?? 0))} />
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => setAccrualPlan({
                      id: plan.id,
                      nome: plan.nome,
                      consigliato: Number(plan.accantonamentoMensileEffettivo ?? plan.accantonamentoMensileConsigliato ?? 0),
                    })}
                  >
                    <PiggyBank className="mr-2 size-4" /> Registra accantonamento
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Conti deposito</h3>
            <p className="text-xs text-muted-foreground">Fondi reali collegati ai conti finanziari.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreateAccount(true)}><Plus className="mr-1 size-3.5" /> Nuovo</Button>
        </div>

        {!isLoading && accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nessun conto deposito"
            description="Aggiungi un conto per registrare anche i trasferimenti reali dei fondi."
            action="Aggiungi conto"
            onAction={() => setShowCreateAccount(true)}
          />
        ) : (
          accounts.map((account: any) => (
            <Card key={account.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{account.nome}</h4>
                    <p className="text-xs text-muted-foreground">
                      {financialAccountNames.get(account.contoFinanziarioId) ?? "Conto non collegato"}
                    </p>
                  </div>
                  <Badge variant="outline">{Number(account.tassoInteresse ?? 0).toFixed(2)}%</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Value label="Capitale versato" value={fmt(Number(account.capitaleVersato ?? 0))} />
                  <Value label="Capitale vincolato" value={fmt(Number(account.capitaleVincolato ?? 0))} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreatePlanSheet
        open={showCreatePlan}
        onOpenChange={setShowCreatePlan}
        machines={machines}
        pending={createPlan.isPending}
        onSubmit={(input) => createPlan.mutate(input)}
      />
      <CreateAccountSheet
        open={showCreateAccount}
        onOpenChange={setShowCreateAccount}
        financialAccounts={financialAccounts}
        linkedIds={new Set(accounts.map((account: any) => account.contoFinanziarioId).filter(Boolean))}
        pending={createAccount.isPending}
        onSubmit={(input) => createAccount.mutate(input)}
      />
      <AccrualSheet
        plan={accrualPlan}
        onClose={() => setAccrualPlan(null)}
        accounts={accounts}
        pending={accrue.isPending}
        onSubmit={(input) => accrue.mutate(input)}
      />
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, color, loading }: { icon: any; label: string; value: string; color: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <Icon className="mb-2 size-4" style={{ color }} />
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-20" /> : <p className="mt-0.5 text-lg font-bold">{value}</p>}
      </CardContent>
    </Card>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action, onAction }: { icon: any; title: string; description: string; action: string; onAction: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-6 text-center">
        <Icon className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
        <Button size="sm" className="mt-4" onClick={onAction}>{action}</Button>
      </CardContent>
    </Card>
  );
}

function CreatePlanSheet({ open, onOpenChange, machines, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; machines: any[]; pending: boolean; onSubmit: (input: any) => void }) {
  const [form, setForm] = useState({
    nome: "",
    macchinaId: "nessuna",
    valoreSostituzione: "",
    valoreResiduo: "0",
    dataSostituzione: "",
    vitaUtile: "10",
    accantonamentoMensileEffettivo: "",
    priorita: "media",
    rendimento: "0",
    note: "",
  });

  const submit = () => {
    if (!form.nome.trim()) return toast.error("Inserisci il nome del piano");
    if (Number(form.valoreSostituzione) <= 0) return toast.error("Inserisci un valore di sostituzione valido");
    if (!form.dataSostituzione) return toast.error("Inserisci la data di sostituzione");
    onSubmit({
      nome: form.nome.trim(),
      macchinaId: form.macchinaId === "nessuna" ? undefined : form.macchinaId,
      valoreSostituzione: Number(form.valoreSostituzione),
      valoreResiduo: Number(form.valoreResiduo || 0),
      dataSostituzione: form.dataSostituzione,
      vitaUtile: Number(form.vitaUtile || 10),
      accantonamentoMensileEffettivo: form.accantonamentoMensileEffettivo ? Number(form.accantonamentoMensileEffettivo) : undefined,
      priorita: form.priorita,
      rendimento: Number(form.rendimento || 0),
      note: form.note || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto pb-8">
        <SheetHeader><SheetTitle>Nuovo piano di reintegrazione</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <Field label="Nome piano *"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es. Sostituzione trattore" /></Field>
          <Field label="Macchina collegata">
            <Select value={form.macchinaId} onValueChange={(value) => setForm({ ...form, macchinaId: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nessuna">Nessuna macchina</SelectItem>
                {machines.map((machine: any) => <SelectItem key={machine.id} value={machine.id}>{machine.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valore sostituzione € *"><Input inputMode="decimal" value={form.valoreSostituzione} onChange={(e) => setForm({ ...form, valoreSostituzione: e.target.value })} /></Field>
            <Field label="Valore residuo €"><Input inputMode="decimal" value={form.valoreResiduo} onChange={(e) => setForm({ ...form, valoreResiduo: e.target.value })} /></Field>
          </div>
          <Field label="Data sostituzione *"><Input type="date" value={form.dataSostituzione} onChange={(e) => setForm({ ...form, dataSostituzione: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vita utile (anni)"><Input type="number" min="1" value={form.vitaUtile} onChange={(e) => setForm({ ...form, vitaUtile: e.target.value })} /></Field>
            <Field label="Rendimento annuo %"><Input inputMode="decimal" value={form.rendimento} onChange={(e) => setForm({ ...form, rendimento: e.target.value })} /></Field>
          </div>
          <Field label="Accantonamento mensile impostato"><Input inputMode="decimal" value={form.accantonamentoMensileEffettivo} onChange={(e) => setForm({ ...form, accantonamentoMensileEffettivo: e.target.value })} placeholder="Automatico se vuoto" /></Field>
          <Field label="Priorità">
            <Select value={form.priorita} onValueChange={(value) => setForm({ ...form, priorita: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="bassa">Bassa</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Note"><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></Field>
          <Button className="h-12 w-full" disabled={pending} onClick={submit}>{pending ? "Creazione..." : "Crea piano"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateAccountSheet({ open, onOpenChange, financialAccounts, linkedIds, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; financialAccounts: any[]; linkedIds: Set<string>; pending: boolean; onSubmit: (input: any) => void }) {
  const [form, setForm] = useState({ nome: "Conto deposito Reintegrazione", contoFinanziarioId: "nessuno", tassoInteresse: "0", periodicita: "annuale", dataDecorrenza: today(), note: "" });
  const availableAccounts = financialAccounts.filter((account: any) => account.attivo !== false && !linkedIds.has(account.id));

  const submit = () => {
    if (!form.nome.trim()) return toast.error("Inserisci il nome del conto deposito");
    onSubmit({
      nome: form.nome.trim(),
      contoFinanziarioId: form.contoFinanziarioId === "nessuno" ? undefined : form.contoFinanziarioId,
      tassoInteresse: Number(form.tassoInteresse || 0),
      periodicita: form.periodicita,
      dataDecorrenza: form.dataDecorrenza || undefined,
      note: form.note || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto pb-8">
        <SheetHeader><SheetTitle>Nuovo conto deposito</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <Field label="Nome *"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Conto finanziario collegato">
            <Select value={form.contoFinanziarioId} onValueChange={(value) => setForm({ ...form, contoFinanziarioId: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nessuno">Nessun collegamento</SelectItem>
                {availableAccounts.map((account: any) => <SelectItem key={account.id} value={account.id}>{account.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tasso interesse %"><Input inputMode="decimal" value={form.tassoInteresse} onChange={(e) => setForm({ ...form, tassoInteresse: e.target.value })} /></Field>
            <Field label="Periodicità">
              <Select value={form.periodicita} onValueChange={(value) => setForm({ ...form, periodicita: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mensile">Mensile</SelectItem><SelectItem value="trimestrale">Trimestrale</SelectItem><SelectItem value="semestrale">Semestrale</SelectItem><SelectItem value="annuale">Annuale</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Data decorrenza"><Input type="date" value={form.dataDecorrenza} onChange={(e) => setForm({ ...form, dataDecorrenza: e.target.value })} /></Field>
          <Field label="Note"><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></Field>
          <Button className="h-12 w-full" disabled={pending} onClick={submit}>{pending ? "Collegamento..." : "Aggiungi conto"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AccrualSheet({ plan, onClose, accounts, pending, onSubmit }: { plan: AccrualPlan | null; onClose: () => void; accounts: any[]; pending: boolean; onSubmit: (input: any) => void }) {
  const [importo, setImporto] = useState("");
  const [tipo, setTipo] = useState("gestionale");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    const amount = Number(importo || plan?.consigliato || 0);
    if (!plan || amount <= 0) return toast.error("Inserisci un importo valido");
    if (tipo === "trasferimento" && !accountId) return toast.error("Seleziona un conto deposito");
    onSubmit({ planId: plan.id, importo: amount, tipo, replacementAccountId: tipo === "trasferimento" ? accountId : undefined, note: note || undefined });
  };

  return (
    <Sheet open={Boolean(plan)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto pb-8">
        <SheetHeader><SheetTitle>Accantonamento · {plan?.nome}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-muted-foreground">Importo mensile impostato</p>
            <p className="mt-1 text-xl font-bold" style={{ color: GOLD }}>{fmt(plan?.consigliato ?? 0)}</p>
          </div>
          <Field label="Importo € *"><Input inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder={String(plan?.consigliato || "")} /></Field>
          <Field label="Tipo">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gestionale">Accantonamento gestionale</SelectItem>
                <SelectItem value="trasferimento" disabled={accounts.length === 0}>Trasferimento reale su conto deposito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {tipo === "trasferimento" && (
            <Field label="Conto deposito *">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Seleziona conto" /></SelectTrigger>
                <SelectContent>{accounts.map((account: any) => <SelectItem key={account.id} value={account.id}>{account.nome}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></Field>
          <Button className="h-12 w-full" disabled={pending} onClick={submit}>{pending ? "Registrazione..." : "Conferma accantonamento"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
