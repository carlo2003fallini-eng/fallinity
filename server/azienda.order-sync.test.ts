import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { updateCompanyAreasOrderInput } from "./domains/core/validators";

const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("./domains/core/repository.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./domains/core/router.ts", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./domains/core/service.ts", import.meta.url), "utf8");
const gridSource = readFileSync(new URL("../client/src/components/azienda/CompanyAreasGrid.tsx", import.meta.url), "utf8");

describe("Ordine aree Azienda — contratto sincronizzato", () => {
  it("accetta soltanto l’insieme completo e senza duplicati delle quattro aree", () => {
    expect(updateCompanyAreasOrderInput.parse({
      ordine: ["campi", "stalla", "magazzino", "officina"],
    }).ordine).toEqual(["campi", "stalla", "magazzino", "officina"]);

    expect(() => updateCompanyAreasOrderInput.parse({
      ordine: ["stalla", "stalla", "magazzino", "campi"],
    })).toThrow();
    expect(() => updateCompanyAreasOrderInput.parse({
      ordine: ["stalla", "magazzino", "officina"],
    })).toThrow();
  });

  it("isola e rende univoca la preferenza per azienda e utente", () => {
    expect(schemaSource).toContain('mysqlTable("preferenzeHomeAzienda"');
    expect(schemaSource).toContain("preferenze_home_azienda_company_user_unique");
    expect(repositorySource).toContain("eq(preferenzeHomeAzienda.companyId, actor.companyId)");
    expect(repositorySource).toContain("eq(preferenzeHomeAzienda.userUuid, actor.userUuid)");
    expect(repositorySource).toContain("onDuplicateKeyUpdate");
  });

  it("espone lettura e scrittura solo attraverso procedure protette", () => {
    expect(routerSource).toContain("ordineAree: protectedProcedure.input(companyAreasOrderScopeInput).query");
    expect(routerSource).toContain("salvaOrdineAree: protectedProcedure.input(updateCompanyAreasOrderInput).mutation");
    expect(serviceSource).toContain("salvato: Boolean(preference)");
  });

  it("usa il database come fonte primaria e il dispositivo come fallback offline", () => {
    expect(gridSource).toContain("trpc.azienda.ordineAree.useQuery");
    expect(gridSource).toContain("trpc.azienda.salvaOrdineAree.useMutation");
    expect(gridSource).toContain("fallinity:azienda:aree-ordine:v1:");
    expect(gridSource).toContain("companyKey || undefined");
    expect(gridSource).toContain("Il fallback locale evita di perdere l'ordine finché non torna la connessione.");
    expect(gridSource).toContain("utils.azienda.ordineAree.setData");
    expect(gridSource).toContain('window.addEventListener("online", retrySync)');
  });
});
