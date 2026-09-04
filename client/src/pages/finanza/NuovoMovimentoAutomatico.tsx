import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FileUp,
  Loader2,
  PackagePlus,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InvoiceDetail = NonNullable<RouterOutputs["finanza"]["fattureAutomatiche"]["dettaglio"]>;
type InvoiceLine = InvoiceDetail["righe"][number];

type LineReview = {
  rigaId: string;
  categoriaId: string;
  centroCostoId: string;
  destinazione: "costo" | "magazzino" | "investimento" | "altro";
  aggiornaMagazzino: boolean;
  prodottoId: string;
  creaProdotto: boolean;
  nomeProdotto: string;
  expanded: boolean;
};

type DeadlineReview = { dataScadenza: string; importoEuro: string; note: string };

const SESSION_KEY = "fallinity_fattura_automatica_corrente";
const money = (cents: number, currency = "EUR") => new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(cents / 100);
const percentage = (rate: number) => `${(rate / 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function inputToCents(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 32_768)));
  }
  return btoa(binary);
}

function confidenceLabel(confidence: number) {
  if (confidence >= 90) return "Storico confermato";
  if (confidence >= 70) return "Proposta affidabile";
  return "Da controllare";
}

export default function NuovoMovimentoAutomatico() {
  const [, setLocation] = useLocation();
  const initializedId = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [acquisitionId, setAcquisitionId] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [lineReviews, setLineReviews] = useState<LineReview[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineReview[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [duplicateAccepted, setDuplicateAccepted] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const detailInput = useMemo(() => ({ id: acquisitionId }), [acquisitionId]);
  const detailQuery = trpc.finanza.fattureAutomatiche.dettaglio.useQuery(detailInput, {
    enabled: Boolean(acquisitionId),
    retry: false,
  });
  const { data: categories = [] } = trpc.finanza.categorie.list.useQuery({ tipo: "uscita" });
  const { data: costCenters = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: products = [] } = trpc.magazzino.list.useQuery();
  const utils = trpc.useUtils();

  const acquisition = detailQuery.data ?? null;

  useEffect(() => {
    if (!acquisition || initializedId.current === acquisition.id) return;
    initializedId.current = acquisition.id;
    const firstLine = acquisition.righe[0];
    setLineReviews(acquisition.righe.map((line, index) => ({
      rigaId: line.id,
      categoriaId: line.categoriaId ?? "",
      centroCostoId: line.centroCostoId ?? "",
      destinazione: line.destinazione,
      aggiornaMagazzino: false,
      prodottoId: line.prodottoId ?? "",
      creaProdotto: false,
      nomeProdotto: line.nomeProdotto ?? line.descrizione.slice(0, 255),
      expanded: index === 0 || line.confidenza < 70,
    })));
    setDeadlines(acquisition.scadenze.map((deadline) => ({
      dataScadenza: deadline.dataScadenza,
      importoEuro: centsToInput(deadline.importo),
      note: "",
    })));
    setCategoryId(firstLine?.categoriaId ?? "");
    setCostCenterId(firstLine?.centroCostoId ?? "");
    setDescription(`Fattura ${acquisition.numeroDocumento} — ${acquisition.fornitore.ragioneSociale}`);
    setDuplicateAccepted(false);
  }, [acquisition]);

  const uploadMutation = trpc.finanza.fattureAutomatiche.acquisisci.useMutation({
    onSuccess: async (data) => {
      sessionStorage.setItem(SESSION_KEY, data.id);
      initializedId.current = "";
      setAcquisitionId(data.id);
      await utils.finanza.fattureAutomatiche.dettaglio.invalidate({ id: data.id });
      toast.success(data.riutilizzata ? "Fattura già acquisita: revisione ripristinata" : "Fattura acquisita: controlla i dati");
    },
    onError: (error) => toast.error(error.message || "Non è stato possibile acquisire la fattura"),
  });

  const confirmMutation = trpc.finanza.fattureAutomatiche.conferma.useMutation({
    onSuccess: async (result) => {
      sessionStorage.removeItem(SESSION_KEY);
      await Promise.all([
        utils.finanza.movimenti.invalidate(),
        utils.finanza.dashboard.invalidate(),
        utils.finanza.scadenze.invalidate(),
        utils.magazzino.invalidate(),
      ]);
      toast.success(result.giaRegistrata ? "Fattura già registrata" : "Fattura registrata in Finanza");
      setLocation(`/finanza/movimento/${result.documentoId}`);
    },
    onError: (error) => toast.error(error.message.replace(/^POSSIBILE_DUPLICATO:\s*/, "") || "Registrazione non riuscita"),
  });

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!online) {
      toast.error("Per acquisire l’XML è necessaria una connessione. Il file non è stato inviato.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Seleziona una fattura elettronica in formato XML");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Il file supera il limite di 5 MB");
      return;
    }
    try {
      uploadMutation.mutate({
        nomeFile: file.name,
        mimeType: file.type || "application/xml",
        dimensione: file.size,
        contenutoBase64: await fileToBase64(file),
      });
    } catch {
      toast.error("Non è stato possibile leggere il file selezionato");
    }
  };

  const reset = () => {
    sessionStorage.removeItem(SESSION_KEY);
    initializedId.current = "";
    setAcquisitionId("");
    setLineReviews([]);
    setDeadlines([]);
    setDescription("");
    setNotes("");
    setDuplicateAccepted(false);
  };

  const updateLine = (rigaId: string, patch: Partial<LineReview>) => {
    setLineReviews((current) => current.map((line) => line.rigaId === rigaId ? { ...line, ...patch } : line));
  };

  const allowedCategories = (centerId: string) => {
    if (!centerId) return categories as any[];
    const center = (costCenters as any[]).find((item) => item.id === centerId);
    if (!center?.categoriaCentroId) return [];
    return (categories as any[]).filter((item) => (item.categoriaCentroIds ?? []).includes(center.categoriaCentroId));
  };

  const addDeadline = () => {
    setDeadlines((current) => [...current, {
      dataScadenza: acquisition?.dataDocumento ?? new Date().toISOString().slice(0, 10),
      importoEuro: "0,00",
      note: "",
    }]);
  };

  const submit = () => {
    if (!acquisition || !online) return;
    if (!categoryId) return toast.error("Seleziona la sottocategoria principale");
    if (lineReviews.some((line) => !line.categoriaId)) return toast.error("Controlla la sottocategoria di ogni riga");
    if (acquisition.duplicatoDocumentoId && !duplicateAccepted) return toast.error("Conferma di aver verificato il possibile duplicato");
    const parsedDeadlines = deadlines.map((deadline) => ({
      dataScadenza: deadline.dataScadenza,
      importo: inputToCents(deadline.importoEuro),
      note: deadline.note || undefined,
    }));
    if (parsedDeadlines.some((deadline) => deadline.importo <= 0 || !deadline.dataScadenza)) return toast.error("Controlla date e importi delle scadenze");
    const totalDeadlines = parsedDeadlines.reduce((sum, deadline) => sum + deadline.importo, 0);
    if (Math.abs(totalDeadlines - acquisition.totale) > 2) return toast.error("La somma delle scadenze deve corrispondere al totale fattura");

    confirmMutation.mutate({
      acquisizioneId: acquisition.id,
      soggettoId: acquisition.fornitore.soggettoId,
      categoriaId: categoryId,
      centroCostoId: costCenterId || null,
      dataCompetenza: acquisition.dataDocumento,
      descrizione: description,
      note: notes || undefined,
      confermaDuplicato: duplicateAccepted,
      scadenze: parsedDeadlines,
      righe: lineReviews.map((line) => ({
        rigaId: line.rigaId,
        categoriaId: line.categoriaId,
        centroCostoId: line.centroCostoId || null,
        destinazione: line.destinazione,
        aggiornaMagazzino: line.aggiornaMagazzino,
        prodottoId: line.prodottoId || null,
        creaProdotto: line.creaProdotto,
        nomeProdotto: line.nomeProdotto || null,
      })),
    });
  };

  const detailLoading = Boolean(acquisitionId && detailQuery.isLoading);
  const uploadBusy = uploadMutation.isPending;

  return (
    <div className="min-h-full bg-[#07110d] pb-32 text-white">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/[0.04] text-white" onClick={() => setLocation("/finanza")} aria-label="Torna a Finanza">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/70">Inserimento automatico</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{acquisition ? "Fattura acquisita" : "Carica fattura XML"}</h1>
              <p className="mt-1 text-sm text-white/55">{acquisition ? "Controlla i dati prima di registrare." : "Importa i dati ufficiali della fattura elettronica."}</p>
            </div>
          </div>
          {acquisition && (
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-2xl text-white/65 hover:bg-white/5 hover:text-white" onClick={reset} aria-label="Carica un’altra fattura">
              <RotateCcw className="h-5 w-5" />
            </Button>
          )}
        </header>

        {!online && (
          <div className="mb-4 flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Sei offline</p><p className="mt-1 text-amber-100/70">Puoi controllare la schermata già caricata, ma acquisizione e conferma richiedono la connessione.</p></div>
          </div>
        )}

        {!acquisition && !detailLoading && (
          <section className="overflow-hidden rounded-[28px] border border-emerald-300/15 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.13),transparent_42%),linear-gradient(155deg,rgba(16,35,27,0.98),rgba(7,17,13,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300/12 text-emerald-300"><ReceiptText className="h-6 w-6" /></div>
              <div><h2 className="font-semibold">Fattura elettronica italiana</h2><p className="text-sm text-white/50">Formato XML FatturaPA · massimo 5 MB</p></div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void handleFile(event.dataTransfer.files[0]);
              }}
              disabled={uploadBusy || !online}
              className={`flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center transition active:scale-[0.99] ${isDragging ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-black/15 hover:border-emerald-300/50 hover:bg-emerald-300/[0.05]"} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {uploadBusy ? <Loader2 className="h-10 w-10 animate-spin text-emerald-300" /> : <UploadCloud className="h-10 w-10 text-emerald-300" />}
              <span className="mt-4 text-base font-semibold">{uploadBusy ? "Acquisizione in corso…" : "Trascina qui il file XML"}</span>
              <span className="mt-1 text-sm text-white/50">oppure tocca per selezionarlo</span>
              {!uploadBusy && <span className="mt-5 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-[#062016]">Scegli fattura</span>}
            </button>
            <input ref={fileInputRef} type="file" accept=".xml,application/xml,text/xml" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [FileCheck2, "Dati ufficiali", "Importi letti dall’XML"],
                [Bot, "Classificazione", "Storico, regole e AI"],
                [ShieldCheck, "Nessun movimento", "Solo dopo la conferma"],
              ].map(([Icon, title, subtitle]) => {
                const Visual = Icon as typeof FileCheck2;
                return <div key={String(title)} className="rounded-2xl bg-white/[0.035] p-3"><Visual className="h-4 w-4 text-emerald-300" /><p className="mt-2 text-sm font-medium">{String(title)}</p><p className="mt-1 text-xs text-white/45">{String(subtitle)}</p></div>;
              })}
            </div>
          </section>
        )}

        {detailLoading && (
          <div className="grid min-h-72 place-items-center rounded-[28px] border border-white/8 bg-white/[0.03]">
            <div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-300" /><p className="mt-4 text-sm text-white/55">Apro la revisione…</p></div>
          </div>
        )}

        {acquisition && (
          <div className="space-y-4">
            <section className="rounded-[26px] border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.09] to-white/[0.025] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Documento</p><h2 className="mt-1 truncate text-xl font-semibold">{acquisition.numeroDocumento}</h2><p className="mt-1 truncate text-sm text-white/55">{acquisition.nomeFile}</p></div>
                <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-200">Da verificare</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <SummaryValue label="Data" value={new Date(`${acquisition.dataDocumento}T00:00:00`).toLocaleDateString("it-IT")} />
                <SummaryValue label="Totale" value={money(acquisition.totale, acquisition.valuta)} strong />
              </div>
            </section>

            {acquisition.avvisi.length > 0 && (
              <section className="space-y-2" aria-label="Avvisi della fattura">
                {acquisition.avvisi.map((warning, index) => (
                  <div key={`${warning.codice}-${index}`} className={`flex gap-3 rounded-2xl border p-4 text-sm ${warning.severita === "alta" ? "border-red-400/25 bg-red-400/10 text-red-100" : warning.severita === "attenzione" ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-sky-400/20 bg-sky-400/10 text-sky-100"}`}>
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{warning.messaggio}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Fornitore</p>
              <h2 className="mt-2 text-lg font-semibold">{acquisition.fornitore.ragioneSociale}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryValue label="Partita IVA" value={acquisition.fornitore.partitaIva || acquisition.fornitore.codiceFiscale || "Da completare"} />
                <SummaryValue label="IBAN" value={acquisition.fornitore.iban || "Non indicato"} />
                {acquisition.fornitore.indirizzo && <div className="sm:col-span-2"><SummaryValue label="Sede" value={acquisition.fornitore.indirizzo} /></div>}
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Importi</p><h2 className="mt-1 font-semibold">Riepilogo fiscale</h2></div><ReceiptText className="h-5 w-5 text-emerald-300" /></div>
              <div className="mt-4 divide-y divide-white/8">
                <AmountRow label="Imponibile" value={money(acquisition.imponibile, acquisition.valuta)} />
                <AmountRow label="IVA" value={money(acquisition.importoIva, acquisition.valuta)} />
                {acquisition.ritenute !== 0 && <AmountRow label="Ritenute" value={`− ${money(acquisition.ritenute, acquisition.valuta)}`} />}
                {acquisition.altriImporti !== 0 && <AmountRow label="Altri importi" value={money(acquisition.altriImporti, acquisition.valuta)} />}
                <AmountRow label="Totale fattura" value={money(acquisition.totale, acquisition.valuta)} strong />
              </div>
              {acquisition.riepiloghiIva.length > 1 && <p className="mt-3 text-xs text-white/45">{acquisition.riepiloghiIva.length} riepiloghi IVA riconosciuti.</p>}
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Classificazione documento</p><h2 className="mt-1 font-semibold">Destinazione principale</h2></div><CheckCircle2 className="h-5 w-5 text-emerald-300" /></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Centro di costo</Label><Select value={costCenterId || "none"} onValueChange={(value) => { const next = value === "none" ? "" : value; setCostCenterId(next); if (categoryId && !allowedCategories(next).some((item) => item.id === categoryId)) setCategoryId(""); }}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-black/20"><SelectValue placeholder="Nessun centro" /></SelectTrigger><SelectContent><SelectItem value="none">Nessun centro</SelectItem>{(costCenters as any[]).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Sottocategoria</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-black/20"><SelectValue placeholder="Seleziona" /></SelectTrigger><SelectContent>{allowedCategories(costCenterId).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="mt-4 space-y-2"><Label>Descrizione movimento</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-20 rounded-2xl border-white/10 bg-black/20" /></div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Righe fattura</p><h2 className="mt-1 font-semibold">{acquisition.righe.length} {acquisition.righe.length === 1 ? "riga riconosciuta" : "righe riconosciute"}</h2></div>{acquisition.aiUsata && <Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100"><Bot className="mr-1 h-3 w-3" />AI assistita</Badge>}</div>
              <div className="space-y-3">
                {acquisition.righe.map((line) => {
                  const review = lineReviews.find((item) => item.rigaId === line.id);
                  if (!review) return null;
                  const choices = allowedCategories(review.centroCostoId);
                  return (
                    <article key={line.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => updateLine(line.id, { expanded: !review.expanded })}>
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-white/35">Riga {line.numeroLinea}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${line.confidenza >= 70 ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-100"}`}>{confidenceLabel(line.confidenza)}</span></div><h3 className="mt-2 line-clamp-2 font-medium">{line.descrizione}</h3><p className="mt-2 text-sm text-white/50">{line.quantita ? `${Number(line.quantita).toLocaleString("it-IT")} ${line.unitaMisura || ""} · ` : ""}{money(line.totaleLinea, acquisition.valuta)} · IVA {percentage(line.aliquotaIva)}</p></div>
                        {review.expanded ? <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-white/45" /> : <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-white/45" />}
                      </button>
                      {review.expanded && (
                        <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
                          {line.codiceArticolo && <p className="text-xs text-white/45">Codice articolo: <span className="font-mono text-white/70">{line.codiceArticolo}</span></p>}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2"><Label>Centro di costo</Label><Select value={review.centroCostoId || "none"} onValueChange={(value) => { const next = value === "none" ? "" : value; const currentCategoryValid = choices.some((item) => item.id === review.categoriaId); updateLine(line.id, { centroCostoId: next, categoriaId: currentCategoryValid ? review.categoriaId : "" }); }}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.03]"><SelectValue placeholder="Nessun centro" /></SelectTrigger><SelectContent><SelectItem value="none">Nessun centro</SelectItem>{(costCenters as any[]).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Sottocategoria</Label><Select value={review.categoriaId} onValueChange={(value) => updateLine(line.id, { categoriaId: value })}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.03]"><SelectValue placeholder="Seleziona" /></SelectTrigger><SelectContent>{allowedCategories(review.centroCostoId).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
                          </div>
                          <div className="space-y-2"><Label>Destinazione</Label><Select value={review.destinazione} onValueChange={(value: LineReview["destinazione"]) => updateLine(line.id, { destinazione: value })}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-white/[0.03]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="costo">Costo operativo</SelectItem><SelectItem value="magazzino">Magazzino</SelectItem><SelectItem value="investimento">Investimento</SelectItem><SelectItem value="altro">Altro</SelectItem></SelectContent></Select></div>
                          <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4">
                            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Aggiorna Magazzino</p><p className="mt-1 text-xs text-white/45">Carica la quantità solo dopo la conferma.</p></div><Switch checked={review.aggiornaMagazzino} onCheckedChange={(checked) => updateLine(line.id, { aggiornaMagazzino: checked, destinazione: checked ? "magazzino" : review.destinazione })} /></div>
                            {review.aggiornaMagazzino && (
                              <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                                <div className="space-y-2"><Label>Prodotto esistente</Label><Select value={review.prodottoId || "none"} onValueChange={(value) => updateLine(line.id, { prodottoId: value === "none" ? "" : value, creaProdotto: value === "new" })}><SelectTrigger className="h-12 rounded-2xl border-white/10 bg-black/20"><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger><SelectContent><SelectItem value="none">Seleziona prodotto</SelectItem><SelectItem value="new">Crea nuovo prodotto</SelectItem>{(products as any[]).map((product) => <SelectItem key={product.id} value={product.id}>{product.nome}{product.codice ? ` · ${product.codice}` : ""}</SelectItem>)}</SelectContent></Select></div>
                                {review.creaProdotto && <div className="space-y-2"><Label>Nome nuovo prodotto</Label><Input value={review.nomeProdotto} onChange={(event) => updateLine(line.id, { nomeProdotto: event.target.value })} className="h-12 rounded-2xl border-white/10 bg-black/20" /></div>}
                                <p className="flex items-center gap-2 text-xs text-emerald-100/70"><PackagePlus className="h-4 w-4" />Quantità da caricare: {line.quantita ? `${Number(line.quantita).toLocaleString("it-IT")} ${line.unitaMisura || ""}` : "non disponibile"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Pagamento</p><h2 className="mt-1 font-semibold">Scadenze</h2></div><CalendarClock className="h-5 w-5 text-emerald-300" /></div>
              <div className="mt-4 space-y-3">
                {deadlines.map((deadline, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl bg-black/20 p-3">
                    <div className="space-y-1"><Label className="text-xs text-white/50">Data</Label><Input type="date" value={deadline.dataScadenza} onChange={(event) => setDeadlines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dataScadenza: event.target.value } : item))} className="h-11 rounded-xl border-white/10 bg-white/[0.03] px-2" /></div>
                    <div className="space-y-1"><Label className="text-xs text-white/50">Importo</Label><Input inputMode="decimal" value={deadline.importoEuro} onChange={(event) => setDeadlines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, importoEuro: event.target.value } : item))} className="h-11 rounded-xl border-white/10 bg-white/[0.03] px-2" /></div>
                    <Button type="button" variant="ghost" size="icon" disabled={deadlines.length === 1} className="mt-5 h-11 w-11 rounded-xl text-white/45 hover:text-red-300" onClick={() => setDeadlines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Rimuovi scadenza ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-2xl border-white/10 bg-transparent text-white" onClick={addDeadline}><Plus className="mr-2 h-4 w-4" />Aggiungi scadenza</Button>
              <p className="mt-3 text-xs text-white/45">Metodo XML: {acquisition.metodoPagamento || "non indicato"}. Nessun conto viene movimentato finché la fattura non viene pagata.</p>
            </section>

            <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-5">
              <Label>Note interne</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Facoltative" className="mt-2 min-h-20 rounded-2xl border-white/10 bg-black/20" />
            </section>

            {acquisition.duplicatoDocumentoId && (
              <section className="rounded-[26px] border border-red-400/25 bg-red-400/10 p-5">
                <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><div><h2 className="font-semibold text-red-100">Verifica possibile duplicato</h2><p className="mt-1 text-sm text-red-100/70">Numero, data, fornitore e importo coincidono con un documento già presente.</p></div></div>
                <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-black/20 px-4"><Switch checked={duplicateAccepted} onCheckedChange={setDuplicateAccepted} /><span className="text-sm">Ho controllato e voglio registrare comunque</span></label>
              </section>
            )}

            <div className="sticky bottom-20 z-20 rounded-[24px] border border-emerald-300/20 bg-[#0a1812]/95 p-3 shadow-[0_-18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              <Button type="button" className="h-14 w-full rounded-2xl bg-emerald-300 text-base font-semibold text-[#052016] hover:bg-emerald-200" disabled={!online || confirmMutation.isPending || Boolean(acquisition.duplicatoDocumentoId && !duplicateAccepted)} onClick={submit}>
                {confirmMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                {confirmMutation.isPending ? "Registrazione in corso…" : "Conferma e registra"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-white/40">Solo ora verranno creati movimento, scadenze e carichi scelti.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0 rounded-2xl bg-black/15 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p><p className={`mt-1 truncate ${strong ? "text-lg font-semibold text-emerald-200" : "text-sm font-medium text-white/85"}`}>{value}</p></div>;
}

function AmountRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 py-3 ${strong ? "text-base font-semibold" : "text-sm"}`}><span className={strong ? "text-white" : "text-white/55"}>{label}</span><span className={strong ? "text-emerald-200" : "text-white/85"}>{value}</span></div>;
}
