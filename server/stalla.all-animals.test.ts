import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filtriAnimaliInput } from "./domains/livestock/validators";

const animalsSource = readFileSync(new URL("../client/src/pages/stalla/AnimaliTab.tsx", import.meta.url), "utf8");
const groupsSource = readFileSync(new URL("../client/src/pages/stalla/GruppiTab.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("./domains/livestock/repository.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./domains/livestock/router.ts", import.meta.url), "utf8");

describe("Stalla — anagrafica completa animali", () => {
  it("collega Gruppi a un solo accesso orizzontale per l’intera mandria", () => {
    expect(groupsSource).toContain("onOpenAllAnimals");
    expect(groupsSource).toContain(">Tutti gli animali</span>");
    expect(groupsSource).toContain("Visualizza e cerca nell’intera mandria");
    expect(appSource).toContain('path="/stalla/animali" component={TuttiAnimali}');
    expect(appSource.indexOf('path="/stalla/animali"')).toBeLessThan(appSource.indexOf('path="/stalla/:sectionId"'));
  });

  it("mostra tutta la mandria e consente ricerca per matricola o numero aziendale", () => {
    expect(animalsSource).toContain("anagraficaCompleta");
    expect(animalsSource).toContain(">Tutti gli animali</h1>");
    expect(animalsSource).toContain("Visualizza e cerca nell’intera mandria");
    expect(animalsSource).toContain('placeholder={anagraficaCompleta ? "Cerca per matricola o n° aziendale..."');
    expect(animalsSource).toContain("displayList.map");
    expect(animalsSource).not.toContain("displayList.slice(0, 30)");
  });

  it("filtra l’anagrafica per gruppo e stato con query isolata per azienda", () => {
    expect(animalsSource).toContain("Tutti i gruppi");
    expect(animalsSource).toContain("Tutti gli stati");
    expect(animalsSource).toContain("trpc.stalla.animali.list.useQuery");
    expect(routerSource).toContain("animali: router({");
    expect(routerSource).toContain("list: protectedProcedure.input(filtriAnimaliInput)");
    expect(repositorySource).toContain("async listAnimaliFiltrati(companyId: string");
    expect(repositorySource).toContain("eq(animali.companyId, companyId)");
    expect(repositorySource).toContain("like(animali.matricola, pattern)");
    expect(repositorySource).toContain("like(animali.numeroAziendale, pattern)");
  });

  it("convalida gli stati ammessi nel filtro dell’anagrafica", () => {
    expect(filtriAnimaliInput.safeParse({ gruppoId: "grp-1", stato: "attiva", ricerca: "IT001" }).success).toBe(true);
    expect(filtriAnimaliInput.safeParse({ stato: "non-valido" }).success).toBe(false);
  });
});
