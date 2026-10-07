import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Building2, CheckCircle2, ExternalLink, Loader2, Pencil, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type CompanyRow = { company: { id: string; name: string; email?: string | null; settore?: string | null; attiva: boolean }; membership: { roleCode: string } };

export default function SelezionaAzienda() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.access.myCompanies.useQuery();
  const { data: current } = trpc.company.current.useQuery();
  const { data: access } = trpc.access.me.useQuery();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CompanyRow["company"] | null>(null);
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const [newName, setNewName] = useState("");

  const visibleCompanies = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return normalized ? (companies ?? []).filter((row) => row.company.name.toLowerCase().includes(normalized)) : companies ?? [];
  }, [companies, search]);
  const invalidateCompanies = async () => {
    await Promise.all([utils.access.myCompanies.invalidate(), utils.access.superAdminCompanies.invalidate(), utils.company.current.invalidate()]);
  };
  const switchCompany = trpc.access.switchCompany.useMutation({
    onSuccess: async (result) => {
      await invalidateCompanies();
      toast.success(`Azienda attiva: ${result.companyName}`);
      navigate("/");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateCompany = trpc.access.updateCompany.useMutation({
    onSuccess: async () => {
      await invalidateCompanies();
      toast.success("Nome azienda aggiornato");
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const archiveCompany = trpc.access.archiveCompany.useMutation({
    onSuccess: async (result) => {
      await invalidateCompanies();
      toast.success(`${result.companyName} è stata archiviata`);
      setConfirmAction(null);
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteCompany = trpc.access.deleteCompany.useMutation({
    onSuccess: async (result) => {
      await invalidateCompanies();
      toast.success(`${result.companyName} è stata eliminata`);
      setConfirmAction(null);
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const openEditor = (company: CompanyRow["company"]) => {
    setNewName(company.name);
    setEditing(company);
  };
  const activeMutation = archiveCompany.isPending || deleteCompany.isPending || updateCompany.isPending;
  const isCurrentEditorCompany = editing?.id === current?.id;

  return <div className="mx-auto w-full max-w-md animate-fade-in-up pb-8"><header className="mb-5 flex items-center gap-3"><button onClick={() => navigate("/account")} className="rounded-xl p-2" aria-label="Torna all’account"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="fal-eyebrow" style={{ color: GOLD }}>Account Fallinity</p><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Cambia azienda</h1><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Scegli l’azienda con cui vuoi lavorare.</p></div></header>
    <section className="mb-5 rounded-2xl border p-4" style={{ background: `${GOLD}12`, borderColor: `${GOLD}55` }}><p className="flex items-center gap-2 text-sm font-semibold" style={{ color: GOLD }}><ShieldCheck size={17} /> Accessi personali</p><p className="mt-1 text-xs" style={{ color: "oklch(0.62 0.01 145)" }}>Puoi entrare solo nelle aziende in cui possiedi un accesso attivo.</p></section>
    {isLoading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: GREEN }} /></div> : <><label className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ background: PANEL, borderColor: BORDER }}><Search size={17} style={{ color: "oklch(0.55 0.01 145)" }} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Cerca un’azienda" aria-label="Cerca un’azienda" /></label>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "oklch(0.52 0.01 145)" }}>Aziende disponibili</p><div className="space-y-3">{visibleCompanies.map((row) => {
        const active = row.company.id === current?.id;
        const opening = switchCompany.isPending && switchCompany.variables?.companyId === row.company.id;
        return <article key={row.company.id} className="rounded-2xl border p-4" style={{ background: active ? `${GREEN}10` : PANEL, borderColor: active ? `${GREEN}88` : BORDER }}><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: active ? `${GREEN}22` : `${GOLD}16`, color: active ? GREEN : GOLD }}><Building2 size={20} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-semibold">{row.company.name}</span>{active && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${GREEN}22`, color: GREEN }}>ATTIVA</span>}</span><span className="mt-1 flex items-center gap-1 text-xs" style={{ color: "oklch(0.58 0.01 145)" }}><Users size={13} /> {roleLabel[row.membership.roleCode] ?? row.membership.roleCode}</span></span>{active && <CheckCircle2 size={19} style={{ color: GREEN }} />}</div>
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={!access?.isSuperAdmin || activeMutation} onClick={() => openEditor(row.company)} className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45" style={{ borderColor: `${GOLD}66`, color: GOLD }}><Pencil size={16} /> Modifica</button><button type="button" disabled={active || switchCompany.isPending || activeMutation} onClick={() => switchCompany.mutate({ companyId: row.company.id })} className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:cursor-default disabled:opacity-60" style={{ background: `${GREEN}20`, color: GREEN }}>{opening ? <Loader2 className="animate-spin" size={16} /> : active ? <CheckCircle2 size={16} /> : <ExternalLink size={16} />}{active ? "Aperta" : "Apri"}</button></div>
          {!access?.isSuperAdmin && <p className="mt-2 text-center text-[11px]" style={{ color: "oklch(0.48 0.01 145)" }}>La modifica delle aziende è riservata al Super Admin.</p>}
        </article>;
      })}{!companies?.length && <section className="rounded-2xl border p-8 text-center" style={{ background: PANEL, borderColor: BORDER }}><Building2 className="mx-auto mb-3" size={34} style={{ color: "oklch(0.45 0.01 145)" }} /><p className="font-semibold">Nessuna azienda disponibile</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Chiedi a un amministratore di inviarti un accesso.</p></section>}{Boolean(companies?.length && !visibleCompanies.length) && <section className="rounded-2xl border p-7 text-center" style={{ background: PANEL, borderColor: BORDER }}><p className="font-semibold">Nessuna corrispondenza</p><p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Modifica la ricerca per trovare un’altra azienda.</p></section>}</div></>}

    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !activeMutation) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto" style={{ background: PANEL, borderColor: BORDER }}><DialogHeader><DialogTitle>Modifica azienda</DialogTitle><DialogDescription>{editing ? `Gestisci “${editing.name}”.` : ""}</DialogDescription></DialogHeader>{editing && <div className="space-y-4"><label className="block text-sm font-medium">Nome azienda<input value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3" style={{ borderColor: BORDER }} /></label><button type="button" disabled={newName.trim().length < 2 || activeMutation} onClick={() => updateCompany.mutate({ id: editing.id, name: newName.trim(), email: editing.email || "", settore: editing.settore || "", attiva: editing.attiva })} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold disabled:opacity-60" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><Pencil size={16} /> Cambia nome</button>{isCurrentEditorCompany ? <p className="rounded-xl px-3 py-2 text-xs" style={{ background: `${GOLD}14`, color: GOLD }}>Per archiviare o eliminare questa azienda, apri prima un’altra azienda.</p> : <div className="grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: BORDER }}><button type="button" disabled={!editing.attiva || activeMutation} onClick={() => setConfirmAction("archive")} className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: `${GOLD}66`, color: GOLD }}><Archive size={16} /> Archivia</button><button type="button" disabled={activeMutation} onClick={() => setConfirmAction("delete")} className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "oklch(0.64 0.2 25 / 0.7)", color: "oklch(0.7 0.2 25)" }}><Trash2 size={16} /> Elimina</button></div>}<DialogFooter><button type="button" disabled={activeMutation} onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER }}>Chiudi</button></DialogFooter></div>}</DialogContent></Dialog>
    <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open && !activeMutation) setConfirmAction(null); }}><AlertDialogContent style={{ background: PANEL, borderColor: BORDER }}><AlertDialogHeader><AlertDialogTitle>{confirmAction === "archive" ? "Archivia questa azienda?" : "Elimina questa azienda?"}</AlertDialogTitle><AlertDialogDescription>{confirmAction === "archive" ? "L’azienda non sarà più apribile e verrà rimossa dagli elenchi operativi. I dati restano conservati." : "L’azienda sarà rimossa dagli elenchi tramite eliminazione logica. I dati restano protetti per audit, ma l’operazione richiede una conferma."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={activeMutation}>Annulla</AlertDialogCancel><AlertDialogAction disabled={activeMutation} onClick={() => { if (!editing) return; if (confirmAction === "archive") archiveCompany.mutate({ companyId: editing.id }); else deleteCompany.mutate({ companyId: editing.id }); }} className={confirmAction === "delete" ? "bg-red-600 text-white hover:bg-red-700" : ""}>{activeMutation ? "Operazione…" : confirmAction === "archive" ? "Conferma archiviazione" : "Conferma eliminazione"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
