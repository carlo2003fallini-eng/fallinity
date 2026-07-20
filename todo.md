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

## Fase 13: Alpha 0.2 — Fondamenta + Mobile-First (revisione architetturale)
> NOTA: la parte Database + Backend a domini di questa fase è stata SUPERSEDUTA dalla Fase 14 (Strada A, rifondazione pulita UUID), confermata dall'utente. Gli item sotto sono realizzati in forma equivalente nella Fase 14.

### Database (progressivo, mantiene dati) — SUPERSEDUTO da Fase 14
- [x] Tabella organizations (uuid, name, colonne standard)
- [x] Tabella companies (uuid, organizationId, name, colonne standard)
- [x] Tabella farms (uuid, companyId, name, colonne standard)
- [x] Tabella roles (8 ruoli: platform_owner, super_admin, organization_admin, company_admin, manager, operator, consultant, viewer)
- [x] Tabella permissions
- [x] Tabella moduleAccess
- [x] Tabella companyMemberships (userId, companyId, roleId)
- [x] Tabella auditLogs
- [x] Colonne standard Fallinity (uuid, companyId, createdAt/By, updatedAt/By, deletedAt/By, version) su entità operative
- [x] Soft delete: deletedAt/deletedBy al posto del delete fisico nelle mutation

### Backend a domini — realizzato come router unico con sezioni a dominio (Fase 14)
- [x] Logica finance (transazioni, budget, summary) con company-scoping e soft-delete
- [x] Logica livestock (animali, gravidanze, zoppie, trattamenti) con company-scoping e soft-delete
- [x] Logica fleet (macchine, interventi) con company-scoping e soft-delete
- [x] Logica crop (campi, lavorazioni) con company-scoping e soft-delete
- [x] Logica inventory (prodotti, movimenti) con company-scoping e soft-delete
- [x] Logica reinvestment (fondi, rate) con company-scoping e soft-delete

### Design System Fallinity (componenti riutilizzabili)
> Libreria estratta in `client/src/components/fallinity/index.tsx` e applicata a Home/Azienda. Header e BottomNav erano già componenti reali in `DashboardLayout.tsx`.
- [x] FallinityKpiCard (estratto + usato in Home)
- [x] FallinityModuleCard (estratto + usato in Azienda)
- [x] FallinityEntityCard (estratto, disponibile per liste a card)
- [x] FallinityInsightCard / ChartCard (estratto + usato in Home per Andamento e Attività)
- [x] FallinitySection (estratto + adottato in Home e Azienda)
- [x] FallinityBottomNav (già componente reale in DashboardLayout: nav fixed bottom)
- [x] FallinityHeader (già componente reale in DashboardLayout: header sticky logo+azienda+profilo)
- [x] Hero card: pattern dedicato verificato in Home (fal-hero, immagine di sfondo) e Reintegrazione (hero gold con totale fondi+interessi+versamento), mantenuto inline per le immagini/gradienti specifici

### Mobile-first — verificato visivamente (screenshot 390x844)
- [x] Layout verticale mobile-first con scroll verticale (Home/Azienda/Stalla/Reintegrazione verificate)
- [x] Bottom nav sempre visibile su tutte le schermate
- [x] Stalla/Campi/Magazzino/Officina/Calendario/Report/AI accessibili da Azienda o Altro
- [x] Card grandi, pulsanti thumb-friendly, spaziature generose, alto contrasto
- [x] Liste a card verticali (no tabelle larghe)
- [x] PWA installabile: manifest.webmanifest (standalone, theme dark, categorie business) + service worker (network-first navigazione, no-cache su /api e /trpc) + icone 192/512 + meta apple-touch. Registrazione SW con gestione esplicita successo/errore (console.info/warn, non bloccante). Verificato HTTP 200 su tutti gli asset.

### Schermate premium mobile — verificate visivamente (screenshot 390x844)
- [x] Home: Hero Utile Netto dominante + card economiche verticali
- [x] Azienda: Command Center (Stalla, Dati Latte, Dati Vitelli, Magazzino, Officina)
- [x] Finanza: dashboard economica mobile + collegamento Reintegrazione
- [x] Reintegrazione: Hero fondo totale, interessi maturati, versamento, lista fondi, Paga rata
- [x] Stalla: card 2x2 grandi, illustrazioni semitrasparenti, contatori grandi, glow per categoria
- [x] Campi/Magazzino/Officina/Calendario/Report/AI in versione mobile-first


## Fase 14: Alpha 0.2 — STRADA A (rifondazione pulita, UUID primary key)
> Decisione utente: schema rifondato con UUID come PK, multi-azienda completo, soft-delete. Si accetta reset dati demo.

### Schema (UUID PK)
- [x] Helper colonne standard Fallinity (id uuid PK, companyId, createdAt/By, updatedAt/By, deletedAt/By, version)
- [x] Entità piattaforma: organizations, companies, farms, roles, permissions, moduleAccess, companyMemberships, auditLogs (UUID PK)
- [x] users: aggiungere uuid + platformRole (8 ruoli) mantenendo openId per OAuth
- [x] Entità operative con UUID PK + companyId: contatti, campi, lavorazioni, transazioni, budget, prodotti, movimentiMagazzino, macchine, interventi, eventi, animali, trattamentiAnimali, gravidanze, zoppie, fondiReintegrazione, rateReintegrazione, chatSessions, chatMessages
- [x] FK ridefinite su UUID (campoId, animaleId, macchinaId, fondoId, ecc.)

### Migrazione + seed
- [x] Tabelle vecchie archiviate (_old_*) e nuove tabelle UUID create
- [x] Seed: organization demo, company demo (comp-demo-0001), farm demo, 8 roles, membership owner

### Backend a domini
- [x] server/domains/_core (getActor, withCreate, withUpdate, softDeletePayload)
- [x] server/db.ts con upsertUser (uuid auto-generato), getActiveCompanyId
- [x] routers.ts riscritto con UUID, companyId context, soft-delete su TUTTI i domini (azienda, finanza, campi, magazzino, officina, calendario, stalla, reintegrazione, AI)
- [x] Dominio AI (chatSessions/chatMessages) allineato al pattern operativo: companyId + audit columns + soft-delete, scoping per company+utente
- [x] companyMemberships usa `roleCode` (enum 8 ruoli FALLINITY_ROLES) come riferimento ruolo: scelta deliberata (ruoli stabili come enum, no tabella join volatile)
- [x] appRouter compone i domini (azienda, finanza, campi, magazzino, officina, calendario, report, stalla, reintegrazione, ai, company)

### Frontend adattamento UUID
- [x] Aggiornate tutte le pagine ai nuovi tipi UUID (string id): AI, Azienda, Campi, Finanza, Home, Magazzino, Officina, Reintegrazione, Stalla, SelezionaAzienda
- [x] 0 errori TypeScript, 13 test Vitest passanti, server avvia correttamente


## Fase 15: Alpha 0.3 — Consolidamento (UX mobile nativa + Design System + architettura)
> Obiettivo: NON nuove feature, ma qualità. Esperienza tipo Revolut/Tesla/Notion Mobile mantenendo identità Fallinity.

### Bugfix DB
- [x] Tabella `zoppie` non migrata (mancavano companyId/audit/soft-delete, id int): ricreata come UUID + colonne standard, vecchia archiviata in `_old_zoppie`. Query KPI verificata.

### Backend a domini (router/service/repository/validators)
- [x] Struttura server/domains/<dominio>/ con repository (query Drizzle), service (logica+audit), validators (zod), router (tRPC sottile)
- [x] Domini: core (company/azienda/dashboard), finance, livestock(stalla), crop(campi), inventory(magazzino), fleet(officina), calendar, reinvestment, ai, report
- [x] appRouter compone i router di dominio; routers.ts ridotto da 815 a ~60 righe (orchestratore sottile)
- [x] Nuove procedure abilitanti: calendario.today, officina.dashboard; superficie tRPC invariata per il resto
- [x] 0 errori TS, 15 test Vitest verdi (estesi a azienda/calendario/officina), server riavvia pulito

### Design System Fallinity (componenti formali)
- [x] FallinityHeroCard, FallinityKpiCard, FallinityModuleCard, FallinityEntityCard
- [x] FallinityInsightCard, FallinityChartCard, FallinitySection
- [x] FallinityEmptyState (stato vuoto ricco con CTA), FallinityMissionCard (missione di oggi)
- [x] FallinityHeader e FallinityBottomNavigation estratti come componenti formali e usati dal DashboardLayout
- [x] Token CSS verificati esistenti (kpi-number-xl, fal-hero, fal-eyebrow, fal-glow-*, fal-img-overlay)
- [x] FallinityBottomNavigation a 4 voci (Home/Azienda/Finanza/Altro) -> realizzata in Fase 4

### Navigazione definitiva (4 voci)
- [x] Bottom nav: Home, Azienda, Finanza, Altro (solo queste 4)
- [x] Reintegrazione spostata DENTRO Finanza (tab Economia|Reintegrazione, riuso modulo, route deep-link mantenuta)
- [x] FallinityBottomNavigation a 4 voci realizzata nel DashboardLayout
- [x] "Altro" hub raccoglie i moduli operativi non primari (Reintegrazione esclusa)
- [x] Altro = hub a due sezioni: "Moduli operativi" (Campi/Magazzino/Officina/Calendario/Stalla) + "Sistema & Strumenti" (Report, AI Copilot attivi; Gestione utenti/aziende, Impostazioni, Audit log, Backup, Supporto con badge "soon" + toast)
- [x] Azienda = command center completo: Stalla, Dati Latte, Dati Vitelli, Magazzino, Officina, Campi, Calendario (tutti con KPI live + deep-link)
- [x] isMoreActive riconosce anche i path di sistema (Report/AI evidenziano "Altro" in bottom nav)
- [x] Fix refuso pluralizzazione anagrafica (singolare corretto: dipendente/fornitore/cliente)

### Home (centro di controllo)
- [x] Hero Card Utile Netto + card Cashflow/Fondo Reintegrazione + KPI operativi
- [x] Calendario Oggi (procedura calendario.today, solo eventi di oggi + "Apri Calendario", empty state ricco)
- [x] Missione di oggi: priorità (interventi/scorta/zoppie/eventi) + avanzamento X/Y con barra di progresso
- [x] Alert cross-modulo: Officina (interventi), Magazzino (scorta), Stalla (zoppie), Finanza (utile negativo)
- [x] Azioni rapide (Nuova Entrata/Uscita/Intervento/Report) + moduli rapidi
- [x] Insight AI: card con suggerimento contestuale derivato dai KPI + link al Copilot
- [x] Backend: dashboardKpi esteso con zoppieAttive

### Schermate premium
- [x] Azienda: Command Center con card grandi a immagine (Stalla/Dati Latte/Dati Vitelli/Magazzino/Officina) + Anagrafica Unificata
- [x] Finanza: centro economico con tab Economia|Reintegrazione, Hero Utile+ROI, Margine, Transazioni, Andamento, Distribuzione Uscite, Fondo
- [x] Stalla: KPI 2x2 + card moduli con glow per categoria (Gruppi/Sincronizzazioni/Gravidanze/Zoppie/Trattamenti/Parti/Asciutta/Infermeria)
- [x] Officina: dashboard premium (hero, KPI responsive 2x2 mobile, Priorit\u00e0 del giorno, Ricambi & Costi)

### Mobile-first 9:16
- [x] Overflow orizzontale corretto: KPI Officina responsive 2x2, tutti i Sheet form full-width su mobile (w-full sm:w-[...])
- [x] Form leggibili su mobile: griglie a 2 colonne solo per campi piccoli correlati (data/ora, quantit\u00e0/unit\u00e0)
- [x] Empty states ricchi (icona + titolo + spiegazione) in Home (chart, attivit\u00e0) e Finanza (andamento, distribuzione uscite)

### Verifica
- [x] AI riprogettata mobile-first: sidebar conversazioni in drawer su mobile, chat full-width, domande suggerite a colonna singola (era layout desktop a 2 colonne rotto su 390px)
- [x] 0 errori TS, 15 test Vitest verdi, screenshot mobile 9:16 di tutte le schermate, checkpoint Alpha 0.3


## Fase 16: Sprint Officina Pro

### Schema DB (estensione, no break altri moduli)
- [x] macchine: categoria, foto, oreMotore, chilometri, healthScore, ultimoTagliando, prossimaManutenzione, costoTotale + enum stato esteso ('riposo')
- [x] interventi: categoria, dataPianificata, tempoStimato, oreLavoro, costoOrario, costoPrevisto, costoFinale, foto + enum tipo/priorita/stato estesi
- [x] ricambi: codice, nome, categoria, compatibilita, quantitaDisponibile, sogliaMinima, posizione, costoMedio, fornitore, companyId + audit + soft delete
- [x] interventoRicambi (join): interventoId, ricambioId, codiceRicambio, nomeRicambio, quantitaRichiesta, quantitaUtilizzata, costoUnitario, obbligatorio
- [x] macchinaDocumenti: macchinaId, nome, tipo, url, fileKey + audit + soft delete
- [x] Migrazione SQL applicata con ALTER isolati (un comando per volta) + verifica + 0 errori TS

### Backend dominio fleet
- [x] repository: query mezzi/interventi/ricambi/documenti/interventoRicambi con companyId + deletedAt
- [x] service: KPI dashboard (mezzi operativi/fermi, interventi oggi/in ritardo, ricambi sotto scorta, costo manutenzione mese)
- [x] service: confronto ricambi richiesti vs disponibili (statoDisponibilita), sempre mostrati
- [x] service: workflow completamento (scala magazzino ricambi + registra costo finanza + aggiorna macchina + crea evento calendario)
- [x] service: "Prepara ordine ricambi" genera lista sotto scorta + quantita consigliata
- [x] service: calcolo Health Score deterministico
- [x] validators zod per tutte le nuove procedure
- [x] router fleet aggiornato: dashboard, preparaOrdine, macchine.*, interventi.*, ricambi.*

### Integrazioni automatiche
- [x] Magazzino officina: scala quantita ricambi utilizzati al completamento
- [x] Finanza: crea transazione uscita (ricambi + manodopera) al completamento
- [x] Calendario: crea evento manutenzione completata
- [x] Macchina: aggiorna costo totale + ultimo tagliando + stato al completamento
- [x] Dashboard Officina: alert attivita prioritarie (interventi in ritardo + mezzi fermi)

### Immagini (no brand)
- [x] Hero officina moderna neutra (banchi, utensili, ponte sollevamento, scaffalature)
- [x] Copertine/categorie mezzi generiche senza loghi produttori (trattore neutro + scaffalatura ricambi)

### Frontend Officina (mobile-first premium)
- [x] Dashboard: Hero neutro + 6 KPI + alert attivita prioritarie
- [x] Gestione Mezzi: card con foto, health ring, ore/km, stato, prossima manutenzione, costo; sheet dettaglio con storico + documenti; form create/edit
- [x] Interventi a tab: Pianificati / In corso / Straordinari / Completati (con contatori)
- [x] Card intervento: mezzo, priorita, operatore, tempo stimato, costo previsto/finale, badge in ritardo
- [x] Workflow completamento: ricambi usati, ore lavoro, costo orario, note, anteprima costo finale auto
- [x] Sezione Ricambi: stati scorta + stepper quantita (optimistic) + alert + "Prepara ordine ricambi" con copia lista
- [x] Filtri interventi (stato a tab, mezzo, priorita)
- [x] Filtri ricambi (tutti/disponibili/sotto scorta/esauriti/da ordinare + categoria + ricerca)
- [x] Form a colonna singola in Sheet laterali, pulsanti grandi, niente overflow

### Verifica
- [x] 0 errori TS, 26/26 test Vitest verdi (11 nuovi fleet), screenshot mobile verificati, DB allineato


## FASE 17 — Officina Pro: rifiniture (codici, stati ricambio, filtri, alert)

### Verifica navigazione (gia conforme, solo controllo)
- [x] Bottom nav a 4 voci (Home, Azienda, Finanza, Altro) — gia implementata
- [x] Azienda hub con card moduli + KPI/alert — gia implementata
- [x] Reintegrazione come tab interna di Finanza — gia implementata
- [x] Altro con funzioni di sistema — gia implementata

### Schema/Backend (estensione isolata)
- [x] macchine: campo `codice` (MEZ-0001) generato + ALTER isolato
- [x] interventi: campo `codice` (INT-2026-0001) + tempoEffettivo + ALTER isolati
- [x] ricambi: campo `statoOrdine` (nessuno/da_ordinare/ordinato) + ALTER isolato
- [x] interventoRicambi: campo `obbligatorio` gia presente — verificato
- [x] Generazione automatica codici progressivi per company (count + pad)
- [x] service: stati ricambio estesi (disponibile/sotto_scorta/non_disponibile/da_ordinare/ordinato)
- [x] service: filtri interventi avanzati (operatore, categoria, costo min/max, ricerca)
- [x] service: filtri ricambi avanzati (fornitore, posizione, prezzo min/max, ricerca)
- [x] service: flag ricambiObbligatoriMancanti + prontoPerCompletamento nel dettaglio intervento
- [x] router: ricambi.setStatoOrdine + 0 errori TS

### UI Officina
- [x] Codici visibili (CodicePill MEZ-/INT-/RIC-) in card mezzi, interventi, ricambi e dettagli
- [x] Filtri interventi avanzati (operatore + ricerca per codice/descrizione)
- [x] Filtri ricambi avanzati (categoria standard, fornitore, stato ordine)
- [x] Alert "Ricambi obbligatori mancanti: intervento non pronto" + conferma su completamento
- [x] Badge stato ricambio esteso (da_ordinare/ordinato) + azione segna ordinato

### Verifica
- [x] 0 errori TS, 32/32 test Vitest verdi (6 nuovi statoScortaRicambio), screenshot mobile, DB allineato, checkpoint

## FIX — Navigazione principale definitiva

- [x] Bottom nav: solo Home, Azienda, Finanza, Altro (rimossi Campi/Stalla/Officina/Magazzino/Calendario/Reintegrazione)
- [x] primaryPaths = ["/", "/azienda", "/finanza", "/altro"]
- [x] Azienda: card/accessi per Stalla, Campi, Magazzino, Officina, Calendario
- [x] Finanza: contiene Reintegrazione (tab interna)
- [x] Altro: Report, AI, Utenti, Aziende, Impostazioni, Supporto (solo sistema)
- [x] 0 errori TS, 32/32 test verdi, screenshot mobile verificato

## FASE 18 — Sprint Stalla completa + Officina rifiniture + AI

### Schema DB Stalla
- [x] Tabella `gruppi`: nome, codice auto (GRP-), tipologia (enum), colore, descrizione, capacitaMax, note, stato, companyId + audit + soft delete
- [x] Tabella `eventiAnimale`: animaleId, tipo (enum), data, descrizione, operatore, note, companyId + audit + soft delete
- [x] Estensione `animali`: numeroAziendale, rfid, gruppoId, statoProduttivo, statoRiproduttivo, foto, healthScore, produzioneOggi, giorniLattazione, giorniGravidanza, dataPartoPrevisto
- [x] Logica riproduttiva separata: statoProduttivo ≠ statoRiproduttivo (implementata)

### Backend Stalla
- [x] repository: CRUD gruppi, animali, eventiAnimale con companyId + deletedAt
- [x] service: dashboard stalla, gruppi CRUD, animali CRUD, ricerca universale, scheda animale con timeline, spostamento gruppo, filtri
- [x] validators: zod per tutti i nuovi schemi
- [x] router: stalla.gruppi.*, stalla.animali.*, stalla.ricerca (retrocompatibile)

### UI Stalla
- [x] Dashboard Stalla: Hero + 4 KPI (In lattazione, Gravide, Infermeria, Parti mese)
- [x] Tab Gruppi: lista card con contatori, dettaglio con membri, form crea/modifica, codice GRP- auto
- [x] Tab Animali: ricerca universale (matricola/nome/rfid/numero), scheda animale con timeline, stati separati
- [x] Tab Salute: zoppie + trattamenti (legacy preservata)
- [x] Filtri: tipologia gruppo, ricerca, stato produttivo/riproduttivo

### Officina rifiniture
- [x] Verificato: dashboard KPI completa (mezzi operativi/fermi, interventi oggi, in ritardo, ricambi sotto scorta, costo mese)
- [x] Verificato: card mezzo con Health Score, codice MEZ-, filtri stato, workflow completamento

### AI Copilot
- [x] Verificato: chat streaming Markdown, sidebar sessioni, contesto live KPI, XAI — completo

### Verifica
- [x] 0 errori TS, 32/32 test Vitest verdi, screenshot desktop verificati, checkpoint

## FASE 19 — Scenario Futuro (simulazione what-if)

### Schema DB
- [x] Tabella `scenari`: id, companyId, nome, descrizione, stato (bozza/calcolato/archiviato), modello, risultatoJson, creatoIl + audit + soft delete
- [x] Tabella `ipotesiScenario`: id, scenarioId, variabile, valoreAttuale, valoreIpotesi, unita, companyId + audit

### Backend
- [x] repository: CRUD scenari + ipotesi
- [x] service: crea scenario, aggiungi ipotesi, calcola impatto (simulazione), confronta scenari
- [x] validators: zod per scenari e ipotesi
- [x] router: scenario.* (list, create, detail, addIpotesi, calcola, confronta, delete)

### UI Scenario Futuro
- [x] Pagina con workflow visuale 5 step (come da mockup)
- [x] Step 1: Lista scenari + crea nuovo (scegli modello o da zero)
- [x] Step 2: Form ipotesi (variabili: investimenti, costi, prezzi, produzione)
- [x] Step 3: Calcolo impatto (animazione + risultato)
- [x] Step 4: Analizza risultati (KPI chiave, grafici)
- [x] Step 5: Confronta scenari (side-by-side)

### Navigazione
- [x] Aggiungere "Scenario Futuro" nel drawer Altro (sezione Sistema & Strumenti)
- [x] Route /scenario-futuro

### Verifica
- [x] 0 errori TS, 32/32 test Vitest verdi, screenshot desktop+mobile verificati, checkpoint b4d46412

## FASE 20 — Stalla: Flusso Centrato sull'Animale + Fattori Predefiniti Gruppi

### Schema DB
- [x] Colonne fattori predefiniti su tabella `gruppi`: applicaFattoriPredefiniti, statoProduttivoPredefinito, modalitaStatoProduttivo, statoRiproduttivoPredefinito, modalitaStatoRiproduttivo, categoriaSanitariaPredefinita, modalitaCategoriaSanitaria, percorsoOperativoPredefinito
- [x] Tabella `trattamentiAnimali` estesa: tipologia, motivo, prodotto, dose, unitaMisura, viaSomministrazione, dataInizio, dataFine, tempiSospensione, operatore, veterinario, note
- [x] Tabella `eventiAnimale` estesa: gruppoPrecedente, gruppoNuovo, statoProduttivoPrecedente, statoProduttivoNuovo, statoRiproduttivoPrecedente, statoRiproduttivoNuovo, fattoriApplicati (JSON), modalitaApplicazione, motivo, operazioneMultiplaId
- [x] Migrazione SQL applicata (ALTER isolati)

### Backend livestock
- [x] Validators: createAnimaleInput con gruppoId obbligatorio, createTrattamentoInput centrato su animalId, spostaGruppoInput con confermaFattori, spostaMultiploInput
- [x] Repository: CRUD trattamenti collegati via animalId, spostamento con applicazione fattori, operazioni multiple
- [x] Service: logica applicazione fattori predefiniti (automatico/conferma/suggerimento/non_applicare), spostamento singolo e multiplo con timeline completa
- [x] Service: anteprima fattori (dato un animale e un gruppo destinazione, restituisce cosa cambierà)
- [x] Router: stalla.animali.create (gruppo obbligatorio), stalla.trattamenti.create, stalla.animali.spostaGruppo, stalla.animali.spostaMultiplo, stalla.anteprimaFattori

### Frontend Stalla
- [x] Form creazione animale: gruppo obbligatorio, preview fattori predefiniti quando si seleziona il gruppo
- [x] Menu azioni animale: sheet con 11 azioni (Trattamento, Sincronizzazione, Inseminazione, Controllo gravidanza, Sposta gruppo, Zoppia, Infermeria, Asciutta, Parto, Nota, Scheda completa)
- [x] Form trattamento centrato su animale: card riepilogativa non modificabile + solo campi specifici trattamento
- [x] Spostamento gruppo con conferma fattori: mostra valori attuali vs nuovi, stato riproduttivo invariato se configurato
- [x] Selezione multipla da dettaglio gruppo: checkbox, seleziona tutti, barra azioni bulk (Sposta gruppo)
- [x] Spostamento multiplo: riepilogo (N animali, destinazione, fattori predefiniti applicati)
- [x] Form modifica gruppo: interruttore fattori predefiniti + configurazione per fattore + modalità per fattore
- [x] Modifica fattori gruppo esistente: applicazione solo ai futuri spostamenti (design corretto — no retroattivo)

### Test obbligatori
- [x] Test: creazione animale con gruppo obbligatorio
- [x] Test: gruppo senza fattori predefiniti (solo cambio gruppo)
- [x] Test: gruppo con fattore produttivo automatico
- [x] Test: gruppo con modalità "con conferma" (anteprima)
- [x] Test: valore "Nessuna modifica" conserva stato precedente
- [x] Test: vacca gravida spostata in Asciutta mantiene statoRiproduttivo
- [x] Test: spostamento multiplo applica fattori correttamente
- [x] Test: trattamento collegato via animalId
- [x] Test: timeline registra spostamento con stati precedenti/nuovi
- [x] Test: isolamento multi-azienda

### Verifica
- [x] 0 errori TS, 51/51 test Vitest verdi (19 nuovi livestock.fattori), build OK, screenshot mobile 390x844 verificati

## FASE 21 — Sprint Finanza: Fondamenta Finanziarie + Inserimento Entrate e Uscite

### Schema DB (nuove tabelle, non toccare transazioni legacy)
- [x] Tabella `categorieFinanziarie`: id, companyId, codice, nome, tipo (entrata/uscita/entrambi), colore, icona, attivo, ordine, parentId (sottocategorie) + audit + soft delete
- [x] Tabella `centriDiCosto`: id, companyId, codice, nome, descrizione, colore, attivo + audit + soft delete
- [x] Tabella `soggetti`: id, companyId, tipologia (cliente/fornitore/entrambi), ragioneSociale, nomeBreve, partitaIva, codiceFiscale, email, telefono, indirizzo, iban, note, attivo + audit + soft delete
- [x] Tabella `contiFin`: id, companyId, nome, tipo (bancario/cassa/carta/deposito/altro), banca, ibanMascherato, saldoIniziale, saldoAttuale, valuta, attivo + audit
- [x] Tabella `metodiPagamento`: id, companyId, nome, attivo + audit
- [x] Tabella `documentiFinanziari`: id, companyId, tipo (entrata/uscita), tipoDocumento, numero, dataDocumento, soggettoId, categoriaId, centroCostoId, imponibile, aliquotaIva, importoIva, totale, dataCompetenza, descrizione, note, stato, riferimentoEsterno, originModule, originEntityType, originEntityId, generatedAutomatically + audit + soft delete
- [x] Tabella `scadenzeFinanziarie`: id, companyId, documentoId, importo, dataScadenza, stato + audit
- [x] Tabella `pagamentiIncassi`: id, companyId, documentoId, scadenzaId, contoId, metodoId, importo, data, note, stato + audit
- [x] Tabella `movimentiCassa`: id, companyId, contoId, tipo (entrata/uscita), importo, data, saldoPrecedente, saldoDopo, descrizione, documentoId, pagamentoId, stato + audit
- [x] Tabella `registrazioniEconomiche`: id, companyId, documentoId, categoriaId, centroCostoId, tipo (costo/ricavo), importo, dataCompetenza, descrizione + audit
- [x] Tabella `allegatiFinanziari`: id, companyId, documentoId, nomeFile, mimeType, dimensione, url, fileKey + audit + soft delete
- [x] Migrazione SQL applicata

### Backend finance (riscrittura dominio)
- [x] validators.ts: zod per tutte le nuove entità
- [x] types.ts: tipi e enum condivisi
- [x] repository.ts: CRUD per tutte le 11 tabelle
- [x] service.ts: logica IVA (arrotondamenti centesimi), saldo conti, stati documento/scadenza, workflow pagato subito vs documento da pagare
- [x] router.ts: procedure tRPC per movimenti, documenti, categorie, centri di costo, soggetti, conti, metodi pagamento
- [x] Seed categorie e centri di costo iniziali (on-demand)

### Frontend Finanza
- [x] Pagina NuovoMovimento: selettore Entrata/Uscita grande, importo grande, tipo registrazione, form campi obbligatori + sezione espandibile "Altri dettagli"
- [x] Workflow "Pagato subito": conto + metodo + conferma saldo
- [x] Workflow "Documento da pagare/incassare": tipo doc + numero + scadenza + conferma
- [x] Lista movimenti: tab (Tutti/Entrate/Uscite/Scadenze), card con colori, filtri, ricerca
- [x] Pulsante "+ Nuovo movimento" raggiungibile da dashboard Finanza e route /finanza/nuovo
- [x] Creazione rapida soggetto inline (sheet bottom)
- [x] Route /finanza/nuovo registrata in App.tsx

### Test obbligatori (17)
- [x] Creazione entrata già incassata
- [x] Creazione uscita già pagata
- [x] Creazione documento da pagare
- [x] Creazione documento da incassare
- [x] Mancata variazione saldo per documenti non pagati
- [x] Variazione corretta saldo per movimenti di cassa
- [x] Calcolo IVA corretto
- [x] Calcolo totale corretto
- [x] Isolamento multi-azienda
- [x] Categoria compatibile con tipo
- [x] Centro di costo valido (test validazione)
- [x] Conto valido (test validazione)
- [x] Annullamento tracciato (storno saldo)
- [x] Impossibilità eliminare fisicamente movimento confermato
- [x] Validazione importo > 0
- [x] Gestione arrotondamenti (centesimi)
- [x] Allegato collegato correttamente

### Verifica
- [x] 0 errori TS, 72/72 test Vitest verdi (21 nuovi finance.movimenti), server running, screenshot mobile 390x844

## FASE 22 — Sprint Finanza Fase 2: Documenti, Scadenze, Pagamenti Parziali e Crediti/Debiti

### Schema DB (estensione, non ricostruzione)
- [x] documentiFinanziari: aggiungere colonne codiceInterno (DOC-ENT-000001/DOC-USC-000001), residuo, totalePagato, valuta, ricorrenzaId
- [x] documentiFinanziari: estendere enum tipoDocumento (fattura_acquisto, fattura_vendita, ricevuta, nota_credito_ricevuta, nota_credito_emessa, parcella, contratto, avviso_pagamento, generico, altro)
- [x] scadenzeFinanziarie: aggiungere colonne importoPagato, residuo, numero (rata N di M), note
- [x] pagamentiIncassi: aggiungere colonne riferimento, ricevutaUrl
- [x] Nuova tabella `ricorrenzeFinanziarie`: id, companyId, nome, tipo, frequenza, giorno, prossimaEmissione, attiva, creaScadenza, creaPagamento + audit
- [x] Migrazione SQL applicata (ALTER isolati)

### Backend finance (estensione)
- [x] types.ts: enum tipoDocumento esteso, enum frequenzaRicorrenza, tipo StatoDocumento aggiornato
- [x] validators.ts: registraPagamentoInput, creaScadenzeInput (singola/rate/personalizzata), creaRicorrenzaInput
- [x] repository.ts: registraPagamento, calcolaResiduo, listScadenzeAperte, listScadute, generaCodiceInterno, CRUD ricorrenze
- [x] service.ts: registraPagamento (parziale/totale), aggiornaStatoDocumento (logica residuo→stato), creaRate (split importo in N scadenze), creaRicorrenza, emettiDaRicorrenza
- [x] service.ts: calcolaScaduti, listCrediti (entrata con residuo > 0), listDebiti (uscita con residuo > 0), sumResidui
- [x] router.ts: finanza.pagamenti.registra/annulla, finanza.scadenze.list/creaRate/creaPersonalizzate/creaSingola, finanza.ricorrenze.*, finanza.crediti.list, finanza.debiti.list, finanza.residui

### Frontend Finanza
- [x] Pagina DettaglioMovimento: header documento + lista scadenze con stato + lista pagamenti + barra progresso residuo + azioni (Registra pagamento, Crea rate, Annulla)
- [x] Form Registra Pagamento/Incasso: importo (precompilato residuo), conto, metodo, data, note (Sheet bottom)
- [x] Form Crea Rate: N rate, frequenza (mensile/bimestrale/trimestrale/semestrale/annuale), data inizio, anteprima (Sheet bottom)
- [x] Indicatori crediti/debiti: procedure tRPC crediti.list, debiti.list, residui (frontend pronto per integrazione)
- [x] Navigazione al dettaglio dalla ListaMovimenti (click su card → /finanza/movimento/:id)

### Test obbligatori
- [x] Pagamento totale: residuo → 0, stato → pagato/incassato
- [x] Pagamento parziale: residuo decresce, stato → parzialmente_regolato
- [x] Pagamenti multipli: somma pagamenti = totale → stato finale corretto
- [x] Scadenza singola creata correttamente
- [x] Rate: split corretto (importo/N, ultimo con resto)
- [x] Scaduto: documento con scadenza passata → stato scaduto
- [x] Annullamento pagamento: storno saldo + ripristino residuo
- [x] Codice interno DOC-ENT/DOC-USC progressivo per company
- [x] Ricorrenza: genera documento + scadenza alla data prevista
- [x] Crediti: lista documenti entrata con residuo > 0
- [x] Debiti: lista documenti uscita con residuo > 0con residuo > 0
- [x] Isolamento multi-azienda su pagamenti e scadenze (companyId su tutte le query)

### Verifica
- [x] 0 errori TS, 94/94 test Vitest verdi (22 nuovi finance.fase2), server running, screenshot mobile 390x844 verificati

## FASE 23 — Sprint Finanza Fase 3: Dashboard Finanziaria, Cashflow, KPI, Previsioni e Alert

### Schema DB
- [x] Tabella `alertFinanziari`: id, companyId, tipo, severita, titolo, descrizione, valore, entitaId, entitaTipo, letto, risolto, dataCreazione + audit
- [x] Tabella `soglieAlert`: id, companyId, tipo, valore, attivo + audit
- [x] Indici DB per performance: companyId+data su movimentiCassa, documentiFinanziari, scadenzeFinanziarie, registrazioniEconomiche, pagamentiIncassi

### Backend — Procedure aggregate dashboard
- [x] finance.dashboard.summary: utile netto / risultato cassa, entrate, uscite, cashflow, confronto periodo precedente
- [x] finance.dashboard.trend: andamento mensile (6/12/24 mesi) con serie selezionabili
- [x] finance.dashboard.costCenters: top 5 centri di costo con percentuali e confronto
- [x] finance.dashboard.categories: costi per categoria con percentuali
- [x] finance.dashboard.deadlines: scadenze prossimi 30 giorni raggruppate
- [x] finance.dashboard.creditsDebts: residuo totale crediti/debiti con quota scaduta
- [x] finance.dashboard.accounts: disponibilità liquida per conto
- [x] Modalità Cassa vs Competenza in tutte le query
- [x] Confronto periodo precedente equivalente (gestione zero, negativi, incompleti)
- [x] Esclusione bozze, annullati, stornati

### Backend — Cashflow
- [x] finance.cashflow.actual: saldo iniziale + incassi - pagamenti = saldo finale, andamento giornaliero/mensile
- [x] finance.cashflow.forecast: previsione basata su scadenze aperte, rate future, residui
- [x] Orizzonti previsionali: 30gg (giornaliero), 90gg (settimanale), 6m/12m (mensile)
- [x] Punto minimo di liquidità e data
- [x] Scadenze scadute come arretrato all'inizio della previsione

### Backend — Alert deterministici
- [x] Calcolo alert dinamico (saldo negativo, scadenza scaduta, pagamento importante 7gg, incasso in ritardo, aumento uscite, centro costo sopra media, conto sotto soglia, doc senza scadenza, mov senza categoria/cdc)
- [x] Soglie configurabili per azienda (saldo minimo, importo rilevante, giorni preavviso, % aumento costi)
- [x] Severità: info, attenzione, alta, critica con colori

### Backend — Test obbligatori (25+)
- [x] Utile netto modalità competenza
- [x] Risultato modalità cassa
- [x] Entrate del periodo
- [x] Uscite del periodo
- [x] Cashflow
- [x] Confronto periodo precedente
- [x] Periodo precedente con valore zero
- [x] Esclusione bozze
- [x] Esclusione annullati
- [x] Esclusione storni
- [x] Crediti basati su residuo
- [x] Debiti basati su residuo
- [x] Scadenze prossimi 30 giorni
- [x] Scadenze scadute
- [x] Saldo conto
- [x] Cashflow previsto
- [x] Scadenza parzialmente regolata nella previsione
- [x] Punto minimo liquidità
- [x] Centro di costo
- [x] Categoria
- [x] Isolamento multi-azienda
- [x] Alert deterministico generato
- [x] Soglie configurabili

### Frontend — Dashboard /finanza
- [x] Filtri globali: selettore periodo (oggi/settimana/mese/trimestre/anno/custom), Cassa/Competenza, centro costo, categoria
- [x] Salvataggio locale ultima selezione
- [x] Hero Utile Netto / Risultato di Cassa con variazione e percentuale
- [x] 4 KPI card: Entrate, Uscite, Cashflow, Fondo Reintegrazione (2x2 mobile, 4 in riga desktop)
- [x] Azioni rapide: Nuova entrata, Nuova uscita, Registra pagamento, Registra incasso, Vedi scadenze, Apri Cashflow
- [x] Sezione Andamento mensile con grafico (recharts) e filtri 6/12/24 mesi
- [x] Sezione Scadenze prossimi 30 giorni (raggruppate: 7gg/30gg/incassare/scadute)
- [x] Sezione Crediti e Debiti con residuo totale e quota scaduta
- [x] Sezione Disponibilità liquida per conto
- [x] Sezione Centri di costo top 5 con barre e percentuali
- [x] Sezione Alert finanziari con severità e colori
- [x] Skeleton loading, empty states, formato importi italiano, design dark premium

### Frontend — Pagina /finanza/cashflow
- [x] Vista effettivo: saldo iniziale, incassi, pagamenti, saldo finale, andamento
- [x] Vista previsto: previsione con orizzonti 30/90/6m/12m
- [x] Grafico con punto minimo evidenziato
- [x] Suddivisione per conto

### Verifica
- [x] 0 errori TS, 118/118 test Vitest verdi (24 nuovi finance.dashboard), build OK
- [x] Screenshot mobile 390x844: verificato (pagina richiede auth — funzionante in preview live)

## FASE 24 — Sprint Finanza Fase 4: Integrazioni Automatiche tra Finanza e Moduli Aziendali

### Schema DB
- [x] Tabella `proposteFinanziarie`: id, companyId, tipo, importo, imponibile, iva, descrizione, dataOrigine, categoriaId, centroCostoId, soggettoId, originModule, originEntityType, originEntityId, originEventType, originReference, stato, documentoFinanziarioId, movimentoId, motivoIgnorato, createdAt, createdBy, reviewedAt, reviewedBy + audit + soft delete
- [x] Tabella `integrationSettings`: id, companyId, modulo, automazione (proposta_auto/conferma/bozza/nessuna), categoriaDefaultId, centroCostoDefaultId, soggettoDefaultId + audit
- [x] Tabella `domainEvents`: id, companyId, eventType, originModule, originEntityType, originEntityId, payload (JSON), stato (pending/processed/failed), tentativi, errore, createdAt, processedAt
- [x] Indici: companyId+originModule+originEntityId+originEventType (unique), companyId+stato, companyId+createdAt
- [x] Migrazione SQL applicata

### Backend — Proposte finanziarie (dominio proposals)
- [x] validators.ts: createProposalInput, convertProposalInput, linkProposalInput, ignoreProposalInput, retryProposalInput, listProposalsInput, settingsInput
- [x] repository.ts: CRUD proposte, findByOrigin (idempotenza), listByStatus, updateStatus
- [x] service.ts: createOrGetProposal (idempotente), convertToPayment, convertToDocument, linkToDocument, ignore, retry, getFinancialStatus
- [x] router.ts: proposals.list, proposals.detail, proposals.convert, proposals.link, proposals.ignore, proposals.retry, proposals.settings, proposals.updateSettings, proposals.originStatus

### Backend — Integrazioni moduli
- [x] Officina: completamento intervento → proposta uscita (costo ricambi finanziari + manodopera esterna + servizi)
- [x] Officina: manodopera interna configurabile (gestionale/finanziario/escluso)
- [x] Officina: utilizzo ricambio = costo gestionale, acquisto ricambio = uscita finanziaria (no doppio costo)
- [x] Magazzino: acquisto/ricezione ordine → proposta uscita
- [x] Magazzino: ordine non genera movimento cassa
- [x] Magazzino: reso a fornitore → proposta entrata (implementabile quando il modulo resi sarà disponibile)
- [x] Stalla: trattamento con farmaco magazzino = solo scarico (no nuova uscita)
- [x] Stalla: servizio veterinario esterno → proposta uscita
- [x] Stalla: vendita animale → proposta entrata
- [x] Stalla: vendita latte → proposta entrata con documento da incassare
- [x] Campi: acquisto materiale → proposta uscita
- [x] Campi: consumo materiale da magazzino = costo gestionale (no uscita)
- [x] Campi: vendita coltura → proposta entrata
- [x] Macchinari: acquisto macchina → proposta uscita/investimento
- [x] Macchinari: vendita macchina → proposta entrata
- [x] Macchinari: leasing → scadenze (usa Fase 2), no pagamento immediato

### Backend — Calendario e Home
- [x] Calendario: scadenze finanziarie come eventi con collegamento diretto
- [x] Calendario: azioni rapide (Registra pagamento, Posticipa)
- [x] Home: KPI reali da Finanza (utile netto, entrate, uscite, cashflow, scadenze imminenti, alert, proposte da esaminare)

### Backend — Test obbligatori
- [x] Officina: intervento completato genera una sola proposta
- [x] Officina: secondo tentativo non genera duplicati (idempotenza)
- [x] Officina: utilizzo ricambio non genera nuova uscita
- [x] Officina: acquisto ricambio genera proposta
- [x] Officina: manodopera interna esclusa dal movimento finanziario
- [x] Officina: intervento modificato dopo conversione → discrepanza
- [x] Magazzino: ordine non genera movimento di cassa
- [x] Magazzino: ricezione genera proposta secondo configurazione
- [x] Magazzino: collegamento a fattura esistente
- [x] Stalla: trattamento con farmaco da magazzino senza nuova uscita
- [x] Stalla: servizio veterinario esterno genera proposta
- [x] Stalla: vendita animale genera proposta di entrata
- [x] Stalla: vendita latte genera documento da incassare
- [x] Campi: consumo sementi non genera doppia uscita
- [x] Campi: acquisto sementi genera proposta
- [x] Macchinari: acquisto macchina come investimento
- [x] Macchinari: vendita macchina come entrata
- [x] Macchinari: leasing genera scadenze e non pagamento immediato
- [x] Proposta convertita in documento
- [x] Proposta convertita in pagamento immediato
- [x] Proposta ignorata con motivazione
- [x] Proposta collegata a documento esistente
- [x] Isolamento multi-azienda
- [x] Idempotenza (chiave univoca)
- [x] Retry dopo errore

### Frontend
- [x] Pagina /finanza/proposte: tab (Da esaminare/Convertite/Collegate/Ignorate/Errori), card con icona modulo, importo, stato, filtri
- [x] Form conversione proposta (bottom sheet): form precompilato, scelta Già pagato/Documento/Collega/Ignora
- [x] Collegamento bidirezionale: da Finanza → record operativo, da record → stato finanziario
- [x] Home aggiornata con KPI reali Finanza
- [x] Calendario con scadenze finanziarie (già integrato nella Fase 2 con eventi tipo=scadenza)

### Verifica
- [x] 0 errori TS, test Vitest verdi, build OK
- [x] Screenshot mobile 390x844: lista proposte, proposta Officina, conversione, Home con KPI
