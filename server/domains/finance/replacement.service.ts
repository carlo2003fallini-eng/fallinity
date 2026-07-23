import * as repo from "./replacement.repository";
import type { CreateReplacementPlanInput, UpdateReplacementPlanInput, CreateReplacementAccountInput, UpdateReplacementAccountInput, CreateAllocationInput, AccantonamentoInput, UpdateValoreSostituzioneInput } from "./replacement.validators";

// ─── PIANI ──────────────────────────────────────────────────────────────────────

export async function createPlan(companyId: string, input: CreateReplacementPlanInput, userId?: string) {
  return repo.createPlan(companyId, input, userId);
}

export async function updatePlan(companyId: string, input: UpdateReplacementPlanInput, userId?: string) {
  return repo.updatePlan(companyId, input, userId);
}

export async function getPlan(companyId: string, id: string) {
  const plan = await repo.getPlanById(companyId, id);
  if (!plan) return null;
  const allocations = await repo.listAllocationsByPlan(id);
  const transactions = await repo.listTransactions(id);
  const valueHistory = await repo.getValueHistory(id);
  return { ...plan, allocations, transactions, valueHistory };
}

export async function listPlans(companyId: string, filters?: { stato?: string; macchinaId?: string; priorita?: string }) {
  return repo.listPlans(companyId, filters);
}

export async function deletePlan(companyId: string, id: string, userId?: string) {
  return repo.deletePlan(companyId, id, userId);
}

// ─── AGGIORNAMENTO VALORE SOSTITUZIONE ──────────────────────────────────────────

export async function updateValoreSostituzione(companyId: string, input: UpdateValoreSostituzioneInput, userId?: string) {
  const plan = await repo.getPlanById(companyId, input.planId);
  if (!plan) throw new Error("Piano non trovato");

  const valorePrecedente = Number(plan.valoreSostituzione);
  
  // Registra nello storico
  await repo.addValueHistory(input.planId, valorePrecedente, input.nuovoValore, userId || "system", input.motivazione);

  // Aggiorna il piano
  const nuovoCapitaleNecessario = input.nuovoValore - Number(plan.valoreResiduo);
  const capitaleAccantonato = Number(plan.capitaleAccantonato);
  const nuovaCopertura = nuovoCapitaleNecessario > 0 ? (capitaleAccantonato / nuovoCapitaleNecessario) * 100 : 100;

  await repo.updatePlan(companyId, {
    id: input.planId,
    valoreSostituzione: input.nuovoValore,
  }, userId);

  // Ricalcola accantonamento consigliato
  const dataSost = new Date(plan.dataSostituzione as unknown as string);
  const now = new Date();
  const mesiRimanenti = Math.max(1, (dataSost.getFullYear() - now.getFullYear()) * 12 + (dataSost.getMonth() - now.getMonth()));
  const residuo = nuovoCapitaleNecessario - capitaleAccantonato;
  const nuovoAccantonamentoConsigliato = Math.max(0, Math.round((residuo / mesiRimanenti) * 100) / 100);

  await repo.updatePlanCapitale(input.planId, capitaleAccantonato, Number(plan.interessiMaturati), Math.min(100, Math.round(nuovaCopertura * 100) / 100));
}

// ─── CONTI DEPOSITO ─────────────────────────────────────────────────────────────

export async function createAccount(companyId: string, input: CreateReplacementAccountInput, userId?: string) {
  return repo.createAccount(companyId, input, userId);
}

export async function updateAccount(companyId: string, input: UpdateReplacementAccountInput, userId?: string) {
  return repo.updateAccount(companyId, input, userId);
}

export async function getAccount(companyId: string, id: string) {
  const account = await repo.getAccountById(companyId, id);
  if (!account) return null;
  const allocations = await repo.listAllocations(id);
  return { ...account, allocations };
}

export async function listAccounts(companyId: string) {
  return repo.listAccounts(companyId);
}

// ─── ALLOCAZIONI ────────────────────────────────────────────────────────────────

export async function createAllocation(companyId: string, input: CreateAllocationInput, userId?: string) {
  // Vincolo: importo allocato ≤ saldo disponibile nel conto
  const account = await repo.getAccountById(companyId, input.replacementAccountId);
  if (!account) throw new Error("Conto non trovato");

  const allocations = await repo.listAllocations(input.replacementAccountId);
  const totaleAllocato = allocations.reduce((sum, a) => sum + Number(a.importoAllocato), 0);
  const saldoDisponibile = Number(account.capitaleVersato) - totaleAllocato;

  if (input.importoAllocato > saldoDisponibile) {
    throw new Error(`Importo allocato (${input.importoAllocato}) supera il saldo disponibile (${saldoDisponibile.toFixed(2)})`);
  }

  // Aggiorna capitale vincolato nel conto
  const nuovoVincolato = totaleAllocato + input.importoAllocato;
  // Non serve aggiornare qui, il vincolato è calcolato dalle allocazioni

  return repo.createAllocation(input, userId);
}

export async function updateAllocation(companyId: string, id: string, importo: number, userId?: string) {
  return repo.updateAllocation(id, importo, userId);
}

export async function deleteAllocation(id: string) {
  return repo.deleteAllocation(id);
}

// ─── ACCANTONAMENTO ─────────────────────────────────────────────────────────────

export async function accantona(companyId: string, input: AccantonamentoInput, userId?: string) {
  const plan = await repo.getPlanById(companyId, input.planId);
  if (!plan) throw new Error("Piano non trovato");

  const capitaleAttuale = Number(plan.capitaleAccantonato);
  const nuovoCapitale = capitaleAttuale + input.importo;
  const capitaleNecessario = Number(plan.capitaleNecessario);
  const nuovaCopertura = capitaleNecessario > 0 ? (nuovoCapitale / capitaleNecessario) * 100 : 100;

  // Registra transazione
  await repo.addTransaction(
    input.planId,
    input.tipo === "trasferimento" ? null : null, // accountId se trasferimento
    input.tipo === "trasferimento" ? "versamento" : "accantonamento_gestionale",
    input.importo,
    input.note,
    userId,
  );

  // Aggiorna totali piano
  await repo.updatePlanCapitale(
    input.planId,
    nuovoCapitale,
    Number(plan.interessiMaturati),
    Math.min(100, Math.round(nuovaCopertura * 100) / 100),
  );

  return {
    capitaleAccantonato: nuovoCapitale,
    percentualeCopertura: Math.min(100, Math.round(nuovaCopertura * 100) / 100),
  };
}

// ─── DASHBOARD AGGREGATA ────────────────────────────────────────────────────────

export async function getDashboard(companyId: string) {
  const [aggregates, plans, accounts] = await Promise.all([
    repo.getDashboardAggregates(companyId),
    repo.listPlans(companyId, { stato: "attivo" }),
    repo.listAccounts(companyId),
  ]);

  // Calcola versamento mensile consigliato totale
  const versamentoMensileConsigliato = plans.reduce((sum, p) => sum + Number(p.accantonamentoMensileConsigliato), 0);
  const versamentoMensileEffettivo = plans.reduce((sum, p) => sum + Number(p.accantonamentoMensileEffettivo), 0);

  // Calcola saldo conti
  const saldoConti = accounts.reduce((sum, a) => sum + Number(a.capitaleVersato), 0);

  return {
    ...aggregates,
    versamentoMensileConsigliato: Math.round(versamentoMensileConsigliato * 100) / 100,
    versamentoMensileEffettivo: Math.round(versamentoMensileEffettivo * 100) / 100,
    saldoConti: Math.round(saldoConti * 100) / 100,
    plans,
    accounts,
  };
}
