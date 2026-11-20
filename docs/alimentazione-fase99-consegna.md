# Fallinity FEOS — Alimentazione
## Riepilogo di consegna · 20 novembre 2026

La nuova sezione è integrata nell’app esistente, con dati persistenti e operazioni reali. Non è una demo e non contiene prodotti, bovini, razioni o rilevazioni dimostrative nell’azienda operativa. Gli esempi utilizzati nelle verifiche informatiche sono stati creati esclusivamente in aziende temporanee e poi eliminati; non sono raccomandazioni nutrizionali.

## 1. Navigazione e schermate

L’accesso è **Azienda → Alimentazione**, disponibile anche dall’area Stalla. L’hub presenta esattamente quattro schede fotografiche: **Razioni**, **Distribuzione e consumi**, **Alimenti e analisi alimenti**, **Analisi**. Mantiene tema scuro, verde Fallinity, header, modalità Super Admin, pulsante Indietro e navigazione inferiore. Il riepilogo sottostante calcola autonomia, alimento limitante, capi nei gruppi alimentati, frequenze e carri registrati dai dati disponibili; distingue stime, assenza di eventi e valori non calcolabili.

**Razioni.** I gruppi e i capi provengono dalla Stalla reale. Si possono creare, duplicare, modificare per nuova versione, archiviare, attivare o programmare ricette. Gli ingredienti sono prodotti del Magazzino, con ordine di carico e quantità per capo/giorno. I calcoli mostrano quantità giornaliera del gruppo, per esecuzione, sostanza secca e costi dove conosciuti. Una variazione del numero di animali aggiorna il piano attuale, non riscrive i carri precedenti. Le sovrapposizioni tra gruppi sono segnalate.

**Distribuzione e consumi.** Il carico guidato distingue quantità previste ed effettive. Le bozze persistenti non scaricano il Magazzino. Il carico finale, dopo conferma esplicita, controlla le scorte e registra insieme carro e movimenti: una richiesta ripetuta identica non genera un secondo scarico. La distribuzione può essere parziale o diretta a un altro gruppo con autorizzazione esplicita, senza un nuovo scarico. Carri, distribuzioni e avanzi mantengono identificativi, operatore, data, ingredienti, prezzi e analisi utilizzati al momento.

Gli avanzi richiedono misurazione o zero esplicito, sono collegati alla distribuzione precedente e possono essere registrati per peso o tramite contenitori calibrati, incluse frazioni. Le preferenze sono salvate per operatore, gruppo o azienda, ma la quantità del giorno deve essere riconfermata. Le frequenze supportano esecuzioni frazionarie: ad esempio un carro ogni tre giorni. Quando lo storico è sufficientemente stabile, viene mostrata la frequenza osservata, tenendo distinte le distribuzioni parziali dello stesso carro.

**Alimenti e analisi alimenti.** L’anagrafica e le scorte rimangono quelle del Magazzino. Ricerca, ordinamento, dettagli, acquisti e analisi NIR sono collegati agli stessi identificativi. L’autonomia considera le ricette attive, i capi reali e, quando sufficienti, gli scostamenti osservati dei prelievi freschi. I prodotti non utilizzati sono indicati come “Non in uso”; quantità o unità mancanti non vengono inventate.

Le analisi NIR si inseriscono manualmente o si preparano da foto/PDF con IA. Data, alimentarista, laboratorio, lotto, trincea, metodo, unità, base di misura e documento originale sono conservati. L’analisi attiva cambia soltanto dopo conferma; le versioni precedenti e gli snapshot dei carri restano conservati. SS e umidità sono reciproche; percentuali TQ/SS/NDF, g/kg e MJ/Mcal sono validate. Digeribilità con tempi o metodi differenti non è trattata come direttamente confrontabile.

**Confronto prodotti.** Un’unica pagina verticale presenta due prodotti affiancati, analisi del proposto, barre nutrizionali grigio/verde, confronto economico a quattro colonne, Intelligence e infine salvataggio. Un’offerta può essere valutata senza creare un prodotto o un acquisto. Il prodotto aziendale viene riletto dal server: prezzo e NIR attivi non sono sostituibili arbitrariamente nel confronto. I confronti salvati hanno versioni e non generano movimenti. Il prezzo equivalente è riferito alla sostanza secca, non alla qualità complessiva; i rapporti per nutriente non vanno sommati.

**Analisi.** Filtri per azienda, gruppi in lattazione, singolo gruppo e periodo, incluso intervallo personalizzato; grafici storici, confronto gruppi e periodo precedente. Sono distinti prelievo fresco, distribuito, costo attribuito, avanzi, scarti, riuso e ingestione stimata. FE, ECM e IOFC vengono calcolati solo dove esistono dati pertinenti e temporalmente abbinati. Manze e asciutta non ricevono KPI latte impropri. Giorni mancanti e prezzi non disponibili restano mancanti. IOFC effettivo e con prezzo latte stimato sono distinguibili.

## 2. Fonti uniche e integrazione Finanza

| Informazione | Fonte riutilizzata |
|---|---|
| Gruppi, tipologia, foto e appartenenze | Stalla → Gruppi e Mandria |
| Capi attuali | Conteggio delle appartenenze reali, comprese le regole dei gruppi |
| Prodotti, quantità e unità | Magazzino: `prodotti` |
| Scarichi/carichi fisici | `movimentiMagazzino`, con origine e identificativo dell’operazione |
| Prezzi di acquisto e fornitore | Fatture XML e anagrafica soggetti esistenti |
| Costo medio | Media ponderata residua delle giacenze aggiornate da acquisti confermati |
| NIR | Analisi versionate Alimentazione e originali in storage privato |
| Ricette, carri, distribuzioni e avanzi | Nuove registrazioni operative, non nuove anagrafiche |
| Produzione, grasso e proteine del latte | Rilevazioni persistenti in Dati stalla |
| Prezzo latte | Riga fattura di vendita in unità di massa o liquidazione documentata inserita dall’utente |
| Permessi e operatore | Utenti, membership e permessi aziendali esistenti |

**Acquisto, utilizzo e pagamento sono eventi distinti.** La fattura registra la spesa aziendale una sola volta. Il carico del carro consuma la giacenza e valorizza il materiale; la distribuzione ne attribuisce il costo al gruppo. Questi costi analitici non vengono aggiunti alle spese da fattura. In Finanza → Analisi è consultabile un riepilogo dei costi alimentari sul periodo, separato dai movimenti finanziari.

La conferma fattura converte kg/quintali/tonnellate nell’unità del prodotto e aggiorna la media sul residuo. Se la merce è già stata ricevuta con DDT/carico manuale, si può collegare la riga al ricevimento e confermare il residuo fisico ancora presente: si aggiorna la valorizzazione senza aumentare nuovamente la giacenza. I costi storici dei prelievi già effettuati non vengono rivalutati. La deduplicazione esistente delle fatture resta attiva.

## 3. Database e sicurezza

È stata applicata **soltanto la migrazione additiva `0007_f099_feeding_real.sql`**, senza cancellare dati, ricostruire anagrafiche o inizializzare razioni reali. Le nuove entità sono ricette, carri, distribuzioni, avanzi, contenitori, preferenze, NIR, confronti, rettifiche e rilevazioni Dati stalla. Ingredienti e risultati sono snapshot strutturati nei payload delle rispettive registrazioni. Sono stati aggiunti metadati di costo/conversione e provenienza ai prodotti e ai movimenti esistenti.

Tutte le query e le operazioni sono limitate all’azienda attiva. Amministrazione ricette/NIR e operatività sono separate; un operatore può gestire le proprie calibrazioni, non quelle altrui. I costi e i testi IA storici contenenti valutazioni economiche sono rimossi dalle risposte server per gli utenti senza autorizzazione finanziaria. Le operazioni finali richiedono una conferma esplicita.

I referti NIR originali sono privati. Il proxy pubblico non può firmarli: l’API autorizzata verifica azienda/prodotto e restituisce un URL temporaneo. La PWA conserva la shell e gli sfondi pubblici, non API, documenti, foto utente o dati aziendali. I banner di installazione non coprono i comandi operativi Alimentazione.

## 4. Intelligence e cautele nutrizionali

Il modello configurato è `gpt-6.1-sol`, verificato nel catalogo disponibile al progetto. L’estrazione prepara una bozza: non salva né attiva analisi. Le risposte usano un insieme consentito di dati reali, periodo, gruppi, fonti e mancanti. Non ricevono dati economici riservati quando l’utente non è autorizzato e non possono modificare ricette, prezzi, scorte o registrazioni.

L’ECM usa la formula dichiarata nell’app: **ECM kg = 0,327 × latte kg + 12,95 × grasso kg + 7,2 × proteine kg**. Grasso e proteine in percentuale vengono prima convertiti in masse. Fonte scientifica verificata: [pubblicazione su PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC8982198/).

L’ingestione è una **stima**, non una misurazione del singolo animale. Per l’avanzo viene dichiarata l’ipotesi della composizione della razione originale. L’adeguatezza nutrizionale e qualsiasi modifica devono essere validate dall’allevatore e dall’alimentarista; una correlazione non è presentata come causa certa.

## 5. Primo utilizzo e limiti espliciti

Prima di preparare un carro reale, verificare prodotti/quantità/unità e classificazione alimentare nel Magazzino, appartenenze dei gruppi, ricetta approvata e frequenza. Inserire NIR e costi documentati dove disponibili. Per FE, ECM e IOFC occorrono rilevazioni produttive reali, qualità/prezzo del latte e distribuzioni/avanzi dello stesso periodo. I numeri non presenti non sono stati creati per riempire i grafici.

Le condizioni operative attuali sono:

- Riuso automatico proporzionale soltanto nello stesso gruppo, con composizione nota, compatibilità confermata e identica versione della ricetta. Il carro non può essere composto esclusivamente da avanzo. Trasferimenti di avanzi tra gruppi o ricette diverse non vengono simulati né applicati automaticamente.
- Annullamento compensativo di un carro soltanto prima delle distribuzioni. Se il materiale è già distribuito, occorre una rettifica fisica documentata in Magazzino: non viene rimesso automaticamente in scorta un alimento potenzialmente già consumato. La rettifica guidata post-distribuzione rimane da sviluppare.
- Frequenza configurabile 0,1–12 esecuzioni/giorno: ogni tre giorni è supportato; intervalli oltre dieci giorni richiedono un’estensione del limite.
- Lotto/trincea sono metadati NIR. Non è stato inventato un inventario separato per lotto: costi e giacenze per singolo lotto richiedono un’ulteriore gestione lotti coerente con Magazzino.
- Il collegamento fattura–ricevimento richiede la corrispondenza dell’intera riga ricevuta e il residuo confermato. Ripartizioni complesse tra più DDT/ricevimenti devono essere predisposte come righe separate, non dedotte automaticamente.
- Carri, bozze e storico sono persistenti; un retry incerto mantiene la richiesta identica nella pagina corrente. Non esiste una coda di conferme finali offline e il tentativo congelato non viene recuperato automaticamente dopo un reload completo.
- I giorni delle analisi sono aggregati in UTC, esplicitamente dichiarati. Non è stata creata una cronologia fittizia dello stato produttivo dei gruppi o dei giorni-capo mancanti.
- Referti JPEG/PNG/WebP/PDF fino a 5 MB, immagini validate fino a 40 megapixel. Domande IA fino a 2.000 caratteri; note fino a 8.000 e testo IA salvabile fino a 12.000. Il testo eccedente viene dichiarato, non conservato silenziosamente.
- Bilance del carro, strumenti NIR diretti, impianti latte e liquidazioni automatiche non sono collegati a hardware o portali esterni. Servono protocolli/documentazione, credenziali e verifiche sul dispositivo prima di dichiararli compatibili. Il flusso manuale e l’importazione dei referti sono utilizzabili senza queste integrazioni.

## 6. Verifiche

Sono stati eseguiti i dodici scenari di accettazione contro API e database reali con due aziende temporanee, non con un repository simulato: conteggi Stalla e snapshot storici, bozze senza scarico, doppia conferma concorrente, rollback multingrediente, distribuzioni parziali, contenitori/frazioni, riuso, preferenze, frequenza ogni tre giorni, NIR/versioni/confronti, acquisti ponderati e DDT, isolamento e valori mancanti.

La prova browser copre le sette pagine a **360/390/430 px**, con 25 controlli di layout/flusso/permessi, assenza di overflow ed errori JavaScript, carico e replay idempotente, distribuzione senza secondo scarico, avanzo frazionario, produzione persistente e costi eliminati dalle risposte operator/viewer. Le fixture e le credenziali temporanee sono eliminate dopo la prova.

La prova IA ha caricato un PDF sintetico privato, estratto correttamente SS 34%, umidità 66%, PG 8,1% SS, NDF 42% SS e amido 32% SS, lasciando gli altri parametri mancanti. Ha verificato il blocco del proxy pubblico e una risposta Intelligence sul solo tenant di test, senza salvataggi operativi. I valori non costituiscono una razione o analisi per animali reali.

I risultati finali di suite globale, test UI dedicati, TypeScript, build, service worker e integrità diff sono registrati in `todo.md` e nel checkpoint di consegna. La pubblicazione sul dominio installato è distinta dall’aggiornamento dell’anteprima: questa consegna salva la versione verificata e non esegue una pubblicazione non richiesta.
