import { and, eq, isNull, sql, desc, lte, gte } from "drizzle-orm";
import { getDb } from "../../db";
import {
  companyLegalProfiles,
  agriculturalQualifications,
  companyTaxProfiles,
  vatOpeningBalances,
  vatConfigurationVersions,
  vatLedgerEntries,
  vatPeriods,
} from "../../../drizzle/schema";
import { withCreate, softDeletePayload, type ActorContext, newId } from "../_core";

// ──────────────────────────────────────────────────────────────────────────────
// FISCAL DOMAIN — Repository
// ──────────────────────────────────────────────────────────────────────────────

// ─── Legal Profiles ──────────────────────────────────────────────────────────

export async function listLegalProfiles(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyLegalProfiles)
    .where(and(eq(companyLegalProfiles.companyId, companyId), isNull(companyLegalProfiles.deletedAt)))
    .orderBy(desc(companyLegalProfiles.effectiveFrom));
}

export async function getActiveLegalProfile(companyId: string) {
  const db = await getDb();
  if (!db) return null;
  const today = new Date();
  const rows = await db.select().from(companyLegalProfiles)
    .where(and(
      eq(companyLegalProfiles.companyId, companyId),
      isNull(companyLegalProfiles.deletedAt),
      lte(companyLegalProfiles.effectiveFrom, today),
    ))
    .orderBy(desc(companyLegalProfiles.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertLegalProfile(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(companyLegalProfiles).values(row as any);
  return row;
}

export async function updateLegalProfile(actor: ActorContext, id: string, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(companyLegalProfiles)
    .set({ ...data, updatedBy: actor.userUuid, version: sql`version + 1` } as any)
    .where(and(eq(companyLegalProfiles.id, id), eq(companyLegalProfiles.companyId, actor.companyId)));
  return { success: true };
}

// ─── Agricultural Qualifications ─────────────────────────────────────────────

export async function listQualifications(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agriculturalQualifications)
    .where(and(eq(agriculturalQualifications.companyId, companyId), isNull(agriculturalQualifications.deletedAt)))
    .orderBy(desc(agriculturalQualifications.validFrom));
}

export async function getActiveQualifications(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agriculturalQualifications)
    .where(and(
      eq(agriculturalQualifications.companyId, companyId),
      eq(agriculturalQualifications.active, true),
      isNull(agriculturalQualifications.deletedAt),
    ))
    .orderBy(desc(agriculturalQualifications.validFrom));
}

export async function insertQualification(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(agriculturalQualifications).values(row as any);
  return row;
}

export async function updateQualification(actor: ActorContext, id: string, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(agriculturalQualifications)
    .set({ ...data, updatedBy: actor.userUuid, version: sql`version + 1` } as any)
    .where(and(eq(agriculturalQualifications.id, id), eq(agriculturalQualifications.companyId, actor.companyId)));
  return { success: true };
}

// ─── Tax Profiles ────────────────────────────────────────────────────────────

export async function listTaxProfiles(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyTaxProfiles)
    .where(and(eq(companyTaxProfiles.companyId, companyId), isNull(companyTaxProfiles.deletedAt)))
    .orderBy(desc(companyTaxProfiles.effectiveFrom));
}

export async function getActiveTaxProfile(companyId: string) {
  const db = await getDb();
  if (!db) return null;
  const today = new Date();
  const rows = await db.select().from(companyTaxProfiles)
    .where(and(
      eq(companyTaxProfiles.companyId, companyId),
      isNull(companyTaxProfiles.deletedAt),
      lte(companyTaxProfiles.effectiveFrom, today),
    ))
    .orderBy(desc(companyTaxProfiles.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertTaxProfile(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(companyTaxProfiles).values(row as any);
  return row;
}

export async function updateTaxProfile(actor: ActorContext, id: string, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(companyTaxProfiles)
    .set({ ...data, updatedBy: actor.userUuid, version: sql`version + 1` } as any)
    .where(and(eq(companyTaxProfiles.id, id), eq(companyTaxProfiles.companyId, actor.companyId)));
  return { success: true };
}

// ─── VAT Opening Balances ────────────────────────────────────────────────────

export async function listOpeningBalances(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatOpeningBalances)
    .where(and(eq(vatOpeningBalances.companyId, companyId), isNull(vatOpeningBalances.deletedAt)))
    .orderBy(desc(vatOpeningBalances.referenceDate));
}

export async function getLatestOpeningBalance(companyId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vatOpeningBalances)
    .where(and(eq(vatOpeningBalances.companyId, companyId), isNull(vatOpeningBalances.deletedAt)))
    .orderBy(desc(vatOpeningBalances.referenceDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertOpeningBalance(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(vatOpeningBalances).values(row as any);
  return row;
}

// ─── VAT Configuration Versions ──────────────────────────────────────────────

export async function listVatConfigs(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatConfigurationVersions)
    .where(and(eq(vatConfigurationVersions.companyId, companyId), isNull(vatConfigurationVersions.deletedAt)))
    .orderBy(desc(vatConfigurationVersions.effectiveFrom));
}

export async function getActiveVatConfigs(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  return db.select().from(vatConfigurationVersions)
    .where(and(
      eq(vatConfigurationVersions.companyId, companyId),
      isNull(vatConfigurationVersions.deletedAt),
      lte(vatConfigurationVersions.effectiveFrom, today),
    ))
    .orderBy(desc(vatConfigurationVersions.effectiveFrom));
}

export async function insertVatConfig(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(vatConfigurationVersions).values(row as any);
  return row;
}

export async function updateVatConfig(actor: ActorContext, id: string, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(vatConfigurationVersions)
    .set({ ...data, updatedBy: actor.userUuid, version: sql`version + 1` } as any)
    .where(and(eq(vatConfigurationVersions.id, id), eq(vatConfigurationVersions.companyId, actor.companyId)));
  return { success: true };
}

// ─── VAT Ledger Entries ──────────────────────────────────────────────────────

export async function listVatEntries(companyId: string, filters?: { period?: string; year?: number; type?: string; direction?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [eq(vatLedgerEntries.companyId, companyId), isNull(vatLedgerEntries.deletedAt)];
  if (filters?.period) conds.push(eq(vatLedgerEntries.referencePeriod, filters.period));
  if (filters?.type) conds.push(eq(vatLedgerEntries.type, filters.type));
  if (filters?.direction) conds.push(eq(vatLedgerEntries.direction, filters.direction));
  return db.select().from(vatLedgerEntries)
    .where(and(...conds))
    .orderBy(desc(vatLedgerEntries.referenceDate));
}

export async function getVatEntriesByPeriod(companyId: string, period: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatLedgerEntries)
    .where(and(
      eq(vatLedgerEntries.companyId, companyId),
      eq(vatLedgerEntries.referencePeriod, period),
      isNull(vatLedgerEntries.deletedAt),
    ))
    .orderBy(desc(vatLedgerEntries.referenceDate));
}

export async function insertVatEntry(actor: ActorContext, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, data);
  await db.insert(vatLedgerEntries).values(row as any);
  return row;
}

// ─── VAT Periods ─────────────────────────────────────────────────────────────

export async function listVatPeriods(companyId: string, year?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [eq(vatPeriods.companyId, companyId), isNull(vatPeriods.deletedAt)];
  if (year) conds.push(eq(vatPeriods.year, year));
  return db.select().from(vatPeriods)
    .where(and(...conds))
    .orderBy(desc(vatPeriods.year), desc(vatPeriods.period));
}

export async function getVatPeriod(companyId: string, period: string, year: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vatPeriods)
    .where(and(
      eq(vatPeriods.companyId, companyId),
      eq(vatPeriods.period, period),
      eq(vatPeriods.year, year),
      isNull(vatPeriods.deletedAt),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertVatPeriod(actor: ActorContext, period: string, year: number, status: string, extra?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getVatPeriod(actor.companyId, period, year);
  if (existing) {
    await db.update(vatPeriods)
      .set({ status, ...extra, updatedBy: actor.userUuid, version: sql`version + 1` } as any)
      .where(eq(vatPeriods.id, existing.id));
    return { ...existing, status, ...extra };
  }
  const row = withCreate(actor, { period, year, status, ...extra });
  await db.insert(vatPeriods).values(row as any);
  return row;
}
