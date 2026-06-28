import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  date,
} from "drizzle-orm/mysql-core";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * FALLINITY FEOS — DATABASE BIBLE (Alpha 0.2, Strada A)
 * ──────────────────────────────────────────────────────────────────────────────
 * Principi (Fallinity DNA):
 *  - Entity First: UUID come chiave primaria su tutte le entità.
 *  - Multi-tenant: ogni dato operativo appartiene a una Company (companyId).
 *  - Audit & Soft Delete: createdAt/By, updatedAt/By, deletedAt/By, version.
 *  - Zero Duplication: colonne standard centralizzate negli helper sotto.
 *
 * NOTA: le PK uuid sono generate a livello applicativo (crypto.randomUUID) nei
 * repository, per indipendenza dal DB engine.
 * ──────────────────────────────────────────────────────────────────────────────
 */

// Colonne di audit + soft-delete + versioning condivise da tutte le entità operative.
const auditColumns = {
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: varchar("createdBy", { length: 36 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 36 }),
  deletedAt: timestamp("deletedAt"),
  deletedBy: varchar("deletedBy", { length: 36 }),
  version: int("version").default(1).notNull(),
};

// Colonna PK uuid standard.
const uuidPk = () => varchar("id", { length: 36 }).primaryKey();

// Riferimento company standard (multi-tenant).
const companyRef = () => varchar("companyId", { length: 36 }).notNull();

export const FALLINITY_ROLES = [
  "platform_owner",
  "super_admin",
  "organization_admin",
  "company_admin",
  "manager",
  "operator",
  "consultant",
  "viewer",
] as const;

// ─── USERS ──────────────────────────────────────────────────────────────────
// Mantiene openId per OAuth Manus. id resta int autoincrement (richiesto dal core
// auth del template), ma aggiungiamo uuid pubblico e platformRole a 8 livelli.
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  uuid: varchar("uuid", { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID()),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  platformRole: mysqlEnum("platformRole", FALLINITY_ROLES).default("operator").notNull(),
  avatarUrl: text("avatarUrl"),
  activeCompanyId: varchar("activeCompanyId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── ORGANIZATION ─────────────────────────────────────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: uuidPk(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 120 }),
  logoUrl: text("logoUrl"),
  ...auditColumns,
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── COMPANY ──────────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: uuidPk(),
  organizationId: varchar("organizationId", { length: 36 }),
  name: varchar("name", { length: 255 }).notNull(),
  partitaIva: varchar("partitaIva", { length: 20 }),
  codiceFiscale: varchar("codiceFiscale", { length: 20 }),
  indirizzo: text("indirizzo"),
  citta: varchar("citta", { length: 100 }),
  provincia: varchar("provincia", { length: 50 }),
  cap: varchar("cap", { length: 10 }),
  telefono: varchar("telefono", { length: 20 }),
  email: varchar("email", { length: 320 }),
  settore: varchar("settore", { length: 100 }),
  ettari: decimal("ettari", { precision: 10, scale: 2 }),
  logoUrl: text("logoUrl"),
  coverUrl: text("coverUrl"),
  ...auditColumns,
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── FARM ─────────────────────────────────────────────────────────────────────
export const farms = mysqlTable("farms", {
  id: uuidPk(),
  companyId: companyRef(),
  name: varchar("name", { length: 255 }).notNull(),
  tipo: varchar("tipo", { length: 100 }),
  indirizzo: text("indirizzo"),
  ettari: decimal("ettari", { precision: 10, scale: 2 }),
  ...auditColumns,
});
export type Farm = typeof farms.$inferSelect;
export type InsertFarm = typeof farms.$inferInsert;

// ─── ROLE ─────────────────────────────────────────────────────────────────────
export const roles = mysqlTable("roles", {
  id: uuidPk(),
  code: mysqlEnum("code", FALLINITY_ROLES).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  livello: int("livello").default(0).notNull(),
  descrizione: text("descrizione"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

// ─── PERMISSION ───────────────────────────────────────────────────────────────
export const permissions = mysqlTable("permissions", {
  id: uuidPk(),
  code: varchar("code", { length: 120 }).notNull().unique(),
  descrizione: varchar("descrizione", { length: 255 }),
  dominio: varchar("dominio", { length: 60 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

// ─── MODULE ACCESS ────────────────────────────────────────────────────────────
export const moduleAccess = mysqlTable("moduleAccess", {
  id: uuidPk(),
  companyId: companyRef(),
  roleCode: mysqlEnum("roleCode", FALLINITY_ROLES).notNull(),
  modulo: varchar("modulo", { length: 60 }).notNull(),
  canView: boolean("canView").default(true).notNull(),
  canEdit: boolean("canEdit").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ModuleAccess = typeof moduleAccess.$inferSelect;
export type InsertModuleAccess = typeof moduleAccess.$inferInsert;

// ─── COMPANY MEMBERSHIP ───────────────────────────────────────────────────────
export const companyMemberships = mysqlTable("companyMemberships", {
  id: uuidPk(),
  userId: int("userId").notNull(),
  companyId: companyRef(),
  roleCode: mysqlEnum("roleCode", FALLINITY_ROLES).default("operator").notNull(),
  attiva: boolean("attiva").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: varchar("createdBy", { length: 36 }),
  deletedAt: timestamp("deletedAt"),
  deletedBy: varchar("deletedBy", { length: 36 }),
});
export type CompanyMembership = typeof companyMemberships.$inferSelect;
export type InsertCompanyMembership = typeof companyMemberships.$inferInsert;

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("auditLogs", {
  id: uuidPk(),
  companyId: varchar("companyId", { length: 36 }),
  userId: int("userId"),
  azione: varchar("azione", { length: 120 }).notNull(),
  entita: varchar("entita", { length: 80 }),
  entitaId: varchar("entitaId", { length: 36 }),
  dettagli: text("dettagli"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── CONTATTI (dipendenti, fornitori, clienti — entità unificata) ─────────────
export const contatti = mysqlTable("contatti", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: mysqlEnum("tipo", ["dipendente", "fornitore", "cliente"]).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cognome: varchar("cognome", { length: 255 }),
  aziendaNome: varchar("aziendaNome", { length: 255 }),
  email: varchar("email", { length: 320 }),
  telefono: varchar("telefono", { length: 20 }),
  indirizzo: text("indirizzo"),
  citta: varchar("citta", { length: 100 }),
  ruolo: varchar("ruolo", { length: 100 }),
  note: text("note"),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type Contatto = typeof contatti.$inferSelect;
export type InsertContatto = typeof contatti.$inferInsert;

// ─── CAMPI ────────────────────────────────────────────────────────────────────
export const campi = mysqlTable("campi", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codice: varchar("codice", { length: 50 }),
  ettari: decimal("ettari", { precision: 10, scale: 2 }).notNull(),
  comune: varchar("comune", { length: 100 }),
  provincia: varchar("provincia", { length: 50 }),
  coltura: varchar("coltura", { length: 100 }),
  stato: mysqlEnum("stato", ["attivo", "a_riposo", "in_lavorazione"]).default("attivo").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type Campo = typeof campi.$inferSelect;
export type InsertCampo = typeof campi.$inferInsert;

// ─── LAVORAZIONI ──────────────────────────────────────────────────────────────
export const lavorazioni = mysqlTable("lavorazioni", {
  id: uuidPk(),
  companyId: companyRef(),
  campoId: varchar("campoId", { length: 36 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  descrizione: text("descrizione"),
  data: date("data").notNull(),
  operatore: varchar("operatore", { length: 255 }),
  costo: decimal("costo", { precision: 12, scale: 2 }),
  stato: mysqlEnum("stato", ["pianificata", "in_corso", "completata"]).default("pianificata").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type Lavorazione = typeof lavorazioni.$inferSelect;
export type InsertLavorazione = typeof lavorazioni.$inferInsert;

// ─── FINANZA ──────────────────────────────────────────────────────────────────
export const transazioni = mysqlTable("transazioni", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  descrizione: text("descrizione"),
  importo: decimal("importo", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  contattoId: varchar("contattoId", { length: 36 }),
  note: text("note"),
  ...auditColumns,
});
export type Transazione = typeof transazioni.$inferSelect;
export type InsertTransazione = typeof transazioni.$inferInsert;

export const budget = mysqlTable("budget", {
  id: uuidPk(),
  companyId: companyRef(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  anno: int("anno").notNull(),
  mese: int("mese"),
  importoPrevisto: decimal("importoPrevisto", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  ...auditColumns,
});
export type Budget = typeof budget.$inferSelect;
export type InsertBudget = typeof budget.$inferInsert;

// ─── MAGAZZINO ────────────────────────────────────────────────────────────────
export const prodotti = mysqlTable("prodotti", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codice: varchar("codice", { length: 100 }),
  categoria: varchar("categoria", { length: 100 }),
  unitaMisura: varchar("unitaMisura", { length: 50 }),
  quantita: decimal("quantita", { precision: 12, scale: 3 }).default("0").notNull(),
  quantitaMinima: decimal("quantitaMinima", { precision: 12, scale: 3 }).default("0"),
  prezzoUnitario: decimal("prezzoUnitario", { precision: 12, scale: 2 }),
  fornitoreId: varchar("fornitoreId", { length: 36 }),
  note: text("note"),
  ...auditColumns,
});
export type Prodotto = typeof prodotti.$inferSelect;
export type InsertProdotto = typeof prodotti.$inferInsert;

export const movimentiMagazzino = mysqlTable("movimentiMagazzino", {
  id: uuidPk(),
  companyId: companyRef(),
  prodottoId: varchar("prodottoId", { length: 36 }).notNull(),
  tipo: mysqlEnum("tipo", ["carico", "scarico"]).notNull(),
  quantita: decimal("quantita", { precision: 12, scale: 3 }).notNull(),
  data: date("data").notNull(),
  descrizione: text("descrizione"),
  operatore: varchar("operatore", { length: 255 }),
  ...auditColumns,
});
export type MovimentoMagazzino = typeof movimentiMagazzino.$inferSelect;
export type InsertMovimentoMagazzino = typeof movimentiMagazzino.$inferInsert;

// ─── OFFICINA / FLEET ─────────────────────────────────────────────────────────
export const macchine = mysqlTable("macchine", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  marca: varchar("marca", { length: 100 }),
  modello: varchar("modello", { length: 100 }),
  targa: varchar("targa", { length: 20 }),
  telaio: varchar("telaio", { length: 100 }),
  anno: int("anno"),
  foto: text("foto"),
  oreTotali: decimal("oreTotali", { precision: 10, scale: 1 }).default("0"),
  oreMotore: decimal("oreMotore", { precision: 10, scale: 1 }).default("0"),
  chilometri: decimal("chilometri", { precision: 12, scale: 1 }),
  healthScore: int("healthScore").default(100),
  ultimoTagliando: date("ultimoTagliando"),
  prossimaManutenzione: date("prossimaManutenzione"),
  costoTotale: decimal("costoTotale", { precision: 12, scale: 2 }).default("0"),
  stato: mysqlEnum("stato", ["operativo", "manutenzione", "fermo", "riposo"]).default("operativo").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type Macchina = typeof macchine.$inferSelect;
export type InsertMacchina = typeof macchine.$inferInsert;

export const macchinaDocumenti = mysqlTable("macchinaDocumenti", {
  id: uuidPk(),
  companyId: companyRef(),
  macchinaId: varchar("macchinaId", { length: 36 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipo: varchar("tipo", { length: 50 }),
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 255 }),
  ...auditColumns,
});
export type MacchinaDocumento = typeof macchinaDocumenti.$inferSelect;
export type InsertMacchinaDocumento = typeof macchinaDocumenti.$inferInsert;

export const interventi = mysqlTable("interventi", {
  id: uuidPk(),
  companyId: companyRef(),
  macchinaId: varchar("macchinaId", { length: 36 }).notNull(),
  tipo: mysqlEnum("tipo", ["manutenzione", "riparazione", "revisione", "tagliando", "straordinario"]).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  descrizione: text("descrizione").notNull(),
  data: date("data").notNull(),
  dataPianificata: date("dataPianificata"),
  dataCompletamento: date("dataCompletamento"),
  priorita: mysqlEnum("priorita", ["urgente", "alta", "media", "bassa"]).default("media").notNull(),
  stato: mysqlEnum("stato", ["pianificato", "in_corso", "straordinario", "completato"]).default("pianificato").notNull(),
  operatore: varchar("operatore", { length: 255 }),
  tempoStimato: decimal("tempoStimato", { precision: 6, scale: 1 }),
  oreLavoro: decimal("oreLavoro", { precision: 6, scale: 1 }),
  costoOrario: decimal("costoOrario", { precision: 8, scale: 2 }),
  costoPrevisto: decimal("costoPrevisto", { precision: 10, scale: 2 }),
  costoManodopera: decimal("costoManodopera", { precision: 10, scale: 2 }),
  costoRicambi: decimal("costoRicambi", { precision: 10, scale: 2 }),
  costoFinale: decimal("costoFinale", { precision: 10, scale: 2 }),
  foto: text("foto"),
  note: text("note"),
  ...auditColumns,
});
export type Intervento = typeof interventi.$inferSelect;
export type InsertIntervento = typeof interventi.$inferInsert;

// Magazzino ricambi dedicato all'officina.
export const ricambi = mysqlTable("ricambi", {
  id: uuidPk(),
  companyId: companyRef(),
  codice: varchar("codice", { length: 100 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  compatibilita: text("compatibilita"),
  quantitaDisponibile: decimal("quantitaDisponibile", { precision: 12, scale: 2 }).default("0").notNull(),
  sogliaMinima: decimal("sogliaMinima", { precision: 12, scale: 2 }).default("0").notNull(),
  posizione: varchar("posizione", { length: 100 }),
  costoMedio: decimal("costoMedio", { precision: 10, scale: 2 }).default("0"),
  fornitore: varchar("fornitore", { length: 255 }),
  note: text("note"),
  ...auditColumns,
});
export type Ricambio = typeof ricambi.$inferSelect;
export type InsertRicambio = typeof ricambi.$inferInsert;

// Join intervento <-> ricambio (richiesto vs utilizzato).
export const interventoRicambi = mysqlTable("interventoRicambi", {
  id: uuidPk(),
  companyId: companyRef(),
  interventoId: varchar("interventoId", { length: 36 }).notNull(),
  ricambioId: varchar("ricambioId", { length: 36 }),
  codiceRicambio: varchar("codiceRicambio", { length: 100 }),
  nomeRicambio: varchar("nomeRicambio", { length: 255 }),
  quantitaRichiesta: decimal("quantitaRichiesta", { precision: 12, scale: 2 }).default("0").notNull(),
  quantitaUtilizzata: decimal("quantitaUtilizzata", { precision: 12, scale: 2 }).default("0"),
  costoUnitario: decimal("costoUnitario", { precision: 10, scale: 2 }),
  obbligatorio: boolean("obbligatorio").default(true),
  ...auditColumns,
});
export type InterventoRicambio = typeof interventoRicambi.$inferSelect;
export type InsertInterventoRicambio = typeof interventoRicambi.$inferInsert;

// ─── CALENDARIO ───────────────────────────────────────────────────────────────
export const eventi = mysqlTable("eventi", {
  id: uuidPk(),
  companyId: companyRef(),
  titolo: varchar("titolo", { length: 255 }).notNull(),
  descrizione: text("descrizione"),
  tipo: mysqlEnum("tipo", ["lavorazione", "manutenzione", "scadenza", "altro"]).default("altro").notNull(),
  dataInizio: timestamp("dataInizio").notNull(),
  dataFine: timestamp("dataFine"),
  tuttoIlGiorno: boolean("tuttoIlGiorno").default(false),
  completato: boolean("completato").default(false),
  colore: varchar("colore", { length: 20 }),
  riferimentoId: varchar("riferimentoId", { length: 36 }),
  riferimentoTipo: varchar("riferimentoTipo", { length: 50 }),
  ...auditColumns,
});
export type Evento = typeof eventi.$inferSelect;
export type InsertEvento = typeof eventi.$inferInsert;

// ─── STALLA / LIVESTOCK ─────────────────────────────────────────────────────────
export const animali = mysqlTable("animali", {
  id: uuidPk(),
  companyId: companyRef(),
  matricola: varchar("matricola", { length: 50 }).notNull(),
  nome: varchar("nome", { length: 100 }),
  gruppo: varchar("gruppo", { length: 100 }),
  razza: varchar("razza", { length: 100 }),
  dataNascita: date("dataNascita"),
  sesso: mysqlEnum("sesso", ["femmina", "maschio"]).default("femmina").notNull(),
  stato: mysqlEnum("stato", ["attiva", "asciutta", "gravida", "infermeria", "venduta", "morta"]).default("attiva").notNull(),
  produzioneMedia: decimal("produzioneMedia", { precision: 8, scale: 2 }),
  note: text("note"),
  ...auditColumns,
});
export type Animale = typeof animali.$inferSelect;
export type InsertAnimale = typeof animali.$inferInsert;

export const trattamentiAnimali = mysqlTable("trattamentiAnimali", {
  id: uuidPk(),
  companyId: companyRef(),
  animaleId: varchar("animaleId", { length: 36 }).notNull(),
  tipo: mysqlEnum("tipo", ["sincronizzazione", "vaccino", "farmaco", "visita", "altro"]).default("altro").notNull(),
  farmaco: varchar("farmaco", { length: 255 }),
  dose: varchar("dose", { length: 100 }),
  dataTrattamento: timestamp("dataTrattamento").notNull(),
  prossimoTrattamento: timestamp("prossimoTrattamento"),
  veterinario: varchar("veterinario", { length: 255 }),
  stato: mysqlEnum("stato", ["pianificato", "eseguito", "saltato"]).default("pianificato").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type TrattamentoAnimale = typeof trattamentiAnimali.$inferSelect;
export type InsertTrattamentoAnimale = typeof trattamentiAnimali.$inferInsert;

export const gravidanze = mysqlTable("gravidanze", {
  id: uuidPk(),
  companyId: companyRef(),
  animaleId: varchar("animaleId", { length: 36 }).notNull(),
  dataInseminazione: date("dataInseminazione").notNull(),
  dataPartoPrevisto: date("dataPartoPrevisto"),
  dataPartoEffettivo: date("dataPartoEffettivo"),
  stato: mysqlEnum("stato", ["in_corso", "partorita", "abortita"]).default("in_corso").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type Gravidanza = typeof gravidanze.$inferSelect;
export type InsertGravidanza = typeof gravidanze.$inferInsert;

export const zoppie = mysqlTable("zoppie", {
  id: uuidPk(),
  companyId: companyRef(),
  animaleId: varchar("animaleId", { length: 36 }).notNull(),
  dataRilevazione: date("dataRilevazione").notNull(),
  score: int("score").default(1),
  zampa: varchar("zampa", { length: 50 }),
  diagnosi: text("diagnosi"),
  trattamento: text("trattamento"),
  stato: mysqlEnum("stato", ["aperta", "in_trattamento", "risolta"]).default("aperta").notNull(),
  ...auditColumns,
});
export type Zoppia = typeof zoppie.$inferSelect;
export type InsertZoppia = typeof zoppie.$inferInsert;

// ─── REINTEGRAZIONE / REINVESTMENT ──────────────────────────────────────────────
export const fondiReintegrazione = mysqlTable("fondiReintegrazione", {
  id: uuidPk(),
  companyId: companyRef(),
  macchinaId: varchar("macchinaId", { length: 36 }).notNull(),
  nomeDisplay: varchar("nomeDisplay", { length: 255 }).notNull(),
  valoreAcquisto: decimal("valoreAcquisto", { precision: 14, scale: 2 }).notNull(),
  fondoAttuale: decimal("fondoAttuale", { precision: 14, scale: 2 }).default("0").notNull(),
  tassoInteresse: decimal("tassoInteresse", { precision: 5, scale: 3 }).default("0.030"),
  annoObiettivo: int("annoObiettivo"),
  rataConsigliata: decimal("rataConsigliata", { precision: 12, scale: 2 }),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type FondoReintegrazione = typeof fondiReintegrazione.$inferSelect;
export type InsertFondoReintegrazione = typeof fondiReintegrazione.$inferInsert;

export const rateReintegrazione = mysqlTable("rateReintegrazione", {
  id: uuidPk(),
  companyId: companyRef(),
  fondoId: varchar("fondoId", { length: 36 }).notNull(),
  importo: decimal("importo", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  tipo: mysqlEnum("tipo", ["programmata", "extra"]).default("programmata").notNull(),
  pagata: boolean("pagata").default(false).notNull(),
  note: text("note"),
  ...auditColumns,
});
export type RataReintegrazione = typeof rateReintegrazione.$inferSelect;
export type InsertRataReintegrazione = typeof rateReintegrazione.$inferInsert;

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
export const chatSessions = mysqlTable("chatSessions", {
  id: uuidPk(),
  companyId: companyRef(),
  userId: int("userId").notNull(),
  titolo: varchar("titolo", { length: 255 }),
  ...auditColumns,
});
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

export const chatMessages = mysqlTable("chatMessages", {
  id: uuidPk(),
  companyId: companyRef(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  ruolo: mysqlEnum("ruolo", ["user", "assistant"]).notNull(),
  contenuto: text("contenuto").notNull(),
  reasoning: text("reasoning"),
  ...auditColumns,
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
