-- F-006 Menù operatore Officina: classificazione condivisa e audit dei prelievi.
-- Migrazione additiva: nessuna tabella esistente viene rinominata o rimossa.
ALTER TABLE `ricambi`
  ADD COLUMN `reparto` varchar(100) NULL,
  ADD COLUMN `famiglia` varchar(100) NULL,
  ADD COLUMN `sottocategoria` varchar(100) NULL,
  ADD COLUMN `immagineUrl` text NULL;

CREATE TABLE `prelieviOfficina` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `idempotencyKey` varchar(80) NOT NULL,
  `macchinaId` varchar(36) NOT NULL,
  `interventoId` varchar(36) NULL,
  `operatore` varchar(255) NULL,
  `costoTotale` decimal(12,2) NOT NULL DEFAULT 0,
  `righe` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36) NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36) NULL,
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36) NULL,
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prelievi_officina_company_idempotency_unique` (`companyId`, `idempotencyKey`),
  KEY `prelievi_officina_company_idx` (`companyId`),
  KEY `prelievi_officina_macchina_idx` (`macchinaId`),
  KEY `prelievi_officina_intervento_idx` (`interventoId`)
);
