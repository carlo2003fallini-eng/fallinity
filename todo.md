
## Fase 73 — Riepilogo Sicuro degli Inviti
- [x] Analizzare il flusso di invito e i dati autorizzativi selezionati
- [x] Inserire una revisione visiva con email, ruolo e permessi prima dell’invio
- [x] Richiedere una conferma finale distinta dall’editing dell’invito
- [x] Aggiungere regressione UI, verifica mobile, test, TypeScript, build, PWA e checkpoint

## Fase 74 — Link Invito Condivisibili
- [x] Analizzare inviti esistenti, sicurezza del token e percorso di accesso
- [x] Persistire un token univoco per ogni invito con migrazione additiva
- [x] Aggiungere copia sicura del link subito dopo l’invito e per gli inviti in attesa
- [x] Creare una schermata di accesso dedicata per il destinatario del link
- [x] Aggiungere regressioni, verifica mobile, test, TypeScript, build, PWA e checkpoint

### Completamento sicurezza link
- [x] Risolvere il token lato server e distinguere invito valido, revocato, accettato e non trovato
- [x] Accettare il token solo per l’account la cui email coincide con l’invito
- [x] Collegare la pagina pubblica al token reale, con stati di caricamento ed errore
- [x] Aggiungere regressioni di sicurezza e ripetere verifiche finali prima del checkpoint

## Fase 75 — Cambio Azienda Multi-Utente
- [x] Analizzare blocco attuale di cambio azienda, route e autorizzazioni
- [x] Consentire il cambio solo fra aziende con membership attiva, mantenendo il Super Admin separato
- [x] Rendere accessibile il selettore azienda da Account e dall’interfaccia mobile
- [x] Rimuovere il selettore simulato e sostituirlo con dati reali
- [x] Aggiungere regressioni, verifica mobile, test, TypeScript, build, PWA e checkpoint
