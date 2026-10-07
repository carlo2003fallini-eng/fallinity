
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

## Fase 76 — Compatibilità Cambio Azienda con ID Storici
- [x] Individuare l’errore di validazione UUID mostrato nel selettore azienda
- [x] Accettare gli identificativi azienda storici validi senza ridurre i controlli di accesso
- [x] Aggiungere una regressione per ID UUID e legacy, quindi verificare UI mobile, test, TypeScript, build, PWA e checkpoint

## Fase 77 — Aziende Nascoste dal Selettore Personale
- [x] Distinguere la rimozione personale reversibile dall’archiviazione globale Super Admin
- [x] Salvare per utente l’elenco delle aziende nascoste senza eliminare aziende o dati
- [x] Aggiungere nascondi/ripristina nel selettore con protezione dell’azienda attiva
- [x] Aggiungere regressioni, verifica mobile, test, TypeScript, build, PWA e checkpoint
