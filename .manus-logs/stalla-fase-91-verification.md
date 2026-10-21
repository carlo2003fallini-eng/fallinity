# Fase 91 — Ricerca Animali e Anagrafica Mandria

## Implementazione
- Nella schermata Gruppi, la ricerca ora individua il singolo animale anziché filtrare per nome del gruppo.
- Sotto ricerca e azione Nuovo è presente il solo accesso orizzontale **Tutti gli animali**.
- L’accesso apre `/stalla/animali`, una pagina dedicata all’intera mandria con ricerca per matricola o numero aziendale e filtri per gruppo e stato.
- La query animali filtrata è protetta e limitata all’azienda attiva.

## Verifiche
- Screenshot mobile 390×844: Gruppi mantiene l’azione unica e riconoscibile; l’anagrafica espone ricerca e filtri richiesti.
- Test mirati: 4 file, 41 test verdi.
- Suite completa: 51 file, 374 test verdi.
- TypeScript senza errori; build di produzione riuscita; service worker sintatticamente valido; diff senza errori.
