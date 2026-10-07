# Fase 78 — Verifica modifica, archivio ed eliminazione aziende

Il selettore azienda ora presenta per ogni scheda i controlli richiesti: **Modifica** a sinistra e **Apri** a destra. Il vecchio flusso “Nascondi dal mio elenco” è stato rimosso integralmente dal client e dal backend, quindi non genera più la query che nello screenshot causava l’errore per la colonna `version`.

Nel dialog Modifica, il Super Admin può cambiare nome, archiviare oppure eliminare logicamente l’azienda. Archivio ed eliminazione sono confermati con dialog esplicito e sono bloccati sia nell’interfaccia sia nel servizio quando l’azienda è quella attiva. Non viene eseguita alcuna cancellazione fisica di dati aziendali.

La tabella tecnica vuota della funzione precedente rimane nel database perché il database ha bloccato la rimozione fisica; non è più raggiunta dal codice e non contiene preferenze.

Verificati: rendering mobile con Modifica a sinistra e Apri a destra, test mirati, 48 file Vitest / 357 test, TypeScript, build, sintassi PWA e integrità del diff.
