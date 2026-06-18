-- ──────────────────────────────────────────────────────────────────────────────
-- FALLINITY FEOS — Alpha 0.2 — Reset pulito (Strada A)
-- Drop completo + ricreazione con UUID PK, multi-azienda, colonne standard, soft-delete.
-- ──────────────────────────────────────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS chatMessages;
DROP TABLE IF EXISTS chatSessions;
DROP TABLE IF EXISTS rateReintegrazione;
DROP TABLE IF EXISTS fondiReintegrazione;
DROP TABLE IF EXISTS zoppie;
DROP TABLE IF EXISTS gravidanze;
DROP TABLE IF EXISTS trattamentiAnimali;
DROP TABLE IF EXISTS animali;
DROP TABLE IF EXISTS eventi;
DROP TABLE IF EXISTS interventi;
DROP TABLE IF EXISTS macchine;
DROP TABLE IF EXISTS movimentiMagazzino;
DROP TABLE IF EXISTS prodotti;
DROP TABLE IF EXISTS budget;
DROP TABLE IF EXISTS transazioni;
DROP TABLE IF EXISTS lavorazioni;
DROP TABLE IF EXISTS campi;
DROP TABLE IF EXISTS contatti;
DROP TABLE IF EXISTS auditLogs;
DROP TABLE IF EXISTS companyMemberships;
DROP TABLE IF EXISTS moduleAccess;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS farms;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS azienda;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── USERS (ricreata pulita con uuid + platformRole) ────────────────────────────
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  openId VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  platformRole ENUM('platform_owner','super_admin','organization_admin','company_admin','manager','operator','consultant','viewer') NOT NULL DEFAULT 'operator',
  avatarUrl TEXT,
  activeCompanyId VARCHAR(36),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  lastSignedIn TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── ORGANIZATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120),
  logoUrl TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── COMPANIES ────────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id VARCHAR(36) PRIMARY KEY,
  organizationId VARCHAR(36),
  name VARCHAR(255) NOT NULL,
  partitaIva VARCHAR(20),
  codiceFiscale VARCHAR(20),
  indirizzo TEXT,
  citta VARCHAR(100),
  provincia VARCHAR(50),
  cap VARCHAR(10),
  telefono VARCHAR(20),
  email VARCHAR(320),
  settore VARCHAR(100),
  ettari DECIMAL(10,2),
  logoUrl TEXT,
  coverUrl TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── FARMS ──────────────────────────────────────────────────────────────────────
CREATE TABLE farms (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  indirizzo TEXT,
  ettari DECIMAL(10,2),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── ROLES ──────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id VARCHAR(36) PRIMARY KEY,
  code ENUM('platform_owner','super_admin','organization_admin','company_admin','manager','operator','consultant','viewer') NOT NULL,
  name VARCHAR(100) NOT NULL,
  livello INT NOT NULL DEFAULT 0,
  descrizione TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── PERMISSIONS ──────────────────────────────────────────────────────────────
CREATE TABLE permissions (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  descrizione VARCHAR(255),
  dominio VARCHAR(60),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── MODULE ACCESS ──────────────────────────────────────────────────────────────
CREATE TABLE moduleAccess (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  roleCode ENUM('platform_owner','super_admin','organization_admin','company_admin','manager','operator','consultant','viewer') NOT NULL,
  modulo VARCHAR(60) NOT NULL,
  canView BOOLEAN NOT NULL DEFAULT TRUE,
  canEdit BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── COMPANY MEMBERSHIPS ──────────────────────────────────────────────────────
CREATE TABLE companyMemberships (
  id VARCHAR(36) PRIMARY KEY,
  userId INT NOT NULL,
  companyId VARCHAR(36) NOT NULL,
  roleCode ENUM('platform_owner','super_admin','organization_admin','company_admin','manager','operator','consultant','viewer') NOT NULL DEFAULT 'operator',
  attiva BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36)
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────────
CREATE TABLE auditLogs (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36),
  userId INT,
  azione VARCHAR(120) NOT NULL,
  entita VARCHAR(80),
  entitaId VARCHAR(36),
  dettagli TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── CONTATTI ────────────────────────────────────────────────────────────────────
CREATE TABLE contatti (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  tipo ENUM('dipendente','fornitore','cliente') NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cognome VARCHAR(255),
  aziendaNome VARCHAR(255),
  email VARCHAR(320),
  telefono VARCHAR(20),
  indirizzo TEXT,
  citta VARCHAR(100),
  ruolo VARCHAR(100),
  note TEXT,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── CAMPI ────────────────────────────────────────────────────────────────────────
CREATE TABLE campi (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  codice VARCHAR(50),
  ettari DECIMAL(10,2) NOT NULL,
  comune VARCHAR(100),
  provincia VARCHAR(50),
  coltura VARCHAR(100),
  stato ENUM('attivo','a_riposo','in_lavorazione') NOT NULL DEFAULT 'attivo',
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── LAVORAZIONI ──────────────────────────────────────────────────────────────────
CREATE TABLE lavorazioni (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  campoId VARCHAR(36) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  descrizione TEXT,
  data DATE NOT NULL,
  operatore VARCHAR(255),
  costo DECIMAL(12,2),
  stato ENUM('pianificata','in_corso','completata') NOT NULL DEFAULT 'pianificata',
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── TRANSAZIONI ──────────────────────────────────────────────────────────────────
CREATE TABLE transazioni (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  tipo ENUM('entrata','uscita') NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  descrizione TEXT,
  importo DECIMAL(12,2) NOT NULL,
  data DATE NOT NULL,
  contattoId VARCHAR(36),
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── BUDGET ─────────────────────────────────────────────────────────────────────
CREATE TABLE budget (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  anno INT NOT NULL,
  mese INT,
  importoPrevisto DECIMAL(12,2) NOT NULL,
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── PRODOTTI ─────────────────────────────────────────────────────────────────────
CREATE TABLE prodotti (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  codice VARCHAR(100),
  categoria VARCHAR(100),
  unitaMisura VARCHAR(50),
  quantita DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantitaMinima DECIMAL(12,3) DEFAULT 0,
  prezzoUnitario DECIMAL(12,2),
  fornitoreId VARCHAR(36),
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── MOVIMENTI MAGAZZINO ──────────────────────────────────────────────────────
CREATE TABLE movimentiMagazzino (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  prodottoId VARCHAR(36) NOT NULL,
  tipo ENUM('carico','scarico') NOT NULL,
  quantita DECIMAL(12,3) NOT NULL,
  data DATE NOT NULL,
  descrizione TEXT,
  operatore VARCHAR(255),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── MACCHINE ─────────────────────────────────────────────────────────────────────
CREATE TABLE macchine (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  marca VARCHAR(100),
  modello VARCHAR(100),
  targa VARCHAR(20),
  telaio VARCHAR(100),
  anno INT,
  oreTotali DECIMAL(10,1) DEFAULT 0,
  stato ENUM('operativo','manutenzione','fermo') NOT NULL DEFAULT 'operativo',
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── INTERVENTI ───────────────────────────────────────────────────────────────────
CREATE TABLE interventi (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  macchinaId VARCHAR(36) NOT NULL,
  tipo ENUM('manutenzione','riparazione','revisione') NOT NULL,
  descrizione TEXT NOT NULL,
  data DATE NOT NULL,
  dataCompletamento DATE,
  priorita ENUM('alta','media','bassa') NOT NULL DEFAULT 'media',
  stato ENUM('pianificato','in_corso','completato') NOT NULL DEFAULT 'pianificato',
  costoManodopera DECIMAL(10,2),
  costoRicambi DECIMAL(10,2),
  operatore VARCHAR(255),
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── EVENTI ─────────────────────────────────────────────────────────────────────
CREATE TABLE eventi (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  titolo VARCHAR(255) NOT NULL,
  descrizione TEXT,
  tipo ENUM('lavorazione','manutenzione','scadenza','altro') NOT NULL DEFAULT 'altro',
  dataInizio TIMESTAMP NOT NULL,
  dataFine TIMESTAMP NULL,
  tuttoIlGiorno BOOLEAN DEFAULT FALSE,
  completato BOOLEAN DEFAULT FALSE,
  colore VARCHAR(20),
  riferimentoId VARCHAR(36),
  riferimentoTipo VARCHAR(50),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── ANIMALI ──────────────────────────────────────────────────────────────────────
CREATE TABLE animali (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  matricola VARCHAR(50) NOT NULL,
  nome VARCHAR(100),
  gruppo VARCHAR(100),
  razza VARCHAR(100),
  dataNascita DATE,
  sesso ENUM('femmina','maschio') NOT NULL DEFAULT 'femmina',
  stato ENUM('attiva','asciutta','gravida','infermeria','venduta','morta') NOT NULL DEFAULT 'attiva',
  produzioneMedia DECIMAL(8,2),
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── TRATTAMENTI ANIMALI ──────────────────────────────────────────────────────
CREATE TABLE trattamentiAnimali (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  animaleId VARCHAR(36) NOT NULL,
  tipo ENUM('sincronizzazione','vaccino','farmaco','visita','altro') NOT NULL DEFAULT 'altro',
  farmaco VARCHAR(255),
  dose VARCHAR(100),
  dataTrattamento TIMESTAMP NOT NULL,
  prossimoTrattamento TIMESTAMP NULL,
  veterinario VARCHAR(255),
  stato ENUM('pianificato','eseguito','saltato') NOT NULL DEFAULT 'pianificato',
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── GRAVIDANZE ───────────────────────────────────────────────────────────────────
CREATE TABLE gravidanze (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  animaleId VARCHAR(36) NOT NULL,
  dataInseminazione DATE NOT NULL,
  dataPartoPrevisto DATE,
  dataPartoEffettivo DATE,
  stato ENUM('in_corso','partorita','abortita') NOT NULL DEFAULT 'in_corso',
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── ZOPPIE ─────────────────────────────────────────────────────────────────────
CREATE TABLE zoppie (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  animaleId VARCHAR(36) NOT NULL,
  dataRilevazione DATE NOT NULL,
  score INT DEFAULT 1,
  zampa VARCHAR(50),
  diagnosi TEXT,
  trattamento TEXT,
  stato ENUM('aperta','in_trattamento','risolta') NOT NULL DEFAULT 'aperta',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── FONDI REINTEGRAZIONE ──────────────────────────────────────────────────────
CREATE TABLE fondiReintegrazione (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  macchinaId VARCHAR(36) NOT NULL,
  nomeDisplay VARCHAR(255) NOT NULL,
  valoreAcquisto DECIMAL(14,2) NOT NULL,
  fondoAttuale DECIMAL(14,2) NOT NULL DEFAULT 0,
  tassoInteresse DECIMAL(5,3) DEFAULT 0.030,
  annoObiettivo INT,
  rataConsigliata DECIMAL(12,2),
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── RATE REINTEGRAZIONE ──────────────────────────────────────────────────────
CREATE TABLE rateReintegrazione (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36) NOT NULL,
  fondoId VARCHAR(36) NOT NULL,
  importo DECIMAL(12,2) NOT NULL,
  data DATE NOT NULL,
  tipo ENUM('programmata','extra') NOT NULL DEFAULT 'programmata',
  pagata BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy VARCHAR(36),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  updatedBy VARCHAR(36),
  deletedAt TIMESTAMP NULL,
  deletedBy VARCHAR(36),
  version INT NOT NULL DEFAULT 1
);

-- ─── CHAT SESSIONS ──────────────────────────────────────────────────────────────
CREATE TABLE chatSessions (
  id VARCHAR(36) PRIMARY KEY,
  companyId VARCHAR(36),
  userId INT NOT NULL,
  titolo VARCHAR(255),
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- ─── CHAT MESSAGES ──────────────────────────────────────────────────────────────
CREATE TABLE chatMessages (
  id VARCHAR(36) PRIMARY KEY,
  sessionId VARCHAR(36) NOT NULL,
  ruolo ENUM('user','assistant') NOT NULL,
  contenuto TEXT NOT NULL,
  reasoning TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);
