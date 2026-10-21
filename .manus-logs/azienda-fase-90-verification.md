# Verifica Fase 90 — Drag and drop card Azienda

Le quattro aree aziendali hanno ora un feedback visivo permanente per il riordino e un testo di istruzione accessibile. Con mouse, il trascinamento si attiva subito al press; su touch resta una pressione prolungata di 320 ms per non interferire con l’apertura delle aree. L’ordine continua a essere salvato per utente e azienda nel database con fallback locale offline e tentativo di sincronizzazione al ritorno della rete.

La vista mobile a 390×844 è stata controllata: testo guida e maniglie sono leggibili, le card restano cliccabili e non c’è overflow. I test mirati sono verdi (3 file, 24 test). La suite completa, TypeScript, build, sintassi del service worker e `git diff --check` sono stati completati con successo.
