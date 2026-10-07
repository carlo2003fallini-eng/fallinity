# Fase 76 — Verifica compatibilità ID azienda

Risolto l’errore `Invalid UUID` visualizzato nel selettore Cambio azienda. La validazione accetta ora sia i nuovi UUID sia gli ID azienda storici alfanumerici con trattino/trattino basso, come `comp-demo-0001`.

La sicurezza non è stata indebolita: il servizio verifica comunque l’esistenza di un’azienda attiva e, per gli utenti non Super Admin, una membership attiva sulla stessa azienda prima di aggiornare il contesto.

Verificati: regressione mirata per UUID e ID storico, rendering mobile autenticato senza toast di errore, 48 file Vitest / 356 test, TypeScript, build, sintassi PWA e integrità del diff.
