# Fase 80 — Schede Azienda Illustrate e Ridimensionate

## Intervento
- Griglia Azienda 2×2 mantenuta e resa più alta: altezza minima effettiva di 180 px per scheda su mobile.
- Quattro sfondi originali ottimizzati, uno per area: stalla, scaffalature di magazzino, officina agricola e campi coltivati.
- Stalla: icona dedicata di una stalla con bovino, distinta dal Magazzino.
- Magazzino: icona scaffale (`LibraryBig`).
- Icona e testo restano leggibili grazie al pannello scuro con blur e alla sovrapposizione a contrasto.
- Il trascinamento a pressione prolungata, il riordino tastiera e la sincronizzazione dell’ordine restano invariati.

## Verifiche
- Screenshot mobile 390×844: controllate proporzioni, contrasto, immagini e simboli delle quattro schede.
- Test mirati: 10/10 verdi.
- Suite completa: 48 file / 358 test verdi.
- TypeScript: `pnpm check` riuscito.
- Build: `pnpm build` riuscita.
- PWA: `node --check client/public/sw.js` riuscito; cache versionata `fase-80-schede-azienda-illustrate`.
- Integrità: `git diff --check` riuscito.
