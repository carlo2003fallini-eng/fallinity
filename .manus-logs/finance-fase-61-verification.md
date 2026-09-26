# Verifica Finanza — Fase 61

- Mobile 390×844: l'accesso **Regolarizza storico fatture** è disponibile in Impostazioni Finanza; la pagina mostra lista selezionabile, comando **Seleziona tutte le fatture in scadenza** e ultima scadenza per ciascuna fattura.
- Funzione: ogni pagamento storico usa in modo deterministico l'ultima scadenza aperta del relativo documento; data documento invariata.
- Sicurezza: conto, fatture e scadenze sono bloccati e aggiornati in una sola transazione; una fattura non valida annulla tutta l'operazione.
- Verifiche: 313/313 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js` e `git diff --check` superati.
