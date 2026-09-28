# Verifica Finanza — Fase 65

- Mobile 390×844: la prima schermata di **Analisi finanziaria** contiene periodo, direzione, risultato e Lettura rapida prima dei grafici; i grafici e le tipologie restano invariati.
- Filtri: spostati in un pannello mobile con ricerca, selezione singola e conferma esplicita; gerarchia mantenuta per categorie dei centri, centri di costo e sottocategorie.
- Confronto: quando il periodo precedente non ha movimenti, KPI e tabella non mostrano delta o valori fuorvianti e spiegano il motivo.
- Dashboard Finanza: modalità `competenza` rinominata in **Contabile** con spiegazione contestuale; la logica interna resta invariata.
- Verifiche: 328/328 Vitest verdi, `pnpm check` senza errori, `pnpm build` riuscita, `node --check client/public/sw.js` e `git diff --check` riusciti.
