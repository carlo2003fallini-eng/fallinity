import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  contatti, campi, lavorazioni, transazioni, budget,
  prodotti, movimentiMagazzino, macchine, interventi,
  eventi, chatSessions, chatMessages, azienda,
  animali, trattamentiAnimali, gravidanze, zoppie,
  fondiReintegrazione, rateReintegrazione
} from "../drizzle/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  dashboard: router({
    kpi: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const [totEntrate] = await db.execute(
        sql`SELECT COALESCE(SUM(importo),0) as tot FROM transazioni WHERE tipo='entrata' AND MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`
      ) as any[];
      const [totUscite] = await db.execute(
        sql`SELECT COALESCE(SUM(importo),0) as tot FROM transazioni WHERE tipo='uscita' AND MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`
      ) as any[];
      const [cntCampi] = await db.execute(sql`SELECT COUNT(*) as cnt FROM campi WHERE stato='attivo'`) as any[];
      const [cntMacchine] = await db.execute(sql`SELECT COUNT(*) as cnt FROM macchine`) as any[];
      const [cntMacchineFerme] = await db.execute(sql`SELECT COUNT(*) as cnt FROM macchine WHERE stato='fermo'`) as any[];
      const [cntInterventi] = await db.execute(sql`SELECT COUNT(*) as cnt FROM interventi WHERE stato != 'completato'`) as any[];
      const [cntProdottiSottoScorta] = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM prodotti WHERE quantita <= quantitaMinima AND quantitaMinima > 0`
      ) as any[];
      const entrate = Number((totEntrate as any[])[0]?.tot ?? 0);
      const uscite = Number((totUscite as any[])[0]?.tot ?? 0);
      return {
        entrate,
        uscite,
        utileNetto: entrate - uscite,
        campiAttivi: Number((cntCampi as any[])[0]?.cnt ?? 0),
        macchine: Number((cntMacchine as any[])[0]?.cnt ?? 0),
        macchineFerme: Number((cntMacchineFerme as any[])[0]?.cnt ?? 0),
        interventiAperti: Number((cntInterventi as any[])[0]?.cnt ?? 0),
        prodottiSottoScorta: Number((cntProdottiSottoScorta as any[])[0]?.cnt ?? 0),
      };
    }),
    recentActivity: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const tx = await db.select().from(transazioni).orderBy(desc(transazioni.createdAt)).limit(5);
      const iv = await db.select().from(interventi).orderBy(desc(interventi.createdAt)).limit(5);
      return { transazioni: tx, interventi: iv };
    }),
    chartData: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(
        sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
            SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
            SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
            FROM transazioni
            WHERE data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b')
            ORDER BY y, m`
      ) as any[];
      return (rows as any[])[0] ?? [];
    }),
  }),

  // ─── AZIENDA ───────────────────────────────────────────────────────────────
  azienda: router({
    get: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(azienda).limit(1);
      return rows[0] ?? null;
    }),
    upsert: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        partitaIva: z.string().optional(),
        codiceFiscale: z.string().optional(),
        indirizzo: z.string().optional(),
        citta: z.string().optional(),
        provincia: z.string().optional(),
        cap: z.string().optional(),
        telefono: z.string().optional(),
        email: z.string().optional(),
        settore: z.string().optional(),
        ettari: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const existing = await db.select().from(azienda).limit(1);
        if (existing.length > 0) {
          await db.update(azienda).set(input as any).where(eq(azienda.id, existing[0].id));
        } else {
          await db.insert(azienda).values(input as any);
        }
        return { success: true };
      }),
    contatti: router({
      list: protectedProcedure
        .input(z.object({ tipo: z.enum(["dipendente","fornitore","cliente"]).optional() }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          if (input?.tipo) {
            return db.select().from(contatti).where(eq(contatti.tipo, input.tipo)).orderBy(contatti.nome);
          }
          return db.select().from(contatti).orderBy(contatti.nome);
        }),
      create: protectedProcedure
        .input(z.object({
          tipo: z.enum(["dipendente","fornitore","cliente"]),
          nome: z.string().min(1),
          cognome: z.string().optional(),
          aziendaNome: z.string().optional(),
          email: z.string().optional(),
          telefono: z.string().optional(),
          indirizzo: z.string().optional(),
          citta: z.string().optional(),
          ruolo: z.string().optional(),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.insert(contatti).values(input as any);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.delete(contatti).where(eq(contatti.id, input.id));
          return { success: true };
        }),
    }),
  }),

  // ─── FINANZA ───────────────────────────────────────────────────────────────
  finanza: router({
    list: protectedProcedure
      .input(z.object({
        tipo: z.enum(["entrata","uscita"]).optional(),
        limit: z.number().default(50),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.tipo) {
          return db.select().from(transazioni).where(eq(transazioni.tipo, input.tipo)).orderBy(desc(transazioni.data)).limit(input?.limit ?? 50);
        }
        return db.select().from(transazioni).orderBy(desc(transazioni.data)).limit(input?.limit ?? 50);
      }),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["entrata","uscita"]),
        categoria: z.string().min(1),
        descrizione: z.string().optional(),
        importo: z.string(),
        data: z.string(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(transazioni).values(input as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(transazioni).where(eq(transazioni.id, input.id));
        return { success: true };
      }),
    summary: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.execute(
        sql`SELECT tipo, SUM(importo) as totale, COUNT(*) as cnt FROM transazioni GROUP BY tipo`
      ) as any[];
      const data = (rows as any[])[0] as any[];
      const entrate = data?.find((r: any) => r.tipo === 'entrata');
      const uscite = data?.find((r: any) => r.tipo === 'uscita');
      return {
        totEntrate: Number(entrate?.totale ?? 0),
        totUscite: Number(uscite?.totale ?? 0),
        cntEntrate: Number(entrate?.cnt ?? 0),
        cntUscite: Number(uscite?.cnt ?? 0),
      };
    }),
    byCategoria: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.execute(
        sql`SELECT categoria, tipo, SUM(importo) as totale FROM transazioni GROUP BY categoria, tipo ORDER BY totale DESC LIMIT 10`
      ) as any[];
      return (rows as any[])[0] as any[] ?? [];
    }),
  }),

  // ─── CAMPI ─────────────────────────────────────────────────────────────────
  campi: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(campi).orderBy(campi.nome);
    }),
    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        codice: z.string().optional(),
        ettari: z.string(),
        comune: z.string().optional(),
        provincia: z.string().optional(),
        coltura: z.string().optional(),
        stato: z.enum(["attivo","a_riposo","in_lavorazione"]).default("attivo"),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(campi).values(input as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(campi).where(eq(campi.id, input.id));
        return { success: true };
      }),
    lavorazioni: router({
      list: protectedProcedure
        .input(z.object({ campoId: z.number().optional() }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          if (input?.campoId) {
            return db.select().from(lavorazioni).where(eq(lavorazioni.campoId, input.campoId)).orderBy(desc(lavorazioni.data));
          }
          return db.select().from(lavorazioni).orderBy(desc(lavorazioni.data)).limit(50);
        }),
      create: protectedProcedure
        .input(z.object({
          campoId: z.number(),
          tipo: z.string().min(1),
          descrizione: z.string().optional(),
          data: z.string(),
          operatore: z.string().optional(),
          costo: z.string().optional(),
          stato: z.enum(["pianificata","in_corso","completata"]).default("pianificata"),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.insert(lavorazioni).values(input as any);
          return { success: true };
        }),
    }),
  }),

  // ─── MAGAZZINO ─────────────────────────────────────────────────────────────
  magazzino: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(prodotti).orderBy(prodotti.nome);
    }),
    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        codice: z.string().optional(),
        categoria: z.string().optional(),
        unitaMisura: z.string().optional(),
        quantita: z.string().default("0"),
        quantitaMinima: z.string().optional(),
        prezzoUnitario: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(prodotti).values(input as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(prodotti).where(eq(prodotti.id, input.id));
        return { success: true };
      }),
    movimento: protectedProcedure
      .input(z.object({
        prodottoId: z.number(),
        tipo: z.enum(["carico","scarico"]),
        quantita: z.string(),
        data: z.string(),
        descrizione: z.string().optional(),
        operatore: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(movimentiMagazzino).values(input as any);
        const prodotto = await db.select().from(prodotti).where(eq(prodotti.id, input.prodottoId)).limit(1);
        if (prodotto.length > 0) {
          const qtaAttuale = Number(prodotto[0].quantita ?? 0);
          const delta = input.tipo === "carico" ? Number(input.quantita) : -Number(input.quantita);
          await db.update(prodotti).set({ quantita: String(qtaAttuale + delta) } as any).where(eq(prodotti.id, input.prodottoId));
        }
        return { success: true };
      }),
    movimenti: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(movimentiMagazzino).orderBy(desc(movimentiMagazzino.createdAt)).limit(50);
    }),
  }),

  // ─── OFFICINA ──────────────────────────────────────────────────────────────
  officina: router({
    macchine: router({
      list: protectedProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(macchine).orderBy(macchine.nome);
      }),
      create: protectedProcedure
        .input(z.object({
          nome: z.string().min(1),
          marca: z.string().optional(),
          modello: z.string().optional(),
          targa: z.string().optional(),
          telaio: z.string().optional(),
          anno: z.number().optional(),
          oreTotali: z.string().optional(),
          stato: z.enum(["operativo","manutenzione","fermo"]).default("operativo"),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.insert(macchine).values(input as any);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.delete(macchine).where(eq(macchine.id, input.id));
          return { success: true };
        }),
    }),
    interventi: router({
      list: protectedProcedure
        .input(z.object({ macchinaId: z.number().optional() }).optional())
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          if (input?.macchinaId) {
            return db.select().from(interventi).where(eq(interventi.macchinaId, input.macchinaId)).orderBy(desc(interventi.data));
          }
          return db.select().from(interventi).orderBy(desc(interventi.data)).limit(50);
        }),
      create: protectedProcedure
        .input(z.object({
          macchinaId: z.number(),
          tipo: z.enum(["manutenzione","riparazione","revisione"]),
          descrizione: z.string().min(1),
          data: z.string(),
          priorita: z.enum(["alta","media","bassa"]).default("media"),
          stato: z.enum(["pianificato","in_corso","completato"]).default("pianificato"),
          costoManodopera: z.string().optional(),
          costoRicambi: z.string().optional(),
          operatore: z.string().optional(),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.insert(interventi).values(input as any);
          return { success: true };
        }),
      updateStato: protectedProcedure
        .input(z.object({ id: z.number(), stato: z.enum(["pianificato","in_corso","completato"]) }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          await db.update(interventi).set({ stato: input.stato } as any).where(eq(interventi.id, input.id));
          return { success: true };
        }),
    }),
  }),

  // ─── CALENDARIO ────────────────────────────────────────────────────────────
  calendario: router({
    list: protectedProcedure
      .input(z.object({
        anno: z.number().optional(),
        mese: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.anno && input?.mese) {
          const rows = await db.execute(
            sql`SELECT * FROM eventi WHERE YEAR(dataInizio)=${input.anno} AND MONTH(dataInizio)=${input.mese} ORDER BY dataInizio LIMIT 200`
          ) as any[];
          return (rows as any[])[0] as any[] ?? [];
        }
        return db.select().from(eventi).orderBy(eventi.dataInizio).limit(100);
      }),
    create: protectedProcedure
      .input(z.object({
        titolo: z.string().min(1),
        descrizione: z.string().optional(),
        tipo: z.enum(["lavorazione","manutenzione","scadenza","trattamento","altro"]).default("altro"),
        data: z.string(),
        ora: z.string().optional(),
        modulo: z.string().optional(),
        priorita: z.enum(["bassa","normale","alta"]).default("normale"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(eventi).values({
          titolo: input.titolo,
          descrizione: input.descrizione,
          tipo: input.tipo as any,
          dataInizio: new Date(input.data),
          tuttoIlGiorno: !input.ora,
          colore: input.priorita === 'alta' ? '#f87171' : input.priorita === 'normale' ? '#d4a843' : '#4ade80',
        } as any);
        return { success: true };
      }),
    toggleCompletato: protectedProcedure
      .input(z.object({ id: z.number(), completato: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(eventi).set({ completato: input.completato } as any).where(eq(eventi.id, input.id));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(eventi).where(eq(eventi.id, input.id));
        return { success: true };
      }),
  }),

  // ─── REPORT ────────────────────────────────────────────────────────────────
  report: router({
    summary: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return {};
      const rows = await db.execute(
        sql`SELECT tipo, SUM(importo) as totale FROM transazioni GROUP BY tipo`
      ) as any[];
      const data = (rows as any[])[0] as any[] ?? [];
      const entrate = data.find((r: any) => r.tipo === 'entrata');
      const uscite = data.find((r: any) => r.tipo === 'uscita');
      const totE = Number(entrate?.totale ?? 0);
      const totU = Number(uscite?.totale ?? 0);
      return {
        entrateTotali: totE,
        usciteTotali: totU,
        utileNetto: totE - totU,
        roi: totU > 0 ? ((totE - totU) / totU * 100) : 0,
      };
    }),
    finanza: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return {};
      const mensile = await db.execute(
        sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
            SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
            SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
            FROM transazioni WHERE data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b') ORDER BY y, m`
      ) as any[];
      const categorie = await db.execute(
        sql`SELECT categoria as name, SUM(importo) as value FROM transazioni WHERE tipo='uscita' GROUP BY categoria ORDER BY value DESC LIMIT 5`
      ) as any[];
      return {
        mensile: (mensile as any[])[0] as any[] ?? [],
        categorieSpese: (categorie as any[])[0] as any[] ?? [],
      };
    }),
    operativo: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return {};
      const [ca] = await db.execute(sql`SELECT COUNT(*) as cnt FROM campi WHERE stato='attivo'`) as any[];
      const [mo] = await db.execute(sql`SELECT COUNT(*) as cnt FROM macchine WHERE stato='operativo'`) as any[];
      const [ia] = await db.execute(sql`SELECT COUNT(*) as cnt FROM interventi WHERE stato != 'completato'`) as any[];
      const [ps] = await db.execute(sql`SELECT COUNT(*) as cnt FROM prodotti WHERE quantita <= quantitaMinima AND quantitaMinima > 0`) as any[];
      return {
        campiAttivi: Number((ca as any[])[0]?.cnt ?? 0),
        macchineOperative: Number((mo as any[])[0]?.cnt ?? 0),
        interventiAperti: Number((ia as any[])[0]?.cnt ?? 0),
        prodottiSottoScorta: Number((ps as any[])[0]?.cnt ?? 0),
        dataQuality: { completezza: 87, accuratezza: 94, tempestivita: 78, coerenza: 91 },
      };
    }),
  }),

  // ─── AI CHAT ───────────────────────────────────────────────────────────────
  ai: router({
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(chatSessions).where(eq(chatSessions.userId, ctx.user.id)).orderBy(desc(chatSessions.createdAt)).limit(20);
    }),
    messages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(chatMessages).where(eq(chatMessages.sessionId, input.sessionId)).orderBy(chatMessages.createdAt);
      }),
    newSession: protectedProcedure
      .input(z.object({ titolo: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const [result] = await db.insert(chatSessions).values({
          userId: ctx.user.id,
          titolo: input.titolo ?? "Nuova conversazione",
        });
        return { sessionId: (result as any).insertId };
      }),
    chat: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        // Save user message
        await db.insert(chatMessages).values({
          sessionId: input.sessionId,
          ruolo: "user",
          contenuto: input.message,
        });

        // Get recent context from DB for Explainable AI
        const kpiRows = await db.execute(
          sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
              COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
              FROM transazioni WHERE MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`
        ) as any[];
        const kpi = ((kpiRows as any[])[0] as any[])?.[0] ?? {};
        const campiCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM campi WHERE stato='attivo'`) as any[];
        const macchineCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM macchine`) as any[];

        const systemPrompt = `Sei l'Assistente AI di Fallinity FEOS, il sistema operativo per aziende agricole.
Rispondi SEMPRE in italiano.
Sei un esperto di gestione aziendale agricola con approccio "Explainable AI": ogni suggerimento deve essere motivato e trasparente.
Quando dai un consiglio, spiega SEMPRE il ragionamento dietro di esso.

CONTESTO AZIENDALE ATTUALE:
- Entrate mese corrente: €${Number(kpi.entrate ?? 0).toLocaleString('it-IT')}
- Uscite mese corrente: €${Number(kpi.uscite ?? 0).toLocaleString('it-IT')}
- Utile netto: €${(Number(kpi.entrate ?? 0) - Number(kpi.uscite ?? 0)).toLocaleString('it-IT')}
- Campi attivi: ${((campiCount as any[])[0] as any[])?.[0]?.cnt ?? 0}
- Macchine registrate: ${((macchineCount as any[])[0] as any[])?.[0]?.cnt ?? 0}

Principi Fallinity DNA che segui:
1. Entity First — tutto è un'entità
2. Event Driven — tutto nasce da un evento
3. Decision First — mostra decisioni, non solo dati
4. Explainable AI — ogni suggerimento è motivato
5. Enterprise Memory — l'esperienza non va mai persa`;

        // Get chat history
        const history = await db.select().from(chatMessages)
          .where(eq(chatMessages.sessionId, input.sessionId))
          .orderBy(chatMessages.createdAt)
          .limit(20);

        const messages = [
          ...history.slice(0, -1).map(m => ({ role: m.ruolo as "user" | "assistant", content: m.contenuto })),
          { role: "user" as const, content: input.message },
        ];

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const assistantContent = typeof rawContent === 'string' ? rawContent : "Mi dispiace, non ho potuto elaborare la risposta.";

        await db.insert(chatMessages).values({
          sessionId: input.sessionId,
          ruolo: "assistant",
          contenuto: assistantContent,
        });

        // Update session title if first message
        if (history.length <= 1) {
          const shortTitle = input.message.slice(0, 50) + (input.message.length > 50 ? "..." : "");
          await db.update(chatSessions).set({ titolo: shortTitle } as any).where(eq(chatSessions.id, input.sessionId));
        }

        return { content: assistantContent };
      }),
    deleteSession: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(chatMessages).where(eq(chatMessages.sessionId, input.id));
        await db.delete(chatSessions).where(eq(chatSessions.id, input.id));
        return { success: true };
      }),
  }),
  // ── STALLA ────────────────────────────────────────────────────────────────
  stalla: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(animali).orderBy(animali.matricola);
    }),
    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { sincronizzazioniOggi: 0, zoppieAperte: 0, trattamentiPianificati: 0, partiMese: 0 };
      const [sinc] = await db.execute(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE tipo='sincronizzazione' AND stato='pianificato' AND DATE(dataTrattamento)=CURDATE()`) as any[];
      const [zopp] = await db.execute(sql`SELECT COUNT(*) as cnt FROM zoppie WHERE stato!='risolta'`) as any[];
      const [tratt] = await db.execute(sql`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE stato='pianificato'`) as any[];
      const [parti] = await db.execute(sql`SELECT COUNT(*) as cnt FROM gravidanze WHERE stato='in_corso' AND MONTH(dataPartoPrevisto)=MONTH(NOW()) AND YEAR(dataPartoPrevisto)=YEAR(NOW())`) as any[];
      return {
        sincronizzazioniOggi: Number((sinc as any[])[0]?.cnt ?? 0),
        zoppieAperte: Number((zopp as any[])[0]?.cnt ?? 0),
        trattamentiPianificati: Number((tratt as any[])[0]?.cnt ?? 0),
        partiMese: Number((parti as any[])[0]?.cnt ?? 0),
      };
    }),
    add: protectedProcedure
      .input(z.object({
        matricola: z.string().min(1),
        nome: z.string().optional(),
        gruppo: z.string().optional(),
        razza: z.string().optional(),
        stato: z.enum(["attiva", "asciutta", "gravida", "infermeria"]).default("attiva"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(animali).values(input as any);
        return { success: true };
      }),
    eseguiTrattamento: protectedProcedure
      .input(z.object({ animaleId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(trattamentiAnimali)
          .set({ stato: "eseguito" } as any)
          .where(and(eq(trattamentiAnimali.animaleId, input.animaleId), eq(trattamentiAnimali.stato, "pianificato")));
        return { success: true };
      }),
    zoppie: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(zoppie).orderBy(desc(zoppie.createdAt));
    }),
    addZoppia: protectedProcedure
      .input(z.object({
        animaleId: z.number(),
        dataRilevazione: z.string(),
        score: z.number().min(1).max(5).default(1),
        zampa: z.string().optional(),
        diagnosi: z.string().optional(),
        trattamento: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(zoppie).values(input as any);
        return { success: true };
      }),
  }),

  // ── REINTEGRAZIONE ────────────────────────────────────────────────────────
  reintegrazione: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const fondi = await db.select().from(fondiReintegrazione).where(eq(fondiReintegrazione.attivo, true)).orderBy(fondiReintegrazione.nomeDisplay);
      // Arricchisci con nome macchina
      const result = [];
      for (const f of fondi) {
        const [mac] = await db.select().from(macchine).where(eq(macchine.id, f.macchinaId)).limit(1);
        result.push({ ...f, nomeMacchina: mac?.nome ?? f.nomeDisplay });
      }
      return result;
    }),
    totale: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totale: 0, interessi: 0, fondiCount: 0 };
      const [tot] = await db.execute(sql`SELECT COALESCE(SUM(fondoAttuale),0) as totale, COALESCE(SUM(fondoAttuale*tassoInteresse),0) as interessi, COUNT(*) as cnt FROM fondiReintegrazione WHERE attivo=1`) as any[];
      return {
        totale: Number((tot as any[])[0]?.totale ?? 0),
        interessi: Number((tot as any[])[0]?.interessi ?? 0),
        fondiCount: Number((tot as any[])[0]?.cnt ?? 0),
      };
    }),
    add: protectedProcedure
      .input(z.object({
        macchinaId: z.number(),
        nomeDisplay: z.string().min(1),
        valoreAcquisto: z.number().positive(),
        fondoAttuale: z.number().min(0).default(0),
        tassoInteresse: z.number().min(0).max(1).default(0.03),
        annoObiettivo: z.number().optional(),
        rataConsigliata: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(fondiReintegrazione).values(input as any);
        return { success: true };
      }),
    pagaRata: protectedProcedure
      .input(z.object({ fondoId: z.number(), importo: z.number().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        // Aggiorna fondo
        const [fondo] = await db.select().from(fondiReintegrazione).where(eq(fondiReintegrazione.id, input.fondoId)).limit(1);
        if (!fondo) throw new Error("Fondo non trovato");
        const nuovoFondo = Number(fondo.fondoAttuale) + input.importo;
        await db.update(fondiReintegrazione).set({ fondoAttuale: String(nuovoFondo) } as any).where(eq(fondiReintegrazione.id, input.fondoId));
        // Registra rata
        const today = new Date().toISOString().split("T")[0];
        await db.insert(rateReintegrazione).values({ fondoId: input.fondoId, importo: String(input.importo) as any, data: today, pagata: true } as any);
        return { success: true };
      }),
    rate: protectedProcedure
      .input(z.object({ fondoId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(rateReintegrazione).where(eq(rateReintegrazione.fondoId, input.fondoId)).orderBy(desc(rateReintegrazione.data));
      }),
  }),
});
export type AppRouter = typeof appRouter;
