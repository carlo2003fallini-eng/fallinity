# Verifica Azienda — Fase 71

L’ordine delle card Stalla, Magazzino, Officina e Campi è ora persistito nel database e sincronizzato tra dispositivi. La nuova tabella `preferenzeHomeAzienda` è isolata da vincolo univoco per `companyId` + `userUuid`, include campi di audit e memorizza l’ordine JSON validato.

Il server espone le procedure tRPC protette `azienda.ordineAree` e `azienda.salvaOrdineAree`. La griglia legge il database come fonte primaria; il localStorage, ora isolato anche per azienda, è solo un fallback offline. Quando la connettività torna, un ordine ancora pendente viene ritentato automaticamente. Nessun ordine è condiviso tra utenti o aziende.

Migrazione `0059_ordine_aree_azienda_sincronizzato.sql` applicata e verificata: schema a 11 colonne e indice univoco composto presente. `drizzle-kit generate` è stato eseguito solo per ispezione e interrotto prima di una rinomina non correlata proposta dallo strumento.

Verifiche riuscite: screenshot mobile 390×844, 343/343 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check`, colonne e indice database.
