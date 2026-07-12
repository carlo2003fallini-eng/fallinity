import { and, eq, isNull, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { scenari, ipotesiScenario } from "../../../drizzle/schema";
import { tenantScope, withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

export async function listScenari(companyId: string, stato?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(scenari)
    .where(and(
      eq(scenari.companyId, companyId),
      isNull(scenari.deletedAt),
      stato ? eq(scenari.stato, stato as any) : undefined,
    ))
    .orderBy(scenari.createdAt);
  return rows;
}

export async function getScenario(companyId: string, id: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(scenari)
    .where(tenantScope(scenari.companyId, scenari.deletedAt, companyId, eq(scenari.id, id)));
  return row ?? null;
}

export async function getIpotesiByScenario(companyId: string, scenarioId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ipotesiScenario)
    .where(and(
      eq(ipotesiScenario.companyId, companyId),
      eq(ipotesiScenario.scenarioId, scenarioId),
      isNull(ipotesiScenario.deletedAt),
    ));
}

export async function insertScenario(actor: ActorContext, data: { nome: string; descrizione?: string; modello: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, {
    nome: data.nome,
    descrizione: data.descrizione ?? null,
    modello: data.modello,
    stato: "bozza" as const,
    risultatoJson: null,
    calcolatoIl: null,
  });
  await db.insert(scenari).values(row as any);
  return row;
}

export async function insertIpotesi(actor: ActorContext, data: {
  scenarioId: string;
  variabile: string;
  valoreAttuale: number;
  valoreIpotesi: number;
  unita: string;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const row = withCreate(actor, {
    scenarioId: data.scenarioId,
    variabile: data.variabile,
    valoreAttuale: String(data.valoreAttuale),
    valoreIpotesi: String(data.valoreIpotesi),
    unita: data.unita,
    note: data.note ?? null,
  });
  await db.insert(ipotesiScenario).values(row as any);
  return row;
}

export async function insertIpotesiBatch(actor: ActorContext, scenarioId: string, ipotesi: Array<{
  variabile: string;
  valoreAttuale: number;
  valoreIpotesi: number;
  unita: string;
  note?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = ipotesi.map(ip => withCreate(actor, {
    scenarioId,
    variabile: ip.variabile,
    valoreAttuale: String(ip.valoreAttuale),
    valoreIpotesi: String(ip.valoreIpotesi),
    unita: ip.unita,
    note: ip.note ?? null,
  }));
  if (rows.length > 0) {
    await db.insert(ipotesiScenario).values(rows as any);
  }
  return rows;
}

export async function updateScenarioRisultato(actor: ActorContext, id: string, risultatoJson: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(scenari)
    .set(withUpdate(actor, { risultatoJson, stato: "calcolato" as const, calcolatoIl: new Date() }))
    .where(eq(scenari.id, id));
}

export async function archiviaScenario(actor: ActorContext, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(scenari)
    .set(withUpdate(actor, { stato: "archiviato" as const }))
    .where(eq(scenari.id, id));
}

export async function deleteScenario(actor: ActorContext, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(scenari)
    .set(softDeletePayload(actor))
    .where(eq(scenari.id, id));
}

export async function updateIpotesi(actor: ActorContext, id: string, data: { valoreIpotesi: number; note?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(ipotesiScenario)
    .set(withUpdate(actor, { valoreIpotesi: String(data.valoreIpotesi), note: data.note ?? null }))
    .where(eq(ipotesiScenario.id, id));
}

export async function removeIpotesi(actor: ActorContext, id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(ipotesiScenario)
    .set(softDeletePayload(actor))
    .where(eq(ipotesiScenario.id, id));
}

export async function getScenariByIds(companyId: string, ids: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  return db.select().from(scenari)
    .where(and(
      eq(scenari.companyId, companyId),
      isNull(scenari.deletedAt),
      inArray(scenari.id, ids),
    ));
}
