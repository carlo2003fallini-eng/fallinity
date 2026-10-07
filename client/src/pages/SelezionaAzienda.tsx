import { useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, Eye, EyeOff, Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const PANEL = "oklch(0.11 0.009 145)";
const BORDER = "oklch(0.2 0.012 145)";

const roleLabel: Record<string, string> = {
  company_admin: "Amministratore azienda",
  organization_admin: "Amministratore organizzazione",
  manager: "Responsabile",
  operator: "Operatore",
  consultant: "Consulente",
  viewer: "Consultazione",
};

export default function SelezionaAzienda() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.access.myCompanies.useQuery();
  const { data: current } = trpc.company.current.useQuery();
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const filteredCompanies = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return normalized ? (companies ?? []).filter((row) => row.company.name.toLowerCase().includes(normalized)) : companies ?? [];
  }, [companies, search]);
  const listedCompanies = useMemo(() => filteredCompanies.filter((row) => showHidden ? row.hidden : !row.hidden), [filteredCompanies, showHidden]);
  const hiddenCount = useMemo(() => (companies ?? []).filter((row) => row.hidden).length, [companies]);

  const switchCompany = trpc.access.switchCompany.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.company.current.invalidate(), utils.access.me.invalidate(), utils.access.myCompanies.invalidate()]);
      toast.success(`Azienda attiva: ${result.companyName}`);
      navigate("/");
    },
    onError: (error) => toast.error(error.message),
  });
  const setCompanyHidden = trpc.access.setCompanyHidden.useMutation({
    onSuccess: async (_, input) => {
      await utils.access.myCompanies.invalidate();
      toast.success(input.hidden ? "Azienda nascosta dal tuo elenco" : "Azienda ripristinata nel tuo elenco");
    },
    onError: (error) => toast.error(error.message),
  });

  return <div className="mx-auto w-full max-w-md animate-fade-in-up pb-8"><header className="mb-5 flex items-center gap-3"><button onClick={() => navigate("/account")} className="rounded-xl p-2" aria-label="Torna all’account"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="fal-eyebrow" style={{ color: GOLD }}>Account Fallinity</p><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Cambia azienda</h1><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Scegli l’azienda con cui vuoi lavorare.</p></div></header>
    <section className="mb-5 rounded-2xl border p-4" style={{ background: `${GOLD}12`, borderColor: `${GOLD}55` }}><p className="flex items-center gap-2 text-sm font-semibold" style={{ color: GOLD }}><ShieldCheck size={17} /> Accessi personali</p><p className="mt-1 text-xs" style={{ color: "oklch(0.62 0.01 145)" }}>Puoi entrare solo nelle aziende in cui possiedi un accesso attivo.</p></section>
    {isLoading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: GREEN }} /></div> : <><label className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ background: PANEL, borderColor: BORDER }}><Search size={17} style={{ color: "oklch(0.55 0.01 145)" }} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Cerca un’azienda" aria-label="Cerca un’azienda" /></label>
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "oklch(0.52 0.01 145)" }}>{showHidden ? "Aziende nascoste" : "Aziende disponibili"}</p>{hiddenCount > 0 && <button type="button" onClick={() => setShowHidden((open) => !open)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: showHidden ? GREEN : GOLD }}>{showHidden ? <Eye size={15} /> : <EyeOff size={15} />}{showHidden ? "Torna all’elenco" : `Nascoste (${hiddenCount})`}</button>}</div>
      <div className="space-y-3">{listedCompanies.map((row) => {
        const active = row.company.id === current?.id;
        const changing = switchCompany.isPending && switchCompany.variables?.companyId === row.company.id;
        const updatingVisibility = setCompanyHidden.isPending && setCompanyHidden.variables?.companyId === row.company.id;
        return <article key={row.company.id} className="overflow-hidden rounded-2xl border" style={{ background: active ? `${GREEN}10` : PANEL, borderColor: active ? `${GREEN}88` : BORDER }}><button type="button" disabled={active || switchCompany.isPending || setCompanyHidden.isPending} onClick={() => switchCompany.mutate({ companyId: row.company.id })} className="w-full p-4 text-left transition-transform enabled:active:scale-[0.98] disabled:cursor-default"><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: active ? `${GREEN}22` : `${GOLD}16`, color: active ? GREEN : GOLD }}><Building2 size={20} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-semibold">{row.company.name}</span>{active && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${GREEN}22`, color: GREEN }}>ATTIVA</span>}</span><span className="mt-1 flex items-center gap-1 text-xs" style={{ color: "oklch(0.58 0.01 145)" }}><Users size={13} /> {roleLabel[row.membership.roleCode] ?? row.membership.roleCode}</span></span>{changing ? <Loader2 className="animate-spin" size={18} style={{ color: GREEN }} /> : active ? <CheckCircle2 size={19} style={{ color: GREEN }} /> : <ChevronRight size={19} style={{ color: "oklch(0.45 0.01 145)" }} />}</div></button>
          {!active && <div className="border-t px-4 py-2.5" style={{ borderColor: BORDER }}><button type="button" disabled={setCompanyHidden.isPending || switchCompany.isPending} onClick={() => setCompanyHidden.mutate({ companyId: row.company.id, hidden: !showHidden })} className="flex w-full items-center justify-center gap-2 text-xs font-semibold disabled:opacity-60" style={{ color: showHidden ? GREEN : "oklch(0.62 0.01 145)" }}>{updatingVisibility ? <Loader2 className="animate-spin" size={15} /> : showHidden ? <Eye size={15} /> : <EyeOff size={15} />}{showHidden ? "Ripristina nel mio elenco" : "Nascondi dal mio elenco"}</button></div>}
        </article>;
      })}{!companies?.length && <section className="rounded-2xl border p-8 text-center" style={{ background: PANEL, borderColor: BORDER }}><Building2 className="mx-auto mb-3" size={34} style={{ color: "oklch(0.45 0.01 145)" }} /><p className="font-semibold">Nessuna azienda disponibile</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Chiedi a un amministratore di inviarti un accesso.</p></section>}{Boolean(companies?.length && !listedCompanies.length) && <section className="rounded-2xl border p-7 text-center" style={{ background: PANEL, borderColor: BORDER }}><p className="font-semibold">{showHidden ? "Nessuna azienda nascosta" : "Nessuna corrispondenza"}</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>{showHidden ? "Le aziende nascoste saranno disponibili qui per il ripristino." : "Modifica la ricerca o apri l’elenco delle aziende nascoste."}</p></section>}</div></>}
  </div>;
}
