import { type ActorContext, newId } from "../_core";
import * as repo from "./repository";
import type {
  CreateLegalProfileInput,
  UpdateLegalProfileInput,
  CreateQualificationInput,
  UpdateQualificationInput,
  CreateTaxProfileInput,
  UpdateTaxProfileInput,
  CreateOpeningBalanceInput,
  CreateVatConfigInput,
  UpdateVatConfigInput,
  CreateVatEntryInput,
  VatPeriodActionInput,
  CreateCompanyWizardInput,
  VatEntriesFilterInput,
} from "./validators";
import { getDb } from "../../db";
import { companies, companyMemberships } from "../../../drizzle/schema";
import { randomUUID } from "crypto";

// ──────────────────────────────────────────────────────────────────────────────
// FISCAL DOMAIN — Service
// ──────────────────────────────────────────────────────────────────────────────

// ─── Legal Profile ───────────────────────────────────────────────────────────

export async function createLegalProfile(actor: ActorContext, input: CreateLegalProfileInput) {
  return repo.insertLegalProfile(actor, { ...input, companyId: actor.companyId } as any);
}

export async function updateLegalProfile(actor: ActorContext, input: UpdateLegalProfileInput) {
  const { id, ...data } = input;
  return repo.updateLegalProfile(actor, id, data);
}

export async function getLegalProfiles(companyId: string) {
  return repo.listLegalProfiles(companyId);
}

export async function getActiveLegalProfile(companyId: string) {
  return repo.getActiveLegalProfile(companyId);
}

// ─── Qualifications ──────────────────────────────────────────────────────────

export async function createQualification(actor: ActorContext, input: CreateQualificationInput) {
  return repo.insertQualification(actor, { ...input, companyId: actor.companyId } as any);
}

export async function updateQualification(actor: ActorContext, input: UpdateQualificationInput) {
  const { id, ...data } = input;
  return repo.updateQualification(actor, id, data);
}

export async function getQualifications(companyId: string) {
  return repo.listQualifications(companyId);
}

export async function getActiveQualifications(companyId: string) {
  return repo.getActiveQualifications(companyId);
}

// ─── Tax Profile ─────────────────────────────────────────────────────────────

export async function createTaxProfile(actor: ActorContext, input: CreateTaxProfileInput) {
  // Chiudere il profilo precedente se esiste
  const existing = await repo.getActiveTaxProfile(actor.companyId);
  if (existing && !existing.effectiveTo) {
    await repo.updateTaxProfile(actor, existing.id, { effectiveTo: input.effectiveFrom });
  }
  return repo.insertTaxProfile(actor, { ...input, companyId: actor.companyId } as any);
}

export async function updateTaxProfile(actor: ActorContext, input: UpdateTaxProfileInput) {
  const { id, ...data } = input;
  if (data.verified) {
    (data as any).verifiedBy = actor.userUuid;
    (data as any).verifiedAt = new Date();
  }
  return repo.updateTaxProfile(actor, id, data);
}

export async function getTaxProfiles(companyId: string) {
  return repo.listTaxProfiles(companyId);
}

export async function getActiveTaxProfile(companyId: string) {
  return repo.getActiveTaxProfile(companyId);
}

// ─── Opening Balance ─────────────────────────────────────────────────────────

export async function createOpeningBalance(actor: ActorContext, input: CreateOpeningBalanceInput) {
  // Il saldo iniziale IVA NON è un'entrata, uscita, costo o ricavo.
  // È una posizione patrimoniale che alimenta solo il calcolo IVA.
  return repo.insertOpeningBalance(actor, {
    ...input,
    companyId: actor.companyId,
    amount: String(input.amount),
  } as any);
}

export async function getOpeningBalances(companyId: string) {
  return repo.listOpeningBalances(companyId);
}

export async function getLatestOpeningBalance(companyId: string) {
  return repo.getLatestOpeningBalance(companyId);
}

// ─── VAT Configuration ───────────────────────────────────────────────────────

export async function createVatConfig(actor: ActorContext, input: CreateVatConfigInput) {
  return repo.insertVatConfig(actor, {
    ...input,
    companyId: actor.companyId,
    vatRate: String(input.vatRate),
    compensationRate: String(input.compensationRate),
  } as any);
}

export async function updateVatConfig(actor: ActorContext, input: UpdateVatConfigInput) {
  const { id, ...data } = input;
  const mapped: Record<string, unknown> = {};
  if (data.vatRate !== undefined) mapped.vatRate = String(data.vatRate);
  if (data.compensationRate !== undefined) mapped.compensationRate = String(data.compensationRate);
  if (data.effectiveTo !== undefined) mapped.effectiveTo = data.effectiveTo;
  if (data.notes !== undefined) mapped.notes = data.notes;
  return repo.updateVatConfig(actor, id, mapped);
}

export async function getVatConfigs(companyId: string) {
  return repo.listVatConfigs(companyId);
}

export async function getActiveVatConfigs(companyId: string) {
  return repo.getActiveVatConfigs(companyId);
}

// ─── VAT Entries ─────────────────────────────────────────────────────────────

export async function createVatEntry(actor: ActorContext, input: CreateVatEntryInput) {
  // Verificare che il periodo non sia chiuso
  const parts = input.referencePeriod.split("-");
  if (parts.length >= 2) {
    const year = parseInt(parts[1]);
    const period = input.referencePeriod;
    const vatPeriod = await repo.getVatPeriod(actor.companyId, period, year);
    if (vatPeriod && vatPeriod.status === "chiuso") {
      throw new Error("Impossibile registrare movimenti in un periodo chiuso. Riaprire il periodo prima di procedere.");
    }
  }
  return repo.insertVatEntry(actor, {
    ...input,
    companyId: actor.companyId,
    amount: String(input.amount),
  } as any);
}

export async function getVatEntries(companyId: string, filters?: VatEntriesFilterInput) {
  return repo.listVatEntries(companyId, filters);
}

// ─── VAT Periods ─────────────────────────────────────────────────────────────

export async function getVatPeriods(companyId: string, year?: number) {
  return repo.listVatPeriods(companyId, year);
}

export async function vatPeriodAction(actor: ActorContext, input: VatPeriodActionInput) {
  const existing = await repo.getVatPeriod(actor.companyId, input.period, input.year);

  switch (input.action) {
    case "verify": {
      if (existing && existing.status !== "aperto" && existing.status !== "riaperto") {
        throw new Error(`Il periodo è in stato '${existing?.status}', non può essere messo in verifica.`);
      }
      return repo.upsertVatPeriod(actor, input.period, input.year, "in_verifica");
    }
    case "close": {
      if (!existing || existing.status !== "in_verifica") {
        throw new Error("Il periodo deve essere in stato 'in_verifica' per poter essere chiuso.");
      }
      return repo.upsertVatPeriod(actor, input.period, input.year, "chiuso", {
        closedBy: actor.userUuid,
        closedAt: new Date(),
      });
    }
    case "reopen": {
      if (!existing || existing.status !== "chiuso") {
        throw new Error("Solo un periodo chiuso può essere riaperto.");
      }
      if (!input.reason) {
        throw new Error("La motivazione è obbligatoria per riaprire un periodo chiuso.");
      }
      return repo.upsertVatPeriod(actor, input.period, input.year, "riaperto", {
        reopenedBy: actor.userUuid,
        reopenedAt: new Date(),
        reopenReason: input.reason,
      });
    }
  }
}

// ─── VAT Position Calculation ────────────────────────────────────────────────

export async function calculateVatPosition(companyId: string) {
  const openingBalance = await repo.getLatestOpeningBalance(companyId);
  const entries = await repo.listVatEntries(companyId);
  const taxProfile = await repo.getActiveTaxProfile(companyId);

  // Saldo iniziale
  let saldoIniziale = 0;
  let positionType = "da_definire";
  if (openingBalance) {
    saldoIniziale = Number(openingBalance.amount);
    positionType = openingBalance.positionType;
    // credito = positivo per l'azienda, debito = negativo
    if (positionType === "debito") saldoIniziale = -saldoIniziale;
  }

  // Calcolo movimenti
  let ivaVendite = 0;
  let ivaAcquisti = 0;
  let compensazioni = 0;
  let rettifiche = 0;
  let versamenti = 0;
  let rimborsi = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount);
    switch (entry.type) {
      case "vendita":
        ivaVendite += amount;
        break;
      case "acquisto":
        ivaAcquisti += amount;
        break;
      case "compensazione":
        compensazioni += amount;
        break;
      case "rettifica":
        if (entry.direction === "dare") rettifiche += amount;
        else rettifiche -= amount;
        break;
      case "versamento":
        versamenti += amount;
        break;
      case "rimborso":
        rimborsi += amount;
        break;
      case "nota_credito_emessa":
        ivaVendite -= amount;
        break;
      case "nota_credito_ricevuta":
        ivaAcquisti -= amount;
        break;
    }
  }

  // Posizione IVA = Saldo iniziale + IVA acquisti - IVA vendite + compensazioni - versamenti + rimborsi + rettifiche
  // Positivo = credito, Negativo = debito
  const saldoAttuale = saldoIniziale + ivaAcquisti - ivaVendite + compensazioni - versamenti + rimborsi + rettifiche;

  let posizioneAttuale: "credito" | "debito" | "zero" | "non_determinabile";
  if (!openingBalance && entries.length === 0) {
    posizioneAttuale = "non_determinabile";
  } else if (saldoAttuale > 0) {
    posizioneAttuale = "credito";
  } else if (saldoAttuale < 0) {
    posizioneAttuale = "debito";
  } else {
    posizioneAttuale = "zero";
  }

  return {
    posizioneAttuale,
    saldoAttuale: Math.abs(saldoAttuale),
    saldoConSegno: saldoAttuale,
    saldoIniziale: openingBalance ? Number(openingBalance.amount) : 0,
    positionType: openingBalance?.positionType ?? "da_definire",
    ivaVendite,
    ivaAcquisti,
    compensazioni,
    rettifiche,
    versamenti,
    rimborsi,
    regime: taxProfile?.vatRegime ?? "non_configurato",
    periodicita: taxProfile?.settlementFrequency ?? "non_configurata",
    periodoRiferimento: openingBalance?.referencePeriod ?? null,
    configCompleta: !!(openingBalance && taxProfile),
  };
}

// ─── VAT Alerts ──────────────────────────────────────────────────────────────

export async function getVatAlerts(companyId: string) {
  const alerts: Array<{ tipo: string; messaggio: string; livello: "warning" | "error" | "info" }> = [];

  const legalProfile = await repo.getActiveLegalProfile(companyId);
  const taxProfile = await repo.getActiveTaxProfile(companyId);
  const openingBalance = await repo.getLatestOpeningBalance(companyId);
  const vatConfigs = await repo.getActiveVatConfigs(companyId);

  if (!legalProfile) {
    alerts.push({ tipo: "config_incompleta", messaggio: "Forma giuridica non configurata", livello: "error" });
  }
  if (!taxProfile) {
    alerts.push({ tipo: "regime_mancante", messaggio: "Regime IVA non selezionato", livello: "error" });
  }
  if (!openingBalance) {
    alerts.push({ tipo: "saldo_mancante", messaggio: "Saldo IVA iniziale non inserito", livello: "warning" });
  }
  if (taxProfile?.vatRegime === "speciale_agricoltura" && vatConfigs.length === 0) {
    alerts.push({ tipo: "compensazione_mancante", messaggio: "Percentuali di compensazione non configurate", livello: "warning" });
  }
  if (taxProfile && !taxProfile.verified) {
    alerts.push({ tipo: "non_verificato", messaggio: "Configurazione fiscale non verificata dal consulente", livello: "info" });
  }

  // Verifica posizione IVA
  const position = await calculateVatPosition(companyId);
  if (position.posizioneAttuale === "debito" && position.saldoAttuale > 0) {
    alerts.push({ tipo: "debito_iva", messaggio: `Debito IVA presente: €${position.saldoAttuale.toFixed(2)}`, livello: "warning" });
  }

  return alerts;
}

// ─── Wizard Creazione Azienda ────────────────────────────────────────────────

export async function createCompanyWithWizard(actor: ActorContext, input: CreateCompanyWizardInput) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const companyId = randomUUID();

  // Step 1: Creare l'azienda
  await db.insert(companies).values({
    id: companyId,
    name: input.name,
    partitaIva: input.partitaIva ?? null,
    codiceFiscale: input.codiceFiscale ?? null,
    indirizzo: input.indirizzo ?? null,
    citta: input.citta ?? null,
    provincia: input.provincia ?? null,
    cap: input.cap ?? null,
    telefono: input.telefono ?? null,
    email: input.email ?? null,
    settore: input.settore ?? null,
    ettari: input.ettari ? String(input.ettari) : null,
    createdBy: actor.userUuid,
    updatedBy: actor.userUuid,
  } as any);

  // Creare membership per l'utente
  await db.insert(companyMemberships).values({
    id: randomUUID(),
    userId: actor.userId,
    companyId,
    ruolo: "admin",
    attiva: true,
    createdBy: actor.userUuid,
    updatedBy: actor.userUuid,
  } as any);

  // Usare il nuovo companyId come contesto
  const newActor: ActorContext = { ...actor, companyId };

  // Step 2: Forma giuridica
  await repo.insertLegalProfile(newActor, {
    companyId,
    legalForm: input.legalForm,
    isAgriculturalCompany: input.isAgriculturalCompany,
    specifyOther: input.specifyOther ?? null,
    effectiveFrom: input.vatEffectiveFrom,
  });

  // Step 3: Qualifiche agricole
  for (const q of input.qualifications) {
    if (q.qualificationType !== "nessuna") {
      await repo.insertQualification(newActor, {
        companyId,
        qualificationType: q.qualificationType,
        subjectRole: q.subjectRole ?? null,
        subjectName: q.subjectName ?? null,
        validFrom: q.validFrom,
        validTo: q.validTo ?? null,
        authority: q.authority ?? null,
        practiceRef: q.practiceRef ?? null,
        active: true,
      });
    }
  }

  // Step 4: Regime IVA
  await repo.insertTaxProfile(newActor, {
    companyId,
    vatRegime: input.vatRegime,
    settlementFrequency: input.settlementFrequency,
    effectiveFrom: input.vatEffectiveFrom,
  });

  // Step 5: Posizione IVA iniziale
  if (input.vatPositionType !== "da_definire") {
    await repo.insertOpeningBalance(newActor, {
      companyId,
      positionType: input.vatPositionType,
      amount: String(input.vatAmount),
      referenceDate: input.vatReferenceDate,
      referencePeriod: input.vatReferencePeriod ?? null,
      source: input.vatSource ?? null,
      consultant: input.vatConsultant ?? null,
      notes: input.vatNotes ?? null,
    });
  }

  return { companyId, name: input.name };
}

// ─── Fiscal Summary (per Home/Dashboard) ─────────────────────────────────────

export async function getFiscalSummary(companyId: string) {
  const legalProfile = await repo.getActiveLegalProfile(companyId);
  const qualifications = await repo.getActiveQualifications(companyId);
  const taxProfile = await repo.getActiveTaxProfile(companyId);
  const openingBalance = await repo.getLatestOpeningBalance(companyId);
  const vatPosition = await calculateVatPosition(companyId);
  const alerts = await getVatAlerts(companyId);

  return {
    legalProfile: legalProfile ? {
      legalForm: legalProfile.legalForm,
      isAgriculturalCompany: legalProfile.isAgriculturalCompany,
      effectiveFrom: legalProfile.effectiveFrom,
    } : null,
    qualifications: qualifications.map(q => ({
      type: q.qualificationType,
      active: q.active,
      validFrom: q.validFrom,
      validTo: q.validTo,
    })),
    taxProfile: taxProfile ? {
      vatRegime: taxProfile.vatRegime,
      settlementFrequency: taxProfile.settlementFrequency,
      effectiveFrom: taxProfile.effectiveFrom,
      verified: taxProfile.verified,
    } : null,
    vatPosition,
    alerts,
    configCompleta: !!(legalProfile && taxProfile),
  };
}
