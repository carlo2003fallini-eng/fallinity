import { randomUUID } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { prodotti, movimentiMagazzino } from "../../../drizzle/schema";
import { withCreate, withUpdate, softDeletePayload, type ActorContext } from "../_core";

type MovimentoAtomico = {
  prodottoId: string;
  tipo: "carico" | "scarico";
  quantita: string;
  data: string;
  descrizione?: string;
  causale?: string;
  note?: string;
};

/** INVENTORY (Magazzino) — Repository */
export const inventoryRepository = {
  async listProdotti(companyId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(prodotti)
      .where(and(eq(prodotti.companyId, companyId), isNull(prodotti.deletedAt)))
      .orderBy(prodotti.nome);
  },

  async listMovimenti(companyId: string, prodottoId: string) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(movimentiMagazzino)
      .where(and(
        eq(movimentiMagazzino.prodottoId, prodottoId),
        eq(movimentiMagazzino.companyId, companyId),
        isNull(movimentiMagazzino.deletedAt),
      ))
      .orderBy(desc(movimentiMagazzino.dataOra), desc(movimentiMagazzino.data));
  },

  async getProdotto(companyId: string, id: string) {
    const db = await getDb();
    if (!db) return null;
    const [prodotto] = await db.select().from(prodotti).where(and(
      eq(prodotti.id, id),
      eq(prodotti.companyId, companyId),
      isNull(prodotti.deletedAt),
    )).limit(1);
    return prodotto ?? null;
  },

  async insertProdotto(actor: ActorContext, data: Record<string, unknown>) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.insert(prodotti).values(withCreate(actor, data) as any);
    return { success: true };
  },

  /**
   * Scrive movimento e giacenza in una sola transazione con lock della riga.
   * In questo modo due scarichi simultanei non possono portare la scorta sotto zero.
   */
  async registraMovimentoAtomico(actor: ActorContext, movimento: MovimentoAtomico) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");

    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM prodotti WHERE id=${movimento.prodottoId} AND companyId=${actor.companyId} AND deletedAt IS NULL FOR UPDATE`);
      const [prodotto] = await tx.select().from(prodotti).where(and(
        eq(prodotti.id, movimento.prodottoId),
        eq(prodotti.companyId, actor.companyId),
        isNull(prodotti.deletedAt),
      )).limit(1);
      if (!prodotto) throw new Error("Prodotto non trovato o non disponibile per l’azienda attiva");

      const quantita = Number(movimento.quantita);
      const disponibilita = Number(prodotto.quantita);
      if (!Number.isFinite(quantita) || quantita <= 0) throw new Error("La quantità deve essere maggiore di zero");
      if (movimento.tipo === "scarico" && quantita > disponibilita) {
        throw new Error(`Quantità non disponibile: puoi scaricare al massimo ${disponibilita.toFixed(3)} ${prodotto.unitaMisura ?? "pz"}`);
      }

      const nuovaQuantita = movimento.tipo === "carico"
        ? disponibilita + quantita
        : disponibilita - quantita;
      const ora = new Date();
      const movementId = randomUUID();

      await tx.insert(movimentiMagazzino).values(withCreate(actor, {
        id: movementId,
        prodottoId: prodotto.id,
        tipo: movimento.tipo,
        quantita: quantita.toFixed(3),
        data: movimento.data,
        dataOra: ora,
        descrizione: movimento.descrizione,
        causale: movimento.causale || null,
        note: movimento.note || null,
        operatore: actor.userUuid,
      }) as any);

      const productUpdate = movimento.tipo === "scarico"
        ? {
          quantita: nuovaQuantita.toFixed(3),
          ultimoScaricoQuantita: quantita.toFixed(3),
          ultimoScaricoAt: ora,
        }
        : { quantita: nuovaQuantita.toFixed(3) };
      await tx.update(prodotti).set(withUpdate(actor, productUpdate) as any).where(and(
        eq(prodotti.id, prodotto.id),
        eq(prodotti.companyId, actor.companyId),
      ));

      return {
        success: true as const,
        movimentoId: movementId,
        prodotto: {
          ...prodotto,
          quantita: nuovaQuantita.toFixed(3),
          ultimoScaricoQuantita: movimento.tipo === "scarico" ? quantita.toFixed(3) : prodotto.ultimoScaricoQuantita,
          ultimoScaricoAt: movimento.tipo === "scarico" ? ora : prodotto.ultimoScaricoAt,
        },
      };
    });
  },

  async updateQuantita(actor: ActorContext, prodottoId: string, quantita: string) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.update(prodotti).set(withUpdate(actor, { quantita }) as any).where(and(
      eq(prodotti.id, prodottoId),
      eq(prodotti.companyId, actor.companyId),
    ));
  },

  async softDeleteProdotto(actor: ActorContext, id: string) {
    const db = await getDb();
    if (!db) throw new Error("DB non disponibile");
    await db.update(prodotti).set(softDeletePayload(actor) as any)
      .where(and(eq(prodotti.id, id), eq(prodotti.companyId, actor.companyId)));
    return { success: true };
  },
};
