export const QUICK_ACTION_DEFAULT_ORDER = [
  "movimenti",
  "proposte",
  "analisi",
  "report",
  "impostazioni",
] as const;

export type QuickActionId = (typeof QUICK_ACTION_DEFAULT_ORDER)[number];

const QUICK_ACTION_IDS = new Set<string>(QUICK_ACTION_DEFAULT_ORDER);

export function normalizeQuickActionOrder(value: unknown): QuickActionId[] {
  const persisted = Array.isArray(value)
    ? value.filter((item): item is QuickActionId => typeof item === "string" && QUICK_ACTION_IDS.has(item))
    : [];
  const unique = persisted.filter((id, index) => persisted.indexOf(id) === index);
  return [...unique, ...QUICK_ACTION_DEFAULT_ORDER.filter((id) => !unique.includes(id))];
}

export function reorderQuickActions(order: QuickActionId[], movedId: QuickActionId, targetId: QuickActionId): QuickActionId[] {
  const fromIndex = order.indexOf(movedId);
  const targetIndex = order.indexOf(targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return order;

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, movedId);
  return next;
}
