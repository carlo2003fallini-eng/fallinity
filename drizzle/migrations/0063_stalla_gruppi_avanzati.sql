-- Fase 92: gruppi manuali/automatici e appartenenze personalizzate sovrapposte.
-- Migrazione solo additiva: nessun gruppo o animale esistente viene spostato automaticamente.

ALTER TABLE `gruppi`
  ADD COLUMN `tipoGestione` enum('manuale','automatico') NOT NULL DEFAULT 'manuale',
  ADD COLUMN `modalitaMembri` enum('esclusivo','personalizzato') NOT NULL DEFAULT 'esclusivo',
  ADD COLUMN `regolaAutomatica` json NULL;

CREATE TABLE `gruppiAnimali` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `gruppoId` varchar(36) NOT NULL,
  `animaleId` varchar(36) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36) NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36) NULL,
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36) NULL,
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `gruppi_animali_company_gruppo_animale_unique` (`companyId`, `gruppoId`, `animaleId`),
  KEY `gruppi_animali_company_gruppo_active_idx` (`companyId`, `gruppoId`, `deletedAt`),
  KEY `gruppi_animali_company_animale_active_idx` (`companyId`, `animaleId`, `deletedAt`)
);

CREATE INDEX `animali_company_gruppo_active_idx`
  ON `animali` (`companyId`, `gruppoId`, `deletedAt`);
