# Verifica Finanza — Fase 62

La pagina mobile **Regolarizza storico** presenta il selettore `Uscite da pagare` / `Entrate da incassare`, con selezione totale, ultima scadenza per documento, conto e conferma esplicita.

Per le entrate, la transazione atomica registra un incasso alla data dell'ultima rata aperta, accredita il conto, imposta il documento su `incassato` e chiude le rate come `incassata`. Le uscite mantengono il comportamento precedente e restano compatibili con le chiamate senza verso esplicito.

Verifiche superate: 314/314 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js` e `git diff --check`; screenshot mobile 390×844 acquisito.
