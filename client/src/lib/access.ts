import type { AccessModuleKey } from "@shared/access";

export function hasModule(modules: readonly string[] | undefined, required: AccessModuleKey) {
  return Boolean(modules?.some((module) => module === required || module.startsWith(`${required}.`) || required.startsWith(`${module}.`)));
}

export function moduleForPath(path: string): AccessModuleKey | null {
  if (path.startsWith("/stalla")) return "azienda.stalla";
  if (path.startsWith("/magazzino")) return "azienda.magazzino";
  if (path.startsWith("/officina")) return "azienda.officina";
  if (path.startsWith("/campi")) return "azienda.campi";
  if (path.startsWith("/calendario")) return "strumenti.calendario";
  if (path === "/report") return "strumenti.report";
  if (path.startsWith("/ai")) return "strumenti.ai";
  if (path.startsWith("/finanza/reintegrazione") || path === "/reintegrazione") return "finanza.reintegrazione";
  if (path.startsWith("/finanza/analisi")) return "finanza.kpi";
  if (path.startsWith("/finanza/report")) return "finanza.report";
  if (path.startsWith("/finanza/nuovo-automatico") || path.startsWith("/finanza/fatture")) return "finanza.fatturazione";
  if (path.startsWith("/finanza/")) return "finanza.movimenti";
  if (path === "/finanza") return "finanza.movimenti";
  return null;
}

export function firstOperationalPath(modules: readonly string[]) {
  const candidates: Array<[AccessModuleKey, string]> = [
    ["azienda.stalla", "/stalla"],
    ["azienda.magazzino", "/magazzino"],
    ["azienda.officina", "/officina"],
    ["azienda.campi", "/campi"],
    ["finanza.movimenti", "/finanza"],
    ["strumenti.calendario", "/calendario"],
  ];
  const permitted = candidates.filter(([module]) => hasModule(modules, module));
  return permitted.length === 1 ? permitted[0]![1] : null;
}

export function firstAvailableOperationalPath(modules: readonly string[]) {
  const candidates: Array<[AccessModuleKey, string]> = [
    ["azienda.stalla", "/stalla"],
    ["azienda.magazzino", "/magazzino"],
    ["azienda.officina", "/officina"],
    ["azienda.campi", "/campi"],
    ["finanza.movimenti", "/finanza"],
    ["strumenti.calendario", "/calendario"],
  ];
  return candidates.find(([module]) => hasModule(modules, module))?.[1] ?? null;
}
