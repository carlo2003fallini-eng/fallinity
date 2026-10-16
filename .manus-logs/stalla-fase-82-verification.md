# Fase 82 — Rinomina Dati stalla

L’area visibile nell’hub Stalla e nella relativa sezione interna è stata rinominata da **Dati latte** a **Dati stalla**. Il percorso tecnico `/stalla/dati-latte`, le tab operative, l’asset fotografico e i dati già collegati restano invariati, quindi non sono stati introdotti rischi di compatibilità.

Verifiche completate: screenshot mobile 390×844 della sezione aggiornata; suite completa Vitest con 49 file e 365 test verdi; TypeScript, build di produzione, sintassi del service worker e controllo del diff superati. La cache PWA è ora versionata `fase-82-dati-stalla`.
