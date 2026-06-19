import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-fallinity",
    email: "alex@fallini.farm",
    name: "Alex Fallini",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Alex Fallini");
    expect(result?.role).toBe("admin");
  });
});

// ─── ROUTER STRUCTURE ────────────────────────────────────────────────────────

describe("appRouter structure", () => {
  it("exposes all required FEOS modules", () => {
    const routerKeys = Object.keys(appRouter._def.record);
    expect(routerKeys).toContain("auth");
    expect(routerKeys).toContain("dashboard");
    expect(routerKeys).toContain("azienda");
    expect(routerKeys).toContain("finanza");
    expect(routerKeys).toContain("campi");
    expect(routerKeys).toContain("magazzino");
    expect(routerKeys).toContain("officina");
    expect(routerKeys).toContain("calendario");
    expect(routerKeys).toContain("report");
    expect(routerKeys).toContain("ai");
  });

  it("exposes ai sub-procedures", () => {
    const aiRecord = (appRouter._def.record as any).ai;
    const keys = aiRecord._def?.record ? Object.keys(aiRecord._def.record) : Object.keys(aiRecord);
    expect(keys).toContain("sessions");
    expect(keys).toContain("messages");
    expect(keys).toContain("newSession");
    expect(keys).toContain("chat");
    expect(keys).toContain("deleteSession");
  });

  it("exposes finanza sub-procedures", () => {
    const finanzaRecord = (appRouter._def.record as any).finanza;
    const keys = finanzaRecord._def?.record ? Object.keys(finanzaRecord._def.record) : Object.keys(finanzaRecord);
    expect(keys).toContain("list");
    expect(keys).toContain("create");
    expect(keys).toContain("delete");
  });

  it("exposes officina sub-procedures", () => {
    const officinaRecord = (appRouter._def.record as any).officina;
    // officina may be a nested router or flat object
    const keys = officinaRecord._def?.record ? Object.keys(officinaRecord._def.record) : Object.keys(officinaRecord);
    expect(keys).toContain("macchine");
    expect(keys).toContain("interventi");
    expect(keys).toContain("dashboard");
  });

  it("exposes calendario sub-procedures incl. today", () => {
    const calRecord = (appRouter._def.record as any).calendario;
    const keys = calRecord._def?.record ? Object.keys(calRecord._def.record) : Object.keys(calRecord);
    expect(keys).toContain("list");
    expect(keys).toContain("today");
    expect(keys).toContain("create");
  });

  it("exposes azienda sub-procedures", () => {
    const azRecord = (appRouter._def.record as any).azienda;
    const keys = azRecord._def?.record ? Object.keys(azRecord._def.record) : Object.keys(azRecord);
    expect(keys).toContain("list");
    expect(keys).toContain("stats");
    expect(keys).toContain("create");
    expect(keys).toContain("delete");
  });

  it("exposes magazzino sub-procedures", () => {
    const magazzinoRecord = (appRouter._def.record as any).magazzino;
    const keys = magazzinoRecord._def?.record ? Object.keys(magazzinoRecord._def.record) : Object.keys(magazzinoRecord);
    expect(keys).toContain("list");
    expect(keys).toContain("create");
    expect(keys).toContain("delete");
  });

  it("exposes report sub-procedures", () => {
    const reportRecord = (appRouter._def.record as any).report;
    const keys = reportRecord._def?.record ? Object.keys(reportRecord._def.record) : Object.keys(reportRecord);
    expect(keys).toContain("summary");
    expect(keys).toContain("finanza");
    expect(keys).toContain("operativo");
  });
});

// ─── PROTECTED PROCEDURES ────────────────────────────────────────────────────

describe("protected procedures", () => {
  it("dashboard.kpi rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.kpi()).rejects.toThrow();
  });

  it("azienda.list rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.azienda.list()).rejects.toThrow();
  });

  it("finanza.list rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.finanza.list({ tipo: "entrata" })).rejects.toThrow();
  });
});
