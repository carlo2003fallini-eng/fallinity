import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  BarChart3,
  ClipboardList,
  FileText,
  GripVertical,
  RotateCcw,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  normalizeQuickActionOrder,
  QUICK_ACTION_DEFAULT_ORDER,
  reorderQuickActions,
  type QuickActionId,
} from "@/lib/financeQuickActions";

const STORAGE_KEY = "fallinity:finance:quick-actions-order:v1";
const DRAG_DISTANCE_PX = 8;

type QuickAction = {
  id: QuickActionId;
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
};

type DragState = {
  id: QuickActionId;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  overId: QuickActionId | null;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "movimenti", label: "Movimenti", path: "/finanza/movimenti", icon: FileText, color: "oklch(0.6 0.15 220)" },
  { id: "proposte", label: "Proposte", path: "/finanza/proposte", icon: ClipboardList, color: "oklch(0.65 0.15 280)" },
  { id: "analisi", label: "Analisi", path: "/finanza/analisi", icon: BarChart3, color: "oklch(0.65 0.12 200)" },
  { id: "report", label: "Report", path: "/finanza/report", icon: FileText, color: "oklch(0.55 0.1 180)" },
  { id: "impostazioni", label: "Impostaz.", path: "/finanza/impostazioni", icon: Settings2, color: "oklch(0.5 0.08 240)" },
];

function readStoredOrder() {
  if (typeof window === "undefined") return [...QUICK_ACTION_DEFAULT_ORDER];
  try {
    return normalizeQuickActionOrder(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [...QUICK_ACTION_DEFAULT_ORDER];
  }
}

export function QuickActionsGrid({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [order, setOrder] = useState<QuickActionId[]>(readStoredOrder);
  const [draggingId, setDraggingId] = useState<QuickActionId | null>(null);
  const [overId, setOverId] = useState<QuickActionId | null>(null);
  const [keyboardDraggingId, setKeyboardDraggingId] = useState<QuickActionId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragRef = useRef<DragState | null>(null);
  const skipNextClickRef = useRef(false);

  const actions = useMemo(
    () => order.map((id) => QUICK_ACTIONS.find((action) => action.id === id)).filter((action): action is QuickAction => Boolean(action)),
    [order],
  );

  const saveOrder = (next: QuickActionId[]) => {
    setOrder(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Il riordino resta attivo per la sessione anche se lo storage non è disponibile.
    }
  };

  const actionAtPointer = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-quick-action-id]");
    const candidate = element?.dataset.quickActionId as QuickActionId | undefined;
    return candidate && order.includes(candidate) ? candidate : null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: QuickActionId) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, overId: null };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>, id: QuickActionId) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active && distance < DRAG_DISTANCE_PX) return;
    if (!drag.active) {
      drag.active = true;
      setDraggingId(id);
      setAnnouncement(`${QUICK_ACTIONS.find((action) => action.id === id)?.label ?? "Azione"} in spostamento.`);
    }

    event.preventDefault();
    const target = actionAtPointer(event.clientX, event.clientY);
    drag.overId = target;
    setOverId(target);
  };

  const completePointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: QuickActionId) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;

    if (drag.active) {
      skipNextClickRef.current = true;
      if (drag.overId && drag.overId !== id) {
        const next = reorderQuickActions(order, id, drag.overId);
        saveOrder(next);
        setAnnouncement(`${QUICK_ACTIONS.find((action) => action.id === id)?.label ?? "Azione"} spostato.`);
      } else {
        setAnnouncement("Spostamento annullato.");
      }
    }

    dragRef.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  const cancelPointerDrag = () => {
    dragRef.current = null;
    setDraggingId(null);
    setOverId(null);
    setAnnouncement("Spostamento annullato.");
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, id: QuickActionId) => {
    const action = QUICK_ACTIONS.find((item) => item.id === id);
    if (event.key === " ") {
      event.preventDefault();
      if (keyboardDraggingId === id) {
        setKeyboardDraggingId(null);
        setAnnouncement("Ordine salvato.");
      } else {
        setKeyboardDraggingId(id);
        setAnnouncement(`${action?.label ?? "Azione"} selezionato. Usa le frecce per spostarlo, Spazio per terminare.`);
      }
      return;
    }

    if (event.key === "Escape" && keyboardDraggingId) {
      event.preventDefault();
      setKeyboardDraggingId(null);
      setAnnouncement("Riordino da tastiera terminato.");
      return;
    }

    if (keyboardDraggingId !== id) return;
    const index = order.indexOf(id);
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0;
    if (!delta) return;

    event.preventDefault();
    const target = order[Math.max(0, Math.min(order.length - 1, index + delta))];
    if (!target || target === id) return;
    saveOrder(reorderQuickActions(order, id, target));
    setAnnouncement(`${action?.label ?? "Azione"} spostato.`);
  };

  const resetOrder = () => {
    const next = [...QUICK_ACTION_DEFAULT_ORDER];
    saveOrder(next);
    setKeyboardDraggingId(null);
    setAnnouncement("Ordine predefinito ripristinato.");
    toast.success("Ordine predefinito ripristinato");
  };

  return (
    <section aria-labelledby="azioni-rapide-title" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="azioni-rapide-title" className="text-sm font-semibold" style={{ color: "oklch(0.83 0.01 145)" }}>Azioni rapide</h2>
          <p id="azioni-rapide-help" className="text-[11px]" style={{ color: "oklch(0.5 0.01 145)" }}>Tieni premuto e trascina per riordinare. L’ordine è salvato su questo dispositivo.</p>
        </div>
        <button type="button" onClick={resetOrder} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors hover:bg-white/5" style={{ color: "oklch(0.67 0.04 145)" }}>
          <RotateCcw size={13} /> Ripristina
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div className="grid grid-cols-2 gap-2" role="list" aria-describedby="azioni-rapide-help">
        {actions.map((action) => {
          const Icon = action.icon;
          const isDragging = draggingId === action.id;
          const isDropTarget = Boolean(draggingId && overId === action.id && draggingId !== action.id);
          const isKeyboardDragging = keyboardDraggingId === action.id;
          return (
            <div key={action.id} role="listitem">
              <button
                type="button"
                data-quick-action-id={action.id}
                onClick={() => {
                  if (skipNextClickRef.current) {
                    skipNextClickRef.current = false;
                    return;
                  }
                  onNavigate(action.path);
                }}
                onPointerDown={(event) => handlePointerDown(event, action.id)}
                onPointerMove={(event) => handlePointerMove(event, action.id)}
                onPointerUp={(event) => completePointerDrag(event, action.id)}
                onPointerCancel={cancelPointerDrag}
                onKeyDown={(event) => handleKeyDown(event, action.id)}
                aria-label={`${action.label}. Tieni premuto e trascina per cambiare posizione.`}
                aria-describedby="azioni-rapide-help"
                aria-pressed={isKeyboardDragging}
                className={`relative flex min-h-[60px] w-full touch-none select-none flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl py-3 transition-[transform,opacity,box-shadow,border-color] duration-150 active:scale-[0.97] ${isDragging ? "scale-[0.97] opacity-55" : ""} ${isDropTarget ? "ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-background" : ""}`}
                style={{ background: "oklch(0.11 0.006 145)", border: `1px solid ${isDropTarget ? "oklch(0.65 0.18 142)" : "oklch(0.18 0.008 145)"}` }}
              >
                <GripVertical aria-hidden="true" className="absolute left-1.5 top-1/2 size-3 -translate-y-1/2 opacity-40" style={{ color: action.color }} />
                <Icon size={18} style={{ color: action.color }} />
                <span className="text-[10px] font-medium" style={{ color: "oklch(0.7 0.005 145)" }}>{action.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
