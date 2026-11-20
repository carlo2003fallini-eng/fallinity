import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { sdk } from "../server/_core/sdk";
import { COOKIE_NAME } from "../shared/const";
import * as schema from "../drizzle/schema";
import { withCreate } from "../server/domains/_core";
import { feedingService } from "../server/domains/feeding/service";
import { saveNir } from "../server/domains/feeding/nutrition";
const statePath = "/home/ubuntu/feeding99-ui-private.json";
const db = await getDb();
if (!db) throw new Error("Database non disponibile");
if (process.argv[2] === "cleanup") {
  if (fs.existsSync(statePath)) {
    const s = JSON.parse(fs.readFileSync(statePath, "utf8"));
    for (const table of [
      schema.userModulePermissions,
      schema.companyMemberships,
      schema.feedingComparisons,
      schema.feedingCorrections,
      schema.feedingLeftovers,
      schema.feedingDistributions,
      schema.feedingRuns,
      schema.feedingNirAnalyses,
      schema.feedingRecipes,
      schema.feedingSettings,
      schema.feedingContainers,
      schema.datiStallaRilevazioni,
      schema.movimentiMagazzino,
      schema.prodotti,
      schema.gruppiAnimali,
      schema.animali,
      schema.gruppi,
    ])
      await db.delete(table).where(eq(table.companyId, s.companyId));
    for (const user of s.sessions)
      await db.delete(schema.users).where(eq(schema.users.id, user.userId));
    await db
      .delete(schema.companies)
      .where(eq(schema.companies.id, s.companyId));
    fs.unlinkSync(statePath);
    console.log("Fixture Alimentazione isolate eliminate");
  }
} else {
  if (fs.existsSync(statePath))
    throw new Error("Esegui cleanup della fixture precedente");
  const companyId = randomUUID();
  const state: any = {
    companyId,
    cookieName: COOKIE_NAME,
    sessions: [],
    groupIds: [],
    productIds: [],
    recipeIds: [],
  };
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  await db
    .insert(schema.companies)
    .values({ id: companyId, name: `TEST UI ALIMENTAZIONE ${companyId}` });
  for (const role of ["company_admin", "operator", "viewer"] as const) {
    const uuid = randomUUID();
    const openId = `feed-ui-${uuid}`;
    const [u] = await db
      .insert(schema.users)
      .values({
        uuid,
        openId,
        name: `TEST ${role}`,
        platformRole: role,
        activeCompanyId: companyId,
      })
      .$returningId();
    state.sessions.push({
      userId: u.id,
      userUuid: uuid,
      role,
      token: await sdk.createSessionToken(openId, {
        expiresInMs: 1800000,
        name: `TEST ${role}`,
      }),
    });
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    await db
      .insert(schema.companyMemberships)
      .values({ id: randomUUID(), userId: u.id, companyId, roleCode: role });
    if (role !== "company_admin")
      await db
        .insert(schema.userModulePermissions)
        .values({
          id: randomUUID(),
          companyId,
          userId: u.id,
          moduleKey: "azienda.stalla.alimentazione",
          canView: true,
          canEdit: role === "operator",
        });
  }
  const actor = {
    companyId,
    userId: state.sessions[0].userId,
    userUuid: state.sessions[0].userUuid,
  };
  for (const [g, n, f, typ] of [
    ["Primo (test)", 85, 2, "Lattazione"],
    ["Secondo (test)", 64, 1, "Lattazione"],
    ["Asciutta (test)", 18, 0.5, "Asciutta"],
    ["Manze (test)", 32, 1 / 3, "Manze"],
  ] as const) {
    const id = randomUUID();
    state.groupIds.push(id);
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    await db
      .insert(schema.gruppi)
      .values(
        withCreate(actor, {
          id,
          nome: g,
          tipologia: typ.toLowerCase() as "lattazione" | "asciutta" | "manze",
          stato: "attivo",
          tipoGestione: "manuale",
        })
      );
    await db
      .insert(schema.animali)
      .values(
        Array.from({ length: n }, (_, i) =>
          withCreate(actor, {
            id: randomUUID(),
            matricola: `TEST-${id.slice(0, 8)}-${i}`,
            numeroAziendale: `TEST-${i}`,
            nome: `Bovina test ${i}`,
            gruppo: g,
            gruppoId: id,
            statoProduttivo:
              typ === "Lattazione"
                ? "in_lattazione"
                : typ === "Asciutta"
                  ? "asciutta"
                  : "manza",
            stato: typ === "Asciutta" ? "asciutta" : "attiva",
          })
        )
      );
    await feedingService.configureFrequency(actor, {
      groupId: id,
      runsPerDay: f,
      confirm: true,
    });
  }
  const foods = [
    ["Silomais (test)", 42000, 0.09, 34, 8.1, 42, 32],
    ["Fieno (test)", 8500, 0.22, 86, 12.5, 56, 2],
    ["Farina di mais (test)", 12000, 0.32, 88, 9, 10, 72],
    ["Soia (test)", 4500, 0.48, 89, 46, 13, 3],
    ["Integratore (test)", 1500, 1.2, 95, null, null, null],
  ] as const;
  for (const [name, stock, cost, ss, pg, ndf, am] of foods) {
    const id = randomUUID();
    state.productIds.push(id);
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    await db
      .insert(schema.prodotti)
      .values(
        withCreate(actor, {
          id,
          nome: name,
          categoria: "Alimenti",
          unitaMisura: "kg",
          quantita: String(stock),
          prezzoUnitario: String(cost),
          costoMedioUnitario: String(cost),
          costoFonte: "Fixture test: costo documentato",
          quantitaMinima: "100",
        })
      );
    const params: any = {
      ss: { value: ss, unit: "%", basis: "TQ" },
      umidita: { value: 100 - ss, unit: "%", basis: "TQ" },
      proteina: { value: pg, unit: "%", basis: "SS" },
      ndf: { value: ndf, unit: "%", basis: "SS" },
      amido: { value: am, unit: "%", basis: "SS" },
    };
    await saveNir(actor, {
      productId: id,
      at: Date.now() - 86400000,
      params,
      method: "NIR test informatico",
      activate: true,
      confirm: true,
    });
  }
  const quantities = [
    [25, 5, 8, 3, 1],
    [23, 6, 6, 2, 1],
    [12, 8, 1, 1, 0.2],
    [10, 5, 2, 1, 0.2],
  ];
  for (let g = 0; g < 4; g++) {
    const result = await feedingService.saveRecipe(actor, {
      groupId: state.groupIds[g],
      nome: `Ricetta test ${g + 1}`,
      ingredients: state.productIds.map((productId: string, i: number) => ({
        productId,
        kgPerHead: quantities[g][i],
        order: i,
      })),
      responsible: "Solo test informatico — non razione approvata",
      confirm: true,
    });
    state.recipeIds.push(result.id);
    await feedingService.activateRecipe(actor, {
      id: result.id,
      confirm: true,
    });
  }
  const c = await feedingService.saveContainer(actor, {
    nome: "Benna test calibrata",
    kg: 350,
    groupId: state.groupIds[0],
    confirm: true,
  });
  state.containerId = c.id;
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log("Fixture Alimentazione isolate create; token non esposti");
}
process.exit(0);
