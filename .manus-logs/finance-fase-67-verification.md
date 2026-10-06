# Verifica Finanza — Fase 67

Rimossi dalla griglia principale della dashboard Finanza i collegamenti Cashflow, Budget, Investimenti e Scenari, senza eliminare le rispettive route. La griglia ora mantiene Movimenti, Proposte, Analisi, Report, IVA e Impostazioni in una disposizione più compatta.

Aggiunto il collegamento IVA nella schermata Impostazioni Finanza, con accesso alla route esistente `/finanza/iva`. La configurazione fiscale aziendale resta separata e continua a puntare a `/azienda/fiscale`.

Verifiche riuscite: 331/331 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check` e verifica responsive 390×844.
