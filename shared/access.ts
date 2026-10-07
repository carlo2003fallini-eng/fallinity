export const ACCESS_MODULES = [
  { key: "azienda.stalla", area: "azienda", label: "Stalla", group: "Azienda" },
  { key: "azienda.stalla.gruppi", area: "azienda", label: "Gruppi", group: "Stalla" },
  { key: "azienda.stalla.sincronizzazioni", area: "azienda", label: "Sincronizzazioni", group: "Stalla" },
  { key: "azienda.stalla.dati_latte", area: "azienda", label: "Dati Latte", group: "Stalla" },
  { key: "azienda.stalla.gravidanze", area: "azienda", label: "Gravidanze", group: "Stalla" },
  { key: "azienda.stalla.zoppie", area: "azienda", label: "Zoppie", group: "Stalla" },
  { key: "azienda.stalla.vitelli", area: "azienda", label: "Vitelli", group: "Stalla" },
  { key: "azienda.magazzino", area: "azienda", label: "Magazzino", group: "Azienda" },
  { key: "azienda.officina", area: "azienda", label: "Officina", group: "Azienda" },
  { key: "azienda.campi", area: "azienda", label: "Campi", group: "Azienda" },
  { key: "finanza.movimenti", area: "finanza", label: "Entrate e uscite", group: "Finanza" },
  { key: "finanza.reintegrazione", area: "finanza", label: "Reintegrazione", group: "Finanza" },
  { key: "finanza.pianificazione", area: "finanza", label: "Pianificazione", group: "Finanza" },
  { key: "finanza.fatturazione", area: "finanza", label: "Fatturazione", group: "Finanza" },
  { key: "finanza.report", area: "finanza", label: "Report finanziari", group: "Finanza" },
  { key: "finanza.kpi", area: "finanza", label: "KPI e analisi", group: "Finanza" },
  { key: "strumenti.calendario", area: "strumenti", label: "Calendario", group: "Strumenti" },
  { key: "strumenti.report", area: "strumenti", label: "Report", group: "Strumenti" },
  { key: "strumenti.ai", area: "strumenti", label: "Assistente AI", group: "Strumenti" },
] as const;

export type AccessModuleKey = (typeof ACCESS_MODULES)[number]["key"];
export const ACCESS_MODULE_KEYS = ACCESS_MODULES.map((module) => module.key) as [AccessModuleKey, ...AccessModuleKey[]];
export const ALL_ACCESS_MODULE_KEYS = ACCESS_MODULES.map((module) => module.key) as AccessModuleKey[];

export function isAccessModuleKey(value: string): value is AccessModuleKey {
  return ALL_ACCESS_MODULE_KEYS.includes(value as AccessModuleKey);
}

export function moduleMatches(moduleKey: AccessModuleKey, requested: string) {
  return moduleKey === requested || moduleKey.startsWith(`${requested}.`) || requested.startsWith(`${moduleKey}.`);
}
