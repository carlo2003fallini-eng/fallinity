# Inserimento automatico fatture XML

## Ambito prima versione

La prima versione acquisisce esclusivamente fatture elettroniche italiane XML. I dati strutturati del file sono sempre la fonte primaria; l’AI non deve reinterpretare importi, anagrafiche, date o scadenze presenti nell’XML.

## Dati da estrarre

Il parser deve leggere fornitore, partita IVA, codice fiscale, numero e data fattura, imponibile, IVA, totale, ritenute/altri importi, metodo di pagamento, IBAN, scadenze e numero righe. Per ogni riga: descrizione, quantità, unità, prezzo unitario, totale, aliquota IVA e codice articolo.

## Classificazione e revisione

Regole e storico aziendale vengono usati per primi. `gpt-5-mini` interviene solo per classificare righe nuove o incerte. Categoria, centro di costo, destinazione e collegamento magazzino restano modificabili prima della conferma. Nessun dato aziendale viene modificato durante upload e revisione.

## Conferma

“Conferma e registra” crea in modo atomico l’uscita/documento Finanza, il fornitore se necessario, le scadenze, le registrazioni economiche e, solo se confermato dall’utente, gli aggiornamenti Magazzino. Dashboard, cash flow, budget e analisi devono riflettere i nuovi dati tramite le strutture finanziarie esistenti.

## Sicurezza e stati

Gli stati richiesti sono: da verificare, verificata, registrata e pagata. Gli alert includono possibile duplicato, importo anomalo, scadenza vicina, dati mancanti e classificazione incerta. Il controllo duplicati usa partita IVA, numero, data e importo; una corrispondenza richiede conferma esplicita.

## UX

Flusso mobile-first: Carica fattura → Fattura acquisita → Controlla i dati → Conferma e registra. Upload tramite trascinamento o selezione file. Nessun XML tecnico mostrato all’utente. Interfaccia dark/green con card, pulsanti grandi e pochi passaggi.

## Navigazione richiesta

I comandi Manuale e Automatico devono stare nell’header Finanza, in alto a destra dove prima era “+ Nuovo”. Manuale apre `/finanza/nuovo`; Automatico apre `/finanza/nuovo-automatico`. I precedenti riquadri Manuale e Inserimento AI vanno rimossi dalla griglia inferiore.
