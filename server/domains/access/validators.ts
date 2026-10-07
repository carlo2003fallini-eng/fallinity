import { z } from "zod";
import { ACCESS_MODULE_KEYS } from "../../../shared/access";

export const membershipRoles = ["company_admin", "manager", "operator", "consultant", "viewer"] as const;
const moduleKeys = z.array(z.enum(ACCESS_MODULE_KEYS)).max(ACCESS_MODULE_KEYS.length).transform((items) => Array.from(new Set(items)));

export const inviteUserInput = z.object({
  email: z.string().trim().email().max(320),
  roleCode: z.enum(membershipRoles).default("operator"),
  moduleKeys,
});

export const updateUserAccessInput = z.object({
  userId: z.number().int().positive(),
  roleCode: z.enum(membershipRoles),
  attiva: z.boolean(),
  moduleKeys,
});

export const updateCompanyInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  settore: z.string().trim().max(100).optional(),
  attiva: z.boolean(),
});

export const createCompanyInput = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  settore: z.string().trim().max(100).optional(),
  primaryAdminEmail: z.string().trim().email().max(320),
  attiva: z.boolean().default(true),
});

// Le aziende create nelle prime versioni possono avere ID tecnici legacy (es. comp-demo-0001),
// mentre quelle recenti usano UUID. L’autorizzazione resta verificata lato servizio/repository.
export const enterCompanyInput = z.object({ companyId: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) });
export const invitationTokenInput = z.object({
  token: z.string().trim().min(32).max(72).regex(/^[a-f0-9-]+$/i),
});

export type InviteUserInput = z.infer<typeof inviteUserInput>;
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessInput>;
export type UpdateCompanyInput = z.infer<typeof updateCompanyInput>;
export type CreateCompanyInput = z.infer<typeof createCompanyInput>;
