import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { getDb } from "../server/db";
import { sdk } from "../server/_core/sdk";
import { users, companyMemberships, userModulePermissions } from "../drizzle/schema";

// Estende solo la fixture UI temporanea F96. La sua cleanup rimuove anche questi utenti/permessi.
const path = "/home/ubuntu/fleet96-ui-private.json";
if (!fs.existsSync(path)) throw new Error("Preparare prima la fixture UI isolata");
const state = JSON.parse(fs.readFileSync(path, "utf8"));
const db = await getDb(); if (!db) throw new Error("Database non disponibile");
const viewer = state.sessions.find((s: any) => s.role === "viewer");
await db.insert(userModulePermissions).values({ id: randomUUID(), companyId: state.companyId, userId: viewer.userId, moduleKey: "azienda.magazzino", canView: true, canEdit: false });
const uuid = randomUUID(); const openId = `invoice98-${uuid}`;
const [user] = await db.insert(users).values({ uuid, openId, name: "TEST UI Ricezione Magazzino", activeCompanyId: state.companyId }).$returningId();
state.sessions.push({ userId: user.id, role: "operator", token: await sdk.createSessionToken(openId, { expiresInMs: 1800000, name: "TEST UI Ricezione" }) });
fs.writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
await db.insert(companyMemberships).values({ id: randomUUID(), companyId: state.companyId, userId: user.id, roleCode: "operator" });
await db.insert(userModulePermissions).values({ id: randomUUID(), companyId: state.companyId, userId: user.id, moduleKey: "azienda.magazzino", canView: true, canEdit: true });
console.log("Fixture Magazzino estesa: viewer e operatore senza accesso economico; token non esposti");
process.exit(0);
