import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Wheat } from "lucide-react";
export default function CostiAlimentari({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const { user } = useAuth();
  const input = useMemo(
    () => ({
      from: new Date(`${from}T00:00:00`).getTime(),
      to: new Date(`${to}T23:59:59.999`).getTime(),
      scope: user?.activeCompanyId ?? undefined,
    }),
    [from, to, user?.activeCompanyId]
  );
  const q = trpc.finanza.costiAlimentari.useQuery(input, { retry: false });
  const money = (n: number | null | undefined) =>
    n == null
      ? "Non disponibile"
      : new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
        }).format(n / 100);
  return (
    <section className="space-y-3 rounded-xl border border-green-500/20 bg-green-950/15 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-green-300">
        <Wheat size={17} />
        Costi alimentari — attribuzione analitica
      </h2>
      {q.isLoading ? (
        <p className="text-xs text-zinc-400">
          Lettura registrazioni Alimentazione…
        </p>
      ) : q.isError ? (
        <p className="text-xs text-orange-300">
          Costi alimentari non disponibili. Nessun importo viene aggiunto ai
          movimenti.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-zinc-400">
                Alimenti freschi prelevati nel periodo
              </p>
              <p className="mt-1 font-semibold text-white">
                {money(q.data?.freshCostCents)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">
                Costi attribuiti con le distribuzioni
              </p>
              <p className="mt-1 font-semibold text-white">
                {money(q.data?.attributedCostCents)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[11px] text-zinc-400">
                Valore delle scorte alimentari attuali (non storico)
              </p>
              <p className="mt-1 font-semibold text-white">
                {money(q.data?.stockValueCents)}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            {q.data?.runs ?? 0} carri e {q.data?.distributions ?? 0}{" "}
            distribuzioni nel periodo.
          </p>
          {q.data?.hasMissingCosts && (
            <p className="text-xs text-orange-300">
              Alcuni carichi non hanno un costo valorizzato: non sono sostituiti
              con costo zero.
            </p>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-zinc-400">
        Questi valori sono consultivi e non vengono sommati alle uscite:
        l’acquisto resta registrato una sola volta dalla fattura. Il riquadro
        segue il periodo; non i filtri fornitore, centro di costo o
        sottocategoria.
      </p>
    </section>
  );
}
