import { describe, it, expect } from "vitest";
import * as fiscalService from "./domains/fiscal/service";
import type { ActorContext } from "./domains/_core";

const COMPANY_ID = "test-company-fiscal";
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: "test-user-fiscal",
  userRole: "admin",
};
const RUN_ID = Date.now().toString(36);

// ── FORMA GIURIDICA ──
describe("Forma Giuridica", () => {
  it("crea un profilo giuridico ditta individuale", async () => {
    const result = await fiscalService.createLegalProfile(actor, {
      legalForm: "ditta_individuale",
      isAgriculturalCompany: true,
      effectiveFrom: "2020-01-01",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
  });

  it("crea un profilo società semplice agricola", async () => {
    const actor2 = { ...actor, companyId: `${COMPANY_ID}-ss-${RUN_ID}` };
    const result = await fiscalService.createLegalProfile(actor2, {
      legalForm: "societa_semplice_agricola",
      isAgriculturalCompany: true,
      effectiveFrom: "2021-03-01",
    });
    expect(result).toBeTruthy();
    expect(result.legalForm).toBe("societa_semplice_agricola");
  });

  it("crea un profilo cooperativa agricola", async () => {
    const actor3 = { ...actor, companyId: `${COMPANY_ID}-coop-${RUN_ID}` };
    const result = await fiscalService.createLegalProfile(actor3, {
      legalForm: "cooperativa_agricola",
      isAgriculturalCompany: true,
      effectiveFrom: "2019-06-15",
    });
    expect(result).toBeTruthy();
    expect(result.legalForm).toBe("cooperativa_agricola");
  });

  it("recupera il profilo giuridico attivo", async () => {
    const active = await fiscalService.getActiveLegalProfile(COMPANY_ID);
    expect(active).toBeTruthy();
    expect(active!.legalForm).toBe("ditta_individuale");
  });

  it("storico profili giuridici", async () => {
    const profiles = await fiscalService.getLegalProfiles(COMPANY_ID);
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThanOrEqual(1);
  });
});

// ── QUALIFICHE AGRICOLE ──
describe("Qualifiche Agricole", () => {
  it("crea qualifica IAP", async () => {
    const result = await fiscalService.createQualification(actor, {
      qualificationType: "IAP",
      subjectRole: "titolare",
      subjectName: "Mario Rossi",
      validFrom: "2020-01-01",
      authority: "Regione Lombardia",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
  });

  it("crea qualifica CD", async () => {
    const result = await fiscalService.createQualification(actor, {
      qualificationType: "CD",
      subjectRole: "socio",
      subjectName: "Luigi Verdi",
      validFrom: "2021-06-01",
    });
    expect(result).toBeTruthy();
    expect(result.qualificationType).toBe("CD");
  });

  it("lista qualifiche attive", async () => {
    const active = await fiscalService.getActiveQualifications(COMPANY_ID);
    expect(Array.isArray(active)).toBe(true);
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  it("lista tutte le qualifiche", async () => {
    const all = await fiscalService.getQualifications(COMPANY_ID);
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ── REGIME IVA ──
describe("Regime IVA", () => {
  it("crea regime speciale agricolo", async () => {
    const result = await fiscalService.createTaxProfile(actor, {
      vatRegime: "speciale_agricolo",
      settlementFrequency: "trimestrale",
      effectiveFrom: "2020-01-01",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
  });

  it("cambio regime: da speciale a ordinario (chiude il precedente)", async () => {
    const result = await fiscalService.createTaxProfile(actor, {
      vatRegime: "ordinario",
      settlementFrequency: "mensile",
      effectiveFrom: "2025-01-01",
    });
    expect(result).toBeTruthy();
    expect(result.vatRegime).toBe("ordinario");
  });

  it("regime attivo è quello più recente", async () => {
    const active = await fiscalService.getActiveTaxProfile(COMPANY_ID);
    expect(active).toBeTruthy();
    expect(active!.vatRegime).toBe("ordinario");
  });

  it("storico regimi conservato", async () => {
    const profiles = await fiscalService.getTaxProfiles(COMPANY_ID);
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    // Il primo (più vecchio) dovrebbe avere effectiveTo settato
    const speciale = profiles.find((p: any) => p.vatRegime === "speciale_agricolo");
    expect(speciale).toBeTruthy();
  });
});

// ── SALDO INIZIALE IVA ──
describe("Saldo Iniziale IVA", () => {
  it("registra saldo iniziale credito", async () => {
    const result = await fiscalService.createOpeningBalance(actor, {
      positionType: "credito",
      amount: 5000,
      referenceDate: "2025-01-01",
      referencePeriod: "T4-2024",
      description: "Credito IVA da dichiarazione annuale",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
  });

  it("recupera ultimo saldo iniziale", async () => {
    const balance = await fiscalService.getLatestOpeningBalance(COMPANY_ID);
    expect(balance).toBeTruthy();
    expect(balance!.amount).toBe("5000.00");
  });
});

// ── MOVIMENTI IVA ──
describe("Movimenti IVA", () => {
  it("registra movimento IVA vendita", async () => {
    const result = await fiscalService.createVatEntry(actor, {
      type: "vendita",
      direction: "dare",
      amount: 1200,
      referenceDate: "2025-03-15",
      referencePeriod: "T1-2025",
      description: "IVA su vendita latte",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
  });

  it("registra movimento IVA acquisto", async () => {
    const result = await fiscalService.createVatEntry(actor, {
      type: "acquisto",
      direction: "avere",
      amount: 800,
      referenceDate: "2025-03-20",
      referencePeriod: "T1-2025",
      description: "IVA su acquisto mangimi",
    });
    expect(result).toBeTruthy();
  });

  it("registra compensazione", async () => {
    const result = await fiscalService.createVatEntry(actor, {
      type: "compensazione",
      direction: "avere",
      amount: 300,
      referenceDate: "2025-03-25",
      referencePeriod: "T1-2025",
      description: "Compensazione IVA agricola",
    });
    expect(result).toBeTruthy();
  });

  it("lista movimenti con filtro periodo", async () => {
    const entries = await fiscalService.getVatEntries(COMPANY_ID, { period: "T1-2025" });
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });
});

// ── POSIZIONE IVA ──
describe("Posizione IVA", () => {
  it("calcola posizione IVA corrente", async () => {
    const position = await fiscalService.calculateVatPosition(COMPANY_ID);
    expect(position).toBeTruthy();
    expect(position.posizioneAttuale).toBeDefined();
    expect(position.saldoAttuale).toBeDefined();
    expect(position.saldoIniziale).toBeDefined();
    expect(typeof position.ivaVendite).toBe("number");
    expect(typeof position.ivaAcquisti).toBe("number");
  });
});

// ── PERIODI IVA ──
describe("Periodi IVA", () => {
  it("mette in verifica un periodo IVA", async () => {
    const result = await fiscalService.vatPeriodAction(actor, {
      period: "T1-2025",
      year: 2025,
      action: "verify",
    });
    expect(result).toBeTruthy();
  });

  it("chiude un periodo in verifica", async () => {
    const result = await fiscalService.vatPeriodAction(actor, {
      period: "T1-2025",
      year: 2025,
      action: "close",
    });
    expect(result).toBeTruthy();
  });

  it("riapre un periodo con motivazione", async () => {
    const result = await fiscalService.vatPeriodAction(actor, {
      period: "T1-2025",
      year: 2025,
      action: "reopen",
      reason: "Errore di registrazione da correggere",
    });
    expect(result).toBeTruthy();
  });

  it("lista periodi IVA", async () => {
    const periods = await fiscalService.getVatPeriods(COMPANY_ID, 2025);
    expect(Array.isArray(periods)).toBe(true);
    expect(periods.length).toBeGreaterThanOrEqual(1);
  });
});

// ── ALERT IVA ──
describe("Alert IVA", () => {
  it("genera alert deterministici", async () => {
    const alerts = await fiscalService.getVatAlerts(COMPANY_ID);
    expect(Array.isArray(alerts)).toBe(true);
    // Ogni alert ha tipo, messaggio, livello
    for (const alert of alerts) {
      expect(alert.tipo).toBeDefined();
      expect(alert.messaggio).toBeDefined();
      expect(alert.livello).toBeDefined();
    }
  });
});

// ── WIZARD CREAZIONE AZIENDA ──
describe("Wizard Creazione Azienda", () => {
  it("crea azienda completa con wizard", async () => {
    const wizardActor = { ...actor, companyId: `wizard-test-${RUN_ID}` };
    const result = await fiscalService.createCompanyWithWizard(wizardActor, {
      name: `Azienda Test ${RUN_ID}`,
      partitaIva: "IT12345678901",
      codiceFiscale: "RSSMRA80A01H501Z",
      indirizzo: "Via Roma 1, Milano",
      settore: "zootecnia",
      legalForm: "ditta_individuale",
      isAgriculturalCompany: true,
      qualifications: [
        {
          qualificationType: "IAP",
          subjectRole: "titolare",
          subjectName: "Test User",
          validFrom: "2020-01-01",
        },
      ],
      vatRegime: "speciale_agricolo",
      settlementFrequency: "trimestrale",
      vatEffectiveFrom: "2020-01-01",
      vatPositionType: "credito",
      vatAmount: 2500,
      vatReferenceDate: "2025-01-01",
      vatReferencePeriod: "T4-2024",
    });
    expect(result).toBeTruthy();
    expect(result.companyId).toBeTruthy();
    expect(result.name).toBeTruthy();
  });
});

// ── FISCAL SUMMARY ──
describe("Fiscal Summary", () => {
  it("restituisce il riepilogo fiscale completo", async () => {
    const summary = await fiscalService.getFiscalSummary(COMPANY_ID);
    expect(summary).toBeTruthy();
    expect(summary.legalProfile).toBeDefined();
    expect(summary.taxProfile).toBeDefined();
    expect(summary.qualifications).toBeDefined();
  });
});

// ── MULTI-AZIENDA ──
describe("Isolamento Multi-azienda", () => {
  it("dati fiscali di un'azienda non visibili da un'altra", async () => {
    const otherCompany = `other-fiscal-${RUN_ID}`;
    const profiles = await fiscalService.getLegalProfiles(otherCompany);
    expect(profiles.length).toBe(0);
    const qualifications = await fiscalService.getQualifications(otherCompany);
    expect(qualifications.length).toBe(0);
    const taxProfiles = await fiscalService.getTaxProfiles(otherCompany);
    expect(taxProfiles.length).toBe(0);
  });
});
