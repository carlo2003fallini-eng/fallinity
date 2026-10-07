CREATE TABLE IF NOT EXISTS `preferenzeHomeAzienda` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `userUuid` varchar(36) NOT NULL,
  `ordine` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36),
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36),
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `preferenze_home_azienda_company_user_unique` (`companyId`, `userUuid`)
);
