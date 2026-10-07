import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import { InsertUser, users, companies, companyInvitations, companyMemberships, userModulePermissions } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      uuid: randomUUID(),
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
      values.platformRole = 'super_admin';
      updateSet.platformRole = 'super_admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // uuid is only set on insert (not in updateSet), so existing rows keep their uuid.
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Collega automaticamente l'account autenticato agli inviti inviati alla sua email. */
export async function activatePendingInvitationsForUser(user: { id: number; uuid: string; email?: string | null; activeCompanyId?: string | null }) {
  if (!user.email) return;
  const db = await getDb();
  if (!db) return;
  const email = user.email.trim().toLowerCase();
  const invitations = await db.select().from(companyInvitations).where(and(
    eq(companyInvitations.email, email),
    eq(companyInvitations.stato, "pending"),
    isNull(companyInvitations.deletedAt),
  ));
  if (!invitations.length) return;

  await db.transaction(async (tx) => {
    for (const invitation of invitations) {
      await tx.insert(companyMemberships).values({
        id: randomUUID(), companyId: invitation.companyId, userId: user.id,
        roleCode: invitation.roleCode, attiva: true,
        createdBy: invitation.createdBy, updatedBy: user.uuid,
      } as any).onDuplicateKeyUpdate({
        set: { roleCode: invitation.roleCode, attiva: true, deletedAt: null, deletedBy: null, updatedBy: user.uuid },
      });
      await tx.update(userModulePermissions).set({ canView: false, canEdit: false, updatedBy: user.uuid })
        .where(and(eq(userModulePermissions.companyId, invitation.companyId), eq(userModulePermissions.userId, user.id), isNull(userModulePermissions.deletedAt)));
      const moduleKeys = Array.isArray(invitation.moduleKeys) ? invitation.moduleKeys.filter((item): item is string => typeof item === "string") : [];
      if (moduleKeys.length) {
        const permissionRows = moduleKeys.map((moduleKey) => ({
          id: randomUUID(), companyId: invitation.companyId, userId: user.id, moduleKey,
          canView: true, canEdit: invitation.roleCode !== "viewer", createdBy: user.uuid, updatedBy: user.uuid,
        }));
        await tx.insert(userModulePermissions).values(permissionRows as any).onDuplicateKeyUpdate({
          set: { canView: true, canEdit: invitation.roleCode !== "viewer", updatedBy: user.uuid, deletedAt: null, deletedBy: null },
        });
      }
      await tx.update(companyInvitations).set({ stato: "accepted", acceptedAt: new Date(), acceptedByUuid: user.uuid, updatedBy: user.uuid })
        .where(eq(companyInvitations.id, invitation.id));
    }
    if (!user.activeCompanyId) {
      await tx.update(users).set({ activeCompanyId: invitations[0]!.companyId }).where(eq(users.id, user.id));
    }
  });
}

/**
 * Restituisce la company attiva dell'utente. Se l'utente non ha activeCompanyId,
 * prova a derivarla dalla prima membership attiva. Fallback all'azienda demo.
 */
export async function getActiveCompanyId(user: { id: number; openId?: string; platformRole?: string | null; activeCompanyId?: string | null } | null): Promise<string> {
  if (!user) throw new Error("Utente non autenticato");
  const db = await getDb();
  if (!db) throw new Error("Database non disponibile");
  const isSuperAdmin = user.openId === ENV.ownerOpenId || user.platformRole === "super_admin" || user.platformRole === "platform_owner";

  if (user.activeCompanyId) {
    if (isSuperAdmin) return user.activeCompanyId;
    const activeMembership = await db.select().from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(and(
        eq(companyMemberships.userId, user.id),
        eq(companyMemberships.companyId, user.activeCompanyId),
        eq(companyMemberships.attiva, true),
        eq(companies.attiva, true),
        isNull(companyMemberships.deletedAt),
        isNull(companies.deletedAt),
      )).limit(1);
    if (activeMembership[0]) return user.activeCompanyId;
  }

  const memberships = await db.select().from(companyMemberships)
    .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
    .where(and(
      eq(companyMemberships.userId, user.id),
      eq(companyMemberships.attiva, true),
      eq(companies.attiva, true),
      isNull(companyMemberships.deletedAt),
      isNull(companies.deletedAt),
    )).limit(1);
  if (!memberships[0]) throw new Error("Nessuna azienda attiva associata a questo account");
  return memberships[0].companyMemberships.companyId;
}
