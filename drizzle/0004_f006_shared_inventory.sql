-- F-006: Magazzino è la fonte unica della disponibilità dei ricambi.
ALTER TABLE `prodotti`
  ADD COLUMN `reparto` varchar(100) NULL;

ALTER TABLE `interventoRicambi`
  ADD COLUMN `prodottoId` varchar(36) NULL;

CREATE INDEX `intervento_ricambi_prodotto_idx`
  ON `interventoRicambi` (`companyId`, `prodottoId`);
