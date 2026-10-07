export const COMPANY_AREA_DEFAULT_ORDER = [
  "stalla",
  "magazzino",
  "officina",
  "campi",
] as const;

export type CompanyAreaId = (typeof COMPANY_AREA_DEFAULT_ORDER)[number];

const COMPANY_AREA_IDS = COMPANY_AREA_DEFAULT_ORDER as readonly string[];

export function normalizeCompanyAreaOrder(value: unknown): CompanyAreaId[] {
  const saved = Array.isArray(value)
    ? value.filter((item): item is CompanyAreaId => typeof item === "string" && COMPANY_AREA_IDS.includes(item))
    : [];
  const unique = saved.filter((id, index) => saved.indexOf(id) === index);
  return [...unique, ...COMPANY_AREA_DEFAULT_ORDER.filter((id) => !unique.includes(id))];
}

export function reorderCompanyAreas(order: CompanyAreaId[], movedId: CompanyAreaId, targetId: CompanyAreaId): CompanyAreaId[] {
  const fromIndex = order.indexOf(movedId);
  const targetIndex = order.indexOf(targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return order;

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, movedId);
  return next;
}
