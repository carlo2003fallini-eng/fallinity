import { and, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { animali, gruppi, gruppiAnimali, trattamentiAnimali, zoppie, eventiAnimale } from "../../../drizzle/schema";
import { newId, withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

type MovimentoAnimaleAtomico = {
  animaleId: string;
  gruppoPrecedenteId: string | null;
  statoProduttivoPrecedente: string | null;
  statoRiproduttivoPrecedente: string | null;
  patch: Record<string, unknown>;
  fattoriApplicati: unknown[];
};

type SpostamentoAtomicoInput = {
  idempotencyKey: string;
  nuovoGruppoId: string;
  animaleIds: string[];
  motivo?: string;
  confermaFattori: boolean;
  origineAttese?: Array<{ animaleId: string; gruppoId: string | null }>;
  movimenti: MovimentoAnimaleAtomico[];
};

/** LIVESTOCK (Stalla) — Repository */
export const livestockRepository = {
  // ── Gruppi ──
  async listGruppi(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gruppi)
      .where(and(eq(gruppi.companyId, companyId), isNull(gruppi.deletedAt)))
      .orderBy(gruppi.nome);
  },

  async getGruppo(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(gruppi)
      .where(and(eq(gruppi.id, id), eq(gruppi.companyId, companyId), isNull(gruppi.deletedAt)));
    return rows[0] ?? null;
  },

  async countGruppi(companyId: string) {
    const db = await getDb();
    if (!db) return 0;
    const r = await db.execute(sql`SELECT COUNT(*) as cnt FROM gruppi WHERE companyId=${companyId} AND deletedAt IS NULL`);
    return Number((r as unknown as any[][])[0]?.[0]?.cnt ?? 0);
  },

  async listGruppiAnimali(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(gruppiAnimali).where(and(
      eq(gruppiAnimali.companyId, companyId),
      isNull(gruppiAnimali.deletedAt),
    ));
  },

  async listUltimiParti(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select({ animaleId: eventiAnimale.animaleId, data: eventiAnimale.data }).from(eventiAnimale).where(and(
      eq(eventiAnimale.companyId, companyId),
      eq(eventiAnimale.tipo, "parto"),
      isNull(eventiAnimale.deletedAt),
    )).orderBy(desc(eventiAnimale.data));
  },

  async listMovimentiGruppo(companyId: string, gruppoId: string, limit: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(eventiAnimale).where(and(
      eq(eventiAnimale.companyId, companyId),
      isNull(eventiAnimale.deletedAt),
      or(eq(eventiAnimale.gruppoNuovoId, gruppoId), eq(eventiAnimale.gruppoPrecedenteId, gruppoId)),
    )).orderBy(desc(eventiAnimale.data)).limit(limit);
  },

  async insertGruppo(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(gruppi).values(row as any);
    return row;
  },

  async updateGruppo(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(gruppi).set(withUpdate(actor, data) as any)
      .where(and(eq(gruppi.id, id), eq(gruppi.companyId, actor.companyId)));
    return { success: true };
  },

  async archiveGruppo(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM gruppi WHERE id=${id} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      const [gruppo] = await tx.select().from(gruppi).where(and(
        eq(gruppi.id, id), eq(gruppi.companyId, actor.companyId), isNull(gruppi.deletedAt),
      )).limit(1);
      if (!gruppo) throw new Error("Gruppo non trovato");

      const [membriEsclusivi] = await tx.select({ totale: sql<number>`COUNT(*)` }).from(animali).where(and(
        eq(animali.companyId, actor.companyId), eq(animali.gruppoId, id), isNull(animali.deletedAt),
      ));
      const [membriPersonalizzati] = await tx.select({ totale: sql<number>`COUNT(*)` }).from(gruppiAnimali).where(and(
        eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.gruppoId, id), isNull(gruppiAnimali.deletedAt),
      ));
      const totale = Number(membriEsclusivi?.totale ?? 0) + Number(membriPersonalizzati?.totale ?? 0);
      if (totale > 0) throw new Error(`Impossibile archiviare: sposta o rimuovi prima i ${totale} animali associati`);

      await tx.update(gruppi).set(softDeletePayload(actor) as any).where(and(
        eq(gruppi.id, id), eq(gruppi.companyId, actor.companyId), isNull(gruppi.deletedAt),
      ));
    });
    return { success: true };
  },

  async replaceGruppiPersonalizzati(actor: ActorContext, animaleId: string, gruppoIds: string[]) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM animali WHERE id=${animaleId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      const [animale] = await tx.select().from(animali).where(and(
        eq(animali.id, animaleId), eq(animali.companyId, actor.companyId), isNull(animali.deletedAt),
      )).limit(1);
      if (!animale) throw new Error("Animale non trovato");

      if (gruppoIds.length > 0) {
        const destinazioni = await tx.select().from(gruppi).where(and(
          eq(gruppi.companyId, actor.companyId),
          isNull(gruppi.deletedAt),
          inArray(gruppi.id, gruppoIds),
        ));
        if (destinazioni.length !== gruppoIds.length || destinazioni.some((g) => g.modalitaMembri !== "personalizzato" || g.tipoGestione !== "manuale")) {
          throw new Error("Sono selezionabili solo gruppi personali manuali dell’azienda attiva");
        }
      }

      await tx.update(gruppiAnimali).set(softDeletePayload(actor) as any).where(and(
        eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.animaleId, animaleId), isNull(gruppiAnimali.deletedAt),
      ));
      for (const gruppoId of gruppoIds) {
        const [esistente] = await tx.select().from(gruppiAnimali).where(and(
          eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.animaleId, animaleId), eq(gruppiAnimali.gruppoId, gruppoId),
        )).limit(1);
        if (esistente) {
          await tx.update(gruppiAnimali).set(withUpdate(actor, { deletedAt: null, deletedBy: null }) as any).where(eq(gruppiAnimali.id, esistente.id));
        } else {
          await tx.insert(gruppiAnimali).values(withCreate(actor, { gruppoId, animaleId }) as any);
        }
      }
      return { success: true, totale: gruppoIds.length };
    });
  },

  async associaAnimaliPersonaleAtomico(actor: ActorContext, input: { idempotencyKey: string; gruppoId: string; animaleIds: string[]; motivo?: string }) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    return db.transaction(async (tx) => {
      const [gruppo] = await tx.select().from(gruppi).where(and(
        eq(gruppi.id, input.gruppoId), eq(gruppi.companyId, actor.companyId), isNull(gruppi.deletedAt),
      )).limit(1);
      if (!gruppo || gruppo.tipoGestione !== "manuale" || gruppo.modalitaMembri !== "personalizzato") throw new Error("Il gruppo personale non è disponibile");
      const ids = Array.from(new Set(input.animaleIds));
      const animaliDisponibili = await tx.select().from(animali).where(and(
        eq(animali.companyId, actor.companyId), isNull(animali.deletedAt), inArray(animali.id, ids),
      ));
      if (animaliDisponibili.length !== ids.length) throw new Error("Uno o più animali non sono disponibili nell’azienda attiva");
      const associazioniAttive = await tx.select().from(gruppiAnimali).where(and(
        eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.gruppoId, gruppo.id), isNull(gruppiAnimali.deletedAt), inArray(gruppiAnimali.animaleId, ids),
      ));
      const attivi = new Set(associazioniAttive.map((associazione) => associazione.animaleId));
      const daAssociare = ids.filter((id) => !attivi.has(id));
      if (gruppo.capacitaMax != null) {
        const [totaleAttuale] = await tx.select({ totale: sql<number>`COUNT(*)` }).from(gruppiAnimali).where(and(
          eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.gruppoId, gruppo.id), isNull(gruppiAnimali.deletedAt),
        ));
        if (Number(totaleAttuale?.totale ?? 0) + daAssociare.length > gruppo.capacitaMax) throw new Error(`Capacità massima superata: ${Number(totaleAttuale?.totale ?? 0) + daAssociare.length}/${gruppo.capacitaMax}`);
      }
      for (const animaleId of daAssociare) {
        const [archiviata] = await tx.select().from(gruppiAnimali).where(and(
          eq(gruppiAnimali.companyId, actor.companyId), eq(gruppiAnimali.gruppoId, gruppo.id), eq(gruppiAnimali.animaleId, animaleId),
        )).limit(1);
        if (archiviata) await tx.update(gruppiAnimali).set(withUpdate(actor, { deletedAt: null, deletedBy: null }) as any).where(eq(gruppiAnimali.id, archiviata.id));
        else await tx.insert(gruppiAnimali).values(withCreate(actor, { gruppoId: gruppo.id, animaleId }) as any);
        await tx.insert(eventiAnimale).values(withCreate(actor, {
          id: newId(), animaleId, tipo: "nota", data: new Date(), descrizione: `Associato al gruppo personale ${gruppo.nome}`,
          gruppoPrecedenteId: null, gruppoNuovoId: gruppo.id, motivo: input.motivo ?? null, operazioneMultiplaId: input.idempotencyKey,
        }) as any);
      }
      return { success: true as const, idempotent: daAssociare.length === 0, operazioneMultiplaId: input.idempotencyKey, spostati: daAssociare.length };
    });
  },

  async spostaAnimaliAtomico(actor: ActorContext, input: SpostamentoAtomicoInput) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    return db.transaction(async (tx) => {
      const giaEseguiti = await tx.select({ animaleId: eventiAnimale.animaleId }).from(eventiAnimale).where(and(
        eq(eventiAnimale.companyId, actor.companyId),
        eq(eventiAnimale.operazioneMultiplaId, input.idempotencyKey),
        isNull(eventiAnimale.deletedAt),
      ));
      if (giaEseguiti.length > 0) {
        return { success: true as const, idempotent: true as const, operazioneMultiplaId: input.idempotencyKey, spostati: giaEseguiti.length };
      }

      await tx.execute(sql`SELECT id FROM gruppi WHERE id=${input.nuovoGruppoId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      const [destinazione] = await tx.select().from(gruppi).where(and(
        eq(gruppi.id, input.nuovoGruppoId), eq(gruppi.companyId, actor.companyId), isNull(gruppi.deletedAt),
      )).limit(1);
      if (!destinazione) throw new Error("Gruppo destinazione non trovato");
      if (destinazione.tipoGestione === "automatico" || destinazione.modalitaMembri !== "esclusivo") {
        throw new Error("Un gruppo automatico o personale non può essere destinazione di uno spostamento operativo");
      }

      const ids = Array.from(new Set(input.animaleIds));
      if (ids.length !== input.animaleIds.length) throw new Error("Gli animali selezionati devono essere univoci");
      for (const animaleId of ids) {
        await tx.execute(sql`SELECT id FROM animali WHERE id=${animaleId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      }
      const trovati = await tx.select().from(animali).where(and(
        eq(animali.companyId, actor.companyId), isNull(animali.deletedAt), inArray(animali.id, ids),
      ));
      if (trovati.length !== ids.length) throw new Error("Uno o più animali non sono disponibili nell’azienda attiva");

      const origini = new Map((input.origineAttese ?? []).map((entry) => [entry.animaleId, entry.gruppoId]));
      for (const animale of trovati) {
        if (origini.has(animale.id) && origini.get(animale.id) !== (animale.gruppoId ?? null)) {
          throw new Error("La posizione di uno o più animali è cambiata: aggiorna il riepilogo prima di confermare");
        }
      }

      const [conteggioDestinazione] = await tx.select({ totale: sql<number>`COUNT(*)` }).from(animali).where(and(
        eq(animali.companyId, actor.companyId), eq(animali.gruppoId, destinazione.id), isNull(animali.deletedAt),
      ));
      const daAggiungere = trovati.filter((animale) => animale.gruppoId !== destinazione.id).length;
      const capacitaDopo = Number(conteggioDestinazione?.totale ?? 0) + daAggiungere;
      if (destinazione.capacitaMax != null && capacitaDopo > destinazione.capacitaMax) {
        throw new Error(`Capacità massima superata: ${capacitaDopo}/${destinazione.capacitaMax}`);
      }

      const movimentiById = new Map(input.movimenti.map((movimento) => [movimento.animaleId, movimento]));
      for (const animale of trovati) {
        const movimento = movimentiById.get(animale.id);
        if (!movimento) throw new Error("Anteprima movimento non valida");
        const patch = movimento.patch;
        await tx.update(animali).set(withUpdate(actor, { gruppoId: destinazione.id, gruppo: destinazione.nome, ...patch }) as any).where(and(
          eq(animali.id, animale.id), eq(animali.companyId, actor.companyId), isNull(animali.deletedAt),
        ));
        await tx.insert(eventiAnimale).values(withCreate(actor, {
          id: newId(),
          animaleId: animale.id,
          tipo: "spostamento_gruppo",
          data: new Date(),
          descrizione: `Spostato da ${movimento.gruppoPrecedenteId ?? "nessuno"} a ${destinazione.nome}${destinazione.codice ? ` (${destinazione.codice})` : ""}`,
          gruppoPrecedenteId: movimento.gruppoPrecedenteId,
          gruppoNuovoId: destinazione.id,
          statoProduttivoPrecedente: movimento.statoProduttivoPrecedente,
          statoProduttivoNuovo: (patch.statoProduttivo as string) ?? movimento.statoProduttivoPrecedente,
          statoRiproduttivoPrecedente: movimento.statoRiproduttivoPrecedente,
          statoRiproduttivoNuovo: (patch.statoRiproduttivo as string) ?? movimento.statoRiproduttivoPrecedente,
          fattoriApplicati: movimento.fattoriApplicati.length ? JSON.stringify(movimento.fattoriApplicati) : null,
          modalitaApplicazione: movimento.fattoriApplicati.length ? (input.confermaFattori ? "conferma" : "automatico") : null,
          motivo: input.motivo ?? null,
          operazioneMultiplaId: input.idempotencyKey,
        }) as any);
      }
      return { success: true as const, idempotent: false as const, operazioneMultiplaId: input.idempotencyKey, spostati: trovati.length, capacitaDopo };
    });
  },

  // ── Animali ──
  async listAnimali(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(animali)
      .where(and(eq(animali.companyId, companyId), isNull(animali.deletedAt)))
      .orderBy(animali.matricola);
  },

  async listAnimaliFiltrati(companyId: string, filtri?: { gruppoId?: string; stato?: string; statoProduttivo?: string; statoRiproduttivo?: string; ricerca?: string }) {
    const db = await getDb();
    if (!db) return [];

    const condizioni: (SQL | undefined)[] = [eq(animali.companyId, companyId), isNull(animali.deletedAt)];
    if (filtri?.gruppoId) condizioni.push(eq(animali.gruppoId, filtri.gruppoId));
    if (filtri?.stato) condizioni.push(eq(animali.stato, filtri.stato as any));
    if (filtri?.statoProduttivo) condizioni.push(eq(animali.statoProduttivo, filtri.statoProduttivo as any));
    if (filtri?.statoRiproduttivo) condizioni.push(eq(animali.statoRiproduttivo, filtri.statoRiproduttivo as any));
    if (filtri?.ricerca?.trim()) {
      const pattern = `%${filtri.ricerca.trim()}%`;
      condizioni.push(or(like(animali.matricola, pattern), like(animali.numeroAziendale, pattern))!);
    }

    return db.select().from(animali).where(and(...condizioni)).orderBy(animali.matricola);
  },

  async listAnimaliByGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(animali)
      .where(and(eq(animali.companyId, companyId), eq(animali.gruppoId, gruppoId), isNull(animali.deletedAt)))
      .orderBy(animali.matricola);
  },

  async getAnimale(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(animali)
      .where(and(eq(animali.id, id), eq(animali.companyId, companyId), isNull(animali.deletedAt)));
    return rows[0] ?? null;
  },

  async ricercaAnimali(companyId: string, query: string) {
    const db = await getDb();
    if (!db) return [];
    const pattern = `%${query}%`;
    return db.select().from(animali)
      .where(and(
        eq(animali.companyId, companyId),
        isNull(animali.deletedAt),
        or(
          like(animali.matricola, pattern),
          like(animali.numeroAziendale, pattern),
          like(animali.nome, pattern),
          like(animali.rfid, pattern),
        ),
      ))
      .orderBy(animali.matricola)
      .limit(20);
  },

  async insertAnimale(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(animali).values(row as any);
    return row;
  },

  async updateAnimale(actor: ActorContext, id: string, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(animali).set(withUpdate(actor, data) as any)
      .where(and(eq(animali.id, id), eq(animali.companyId, actor.companyId)));
    return { success: true };
  },

  async countAnimaliByGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return { totale: 0, inLattazione: 0, gravide: 0, manze: 0 };
    const r = await db.execute(sql`
      SELECT
        COUNT(*) as totale,
        SUM(CASE WHEN statoProduttivo='in_lattazione' THEN 1 ELSE 0 END) as inLattazione,
        SUM(CASE WHEN statoRiproduttivo='gravida' THEN 1 ELSE 0 END) as gravide,
        SUM(CASE WHEN statoProduttivo='manza' THEN 1 ELSE 0 END) as manze
      FROM animali
      WHERE companyId=${companyId} AND gruppoId=${gruppoId} AND deletedAt IS NULL
    `);
    const row = (r as unknown as any[][])[0]?.[0] ?? {};
    return {
      totale: Number(row.totale ?? 0),
      inLattazione: Number(row.inLattazione ?? 0),
      gravide: Number(row.gravide ?? 0),
      manze: Number(row.manze ?? 0),
    };
  },

  async produzioneMediaGruppo(companyId: string, gruppoId: string) {
    const db = await getDb();
    if (!db) return 0;
    const r = await db.execute(sql`
      SELECT AVG(CAST(produzioneOggi AS DECIMAL(8,2))) as avg_prod
      FROM animali
      WHERE companyId=${companyId} AND gruppoId=${gruppoId} AND deletedAt IS NULL AND statoProduttivo='in_lattazione'
    `);
    return Number((r as unknown as any[][])[0]?.[0]?.avg_prod ?? 0);
  },

  // ── Zoppie ──
  async listZoppie(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(zoppie)
      .where(and(eq(zoppie.companyId, companyId), isNull(zoppie.deletedAt)))
      .orderBy(desc(zoppie.createdAt));
  },

  async insertZoppia(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(zoppie).values(withCreate(actor, data) as any);
    return { success: true };
  },

  // ── Eventi Animale ──
  async listEventiAnimale(companyId: string, animaleId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(eventiAnimale)
      .where(and(eq(eventiAnimale.companyId, companyId), eq(eventiAnimale.animaleId, animaleId), isNull(eventiAnimale.deletedAt)))
      .orderBy(desc(eventiAnimale.data));
  },

  async insertEventoAnimale(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(eventiAnimale).values(row as any);
    return row;
  },

  // ── Stats (legacy) ──
  async stats(companyId: string) {
    const db = await getDb();
    if (!db) return { sincronizzazioniOggi: 0, zoppieAperte: 0, trattamentiPianificati: 0, partiMese: 0 };
    const scalar = async (q: any) => {
      const r = await db.execute(q);
      return Number((r as unknown as any[][])[0]?.[0]?.cnt ?? 0);
    };
    return {
      sincronizzazioniOggi: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND tipo='sincronizzazione' AND stato='pianificato' AND DATE(dataTrattamento)=CURDATE()`),
      zoppieAperte: await scalar(sql`SELECT COUNT(*) as cnt FROM zoppie WHERE companyId=${companyId} AND deletedAt IS NULL AND stato!='risolta'`),
      trattamentiPianificati: await scalar(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='pianificato'`),
      partiMese: await scalar(sql`SELECT COUNT(*) as cnt FROM gravidanze WHERE companyId=${companyId} AND deletedAt IS NULL AND stato='in_corso' AND MONTH(dataPartoPrevisto)=MONTH(NOW()) AND YEAR(dataPartoPrevisto)=YEAR(NOW())`),
    };
  },

  async eseguiTrattamento(actor: ActorContext, animaleId: string) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(trattamentiAnimali).set(withUpdate(actor, { stato: "eseguito" }) as any)
      .where(and(eq(trattamentiAnimali.animaleId, animaleId), eq(trattamentiAnimali.stato, "pianificato"), eq(trattamentiAnimali.companyId, actor.companyId)));
    return { success: true };
  },

  // ── Trattamenti CRUD ──
  async insertTrattamento(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const row = withCreate(actor, data);
    await db.insert(trattamentiAnimali).values(row as any);
    return row;
  },

  async listTrattamenti(companyId: string, animaleId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(trattamentiAnimali)
      .where(and(
        eq(trattamentiAnimali.companyId, companyId),
        eq(trattamentiAnimali.animaleId, animaleId),
        isNull(trattamentiAnimali.deletedAt)
      ))
      .orderBy(desc(trattamentiAnimali.dataTrattamento));
  },
};
