# Fase 74 — Verifica link inviti condivisibili

Ogni invito in attesa riceve un token UUID non prevedibile, persistito con indice univoco. La pagina pubblica `/invito/:token` interroga il server e mostra gli stati reali: invito in attesa, non trovato, revocato o già utilizzato. Il link viene accettato una sola volta e soltanto dall’account la cui email coincide con quella invitata; dopo l’accesso OAuth il token viene conservato temporaneamente e verificato dal server. Gli inviti tokenizzati non vengono più attivati dal precedente fallback automatico via email.

L’amministratore può copiare il link subito dopo aver creato l’invito e da ogni invito ancora pendente. Verificati: colonna e indice DB, stato mobile link non valido, 47 file Vitest / 351 test verdi, TypeScript, build, sintassi PWA e integrità del diff.
