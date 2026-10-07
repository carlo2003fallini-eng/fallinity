ALTER TABLE `companies`
  ADD COLUMN `attiva` boolean NOT NULL DEFAULT true;

ALTER TABLE `companyMemberships`
  ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN `updatedBy` varchar(36),
  ADD COLUMN `version` int NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX `company_memberships_user_company_unique`
  ON `companyMemberships` (`userId`, `companyId`);

UPDATE `companyMemberships` AS `membership`
  INNER JOIN `users` AS `user` ON `user`.`id` = `membership`.`userId`
  SET `membership`.`roleCode` = 'company_admin'
  WHERE `user`.`platformRole` = 'company_admin'
    AND `membership`.`deletedAt` IS NULL;

CREATE TABLE `userModulePermissions` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `userId` int NOT NULL,
  `moduleKey` varchar(120) NOT NULL,
  `canView` boolean NOT NULL DEFAULT true,
  `canEdit` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36),
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36),
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_permissions_company_user_module_unique` (`companyId`, `userId`, `moduleKey`)
);

CREATE TABLE `companyInvitations` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `email` varchar(320) NOT NULL,
  `roleCode` enum('platform_owner','super_admin','organization_admin','company_admin','manager','operator','consultant','viewer') NOT NULL DEFAULT 'operator',
  `moduleKeys` json NOT NULL,
  `stato` enum('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
  `acceptedAt` timestamp NULL,
  `acceptedByUuid` varchar(36),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(36),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedBy` varchar(36),
  `deletedAt` timestamp NULL,
  `deletedBy` varchar(36),
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_invitations_company_email_unique` (`companyId`, `email`)
);

CREATE TABLE `superAdminAccessLogs` (
  `id` varchar(36) NOT NULL,
  `companyId` varchar(36) NOT NULL,
  `superAdminUuid` varchar(36) NOT NULL,
  `accessType` varchar(40) NOT NULL DEFAULT 'assistenza',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `super_admin_access_logs_company_created_idx` (`companyId`, `createdAt`)
);
