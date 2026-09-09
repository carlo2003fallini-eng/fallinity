# Fase 56 — XML forniti dall’utente

## Fonti locali

| File | Cedente/prestatore | Cessionario/committente | Tipo | Righe commerciali senza codice articolo |
|---|---|---|---|---|
| `/home/ubuntu/upload/03107710133_2026-07-3102_00_00_LAPRATICASRL.xml` | LA PRATICA SRL, P. IVA 03107710133 | SOCIETÀ AGRICOLA FALLINI DANIELE & FABIO, P. IVA/CF 00608920146 | TD01, totale € 140,00 | Sei righe con quantità/prezzo/totale/IVA positivi; due riferimenti iniziali a zero da escludere |
| `/home/ubuntu/upload/01437140195_2026-01-2001_00_00_ELLE.T.VeterinariaStudioAssociato.xml` | ELL E.T. Veterinaria Studio Associato, P. IVA 01437140195 | SOCIETÀ AGRICOLA FALLINI DANIELE & FABIO S.S., P. IVA/CF 00608920146 | TD06, totale € 2.986,56 | Una riga di assistenza veterinaria valida senza codice; una riga tecnica a zero da escludere |

Il requisito aggiornato è accettare una riga senza codice articolo quando quantità e totale sono positivi e prezzo unitario/IVA sono numerici. Le righe informative con quantità o totale zero, oppure dati economici assenti, devono restare escluse. Il verso è determinato confrontando P. IVA/codice fiscale di cedente e cessionario con quelli dell’azienda attiva: azienda cessionaria = uscita; azienda cedente = entrata.
