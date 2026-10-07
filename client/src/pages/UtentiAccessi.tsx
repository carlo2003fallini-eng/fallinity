import { useMemo, useState } from "react";
import { ArrowLeft, Check, MailPlus, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ACCESS_MODULES, type AccessModuleKey } from "@shared/access";

const ROLES = [
  ["company_admin", "Amministratore azienda"], ["manager", "Responsabile"], ["operator", "Operatore"], ["consultant", "Consulente"], ["viewer", "Solo visualizzazione"],
] as const;
const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const PANEL = "oklch(0.11 0.009 145)";
const BORDER = "oklch(0.2 0.012 145)";

function ModuleSelector({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const groups = useMemo(() => Array.from(new Set(ACCESS_MODULES.map((item) => item.group))), []);
  const toggle = (key: AccessModuleKey) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return <div className="space-y-4">{groups.map((group) => <div key={group}><p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>{group}</p><div className="space-y-2">{ACCESS_MODULES.filter((item) => item.group === group).map((item) => <label key={item.key} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: BORDER, background: "oklch(0.09 0.007 145)" }}><input type="checkbox" checked={value.includes(item.key)} onChange={() => toggle(item.key)} className="size-4 accent-green-500" /><span className="text-sm">{item.label}</span></label>)}</div></div>)}</div>;
}

export default function UtentiAccessi() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: access } = trpc.access.me.useQuery();
  const { data, isLoading } = trpc.access.companyUsers.useQuery();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number][0]>("operator");
  const [modules, setModules] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<(typeof ROLES)[number][0]>("operator");
  const [editingActive, setEditingActive] = useState(true);
  const [editingModules, setEditingModules] = useState<string[]>([]);
  const invite = trpc.access.inviteUser.useMutation({ onSuccess: (result) => { toast.success(result.type === "linked" ? "Utente collegato all’azienda" : "Invito registrato: verrà attivato al primo accesso con questa email"); setInviteOpen(false); setEmail(""); setModules([]); void utils.access.companyUsers.invalidate(); }, onError: (error) => toast.error(error.message) });
  const update = trpc.access.updateUser.useMutation({ onSuccess: () => { toast.success("Accessi aggiornati"); setEditingId(null); void utils.access.companyUsers.invalidate(); }, onError: (error) => toast.error(error.message) });

  const startEdit = (user: any) => { setEditingId(user.id); setEditingRole(user.ruolo); setEditingActive(user.attivo); setEditingModules(user.moduli ?? []); };
  const submitInvite = () => invite.mutate({ email, roleCode: role, moduleKeys: modules as AccessModuleKey[] });

  if (access && !access.isCompanyAdmin) return <div className="mx-auto max-w-md py-16 text-center"><ShieldCheck className="mx-auto mb-4" size={32} style={{ color: "oklch(0.72 0.15 75)" }} /><h1 className="text-xl font-bold">Accesso riservato</h1><p className="mt-2 text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Solo l’amministratore della tua azienda può gestire utenti e permessi.</p><button onClick={() => navigate("/account")} className="mt-5 rounded-xl px-4 py-3 font-semibold" style={{ background: "oklch(0.65 0.18 142)", color: "oklch(0.08 0.01 145)" }}>Torna all’account</button></div>;

  return <div className="mx-auto w-full max-w-md animate-fade-in-up pb-8">
    <header className="mb-5 flex items-center gap-3"><button onClick={() => navigate("/account")} className="rounded-xl p-2" aria-label="Torna all’account"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="fal-eyebrow">Account azienda</p><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Utenti e accessi</h1></div></header>
    <button onClick={() => setInviteOpen((open) => !open)} className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><MailPlus size={18} /> + AGGIUNGI UTENTE</button>
    {inviteOpen && <section className="mb-5 rounded-2xl border p-4" style={{ background: PANEL, borderColor: `${GREEN}80` }}><div className="mb-4 flex items-center gap-2"><MailPlus size={18} style={{ color: GOLD }} /><h2 className="font-semibold">Invita per email</h2></div><label className="mb-3 block text-xs" style={{ color: "oklch(0.6 0.01 145)" }}>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="persona@azienda.it" className="mt-1.5 w-full rounded-xl border bg-transparent px-3 py-3 text-sm" style={{ borderColor: BORDER }} /></label><label className="mb-4 block text-xs" style={{ color: "oklch(0.6 0.01 145)" }}>Ruolo<select value={role} onChange={(event) => setRole(event.target.value as any)} className="mt-1.5 w-full rounded-xl border bg-transparent px-3 py-3 text-sm" style={{ borderColor: BORDER }}>{ROLES.map(([value, label]) => <option className="bg-neutral-950" key={value} value={value}>{label}</option>)}</select></label><ModuleSelector value={modules} onChange={setModules} /><button disabled={!email || invite.isPending} onClick={submitInvite} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><Check size={17} />{invite.isPending ? "Salvataggio…" : "Registra invito"}</button></section>}
    <div className="space-y-3">{isLoading && <p className="py-6 text-center text-sm" style={{ color: "oklch(0.55 0.01 145)" }}>Caricamento utenti…</p>}{data?.users.map((user) => <section key={user.id} className="rounded-2xl border p-4" style={{ background: PANEL, borderColor: BORDER }}><div className="flex gap-3"><span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${GREEN}18`, color: GREEN }}><UsersRound size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{user.nome}</p><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: user.attivo ? `${GREEN}20` : "oklch(0.3 0.01 145)", color: user.attivo ? GREEN : "oklch(0.55 0.01 145)" }}>{user.attivo ? "ATTIVO" : "DISATTIVO"}</span></div><p className="truncate text-xs" style={{ color: "oklch(0.55 0.01 145)" }}>{user.email}</p><p className="mt-1 text-xs" style={{ color: GOLD }}>{ROLES.find(([value]) => value === user.ruolo)?.[1] ?? user.ruolo} · {user.moduli.length} accessi</p></div></div><button onClick={() => startEdit(user)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold" style={{ borderColor: `${GREEN}66`, color: GREEN }}><UserCog size={16} /> Gestisci accessi</button>{editingId === user.id && <div className="mt-4 border-t pt-4" style={{ borderColor: BORDER }}><label className="mb-3 flex items-center justify-between text-sm"><span>Utente attivo</span><input checked={editingActive} onChange={(event) => setEditingActive(event.target.checked)} type="checkbox" className="size-4 accent-green-500" /></label><label className="mb-4 block text-xs" style={{ color: "oklch(0.6 0.01 145)" }}>Ruolo<select value={editingRole} onChange={(event) => setEditingRole(event.target.value as any)} className="mt-1.5 w-full rounded-xl border bg-transparent px-3 py-3 text-sm" style={{ borderColor: BORDER }}>{ROLES.map(([value, label]) => <option className="bg-neutral-950" key={value} value={value}>{label}</option>)}</select></label><ModuleSelector value={editingModules} onChange={setEditingModules} /><button disabled={update.isPending} onClick={() => update.mutate({ userId: user.id, roleCode: editingRole, attiva: editingActive, moduleKeys: editingModules as AccessModuleKey[] })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}><ShieldCheck size={17} /> Salva accessi</button></div>}</section>)}
    {data?.invitations.map((invite) => <section key={invite.id} className="rounded-2xl border border-dashed p-4" style={{ borderColor: BORDER }}><p className="font-semibold">{invite.email}</p><p className="mt-1 text-xs" style={{ color: GOLD }}>Invito in attesa · {invite.moduli.length} accessi selezionati</p></section>)}</div>
  </div>;
}
