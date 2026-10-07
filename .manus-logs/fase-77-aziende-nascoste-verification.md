# Fase 77 — Verifica aziende nascoste dal selettore

Aggiunta una preferenza personale, reversibile e isolata per utente: l’azione “Nascondi dal mio elenco” rimuove un’azienda dal solo selettore dell’account, senza archiviare né eliminare l’azienda, le membership o i dati aziendali.

L’azienda attiva non può essere nascosta. La sezione “Nascoste” consente di ripristinare ogni azienda con “Ripristina nel mio elenco”. Il backend richiede una membership attiva prima di salvare la preferenza; la tabella applicata contiene vincolo univoco utente–azienda e campi audit/soft delete.

Verificati: schema e indici database, rendering mobile, 48 file Vitest / 357 test, TypeScript, build, sintassi PWA e integrità del diff.
