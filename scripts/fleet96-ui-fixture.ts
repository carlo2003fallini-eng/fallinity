import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { sdk } from "../server/_core/sdk";
import { COOKIE_NAME } from "../shared/const";
import { companies, users, companyMemberships, userModulePermissions, macchine, prodotti, interventi, interventoRicambi, movimentiMagazzino, prelieviOfficina, eventi, proposteFinanziarie, integrationSettings } from "../drizzle/schema";
import { withCreate } from "../server/domains/_core";

const statePath = "/home/ubuntu/fleet96-ui-private.json";
const db = await getDb();
if (!db) throw new Error("Database non disponibile");
if (process.argv[2] === "cleanup") {
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    for (const table of [userModulePermissions, companyMemberships, eventi, proposteFinanziarie, integrationSettings, prelieviOfficina, interventoRicambi, movimentiMagazzino, interventi, prodotti, macchine]) {
      await db.delete(table).where(eq(table.companyId, state.companyId));
    }
    for (const user of state.sessions) await db.delete(users).where(eq(users.id, user.userId));
    await db.delete(companies).where(eq(companies.id, state.companyId));
    fs.unlinkSync(statePath);
    console.log("Fixture UI isolate eliminate");
  }
} else {
  if (fs.existsSync(statePath)) throw new Error("Fixture esistente: eseguire prima cleanup");
  const companyId = randomUUID();
  const state: any = { companyId, cookieName: COOKIE_NAME, sessions: [] };
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  await db.insert(companies).values({ id: companyId, name: `TEST UI F96 ${companyId}` });
  for (const role of ["company_admin", "viewer"] as const) {
    const uuid = randomUUID();
    const openId = `ui96-${uuid}`;
    const [user] = await db.insert(users).values({ uuid, openId, name: `TEST UI ${role}`, platformRole: role, activeCompanyId: companyId }).$returningId();
    state.sessions.push({ userId: user.id, role, token: await sdk.createSessionToken(openId, { expiresInMs: 1800000, name: `TEST UI ${role}` }) });
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    await db.insert(companyMemberships).values({ id: randomUUID(), userId: user.id, companyId, roleCode: role });
    if (role === "viewer") await db.insert(userModulePermissions).values({ id: randomUUID(), companyId, userId: user.id, moduleKey: "azienda.officina", canView: true, canEdit: false });
  }
  const actor = { companyId, userId: state.sessions[0].userId, userUuid: randomUUID() };
  const machineId = randomUUID();
  await db.insert(macchine).values(withCreate(actor, { id: machineId, nome: "822", categoria: "Trattori", marca: "Fendt", modello: "Favorit", oreMotore: "14096", stato: "operativo" }) as any);
  const first = randomUUID();
  await db.insert(prodotti).values([
    withCreate(actor, { id: first, nome: "Filtro olio prova UI", codice: "F96-UI-FILTRO", categoria: "Ricambi", reparto: "Motore", famiglia: "Filtri", sottocategoria: "Olio", quantita: "5", quantitaMinima: "1", prezzoUnitario: "40", unitaMisura: "pz" }),
    withCreate(actor, { nome: "Raccordo prova UI", codice: "F96-UI-RACCORDO", categoria: "Ricambi", reparto: "Idraulica", famiglia: "Raccordi", quantita: "4", prezzoUnitario: "6", unitaMisura: "pz" }),
  ] as any);
  const workId = randomUUID();
  await db.insert(interventi).values(withCreate(actor, { id: workId, macchinaId: machineId, descrizione: "Manutenzione prova UI", data: new Date(), tipo: "manutenzione", stato: "in_corso", priorita: "media", costoRicambi: "0" }) as any);
  state.workId = workId; state.productId = first;
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log("Fixture UI isolate create; token non esposti");
}
process.exit(0);
