# Fallinity FEOS — Todo

## Fase 1: Schema Database e Struttura Base
- [x] Schema tabelle: azienda, dipendenti, fornitori, clienti (entità unificata)
- [x] Schema tabelle: campi, colture, lavorazioni
- [x] Schema tabelle: finanza (transazioni, budget, categorie)
- [x] Schema tabelle: magazzino (prodotti, movimenti)
- [x] Schema tabelle: officina (macchine, manutenzioni)
- [x] Schema tabelle: calendario (eventi, attività)
- [x] Schema tabelle: AI chat (messaggi, sessioni)
- [x] Migrazione SQL applicata

## Fase 2: Design System e Layout
- [x] Design system dark professionale (CSS variables, palette, tipografia)
- [x] Font Google: Inter + Space Grotesk
- [x] Sidebar unificata con tutti i moduli
- [x] DashboardLayout personalizzato per FEOS
- [x] Routing completo per tutti i moduli
- [x] Animazioni e micro-interazioni

## Fase 3: Modulo Home e Azienda
- [x] Dashboard Home con KPI aziendali
- [x] Widget attività recenti
- [x] Widget notifiche
- [x] Accesso rapido ai moduli
- [x] Modulo Azienda: anagrafica unificata
- [x] Gestione dipendenti
- [x] Gestione fornitori
- [x] Gestione clienti
- [x] Entità unificata (Contatti)

## Fase 4: Modulo Finanza e Campi
- [x] Registrazione entrate e uscite
- [x] Gestione budget
- [x] Report economici
- [x] Calcolo ROI
- [x] Grafici finanziari (Recharts)
- [x] Gestione appezzamenti
- [x] Gestione colture
- [x] Gestione lavorazioni
- [x] Vista elenco campi
- [x] Vista dettaglio campo

## Fase 5: Modulo Magazzino e Officina
- [x] Gestione scorte prodotti e materiali
- [x] Movimenti carico/scarico
- [x] Alert scorte minime
- [x] Gestione macchine agricole
- [x] Manutenzioni programmate
- [x] Registro interventi

## Fase 6: Calendario e Report Enterprise Metrics
- [x] Calendario vista mensile
- [x] Calendario vista settimanale
- [x] Creazione/modifica eventi
- [x] Dashboard Enterprise Metrics
- [x] Grafici performance
- [x] Grafici utilizzo risorse
- [x] Indicatori qualità dati
- [x] ROI software

## Fase 7: Assistente AI Explainable
- [x] Chat AI contestuale
- [x] Integrazione LLM (invokeLLM)
- [x] Explainable AI: suggerimenti motivati
- [x] Contesto aziendale nell'AI
- [x] Sessioni multiple con storico

## Fase 8: Rifinitura e Test
- [x] Test vitest per procedure principali (13 test passanti)
- [x] TypeScript 0 errori
- [x] Verifica coerenza design
- [x] Checkpoint finale

## Fase 9: Riscrittura Fedele ai Mockup
- [x] Home: header verde con logo, KPI cards orizzontali (Entrate/Uscite/Utile/Campi/Macchine), grafico lineare andamento, tabella attività recenti con badge stato, sezione alert/notifiche
- [x] Azienda: header card con stats (Totale/Dipendenti/Fornitori/Clienti), tabella contatti con avatar, ruolo badge colorato, form laterale slide-in per creazione
- [x] Finanza: KPI cards (Entrate verde/Uscite rosso/Utile/ROI), grafico barre mensile + torta categorie, tabella transazioni con badge tipo, form laterale
- [x] Campi: grid card per ogni campo con indicatore stato colore, ettari/coltura/stato, dettaglio campo con lavorazioni timeline
- [x] Magazzino: tabella prodotti con progress bar quantità/minimo, badge categoria, form movimento carico/scarico
- [x] Officina: card macchine con stato badge (Operativo/Manutenzione/Fermo), lista interventi con priorità colorata, form aggiunta intervento
- [x] Calendario: griglia mensile con eventi colorati per categoria, vista settimanale con fasce orarie, form evento
- [x] Report Enterprise Metrics: header "Enterprise Metrics™", 4 score cards (Completezza/Accuratezza/Tempestività/Coerenza), grafici performance, tabella metriche
- [x] AI: chat bubble layout (utente destra/AI sinistra), badge "Explainable AI™", panel suggerimenti contestuali, indicatori XAI
- [x] Sidebar: logo Fallinity in alto, voci con icone e label, sezione utente in basso, indicatore modulo attivo con bordo verde

## Fase 10: Nuovi Moduli da CORE-UX
- [x] Schema DB: tabelle stalla (animali, gruppi, sincronizzazioni, gravidanze, zoppie, trattamenti, parti, asciutta, infermeria)
- [x] Schema DB: tabelle reintegrazione (fondi_macchine, rate_versamento)
- [x] Login page: sfondo agricolo sfocato, logo grande, slogan, form premium, biometrico placeholder
- [x] Selezione azienda: card multi-tenant con foto/logo/ruolo/notifiche, badge ATTIVA
- [x] Modulo Stalla: dashboard con 8 card modulari (Gruppi/Sincronizzazioni/Gravidanze/Zoppie/Trattamenti/Parti/Asciutta/Infermeria)
- [x] Modulo Sincronizzazioni: lista vacche con numero/matricola/farmaco/ora/prossimo trattamento/pulsante esegui
- [x] Modulo Reintegrazione: hero totale fondi, versamento consigliato, lista fondi per macchina con progress bar e pulsante paga rata
- [x] Home Dashboard: Hero card Utile Netto grande (metà schermo), card Cashflow e Fondo Reintegrazione, azioni rapide (Entrata/Uscita/Intervento/Report), alert operativi feed
- [x] Sidebar: aggiungere voci Stalla e Reintegrazione

## Fase 11: Navigazione Bottom Bar
- [x] Convertire DashboardLayout da sidebar a bottom navigation bar
- [x] Bottom bar fissa con icone moduli principali + menu "Altro" per moduli secondari
- [x] Header superiore con logo/azienda e profilo utente
- [x] Adattare il padding del contenuto per la bottom bar
- [x] Verifica visiva responsive

## Fase 12: Alpha 0.2 — Elevazione Qualità UX & Design System

### Asset visivi
- [x] Immagine Hero agricola premium (campo/azienda al tramonto, tono dark)
- [x] Immagine Officina/mezzo agricolo (trattore, capannone)
- [x] Immagine Stalla/bovini per card Azienda
- [x] Immagine Dati Latte (mungitura/latte)
- [x] Immagine Dati Vitelli
- [x] Immagine Magazzino/silos
- [x] Immagine Campi/colture

### Design System Fallinity
- [x] Consolidare token CSS: glow minimale, ombre soft, gerarchia card
- [x] Tipografia premium uniforme (display + body)
- [x] Microanimazioni fluide (hover card, entrate staggered)
- [x] Spaziature uniformi cross-modulo
- [x] Palette colori per modulo (verde Stalla, oro Finanza/Reint., blu Dati, ecc.)

### Home (Dashboard principale)
- [x] Hero Card dominante Utile Netto (grande, glow verde)
- [x] Card economiche: Entrate, Uscite, Cashflow, Fondo Reintegrazione
- [x] Trasmettere senso di controllo immediato dell'azienda

### Finanza (peso maggiore)
- [x] Dashboard economica con grafici prominenti
- [x] Alert finanziari e andamento economico
- [x] Collegamento diretto alla Reintegrazione

### Azienda (card premium moduli)
- [x] Card premium: Stalla, Dati Latte, Dati Vitelli, Magazzino, Officina
- [x] KPI principali + immagini di sfondo + grafici integrati

### Stalla (allineata ai mockup)
- [x] Card grandi 2x2 con glow colorato e illustrazioni semitrasparenti
- [x] Contatori ben evidenziati
- [x] Accesso moduli: Gruppi, Sincronizzazioni, Gravidanze, Zoppie, Trattamenti, Parti/Post-parto, Asciutta, Infermeria

### Officina (premium)
- [x] Hero con immagine mezzo/officina
- [x] Sezioni: Mezzi, Manutenzioni, Ricambi (riepilogo costi per tipo), Interventi

### AI Copilot
- [x] Trasformare AI da pagina separata a Copilot contestuale Fallinity
- [x] Suggerimenti azioni basati sul contesto aziendale
