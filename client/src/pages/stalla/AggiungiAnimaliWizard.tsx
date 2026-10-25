import { useMemo, useState } from "react";
import { ArrowLeft, Check, CheckSquare, ChevronRight, CircleAlert, Search, Square, Users, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BORDER, GREEN, SURFACE, SURFACE2, STATO_PRODUTTIVO, STATO_RIPRODUTTIVO, StatoBadge } from "./shared";
import type { GroupSummary, SourceBucket, SourceKey, WizardStep } from "./group-types";
import { sourceKeyFromGroupId, WIZARD_STEPS } from "./group-types";

export default function AggiungiAnimaliWizard({ open, onOpenChange, gruppoDestinazione, onCommitted }: { open: boolean; onOpenChange: (open: boolean) => void; gruppoDestinazione: GroupSummary; onCommitted: () => void }) {
  const [step, setStep] = useState<WizardStep>("origins");
  const [sourceKeys, setSourceKeys] = useState<Set<SourceKey>>(new Set());
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmConditionalFactors, setConfirmConditionalFactors] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const utils = trpc.useUtils();
  const { data: allGroups = [] } = trpc.stalla.gruppi.list.useQuery(undefined, { enabled: open });
  const sourceGroupIds = useMemo(() => Array.from(sourceKeys).filter((key): key is `group:${string}` => key !== "ungrouped").map((key) => key.slice("group:".length)), [sourceKeys]);
  const includeUngrouped = sourceKeys.has("ungrouped");
  const sourcesQuery = trpc.stalla.animali.disponibiliPerAggiunta.useQuery({ gruppoDestinazioneId: gruppoDestinazione.id, origineIds: sourceGroupIds, includiSenzaGruppo: includeUngrouped, ricerca: search || undefined }, { enabled: open && step !== "origins" && sourceKeys.size > 0 });
  const buckets = (sourcesQuery.data ?? []) as SourceBucket[];
  const idsInSources = useMemo(() => new Set(buckets.flatMap((bucket) => bucket.animali.map((animal) => animal.id))), [buckets]);
  const previewQuery = trpc.stalla.animali.anteprimaAggiuntaMultipla.useQuery({ nuovoGruppoId: gruppoDestinazione.id, animaleIds: Array.from(selectedAnimalIds), confermaFattori: confirmConditionalFactors }, { enabled: open && step === "review" && selectedAnimalIds.size > 0 });
  const commitMut = trpc.stalla.animali.aggiungiMultiplo.useMutation({
    onSuccess: (result) => {
      toast.success(result.idempotent ? "Operazione già registrata" : `${result.spostati} animali aggiunti al gruppo`);
      utils.stalla.gruppi.invalidate();
      utils.stalla.animali.invalidate();
      onCommitted();
      resetAndClose();
    },
    onError: (error) => toast.error(error.message || "Non è stato possibile completare lo spostamento"),
  });

  const availableOrigins = useMemo(() => allGroups.filter((group: any) => group.id !== gruppoDestinazione.id && group.tipoGestione === "manuale" && group.modalitaMembri === "esclusivo"), [allGroups, gruppoDestinazione.id]);
  const selectedCount = selectedAnimalIds.size;
  const stepIndex = WIZARD_STEPS.findIndex((item) => item.id === step);

  function resetAndClose() {
    setStep("origins"); setSourceKeys(new Set()); setSelectedAnimalIds(new Set()); setSearch(""); setConfirmConditionalFactors(false); setIdempotencyKey(crypto.randomUUID()); onOpenChange(false);
  }

  function toggleOrigin(key: SourceKey) {
    setSourceKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    if (sourceKeys.has(key)) {
      const bucket = buckets.find((item) => item.source.key === key);
      if (bucket) setSelectedAnimalIds((previous) => new Set(Array.from(previous).filter((id) => !bucket.animali.some((animal) => animal.id === id))));
    }
  }

  function toggleAnimal(id: string) {
    setSelectedAnimalIds((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleBucket(bucket: SourceBucket) {
    const ids = bucket.animali.map((animal) => animal.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedAnimalIds.has(id));
    setSelectedAnimalIds((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function next() {
    if (step === "origins") { if (!sourceKeys.size) return toast.error("Seleziona almeno un’origine"); setStep("animals"); return; }
    if (step === "animals") { if (!selectedAnimalIds.size) return toast.error("Seleziona almeno un animale"); setStep("review"); }
  }

  const preview = previewQuery.data;
  const blocked = Boolean(preview?.riepilogo.superaCapacita);
  const allSourcesLoaded = buckets.length > 0 && Array.from(selectedAnimalIds).every((id) => idsInSources.has(id));

  return <Sheet open={open} onOpenChange={(value) => value ? onOpenChange(true) : resetAndClose()}>
    <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col rounded-t-2xl p-0" style={{ background: "oklch(0.085 0.006 145)", borderColor: BORDER }}>
      <SheetHeader className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>Aggiungi animali</SheetTitle><p className="mt-1 text-xs" style={{ color: "oklch(0.58 0.01 145)" }}>Nel gruppo {gruppoDestinazione.nome} · Passo {stepIndex + 1} di 3</p></div><button type="button" onClick={resetAndClose} className="flex size-10 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: BORDER, color: "oklch(0.70 0.01 145)" }}><X size={18} /><span className="sr-only">Chiudi</span></button></div>
        <div className="mt-3 grid grid-cols-3 gap-1">{WIZARD_STEPS.map((item, index) => <div key={item.id} className="h-1 rounded-full" style={{ background: index <= stepIndex ? GREEN : SURFACE2 }} />)}</div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {step === "origins" && <OriginsStep groups={availableOrigins as GroupSummary[]} sourceKeys={sourceKeys} onToggle={toggleOrigin} />}
        {step === "animals" && <AnimalsStep buckets={buckets} loading={sourcesQuery.isLoading} selectedAnimalIds={selectedAnimalIds} search={search} onSearch={setSearch} onToggleAnimal={toggleAnimal} onToggleBucket={toggleBucket} />}
        {step === "review" && <ReviewStep preview={preview} loading={previewQuery.isLoading} confirmConditionalFactors={confirmConditionalFactors} onConfirmConditionalFactors={setConfirmConditionalFactors} />}
      </div>

      <footer className="border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" style={{ borderColor: BORDER, background: "oklch(0.08 0.006 145)" }}>
        <div className="flex gap-3">{step !== "origins" && <Button variant="outline" onClick={() => setStep(step === "review" ? "animals" : "origins")} className="min-h-12 border" style={{ borderColor: BORDER, color: "oklch(0.80 0.01 145)" }}><ArrowLeft className="mr-1 size-4" /> Indietro</Button>}
          {step !== "review" ? <Button onClick={next} className="min-h-12 flex-1 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>{step === "origins" ? `Continua · ${sourceKeys.size} origini` : `Riepiloga · ${selectedCount} animali`}<ChevronRight className="ml-1 size-4" /></Button> : <Button disabled={previewQuery.isLoading || blocked || !allSourcesLoaded || commitMut.isPending} onClick={() => commitMut.mutate({ idempotencyKey, nuovoGruppoId: gruppoDestinazione.id, animaleIds: Array.from(selectedAnimalIds), confermaFattori: confirmConditionalFactors, origineAttese: buckets.flatMap((bucket) => bucket.animali.filter((animal) => selectedAnimalIds.has(animal.id)).map((animal) => ({ animaleId: animal.id, gruppoId: bucket.source.gruppoId }))) })} className="min-h-12 flex-1 font-bold" style={{ background: blocked ? SURFACE2 : GREEN, color: blocked ? "oklch(0.50 0.01 145)" : "oklch(0.08 0.01 145)" }}>{commitMut.isPending ? "Conferma…" : `Conferma aggiunta di ${selectedCount} animali`}</Button>}
        </div>
      </footer>
    </SheetContent>
  </Sheet>;
}

function OriginsStep({ groups, sourceKeys, onToggle }: { groups: GroupSummary[]; sourceKeys: Set<SourceKey>; onToggle: (key: SourceKey) => void }) {
  return <section><h3 className="text-base font-bold" style={{ color: "oklch(0.92 0.006 145)" }}>Da quali gruppi vuoi scegliere?</h3><p className="mt-1 text-sm" style={{ color: "oklch(0.58 0.01 145)" }}>Puoi selezionare animali da più origini, incluso chi non ha ancora un gruppo.</p><div className="mt-4 grid grid-cols-2 gap-3">{groups.map((group) => <OriginCard key={group.id} title={group.nome} detail={`${group.nAnimali} disponibili`} selected={sourceKeys.has(sourceKeyFromGroupId(group.id))} onClick={() => onToggle(sourceKeyFromGroupId(group.id))} />)}<OriginCard title="Senza gruppo" detail="Animali non assegnati" selected={sourceKeys.has("ungrouped")} onClick={() => onToggle("ungrouped")} /></div></section>;
}

function OriginCard({ title, detail, selected, onClick }: { title: string; detail: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative min-h-28 rounded-2xl border p-3 text-left" style={{ borderColor: selected ? GREEN : BORDER, background: selected ? `${GREEN}12` : SURFACE }}><span className="absolute right-3 top-3">{selected ? <CheckSquare size={20} style={{ color: GREEN }} /> : <Square size={20} style={{ color: "oklch(0.42 0.01 145)" }} />}</span><Users size={20} style={{ color: selected ? GREEN : "oklch(0.60 0.01 145)" }} /><p className="mt-3 truncate text-sm font-bold" style={{ color: "oklch(0.88 0.006 145)" }}>{title}</p><p className="mt-1 text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>{detail}</p></button>;
}

function AnimalsStep({ buckets, loading, selectedAnimalIds, search, onSearch, onToggleAnimal, onToggleBucket }: { buckets: SourceBucket[]; loading: boolean; selectedAnimalIds: Set<string>; search: string; onSearch: (value: string) => void; onToggleAnimal: (id: string) => void; onToggleBucket: (bucket: SourceBucket) => void }) {
  return <section><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: "oklch(0.55 0.01 145)" }} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Cerca nelle origini selezionate" className="group-input pl-10" /></div>{loading ? <p className="py-10 text-center text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Caricamento animali…</p> : <div className="mt-4 space-y-4">{buckets.map((bucket) => { const ids = bucket.animali.map((animal) => animal.id); const selected = ids.filter((id) => selectedAnimalIds.has(id)).length; return <section key={bucket.source.key} className="overflow-hidden rounded-xl border" style={{ background: SURFACE, borderColor: BORDER }}><div className="flex items-center justify-between gap-2 border-b px-3 py-3" style={{ borderColor: BORDER }}><div><p className="text-sm font-bold" style={{ color: "oklch(0.88 0.006 145)" }}>{bucket.source.nome}</p><p className="text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>{selected} selezionati / {bucket.source.nDisponibili} disponibili</p></div><button type="button" onClick={() => onToggleBucket(bucket)} className="min-h-10 rounded-lg px-2 text-xs font-bold" style={{ color: GREEN }}>{selected === ids.length && ids.length ? "Deseleziona tutti" : "Seleziona tutti"}</button></div><div className="divide-y" style={{ borderColor: BORDER }}>{bucket.animali.map((animal) => <AnimalRow key={animal.id} animal={animal} selected={selectedAnimalIds.has(animal.id)} onClick={() => onToggleAnimal(animal.id)} />)}</div></section>; })}</div>}</section>;
}

function AnimalRow({ animal, selected, onClick }: { animal: SourceBucket["animali"][number]; selected: boolean; onClick: () => void }) {
  const prod = STATO_PRODUTTIVO[animal.statoProduttivo ?? "in_lattazione"] ?? STATO_PRODUTTIVO.in_lattazione;
  const rip = STATO_RIPRODUTTIVO[animal.statoRiproduttivo ?? "vuota"] ?? STATO_RIPRODUTTIVO.vuota;
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-3 text-left" style={{ background: selected ? `${GREEN}0d` : "transparent" }}><span>{selected ? <CheckSquare size={21} style={{ color: GREEN }} /> : <Square size={21} style={{ color: "oklch(0.40 0.01 145)" }} />}</span><span className="flex size-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${prod.color}20`, color: prod.color }}>{animal.matricola.slice(-2)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" style={{ color: "oklch(0.88 0.006 145)" }}>{animal.nome || animal.matricola}</span><span className="block truncate text-xs" style={{ color: "oklch(0.52 0.01 145)" }}>{animal.matricola}{animal.numeroAziendale ? ` · N° ${animal.numeroAziendale}` : ""}</span></span><span className="hidden shrink-0 gap-1 sm:flex"><StatoBadge label={prod.label} color={prod.color} /><StatoBadge label={rip.label} color={rip.color} /></span></button>;
}

function ReviewStep({ preview, loading, confirmConditionalFactors, onConfirmConditionalFactors }: { preview: any; loading: boolean; confirmConditionalFactors: boolean; onConfirmConditionalFactors: (value: boolean) => void }) {
  if (loading || !preview) return <p className="py-10 text-center text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Preparo il riepilogo…</p>;
  const { riepilogo } = preview;
  return <section className="space-y-4"><div className="rounded-xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}><p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: GREEN }}>Destinazione</p><p className="mt-1 text-lg font-bold" style={{ color: "oklch(0.92 0.006 145)" }}>{preview.gruppo.nome}</p><p className="mt-2 text-sm" style={{ color: "oklch(0.64 0.01 145)" }}>{riepilogo.trovati} animali · {riepilogo.capacitaAttuale} → {riepilogo.capacitaDopo}{riepilogo.capacitaMax != null ? ` / ${riepilogo.capacitaMax}` : ""}</p></div>{riepilogo.superaCapacita && <div className="flex gap-2 rounded-xl border p-3" style={{ background: "oklch(0.63 0.22 25 / .12)", borderColor: "oklch(0.63 0.22 25 / .55)", color: "oklch(0.82 0.16 25)" }}><CircleAlert className="mt-0.5 size-5 shrink-0" /><p className="text-sm font-semibold">Capacità massima superata. Riduci gli animali selezionati prima di confermare.</p></div>}<div className="rounded-xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}><p className="text-sm font-bold" style={{ color: "oklch(0.88 0.006 145)" }}>Origini</p><div className="mt-2 space-y-1">{preview.perOrigine.map((origin: any) => <p key={origin.source.key} className="text-sm" style={{ color: "oklch(0.63 0.01 145)" }}>{origin.source.nome}: <strong style={{ color: "oklch(0.86 0.006 145)" }}>{origin.totale}</strong></p>)}</div></div><div className="rounded-xl border p-4" style={{ background: SURFACE, borderColor: BORDER }}><p className="text-sm font-bold" style={{ color: "oklch(0.88 0.006 145)" }}>Fattori del gruppo</p><p className="mt-1 text-xs" style={{ color: "oklch(0.58 0.01 145)" }}>{riepilogo.automatici} automatici · {riepilogo.conferme} con conferma · {riepilogo.suggerimenti} suggerimenti</p>{riepilogo.conferme > 0 && <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg p-2" style={{ background: SURFACE2 }}><input type="checkbox" checked={confirmConditionalFactors} onChange={(event) => onConfirmConditionalFactors(event.target.checked)} className="mt-0.5" /><span className="text-sm" style={{ color: "oklch(0.74 0.01 145)" }}>Applica le modifiche di stato che richiedono conferma</span></label>}</div></section>;
}
