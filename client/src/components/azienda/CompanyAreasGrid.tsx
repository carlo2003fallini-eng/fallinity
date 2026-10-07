import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Beef, Sprout, Warehouse, Wrench, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  COMPANY_AREA_DEFAULT_ORDER,
  normalizeCompanyAreaOrder,
  reorderCompanyAreas,
  type CompanyAreaId,
} from "@/lib/companyAreaOrder";

const LONG_PRESS_MS = 320;
const MOVE_CANCEL_DISTANCE_PX = 10;

type CompanyArea = {
  id: CompanyAreaId;
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
};

type DragState = {
  id: CompanyAreaId;
  pointerId: number;
  startX: number;
  startY: number;
  initialOrder: CompanyAreaId[];
  active: boolean;
  overId: CompanyAreaId | null;
  timer: number | null;
};

const AREAS: CompanyArea[] = [
  { id: "stalla", label: "Stalla", path: "/stalla", icon: Beef, color: "oklch(0.65 0.18 142)" },
  { id: "magazzino", label: "Magazzino", path: "/magazzino", icon: Warehouse, color: "oklch(0.72 0.15 75)" },
  { id: "officina", label: "Officina", path: "/officina", icon: Wrench, color: "oklch(0.6 0.15 220)" },
  { id: "campi", label: "Campi", path: "/campi", icon: Sprout, color: "oklch(0.65 0.18 142)" },
];

function fallbackStorageKey(userKey: string, companyKey: string) {
  return `fallinity:azienda:aree-ordine:v1:${encodeURIComponent(userKey || "dispositivo")}:${encodeURIComponent(companyKey || "azienda")}`;
}

function loadFallbackOrder(userKey: string, companyKey: string): CompanyAreaId[] {
  if (typeof window === "undefined") return [...COMPANY_AREA_DEFAULT_ORDER];
  try {
    return normalizeCompanyAreaOrder(JSON.parse(window.localStorage.getItem(fallbackStorageKey(userKey, companyKey)) ?? "[]"));
  } catch {
    return [...COMPANY_AREA_DEFAULT_ORDER];
  }
}

function sameOrder(left: CompanyAreaId[] | null | undefined, right: CompanyAreaId[] | null | undefined) {
  return Boolean(left && right && left.length === right.length && left.every((id, index) => id === right[index]));
}

export function CompanyAreasGrid({ onNavigate, userKey, companyKey }: { onNavigate: (path: string) => void; userKey: string; companyKey: string }) {
  const utils = trpc.useUtils();
  const initialFallbackOrder = useMemo(() => loadFallbackOrder(userKey, companyKey), [userKey, companyKey]);
  const [order, setOrder] = useState<CompanyAreaId[]>(initialFallbackOrder);
  const [draggingId, setDraggingId] = useState<CompanyAreaId | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [keyboardDraggingId, setKeyboardDraggingId] = useState<CompanyAreaId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<CompanyAreaId[] | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const orderRef = useRef(order);
  const skipNextClickRef = useRef(false);

  const orderQuery = trpc.azienda.ordineAree.useQuery({ scope: companyKey || undefined }, {
    retry: false,
    refetchOnWindowFocus: true,
  });
  const saveOrderMutation = trpc.azienda.salvaOrdineAree.useMutation({
    onSuccess: (result, variables) => {
      utils.azienda.ordineAree.setData({ scope: companyKey || undefined }, result);
      setPendingOrder((current) => sameOrder(current, variables.ordine) ? null : current);
      setSyncFailed(false);
    },
    onError: () => {
      // Il fallback locale evita di perdere l'ordine finché non torna la connessione.
      setSyncFailed(true);
    },
  });

  useEffect(() => {
    const fallback = loadFallbackOrder(userKey, companyKey);
    orderRef.current = fallback;
    setOrder(fallback);
    setHydrated(false);
    setPendingOrder(null);
    setSyncFailed(false);
  }, [userKey, companyKey]);

  useEffect(() => {
    if (!orderQuery.isSuccess || hydrated) return;
    const remoteOrder = normalizeCompanyAreaOrder(orderQuery.data.ordine);
    const fallback = loadFallbackOrder(userKey, companyKey);
    const next = pendingOrder ?? (orderQuery.data.salvato ? remoteOrder : fallback);
    orderRef.current = next;
    setOrder(next);
    setHydrated(true);
    if (!orderQuery.data.salvato || pendingOrder) setPendingOrder(next);
  }, [companyKey, hydrated, orderQuery.data, orderQuery.isSuccess, pendingOrder, userKey]);

  useEffect(() => {
    if (!hydrated || !orderQuery.isSuccess || !pendingOrder || saveOrderMutation.isPending || syncFailed) return;
    saveOrderMutation.mutate({ ordine: pendingOrder });
  }, [hydrated, orderQuery.isSuccess, pendingOrder, saveOrderMutation, syncFailed]);

  useEffect(() => {
    const retrySync = () => {
      if (!pendingOrder) return;
      setSyncFailed(false);
      void orderQuery.refetch();
    };
    window.addEventListener("online", retrySync);
    return () => window.removeEventListener("online", retrySync);
  }, [orderQuery.refetch, pendingOrder]);

  const areas = useMemo(
    () => order.map((id) => AREAS.find((area) => area.id === id)).filter((area): area is CompanyArea => Boolean(area)),
    [order],
  );

  const persistFallback = (next: CompanyAreaId[]) => {
    try {
      window.localStorage.setItem(fallbackStorageKey(userKey, companyKey), JSON.stringify(next));
    } catch {
      // La griglia resta utilizzabile anche in ambienti che non espongono localStorage.
    }
  };

  const persistOrder = (next: CompanyAreaId[]) => {
    orderRef.current = next;
    setOrder(next);
    persistFallback(next);
    setSyncFailed(false);
    setPendingOrder(next);
  };

  const updateVisualOrder = (next: CompanyAreaId[]) => {
    orderRef.current = next;
    setOrder(next);
  };

  const areaAtPointer = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-company-area-id]");
    const candidate = element?.dataset.companyAreaId as CompanyAreaId | undefined;
    return candidate && orderRef.current.includes(candidate) ? candidate : null;
  };

  const clearLongPress = (drag: DragState | null) => {
    if (drag && drag.timer !== null) window.clearTimeout(drag.timer);
    if (drag) drag.timer = null;
  };

  const activateDrag = (id: CompanyAreaId) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.active) return;
    drag.active = true;
    drag.timer = null;
    setDraggingId(id);
    setAnnouncement(`${AREAS.find((area) => area.id === id)?.label ?? "Area"} in spostamento.`);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: CompanyAreaId) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const drag: DragState = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialOrder: [...orderRef.current],
      active: false,
      overId: null,
      timer: null,
    };
    dragRef.current = drag;
    drag.timer = window.setTimeout(() => activateDrag(id), LONG_PRESS_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>, id: CompanyAreaId) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;

    const x = event.clientX - drag.startX;
    const y = event.clientY - drag.startY;
    const distance = Math.hypot(x, y);
    if (!drag.active && distance > MOVE_CANCEL_DISTANCE_PX) {
      clearLongPress(drag);
      return;
    }
    if (!drag.active) return;

    event.preventDefault();
    setDragOffset({ x, y });
    const target = areaAtPointer(event.clientX, event.clientY);
    if (!target || target === id || target === drag.overId) return;

    drag.overId = target;
    updateVisualOrder(reorderCompanyAreas(orderRef.current, id, target));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: CompanyAreaId, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;
    clearLongPress(drag);

    if (drag.active) {
      skipNextClickRef.current = true;
      if (cancelled) {
        updateVisualOrder(drag.initialOrder);
        setAnnouncement("Spostamento annullato.");
      } else {
        persistOrder(orderRef.current);
        setAnnouncement(`${AREAS.find((area) => area.id === id)?.label ?? "Area"} spostata.`);
      }
    }

    dragRef.current = null;
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: CompanyAreaId) => finishDrag(event, id, true);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: CompanyAreaId) => {
    const area = AREAS.find((item) => item.id === id);
    if (event.key === " ") {
      event.preventDefault();
      if (keyboardDraggingId === id) {
        persistOrder(orderRef.current);
        setKeyboardDraggingId(null);
        setAnnouncement("Ordine salvato.");
      } else {
        setKeyboardDraggingId(id);
        setAnnouncement(`${area?.label ?? "Area"} selezionata. Usa le frecce per spostarla, Spazio per confermare.`);
      }
      return;
    }

    if (event.key === "Escape" && keyboardDraggingId === id) {
      event.preventDefault();
      setKeyboardDraggingId(null);
      setAnnouncement("Riordino da tastiera terminato.");
      return;
    }

    if (keyboardDraggingId !== id) return;
    const index = orderRef.current.indexOf(id);
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0;
    if (!delta) return;

    event.preventDefault();
    const target = orderRef.current[Math.max(0, Math.min(orderRef.current.length - 1, index + delta))];
    if (!target || target === id) return;
    updateVisualOrder(reorderCompanyAreas(orderRef.current, id, target));
    setAnnouncement(`${area?.label ?? "Area"} spostata.`);
  };

  return (
    <section aria-label="Aree operative aziendali">
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div className="grid grid-cols-2 gap-3" role="list">
        {areas.map((area) => {
          const Icon = area.icon;
          const isDragging = draggingId === area.id;
          const isKeyboardDragging = keyboardDraggingId === area.id;
          return (
            <div key={area.id} role="listitem" className="min-w-0">
              <button
                type="button"
                data-company-area-id={area.id}
                onClick={() => {
                  if (skipNextClickRef.current) {
                    skipNextClickRef.current = false;
                    return;
                  }
                  onNavigate(area.path);
                }}
                onPointerDown={(event) => handlePointerDown(event, area.id)}
                onPointerMove={(event) => handlePointerMove(event, area.id)}
                onPointerUp={(event) => finishDrag(event, area.id)}
                onPointerCancel={(event) => cancelDrag(event, area.id)}
                onKeyDown={(event) => handleKeyDown(event, area.id)}
                aria-label={`${area.label}. Tieni premuto e trascina per riordinare.`}
                aria-pressed={isKeyboardDragging}
                className={`relative flex min-h-36 w-full select-none flex-col items-center justify-center gap-3 rounded-2xl border transition-[transform,box-shadow,opacity,border-color] duration-200 active:scale-[0.98] ${isDragging ? "z-20 opacity-95" : ""}`}
                style={{
                  background: "linear-gradient(145deg, oklch(0.14 0.018 145), oklch(0.10 0.006 145))",
                  borderColor: isDragging || isKeyboardDragging ? `${area.color}aa` : "oklch(0.20 0.015 145)",
                  boxShadow: isDragging ? `0 20px 36px ${area.color}30, 0 8px 18px oklch(0.03 0.01 145 / .6)` : "0 8px 20px oklch(0.03 0.01 145 / .22)",
                  transform: isDragging ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.04)` : undefined,
                  pointerEvents: isDragging ? "none" : undefined,
                  touchAction: "none",
                }}
              >
                <span className="flex size-12 items-center justify-center rounded-2xl" style={{ background: `${area.color}15`, color: area.color }}>
                  <Icon size={25} strokeWidth={1.8} />
                </span>
                <span className="text-base font-semibold" style={{ color: "oklch(0.9 0.01 145)", fontFamily: "var(--font-display)" }}>{area.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
