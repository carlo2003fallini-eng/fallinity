import { and, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  acquisizioniFatture,
  allegatiFinanziari,
  documentiFinanziari,
  movimentiMagazzino,
  prodotti,
  regoleClassificazioneFatture,
  registrazioniEconomiche,
  righeFattureAcquisite,
  scadenzeFinanziarie,
  soggetti,
} from "../../../drizzle/schema";
import { newId, withCreate, withUpdate, type ActorContext } from "../_core";
import type { ListArchivioFattureInput } from "./validators";

export type RigaConfermaPreparata = {
  rigaId: string;
  categoriaId: string;
  centroCostoId: string | null;
  destinazione: "costo" | "magazzino" | "investimento" | "altro";
  aggiornaMagazzino: boolean;
  prodottoId: string | null;
  creaProdotto: boolean;
  nomeProdotto: string | null;
  quantita: string | null;
  unitaMisura: string | null;
  codiceArticolo: string | null;
  descrizione: string;
  prezzoUnitario: number;
  importoEconomico: number;
  chiaveRegola: string;
  descrizioneNormalizzata: string;
};

export type ConfermaFatturaPreparata = {
  acquisizioneId: string;
  soggettoId: string | null;
  categoriaId: string;
  centroCostoId: string | null;
  dataCompetenza: string;
  descrizione: string;
  note: string | null;
  aliquotaIvaPrevalente: number;
  tipoDocumentoFinanziario: string;
  confermaDuplicato: boolean;
  scadenze: Array<{ dataScadenza: string; importo: number; note?: string }>;
  righe: RigaConfermaPreparata[];
};

export const invoiceRepository = {
  async listAcquisitions(companyId: string, input: ListArchivioFattureInput) {
    const db = await getDb();
    if (!db) return { items: [], total: 0, hasMore: false };
    const conditions = [
      eq(acquisizioniFatture.companyId, companyId),
      isNull(acquisizioniFatture.deletedAt),
    ];
    if (input.stati?.length) conditions.push(inArray(acquisizioniFatture.stato, input.stati));
    if (input.dataDa) conditions.push(gte(acquisizioniFatture.dataDocumento, input.dataDa as any));
    if (input.dataA) conditions.push(lte(acquisizioniFatture.dataDocumento, input.dataA as any));
    if (input.totaleMin !== undefined) conditions.push(gte(acquisizioniFatture.totale, input.totaleMin));
    if (input.totaleMax !== undefined) conditions.push(lte(acquisizioniFatture.totale, input.totaleMax));
    if (input.conPossibileDuplicato === true) conditions.push(isNotNull(acquisizioniFatture.duplicatoDocumentoId));
    if (input.conPossibileDuplicato === false) conditions.push(isNull(acquisizioniFatture.duplicatoDocumentoId));
    if (input.conAvvisi === true) conditions.push(sql`JSON_LENGTH(${acquisizioniFatture.avvisiJson}) > 0`);
    if (input.conAvvisi === false) conditions.push(or(isNull(acquisizioniFatture.avvisiJson), sql`JSON_LENGTH(${acquisizioniFatture.avvisiJson}) = 0`)!);
    const search = input.search?.trim();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      conditions.push(or(
        like(acquisizioniFatture.fornitoreRagioneSociale, pattern),
        like(acquisizioniFatture.fornitorePartitaIva, pattern),
        like(acquisizioniFatture.fornitoreCodiceFiscale, pattern),
        like(acquisizioniFatture.numeroDocumento, pattern),
        like(acquisizioniFatture.nomeFile, pattern),
      )!);
    }
    const where = and(...conditions);
    const [items, totals] = await Promise.all([
      db.select({
        id: acquisizioniFatture.id,
        stato: acquisizioniFatture.stato,
        nomeFile: acquisizioniFatture.nomeFile,
        numeroDocumento: acquisizioniFatture.numeroDocumento,
        dataDocumento: acquisizioniFatture.dataDocumento,
        valuta: acquisizioniFatture.valuta,
        tipoDocumento: acquisizioniFatture.tipoDocumento,
        fornitoreRagioneSociale: acquisizioniFatture.fornitoreRagioneSociale,
        fornitorePartitaIva: acquisizioniFatture.fornitorePartitaIva,
        totale: acquisizioniFatture.totale,
        importoIva: acquisizioniFatture.importoIva,
        avvisiJson: acquisizioniFatture.avvisiJson,
        duplicatoDocumentoId: acquisizioniFatture.duplicatoDocumentoId,
        documentoFinanziarioId: acquisizioniFatture.documentoFinanziarioId,
        confermataAt: acquisizioniFatture.confermataAt,
        errore: acquisizioniFatture.errore,
        createdAt: acquisizioniFatture.createdAt,
      }).from(acquisizioniFatture).where(where)
        .orderBy(desc(acquisizioniFatture.dataDocumento), desc(acquisizioniFatture.createdAt))
        .limit(input.limit).offset(input.offset),
      db.select({ total: count() }).from(acquisizioniFatture).where(where),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    return { items, total, hasMore: input.offset + items.length < total };
  },

  async findByFileHash(companyId: string, hashFile: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(acquisizioniFatture).where(and(
      eq(acquisizioniFatture.companyId, companyId),
      eq(acquisizioniFatture.hashFile, hashFile),
      isNull(acquisizioniFatture.deletedAt),
    )).limit(1);
    return rows[0] ?? null;
  },

  async insertAcquisition(actor: ActorContext, acquisition: Record<string, unknown>, lines: Array<Record<string, unknown>>) {
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    const id = newId();
    await db.transaction(async (tx) => {
      await tx.insert(acquisizioniFatture).values(withCreate(actor, { ...acquisition, id }) as any);
      if (lines.length) {
        await tx.insert(righeFattureAcquisite).values(lines.map((line) => withCreate(actor, {
          ...line,
          id: newId(),
          acquisizioneId: id,
        }) as any));
      }
    });
    return { id };
  },

  async getDetail(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(acquisizioniFatture).where(and(
      eq(acquisizioniFatture.id, id),
      eq(acquisizioniFatture.companyId, companyId),
      isNull(acquisizioniFatture.deletedAt),
    )).limit(1);
    const acquisition = rows[0];
    if (!acquisition) return null;
    const lines = await db.select().from(righeFattureAcquisite).where(and(
      eq(righeFattureAcquisite.acquisizioneId, id),
      eq(righeFattureAcquisite.companyId, companyId),
      isNull(righeFattureAcquisite.deletedAt),
    )).orderBy(righeFattureAcquisite.numeroLinea);
    return { acquisition, lines };
  },

  async findSupplier(companyId: string, partitaIva: string | null, codiceFiscale: string | null) {
    const db = await getDb();
    if (!db || (!partitaIva && !codiceFiscale)) return null;
    const identities = [];
    if (partitaIva) identities.push(eq(soggetti.partitaIva, partitaIva));
    if (codiceFiscale) identities.push(eq(soggetti.codiceFiscale, codiceFiscale));
    const rows = await db.select().from(soggetti).where(and(
      eq(soggetti.companyId, companyId),
      isNull(soggetti.deletedAt),
      or(...identities),
    )).limit(1);
    return rows[0] ?? null;
  },

  async findDuplicate(companyId: string, data: { partitaIva: string | null; codiceFiscale: string | null; numero: string; data: string; totale: number }) {
    const db = await getDb();
    if (!db || (!data.partitaIva && !data.codiceFiscale)) return null;
    const identities = [];
    if (data.partitaIva) identities.push(eq(soggetti.partitaIva, data.partitaIva));
    if (data.codiceFiscale) identities.push(eq(soggetti.codiceFiscale, data.codiceFiscale));
    const rows = await db.select({
      id: documentiFinanziari.id,
      codiceInterno: documentiFinanziari.codiceInterno,
      numero: documentiFinanziari.numero,
      dataDocumento: documentiFinanziari.dataDocumento,
      totale: documentiFinanziari.totale,
    }).from(documentiFinanziari)
      .innerJoin(soggetti, and(
        eq(soggetti.id, documentiFinanziari.soggettoId),
        eq(soggetti.companyId, companyId),
        isNull(soggetti.deletedAt),
      ))
      .where(and(
        eq(documentiFinanziari.companyId, companyId),
        eq(documentiFinanziari.numero, data.numero),
        eq(documentiFinanziari.dataDocumento, data.data as any),
        eq(documentiFinanziari.totale, data.totale),
        isNull(documentiFinanziari.deletedAt),
        or(...identities),
      ))
      .limit(1);
    return rows[0] ?? null;
  },

  async listLearningRules(companyId: string, partitaIva: string | null) {
    const db = await getDb();
    if (!db) return [];
    const conditions = [
      eq(regoleClassificazioneFatture.companyId, companyId),
      isNull(regoleClassificazioneFatture.deletedAt),
    ];
    if (partitaIva) conditions.push(eq(regoleClassificazioneFatture.fornitorePartitaIva, partitaIva));
    return db.select().from(regoleClassificazioneFatture)
      .where(and(...conditions))
      .orderBy(desc(regoleClassificazioneFatture.ultimoUtilizzoAt));
  },

  async confirm(actor: ActorContext, input: ConfermaFatturaPreparata) {
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM acquisizioniFatture WHERE id=${input.acquisizioneId} AND companyId=${actor.companyId} FOR UPDATE`);
      const acquisitions = await tx.select().from(acquisizioniFatture).where(and(
        eq(acquisizioniFatture.id, input.acquisizioneId),
        eq(acquisizioniFatture.companyId, actor.companyId),
        isNull(acquisizioniFatture.deletedAt),
      )).limit(1);
      const acquisition = acquisitions[0];
      if (!acquisition) throw new Error("Fattura acquisita non trovata");
      if (acquisition.documentoFinanziarioId) {
        return { documentoId: acquisition.documentoFinanziarioId, soggettoId: acquisition.soggettoId, movimentiMagazzino: 0, giaRegistrata: true };
      }
      if (acquisition.stato === "annullata" || acquisition.stato === "errore") {
        throw new Error("Questa acquisizione non può essere registrata");
      }
      if (acquisition.duplicatoDocumentoId && !input.confermaDuplicato) {
        throw new Error("POSSIBILE_DUPLICATO: conferma esplicitamente per registrare comunque la fattura");
      }

      let soggettoId = input.soggettoId;
      if (soggettoId) {
        const chosen = await tx.select({ id: soggetti.id }).from(soggetti).where(and(
          eq(soggetti.id, soggettoId),
          eq(soggetti.companyId, actor.companyId),
          isNull(soggetti.deletedAt),
        )).limit(1);
        if (!chosen.length) throw new Error("Il fornitore selezionato non appartiene all’azienda attiva");
      } else {
        const supplierConditions = [];
        if (acquisition.fornitorePartitaIva) supplierConditions.push(eq(soggetti.partitaIva, acquisition.fornitorePartitaIva));
        if (acquisition.fornitoreCodiceFiscale) supplierConditions.push(eq(soggetti.codiceFiscale, acquisition.fornitoreCodiceFiscale));
        const existing = supplierConditions.length
          ? await tx.select().from(soggetti).where(and(
            eq(soggetti.companyId, actor.companyId),
            isNull(soggetti.deletedAt),
            or(...supplierConditions),
          )).limit(1)
          : [];
        soggettoId = existing[0]?.id ?? newId();
        if (!existing.length) {
          await tx.insert(soggetti).values(withCreate(actor, {
            id: soggettoId,
            tipologia: "fornitore",
            ragioneSociale: acquisition.fornitoreRagioneSociale,
            nomeBreve: acquisition.fornitoreRagioneSociale.slice(0, 100),
            partitaIva: acquisition.fornitorePartitaIva,
            codiceFiscale: acquisition.fornitoreCodiceFiscale,
            email: acquisition.fornitoreEmail,
            indirizzo: acquisition.fornitoreIndirizzo,
            iban: acquisition.fornitoreIban,
            attivo: true,
          }) as any);
        }
      }

      const countRows = await tx.select({ count: sql<number>`count(*)` }).from(documentiFinanziari).where(and(
        eq(documentiFinanziari.companyId, actor.companyId),
        eq(documentiFinanziari.tipo, "uscita"),
      ));
      const codiceInterno = `DOC-USC-${String(Number(countRows[0]?.count ?? 0) + 1).padStart(6, "0")}`;
      const documentoId = newId();
      await tx.insert(documentiFinanziari).values(withCreate(actor, {
        id: documentoId,
        codiceInterno,
        tipo: "uscita",
        tipoRegistrazione: "documento",
        tipoDocumento: input.tipoDocumentoFinanziario,
        numero: acquisition.numeroDocumento,
        dataDocumento: acquisition.dataDocumento,
        soggettoId,
        categoriaId: input.categoriaId,
        centroCostoId: input.centroCostoId,
        imponibile: acquisition.imponibile,
        aliquotaIva: input.aliquotaIvaPrevalente,
        importoIva: acquisition.importoIva,
        totale: acquisition.totale,
        totalePagato: 0,
        residuo: acquisition.totale,
        valuta: acquisition.valuta,
        dataCompetenza: input.dataCompetenza,
        descrizione: input.descrizione,
        note: input.note,
        stato: "registrato",
        riferimentoEsterno: acquisition.progressivoInvio,
        originModule: "finance",
        originEntityType: "fattura_xml",
        originEntityId: acquisition.id,
        originReference: acquisition.numeroDocumento,
        generatedAutomatically: true,
      }) as any);

      for (const line of input.righe) {
        await tx.insert(registrazioniEconomiche).values(withCreate(actor, {
          id: newId(),
          documentoId,
          categoriaId: line.categoriaId,
          centroCostoId: line.centroCostoId,
          tipo: "costo",
          importo: line.importoEconomico,
          dataCompetenza: input.dataCompetenza,
          descrizione: line.descrizione,
        }) as any);
      }

      const totaleRate = input.scadenze.length;
      for (let index = 0; index < input.scadenze.length; index += 1) {
        const deadline = input.scadenze[index];
        await tx.insert(scadenzeFinanziarie).values(withCreate(actor, {
          id: newId(),
          documentoId,
          importo: deadline.importo,
          importoPagato: 0,
          residuo: deadline.importo,
          dataScadenza: deadline.dataScadenza,
          numero: index + 1,
          totaleRate,
          note: deadline.note,
          stato: deadline.dataScadenza < new Date().toISOString().slice(0, 10) ? "scaduta" : "aperta",
        }) as any);
      }

      await tx.insert(allegatiFinanziari).values(withCreate(actor, {
        id: newId(),
        documentoId,
        nomeFile: acquisition.nomeFile,
        mimeType: acquisition.mimeType,
        dimensione: acquisition.dimensione,
        url: acquisition.fileUrl,
        fileKey: acquisition.fileKey,
      }) as any);

      let stockMovements = 0;
      for (const line of input.righe) {
        let productId = line.prodottoId;
        if (line.aggiornaMagazzino) {
          const quantity = Number(line.quantita);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`La riga “${line.descrizione}” non ha una quantità valida per il magazzino`);
          if (line.creaProdotto) {
            productId = newId();
            await tx.insert(prodotti).values(withCreate(actor, {
              id: productId,
              nome: line.nomeProdotto || line.descrizione.slice(0, 255),
              codice: line.codiceArticolo,
              unitaMisura: line.unitaMisura,
              quantita: "0",
              prezzoUnitario: String(Math.max(0, line.prezzoUnitario / 100)),
              fornitoreId: soggettoId,
              note: `Creato dalla fattura ${acquisition.numeroDocumento}`,
            }) as any);
          }
          if (!productId) throw new Error(`Seleziona o crea un prodotto per la riga “${line.descrizione}”`);
          const productRows = await tx.select().from(prodotti).where(and(
            eq(prodotti.id, productId),
            eq(prodotti.companyId, actor.companyId),
            isNull(prodotti.deletedAt),
          )).limit(1);
          const product = productRows[0];
          if (!product) throw new Error("Il prodotto selezionato non appartiene all’azienda attiva");
          const newQuantity = Number(product.quantita) + quantity;
          await tx.insert(movimentiMagazzino).values(withCreate(actor, {
            id: newId(),
            prodottoId: productId,
            tipo: "carico",
            quantita: quantity.toFixed(3),
            data: acquisition.dataDocumento,
            descrizione: `Carico da fattura ${acquisition.numeroDocumento} — ${line.descrizione}`,
            operatore: actor.userUuid,
          }) as any);
          await tx.update(prodotti).set(withUpdate(actor, { quantita: newQuantity.toFixed(3) }) as any).where(and(
            eq(prodotti.id, productId),
            eq(prodotti.companyId, actor.companyId),
          ));
          stockMovements += 1;
        }

        await tx.update(righeFattureAcquisite).set(withUpdate(actor, {
          categoriaId: line.categoriaId,
          centroCostoId: line.centroCostoId,
          destinazione: line.destinazione,
          fonteClassificazione: "manuale",
          confidenza: 100,
          aggiornaMagazzino: line.aggiornaMagazzino,
          prodottoId: productId,
          creaProdotto: line.creaProdotto,
          nomeProdotto: line.nomeProdotto,
        }) as any).where(and(
          eq(righeFattureAcquisite.id, line.rigaId),
          eq(righeFattureAcquisite.acquisizioneId, acquisition.id),
          eq(righeFattureAcquisite.companyId, actor.companyId),
        ));

        await tx.insert(regoleClassificazioneFatture).values(withCreate(actor, {
          id: newId(),
          chiaveRegola: line.chiaveRegola,
          fornitorePartitaIva: acquisition.fornitorePartitaIva,
          codiceArticolo: line.codiceArticolo,
          descrizioneNormalizzata: line.descrizioneNormalizzata,
          categoriaId: line.categoriaId,
          centroCostoId: line.centroCostoId,
          destinazione: line.destinazione,
          prodottoId: productId,
          utilizzi: 1,
          ultimoUtilizzoAt: new Date(),
        }) as any).onDuplicateKeyUpdate({
          set: {
            categoriaId: line.categoriaId,
            centroCostoId: line.centroCostoId,
            destinazione: line.destinazione,
            prodottoId: productId,
            utilizzi: sql`${regoleClassificazioneFatture.utilizzi} + 1`,
            ultimoUtilizzoAt: new Date(),
            deletedAt: null,
            deletedBy: null,
            updatedAt: new Date(),
            updatedBy: actor.userUuid,
          } as any,
        });
      }

      await tx.update(acquisizioniFatture).set(withUpdate(actor, {
        stato: "registrata",
        soggettoId,
        documentoFinanziarioId: documentoId,
        confermataAt: new Date(),
        confermataBy: actor.userUuid,
      }) as any).where(and(
        eq(acquisizioniFatture.id, acquisition.id),
        eq(acquisizioniFatture.companyId, actor.companyId),
      ));

      return { documentoId, soggettoId, movimentiMagazzino: stockMovements, giaRegistrata: false };
    });
  },

  async updateStatusForDocument(actor: ActorContext, documentoId: string, stato: "registrata" | "pagata") {
    const db = await getDb();
    if (!db) throw new Error("Database non disponibile");
    await db.update(acquisizioniFatture).set(withUpdate(actor, { stato }) as any).where(and(
      eq(acquisizioniFatture.companyId, actor.companyId),
      eq(acquisizioniFatture.documentoFinanziarioId, documentoId),
      isNull(acquisizioniFatture.deletedAt),
    ));
  },
};
