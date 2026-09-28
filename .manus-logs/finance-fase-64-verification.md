# Verifica Finanza — Fase 64

Dal dettaglio di un movimento originato da fattura XML compare il comando **Visualizza fattura**. La pagina collegata è in sola lettura e mostra documento fiscale, controparte, riepilogo imponibile/IVA/totale, righe articolo e piano di regolazione.

La ricerca della fattura avviene tramite `documentoFinanziarioId`, con vincolo su `companyId` e soft delete. Il file XML e i suoi riferimenti di storage restano protetti e non sono restituiti o visualizzati.

Verifica reale effettuata su `DOC-USC-000182` / fattura `2026-E403-0001461` a 390×844: pulsante visibile nel movimento, dati e 3 righe articolo leggibili nella vista fattura.

Verifiche superate: 321/321 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check` e screenshot mobile 390×844.
