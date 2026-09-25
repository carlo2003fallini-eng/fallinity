# Verifica mobile Finanza — Fase 59

La schermata `/finanza/analisi` a 390×844 mostra correttamente il nuovo controllo **Direzione dei dati** sotto periodo, granularità e confronto. I tre comandi touch — Tutto, Entrate e Uscite — restano visibili su un’unica riga, con etichetta dello stato attivo e senza overflow orizzontale. Il percorso `/finanza` è stato raggiunto dal renderer mentre lo splash iniziale era ancora attivo; l’area Analisi è invece stata verificata visivamente dopo il caricamento.

Una successiva cattura di `/finanza` a 390×844 ha confermato la dashboard dopo il caricamento: i saldi sono mostrati nel formato euro corretto (ad esempio `-121.814 €`, non un valore in centesimi), mentre i filtri periodo e Cassa/Competenza rimangono visibili e accessibili sopra ai KPI.
