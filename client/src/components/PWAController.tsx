import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Share2, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PWA_UPDATE_EVENT } from "@/lib/pwa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PWAController() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [installDismissed, setInstallDismissed] = useState(() => sessionStorage.getItem("fallinity:pwa-install-dismissed") === "1");
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const updatingRef = useRef(false);

  const isiOS = useMemo(() => /iphone|ipad|ipod/i.test(navigator.userAgent), []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const onUpdate = (event: Event) => setUpdateRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !updatingRef.current) return;
      reloading = true;
      window.location.reload();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const dismissInstall = () => {
    sessionStorage.setItem("fallinity:pwa-install-dismissed", "1");
    setInstallDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const update = () => {
    if (!updateRegistration?.waiting) return updateRegistration?.update();
    updatingRef.current = true;
    setUpdating(true);
    updateRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  if (!online) {
    return <div className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-950/95 p-3 text-amber-100 shadow-2xl backdrop-blur" role="status" aria-live="polite"><WifiOff className="size-5 shrink-0 text-amber-400" /><div className="min-w-0"><p className="text-sm font-semibold">Modalità offline</p><p className="text-xs text-amber-100/70">Puoi consultare l’ultima interfaccia. Le operazioni server riprenderanno quando torni online.</p></div></div>;
  }

  if (updateRegistration) {
    return <div className="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-md rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur" role="status" aria-live="polite"><div className="flex items-start gap-3"><RefreshCw className={`mt-0.5 size-5 shrink-0 text-primary ${updating ? "animate-spin" : ""}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Aggiornamento disponibile</p><p className="mt-1 text-xs text-muted-foreground">Installa l’ultima versione di Fallinity senza perdere i dati.</p></div></div><Button className="mt-3 w-full" onClick={update} disabled={updating}>{updating ? "Aggiornamento…" : "Aggiorna ora"}</Button></div>;
  }

  if (installed || installDismissed || (!installPrompt && !isiOS)) return null;

  return <div className="fixed inset-x-4 bottom-20 z-[70] mx-auto max-w-md rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur" role="dialog" aria-label="Installa Fallinity"><button onClick={dismissInstall} className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Chiudi"><X className="size-4" /></button><div className="flex items-start gap-3 pr-6">{isiOS ? <Share2 className="mt-0.5 size-5 shrink-0 text-primary" /> : <Download className="mt-0.5 size-5 shrink-0 text-primary" />}<div><p className="text-sm font-semibold">Installa Fallinity</p><p className="mt-1 text-xs text-muted-foreground">{isiOS ? "Apri Condividi e scegli “Aggiungi alla schermata Home”." : "Aggiungi l’app al telefono per aprirla a schermo intero e usarla anche offline."}</p></div></div>{installPrompt && <Button className="mt-3 w-full" onClick={install}><Download className="mr-2 size-4" />Installa app</Button>}</div>;
}
