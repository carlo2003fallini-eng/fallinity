# Verifica Finanza — Fase 69

Le azioni rapide della dashboard Finanza sono ora riordinabili con trascinamento tramite touch e mouse. Ogni tessera presenta una maniglia visiva, evidenzia la destinazione durante lo spostamento e non apre la sezione quando il gesto è un trascinamento. L'ordine viene salvato nel localStorage del dispositivo e può essere riportato a quello originale con il comando Ripristina.

Accessibilità: l'azione normale resta apribile con Invio; Spazio attiva il riordino da tastiera, le frecce modificano la posizione, Spazio conferma e Esc annulla. Gli annunci di stato sono disponibili per lettori di schermo.

Verifiche riuscite: 334/334 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check` e screenshot mobile 390×844.
