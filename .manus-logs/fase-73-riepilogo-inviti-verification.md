# Fase 73 — Verifica riepilogo sicuro inviti

Il flusso di invito ora separa selezione e invio: dopo l’inserimento di email, ruolo e moduli, il comando **Rivedi invito e permessi** apre un dialogo di controllo. La revisione mostra destinatario, ruolo, ogni autorizzazione divisa per area e un avviso esplicito per il ruolo amministrativo completo. L’unica azione che registra l’invito è **Conferma e invia invito**; **Modifica selezione** riporta alla configurazione senza inviare nulla.

Verifiche completate: resa mobile della gestione utenti, 47 file Vitest e 351 test verdi, TypeScript senza errori, build riuscita, sintassi service worker valida e diff pulito. Cache PWA aggiornata a `fase-73-riepilogo-sicuro-inviti`.
