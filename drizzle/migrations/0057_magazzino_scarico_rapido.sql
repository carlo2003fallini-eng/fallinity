-- Fase 58 — Magazzino: Scarico Rapido Mobile
-- Estensione additiva: nessuna modifica o perdita dei prodotti e movimenti esistenti.
ALTER TABLE `prodotti`
  ADD COLUMN `sottocategoria` varchar(100) NULL AFTER `categoria`,
  ADD COLUMN `ultimoScaricoQuantita` decimal(12,3) NULL AFTER `note`,
  ADD COLUMN `ultimoScaricoAt` datetime NULL AFTER `note`;

ALTER TABLE `movimentiMagazzino`
  ADD COLUMN `dataOra` datetime NULL AFTER `data`,
  ADD COLUMN `causale` varchar(120) NULL AFTER `descrizione`,
  ADD COLUMN `note` text NULL AFTER `descrizione`;
