import { trpc } from "@/lib/trpc";
export default function RicevimentoFattura({
  productId,
  selected,
  residual,
  onChange,
}: {
  productId: string;
  selected: string | null;
  residual: number | null;
  onChange: (id: string | null, q: number | null) => void;
}) {
  const q = trpc.finanza.ricevimentiDaCollegare.useQuery(
    { prodottoId: productId },
    { retry: false }
  );
  if (q.isLoading)
    return <p className="text-xs text-zinc-400">Ricerca ricevimenti fisici…</p>;
  if (!q.data?.receipts.length)
    return (
      <p className="text-xs text-zinc-400">
        Nessun ricevimento fisico non fatturato da collegare.
      </p>
    );
  return (
    <div className="space-y-3 rounded-xl border border-orange-400/20 p-3">
      <label className="block text-xs text-orange-200">
        Merce già ricevuta con DDT o carico manuale?
        <select
          className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#08120d] px-2 text-sm text-white"
          value={selected ?? ""}
          onChange={e => onChange(e.target.value || null, null)}
        >
          <option value="">
            Nuovo ricevimento: carica le quantità della fattura
          </option>
          {q.data.receipts.map(r => (
            <option key={r.id} value={r.id}>
              {new Date(r.at).toLocaleDateString("it-IT")} · {r.quantity}{" "}
              {q.data!.unit} · {r.description}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <label className="block text-xs text-zinc-300">
            Quantità di questo ricevimento ancora fisicamente presente (
            {q.data.unit})
            <input
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white"
              type="number"
              min="0"
              step="0.001"
              max={q.data.quantity}
              value={residual ?? ""}
              onChange={e =>
                onChange(
                  selected,
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </label>
          <p className="text-xs leading-relaxed text-orange-200">
            Il ricevimento deve corrispondere all’intera riga fattura. Conferma
            il residuo effettivo: sarà valorizzato al prezzo documentato senza
            aumentare nuovamente la giacenza. I costi dei prelievi già
            effettuati non cambiano.
          </p>
        </>
      )}
    </div>
  );
}
