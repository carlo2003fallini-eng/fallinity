# Verifica Azienda — Fase 70

La home Azienda è stata ricostruita come accesso operativo essenziale. Visualizza esclusivamente le quattro card Stalla, Magazzino, Officina e Campi in griglia 2×2, senza KPI, dati Latte, dati Vitelli, calendario, anagrafiche, dipendenti, fornitori, clienti o card secondarie.

Il tap normale apre l'area associata. La pressione prolungata di 320 ms attiva il trascinamento touch/mouse: la card si solleva e segue il dito/puntatore, mentre le altre si riordinano durante lo spostamento. Al rilascio l'ordine viene salvato in localStorage usando una chiave per utente; all'apertura successiva viene ripristinato. Il riordino è anche utilizzabile da tastiera senza aggiungere controlli visivi permanenti.

Verifiche riuscite: screenshot 390×844, route Stalla/Magazzino/Officina/Campi, 339/339 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js` e `git diff --check`.
