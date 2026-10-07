import { useState } from "react";
import { CheckCircle2, Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";
const PANEL = "oklch(0.1 0.008 145)";
const BORDER = "oklch(0.2 0.012 145)";

type InvitationStatus = "pending" | "accepted" | "revoked" | "not_found";

function InvitationState({ status }: { status: Exclude<InvitationStatus, "pending"> }) {
  const content = status === "accepted"
    ? { icon: <CheckCircle2 size={38} style={{ color: GREEN }} />, title: "Invito già utilizzato", text: "Questo invito è già stato accettato. Accedi al tuo account per continuare.", action: "Vai a Fallinity" }
    : status === "revoked"
      ? { icon: <ShieldAlert size={38} style={{ color: GOLD }} />, title: "Invito revocato", text: "Questo invito non è più disponibile. Chiedi all’amministratore di inviartene uno nuovo.", action: "" }
      : { icon: <ShieldAlert size={38} style={{ color: GOLD }} />, title: "Link non valido", text: "Il link è incompleto, non esiste oppure non è più disponibile.", action: "" };
  return <main className="w-full max-w-md rounded-3xl border p-7 text-center" style={{ background: PANEL, borderColor: BORDER }}><div className="mx-auto mb-4">{content.icon}</div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Invito Fallinity</p><h1 className="mt-2 text-2xl font-bold">{content.title}</h1><p className="mt-3 text-sm text-muted-foreground">{content.text}</p>{content.action && <button onClick={() => { window.location.href = "/"; }} className="mt-6 w-full rounded-xl py-3 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>{content.action}</button>}</main>;
}

export default function Invito() {
  const [, params] = useRoute("/invito/:token");
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const token = params?.token ?? "";
  const { data: preview, isLoading: previewLoading } = trpc.access.invitationPreview.useQuery({ token }, { enabled: token.length >= 32, retry: false });
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);
  const acceptInvitation = trpc.access.acceptInvitation.useMutation({
    onSuccess: (result) => {
      if (result.status === "accepted") {
        sessionStorage.removeItem("fallinity:invitation-token");
        window.location.href = "/";
        return;
      }
      setAcceptanceError(result.status === "email_mismatch" ? "Accedi con lo stesso indirizzo email a cui è stato inviato l’invito." : "Questo invito non può essere accettato.");
    },
    onError: (error) => setAcceptanceError(error.message),
  });

  const startAccess = () => {
    sessionStorage.setItem("fallinity:invitation-token", token);
    window.location.href = getLoginUrl();
  };

  const visibleStatus: InvitationStatus = !token || token.length < 32 ? "not_found" : preview?.status ?? "pending";
  if (loading || previewLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Verifica invito…</p></div>;
  if (visibleStatus !== "pending") return <div className="flex min-h-screen items-center justify-center bg-background p-5"><InvitationState status={visibleStatus} /></div>;

  return <div className="flex min-h-screen items-center justify-center bg-background p-5"><main className="w-full max-w-md rounded-3xl border p-7 text-center" style={{ background: PANEL, borderColor: BORDER }}><span className="mx-auto flex size-14 items-center justify-center rounded-2xl" style={{ background: `${GREEN}18`, color: GREEN }}><Link2 size={27} /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Invito Fallinity</p><h1 className="mt-2 text-2xl font-bold">Sei stato invitato</h1><p className="mt-3 text-sm text-muted-foreground">Hai ricevuto un invito per <strong>{preview?.companyName ?? "un’azienda Fallinity"}</strong>. L’accesso verrà assegnato secondo i permessi definiti dall’amministratore.</p><div className="mt-5 flex gap-2 rounded-xl border p-3 text-left text-xs" style={{ borderColor: `${GOLD}55`, background: `${GOLD}10` }}><ShieldCheck className="mt-0.5 shrink-0" size={16} style={{ color: GOLD }} /><span>Il link è valido solo per l’account con l’email invitata e può essere accettato una sola volta.</span></div>{user ? <><button disabled={acceptInvitation.isPending} onClick={() => { setAcceptanceError(null); acceptInvitation.mutate({ token }); }} className="mt-6 w-full rounded-xl py-3 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>{acceptInvitation.isPending ? "Verifica in corso…" : "Accetta invito e apri Fallinity"}</button>{acceptanceError && <p className="mt-3 text-sm" style={{ color: "oklch(0.72 0.15 45)" }}>{acceptanceError}</p>}</> : <button onClick={startAccess} className="mt-6 w-full rounded-xl py-3 font-bold" style={{ background: GREEN, color: "oklch(0.08 0.01 145)" }}>Accedi con l’email invitata</button>}<button onClick={() => navigate("/")} className="mt-3 text-sm font-semibold" style={{ color: "oklch(0.62 0.01 145)" }}>Torna a Fallinity</button></main></div>;
}
