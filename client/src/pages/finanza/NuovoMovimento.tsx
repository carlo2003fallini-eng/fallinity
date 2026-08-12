import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SelectWithQuickCreate, type SelectOption } from "@/components/SelectWithQuickCreate";
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

  // Queries
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery({ tipo });
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();
  const { data: soggettiList = [] } = trpc.finanza.soggetti.list.useQuery({
    tipologia: tipo === "entrata" ? "cliente" : "fornitore",
  });

  const utils = trpc.useUtils();

  // Calcoli IVA
  const importoCents = useMemo(() => {
    const val = parseFloat(importoStr.replace(",", "."));
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [importoStr]);

  const calcoloIva = useMemo(() => {
    if (importoCents <= 0) return { imponibile: 0, importoIva: 0, totale: 0 };
    const iva = Math.round((importoCents * aliquotaIva) / 10000);
    return { imponibile: importoCents, importoIva: iva, totale: importoCents + iva };
  }, [importoCents, aliquotaIva]);

  const contoSelezionato = useMemo(() => (conti as any[]).find((c: any) => c.id === contoId), [conti, contoId]);

  // Mutations
  const createMutation = trpc.finanza.movimenti.create.useMutation({
    onSuccess: () => {
      toast.success(tipo === "entrata" ? "Entrata registrata" : "Uscita registrata");
      setLocation("/finanza");
    },
    onError: (e) => toast.error(e.message || "Errore"),
  });

  const createCategoriaMut = trpc.finanza.categorie.create.useMutation({
    onSuccess: () => { utils.finanza.categorie.invalidate(); },
  });
  const createSoggettoMut = trpc.finanza.soggetti.create.useMutation({
    onSuccess: () => { utils.finanza.soggetti.invalidate(); },
  });
  const createCentroCostoMut = trpc.finanza.centriCosto.create.useMutation({
    onSuccess: () => { utils.finanza.centriCosto.invalidate(); },
  });
  const createContoMut = trpc.finanza.conti.create.useMutation({
    onSuccess: () => { utils.finanza.conti.invalidate(); },
  });
  const createMetodoMut = trpc.finanza.metodi.create.useMutation({
    onSuccess: () => { utils.finanza.metodi.invalidate(); },
  });

  // Options for SelectWithQuickCreate
  const categorieOptions: SelectOption[] = useMemo(() =>
    (categorie as any[]).filter((c: any) => c.attivo !== false).map((c: any) => ({
      id: c.id, label: c.nome, sublabel: c.codice, color: c.colore,
    })), [categorie]);

  const soggettiOptions: SelectOption[] = useMemo(() =>
    (soggettiList as any[]).filter((s: any) => s.attivo !== false).map((s: any) => ({
      id: s.id, label: s.nomeBreve || s.ragioneSociale, sublabel: s.partitaIva || s.tipologia,
    })), [soggettiList]);

  const centriCostoOptions: SelectOption[] = useMemo(() =>
    (centriCosto as any[]).filter((c: any) => c.attivo !== false).map((c: any) => ({
      id: c.id, label: c.nome, sublabel: c.codice, color: c.colore,
    })), [centriCosto]);

  const contiOptions: SelectOption[] = useMemo(() =>
    (conti as any[]).filter((c: any) => c.attivo !== false).map((c: any) => ({
      id: c.id, label: c.nome, sublabel: `${c.tipo} • ${fmtCents(c.saldoAttuale || 0)}`,
    })), [conti]);

  const metodiOptions: SelectOption[] = useMemo(() =>
    (metodi as any[]).filter((m: any) => m.attivo !== false).map((m: any) => ({
      id: m.id, label: m.nome,
    })), [metodi]);

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
                tipoRegistrazione === "pagato_subito" ? "border-primary bg-primary/5" : "border-muted"
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-medium">Pagato subito</span>
            </button>
            <button
              onClick={() => setTipoRegistrazione("documento")}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                tipoRegistrazione === "documento" ? "border-primary bg-primary/5" : "border-muted"
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-xs font-medium">Da {tipo === "entrata" ? "incassare" : "pagare"}</span>
            </button>
          </div>
        </div>

        {/* ── Categoria (con QuickCreate) ── */}
        <SelectWithQuickCreate
          label="Categoria *"
          value={categoriaId}
          onChange={setCategoriaId}
          options={categorieOptions}
          placeholder="Seleziona categoria"
          quickCreateTitle="Nuova categoria"
          quickCreateFields={[
            { key: "nome", label: "Nome", placeholder: "es. Carburanti", required: true },
            { key: "tipo", label: "Tipo", type: "select", options: [
              { value: "entrata", label: "Entrata" },
              { value: "uscita", label: "Uscita" },
              { value: "entrambi", label: "Entrambi" },
            ], required: true },
          ]}
          onQuickCreate={async (data) => {
            const result = await createCategoriaMut.mutateAsync({
              nome: data.nome,
              tipo: (data.tipo as "entrata" | "uscita" | "entrambi") || "uscita",
            });
            toast.success("Categoria creata");
            return result.id;
          }}
          managePath="/finanza/impostazioni/categorie"
          onManage={() => setLocation("/finanza/impostazioni/categorie")}
          searchable
        />

        {/* ── Soggetto (con QuickCreate) — SEMPRE VISIBILE ── */}
        <SelectWithQuickCreate
          label={tipo === "entrata" ? "Cliente" : "Fornitore"}
          value={soggettoId}
          onChange={setSoggettoId}
          options={soggettiOptions}
          placeholder={`Cerca ${tipo === "entrata" ? "cliente" : "fornitore"}...`}
          quickCreateTitle={`Nuovo ${tipo === "entrata" ? "cliente" : "fornitore"}`}
          quickCreateFields={[
            { key: "ragioneSociale", label: "Ragione sociale", placeholder: "es. Agriforniture Rossi", required: true },
            { key: "partitaIva", label: "Partita IVA" },
            { key: "telefono", label: "Telefono" },
          ]}
          onQuickCreate={async (data) => {
            const result = await createSoggettoMut.mutateAsync({
              tipologia: tipo === "entrata" ? "cliente" : "fornitore",
              ragioneSociale: data.ragioneSociale,
              partitaIva: data.partitaIva || undefined,
              telefono: data.telefono || undefined,
            });
            toast.success("Soggetto creato");
            return result.id;
          }}
          managePath="/finanza/impostazioni/soggetti"
          onManage={() => setLocation("/finanza/impostazioni/soggetti")}
          searchable
        />

        {/* ── Conto (con QuickCreate, per pagato_subito) ── */}
        {tipoRegistrazione === "pagato_subito" && (
          <>
            <SelectWithQuickCreate
              label="Conto *"
              value={contoId}
              onChange={setContoId}
              options={contiOptions}
              placeholder="Seleziona conto"
              quickCreateTitle="Nuovo conto"
              quickCreateFields={[
                { key: "nome", label: "Nome", placeholder: "es. Banca Aziendale", required: true },
                { key: "tipo", label: "Tipo", type: "select", options: [
                  { value: "bancario", label: "Conto bancario" },
                  { value: "cassa", label: "Cassa" },
                  { value: "carta", label: "Carta" },
                  { value: "deposito", label: "Deposito" },
                  { value: "altro", label: "Altro" },
                ], required: true },
              ]}
              onQuickCreate={async (data) => {
                const result = await createContoMut.mutateAsync({
                  nome: data.nome,
                  tipo: (data.tipo as any) || "bancario",
                  saldoIniziale: 0,
                  valuta: "EUR",
                });
                toast.success("Conto creato");
                return result.id;
              }}
              managePath="/finanza/impostazioni/conti"
              onManage={() => setLocation("/finanza/impostazioni/conti")}
              searchable
            />
            {contoSelezionato && calcoloIva.totale > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm -mt-3">
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
          </>
        )}

        {/* ── Scadenza (per documento) ── */}
        {tipoRegistrazione === "documento" && (
          <div>
            <Label className="text-sm">Data scadenza</Label>
            <Input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className="mt-1" />
          </div>
        )}

        {/* ── Data ── */}
        <div>
          <Label className="text-sm">Data</Label>
          <Input type="date" value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} className="mt-1" />
        </div>

        {/* ── Descrizione ── */}
        <div>
          <Label className="text-sm">Descrizione</Label>
          <Input placeholder="Es: Acquisto mangimi" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} className="mt-1" />
        </div>

        {/* ── Sezione espandibile "Altri dettagli" ── */}
        <button onClick={() => setShowDettagli(!showDettagli)} className="flex items-center gap-2 text-sm text-muted-foreground w-full py-2">
          {showDettagli ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Altri dettagli
        </button>

        {showDettagli && (
          <div className="space-y-4 pl-1 border-l-2 border-muted ml-2">
            {/* Centro di costo */}
            <div className="pl-3">
              <SelectWithQuickCreate
                label="Centro di costo"
                value={centroCostoId}
                onChange={setCentroCostoId}
                options={centriCostoOptions}
                placeholder="Opzionale"
                quickCreateTitle="Nuovo centro di costo"
                quickCreateFields={[
                  { key: "nome", label: "Nome", placeholder: "es. Stalla", required: true },
                  { key: "codice", label: "Codice", placeholder: "CDC-XXX" },
                ]}
                onQuickCreate={async (data) => {
                  const result = await createCentroCostoMut.mutateAsync({
                    nome: data.nome,
                    codice: data.codice || undefined,
                  });
                  toast.success("Centro di costo creato");
                  return result.id;
                }}
                managePath="/finanza/impostazioni/centri-costo"
                onManage={() => setLocation("/finanza/impostazioni/centri-costo")}
                searchable
              />
            </div>

            {/* Metodo pagamento */}
            {tipoRegistrazione === "pagato_subito" && (
              <div className="pl-3">
                <SelectWithQuickCreate
                  label="Metodo pagamento"
                  value={metodoId}
                  onChange={setMetodoId}
                  options={metodiOptions}
                  placeholder="Opzionale"
                  quickCreateTitle="Nuovo metodo"
                  quickCreateFields={[
                    { key: "nome", label: "Nome", placeholder: "es. Bonifico", required: true },
                  ]}
                  onQuickCreate={async (data) => {
                    const result = await createMetodoMut.mutateAsync({ nome: data.nome });
                    toast.success("Metodo creato");
                    return result.id;
                  }}
                  managePath="/finanza/impostazioni/metodi-pagamento"
                  onManage={() => setLocation("/finanza/impostazioni/metodi-pagamento")}
                />
              </div>
            )}

            {/* Tipo documento e numero */}
            <div className="pl-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">Tipo doc.</Label>
                <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Generico" /></SelectTrigger>
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
                <Input placeholder="N. doc" value={numero} onChange={(e) => setNumero(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Note */}
            <div className="pl-3">
              <Label className="text-sm">Note</Label>
              <Textarea placeholder="Note aggiuntive..." value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-20">
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
    </div>
  );
}
