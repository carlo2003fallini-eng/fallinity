# Verifica splash screen

- Data verifica: 3 settembre 2026.
- Lo splash brandizzato appare immediatamente con sfondo verde scuro, icona ufficiale, nome Fallinity e payoff.
- Dopo l’attesa nel browser di anteprima, il contenuto applicativo non è ancora comparso: il browser mostra ancora il markup statico iniziale.
- Azione necessaria: controllare console e caricamento del modulo principale; lo splash non deve poter restare bloccato se il bootstrap React fallisce o tarda.

## Diagnostica

Il documento raggiunge `readyState=complete` e richiede correttamente sia `/@vite/client` sia `/src/main.tsx`. Il root conserva però il solo `fallinity-static-splash`, senza `data-app-ready`, e la console non mostra eccezioni. Il problema è quindi precedente al commit React oppure legato all’esecuzione del modulo principale in questa sessione PWA; occorre introdurre una rimozione di sicurezza indipendente da React e verificare direttamente l’import del modulo.

Il modulo `/src/main.tsx` risponde HTTP 200 come `text/javascript`, ma l’import dinamico fallisce nella sessione controllata dal service worker. Il problema è compatibile con una cache runtime di moduli Vite trasformati ormai incoerente dopo il riavvio. Prima della verifica visiva finale occorre azzerare la vecchia registrazione/cache di anteprima e aggiungere comunque un fallback statico che non possa coprire indefinitamente un errore di bootstrap.

## Esito finale

Dopo la rimozione delle vecchie cache e della registrazione precedente, il browser esegue nuovamente il bootstrap. Lo splash React mostra la nuova icona, il nome Fallinity, il payoff, la barra di caricamento e il testo di stato; dietro lo splash risultano già montati il controller PWA e la schermata di accesso. La cache del service worker ora esclude esplicitamente i moduli di sviluppo `/src`, `/@`, `/node_modules` e `/.vite`, impedendo che il problema si ripresenti in anteprima. È presente anche un fallback statico con pulsante Riprova se l’avvio non si completa entro otto secondi.

La verifica successiva conferma che lo splash scompare automaticamente e lascia visibile la schermata di accesso e il prompt PWA. La console browser non contiene errori durante avvio, transizione o uscita.
