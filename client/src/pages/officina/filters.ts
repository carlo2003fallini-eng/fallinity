export type WorkFilters = { ricerca: string; mezzo: string; stato: string; priorita: string; tipo: string; periodo: string; da: string; a: string; operatore: string };
export function matchesWork(work: any, f: WorkFilters, now = new Date()) {
  const q = f.ricerca.trim().toLowerCase();
  if (q && ![work.codice, work.descrizione, work.operatore, work.nomeMezzo].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
  if (f.mezzo !== "tutti" && work.macchinaId !== f.mezzo) return false;
  if (f.stato === "aperti" && work.stato === "completato") return false;
  if (!["tutti", "aperti"].includes(f.stato) && work.stato !== f.stato) return false;
  if (f.priorita !== "tutte" && work.priorita !== f.priorita) return false;
  if (f.tipo !== "tutti" && work.tipo !== f.tipo) return false;
  if (f.operatore !== "tutti" && work.operatore !== f.operatore) return false;
  const date = new Date(work.stato === "completato" ? work.dataCompletamento || work.data : work.dataPianificata || work.data);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (f.periodo === "ritardo" && (work.stato === "completato" || !(date < startToday))) return false;
  if (f.periodo === "oggi" && date.toDateString() !== startToday.toDateString()) return false;
  if (f.periodo === "mese" && (date < new Date(now.getFullYear(), now.getMonth(), 1) || date >= new Date(now.getFullYear(), now.getMonth() + 1, 1))) return false;
  if (f.periodo === "personalizzato") {
    if (f.da && date < new Date(`${f.da}T00:00:00`)) return false;
    if (f.a && date > new Date(`${f.a}T23:59:59.999`)) return false;
  }
  return true;
}
