import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp,
  Plus, Wallet, CreditCard, Building2, Receipt, Check,
} from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const RED = "oklch(0.55 0.22 25)";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

type TipoRegistrazione = "pagato_subito" | "documento";

export default function NuovoMovimento() {
  const [, setLocation] = useLocation();
  const [tipo, setTipo] = useState<"entrata" | "uscita">("uscita");
  const [tipoRegistrazione, setTipoRegistrazione] = useState<TipoRegistrazione>("pagato_subito");
  const [importoStr, setImportoStr] = useState("");
  const [aliquotaIva, setAliquotaIva] = useState(2200);
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [soggettoId, setSoggettoId] = useState("");
  const [contoId, setContoId] = useState("");
  const [metodoId, setMetodoId] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [note, setNote] = useState("");
  const [dataDocumento, setDataDocumento] = useState(new Date().toISOString().split("T")[0]);
  const [dataScadenza, setDataScadenza] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [numero, setNumero] = useState("");
  const [showDettagli, setShowDettagli] = useState(false);
  const [showNewSoggetto, setShowNewSoggetto] = useState(false);
  const [newSoggettoNome, setNewSoggettoNome] = useState("");

  // Queries
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery({ tipo });
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();
  const { data: soggettiList = [] } = trpc.finanza.soggetti.list.useQuery({
    tipologia: tipo === "entrata" ? "cliente" : "fornitore",
  });

  // Seed automatico
  trpc.finanza.seed.useMutation();

  // Calcoli IVA
  const importoCents = useMemo(() => {
    const val = parseFloat(importoStr.replace(",", "."));
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [importoStr]);

  const calcoloIva = useMemo(() => {
    if (importoCents <= 0) return { imponibile: 0, importoIva: 0, totale: 0 };
    // Importo inserito = imponibile, calcoliamo IVA sopra
    const iva = Math.round((importoCents * aliquotaIva) / 10000);
    return { imponibile: importoCents, importoIva: iva, totale: importoCents + iva };
  }, [importoCents, aliquotaIva]);

  // Saldo conto selezionato
  const contoSelezionato = useMemo(() => conti.find((c: any) => c.id === contoId), [conti, contoId]);

  // Mutations
  const createMutation = trpc.finanza.movimenti.create.useMutation({
    onSuccess: () => {
      toast.success(tipo === "entrata" ? "Entrata registrata" : "Uscita registrata");
      setLocation("/finanza");
    },
    onError: (e) => toast.error(e.message || "Errore"),
  });

  const createSoggettoMutation = trpc.finanza.soggetti.create.useMutation({
    onSuccess: (data) => {
      setSoggettoId(data.id);
      setShowNewSoggetto(false);
      setNewSoggettoNome("");
      toast.success("Soggetto creato");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!categoriaId) { toast.error("Seleziona una categoria"); return; }
    if (importoCents <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (tipoRegistrazione === "pagato_subito" && !contoId) { toast.error("Seleziona un conto"); return; }

    createMutation.mutate({
      tipo,
      tipoRegistrazione,
      imponibile: calcoloIva.imponibile,
      aliquotaIva,
      importoIva: calcoloIva.importoIva,
      totale: calcoloIva.totale,
      dataDocumento,
      dataScadenza: tipoRegistrazione === "documento" ? (dataScadenza || dataDocumento) : undefined,
      categoriaId,
      centroCostoId: centroCostoId || undefined,
      soggettoId: soggettoId || undefined,
      contoId: contoId || undefined,
      metodoId: metodoId || undefined,
      tipoDocumento: tipoDocumento || undefined,
      numero: numero || undefined,
      descrizione: descrizione || undefined,
      note: note || undefined,
    });
  }, [tipo, tipoRegistrazione, calcoloIva, categoriaId, centroCostoId, soggettoId, contoId, metodoId, dataDocumento, dataScadenza, tipoDocumento, numero, descrizione, note, aliquotaIva, importoCents, createMutation]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/finanza")} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Nuovo Movimento</h1>
      </div>

      <div className="px-4 pt-4 space-y-5 max-w-lg mx-auto">
        {/* ── Selettore Entrata / Uscita ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTipo("entrata")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold ${
              tipo === "entrata"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                : "border-muted bg-muted/30 text-muted-foreground"
            }`}
          >
            <ArrowDownRight className="w-5 h-5" />
            Entrata
          </button>
          <button
            onClick={() => setTipo("uscita")}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold ${
              tipo === "uscita"
                ? "border-red-500 bg-red-500/10 text-red-600"
                : "border-muted bg-muted/30 text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="w-5 h-5" />
            Uscita
          </button>
        </div>

        {/* ── Importo grande ── */}
        <div className="text-center py-2">
          <Label className="text-sm text-muted-foreground mb-1 block">Importo (imponibile)</Label>
          <div className="relative inline-flex items-center">
            <span className="text-3xl font-light text-muted-foreground mr-1">€</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={importoStr}
              onChange={(e) => setImportoStr(e.target.value)}
              className="text-4xl font-bold text-center bg-transparent border-none outline-none w-48"
              style={{ color: tipo === "entrata" ? GREEN : RED }}
            />
          </div>
          {calcoloIva.totale > 0 && aliquotaIva > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              + IVA {(aliquotaIva / 100).toFixed(0)}% = <strong>{fmtCents(calcoloIva.totale)}</strong>
            </p>
          )}
        </div>

        {/* ── Aliquota IVA ── */}
        <div>
          <Label className="text-sm">Aliquota IVA</Label>
          <div className="flex gap-2 mt-1">
            {[0, 400, 500, 1000, 2200].map((aliq) => (
              <button
                key={aliq}
                onClick={() => setAliquotaIva(aliq)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  aliquotaIva === aliq
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {aliq === 0 ? "Esente" : `${(aliq / 100).toFixed(0)}%`}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tipo registrazione ── */}
        <div>
          <Label className="text-sm">Tipo registrazione</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => setTipoRegistrazione("pagato_subito")}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                tipoRegistrazione === "pagato_subito"
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-medium">Pagato subito</span>
            </button>
            <button
              onClick={() => setTipoRegistrazione("documento")}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                tipoRegistrazione === "documento"
                  ? "border-primary bg-primary/5"
                  : "border-muted"
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-xs font-medium">Da {tipo === "entrata" ? "incassare" : "pagare"}</span>
            </button>
          </div>
        </div>

        {/* ── Categoria ── */}
        <div>
          <Label className="text-sm">Categoria *</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Seleziona categoria" />
            </SelectTrigger>
            <SelectContent>
              {(categorie as any[]).filter((c: any) => c.attivo).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.colore }} />
                    {c.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Conto (per pagato_subito) ── */}
        {tipoRegistrazione === "pagato_subito" && (
          <div>
            <Label className="text-sm">Conto *</Label>
            <Select value={contoId} onValueChange={setContoId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona conto" />
              </SelectTrigger>
              <SelectContent>
                {(conti as any[]).filter((c: any) => c.attivo).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {c.tipo === "bancario" ? <Building2 className="w-4 h-4" /> :
                       c.tipo === "carta" ? <CreditCard className="w-4 h-4" /> :
                       <Wallet className="w-4 h-4" />}
                      {c.nome}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {fmtCents(c.saldoAttuale)}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contoSelezionato && calcoloIva.totale > 0 && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo attuale</span>
                  <span className="font-medium">{fmtCents((contoSelezionato as any).saldoAttuale)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Dopo operazione</span>
                  <span className="font-semibold" style={{ color: tipo === "entrata" ? GREEN : RED }}>
                    {fmtCents((contoSelezionato as any).saldoAttuale + (tipo === "entrata" ? calcoloIva.totale : -calcoloIva.totale))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Scadenza (per documento) ── */}
        {tipoRegistrazione === "documento" && (
          <div>
            <Label className="text-sm">Data scadenza</Label>
            <Input
              type="date"
              value={dataScadenza}
              onChange={(e) => setDataScadenza(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {/* ── Data ── */}
        <div>
          <Label className="text-sm">Data</Label>
          <Input
            type="date"
            value={dataDocumento}
            onChange={(e) => setDataDocumento(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* ── Descrizione ── */}
        <div>
          <Label className="text-sm">Descrizione</Label>
          <Input
            placeholder="Es: Acquisto mangimi"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* ── Sezione espandibile "Altri dettagli" ── */}
        <button
          onClick={() => setShowDettagli(!showDettagli)}
          className="flex items-center gap-2 text-sm text-muted-foreground w-full py-2"
        >
          {showDettagli ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Altri dettagli
        </button>

        {showDettagli && (
          <div className="space-y-4 pl-1 border-l-2 border-muted ml-2">
            {/* Soggetto */}
            <div className="pl-3">
              <Label className="text-sm">Soggetto</Label>
              <div className="flex gap-2 mt-1">
                <Select value={soggettoId} onValueChange={setSoggettoId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={tipo === "entrata" ? "Cliente" : "Fornitore"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(soggettiList as any[]).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nomeBreve || s.ragioneSociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowNewSoggetto(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Centro di costo */}
            <div className="pl-3">
              <Label className="text-sm">Centro di costo</Label>
              <Select value={centroCostoId} onValueChange={setCentroCostoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Opzionale" />
                </SelectTrigger>
                <SelectContent>
                  {(centriCosto as any[]).filter((c: any) => c.attivo).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: c.colore }} />
                        {c.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Metodo pagamento */}
            {tipoRegistrazione === "pagato_subito" && (
              <div className="pl-3">
                <Label className="text-sm">Metodo pagamento</Label>
                <Select value={metodoId} onValueChange={setMetodoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Opzionale" />
                  </SelectTrigger>
                  <SelectContent>
                    {(metodi as any[]).filter((m: any) => m.attivo).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tipo documento e numero */}
            <div className="pl-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Tipo doc.</Label>
                <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Generico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fattura">Fattura</SelectItem>
                    <SelectItem value="ricevuta">Ricevuta</SelectItem>
                    <SelectItem value="nota_credito">Nota credito</SelectItem>
                    <SelectItem value="generico">Generico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Numero</Label>
                <Input
                  placeholder="N. doc"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Note */}
            <div className="pl-3">
              <Label className="text-sm">Note</Label>
              <Textarea
                placeholder="Note aggiuntive..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* ── Riepilogo ── */}
        {calcoloIva.totale > 0 && (
          <div className="rounded-xl border p-4 space-y-2 bg-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Imponibile</span>
              <span>{fmtCents(calcoloIva.imponibile)}</span>
            </div>
            {aliquotaIva > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA {(aliquotaIva / 100).toFixed(0)}%</span>
                <span>{fmtCents(calcoloIva.importoIva)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Totale</span>
              <span style={{ color: tipo === "entrata" ? GREEN : RED }}>
                {fmtCents(calcoloIva.totale)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Pulsante conferma fisso in basso ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || importoCents <= 0 || !categoriaId}
          className="w-full h-12 text-base font-semibold rounded-xl"
          style={{ background: tipo === "entrata" ? GREEN : RED }}
        >
          {createMutation.isPending ? "Salvataggio..." : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Conferma {tipo === "entrata" ? "Entrata" : "Uscita"}
              {calcoloIva.totale > 0 && ` • ${fmtCents(calcoloIva.totale)}`}
            </>
          )}
        </Button>
      </div>

      {/* ── Sheet creazione rapida soggetto ── */}
      <Sheet open={showNewSoggetto} onOpenChange={setShowNewSoggetto}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Nuovo {tipo === "entrata" ? "Cliente" : "Fornitore"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div>
              <Label>Ragione sociale *</Label>
              <Input
                value={newSoggettoNome}
                onChange={(e) => setNewSoggettoNome(e.target.value)}
                placeholder="Es: Agriforniture Rossi"
              />
            </div>
            <Button
              className="w-full"
              disabled={!newSoggettoNome || createSoggettoMutation.isPending}
              onClick={() => {
                createSoggettoMutation.mutate({
                  tipologia: tipo === "entrata" ? "cliente" : "fornitore",
                  ragioneSociale: newSoggettoNome,
                });
              }}
            >
              Crea e seleziona
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
