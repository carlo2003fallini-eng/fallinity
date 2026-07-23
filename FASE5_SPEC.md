# Sprint Finanza — Fase 5: Budget, Reintegrazione, Analisi, Scenari, Report

## Struttura sezione Finanza
Dashboard, Entrate/Uscite, Documenti, Scadenze, Cashflow, Crediti/Debiti, Budget, Reintegrazione, Investimenti, Analisi, Report, Impostazioni finanziarie.

## 2. Budget (/finanza/budget)
- Annuali, mensili, trimestrali, personalizzati
- Per: azienda, categoria, sottocategoria, centro di costo, settore, modulo, progetto, coltura, macchina, investimento
- Campi: nome, periodo, data inizio/fine, tipo E/U, categoria, sottocategoria, centro costo, settore, importo previsto, distribuzione, note, responsabile, stato
- Stati: bozza, attivo, completato, archiviato
- Distribuzione: uniforme, manuale/mese, stagionale, basata su periodo precedente, personalizzata
- Confronto: budget previsto, consuntivo, residuo, scostamento €/%, % utilizzata, previsione fine periodo, stato
- Colori: verde (entro), giallo (vicino), arancione (rischio), rosso (superato)
- Previsione: lineare, scadenze confermate, media storica, personalizzato — mostrare metodo
- Alert: >80%, >100%, previsione superamento, categoria senza budget, crescita anomala, spesa non prevista, non aggiornato, incoerente

## 8-14. Fondo Reintegrazione (/finanza/reintegrazione)
- Piano per bene: macchina collegata, valore sostituzione, data sostituzione, vita utile, valore residuo, capitale necessario, accantonato, accantonamento mensile consigliato/effettivo, rendimento, interessi, % copertura, differenza, stato, priorità, note
- Formula: Capitale necessario = Valore sostituzione - Valore residuo - Capitale disponibile; Accantonamento = Capitale necessario / Mesi mancanti
- Conto deposito: capitale versato, interessi, saldo, vincolato, disponibile, movimenti, prelievi, rettifiche; tasso interesse, data decorrenza, periodicità, lordo/netto
- Accantonamento: gestionale (quota teorica) vs trasferimento reale (denaro spostato)
- Distribuzione: un conto → più piani; allocazioni ≤ saldo disponibile
- Dashboard: Hero (fondo totale, allocato, disponibile, obiettivo, copertura), card piani, alert
- Storico valore sostituzione con timeline

## 15-16. Investimenti (/finanza/investimenti)
- Campi: nome, categoria, descrizione, importo, data, durata, fornitore, finanziamento, anticipo, rate, contributi, valore residuo, risparmio, ricavo aggiuntivo, costi operativi, centro costo, stato, priorità
- Stati: idea, da valutare, approvato, pianificato, in corso, completato, annullato
- KPI: investimento iniziale, contributi, capitale proprio, finanziamento, costo annuale, risparmio annuale, ricavi aggiuntivi, tempo ritorno, effetto cashflow, effetto Reintegrazione

## 17-18. Scenari (/finanza/scenari)
- Prudente, Realistico, Ottimistico, Personalizzato
- Variabili: prezzo latte, quantità, costi (alimentazione, energia, carburante, personale, veterinario, manutenzione), ricavi colture, contributi, investimenti, tassi, tempi incasso/pagamento
- Risultati: entrate/uscite/utile/cashflow previsti, saldo minimo, data saldo minimo, crediti, debiti, capacità accantonamento, copertura Reintegrazione, scostamento budget, fabbisogno
- Confronto tabellare: Prudente | Realistico | Ottimistico
- NON modificare dati reali

## 19-25. Analisi (/finanza/analisi)
- Sezioni: redditività, costi, ricavi, liquidità, indebitamento, efficienza, produzione, mezzi, colture, stalla
- KPI generali: ricavi, costi, utile, risultato cassa, margine operativo, cashflow, liquidità, crediti/debiti aperti, giorni medi incasso/pagamento, incidenza interessi, scadenze scadute, copertura budget/Reintegrazione
- KPI Stalla: ricavo/costo/margine per litro, per vacca, costo trattamento/capo, rimonta, vendita animali
- KPI Macchinari: costo manutenzione/macchina, ricambi, manodopera, ora macchina, carburante, costo annuo, TCO gestionale, fermo, frequenza interventi, valore manutenzioni/valore macchina, accantonamento/copertura Reintegrazione
- KPI Campi: costo totale/ettaro, sementi/ettaro, concimi/ettaro, lavorazioni, irrigazione, produzione/ettaro, ricavo/ettaro, margine/ettaro, confronto colture/campagne
- Analisi centro di costo: costo periodo, budget, scostamento, andamento, categorie, fornitori, documenti aperti, previsione, alert
- Fornitori: spesa totale, documenti, debito, giorni pagamento, categorie, andamento, concentrazione
- Clienti: ricavi, crediti, giorni incasso, documenti scaduti, andamento, concentrazione

## 26-28. Report (/finanza/report)
- Report: conto economico gestionale, entrate/uscite, cashflow, crediti, debiti, scadenze, budget/consuntivo, costi per centro/categoria, analisi Stalla/Campi/Macchinari, Reintegrazione, investimenti, scenari
- Filtri: azienda, periodo, Cassa/Competenza, centro costo, categoria, modulo, soggetto
- Export: PDF, CSV, XLSX
- Report programmati: settimanali/mensili/trimestrali/annuali; salvataggio config, generazione manuale, storico

## 29-31. Insight AI
- Deterministici prima: budget superato, costi in crescita, credito scaduto, debito imminente, liquidità sotto soglia, Reintegrazione insufficiente, centro anomalo, spesa importante, margine in diminuzione
- AI: basati su dati reali, brevi, spiegabili, con valori, mai certezze, con periodo/dati/motivazione/link/confidenza/data
- Azioni consigliate: controllare categoria, verificare fattura, aggiornare budget, posticipare investimento, aumentare accantonamento, verificare credito — sempre conferma utente

## 32. Home e Dashboard Finanza
- Dashboard Finanza: card Budget utilizzato, Previsione, Fondo Reintegrazione, Investimenti pianificati, Alert, Insight
- Home: solo KPI principali, alert critici, scadenze, avviso budget, Reintegrazione

## 33-34. Permessi e Multi-azienda
- Permessi: finance.budget.view/create/edit/approve, finance.replacement.view/manage, finance.investments.view/manage, finance.scenarios.view/manage, finance.analytics.view, finance.reports.view/export, finance.insights.view, finance.settings.manage
- Multi-azienda: companyId su tutto, vista consolidata solo per autorizzati

## 35. Architettura
- server/domains/finance/budget/, replacement/, investments/, analytics/, reports/, scenarios/, insights/
- Ogni dominio: validators, service, repository, router, transazioni, query aggregate, audit, soft delete, indici

## 36. Prestazioni
- KPI calcolati backend, query aggregate, indici per companyId, periodo, categoria, centro costo, macchina, animale, campo, stato, data, budgetId, replacementPlanId

## 37. UI Mobile (390×844)
- Dark premium, verde principale, card grandi, glow minimo, grafici leggibili, pulsanti grandi, gerarchia chiara, no scroll orizzontale, safe area iPhone

## 38-40. Test
- Budget: creazione, distribuzione mensile, somma=totale, per categoria/centro, consuntivo, scostamento, %, previsione, periodo precedente, archiviato, multi-azienda, permessi
- Reintegrazione: piano sostituzione, capitale necessario, accantonamento, valore residuo, interessi, trasferimento reale, gestionale, più piani/conto, allocazioni≤saldo, aggiornamento valore, storico, copertura %
- Analisi/Scenari: costo/litro, margine/litro, costo/capo, costo/ettaro, margine/ettaro, costo macchina, centri, fornitori, clienti, scenari P/R/O, no modifica dati, N/D per mancanti, esclusione bozze, Cassa/Competenza

## Definition of Done
- Budget reali creabili, confronto budget/consuntivo, previsione con metodo, Reintegrazione collegata a mezzi/conti, gestionale vs reale separati, interessi manuali, fondo distribuibile, allocazioni≤saldo, investimenti pianificabili, scenari senza modifica dati, KPI da dati collegati, report filtrabili/esportabili, insight spiegabili, companyId/permessi/audit, mobile OK, check/test/build OK
