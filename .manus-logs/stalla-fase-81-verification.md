# Fase 81 — Hub Stalla Illustrato

## Risultato
- Home `/stalla` sostituita con una griglia mobile-first 2×3 delle sei aree: Dati latte, Riproduzione, Vitelli, Gruppi, Sanità e Alimentazione.
- Sei fotografie originali, ottimizzate e archiviate come asset pubblici dell’app; ogni card ha una specifica icona e un contrasto dark premium.
- Aggiunte route interne `/stalla/:sectionId`, banner di contesto e tab iconiche per ogni area.
- Le aree già operative riusano i flussi reali: Gruppi e Animali; Sanità usa i dati reali di zoppie e statistiche. Le sezioni senza sorgenti dati implementate espongono uno stato predisposto, senza numeri o registri fittizi.
- Service worker aggiornato alla cache `fase-81-hub-stalla-illustrato`, con i soli asset visivi pubblici della Stalla; API, autenticazione e dati utente restano network-only.

## Verifiche eseguite
- Screenshot mobile 390×844: `/stalla`, `/stalla/dati-latte`, `/stalla/gruppi`, `/stalla/sanita`.
- Test mirati: 3 file, 38 test verdi.
- Suite completa: 49 file, 364 test verdi.
- `pnpm check`: superato.
- `pnpm build`: superato.
- `node --check client/public/sw.js`: superato.
- `git diff --check`: superato.
