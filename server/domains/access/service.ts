import { TRPCError } from "@trpc/server";
import { ENV } from "../../_core/env";
import { ALL_ACCESS_MODULE_KEYS, type AccessModuleKey } from "../../../shared/access";
import type { ActorContext } from "../_core";
import { accessRepository as repo } from "./repository";
import type { CreateCompanyInput, InviteUserInput, UpdateCompanyInput, UpdateUserAccessInput } from "./validators";

const companyAdminRoles = new Set(["company_admin", "organization_admin"]);

export function isSuperAdmin(user: { openId: string; platformRole?: string | null }) {
  return user.openId === ENV.ownerOpenId || user.platformRole === "super_admin" || user.platformRole === "platform_owner";
}

export const accessService = {
  async profile(actor: ActorContext, user: { openId: string; platformRole?: string | null; email?: string | null; name?: string | null }) {
    const membership = await repo.getMembership(actor.companyId, actor.userId);
    const superAdmin = isSuperAdmin(user);
    const companyAdmin = superAdmin || Boolean(membership && companyAdminRoles.has(membership.roleCode));
    const permissions = companyAdmin ? ALL_ACCESS_MODULE_KEYS : (await repo.getPermissions(actor.companyId, actor.userId)).map((permission) => permission.moduleKey as AccessModuleKey);
    return {
      isSuperAdmin: superAdmin,
      isCompanyAdmin: companyAdmin,
      roleCode: companyAdmin ? "company_admin" : membership?.roleCode ?? "viewer",
      modules: permissions,
    };
  },

  async requireCompanyAdmin(actor: ActorContext, user: { openId: string; platformRole?: string | null }) {
    const profile = await this.profile(actor, user);
    if (!profile.isCompanyAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Non sei autorizzato a gestire utenti e accessi." });
    return profile;
  },

  requireSuperAdmin(user: { openId: string; platformRole?: string | null }) {
    if (!isSuperAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Area riservata al Super Admin Fallinity." });
  },

  async listUsers(actor: ActorContext, user: { openId: string; platformRole?: string | null }) {
    await this.requireCompanyAdmin(actor, user);
    const data = await repo.listCompanyUsers(actor.companyId);
    return {
      users: data.users.map((row) => ({
        id: row.user.id,
        nome: row.user.name || "Utente Fallinity",
        email: row.user.email || "—",
        attivo: row.membership.attiva,
        ruolo: row.membership.roleCode,
        moduli: companyAdminRoles.has(row.membership.roleCode)
          ? ALL_ACCESS_MODULE_KEYS
          : data.permissions.filter((permission) => permission.userId === row.user.id && permission.canView).map((permission) => permission.moduleKey),
      })),
      invitations: data.invitations.map((invite) => ({
        id: invite.id,
        email: invite.email,
        ruolo: invite.roleCode,
        moduli: Array.isArray(invite.moduleKeys) ? invite.moduleKeys.filter((module): module is string => typeof module === "string") : [],
        stato: invite.stato,
      })),
    };
  },

  async inviteUser(actor: ActorContext, user: { openId: string; platformRole?: string | null }, input: InviteUserInput) {
    await this.requireCompanyAdmin(actor, user);
    return repo.inviteOrLinkUser(actor, input.email, input.roleCode, input.moduleKeys);
  },

  async updateUser(actor: ActorContext, user: { openId: string; platformRole?: string | null }, input: UpdateUserAccessInput) {
    await this.requireCompanyAdmin(actor, user);
    if (input.userId === actor.userId && !input.attiva) throw new TRPCError({ code: "BAD_REQUEST", message: "Non puoi disattivare il tuo stesso accesso." });
    return repo.saveUserAccess(actor, input.userId, input.roleCode, input.attiva, input.moduleKeys);
  },

  listMyCompanies(userId: number) { return repo.listMyCompanies(userId); },

  async listAllCompanies(user: { openId: string; platformRole?: string | null }) {
    this.requireSuperAdmin(user);
    return repo.listAllCompanies();
  },

  async createCompany(actor: ActorContext, user: { openId: string; platformRole?: string | null }, input: CreateCompanyInput) {
    this.requireSuperAdmin(user);
    const companyId = await repo.createCompany(actor, input);
    const companyActor = { ...actor, companyId };
    await repo.inviteOrLinkUser(companyActor, input.primaryAdminEmail, "company_admin", ALL_ACCESS_MODULE_KEYS);
    return { id: companyId };
  },

  async updateCompany(actor: ActorContext, user: { openId: string; platformRole?: string | null }, input: UpdateCompanyInput) {
    this.requireSuperAdmin(user);
    return repo.updateCompany(actor, input);
  },

  async enterCompany(actor: ActorContext, user: { id: number; uuid: string; openId: string; platformRole?: string | null }, companyId: string) {
    this.requireSuperAdmin(user);
    const company = await repo.getActiveCompany(companyId);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Azienda non trovata o disattivata." });
    await repo.setActiveCompany(user.id, companyId);
    await repo.logSuperAdminAccess(user.uuid, companyId);
    return { success: true as const, companyId };
  },
};
