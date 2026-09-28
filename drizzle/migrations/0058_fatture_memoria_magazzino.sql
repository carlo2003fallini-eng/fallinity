-- Fase 63 — Memoria della scelta Aggiorna Magazzino nelle fatture automatiche
-- Estensione additiva: le regole già salvate mantengono il comportamento prudente "non caricare".
ALTER TABLE `regoleClassificazioneFatture`
  ADD COLUMN `aggiornaMagazzino` boolean NOT NULL DEFAULT false AFTER `destinazione`;
