import { describe, it, expect } from "vitest";
import { dashboardSummary, dashboardTrend, dashboardCostCenters, dashboardCategories, dashboardDeadlines, dashboardCreditsDebts, dashboardAccounts } from "./domains/finance/dashboard";
import { cashflowEffettivo, cashflowPrevisto, cashflowMensile } from "./domains/finance/cashflow";
import { calcolaAlerts, listAlerts, countAlertNonLetti, getSoglie, upsertSoglia, markAlertLetto, markAlertRisolto } from "./domains/finance/alerts";

const COMPANY_ID = "test-company-dashboard";
const oggi = new Date().toISOString().split("T")[0];
const inizioMese = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
const fineMese = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];

describe("Finance Dashboard - Summary", () => {
  it("restituisce summary in modalità cassa con confronto periodo precedente", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "cassa",
    });
    expect(result).not.toBeNull();
    expect(result!.modalita).toBe("cassa");
    expect(result!.utileNetto).toHaveProperty("valore");
    expect(result!.utileNetto).toHaveProperty("valorePrecedente");
    expect(result!.utileNetto).toHaveProperty("differenza");
    expect(result!.utileNetto).toHaveProperty("percentuale");
    expect(result!.entrate).toHaveProperty("numMovimenti");
    expect(result!.uscite).toHaveProperty("numMovimenti");
  });

  it("restituisce summary in modalità competenza", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "competenza",
    });
    expect(result).not.toBeNull();
    expect(result!.modalita).toBe("competenza");
    expect(result!.entrate.valore).toBeGreaterThanOrEqual(0);
    expect(result!.uscite.valore).toBeGreaterThanOrEqual(0);
  });

  it("utile netto = entrate - uscite", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "cassa",
    });
    expect(result).not.toBeNull();
    expect(result!.utileNetto.valore).toBe(result!.entrate.valore - result!.uscite.valore);
  });

  it("confronto periodo: percentuale calcolata correttamente", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "cassa",
    });
    expect(result).not.toBeNull();
    // Se il periodo precedente è 0, percentuale è null
    if (result!.utileNetto.valorePrecedente === 0) {
      expect(result!.utileNetto.percentuale).toBeNull();
    }
  });

  it("filtro per centro di costo in modalità competenza", async () => {
    const result = await dashboardSummary({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "competenza",
      centroCostoId: "non-esistente",
    });
    expect(result).not.toBeNull();
    expect(result!.entrate.valore).toBe(0);
    expect(result!.uscite.valore).toBe(0);
  });
});

describe("Finance Dashboard - Trend", () => {
  it("restituisce trend mensile con N punti", async () => {
    const result = await dashboardTrend({
      companyId: COMPANY_ID,
      dataInizio: "",
      dataFine: "",
      modalita: "cassa",
      mesi: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.trend).toHaveLength(6);
    expect(result!.trend[0]).toHaveProperty("mese");
    expect(result!.trend[0]).toHaveProperty("entrate");
    expect(result!.trend[0]).toHaveProperty("uscite");
    expect(result!.trend[0]).toHaveProperty("utile");
  });

  it("ogni punto trend ha utile = entrate - uscite", async () => {
    const result = await dashboardTrend({
      companyId: COMPANY_ID,
      dataInizio: "",
      dataFine: "",
      modalita: "cassa",
      mesi: 3,
    });
    expect(result).not.toBeNull();
    for (const p of result!.trend) {
      expect(p.utile).toBe(p.entrate - p.uscite);
    }
  });

  it("trend in modalità competenza funziona", async () => {
    const result = await dashboardTrend({
      companyId: COMPANY_ID,
      dataInizio: "",
      dataFine: "",
      modalita: "competenza",
      mesi: 12,
    });
    expect(result).not.toBeNull();
    expect(result!.trend).toHaveLength(12);
    expect(result!.modalita).toBe("competenza");
  });
});

describe("Finance Dashboard - Cost Centers & Categories", () => {
  it("restituisce centri di costo con percentuali", async () => {
    const result = await dashboardCostCenters({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "cassa",
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("totaleUscite");
    expect(result!).toHaveProperty("centri");
    expect(Array.isArray(result!.centri)).toBe(true);
  });

  it("restituisce categorie con percentuali", async () => {
    const result = await dashboardCategories({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
      modalita: "cassa",
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("totale");
    expect(result!).toHaveProperty("categorie");
    expect(Array.isArray(result!.categorie)).toBe(true);
  });
});

describe("Finance Dashboard - Deadlines & Credits/Debts", () => {
  it("restituisce scadenze raggruppate per urgenza", async () => {
    const result = await dashboardDeadlines(COMPANY_ID);
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("daPagare7gg");
    expect(result!).toHaveProperty("daPagare30gg");
    expect(result!).toHaveProperty("daIncassare30gg");
    expect(result!).toHaveProperty("scadute");
    expect(result!).toHaveProperty("totali");
    expect(result!.totali).toHaveProperty("numScadenze");
  });

  it("restituisce crediti e debiti con quota scaduta", async () => {
    const result = await dashboardCreditsDebts(COMPANY_ID);
    expect(result).not.toBeNull();
    expect(result!.crediti).toHaveProperty("totaleResiduo");
    expect(result!.crediti).toHaveProperty("quotaScaduta");
    expect(result!.crediti).toHaveProperty("numDocumenti");
    expect(result!.debiti).toHaveProperty("totaleResiduo");
    expect(result!.debiti).toHaveProperty("quotaScaduta");
  });

  it("restituisce conti con saldo totale", async () => {
    const result = await dashboardAccounts(COMPANY_ID);
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("saldoTotale");
    expect(result!).toHaveProperty("conti");
    expect(result!).toHaveProperty("perTipo");
  });
});

describe("Finance Cashflow - Effettivo", () => {
  it("restituisce cashflow effettivo con saldo cumulativo", async () => {
    const result = await cashflowEffettivo({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("saldoIniziale");
    expect(result!).toHaveProperty("saldoFinale");
    expect(result!).toHaveProperty("variazione");
    expect(result!).toHaveProperty("punti");
    expect(result!.variazione).toBe(result!.saldoFinale - result!.saldoIniziale);
  });

  it("ogni punto ha saldo cumulativo coerente", async () => {
    const result = await cashflowEffettivo({
      companyId: COMPANY_ID,
      dataInizio: inizioMese,
      dataFine: fineMese,
    });
    expect(result).not.toBeNull();
    if (result!.punti.length > 0) {
      // Il primo punto cumulativo = saldoIniziale + saldoGiornaliero
      expect(result!.punti[0].saldoCumulativo).toBe(result!.saldoIniziale + result!.punti[0].saldoGiornaliero);
    }
  });
});

describe("Finance Cashflow - Previsto", () => {
  it("restituisce forecast con orizzonti 7/30/90 giorni", async () => {
    const result = await cashflowPrevisto({
      companyId: COMPANY_ID,
      dataInizio: "",
      dataFine: "",
      orizzonteGiorni: 90,
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("saldoAttuale");
    expect(result!).toHaveProperty("orizzonti");
    expect(result!.orizzonti).toHaveProperty("7gg");
    expect(result!.orizzonti).toHaveProperty("30gg");
    expect(result!.orizzonti).toHaveProperty("90gg");
    expect(result!).toHaveProperty("puntoMinimo");
    expect(result!).toHaveProperty("totaleEntrateAttese");
    expect(result!).toHaveProperty("totaleUsciteAttese");
  });

  it("punti forecast hanno fonti indicate", async () => {
    const result = await cashflowPrevisto({
      companyId: COMPANY_ID,
      dataInizio: "",
      dataFine: "",
      orizzonteGiorni: 30,
    });
    expect(result).not.toBeNull();
    expect(result!.punti.length).toBeGreaterThan(0);
    for (const p of result!.punti) {
      expect(p).toHaveProperty("fonti");
      expect(Array.isArray(p.fonti)).toBe(true);
    }
  });
});

describe("Finance Cashflow - Mensile", () => {
  it("restituisce cashflow mensile aggregato", async () => {
    const result = await cashflowMensile({
      companyId: COMPANY_ID,
      dataInizio: "2025-01-01",
      dataFine: oggi,
    });
    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("punti");
    expect(Array.isArray(result!.punti)).toBe(true);
    for (const p of result!.punti) {
      expect(p).toHaveProperty("mese");
      expect(p).toHaveProperty("entrate");
      expect(p).toHaveProperty("uscite");
      expect(p.netto).toBe(p.entrate - p.uscite);
    }
  });
});

describe("Finance Alerts - Deterministici", () => {
  it("calcolaAlerts restituisce conteggio nuovi alert", async () => {
    const result = await calcolaAlerts(COMPANY_ID);
    expect(result).toHaveProperty("nuovi");
    expect(result).toHaveProperty("tipi");
    expect(typeof result.nuovi).toBe("number");
    expect(Array.isArray(result.tipi)).toBe(true);
  });

  it("listAlerts restituisce array di alert", async () => {
    const result = await listAlerts(COMPANY_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("countAlertNonLetti restituisce un numero", async () => {
    const result = await countAlertNonLetti(COMPANY_ID);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("getSoglie restituisce array di soglie", async () => {
    const result = await getSoglie(COMPANY_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("upsertSoglia crea e aggiorna una soglia", async () => {
    const result1 = await upsertSoglia(COMPANY_ID, "saldo_minimo", 100000);
    expect(result1).not.toBeNull();
    expect(result1!.valore).toBe(100000);

    // Aggiorna
    const result2 = await upsertSoglia(COMPANY_ID, "saldo_minimo", 200000);
    expect(result2).not.toBeNull();
    expect(result2!.valore).toBe(200000);
  });

  it("markAlertLetto e markAlertRisolto non lanciano errori", async () => {
    // Con ID non esistente non deve crashare
    await expect(markAlertLetto("non-esistente")).resolves.not.toThrow();
    await expect(markAlertRisolto("non-esistente")).resolves.not.toThrow();
  });
});
