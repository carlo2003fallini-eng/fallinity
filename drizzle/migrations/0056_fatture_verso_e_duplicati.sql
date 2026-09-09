ALTER TABLE `acquisizioniFatture`
  ADD COLUMN `tipoMovimento` enum('entrata','uscita') NOT NULL DEFAULT 'uscita' AFTER `tipoDocumento`,
  ADD UNIQUE INDEX `uq_acq_fatture_company_hash_documento` (`companyId`, `hashDocumento`);
