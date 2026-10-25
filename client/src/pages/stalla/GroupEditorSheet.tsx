import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BORDER, GREEN, SURFACE, SURFACE2, TIPOLOGIA_GRUPPO } from "./shared";
import type { GroupSummary } from "./group-types";

type FormState = {
  nome: string;
  tipologia: string;
  capacitaMax: string;
  descrizione: string;
  tipoGestione: "manuale" | "automatico";
  modalitaMembri: "esclusivo" | "personalizzato";
  regolaTipo: "alta_produzione" | "post_parto";
  soglia: string;
};

const EMPTY: FormState = { nome: "", tipologia: "personalizzato", capacitaMax: "", descrizione: "", tipoGestione: "manuale", modalitaMembri: "personalizzato", regolaTipo: "alta_produzione", soglia: "32" };

function toForm(group?: GroupSummary | null): FormState {
  if (!group) return EMPTY;
  const regola = group.regolaAutomatica;
  return {
    nome: group.nome, tipologia: group.tipologia, capacitaMax: group.capacitaMax?.toString() ?? "", descrizione: "",
    tipoGestione: group.tipoGestione, modalitaMembri: group.modalitaMembri,
    regolaTipo: regola?.tipo ?? "alta_produzione",
    soglia: regola?.tipo === "alta_produzione" ? String(regola.sogliaLitriGiorno) : String(regola?.tipo === "post_parto" ? regola.giorniMassimi : 32),
  };
}

export default function GroupEditorSheet({ open, onOpenChange, group, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; group?: GroupSummary | null; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(() => toForm(group));
  useEffect(() => { if (open) setForm(toForm(group)); }, [group, open]);
  const createMut = trpc.stalla.gruppi.create.useMutation({ onSuccess: () => { toast.success("Gruppo creato"); onSaved(); onOpenChange(false); } });
  const updateMut = trpc.stalla.gruppi.update.useMutation({ onSuccess: () => { toast.success("Gruppo aggiornato"); onSaved(); onOpenChange(false); } });
  const pending = createMut.isPending || updateMut.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const automatico = form.tipoGestione === "automatico";
  const personale = !automatico && form.modalitaMembri === "personalizzato";

  function save() {
    if (!form.nome.trim()) { toast.error("Inserisci il nome del gruppo"); return; }
    const capacitaMax = form.capacitaMax ? Number(form.capacitaMax) : undefined;
    if (capacitaMax !== undefined && (!Number.isInteger(capacitaMax) || capacitaMax <= 0)) { toast.error("La capacità deve essere un numero positivo"); return; }
    const regolaAutomatica = automatico
      ? form.regolaTipo === "alta_produzione"
        ? { tipo: "alta_produzione" as const, sogliaLitriGiorno: Number(form.soglia) }
        : { tipo: "post_parto" as const, giorniMassimi: Number(form.soglia) }
      : null;
    if (automatico && (!Number.isFinite(Number(form.soglia)) || Number(form.soglia) <= 0)) { toast.error("Inserisci un valore valido per la regola"); return; }
    const payload = {
      nome: form.nome.trim(), tipologia: form.tipologia as any, descrizione: form.descrizione || undefined, capacitaMax,
      tipoGestione: form.tipoGestione, modalitaMembri: automatico ? "esclusivo" as const : form.modalitaMembri,
      regolaAutomatica,
      applicaFattoriPredefiniti: false,
    };
    if (group) updateMut.mutate({ id: group.id, ...payload }); else createMut.mutate(payload);
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl" style={{ background: "oklch(0.09 0.006 145)", borderColor: BORDER }}>
      <SheetHeader><SheetTitle style={{ color: "oklch(0.96 0.005 145)" }}>{group ? "Modifica gruppo" : "Nuovo gruppo"}</SheetTitle></SheetHeader>
      <div className="mt-5 space-y-4 pb-5">
        <Field label="Nome gruppo"><input value={form.nome} onChange={(event) => set("nome", event.target.value)} placeholder="es. Alta produzione" className="group-input" /></Field>
        <Field label="Tipologia"><select value={form.tipologia} onChange={(event) => { const tipologia = event.target.value; set("tipologia", tipologia); if (tipologia !== "personalizzato" && form.modalitaMembri === "personalizzato") set("modalitaMembri", "esclusivo"); }} className="group-input">{Object.entries(TIPOLOGIA_GRUPPO).map(([id, type]) => <option key={id} value={id}>{type.label}</option>)}</select></Field>
        <Field label="Capacità massima"><input value={form.capacitaMax} onChange={(event) => set("capacitaMax", event.target.value)} inputMode="numeric" placeholder="Opzionale" className="group-input" /></Field>
        <Field label="Descrizione"><textarea value={form.descrizione} onChange={(event) => set("descrizione", event.target.value)} rows={2} placeholder="Opzionale" className="group-input resize-none" /></Field>

        <section className="rounded-xl border p-3" style={{ background: SURFACE, borderColor: BORDER }}>
          <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: "oklch(0.55 0.01 145)" }}>Gestione appartenenze</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["manuale", "automatico"] as const).map((value) => <button key={value} type="button" onClick={() => set("tipoGestione", value)} className="min-h-12 rounded-xl border px-3 text-sm font-bold" style={{ borderColor: form.tipoGestione === value ? GREEN : BORDER, background: form.tipoGestione === value ? `${GREEN}16` : SURFACE2, color: form.tipoGestione === value ? GREEN : "oklch(0.72 0.01 145)" }}>{value === "manuale" ? "Manuale" : "Automatico"}</button>)}
          </div>
          {automatico ? <div className="mt-3 space-y-2">
            <p className="text-xs" style={{ color: "oklch(0.62 0.01 145)" }}>I membri sono calcolati dal server e non possono essere spostati manualmente.</p>
            <select value={form.regolaTipo} onChange={(event) => { set("regolaTipo", event.target.value as FormState["regolaTipo"]); set("soglia", event.target.value === "alta_produzione" ? "32" : "21"); }} className="group-input"><option value="alta_produzione">Alta produzione</option><option value="post_parto">Post-parto</option></select>
            <Field label={form.regolaTipo === "alta_produzione" ? "Soglia litri/giorno" : "Giorni dal parto"}><input value={form.soglia} onChange={(event) => set("soglia", event.target.value)} inputMode="decimal" className="group-input" /></Field>
          </div> : <div className="mt-3">
            <p className="text-xs" style={{ color: "oklch(0.62 0.01 145)" }}>Un gruppo operativo sposta l’animale; un gruppo personale può sovrapporsi ad altri gruppi.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set("modalitaMembri", "esclusivo")} className="min-h-11 rounded-lg border px-2 text-xs font-bold" style={{ borderColor: !personale ? GREEN : BORDER, background: !personale ? `${GREEN}16` : SURFACE2, color: !personale ? GREEN : "oklch(0.68 0.01 145)" }}>Operativo</button>
              <button type="button" disabled={form.tipologia !== "personalizzato"} onClick={() => set("modalitaMembri", "personalizzato")} className="min-h-11 rounded-lg border px-2 text-xs font-bold disabled:opacity-45" style={{ borderColor: personale ? GREEN : BORDER, background: personale ? `${GREEN}16` : SURFACE2, color: personale ? GREEN : "oklch(0.68 0.01 145)" }}>Personale</button>
            </div>
          </div>}
        </section>
        <Button onClick={save} disabled={pending} className="min-h-12 w-full text-sm font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>{pending ? "Salvataggio…" : group ? "Salva modifiche" : "Crea gruppo"}</Button>
      </div>
    </SheetContent>
  </Sheet>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold" style={{ color: "oklch(0.60 0.01 145)" }}>{label}</span>{children}</label>;
}
