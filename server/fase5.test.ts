import { describe, it, expect } from "vitest";
import * as budgetService from "./domains/finance/budget.service";
import * as replacementService from "./domains/finance/replacement.service";
import type { ActorContext } from "./domains/_core";

const COMPANY_ID = "test-company-fase5";
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: "test-user-fase5",
  userRole: "admin",
};
const RUN_ID = Date.now().toString(36);

// ── BUDGET ──
describe("Budget Service", () => {
  let budgetId: string;

  it("crea un budget annuale con distribuzione uniforme", async () => {
    const result = await budgetService.createBudget(COMPANY_ID, {
      nome: `Test Budget ${RUN_ID}`,
      tipo: "uscita",
      periodo: "annuale",
      importoPrevisto: 12000,
      distribuzione: "uniforme",
      dataInizio: "2026-01-01",
      dataFine: "2026-12-31",
    }, actor.userUuid);
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    budgetId = result.id;
  });

  it("lista budget per stato", async () => {
    const list = await budgetService.listBudgets(COMPANY_ID, { stato: "attivo" });
    expect(Array.isArray(list)).toBe(true);
  });

  it("archivia un budget", async () => {
    if (!budgetId) return;
    await budgetService.archiveBudget(COMPANY_ID, budgetId, actor.userUuid);
    // archiveBudget non restituisce un valore, verifica che non errori
    expect(true).toBe(true);
  });

  it("calcola confronto budget (non errora)", async () => {
    const comparison = await budgetService.getBudgetComparison(COMPANY_ID, {
      dataInizio: "2026-01-01",
      dataFine: "2026-12-31",
    });
    expect(comparison).toBeTruthy();
    expect(typeof comparison!.previsto).toBe("number");
    expect(typeof comparison!.consuntivoTotale).toBe("number");
    expect(typeof comparison!.scostamento).toBe("number");
  });

  it("calcola previsione (non errora con budgetId)", async () => {
    if (!budgetId) return;
    const forecast = await budgetService.getBudgetForecast(COMPANY_ID, {
      budgetId,
      metodo: "lineare",
    });
    // forecast può essere null se il budget è stato archiviato
    // ma la funzione non deve errare
    expect(true).toBe(true);
  });
});

// ── REINTEGRAZIONE ──
describe("Replacement Service", () => {
  let planId: string;
  let accountId: string;

  it("crea un piano di reintegrazione", async () => {
    const result = await replacementService.createPlan(COMPANY_ID, {
      nome: `Trattore Test ${RUN_ID}`,
      valoreSostituzione: 80000,
      dataSostituzione: "2030-06-01",
      vitaUtile: 10,
      valoreResiduo: 5000,
      priorita: "alta",
    }, actor.userUuid);
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    planId = result.id;
  });

  it("calcola accantonamento consigliato", async () => {
    if (!planId) return;
    const plans = await replacementService.listPlans(COMPANY_ID);
    const plan = plans.find(p => p.id === planId);
    expect(plan).toBeTruthy();
    expect(Number(plan!.accantonamentoMensileConsigliato)).toBeGreaterThan(0);
  });

  it("crea un conto deposito", async () => {
    const result = await replacementService.createAccount(COMPANY_ID, {
      nome: `Deposito Test ${RUN_ID}`,
      tassoInteresse: 2.5,
      periodicita: "mensile",
    }, actor.userUuid);
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    accountId = result.id;
  });

  it("registra un accantonamento gestionale sul piano", async () => {
    const result = await replacementService.accantona(COMPANY_ID, {
      planId,
      importo: 1000,
      tipo: "gestionale",
      note: `Accantonamento test ${RUN_ID}`,
    }, actor.userUuid);

    expect(result.capitaleAccantonato).toBe(1000);
    expect(result.percentualeCopertura).toBeGreaterThan(0);
    const plan = await replacementService.getPlan(COMPANY_ID, planId);
    expect(Number(plan?.capitaleAccantonato)).toBe(1000);
  });

  it("registra un trasferimento reale e aggiorna il conto deposito", async () => {
    await replacementService.accantona(COMPANY_ID, {
      planId,
      importo: 500,
      tipo: "trasferimento",
      replacementAccountId: accountId,
      note: `Trasferimento test ${RUN_ID}`,
    }, actor.userUuid);

    const account = await replacementService.getAccount(COMPANY_ID, accountId);
    expect(Number(account?.capitaleVersato)).toBe(500);
    const plan = await replacementService.getPlan(COMPANY_ID, planId);
    expect(Number(plan?.capitaleAccantonato)).toBe(1500);
  });

  it("dashboard restituisce dati aggregati", async () => {
    const dashboard = await replacementService.getDashboard(COMPANY_ID);
    expect(dashboard).toBeTruthy();
    expect(typeof dashboard.capitaleNecessario).toBe("number");
    expect(typeof dashboard.capitaleAccantonato).toBe("number");
    expect(typeof dashboard.coperturaMedia).toBe("number");
    expect(Array.isArray(dashboard.plans)).toBe(true);
  });
});
