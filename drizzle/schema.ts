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

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── AZIENDA ──────────────────────────────────────────────────────────────────
export const azienda = mysqlTable("azienda", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Azienda = typeof azienda.$inferSelect;

// ─── CONTATTI (dipendenti, fornitori, clienti — entità unificata) ─────────────
export const contatti = mysqlTable("contatti", {
  id: int("id").autoincrement().primaryKey(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Contatto = typeof contatti.$inferSelect;
export type InsertContatto = typeof contatti.$inferInsert;

// ─── CAMPI ────────────────────────────────────────────────────────────────────
export const campi = mysqlTable("campi", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codice: varchar("codice", { length: 50 }),
  ettari: decimal("ettari", { precision: 10, scale: 2 }).notNull(),
  comune: varchar("comune", { length: 100 }),
  provincia: varchar("provincia", { length: 50 }),
  coltura: varchar("coltura", { length: 100 }),
  stato: mysqlEnum("stato", ["attivo", "a_riposo", "in_lavorazione"]).default("attivo").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Campo = typeof campi.$inferSelect;
export type InsertCampo = typeof campi.$inferInsert;

// ─── LAVORAZIONI ──────────────────────────────────────────────────────────────
export const lavorazioni = mysqlTable("lavorazioni", {
  id: int("id").autoincrement().primaryKey(),
  campoId: int("campoId").notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  descrizione: text("descrizione"),
  data: date("data").notNull(),
  operatore: varchar("operatore", { length: 255 }),
  costo: decimal("costo", { precision: 12, scale: 2 }),
  stato: mysqlEnum("stato", ["pianificata", "in_corso", "completata"]).default("pianificata").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Lavorazione = typeof lavorazioni.$inferSelect;
export type InsertLavorazione = typeof lavorazioni.$inferInsert;

// ─── FINANZA ──────────────────────────────────────────────────────────────────
export const transazioni = mysqlTable("transazioni", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["entrata", "uscita"]).notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  descrizione: text("descrizione"),
  importo: decimal("importo", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  contattoId: int("contattoId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Transazione = typeof transazioni.$inferSelect;
export type InsertTransazione = typeof transazioni.$inferInsert;

export const budget = mysqlTable("budget", {
  id: int("id").autoincrement().primaryKey(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  anno: int("anno").notNull(),
  mese: int("mese"),
  importoPrevisto: decimal("importoPrevisto", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Budget = typeof budget.$inferSelect;
export type InsertBudget = typeof budget.$inferInsert;

// ─── MAGAZZINO ────────────────────────────────────────────────────────────────
export const prodotti = mysqlTable("prodotti", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codice: varchar("codice", { length: 100 }),
  categoria: varchar("categoria", { length: 100 }),
  unitaMisura: varchar("unitaMisura", { length: 50 }),
  quantita: decimal("quantita", { precision: 12, scale: 3 }).default("0").notNull(),
  quantitaMinima: decimal("quantitaMinima", { precision: 12, scale: 3 }).default("0"),
  prezzoUnitario: decimal("prezzoUnitario", { precision: 12, scale: 2 }),
  fornitoreId: int("fornitoreId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Prodotto = typeof prodotti.$inferSelect;
export type InsertProdotto = typeof prodotti.$inferInsert;

export const movimentiMagazzino = mysqlTable("movimentiMagazzino", {
  id: int("id").autoincrement().primaryKey(),
  prodottoId: int("prodottoId").notNull(),
  tipo: mysqlEnum("tipo", ["carico", "scarico"]).notNull(),
  quantita: decimal("quantita", { precision: 12, scale: 3 }).notNull(),
  data: date("data").notNull(),
  descrizione: text("descrizione"),
  operatore: varchar("operatore", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MovimentoMagazzino = typeof movimentiMagazzino.$inferSelect;
export type InsertMovimentoMagazzino = typeof movimentiMagazzino.$inferInsert;

// ─── OFFICINA ─────────────────────────────────────────────────────────────────
export const macchine = mysqlTable("macchine", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  marca: varchar("marca", { length: 100 }),
  modello: varchar("modello", { length: 100 }),
  targa: varchar("targa", { length: 20 }),
  telaio: varchar("telaio", { length: 100 }),
  anno: int("anno"),
  oreTotali: decimal("oreTotali", { precision: 10, scale: 1 }).default("0"),
  stato: mysqlEnum("stato", ["operativo", "manutenzione", "fermo"]).default("operativo").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Macchina = typeof macchine.$inferSelect;
export type InsertMacchina = typeof macchine.$inferInsert;

export const interventi = mysqlTable("interventi", {
  id: int("id").autoincrement().primaryKey(),
  macchinaId: int("macchinaId").notNull(),
  tipo: mysqlEnum("tipo", ["manutenzione", "riparazione", "revisione"]).notNull(),
  descrizione: text("descrizione").notNull(),
  data: date("data").notNull(),
  dataCompletamento: date("dataCompletamento"),
  priorita: mysqlEnum("priorita", ["alta", "media", "bassa"]).default("media").notNull(),
  stato: mysqlEnum("stato", ["pianificato", "in_corso", "completato"]).default("pianificato").notNull(),
  costoManodopera: decimal("costoManodopera", { precision: 10, scale: 2 }),
  costoRicambi: decimal("costoRicambi", { precision: 10, scale: 2 }),
  operatore: varchar("operatore", { length: 255 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Intervento = typeof interventi.$inferSelect;
export type InsertIntervento = typeof interventi.$inferInsert;

// ─── CALENDARIO ───────────────────────────────────────────────────────────────
export const eventi = mysqlTable("eventi", {
  id: int("id").autoincrement().primaryKey(),
  titolo: varchar("titolo", { length: 255 }).notNull(),
  descrizione: text("descrizione"),
  tipo: mysqlEnum("tipo", ["lavorazione", "manutenzione", "scadenza", "altro"]).default("altro").notNull(),
  dataInizio: timestamp("dataInizio").notNull(),
  dataFine: timestamp("dataFine"),
  tuttoIlGiorno: boolean("tuttoIlGiorno").default(false),
  completato: boolean("completato").default(false),
  colore: varchar("colore", { length: 20 }),
  riferimentoId: int("riferimentoId"),
  riferimentoTipo: varchar("riferimentoTipo", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Evento = typeof eventi.$inferSelect;
export type InsertEvento = typeof eventi.$inferInsert;

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
export const chatSessions = mysqlTable("chatSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  titolo: varchar("titolo", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  ruolo: mysqlEnum("ruolo", ["user", "assistant"]).notNull(),
  contenuto: text("contenuto").notNull(),
  reasoning: text("reasoning"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
