import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DemoState } from "@shared/inventory-invoice/types";
import type { changeAlias } from "@shared/inventory-invoice/engine";

type AliasCorrection = Parameters<typeof changeAlias>[1];
const CONTROL = "min-h-11 w-full min-w-0 rounded-md border border-zinc-700 bg-black px-3 py-2 text-base text-white disabled:opacity-50";
export default function InvoiceAliasEditor({ state, canEdit, onConfirm }: { state: DemoState; canEdit: boolean; onConfirm: (input: AliasCorrection) => void }) {
  const aliases = state.aliases.filter(a => a.active);
  const [aliasId, setAliasId] = useState("");
  const [productId, setProductId] = useState("");
  const [unit, setUnit] = useState("");
  const [factor, setFactor] = useState("1");
  const [reason, setReason] = useState("");
  const alias = aliases.find(a => a.id === aliasId);
  useEffect(() => { if (aliasId && !alias) { setAliasId(""); setReason(""); } }, [aliasId, alias]);
  function select(id: string) {
    setAliasId(id); const a = aliases.find(a => a.id === id);
    setProductId(a?.productId ?? ""); setUnit(a?.invoiceUnit ?? ""); setFactor(String(a?.factor ?? 1)); setReason("");
  }
  return <details className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <summary className="min-h-11 cursor-pointer py-2 font-medium text-sky-200">Correggi associazioni fornitore / conversioni</summary>
    <p className="mt-2 text-sm leading-6 text-zinc-400">La correzione vale per le prossime fatture. La versione precedente e le valorizzazioni già registrate restano nello storico.</p>
    {!aliases.length ? <p className="mt-3 text-sm text-zinc-400">Nessuna associazione confermata. Il primo carico memorizza i codici del fornitore e il fattore verificato.</p> : <fieldset disabled={!canEdit} className="mt-3 min-w-0 space-y-3">
      <label className="block space-y-2 text-sm"><span>Codice fornitore da correggere</span><select className={CONTROL} value={aliasId} onChange={e => select(e.target.value)}><option value="">Seleziona associazione</option>{aliases.map(a => <option key={a.id} value={a.id}>{a.code} · {a.supplierName}</option>)}</select></label>
      {alias && <><p className="break-words text-xs text-sky-200">{alias.supplierName} · codice {alias.code} → {state.products.find(p => p.id === alias.productId)?.nome}</p>
        <label className="block space-y-2 text-sm"><span>Articolo corretto nell’anagrafica</span><select className={CONTROL} value={productId} onChange={e => setProductId(e.target.value)}>{state.products.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.unit}</option>)}</select></label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="block space-y-2 text-sm"><span>Unità della fattura</span><Input className={CONTROL} value={unit} onChange={e => setUnit(e.target.value)} /></label><label className="block space-y-2 text-sm"><span>Fattore verso l’unità dell’articolo</span><Input type="number" min="0" step="any" inputMode="decimal" className={CONTROL} value={factor} onChange={e => setFactor(e.target.value)} /></label></div>
        <label className="block space-y-2 text-sm"><span>Motivo della correzione</span><Input className={CONTROL} value={reason} onChange={e => setReason(e.target.value)} placeholder="Es. codice associato al modello errato" /></label>
        <Button type="button" className="min-h-11 h-auto w-full whitespace-normal bg-green-700 py-2 text-white hover:bg-green-600" disabled={!reason.trim() || !unit.trim() || !productId || !Number.isFinite(Number(factor)) || Number(factor) <= 0} onClick={() => onConfirm({ aliasId, productId, invoiceUnit: unit.trim(), factor: Number(factor), reason: reason.trim(), operationId: crypto.randomUUID() })}>Rivedi e conferma correzione demo</Button>
      </>}
    </fieldset>}
    {!canEdit && <p className="mt-3 text-xs text-amber-200">Accesso in sola lettura: correzioni non consentite.</p>}
  </details>;
}
