-- Metadati condivisi Officina/Magazzino. Nessun aggiornamento delle giacenze.
ALTER TABLE `prodotti`
  ADD COLUMN `fornitore` varchar(255) NULL,
  ADD COLUMN `posizione` varchar(100) NULL,
  ADD COLUMN `compatibilita` text NULL,
  ADD COLUMN `immagineUrl` text NULL,
  ADD COLUMN `statoOrdine` enum('nessuno','da_ordinare','ordinato') NOT NULL DEFAULT 'nessuno';
