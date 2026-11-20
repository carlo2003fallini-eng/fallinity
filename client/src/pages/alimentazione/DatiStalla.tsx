import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  FeedPage,
  FeedStatus,
  Field,
  PANEL,
  INPUT,
  ACTION,
  qty,
  eur,
  dateTime,
  useFeedConfirm,
} from "./shared";
const localTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function DatiStalla() {
  const { user } = useAuth();
  const q = trpc.stalla.produzioneData.useQuery(
    { scope: user?.activeCompanyId ?? undefined },
    { retry: false }
  );
  const utils = trpc.useUtils();
  const save = trpc.stalla.salvaProduzione.useMutation();
  const c = useFeedConfirm();
  const [group, setGroup] = useState("");
  const [at, setAt] = useState(localTime);
  const [milk, setMilk] = useState("");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [price, setPrice] = useState("");
  const [line, setLine] = useState("");
  const [source, setSource] = useState("");
  const num = (s: string) =>
    s.trim() === "" ? null : Number(s.replace(",", "."));
  const target = q.data?.groups.find(g => g.id === group);
  return (
    <FeedPage title="Dati stalla" back="/stalla">
      <FeedStatus query={q} />
      <p className="text-sm text-zinc-400">
        Produzione e qualità registrate per gruppo: un’unica fonte per
        Alimentazione, efficienza e IOFC. Le letture attuali dell’anagrafica non
        vengono trasformate in uno storico fittizio.
      </p>
      {q.data?.permissions.canEdit && (
        <section className={`${PANEL} space-y-4`}>
          <h2 className="font-semibold text-white">Registra rilevazione</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gruppo in lattazione">
              <select
                className={INPUT}
                value={group}
                onChange={e => setGroup(e.target.value)}
              >
                <option value="">Seleziona gruppo</option>
                {q.data.groups
                  .filter(g => g.inLattazione > 0)
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.nome} · {g.inLattazione} capi in lattazione
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Data e ora">
              <input
                className={INPUT}
                type="datetime-local"
                value={at}
                onChange={e => setAt(e.target.value)}
              />
            </Field>
            <Field label="Latte effettivamente prodotto dal gruppo (kg)">
              <input
                className={INPUT}
                inputMode="decimal"
                value={milk}
                onChange={e => setMilk(e.target.value)}
                placeholder="Peso misurato, non litri"
              />
            </Field>
            <Field label="Provenienza rilevazione">
              <input
                className={INPUT}
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Pesa, impianto o registro aziendale"
              />
            </Field>
            <Field label="Grasso (%) — facoltativo">
              <input
                className={INPUT}
                inputMode="decimal"
                value={fat}
                onChange={e => setFat(e.target.value)}
              />
            </Field>
            <Field label="Proteine (%) — facoltativo">
              <input
                className={INPUT}
                inputMode="decimal"
                value={protein}
                onChange={e => setProtein(e.target.value)}
              />
            </Field>
            {q.data.permissions.canSeeCosts && (
              <>
                <Field label="Prezzo da fattura di vendita (riga aziendale)">
                  <select
                    className={INPUT}
                    value={line}
                    onChange={e => setLine(e.target.value)}
                  >
                    <option value="">
                      Non collegato / liquidazione manuale
                    </option>
                    {q.data.prices.map(p => (
                      <option key={p.lineId} value={p.lineId}>
                        {p.source} · {eur(p.pricePerKg)}/kg
                      </option>
                    ))}
                  </select>
                </Field>
                {!line && (
                  <Field label="Prezzo documentato dalla liquidazione (€/kg) — facoltativo">
                    <input
                      className={INPUT}
                      inputMode="decimal"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="Nessun prezzo preimpostato"
                    />
                  </Field>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            SS e ingestione provengono dalle distribuzioni. Se mancano qualità o
            prezzo, ECM e IOFC restano non calcolabili. I valori non vengono
            inventati.
          </p>
          <button
            className={ACTION}
            disabled={
              !target ||
              milk.trim() === "" ||
              num(milk) == null ||
              num(milk)! < 0 ||
              c.pending
            }
            onClick={() =>
              c.ask(
                "Conferma rilevazione Dati stalla",
                `${target?.nome}: ${qty(num(milk), "kg latte")}\n${new Date(at).toLocaleString("it-IT")}\nQuesta rilevazione sarà utilizzata nelle analisi del gruppo.`,
                async () => {
                  await save.mutateAsync({
                    groupId: group,
                    at: new Date(at).getTime(),
                    milkKg: num(milk)!,
                    fat: num(fat),
                    protein: num(protein),
                    pricePerKg: line ? undefined : num(price),
                    priceLineId: line || undefined,
                    priceSource: line
                      ? undefined
                      : "Liquidazione caseificio registrata manualmente",
                    source: source || "Rilevazione manuale Dati stalla",
                    confirm: true,
                  });
                  setMilk("");
                  await utils.stalla.produzioneData.invalidate();
                  await utils.alimentazione.invalidate();
                }
              )
            }
          >
            Salva rilevazione
          </button>
        </section>
      )}
      <section className={PANEL}>
        <h2 className="mb-3 font-semibold text-white">
          Storico produzione e qualità
        </h2>
        {!q.data?.records.length ? (
          <p className="text-sm text-zinc-400">
            Nessuna rilevazione produttiva registrata. Non sono stati inseriti
            dati dimostrativi.
          </p>
        ) : (
          q.data.records
            .slice()
            .sort((a, b) => b.at - a.at)
            .map(r => (
              <article
                key={r.id}
                className="border-b border-white/10 py-4 last:border-b-0"
              >
                <p className="font-semibold text-white">
                  {q.data!.groups.find(g => g.id === r.groupId)?.nome ??
                    "Gruppo storico"}{" "}
                  · {qty(r.milkKg, "kg")}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {dateTime(r.at)} · {r.headCount} capi · {r.source}
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  Grasso {qty(r.fat, "%")} · Proteine {qty(r.protein, "%")}
                </p>
                {q.data?.permissions.canSeeCosts && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {eur(r.pricePerKg)}/kg · {r.priceSource}
                  </p>
                )}
              </article>
            ))
        )}
      </section>
      <Link
        className="inline-flex min-h-12 items-center text-green-400"
        href="/alimentazione/analisi"
      >
        Consulta efficienza e IOFC in Alimentazione
      </Link>
      {c.dialog}
    </FeedPage>
  );
}
