import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getUserErrorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Movimento = {
  id: string;
  tipo: "entrata" | "uscita";
  stato: string;
  totale: number;
  totalePagato?: number | null;
  descrizione?: string | null;
  codiceInterno?: string | null;
};

type EditForm = {
  tipo: "entrata" | "uscita";
  totale: string;
  aliquotaIva: string;
  dataDocumento: string;
  dataCompetenza: string;
  dataScadenza: string;
  categoriaId: string;
  centroCostoId: string;
  soggettoId: string;
  tipoDocumento: string;
  numero: string;
  descrizione: string;
  note: string;
};

const EMPTY_FORM: EditForm = {
  tipo: "uscita",
  totale: "",
  aliquotaIva: "22",
  dataDocumento: "",
  dataCompetenza: "",
  dataScadenza: "",
  categoriaId: "",
  centroCostoId: "__none__",
  soggettoId: "__none__",
  tipoDocumento: "generico",
  numero: "",
  descrizione: "",
  note: "",
};

const dateInput = (value: unknown) => {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
};

export function MovimentoActions({ movimento }: { movimento: Movimento }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const utils = trpc.useUtils();

  const detailQuery = trpc.finanza.movimenti.detail.useQuery(
    { id: movimento.id },
    { enabled: editOpen },
  );
  const categoriesQuery = trpc.finanza.categorie.list.useQuery(undefined, { enabled: editOpen });
  const costCentersQuery = trpc.finanza.centriCosto.list.useQuery(undefined, { enabled: editOpen });
  const subjectsQuery = trpc.finanza.soggetti.list.useQuery(undefined, { enabled: editOpen });

  const detail = detailQuery.data;
  const hasConfirmedPayments = Boolean(
    Number(detail?.totalePagato ?? movimento.totalePagato ?? 0) > 0
    || detail?.pagamenti?.some((payment: any) => payment.stato === "confermato"),
  );

  useEffect(() => {
    if (!editOpen || !detail) return;
    setForm({
      tipo: detail.tipo as "entrata" | "uscita",
      totale: (Number(detail.totale) / 100).toFixed(2),
      aliquotaIva: (Number(detail.aliquotaIva) / 100).toString(),
      dataDocumento: dateInput(detail.dataDocumento),
      dataCompetenza: dateInput(detail.dataCompetenza ?? detail.dataDocumento),
      dataScadenza: dateInput(detail.scadenze?.[0]?.dataScadenza),
      categoriaId: detail.categoriaId,
      centroCostoId: detail.centroCostoId ?? "__none__",
      soggettoId: detail.soggettoId ?? "__none__",
      tipoDocumento: detail.tipoDocumento ?? "generico",
      numero: detail.numero ?? "",
      descrizione: detail.descrizione ?? "",
      note: detail.note ?? "",
    });
  }, [detail, editOpen]);

  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category: any) => category.tipo === form.tipo || category.tipo === "entrambi"),
    [categoriesQuery.data, form.tipo],
  );

  const updateMutation = trpc.finanza.movimenti.update.useMutation({
    onSuccess: async () => {
      await utils.finanza.invalidate();
      toast.success("Movimento aggiornato");
      setEditOpen(false);
    },
    onError: (error) => toast.error(getUserErrorMessage(error)),
  });

  const deleteMutation = trpc.finanza.movimenti.delete.useMutation({
    onSuccess: async (result) => {
      await utils.finanza.invalidate();
      toast.success(result.storniCreati > 0 ? "Movimento eliminato e saldo stornato" : "Movimento eliminato");
      setDeleteOpen(false);
      setMotivo("");
    },
    onError: (error) => toast.error(getUserErrorMessage(error)),
  });

  const submitUpdate = () => {
    if (!detail) return;
    if (!form.descrizione.trim()) return toast.error("Inserisci una descrizione");
    if (!form.categoriaId) return toast.error("Seleziona una categoria");

    const common = {
      id: movimento.id,
      dataDocumento: form.dataDocumento,
      dataCompetenza: form.dataCompetenza || null,
      categoriaId: form.categoriaId,
      centroCostoId: form.centroCostoId === "__none__" ? null : form.centroCostoId,
      soggettoId: form.soggettoId === "__none__" ? null : form.soggettoId,
      tipoDocumento: form.tipoDocumento || null,
      numero: form.numero || null,
      descrizione: form.descrizione.trim(),
      note: form.note || null,
    };

    if (hasConfirmedPayments) {
      updateMutation.mutate(common);
      return;
    }

    const totale = Math.round(Number(form.totale.replace(",", ".")) * 100);
    const aliquotaIva = Math.round(Number(form.aliquotaIva.replace(",", ".")) * 100);
    if (!Number.isFinite(totale) || totale <= 0) return toast.error("Inserisci un totale valido");
    if (!Number.isFinite(aliquotaIva) || aliquotaIva < 0) return toast.error("Inserisci un’aliquota IVA valida");
    const imponibile = Math.round((totale * 10_000) / (10_000 + aliquotaIva));

    updateMutation.mutate({
      ...common,
      tipo: form.tipo,
      imponibile,
      aliquotaIva,
      importoIva: totale - imponibile,
      totale,
      dataScadenza: form.dataScadenza || null,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Azioni per ${movimento.descrizione || movimento.codiceInterno || "movimento"}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" /> Modifica
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 size-4" /> Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-8">
          <SheetHeader>
            <SheetTitle>Modifica movimento</SheetTitle>
          </SheetHeader>
          {detailQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>
          ) : (
            <div className="mt-5 space-y-4">
              {hasConfirmedPayments && (
                <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>Questo movimento è già regolato: importo, tipo e IVA sono bloccati. Puoi modificare classificazione e descrizione.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select value={form.tipo} disabled={hasConfirmedPayments} onValueChange={(value: "entrata" | "uscita") => setForm({ ...form, tipo: value, categoriaId: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="entrata">Entrata</SelectItem><SelectItem value="uscita">Uscita</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Totale €">
                  <Input inputMode="decimal" disabled={hasConfirmedPayments} value={form.totale} onChange={(event) => setForm({ ...form, totale: event.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Aliquota IVA %">
                  <Input inputMode="decimal" disabled={hasConfirmedPayments} value={form.aliquotaIva} onChange={(event) => setForm({ ...form, aliquotaIva: event.target.value })} />
                </Field>
                <Field label="Data documento">
                  <Input type="date" value={form.dataDocumento} onChange={(event) => setForm({ ...form, dataDocumento: event.target.value })} />
                </Field>
              </div>

              <Field label="Descrizione *">
                <Input value={form.descrizione} onChange={(event) => setForm({ ...form, descrizione: event.target.value })} />
              </Field>
              <Field label="Categoria *">
                <Select value={form.categoriaId} onValueChange={(value) => setForm({ ...form, categoriaId: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                  <SelectContent>{categories.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Soggetto">
                  <Select value={form.soggettoId} onValueChange={(value) => setForm({ ...form, soggettoId: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">Nessuno</SelectItem>{(subjectsQuery.data ?? []).map((subject: any) => <SelectItem key={subject.id} value={subject.id}>{subject.nomeBreve || subject.ragioneSociale}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Centro di costo">
                  <Select value={form.centroCostoId} onValueChange={(value) => setForm({ ...form, centroCostoId: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">Nessuno</SelectItem>{(costCentersQuery.data ?? []).map((center: any) => <SelectItem key={center.id} value={center.id}>{center.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data competenza"><Input type="date" value={form.dataCompetenza} onChange={(event) => setForm({ ...form, dataCompetenza: event.target.value })} /></Field>
                {detail?.scadenze?.length === 1 && (
                  <Field label="Data scadenza"><Input type="date" disabled={hasConfirmedPayments} value={form.dataScadenza} onChange={(event) => setForm({ ...form, dataScadenza: event.target.value })} /></Field>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo documento"><Input value={form.tipoDocumento} onChange={(event) => setForm({ ...form, tipoDocumento: event.target.value })} /></Field>
                <Field label="Numero"><Input value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} /></Field>
              </div>
              <Field label="Note"><Textarea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
              <Button className="h-12 w-full" disabled={updateMutation.isPending} onClick={submitUpdate}>
                {updateMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Pencil className="mr-2 size-4" />}
                Salva modifiche
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo movimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {Number(movimento.totalePagato ?? 0) > 0
                ? "Il movimento è già regolato: verrà creato automaticamente uno storno sul conto e il record sarà archiviato."
                : "Il movimento e le registrazioni collegate saranno archiviati. Questa azione non può essere annullata dall’interfaccia."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`delete-reason-${movimento.id}`}>Motivo (facoltativo)</Label>
            <Textarea id={`delete-reason-${movimento.id}`} rows={2} value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Es. inserimento duplicato" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate({ id: movimento.id, motivo: motivo || undefined });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              Elimina movimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
