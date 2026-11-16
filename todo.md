
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
- [x] Salvare checkpoint finale

Verifiche eseguite esclusivamente su tenant temporanei con pulizia finale. Nessun mezzo, intervento, ricambio o movimento reale è stato cancellato o modificato per i test. Il prelievo attribuisce subito il costo al mezzo; il completamento conserva i materiali già usati e aggiunge soltanto nuovi materiali e manodopera. Nessuna nuova spesa Finanza viene generata per i materiali già acquistati. I costi sono rimossi dalle risposte tRPC per gli utenti senza autorizzazione economica.

## Fase 97 — Foto mezzi dal dispositivo
- [x] Caricamento da galleria/fotocamera con anteprima locale, ottimizzazione e salvataggio esplicito
- [x] Upload tRPC protetto con controllo formato/dimensione, decodifica reale, rimozione metadati e storage aziendale
- [x] Foto direttamente nel dettaglio e nell’elenco; ingrandimento, sostituzione/rimozione confermate e fallback immagini esistenti
- [x] Conservazione dei dati tecnici, audit e permessi; nessuna foto utente nella cache PWA
- [x] 90 regressioni server sulle foto; verifica UI mobile con upload storage reale, preview senza salvataggio, zoom, rimozione confermata, nuovo mezzo, reload e viewer 403 su tenant temporaneo poi eliminato
- [x] Suite completa 579/579 Vitest, TypeScript, build e service worker validi; nessuna migrazione necessaria, foto nel campo esistente con soli riferimenti storage
- [x] Salvare checkpoint finale foto mezzi

Foto principale caricabile da galleria o fotocamera nel dettaglio e nei moduli di creazione/modifica. JPG/PNG/WebP fino a 20 MB sul dispositivo, ottimizzati localmente e nuovamente sul server a JPEG massimo 1600 px; EXIF/GPS/ICC rimossi. Solo la conferma associa la foto al mezzo. I riferimenti storage sono isolati per azienda, le operazioni sono protette dai permessi Officina e la cache PWA non conserva le foto utente. Le prove UI hanno verificato 12 scenari/layout a 360/390/430 px senza modificare mezzi reali. La fotocamera fisica del telefono non è disponibile nel browser di test; il comando capture è presente e il caricamento file/storage è stato verificato realmente.

## Fase 98 — Importa da fattura: demo integrata e motore condiviso
Questa fase realizza la demo funzionante richiesta al punto 21 prima dell’attivazione sui dati reali. Riutilizza il parser XML FatturaPA e i contratti dell’anagrafica Magazzino; nessun endpoint di scrittura per carichi reali viene attivato. La connessione SdI autorizzata, il carico automatico in produzione e il metodo definitivo di valorizzazione restano fasi future esplicite del documento.
- [x] Analizzare parser, registrazione fatture, inventario, Officina, audit e permessi esistenti
- [x] Motore condiviso: identità fornitore/codici multipli, riconoscimento prudente, classificazioni e conversioni confermate
- [x] Lettura strutturata XML con codici aggiuntivi, sconti/maggiorazioni e DDT; IA solo suggerimenti con verifica umana
- [x] Demo mobile Importa da fattura con lettura multipla, revisione, creazione/associazione, esclusioni e riepilogo di conferma
- [x] Inventario iniziale con quantità fisica obbligatoria e rettifica, ricezioni parziali/residue, collegamento DDT/carichi senza doppio carico
- [x] Unica anagrafica demo per importazione e Officina, prelievo Fendt 822 con costo storico, spesa fattura registrata una sola volta e pagamento distinto
- [x] Storico associazioni/conversioni/prezzi/carichi, correzioni alias versionate, stati pendenti/completati e resi fisici espliciti senza cancellare lo storico
- [x] Accesso Magazzino e scheda fattura; demo isolata per sessione/utente/azienda e permessi anche lato server per lettura XML/IA
- [x] 64 regressioni nuove; suite completa 643/643 Vitest, TypeScript, build, PWA e diff validi; 20 verifiche UI a 360/390/430 px senza overflow, errori browser o API operative di scrittura
- [x] Salvare checkpoint finale demo integrata

Nove preset XML FatturaPA ordinari simulati e scaricabili, importazione manuale multipla solo con consenso all’uso di dati simulati. Prova IA reale su cinque righe: gpt-6-luna restituisce identificativi/classificazioni validati; nessuna quantità, spesa o associazione viene applicata dall’IA. Il confronto tra prezzo netto e ultimo acquisto evidenzia le variazioni senza rivalutare materiali già usati o giacenze. Scenari UI verificati: lettura senza carico, conferma esplicita, 10 filtri × 40 € → stock 9 dopo un prelievo, costo mezzo 40 €, spese 400 € invariate, pagamento distinto, duplicato che riapre la revisione senza ricaricare, memoria alias, inventario 20 storici → 7 fisici, ricezione 6+4, tre materiali senza manodopera/trasporto, 2 confezioni × 10 pezzi, DDT precedente collegato senza secondo carico, file multipli, reload e utenti viewer/operatore separati con costi riservati e 403 server. Fixture temporanee e token rimossi dopo la verifica; anagrafica e giacenze operative esistenti non modificate.
