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
- [ ] Schema DB: tabelle stalla (animali, gruppi, sincronizzazioni, gravidanze, zoppie, trattamenti, parti, asciutta, infermeria)
- [ ] Schema DB: tabelle reintegrazione (fondi_macchine, rate_versamento)
- [ ] Login page: sfondo agricolo sfocato, logo grande, slogan, form premium, biometrico placeholder
- [ ] Selezione azienda: card multi-tenant con foto/logo/ruolo/notifiche, badge ATTIVA
- [ ] Modulo Stalla: dashboard con 8 card modulari (Gruppi/Sincronizzazioni/Gravidanze/Zoppie/Trattamenti/Parti/Asciutta/Infermeria)
- [ ] Modulo Sincronizzazioni: lista vacche con numero/matricola/farmaco/ora/prossimo trattamento/pulsante esegui
- [ ] Modulo Reintegrazione: hero totale fondi, versamento consigliato, lista fondi per macchina con progress bar e pulsante paga rata
- [ ] Home Dashboard: Hero card Utile Netto grande (metà schermo), card Cashflow e Fondo Reintegrazione, azioni rapide (Entrata/Uscita/Intervento/Report), alert operativi feed
- [ ] Sidebar: aggiungere voci Stalla e Reintegrazione
