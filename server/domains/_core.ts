import { randomUUID } from "crypto";
import { and, eq, isNull, SQL } from "drizzle-orm";
import type { TrpcContext } from "../_core/context";
import { getActiveCompanyId } from "../db";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * FALLINITY FEOS — DOMAIN CORE
 * ──────────────────────────────────────────────────────────────────────────────
 * Utility condivise da tutti i domini (finance, livestock, fleet, crop,
 * inventory, reinvestment). Garantiscono coerenza su:
 *  - UUID generati a livello applicativo
 *  - Multi-tenant: ogni scrittura include companyId, ogni lettura filtra companyId
 *  - Audit: createdBy / updatedBy dall'utente corrente
 *  - Soft delete: deletedAt / deletedBy invece di DELETE fisico
 * ──────────────────────────────────────────────────────────────────────────────
 */

export const newId = () => randomUUID();

export type ActorContext = {
  companyId: string;
  userId: number;
  userUuid: string;
};

/** Ricava il contesto attore (company + utente) dalla richiesta tRPC. */
export async function getActor(ctx: TrpcContext): Promise<ActorContext> {
  const companyId = await getActiveCompanyId(ctx.user);
  return {
    companyId,
    userId: ctx.user?.id ?? 0,
    userUuid: ctx.user?.uuid ?? "system",
  };
}

/** Campi standard da iniettare in ogni insert di entità operativa. */
export function withCreate<T extends Record<string, unknown>>(actor: ActorContext, data: T) {
  return {
    id: newId(),
    companyId: actor.companyId,
    createdBy: actor.userUuid,
    updatedBy: actor.userUuid,
    ...data,
  };
}

/** Campi standard da iniettare in ogni update. */
export function withUpdate<T extends Record<string, unknown>>(actor: ActorContext, data: T) {
  return {
    updatedBy: actor.userUuid,
    ...data,
  };
}

/** Payload di soft delete. */
export function softDeletePayload(actor: ActorContext) {
  return {
    deletedAt: new Date(),
    deletedBy: actor.userUuid,
  };
}

/**
 * Combina i filtri multi-tenant + soft-delete con eventuali condizioni extra.
 * `companyCol` e `deletedCol` sono le colonne della tabella target.
 */
export function tenantScope(companyCol: any, deletedCol: any, companyId: string, ...extra: (SQL | undefined)[]) {
  return and(eq(companyCol, companyId), isNull(deletedCol), ...extra);
}
