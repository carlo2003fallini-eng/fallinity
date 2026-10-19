# Fase 86 — Card Stalla coerenti con Azienda

Le sei card della Stalla usano ora gli stessi valori della sezione Azienda: griglia 2×3, altezza minima 180 px, icona 48 px con simbolo 26 px, titolo `text-lg`, bordi, ombre e overlay verde scuro coerenti. Gli sfondi sono stati rigenerati per rappresentare rispettivamente dati della stalla, riproduzione, vitelli, gruppi della mandria, sanità e alimentazione; sono stati ottimizzati per mobile e caricati nello storage WebDev.

Verifiche superate: screenshot mobile 390×844; test mirati 26/26; suite Vitest completa, TypeScript, build di produzione, sintassi del service worker e controllo diff. La cache PWA `fase-86-card-stalla-stile-azienda` precarica esclusivamente i sei nuovi sfondi pubblici.
