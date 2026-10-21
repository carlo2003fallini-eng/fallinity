# Verifica Fase 89 — Pagina Gruppi Stalla mobile

## Implementazione

- Pagina Gruppi ridisegnata in formato mobile con intestazione compatta, ritorno alla Stalla, ricerca, filtri attivi, legenda e azione Nuovo.
- I gruppi provengono esclusivamente dalla query tRPC esistente: consistenza, tipologia e avvisi non sono dati dimostrativi.
- Card fotografiche a due colonne con stato derivato dalla tipologia, numero reale di animali e indicatore di avviso quando presente.
- Dettaglio, creazione, modifica, archiviazione e spostamento animali restano gli stessi flussi protetti.
- Cache PWA versione `fase-89-pagina-gruppi-stalla`.

## Verifiche

- Mobile `/stalla/gruppi` a 390×844: superata con il gruppo reale disponibile.
- Test mirati: 3 file, 25 test verdi.
- Suite completa: 50 file, 370 test verdi.
- TypeScript: `pnpm check` riuscito.
- Build: `pnpm build` riuscita.
- Service worker: controllo sintassi riuscito.
- Integrità: `git diff --check` riuscito.
