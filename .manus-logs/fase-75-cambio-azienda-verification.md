# Fase 75 — Verifica cambio azienda multi-utente

Corretto il cambio azienda: il precedente selettore era simulato, mostrava una sola azienda e non cambiava alcun contesto. È ora connesso alle membership attive reali dell’utente e alla nuova procedura tRPC `access.switchCompany`.

Sicurezza: un utente standard può scegliere solo un’azienda attiva a cui ha una membership attiva; il Super Admin mantiene il cambio assistenza, con audit. Da Account compare “Cambia azienda” quando sono disponibili più aziende. Il selettore mobile indica l’azienda attiva, il ruolo assegnato e offre ricerca per nome.

Verificati il rendering mobile autenticato di Account e selettore, 48 file Vitest / 355 test, TypeScript, build, sintassi PWA e integrità del diff.
