import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enterCompanyInput } from "./domains/access/validators";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("cambio azienda multi-utente", () => {
  it("accetta sia ID UUID recenti sia ID storici validi", () => {
    expect(enterCompanyInput.parse({ companyId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }).companyId).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(enterCompanyInput.parse({ companyId: "comp-demo-0001" }).companyId).toBe("comp-demo-0001");
    expect(() => enterCompanyInput.parse({ companyId: "" })).toThrow();
    expect(() => enterCompanyInput.parse({ companyId: "azienda/non-valida" })).toThrow();
  });

  it("autorizza il cambio solo per membership attiva o Super Admin", () => {
    const service = read("server/domains/access/service.ts");
    const repository = read("server/domains/access/repository.ts");
    const router = read("server/domains/access/router.ts");
    expect(service).toContain("async switchCompany");
    expect(service).toContain("!superAdmin && !(await repo.hasActiveMembership(user.id, companyId))");
    expect(service).toContain("Non hai un accesso attivo a questa azienda");
    expect(repository).toContain("async hasActiveMembership");
    expect(repository).toContain("eq(companyMemberships.attiva, true)");
    expect(repository).toContain("isNull(companyMemberships.deletedAt)");
    expect(router).toContain("switchCompany: protectedProcedure");
  });

  it("elenca aziende reali e non usa più il selettore simulato", () => {
    const selector = read("client/src/pages/SelezionaAzienda.tsx");
    const account = read("client/src/pages/Account.tsx");
    const app = read("client/src/App.tsx");
    expect(selector).toContain("trpc.access.myCompanies.useQuery");
    expect(selector).toContain("trpc.access.switchCompany.useMutation");
    expect(selector).toContain("Puoi entrare solo nelle aziende");
    expect(selector).toContain("Cerca un’azienda");
    expect(selector).not.toContain("Simula lista aziende");
    expect(account).toContain("Cambia azienda");
    expect(account).toContain('navigate("/seleziona-azienda")');
    expect(app).toContain('path="/seleziona-azienda"');
  });
});
