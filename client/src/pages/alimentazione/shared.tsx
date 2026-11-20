import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
export const PANEL =
  "rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5";
export const INPUT =
  "min-h-12 w-full min-w-0 rounded-xl border border-white/15 bg-black px-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50";
export const ACTION =
  "min-h-12 rounded-xl bg-green-600 px-4 font-semibold text-white hover:bg-green-500 disabled:opacity-40";
export const qty = (v: number | null | undefined, unit = "") =>
  v == null || !Number.isFinite(v)
    ? "Dato non disponibile"
    : `${v.toLocaleString("it-IT", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
export const eur = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "Costo non disponibile"
    : v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
export const dateTime = (v: number) => new Date(v).toLocaleString("it-IT");
export function useFeed() {
  const { user } = useAuth();
  const query = trpc.alimentazione.data.useQuery(
    { scope: user?.activeCompanyId ?? undefined },
    { enabled: !!user, retry: false, refetchOnWindowFocus: true }
  );
  const utils = trpc.useUtils();
  return { ...query, user, refresh: () => utils.alimentazione.invalidate() };
}
export function FeedPage({
  title,
  back = "/alimentazione",
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 pb-8">
      <header>
        <Link
          href={back}
          className="mb-3 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-green-400"
        >
          <ArrowLeft size={18} />
          Indietro
        </Link>
        <p className="text-xs text-zinc-400">Azienda / Alimentazione</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
      </header>
      {children}
    </div>
  );
}
export function FeedStatus({
  query,
}: {
  query: { isLoading: boolean; error: { message: string } | null };
}) {
  return query.isLoading ? (
    <div className={PANEL}>
      <Loader2 className="mr-2 inline animate-spin" />
      Caricamento dati aziendali…
    </div>
  ) : query.error ? (
    <div role="alert" className={`${PANEL} text-red-300`}>
      {query.error.message}
    </div>
  ) : null;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-2 text-sm text-zinc-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function useFeedConfirm() {
  const [current, setCurrent] = useState<{
    title: string;
    message: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const [pending, setPending] = useState(false);
  return {
    pending,
    ask: (title: string, message: string, action: () => Promise<unknown>) =>
      setCurrent({ title, message, action }),
    dialog: (
      <AlertDialog
        open={!!current}
        onOpenChange={open => {
          if (!open && !pending) setCurrent(null);
        }}
      >
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto border-white/15 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{current?.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-zinc-300">
              {current?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Indietro</AlertDialogCancel>
            <Button
              className={ACTION}
              disabled={pending}
              onClick={async () => {
                if (!current || pending) return;
                setPending(true);
                try {
                  await current.action();
                  setCurrent(null);
                  toast.success("Registrazione salvata", {
                    position: "top-center",
                  });
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : "Registrazione non riuscita",
                    { position: "top-center" }
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Salvataggio…" : "Conferma"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
