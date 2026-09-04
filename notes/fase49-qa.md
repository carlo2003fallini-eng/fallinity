# Fase 49 — Verifica

## Mobile 390×844

La dashboard Finanza mostra **Manuale** e **Automatico** affiancati nell’header, alla destra del titolo. I due comandi hanno la stessa altezza e la griglia inferiore non contiene duplicati.

La pagina `/finanza/nuovo-automatico` mostra un’unica card di caricamento, drag-and-drop/selettore file, formato e limite leggibili, messaggi semplici e un percorso senza esposizione del contenuto XML. Non risultano overflow orizzontali nel viewport mobile.

## Test mirati

I test su parser FatturaPA, sicurezza XML, classificazione, contratti multi-azienda/transazionali e header sono verdi: **13/13**.

## Verifica finale

La suite completa è verde: **260/260 test** in **27 file**. TypeScript non segnala errori, la build di produzione è riuscita e il service worker supera il controllo sintattico. Lo schema del database è stato verificato dopo la migrazione additiva.
