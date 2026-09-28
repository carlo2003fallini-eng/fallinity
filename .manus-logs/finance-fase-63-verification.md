# Verifica Finanza — Fase 63

La scelta **Aggiorna Magazzino** viene ora memorizzata nella regola di apprendimento delle fatture automatiche, insieme a prodotto, centro di costo, sottocategoria e destinazione. Le nuove acquisizioni e l'azione **Rileggi XML** applicano la scelta salvata alla riga in revisione.

Il comportamento resta prudente per le regole esistenti: il nuovo campo parte da `false`. Le fatture in Entrata non possono mai precompilare o creare un carico di Magazzino, anche se esiste una regola storica per lo stesso prodotto.

Schema DB esteso con migrazione additiva `0058_fatture_memoria_magazzino.sql` e colonna verificata. Drizzle generate è stato eseguito solo in ispezione e interrotto perché proponeva una rinomina storica non correlata.

Verifiche superate: 316/316 test Vitest, `pnpm check`, `pnpm build`, `node --check client/public/sw.js`, `git diff --check` e screenshot mobile 390×844.
