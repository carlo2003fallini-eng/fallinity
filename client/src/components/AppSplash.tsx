import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useRef, useState } from "react";

const APP_ICON = "/manus-storage/fallinity-app-icon-192_3ee5c98d.png";
const MIN_VISIBLE_MS = 700;
const EXIT_DURATION_MS = 260;
const MAX_WAIT_MS = 8_000;

type SplashStage = "visible" | "leaving" | "hidden";

export default function AppSplash() {
  const { loading } = useAuth();
  const startedAt = useRef(Date.now());
  const exiting = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const [stage, setStage] = useState<SplashStage>("visible");
  const [windowReady, setWindowReady] = useState(() => document.readyState === "complete");

  const beginExit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    setStage("leaving");
    hideTimer.current = window.setTimeout(() => setStage("hidden"), EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    if (windowReady) return;
    const onLoad = () => setWindowReady(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [windowReady]);

  useEffect(() => {
    if (!windowReady || loading) return;
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    const timer = window.setTimeout(beginExit, remaining);
    return () => window.clearTimeout(timer);
  }, [beginExit, loading, windowReady]);

  useEffect(() => {
    const timer = window.setTimeout(beginExit, MAX_WAIT_MS);
    return () => {
      window.clearTimeout(timer);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [beginExit]);

  useEffect(() => {
    if (stage !== "hidden") return;
    document.documentElement.dataset.appReady = "true";
    document.getElementById("root")?.setAttribute("aria-busy", "false");
  }, [stage]);

  if (stage === "hidden") return null;

  return (
    <div
      className="fallinity-splash"
      data-state={stage}
      role="status"
      aria-live="polite"
      aria-label="Avvio di Fallinity"
    >
      <div className="fallinity-splash__halo" aria-hidden="true" />
      <div className="fallinity-splash__content">
        <div className="fallinity-splash__mark">
          <img src={APP_ICON} alt="" width={112} height={112} fetchPriority="high" />
        </div>
        <div className="fallinity-splash__brand">
          <p>FALLINITY</p>
          <span>Enterprise Operating System</span>
        </div>
        <div className="fallinity-splash__loader" aria-hidden="true">
          <span />
        </div>
        <p className="fallinity-splash__status">
          {navigator.onLine ? "Preparazione ambiente di lavoro" : "Avvio in modalità offline"}
        </p>
      </div>
      <p className="fallinity-splash__footer">Gestione agricola, in un unico sistema</p>
    </div>
  );
}
