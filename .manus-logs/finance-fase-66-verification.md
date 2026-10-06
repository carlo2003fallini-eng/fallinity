# Verifica Finanza — Fase 66

La lista Movimenti ora include un tab **Scaduti** separato da Tutti, Entrate, Uscite e Scadenze. Il filtro server verifica direttamente la presenza di una scadenza aperta con data precedente a oggi, quindi funziona anche quando lo stato del documento non è stato aggiornato automaticamente. Per ogni movimento scaduto viene mostrata la data di scadenza.

Dal menu azioni di uno scaduto sono disponibili **Segna come pagato** per le uscite e **Segna come incassato** per le entrate. La conferma richiede conto e data, consente il metodo di pagamento e aggiorna documento, scadenza, saldo e movimento di cassa tramite il flusso di pagamento esistente. L’azione **Elimina** mantiene la conferma e lo storno protetto già presente.

Verifiche riuscite: 330/330 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check` e screenshot mobile 390×844.
