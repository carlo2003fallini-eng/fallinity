import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  companies,
  companyInvitations,
  companyMemberships,
  superAdminAccessLogs,
  userModulePermissions,
  users,
} from "../../../drizzle/schema";
import { newId, type ActorContext, withCreate, withUpdate } from "../_core";

type MembershipRole = "company_admin" | "manager" | "operator" | "consultant" | "viewer";

export const accessRepository = {
  async getMembership(companyId: string, userId: number) {
    const db = await getDb();
    if (!db) return null;
    const [membership] = await db.select().from(companyMemberships).where(and(
      eq(companyMemberships.companyId, companyId),
      eq(companyMemberships.userId, userId),
      eq(companyMemberships.attiva, true),
      isNull(companyMemberships.deletedAt),
    )).limit(1);
    return membership ?? null;
  },

  async getPermissions(companyId: string, userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(userModulePermissions).where(and(
      eq(userModulePermissions.companyId, companyId),
      eq(userModulePermissions.userId, userId),
      eq(userModulePermissions.canView, true),
      isNull(userModulePermissions.deletedAt),
    )).orderBy(asc(userModulePermissions.moduleKey));
  },

  async listCompanyUsers(companyId: string) {
    const db = await getDb();
    if (!db) return { users: [], permissions: [], invitations: [] };
    const memberships = await db.select({
      membership: companyMemberships,
      user: users,
    }).from(companyMemberships).innerJoin(users, eq(companyMemberships.userId, users.id)).where(and(
      eq(companyMemberships.companyId, companyId),
      isNull(companyMemberships.deletedAt),
    )).orderBy(asc(users.name));
    const permissions = await db.select().from(userModulePermissions).where(and(
      eq(userModulePermissions.companyId, companyId),
      isNull(userModulePermissions.deletedAt),
    ));
    const invitations = await db.select().from(companyInvitations).where(and(
      eq(companyInvitations.companyId, companyId),
      eq(companyInvitations.stato, "pending"),
      isNull(companyInvitations.deletedAt),
    )).orderBy(asc(companyInvitations.email));
    return { users: memberships, permissions, invitations };
  },

  async saveUserAccess(actor: ActorContext, userId: number, roleCode: MembershipRole, attiva: boolean, moduleKeys: string[]) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.transaction(async (tx) => {
      await tx.update(companyMemberships).set({
        ...withUpdate(actor, { roleCode, attiva, deletedAt: null, deletedBy: null }),
        version: sql`${companyMemberships.version} + 1`,
      } as any).where(and(eq(companyMemberships.companyId, actor.companyId), eq(companyMemberships.userId, userId)));
      await tx.update(userModulePermissions).set({
        canView: false,
        canEdit: false,
        updatedBy: actor.userUuid,
      }).where(and(eq(userModulePermissions.companyId, actor.companyId), eq(userModulePermissions.userId, userId), isNull(userModulePermissions.deletedAt)));
      if (moduleKeys.length) {
        const permissionRows = moduleKeys.map((moduleKey) => withCreate(actor, {
          userId,
          moduleKey,
          canView: true,
          canEdit: roleCode !== "viewer",
        }));
        await tx.insert(userModulePermissions).values(permissionRows as any).onDuplicateKeyUpdate({
          set: { canView: true, canEdit: roleCode !== "viewer", updatedBy: actor.userUuid, deletedAt: null, deletedBy: null },
        });
      }
    });
    return { success: true as const };
  },

  async inviteOrLinkUser(actor: ActorContext, email: string, roleCode: MembershipRole, moduleKeys: string[]) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    const normalizedEmail = email.trim().toLowerCase();
    const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existingUser) {
      await db.transaction(async (tx) => {
        await tx.insert(companyMemberships).values({
          id: newId(), companyId: actor.companyId, userId: existingUser.id, roleCode, attiva: true,
          createdBy: actor.userUuid, updatedBy: actor.userUuid,
        } as any).onDuplicateKeyUpdate({ set: withUpdate(actor, { roleCode, attiva: true, deletedAt: null, deletedBy: null }) as any });
      });
      await this.saveUserAccess(actor, existingUser.id, roleCode, true, moduleKeys);
      return { type: "linked" as const, userId: existingUser.id };
    }
    await db.insert(companyInvitations).values(withCreate(actor, {
      email: normalizedEmail,
      roleCode,
      moduleKeys,
      stato: "pending",
      acceptedAt: null,
      acceptedByUuid: null,
    }) as any).onDuplicateKeyUpdate({
      set: withUpdate(actor, {
        roleCode,
        moduleKeys,
        stato: "pending",
        acceptedAt: null,
        acceptedByUuid: null,
        deletedAt: null,
        deletedBy: null,
      }) as any,
    });
    return { type: "invited" as const };
  },

  async listMyCompanies(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select({ company: companies, membership: companyMemberships }).from(companyMemberships)
      .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
      .where(and(eq(companyMemberships.userId, userId), eq(companyMemberships.attiva, true), isNull(companyMemberships.deletedAt), eq(companies.attiva, true)))
      .orderBy(asc(companies.name));
  },

  async listAllCompanies() {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({ company: companies, user: users }).from(companies)
      .leftJoin(companyMemberships, and(eq(companyMemberships.companyId, companies.id), eq(companyMemberships.roleCode, "company_admin"), eq(companyMemberships.attiva, true), isNull(companyMemberships.deletedAt)))
      .leftJoin(users, eq(companyMemberships.userId, users.id))
      .where(isNull(companies.deletedAt)).orderBy(asc(companies.name));
    const unique = new Map<string, typeof rows[number]>();
    for (const row of rows) if (!unique.has(row.company.id)) unique.set(row.company.id, row);
    return Array.from(unique.values());
  },

  async getActiveCompany(companyId: string) {
    const db = await getDb();
    if (!db) return null;
    const [company] = await db.select().from(companies).where(and(
      eq(companies.id, companyId),
      eq(companies.attiva, true),
      isNull(companies.deletedAt),
    )).limit(1);
    return company ?? null;
  },

  async setActiveCompany(userId: number, companyId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.update(users).set({ activeCompanyId: companyId }).where(eq(users.id, userId));
  },

  async createCompany(actor: ActorContext, input: { name: string; email?: string; settore?: string; attiva: boolean; primaryAdminEmail: string }) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    const companyId = newId();
    await db.insert(companies).values({
      id: companyId,
      name: input.name,
      email: input.email || null,
      settore: input.settore || null,
      attiva: input.attiva,
      createdBy: actor.userUuid,
      updatedBy: actor.userUuid,
    } as any);
    return companyId;
  },

  async updateCompany(actor: ActorContext, input: { id: string; name: string; email?: string; settore?: string; attiva: boolean }) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.update(companies).set(withUpdate(actor, {
      name: input.name, email: input.email || null, settore: input.settore || null, attiva: input.attiva,
    }) as any).where(and(eq(companies.id, input.id), isNull(companies.deletedAt)));
    return { success: true as const };
  },

  async logSuperAdminAccess(superAdminUuid: string, companyId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.insert(superAdminAccessLogs).values({ id: newId(), companyId, superAdminUuid, accessType: "assistenza" } as any);
  },
};
