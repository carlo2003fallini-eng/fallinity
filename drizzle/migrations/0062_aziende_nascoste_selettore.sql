-- Fase 77: preferenze personali e reversibili per nascondere aziende dal selettore.
CREATE TABLE `aziendeNascosteSelettore` (
  `id` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36) NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36) NULL,
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aziende_nascoste_selettore_user_company_unique` (`userId`, `companyId`),
  KEY `aziende_nascoste_selettore_user_idx` (`userId`)
);
