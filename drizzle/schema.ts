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
  datetime,
  json,
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
  codice: varchar("codice", { length: 50 }),
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
  codice: varchar("codice", { length: 50 }),
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
  tempoEffettivo: decimal("tempoEffettivo", { precision: 6, scale: 1 }),
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
  statoOrdine: varchar("statoOrdine", { length: 20 }).default("nessuno"),
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
export const gruppi = mysqlTable("gruppi", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 100 }).notNull(),
  codice: varchar("codice", { length: 20 }),
  tipologia: mysqlEnum("tipologia", ["lattazione", "asciutta", "rimonta", "infermeria", "vitelli", "manze", "pre_parto", "post_parto", "personalizzato"]).default("personalizzato").notNull(),
  colore: varchar("colore", { length: 20 }).default("#4ade80"),
  descrizione: text("descrizione"),
  capacitaMax: int("capacitaMax"),
  note: text("note"),
  stato: mysqlEnum("stato", ["attivo", "archiviato"]).default("attivo").notNull(),
  // ── Fattori predefiniti ──
  applicaFattoriPredefiniti: boolean("applicaFattoriPredefiniti").default(false).notNull(),
  statoProduttivoPredefinito: varchar("statoProduttivoPredefinito", { length: 30 }),
  modalitaStatoProduttivo: mysqlEnum("modalitaStatoProduttivo", ["automatico", "conferma", "suggerimento", "non_applicare"]).default("non_applicare"),
  statoRiproduttivoPredefinito: varchar("statoRiproduttivoPredefinito", { length: 30 }),
  modalitaStatoRiproduttivo: mysqlEnum("modalitaStatoRiproduttivo", ["automatico", "conferma", "suggerimento", "non_applicare"]).default("non_applicare"),
  categoriaSanitariaPredefinita: varchar("categoriaSanitariaPredefinita", { length: 50 }),
  modalitaCategoriaSanitaria: mysqlEnum("modalitaCategoriaSanitaria", ["automatico", "conferma", "suggerimento", "non_applicare"]).default("non_applicare"),
  percorsoOperativoPredefinito: varchar("percorsoOperativoPredefinito", { length: 50 }),
  ...auditColumns,
});
export type Gruppo = typeof gruppi.$inferSelect;
export type InsertGruppo = typeof gruppi.$inferInsert;

export const animali = mysqlTable("animali", {
  id: uuidPk(),
  companyId: companyRef(),
  matricola: varchar("matricola", { length: 50 }).notNull(),
  numeroAziendale: varchar("numeroAziendale", { length: 50 }),
  nome: varchar("nome", { length: 100 }),
  rfid: varchar("rfid", { length: 100 }),
  gruppo: varchar("gruppo", { length: 100 }),
  gruppoId: varchar("gruppoId", { length: 36 }),
  razza: varchar("razza", { length: 100 }),
  dataNascita: date("dataNascita"),
  sesso: mysqlEnum("sesso", ["femmina", "maschio"]).default("femmina").notNull(),
  stato: mysqlEnum("stato", ["attiva", "asciutta", "gravida", "infermeria", "venduta", "morta"]).default("attiva").notNull(),
  statoProduttivo: mysqlEnum("statoProduttivo", ["in_lattazione", "asciutta", "rimonta", "vitello", "manza", "riformata", "venduta", "deceduta"]).default("in_lattazione"),
  statoRiproduttivo: mysqlEnum("statoRiproduttivo", ["vuota", "inseminata", "gravida", "da_controllare", "persa", "non_idonea"]).default("vuota"),
  foto: varchar("foto", { length: 500 }),
  healthScore: int("healthScore").default(100),
  produzioneMedia: decimal("produzioneMedia", { precision: 8, scale: 2 }),
  produzioneOggi: decimal("produzioneOggi", { precision: 8, scale: 2 }),
  giorniLattazione: int("giorniLattazione").default(0),
  giorniGravidanza: int("giorniGravidanza").default(0),
  dataPartoPrevisto: date("dataPartoPrevisto"),
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
  tipologia: varchar("tipologia", { length: 100 }),
  motivo: varchar("motivo", { length: 255 }),
  farmaco: varchar("farmaco", { length: 255 }),
  prodotto: varchar("prodotto", { length: 255 }),
  dose: varchar("dose", { length: 100 }),
  unitaMisura: varchar("unitaMisura", { length: 50 }),
  viaSomministrazione: varchar("viaSomministrazione", { length: 100 }),
  dataTrattamento: timestamp("dataTrattamento").notNull(),
  dataFine: timestamp("dataFine"),
  tempiSospensione: varchar("tempiSospensione", { length: 100 }),
  prossimoTrattamento: timestamp("prossimoTrattamento"),
  operatore: varchar("operatore", { length: 255 }),
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

export const eventiAnimale = mysqlTable("eventiAnimale", {
  id: uuidPk(),
  companyId: companyRef(),
  animaleId: varchar("animaleId", { length: 36 }).notNull(),
  tipo: mysqlEnum("tipo", ["inseminazione", "diagnosi_gravidanza", "parto", "trattamento", "zoppia", "mastite", "spostamento_gruppo", "asciugatura", "riforma", "vendita", "decesso", "visita", "sincronizzazione", "controllo", "nota", "altro"]).default("altro").notNull(),
  data: timestamp("data").notNull(),
  descrizione: text("descrizione"),
  operatore: varchar("operatore", { length: 255 }),
  note: text("note"),
  // Storico spostamento gruppo
  gruppoPrecedenteId: varchar("gruppoPrecedenteId", { length: 36 }),
  gruppoNuovoId: varchar("gruppoNuovoId", { length: 36 }),
  statoProduttivoPrecedente: varchar("statoProduttivoPrecedente", { length: 30 }),
  statoProduttivoNuovo: varchar("statoProduttivoNuovo", { length: 30 }),
  statoRiproduttivoPrecedente: varchar("statoRiproduttivoPrecedente", { length: 30 }),
  statoRiproduttivoNuovo: varchar("statoRiproduttivoNuovo", { length: 30 }),
  fattoriApplicati: text("fattoriApplicati"), // JSON string
  modalitaApplicazione: varchar("modalitaApplicazione", { length: 30 }),
  motivo: varchar("motivo", { length: 255 }),
  operazioneMultiplaId: varchar("operazioneMultiplaId", { length: 36 }),
  ...auditColumns,
});
export type EventoAnimale = typeof eventiAnimale.$inferSelect;
export type InsertEventoAnimale = typeof eventiAnimale.$inferInsert;

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

// ─── SCENARIO FUTURO (simulazione what-if) ──────────────────────────────────
export const scenari = mysqlTable("scenari", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descrizione: text("descrizione"),
  stato: mysqlEnum("stato", ["bozza", "calcolato", "archiviato"]).default("bozza").notNull(),
  modello: mysqlEnum("modello", ["personalizzato", "espansione", "riduzione_costi", "nuovo_investimento", "cambio_produzione"]).default("personalizzato").notNull(),
  risultatoJson: text("risultatoJson"),
  calcolatoIl: timestamp("calcolatoIl"),
  ...auditColumns,
});
export type Scenario = typeof scenari.$inferSelect;
export type InsertScenario = typeof scenari.$inferInsert;

export const ipotesiScenario = mysqlTable("ipotesiScenario", {
  id: uuidPk(),
  companyId: companyRef(),
  scenarioId: varchar("scenarioId", { length: 36 }).notNull(),
  variabile: mysqlEnum("variabile", [
    "investimento_iniziale",
    "costo_manodopera",
    "costo_mangimi",
    "costo_energia",
    "costo_manutenzione",
    "prezzo_latte",
    "prezzo_carne",
    "produzione_latte_giorno",
    "numero_capi",
    "ettari_coltivati",
    "resa_ettaro",
    "prezzo_vendita_colture",
  ]).notNull(),
  valoreAttuale: decimal("valoreAttuale", { precision: 14, scale: 2 }).notNull(),
  valoreIpotesi: decimal("valoreIpotesi", { precision: 14, scale: 2 }).notNull(),
  unita: varchar("unita", { length: 50 }).default("€").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type IpotesiScenario = typeof ipotesiScenario.$inferSelect;
export type InsertIpotesiScenario = typeof ipotesiScenario.$inferInsert;

// ══════════════════════════════════════════════════════════════════════════════
// FINANZA — FONDAMENTA (Sprint Finanza Fase 1)
// ══════════════════════════════════════════════════════════════════════════════

export const categorieFinanziarie = mysqlTable("categorieFinanziarie", {
  id: uuidPk(),
  companyId: companyRef(),
  codice: varchar("codice", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: mysqlEnum("tipo", ["entrata", "uscita", "entrambi"]).notNull(),
  colore: varchar("colore", { length: 20 }).default("#4ade80"),
  icona: varchar("icona", { length: 50 }),
  attivo: boolean("attivo").default(true).notNull(),
  ordine: int("ordine").default(0).notNull(),
  parentId: varchar("parentId", { length: 36 }),
  ...auditColumns,
});
export type CategoriaFinanziaria = typeof categorieFinanziarie.$inferSelect;

export const centriDiCosto = mysqlTable("centriDiCosto", {
  id: uuidPk(),
  companyId: companyRef(),
  codice: varchar("codice", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descrizione: text("descrizione"),
  colore: varchar("colore", { length: 20 }).default("#60a5fa"),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type CentroDiCosto = typeof centriDiCosto.$inferSelect;

export const soggetti = mysqlTable("soggetti", {
  id: uuidPk(),
  companyId: companyRef(),
  tipologia: mysqlEnum("tipologia", ["cliente", "fornitore", "entrambi"]).notNull(),
  ragioneSociale: varchar("ragioneSociale", { length: 200 }).notNull(),
  nomeBreve: varchar("nomeBreve", { length: 100 }),
  partitaIva: varchar("partitaIva", { length: 20 }),
  codiceFiscale: varchar("codiceFiscale", { length: 20 }),
  email: varchar("email", { length: 200 }),
  telefono: varchar("telefono", { length: 30 }),
  indirizzo: text("indirizzo"),
  iban: varchar("iban", { length: 34 }),
  note: text("note"),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type Soggetto = typeof soggetti.$inferSelect;

export const contiFin = mysqlTable("contiFin", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: mysqlEnum("tipo", ["bancario", "cassa", "carta", "deposito", "altro"]).notNull(),
  banca: varchar("banca", { length: 100 }),
  ibanMascherato: varchar("ibanMascherato", { length: 34 }),
  saldoIniziale: int("saldoIniziale").default(0).notNull(), // centesimi
  saldoAttuale: int("saldoAttuale").default(0).notNull(), // centesimi
  valuta: varchar("valuta", { length: 3 }).default("EUR").notNull(),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type ContoFin = typeof contiFin.$inferSelect;

export const metodiPagamento = mysqlTable("metodiPagamento", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 100 }).notNull(),
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type MetodoPagamento = typeof metodiPagamento.$inferSelect;

export const documentiFinanziari = mysqlTable("documentiFinanziari", {
  id: uuidPk(),
  companyId: companyRef(),
  codiceInterno: varchar("codiceInterno", { length: 20 }), // DOC-ENT-000001 / DOC-USC-000001
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  tipoRegistrazione: mysqlEnum("tipoRegistrazione", ["pagato_subito", "documento", "ricorrente", "trasferimento", "investimento"]).notNull(),
  tipoDocumento: varchar("tipoDocumento", { length: 50 }), // fattura_acquisto, fattura_vendita, ricevuta, nota_credito_ricevuta, nota_credito_emessa, parcella, contratto, avviso_pagamento, generico, altro
  numero: varchar("numero", { length: 50 }),
  dataDocumento: date("dataDocumento").notNull(),
  soggettoId: varchar("soggettoId", { length: 36 }),
  categoriaId: varchar("categoriaId", { length: 36 }).notNull(),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  imponibile: int("imponibile").notNull(), // centesimi
  aliquotaIva: int("aliquotaIva").default(2200).notNull(), // centesimi (2200 = 22%)
  importoIva: int("importoIva").notNull(), // centesimi
  totale: int("totale").notNull(), // centesimi
  totalePagato: int("totalePagato").default(0).notNull(), // centesimi — somma pagamenti confermati
  residuo: int("residuo").notNull(), // centesimi — totale - totalePagato
  valuta: varchar("valuta", { length: 3 }).default("EUR").notNull(),
  dataCompetenza: date("dataCompetenza"),
  descrizione: text("descrizione"),
  note: text("note"),
  stato: mysqlEnum("stato", ["bozza", "registrato", "parzialmente_regolato", "pagato", "incassato", "scaduto", "annullato"]).default("registrato").notNull(),
  riferimentoEsterno: varchar("riferimentoEsterno", { length: 100 }),
  // Collegamenti
  originModule: varchar("originModule", { length: 50 }),
  originEntityType: varchar("originEntityType", { length: 50 }),
  originEntityId: varchar("originEntityId", { length: 36 }),
  originReference: varchar("originReference", { length: 100 }),
  generatedAutomatically: boolean("generatedAutomatically").default(false).notNull(),
  ricorrenzaId: varchar("ricorrenzaId", { length: 36 }),
  // Metodo e conto (per pagato_subito)
  contoId: varchar("contoId", { length: 36 }),
  metodoId: varchar("metodoId", { length: 36 }),
  ...auditColumns,
});
export type DocumentoFinanziario = typeof documentiFinanziari.$inferSelect;

export const scadenzeFinanziarie = mysqlTable("scadenzeFinanziarie", {
  id: uuidPk(),
  companyId: companyRef(),
  documentoId: varchar("documentoId", { length: 36 }).notNull(),
  importo: int("importo").notNull(), // centesimi
  importoPagato: int("importoPagato").default(0).notNull(), // centesimi
  residuo: int("residuo").notNull(), // centesimi — importo - importoPagato
  dataScadenza: date("dataScadenza").notNull(),
  numero: int("numero").default(1).notNull(), // rata N di M
  totaleRate: int("totaleRate").default(1).notNull(), // M
  note: text("note"),
  stato: mysqlEnum("stato", ["aperta", "parzialmente_pagata", "pagata", "incassata", "scaduta", "annullata"]).default("aperta").notNull(),
  ...auditColumns,
});
export type ScadenzaFinanziaria = typeof scadenzeFinanziarie.$inferSelect;

export const pagamentiIncassi = mysqlTable("pagamentiIncassi", {
  id: uuidPk(),
  companyId: companyRef(),
  documentoId: varchar("documentoId", { length: 36 }).notNull(),
  scadenzaId: varchar("scadenzaId", { length: 36 }),
  contoId: varchar("contoId", { length: 36 }).notNull(),
  metodoId: varchar("metodoId", { length: 36 }),
  importo: int("importo").notNull(), // centesimi
  data: date("data").notNull(),
  riferimento: varchar("riferimento", { length: 100 }), // CRO, numero assegno, ecc.
  ricevutaUrl: text("ricevutaUrl"),
  note: text("note"),
  stato: mysqlEnum("stato", ["confermato", "annullato", "rettificato"]).default("confermato").notNull(),
  ...auditColumns,
});
export type PagamentoIncasso = typeof pagamentiIncassi.$inferSelect;

export const movimentiCassa = mysqlTable("movimentiCassa", {
  id: uuidPk(),
  companyId: companyRef(),
  contoId: varchar("contoId", { length: 36 }).notNull(),
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  importo: int("importo").notNull(), // centesimi
  data: date("data").notNull(),
  saldoPrecedente: int("saldoPrecedente").notNull(), // centesimi
  saldoDopo: int("saldoDopo").notNull(), // centesimi
  descrizione: text("descrizione"),
  documentoId: varchar("documentoId", { length: 36 }),
  pagamentoId: varchar("pagamentoId", { length: 36 }),
  stato: mysqlEnum("stato", ["confermato", "annullato", "rettificato"]).default("confermato").notNull(),
  ...auditColumns,
});
export type MovimentoCassa = typeof movimentiCassa.$inferSelect;

export const registrazioniEconomiche = mysqlTable("registrazioniEconomiche", {
  id: uuidPk(),
  companyId: companyRef(),
  documentoId: varchar("documentoId", { length: 36 }).notNull(),
  categoriaId: varchar("categoriaId", { length: 36 }),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  tipo: mysqlEnum("tipo", ["costo", "ricavo"]).notNull(),
  importo: int("importo").notNull(), // centesimi
  dataCompetenza: date("dataCompetenza").notNull(),
  descrizione: text("descrizione"),
  ...auditColumns,
});
export type RegistrazioneEconomica = typeof registrazioniEconomiche.$inferSelect;

export const allegatiFinanziari = mysqlTable("allegatiFinanziari", {
  id: uuidPk(),
  companyId: companyRef(),
  documentoId: varchar("documentoId", { length: 36 }).notNull(),
  nomeFile: varchar("nomeFile", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  dimensione: int("dimensione").notNull(), // bytes
  url: text("url").notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  ...auditColumns,
});
export type AllegatoFinanziario = typeof allegatiFinanziari.$inferSelect;

// ── Ricorrenze finanziarie ──
export const ricorrenzeFinanziarie = mysqlTable("ricorrenzeFinanziarie", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 100 }).notNull(),
  // Documento modello (template)
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  tipoDocumento: varchar("tipoDocumento", { length: 50 }),
  soggettoId: varchar("soggettoId", { length: 36 }),
  categoriaId: varchar("categoriaId", { length: 36 }).notNull(),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  imponibile: int("imponibile").notNull(),
  aliquotaIva: int("aliquotaIva").default(2200).notNull(),
  importoIva: int("importoIva").notNull(),
  totale: int("totale").notNull(),
  descrizione: text("descrizione"),
  // Configurazione ricorrenza
  frequenza: mysqlEnum("frequenza", ["mensile", "bimestrale", "trimestrale", "semestrale", "annuale"]).notNull(),
  giorno: int("giorno").default(1).notNull(), // giorno del mese
  prossimaEmissione: date("prossimaEmissione").notNull(),
  ultimaEmissione: date("ultimaEmissione"),
  dataFine: date("dataFine"), // null = infinita
  attiva: boolean("attiva").default(true).notNull(),
  creaScadenza: boolean("creaScadenza").default(true).notNull(),
  creaPagamento: boolean("creaPagamento").default(false).notNull(), // se true, segna come pagato subito
  contoId: varchar("contoId", { length: 36 }),
  metodoId: varchar("metodoId", { length: 36 }),
  ...auditColumns,
});
export type RicorrenzaFinanziaria = typeof ricorrenzeFinanziarie.$inferSelect;

// ── Alert finanziari ──
export const alertFinanziari = mysqlTable("alertFinanziari", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: varchar("tipo", { length: 50 }).notNull(), // saldo_negativo, scadenza_scaduta, pagamento_importante, incasso_ritardo, aumento_uscite, cdc_sopra_media, conto_sotto_soglia, doc_senza_scadenza, mov_senza_categoria, mov_senza_cdc
  severita: mysqlEnum("severita", ["info", "attenzione", "alta", "critica"]).notNull(),
  titolo: varchar("titolo", { length: 200 }).notNull(),
  descrizione: text("descrizione"),
  valore: int("valore"), // centesimi o null
  entitaId: varchar("entitaId", { length: 36 }),
  entitaTipo: varchar("entitaTipo", { length: 50 }), // documento, scadenza, conto, movimento
  letto: boolean("letto").default(false).notNull(),
  risolto: boolean("risolto").default(false).notNull(),
  dataCreazione: date("dataCreazione").notNull(),
  ...auditColumns,
});
export type AlertFinanziario = typeof alertFinanziari.$inferSelect;

export const soglieAlert = mysqlTable("soglieAlert", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: varchar("tipo", { length: 50 }).notNull(), // saldo_minimo, importo_rilevante, giorni_preavviso, percentuale_aumento, importo_minimo_credito_scaduto
  valore: int("valore").notNull(), // centesimi o giorni o percentuale*100
  attivo: boolean("attivo").default(true).notNull(),
  ...auditColumns,
});
export type SogliaAlert = typeof soglieAlert.$inferSelect;


// ═══════════════════════════════════════════════════════════════════════════════
// FASE 4 — INTEGRAZIONI FINANZIARIE
// ═══════════════════════════════════════════════════════════════════════════════

export const proposteFinanziarie = mysqlTable("proposteFinanziarie", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: varchar("tipo", { length: 10 }).notNull(), // entrata | uscita
  importo: decimal("importo", { precision: 12, scale: 2 }).notNull(),
  imponibile: decimal("imponibile", { precision: 12, scale: 2 }),
  iva: decimal("iva", { precision: 12, scale: 2 }),
  descrizione: text("descrizione").notNull(),
  dataOrigine: date("dataOrigine").notNull(),
  categoriaId: varchar("categoriaId", { length: 36 }),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  soggettoId: varchar("soggettoId", { length: 36 }),
  originModule: varchar("originModule", { length: 30 }).notNull(), // fleet, inventory, livestock, crop, machinery
  originEntityType: varchar("originEntityType", { length: 40 }).notNull(), // intervento, ordine, trattamento, ...
  originEntityId: varchar("originEntityId", { length: 36 }).notNull(),
  originEventType: varchar("originEventType", { length: 40 }).notNull(), // completamento, acquisto, vendita, ...
  originReference: varchar("originReference", { length: 100 }), // codice leggibile (INT-001, ORD-005)
  stato: varchar("stato", { length: 20 }).notNull().default("da_esaminare"), // da_esaminare, approvata, convertita, collegata, ignorata, annullata, errore
  documentoFinanziarioId: varchar("documentoFinanziarioId", { length: 36 }),
  movimentoId: varchar("movimentoId", { length: 36 }),
  motivoIgnorato: text("motivoIgnorato"),
  errore: text("errore"),
  reviewedAt: datetime("reviewedAt"),
  reviewedBy: varchar("reviewedBy", { length: 36 }),
  ...auditColumns,
});
export type PropostaFinanziaria = typeof proposteFinanziarie.$inferSelect;

export const integrationSettings = mysqlTable("integrationSettings", {
  id: uuidPk(),
  companyId: companyRef(),
  modulo: varchar("modulo", { length: 30 }).notNull(), // fleet, inventory, livestock, crop, machinery
  automazione: varchar("automazione", { length: 20 }).notNull().default("proposta_auto"), // proposta_auto, conferma, bozza, nessuna
  categoriaDefaultId: varchar("categoriaDefaultId", { length: 36 }),
  centroCostoDefaultId: varchar("centroCostoDefaultId", { length: 36 }),
  soggettoDefaultId: varchar("soggettoDefaultId", { length: 36 }),
  manodoperaInternaMode: varchar("manodoperaInternaMode", { length: 20 }).default("gestionale"), // gestionale, finanziario, escluso
  ...auditColumns,
});
export type IntegrationSetting = typeof integrationSettings.$inferSelect;

export const domainEvents = mysqlTable("domainEvents", {
  id: uuidPk(),
  companyId: companyRef(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  originModule: varchar("originModule", { length: 30 }).notNull(),
  originEntityType: varchar("originEntityType", { length: 40 }).notNull(),
  originEntityId: varchar("originEntityId", { length: 36 }).notNull(),
  payload: json("payload"),
  stato: varchar("stato", { length: 20 }).notNull().default("pending"), // pending, processed, failed
  tentativi: int("tentativi").notNull().default(0),
  errore: text("errore"),
  processedAt: datetime("processedAt"),
  ...auditColumns,
});
export type DomainEvent = typeof domainEvents.$inferSelect;


// ══════════════════════════════════════════════════════════════════════════════
// FINANZA — FASE 5: BUDGET, REINTEGRAZIONE AVANZATA, INVESTIMENTI, SCENARI V2,
// REPORT, INSIGHT
// ══════════════════════════════════════════════════════════════════════════════

// ─── BUDGET V2 ────────────────────────────────────────────────────────────────
export const budgets = mysqlTable("budgets", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  periodo: mysqlEnum("periodo", ["annuale", "mensile", "trimestrale", "personalizzato"]).notNull(),
  dataInizio: date("dataInizio").notNull(),
  dataFine: date("dataFine").notNull(),
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  categoriaId: varchar("categoriaId", { length: 36 }),
  sottocategoriaId: varchar("sottocategoriaId", { length: 36 }),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  settore: varchar("settore", { length: 100 }),
  modulo: varchar("modulo", { length: 50 }),
  importoPrevisto: decimal("importoPrevisto", { precision: 14, scale: 2 }).notNull(),
  distribuzione: mysqlEnum("distribuzione", ["uniforme", "manuale", "stagionale", "storica", "personalizzata"]).default("uniforme").notNull(),
  note: text("note"),
  responsabile: varchar("responsabile", { length: 255 }),
  stato: mysqlEnum("stato", ["bozza", "attivo", "completato", "archiviato"]).default("bozza").notNull(),
  ...auditColumns,
});
export type BudgetV2 = typeof budgets.$inferSelect;
export type InsertBudgetV2 = typeof budgets.$inferInsert;

export const budgetDistributions = mysqlTable("budgetDistributions", {
  id: uuidPk(),
  budgetId: varchar("budgetId", { length: 36 }).notNull(),
  mese: int("mese").notNull(), // 1-12
  importo: decimal("importo", { precision: 14, scale: 2 }).notNull(),
  ...auditColumns,
});
export type BudgetDistribution = typeof budgetDistributions.$inferSelect;
export type InsertBudgetDistribution = typeof budgetDistributions.$inferInsert;

// ─── REINTEGRAZIONE V2 ───────────────────────────────────────────────────────
export const replacementPlans = mysqlTable("replacementPlans", {
  id: uuidPk(),
  companyId: companyRef(),
  macchinaId: varchar("macchinaId", { length: 36 }),
  nome: varchar("nome", { length: 255 }).notNull(),
  valoreSostituzione: decimal("valoreSostituzione", { precision: 14, scale: 2 }).notNull(),
  dataSostituzione: date("dataSostituzione"),
  vitaUtile: int("vitaUtile"), // mesi
  valoreResiduo: decimal("valoreResiduo", { precision: 14, scale: 2 }).default("0"),
  capitaleNecessario: decimal("capitaleNecessario", { precision: 14, scale: 2 }).default("0"),
  capitaleAccantonato: decimal("capitaleAccantonato", { precision: 14, scale: 2 }).default("0"),
  accantonamentoMensileConsigliato: decimal("accantonamentoMensileConsigliato", { precision: 12, scale: 2 }),
  accantonamentoMensileEffettivo: decimal("accantonamentoMensileEffettivo", { precision: 12, scale: 2 }),
  rendimento: decimal("rendimento", { precision: 5, scale: 3 }).default("0"),
  interessiMaturati: decimal("interessiMaturati", { precision: 14, scale: 2 }).default("0"),
  percentualeCopertura: decimal("percentualeCopertura", { precision: 5, scale: 2 }).default("0"),
  stato: mysqlEnum("stato", ["attivo", "completato", "sospeso", "annullato"]).default("attivo").notNull(),
  priorita: mysqlEnum("priorita", ["alta", "media", "bassa"]).default("media").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type ReplacementPlan = typeof replacementPlans.$inferSelect;
export type InsertReplacementPlan = typeof replacementPlans.$inferInsert;

export const replacementAccounts = mysqlTable("replacementAccounts", {
  id: uuidPk(),
  companyId: companyRef(),
  contoFinanziarioId: varchar("contoFinanziarioId", { length: 36 }),
  nome: varchar("nome", { length: 255 }).notNull(),
  tassoInteresse: decimal("tassoInteresse", { precision: 5, scale: 3 }).default("0"),
  dataDecorrenza: date("dataDecorrenza"),
  periodicita: mysqlEnum("periodicita", ["mensile", "trimestrale", "semestrale", "annuale"]).default("annuale"),
  interesseLordo: decimal("interesseLordo", { precision: 14, scale: 2 }).default("0"),
  interesseNetto: decimal("interesseNetto", { precision: 14, scale: 2 }),
  capitaleVersato: decimal("capitaleVersato", { precision: 14, scale: 2 }).default("0"),
  capitaleVincolato: decimal("capitaleVincolato", { precision: 14, scale: 2 }).default("0"),
  note: text("note"),
  ...auditColumns,
});
export type ReplacementAccount = typeof replacementAccounts.$inferSelect;
export type InsertReplacementAccount = typeof replacementAccounts.$inferInsert;

export const replacementAllocations = mysqlTable("replacementAllocations", {
  id: uuidPk(),
  replacementAccountId: varchar("replacementAccountId", { length: 36 }).notNull(),
  replacementPlanId: varchar("replacementPlanId", { length: 36 }).notNull(),
  importoAllocato: decimal("importoAllocato", { precision: 14, scale: 2 }).notNull(),
  ...auditColumns,
});
export type ReplacementAllocation = typeof replacementAllocations.$inferSelect;
export type InsertReplacementAllocation = typeof replacementAllocations.$inferInsert;

export const replacementValueHistory = mysqlTable("replacementValueHistory", {
  id: uuidPk(),
  replacementPlanId: varchar("replacementPlanId", { length: 36 }).notNull(),
  valorePrecedente: decimal("valorePrecedente", { precision: 14, scale: 2 }).notNull(),
  nuovoValore: decimal("nuovoValore", { precision: 14, scale: 2 }).notNull(),
  data: timestamp("data").defaultNow().notNull(),
  operatore: varchar("operatore", { length: 255 }),
  motivazione: text("motivazione"),
});
export type ReplacementValueHistory = typeof replacementValueHistory.$inferSelect;
export type InsertReplacementValueHistory = typeof replacementValueHistory.$inferInsert;

export const replacementTransactions = mysqlTable("replacementTransactions", {
  id: uuidPk(),
  companyId: companyRef(),
  replacementAccountId: varchar("replacementAccountId", { length: 36 }).notNull(),
  replacementPlanId: varchar("replacementPlanId", { length: 36 }),
  tipo: mysqlEnum("tipo", ["accantonamento_gestionale", "trasferimento_reale", "prelievo", "interesse", "rettifica"]).notNull(),
  importo: decimal("importo", { precision: 14, scale: 2 }).notNull(),
  data: date("data").notNull(),
  note: text("note"),
  ...auditColumns,
});
export type ReplacementTransaction = typeof replacementTransactions.$inferSelect;
export type InsertReplacementTransaction = typeof replacementTransactions.$inferInsert;

// ─── INVESTIMENTI ─────────────────────────────────────────────────────────────
export const investments = mysqlTable("investments", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  descrizione: text("descrizione"),
  importoStimato: decimal("importoStimato", { precision: 14, scale: 2 }).notNull(),
  dataPrevista: date("dataPrevista"),
  durata: int("durata"), // mesi
  fornitore: varchar("fornitore", { length: 255 }),
  finanziamentoPrevisto: decimal("finanziamentoPrevisto", { precision: 14, scale: 2 }),
  anticipo: decimal("anticipo", { precision: 14, scale: 2 }),
  rate: int("rate"),
  contributi: decimal("contributi", { precision: 14, scale: 2 }),
  valoreResiduo: decimal("valoreResiduo", { precision: 14, scale: 2 }),
  risparmioPrevisto: decimal("risparmioPrevisto", { precision: 14, scale: 2 }),
  ricavoAggiuntivo: decimal("ricavoAggiuntivo", { precision: 14, scale: 2 }),
  costiOperativi: decimal("costiOperativi", { precision: 14, scale: 2 }),
  centroCostoId: varchar("centroCostoId", { length: 36 }),
  stato: mysqlEnum("stato", ["idea", "da_valutare", "approvato", "pianificato", "in_corso", "completato", "annullato"]).default("idea").notNull(),
  priorita: mysqlEnum("priorita", ["alta", "media", "bassa"]).default("media").notNull(),
  ...auditColumns,
});
export type Investment = typeof investments.$inferSelect;
export type InsertInvestment = typeof investments.$inferInsert;

// ─── SCENARI V2 ──────────────────────────────────────────────────────────────
export const scenariV2 = mysqlTable("scenariV2", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipo: mysqlEnum("tipo", ["prudente", "realistico", "ottimistico", "personalizzato"]).notNull(),
  variabili: json("variabili"), // JSON con tutte le variabili dello scenario
  risultati: json("risultati"), // JSON con i risultati calcolati
  note: text("note"),
  stato: mysqlEnum("stato", ["bozza", "calcolato", "archiviato"]).default("bozza").notNull(),
  calcolatoIl: timestamp("calcolatoIl"),
  ...auditColumns,
});
export type ScenarioV2 = typeof scenariV2.$inferSelect;
export type InsertScenarioV2 = typeof scenariV2.$inferInsert;

// ─── REPORT ──────────────────────────────────────────────────────────────────
export const reportConfigs = mysqlTable("reportConfigs", {
  id: uuidPk(),
  companyId: companyRef(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  filtri: json("filtri"),
  periodicita: mysqlEnum("periodicita", ["manuale", "settimanale", "mensile", "trimestrale", "annuale"]).default("manuale").notNull(),
  ultimaGenerazione: timestamp("ultimaGenerazione"),
  stato: mysqlEnum("stato", ["attivo", "disattivato"]).default("attivo").notNull(),
  ...auditColumns,
});
export type ReportConfig = typeof reportConfigs.$inferSelect;
export type InsertReportConfig = typeof reportConfigs.$inferInsert;

export const reportHistory = mysqlTable("reportHistory", {
  id: uuidPk(),
  reportConfigId: varchar("reportConfigId", { length: 36 }),
  companyId: companyRef(),
  dataGenerazione: timestamp("dataGenerazione").defaultNow().notNull(),
  operatore: varchar("operatore", { length: 255 }),
  filtri: json("filtri"),
  risultati: json("risultati"),
  fileUrl: text("fileUrl"),
  ...auditColumns,
});
export type ReportHistoryEntry = typeof reportHistory.$inferSelect;
export type InsertReportHistoryEntry = typeof reportHistory.$inferInsert;

// ─── INSIGHT ─────────────────────────────────────────────────────────────────
export const insights = mysqlTable("insights", {
  id: uuidPk(),
  companyId: companyRef(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  titolo: varchar("titolo", { length: 255 }).notNull(),
  messaggio: text("messaggio").notNull(),
  datiAnalizzati: json("datiAnalizzati"),
  motivazione: text("motivazione"),
  livelloConfidenza: mysqlEnum("livelloConfidenza", ["alto", "medio", "basso"]).default("medio").notNull(),
  linkDettaglio: varchar("linkDettaglio", { length: 500 }),
  dataGenerazione: timestamp("dataGenerazione").defaultNow().notNull(),
  letto: boolean("letto").default(false).notNull(),
  azioneSuggerita: varchar("azioneSuggerita", { length: 255 }),
  ...auditColumns,
});
export type Insight = typeof insights.$inferSelect;
export type InsertInsight = typeof insights.$inferInsert;

// ─── BUDGET ALERT THRESHOLDS ─────────────────────────────────────────────────
export const budgetAlertThresholds = mysqlTable("budgetAlertThresholds", {
  id: uuidPk(),
  companyId: companyRef(),
  sogliaWarning: decimal("sogliaWarning", { precision: 5, scale: 2 }).default("80").notNull(), // %
  sogliaDanger: decimal("sogliaDanger", { precision: 5, scale: 2 }).default("100").notNull(), // %
  notificaAttiva: boolean("notificaAttiva").default(true).notNull(),
  ...auditColumns,
});
export type BudgetAlertThreshold = typeof budgetAlertThresholds.$inferSelect;
export type InsertBudgetAlertThreshold = typeof budgetAlertThresholds.$inferInsert;
