import { describe, expect, it } from "vitest";
import { ACCESS_MODULES, ALL_ACCESS_MODULE_KEYS } from "../shared/access";
import { firstAvailableOperationalPath, firstOperationalPath, hasModule, moduleForPath } from "../client/src/lib/access";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("catalogo accessi Fallinity", () => {
  it("include le aree agricole, finanziarie e strumenti estensibili", () => {
    expect(ACCESS_MODULES.some((item) => item.key === "azienda.stalla.dati_latte")).toBe(true);
    expect(ACCESS_MODULES.some((item) => item.key === "finanza.fatturazione")).toBe(true);
    expect(ALL_ACCESS_MODULE_KEYS.length).toBeGreaterThan(12);
  });

  it("deriva correttamente le route e la destinazione di un dipendente", () => {
    expect(moduleForPath("/stalla")).toBe("azienda.stalla");
    expect(moduleForPath("/finanza/analisi")).toBe("finanza.kpi");
    expect(moduleForPath("/magazzino")).toBe("azienda.magazzino");
    expect(hasModule(["azienda.stalla"], "azienda.stalla.dati_latte")).toBe(true);
    expect(firstOperationalPath(["azienda.stalla"])).toBe("/stalla");
    expect(firstOperationalPath(["azienda.stalla", "finanza.movimenti"])).toBeNull();
    expect(firstAvailableOperationalPath(["azienda.stalla", "finanza.movimenti"])).toBe("/stalla");
  });
});

describe("contratti account e isolamento", () => {
  it("espone pagine complete per Account, utenti e Super Admin", () => {
    const app = read("client/src/App.tsx");
    const account = read("client/src/pages/Account.tsx");
    expect(app).toContain('path="/account"');
    expect(app).toContain('path="/account/utenti"');
    expect(app).toContain('path="/super-admin"');
    expect(account).toContain("Utenti e accessi");
    expect(account).toContain("Super Admin Fallinity");
  });

  it("sostituisce il dropdown account con una pagina e filtra la navigazione", () => {
    const layout = read("client/src/components/DashboardLayout.tsx");
    const azienda = read("client/src/pages/Azienda.tsx");
    const grid = read("client/src/components/azienda/CompanyAreasGrid.tsx");
    expect(layout).toContain('navigate("/account")');
    expect(layout).toContain("moduleForPath");
    expect(layout).toContain("firstAvailableOperationalPath");
    expect(layout).toContain("Accesso non abilitato");
    expect(layout).not.toContain("DropdownMenu");
    expect(azienda).toContain("allowedAreas");
    expect(grid).toContain("allowedAreas.includes(area.id)");
  });

  it("persiste inviti, autorizzazioni individuali e audit Super Admin", () => {
    const schema = read("drizzle/schema.ts");
    const repository = read("server/domains/access/repository.ts");
    const database = read("server/db.ts");
    expect(schema).toContain("userModulePermissions");
    expect(schema).toContain("companyInvitations");
    expect(schema).toContain("superAdminAccessLogs");
    expect(repository).toContain("logSuperAdminAccess");
    expect(database).toContain("activatePendingInvitationsForUser");
    expect(database).toContain("Nessuna azienda attiva associata");
  });
});
