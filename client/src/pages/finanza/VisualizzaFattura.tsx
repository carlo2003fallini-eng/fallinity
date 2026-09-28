import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  FileText,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const money = (cents: number, currency = "EUR") => new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(cents / 100);

function formatDate(value: unknown) {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return "Data non disponibile";
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "Data non disponibile" : date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function percentage(value: number) {
  return `${(value / 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;
}

export default function VisualizzaFattura() {
  const [, params] = useRoute("/finanza/movimento/:documentoId/fattura");
  const [, setLocation] = useLocation();
  const documentoId = params?.documentoId ?? "";
  const input = useMemo(() => ({ documentoId }), [documentoId]);
  const invoiceQuery = trpc.finanza.fattureAutomatiche.perMovimento.useQuery(input, { enabled: Boolean(documentoId), retry: false });
  const invoice = invoiceQuery.data;
  const isEntrata = invoice?.tipoMovimento === "entrata";
  const controparteLabel = isEntrata ? "Cliente" : "Fornitore";
  const backToMovement = () => setLocation(`/finanza/movimento/${documentoId}`);

  if (invoiceQuery.isLoading) {
    return <div className="min-h-full bg-[#07110d] p-4 pb-28 text-white"><div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-12 w-full bg-white/10" /><Skeleton className="h-44 w-full bg-white/10" /><Skeleton className="h-64 w-full bg-white/10" /></div></div>;
  }

  if (!invoice) {
    return (
      <div className="min-h-full bg-[#07110d] p-4 pb-28 text-white">
        <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7">
            <FileText className="mx-auto h-11 w-11 text-emerald-300/70" />
            <h1 className="mt-4 text-xl font-semibold">Fattura non disponibile</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">Questo movimento non è collegato a una fattura elettronica acquisita, oppure la fattura non è più disponibile.</p>
            <Button type="button" className="mt-6 h-11 rounded-xl bg-emerald-300 px-5 font-semibold text-[#062016] hover:bg-emerald-200" onClick={backToMovement}><ArrowLeft className="mr-2 h-4 w-4" />Torna al movimento</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#07110d] pb-28 text-white">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-6 flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={backToMovement} aria-label="Torna al movimento"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/70">Movimento · Fattura elettronica</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">Fattura {invoice.numeroDocumento}</h1>
            <p className="mt-1 text-sm text-white/55">Vista fiscale in sola lettura, collegata al movimento.</p>
          </div>
          <Badge className={isEntrata ? "border-sky-300/20 bg-sky-300/10 text-sky-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}>{isEntrata ? "Entrata" : "Uscita"}</Badge>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-emerald-300/15 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_48%),linear-gradient(155deg,rgba(16,35,27,0.98),rgba(7,17,13,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Documento fiscale</p><h2 className="mt-2 truncate text-2xl font-semibold">{invoice.numeroDocumento}</h2><p className="mt-1 text-sm text-white/55">{formatDate(invoice.dataDocumento)} · {invoice.tipoDocumento || "Fattura"}</p></div><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${isEntrata ? "bg-sky-300/10 text-sky-200" : "bg-emerald-300/10 text-emerald-200"}`}>{isEntrata ? <ArrowDownRight className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}</div></div>
          <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4"><div><p className="text-xs uppercase tracking-[0.16em] text-white/40">Totale documento</p><p className="mt-1 text-3xl font-semibold">{money(invoice.totale, invoice.valuta)}</p></div><div className="text-right text-sm text-white/60"><p>{invoice.stato === "pagata" ? "Regolata" : "Registrata"}</p><p className="mt-1 text-xs text-white/40">Dati acquisiti da FatturaPA</p></div></div>
        </section>

        <section className="mt-4 rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-emerald-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{controparteLabel}</p><h2 className="mt-1 font-semibold">{invoice.fornitore.ragioneSociale}</h2></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Partita IVA / Codice fiscale" value={invoice.fornitore.partitaIva || invoice.fornitore.codiceFiscale || "Non indicato"} /><Info label="Sede" value={invoice.fornitore.indirizzo || "Non indicata"} />{!isEntrata && <Info label="IBAN" value={invoice.fornitore.iban || "Non indicato"} />}</div></section>

        <section className="mt-4 rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-emerald-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Riepilogo fiscale</p><h2 className="mt-1 font-semibold">Importi e IVA</h2></div></div><div className="mt-4 divide-y divide-white/8"><AmountRow label="Imponibile" value={money(invoice.imponibile, invoice.valuta)} /><AmountRow label="IVA" value={money(invoice.importoIva, invoice.valuta)} />{invoice.ritenute !== 0 && <AmountRow label="Ritenute" value={`− ${money(invoice.ritenute, invoice.valuta)}`} />}{invoice.altriImporti !== 0 && <AmountRow label="Altri importi" value={money(invoice.altriImporti, invoice.valuta)} />}<AmountRow label="Totale fattura" value={money(invoice.totale, invoice.valuta)} strong /></div></section>

        <section className="mt-4 rounded-[26px] border border-white/8 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Righe documento</p><h2 className="mt-1 font-semibold">{invoice.righe.length} {invoice.righe.length === 1 ? "articolo" : "articoli"}</h2></div><FileText className="h-5 w-5 text-emerald-300" /></div><div className="mt-4 space-y-3">{invoice.righe.map((line) => <article key={line.id} className="rounded-3xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-white/40">Riga {line.numeroLinea}{line.codiceArticolo ? ` · ${line.codiceArticolo}` : ""}</p><h3 className="mt-1 text-sm font-medium leading-5">{line.descrizione}</h3><p className="mt-2 text-xs text-white/50">{line.quantita ? `${Number(line.quantita).toLocaleString("it-IT")} ${line.unitaMisura || ""} · ` : ""}{money(line.prezzoUnitario, invoice.valuta)} unitario · IVA {percentage(line.aliquotaIva)}</p></div><p className="shrink-0 text-sm font-semibold">{money(line.totaleLinea, invoice.valuta)}</p></div></article>)}</div></section>

        {invoice.scadenze.length > 0 && <section className="mt-4 rounded-[26px] border border-white/8 bg-white/[0.035] p-5"><div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-emerald-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Scadenze</p><h2 className="mt-1 font-semibold">Piano di regolazione</h2></div></div><div className="mt-4 space-y-2">{invoice.scadenze.map((scadenza, index) => <div key={`${scadenza.dataScadenza}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 p-3"><div><p className="text-sm font-medium">{formatDate(scadenza.dataScadenza)}</p><p className="mt-1 text-xs text-white/45">{scadenza.modalitaPagamento || "Modalità non indicata"}</p></div><p className="font-semibold">{money(scadenza.importo, invoice.valuta)}</p></div>)}</div></section>}

        <section className="mt-4 flex gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4 text-sm text-emerald-50"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><p>Questa vista mostra i dati leggibili della fattura collegata al movimento. Il file XML originale resta protetto e non viene esposto.</p></section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-white/40">{label}</p><p className="mt-1 break-words text-sm text-white/80">{value}</p></div>;
}

function AmountRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 py-3 ${strong ? "text-base font-semibold text-white" : "text-sm text-white/70"}`}><span>{label}</span><span className="shrink-0">{value}</span></div>;
}
