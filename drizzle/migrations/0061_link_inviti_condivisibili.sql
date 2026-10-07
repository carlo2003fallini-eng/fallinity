-- Fase 74: token univoco e non prevedibile per ogni invito aziendale condivisibile.
ALTER TABLE `companyInvitations`
  ADD COLUMN `token` varchar(72) NULL AFTER `companyId`;

UPDATE `companyInvitations`
  SET `token` = REPLACE(UUID(), '-', '')
  WHERE `token` IS NULL;

ALTER TABLE `companyInvitations`
  MODIFY COLUMN `token` varchar(72) NOT NULL;

CREATE UNIQUE INDEX `company_invitations_token_unique`
  ON `companyInvitations` (`token`);
