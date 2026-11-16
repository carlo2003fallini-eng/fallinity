
## Fase 92 — Gestione Gruppi Avanzata
- [x] Analizzare dominio esistente, schema, UX mobile e vincoli multi-azienda
- [x] Estendere in modo additivo il modello per gruppi manuali/automatici e appartenenze personalizzate sovrapposte
- [x] Rendere atomici, idempotenti e auditabili gli spostamenti nei gruppi esclusivi, con controlli capacità e archiviazione sicura
- [x] Separare dashboard, dettaglio routato e azioni contestuali, preservando la griglia mobile a due colonne
- [x] Implementare il wizard a tre passi per aggiungere animali da origini multiple, inclusi senza gruppo, anteprima fattori e riepilogo
- [x] Aggiungere gruppi automatici configurabili (alta produzione/post-parto), calcolati server-side e non modificabili manualmente
- [x] Creare la demo Stalla isolata, persistita solo nella sessione, senza chiamate di scrittura al database
- [x] Applicare migrazione additiva, scrivere regressioni complete e verificare mobile, test, TypeScript, build e PWA
- [x] Salvare il checkpoint della gestione Gruppi avanzata

## Fase 93 — Registrazione animali M0156–M0163
- [x] Inserire i 7 animali nell’azienda attiva, gruppo Primo, con matricola, nome e data di nascita
- [x] Verificare assenza duplicati e isolamento multi-azienda
- [x] Verificare i 7 animali tramite il servizio reale usato da trpc.stalla.animali.list

## Fase 94 — Menù operatore Officina F-006 reale
- [x] Analizzare e riusare anagrafiche reali di mezzi, ricambi e interventi
- [x] Aggiungere classificazione condivisa nel Magazzino: reparto, famiglia e sottocategoria letti dal Menù operatore
- [x] Implementare query server-side del menù con sole giacenze disponibili e isolamento aziendale
- [x] Implementare carrello operatore e conferma atomica con controllo giacenze, idempotenza stabile per retry/doppio tap e storico
- [x] Collegare ogni prelievo a mezzo, intervento, prodotto Magazzino, operatore e costo senza creare doppie spese Finanza
- [x] Integrare il Menù operatore nella sezione Officina esistente, con UX touch mobile e stile Fallinity
- [x] Scrivere test catalogo e integrazione per scarico, rollback, storico, isolamento e doppio submit; verificare test completi, TypeScript, build e resa mobile

## Fase 95 — Scanner barcode/QR Menù operatore
- [x] Integrare la fotocamera del dispositivo con rilevamento barcode e QR nativo
- [x] Aggiungere ricerca manuale fallback e messaggi per permessi/fotocamera non disponibili
- [x] Collegare il codice rilevato alla selezione del ricambio reale del Magazzino senza modificare dati
- [x] Scrivere test di normalizzazione/matching e verificare test completi, TypeScript, build e resa mobile

## Fase 96 — Revisione grafica e organizzativa Officina
- [x] Hub a quattro card fotografiche 2×2 nello stile Azienda e situazione compatta sotto gli accessi
- [x] Quattro pagine dedicate con Indietro, percorso e Azienda attiva nella barra inferiore
- [x] Operatore compatto con schede basse, mezzo sempre visibile, carrello fisso verde e scanner preservato
- [x] Mezzi a due colonne, foto illustrative dichiarate e dettaglio completo preservato
- [x] Interventi con filtri responsive mezzo/stato/priorità/tipo/periodo e dettaglio materiali prelevati
- [x] Ricambi collegati al Magazzino condiviso per elenco, creazione, aggiornamenti e KPI coerenti
- [x] Controlli server per lettura/scrittura e dati economici riservati; prelievi e completamento senza doppio costo/spesa
- [x] Migrazione solo additiva per metadati ricambi condivisi, nessuna modifica delle giacenze reali
- [x] Test isolati su carrello, giacenze, storico, costi, permessi, filtri; 489/489 test Vitest, TypeScript, build, service worker e diff validi
- [x] Verifica UI a 360/390/430 px: 30 controlli, nessun overflow, scanner/manuale, carrello tra reparti, conferma solo su tenant temporaneo, storico e permessi server 403
- [ ] Salvare checkpoint finale

Verifiche eseguite esclusivamente su tenant temporanei con pulizia finale. Nessun mezzo, intervento, ricambio o movimento reale è stato cancellato o modificato per i test. Il prelievo attribuisce subito il costo al mezzo; il completamento conserva i materiali già usati e aggiunge soltanto nuovi materiali e manodopera. Nessuna nuova spesa Finanza viene generata per i materiali già acquistati. I costi sono rimossi dalle risposte tRPC per gli utenti senza autorizzazione economica.
