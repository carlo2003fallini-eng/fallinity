import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard, FileText, Link2, XCircle,
  ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

interface Props {
  proposal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function ProposalConvertSheet({ proposal, open, onOpenChange, onSuccess }: Props) {
  const [action, setAction] = useState<"pagamento" | "documento" | "collega" | "ignora">("pagamento");
  const [note, setNote] = useState("");
  const [motivo, setMotivo] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [dataScadenza, setDataScadenza] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("fattura");
  const [numero, setNumero] = useState("");

  // Conti e metodi per pagamento
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery({ tipo: proposal?.tipo });
  const [contoId, setContoId] = useState("");
  const [metodoId, setMetodoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");

  const convertPayment = trpc.finanza.proposte.convertToPayment.useMutation({
    onSuccess: () => { toast.success("Proposta convertita in pagamento"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const convertDocument = trpc.finanza.proposte.convertToDocument.useMutation({
    onSuccess: () => { toast.success("Proposta convertita in documento"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const linkMutation = trpc.finanza.proposte.link.useMutation({
    onSuccess: () => { toast.success("Proposta collegata"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  const ignoreMutation = trpc.finanza.proposte.ignore.useMutation({
    onSuccess: () => { toast.success("Proposta ignorata"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  if (!proposal) return null;

  const isLoading = convertPayment.isPending || convertDocument.isPending || linkMutation.isPending || ignoreMutation.isPending;

  const handleSubmit = () => {
    if (action === "pagamento") {
      if (!contoId) { toast.error("Seleziona un conto"); return; }
      convertPayment.mutate({
        proposalId: proposal.id,
        contoId,
        metodoId: metodoId || undefined,
        categoriaId: categoriaId || undefined,
        note: note || undefined,
      });
    } else if (action === "documento") {
      if (!dataScadenza) { toast.error("Inserisci la data di scadenza"); return; }
      convertDocument.mutate({
        proposalId: proposal.id,
        dataScadenza,
        tipoDocumento: tipoDocumento || undefined,
        numero: numero || undefined,
        categoriaId: categoriaId || undefined,
        note: note || undefined,
      });
    } else if (action === "collega") {
      if (!documentoId) { toast.error("Inserisci l'ID del documento"); return; }
      linkMutation.mutate({
        proposalId: proposal.id,
        documentoFinanziarioId: documentoId,
      });
    } else if (action === "ignora") {
      if (!motivo) { toast.error("Inserisci il motivo"); return; }
      ignoreMutation.mutate({
        proposalId: proposal.id,
        motivo,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            {proposal.tipo === "entrata" ? (
              <ArrowDownRight className="w-5 h-5 text-emerald-500" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-red-500" />
            )}
            <span className="truncate">{proposal.descrizione}</span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{proposal.originModule}</Badge>
            <span>{fmtCents(Number(proposal.importo))}</span>
            <span>·</span>
            <span>{new Date(proposal.dataOrigine).toLocaleDateString("it-IT")}</span>
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-3" />

        {/* Azione */}
        <Tabs value={action} onValueChange={(v) => setAction(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="pagamento" className="gap-1 text-xs flex-1">
              <CreditCard className="w-3.5 h-3.5" />
              Già pagato
            </TabsTrigger>
            <TabsTrigger value="documento" className="gap-1 text-xs flex-1">
              <FileText className="w-3.5 h-3.5" />
              Documento
            </TabsTrigger>
            <TabsTrigger value="collega" className="gap-1 text-xs flex-1">
              <Link2 className="w-3.5 h-3.5" />
              Collega
            </TabsTrigger>
            <TabsTrigger value="ignora" className="gap-1 text-xs flex-1">
              <XCircle className="w-3.5 h-3.5" />
              Ignora
            </TabsTrigger>
          </TabsList>

          {/* Pagamento immediato */}
          <TabsContent value="pagamento" className="mt-4 flex flex-col gap-3">
            <div>
              <Label className="text-xs">Conto *</Label>
              <Select value={contoId} onValueChange={setContoId}>
                <SelectTrigger><SelectValue placeholder="Seleziona conto" /></SelectTrigger>
                <SelectContent>
                  {(conti as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Metodo pagamento</Label>
              <Select value={metodoId} onValueChange={setMetodoId}>
                <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                <SelectContent>
                  {(metodi as any[]).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Usa default" /></SelectTrigger>
                <SelectContent>
                  {(categorie as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note opzionali" rows={2} />
            </div>
          </TabsContent>

          {/* Documento con scadenza */}
          <TabsContent value="documento" className="mt-4 flex flex-col gap-3">
            <div>
              <Label className="text-xs">Data scadenza *</Label>
              <Input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo documento</Label>
              <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fattura">Fattura</SelectItem>
                  <SelectItem value="nota_credito">Nota di credito</SelectItem>
                  <SelectItem value="ricevuta">Ricevuta</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Numero documento</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Es. FT-2026/001" />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Usa default" /></SelectTrigger>
                <SelectContent>
                  {(categorie as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note opzionali" rows={2} />
            </div>
          </TabsContent>

          {/* Collega a documento esistente */}
          <TabsContent value="collega" className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Collega questa proposta a un documento finanziario già registrato manualmente.
            </p>
            <div>
              <Label className="text-xs">ID documento finanziario *</Label>
              <Input value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} placeholder="Incolla l'ID del documento" />
            </div>
          </TabsContent>

          {/* Ignora */}
          <TabsContent value="ignora" className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Ignora questa proposta. Non verrà creato alcun movimento finanziario.
            </p>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Perché ignori questa proposta?" rows={3} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit */}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Elaborazione..." : "Conferma"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
