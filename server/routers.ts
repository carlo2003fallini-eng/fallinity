import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { getActor, withCreate, withUpdate, softDeletePayload } from "./domains/_core";
import {
  companies, contatti, campi, lavorazioni, transazioni, prodotti, movimentiMagazzino,
  macchine, interventi, eventi, animali, trattamentiAnimali, gravidanze, zoppie,
  fondiReintegrazione, rateReintegrazione, chatSessions, chatMessages,
} from "../drizzle/schema";

const DEMO_COMPANY = "comp-demo-0001";

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

  // ─── COMPANY (Azienda attiva) ────────────────────────────────────────────────
  company: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const actor = await getActor(ctx);
      const [c] = await db.select().from(companies).where(eq(companies.id, actor.companyId)).limit(1);
      return c ?? null;
    }),
  }),

  // ─── AZIENDA / CONTATTI ──────────────────────────────────────────────────────
  azienda: router({
    list: protectedProcedure
      .input(z.object({ tipo: z.enum(["dipendente", "fornitore", "cliente"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        const conds = [eq(contatti.companyId, actor.companyId), isNull(contatti.deletedAt)];
        if (input?.tipo) conds.push(eq(contatti.tipo, input.tipo));
        return db.select().from(contatti).where(and(...conds)).orderBy(contatti.nome);
      }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { totale: 0, dipendenti: 0, fornitori: 0, clienti: 0 };
      const actor = await getActor(ctx);
      const rows = await db.select().from(contatti).where(and(eq(contatti.companyId, actor.companyId), isNull(contatti.deletedAt)));
      return {
        totale: rows.length,
        dipendenti: rows.filter(r => r.tipo === "dipendente").length,
        fornitori: rows.filter(r => r.tipo === "fornitore").length,
        clienti: rows.filter(r => r.tipo === "cliente").length,
      };
    }),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["dipendente", "fornitore", "cliente"]),
        nome: z.string().min(1),
        cognome: z.string().optional(),
        aziendaNome: z.string().optional(),
        email: z.string().optional(),
        telefono: z.string().optional(),
        citta: z.string().optional(),
        ruolo: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(contatti).values(withCreate(actor, input) as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(contatti).set(softDeletePayload(actor) as any)
          .where(and(eq(contatti.id, input.id), eq(contatti.companyId, actor.companyId)));
        return { success: true };
      }),
  }),

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  dashboard: router({
    kpi: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { entrate: 0, uscite: 0, utile: 0, campi: 0, macchine: 0, animali: 0, interventiAperti: 0, prodottiSottoScorta: 0 };
      const actor = await getActor(ctx);
      const cid = actor.companyId;
      const [fin] = (await db.execute(
        sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
            COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
            FROM transazioni WHERE companyId=${cid} AND deletedAt IS NULL`
      ) as any[]) as any[];
      const f = (fin as any[])[0] ?? {};
      const entrate = Number(f.entrate ?? 0);
      const uscite = Number(f.uscite ?? 0);
      const count = async (table: string, extra = "") => {
        const r = (await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${table} WHERE companyId='${cid}' AND deletedAt IS NULL ${extra}`)) as any[]);
        return Number((r[0] as any[])[0]?.cnt ?? 0);
      };
      const campiCount = await count("campi", "AND stato='attivo'");
      const macchineCount = await count("macchine");
      const animaliCount = await count("animali", "AND stato NOT IN ('venduta','morta')");
      const interventiAperti = await count("interventi", "AND stato != 'completato'");
      const sottoScorta = await count("prodotti", "AND quantita <= quantitaMinima AND quantitaMinima > 0");
      return {
        entrate, uscite, utile: entrate - uscite,
        campi: campiCount, macchine: macchineCount, animali: animaliCount,
        interventiAperti, prodottiSottoScorta: sottoScorta,
      };
    }),
    chartData: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
            SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
            SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
            FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL
            AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b') ORDER BY y, m`
      ) as any[]);
      return (rows as any[])[0] as any[] ?? [];
    }),
    recentActivity: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT 'transazione' as tipo, descrizione as testo, data as quando FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL
            ORDER BY createdAt DESC LIMIT 8`
      ) as any[]);
      return (rows as any[])[0] as any[] ?? [];
    }),
  }),

  // ─── FINANZA ───────────────────────────────────────────────────────────────
  finanza: router({
    list: protectedProcedure
      .input(z.object({ tipo: z.enum(["entrata", "uscita"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        const conds = [eq(transazioni.companyId, actor.companyId), isNull(transazioni.deletedAt)];
        if (input?.tipo) conds.push(eq(transazioni.tipo, input.tipo));
        return db.select().from(transazioni).where(and(...conds)).orderBy(desc(transazioni.data)).limit(100);
      }),
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { entrate: 0, uscite: 0, utile: 0, roi: 0 };
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
            COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
            FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL`
      ) as any[]);
      const r = (rows as any[])[0]?.[0] ?? {};
      const entrate = Number(r.entrate ?? 0);
      const uscite = Number(r.uscite ?? 0);
      return { entrate, uscite, utile: entrate - uscite, roi: uscite > 0 ? ((entrate - uscite) / uscite * 100) : 0 };
    }),
    byCategoria: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT categoria as name, SUM(importo) as value FROM transazioni
            WHERE tipo='uscita' AND companyId=${actor.companyId} AND deletedAt IS NULL
            GROUP BY categoria ORDER BY value DESC LIMIT 6`
      ) as any[]);
      return (rows as any[])[0] as any[] ?? [];
    }),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["entrata", "uscita"]),
        categoria: z.string().min(1),
        descrizione: z.string().optional(),
        importo: z.number().positive(),
        data: z.string(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(transazioni).values(withCreate(actor, {
          ...input, importo: String(input.importo),
        }) as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(transazioni).set(softDeletePayload(actor) as any)
          .where(and(eq(transazioni.id, input.id), eq(transazioni.companyId, actor.companyId)));
        return { success: true };
      }),
  }),

  // ─── CAMPI ───────────────────────────────────────────────────────────────────
  campi: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      return db.select().from(campi).where(and(eq(campi.companyId, actor.companyId), isNull(campi.deletedAt))).orderBy(campi.nome);
    }),
    lavorazioni: protectedProcedure
      .input(z.object({ campoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        return db.select().from(lavorazioni)
          .where(and(eq(lavorazioni.campoId, input.campoId), eq(lavorazioni.companyId, actor.companyId), isNull(lavorazioni.deletedAt)))
          .orderBy(desc(lavorazioni.data));
      }),
    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        codice: z.string().optional(),
        ettari: z.number().positive(),
        comune: z.string().optional(),
        coltura: z.string().optional(),
        stato: z.enum(["attivo", "a_riposo", "in_lavorazione"]).default("attivo"),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(campi).values(withCreate(actor, { ...input, ettari: String(input.ettari) }) as any);
        return { success: true };
      }),
    addLavorazione: protectedProcedure
      .input(z.object({
        campoId: z.string(),
        tipo: z.string().min(1),
        descrizione: z.string().optional(),
        data: z.string(),
        operatore: z.string().optional(),
        costo: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(lavorazioni).values(withCreate(actor, {
          ...input, costo: input.costo != null ? String(input.costo) : null,
        }) as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(campi).set(softDeletePayload(actor) as any)
          .where(and(eq(campi.id, input.id), eq(campi.companyId, actor.companyId)));
        return { success: true };
      }),
  }),

  // ─── MAGAZZINO ─────────────────────────────────────────────────────────────
  magazzino: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      return db.select().from(prodotti).where(and(eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt))).orderBy(prodotti.nome);
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { totaleProdotti: 0, sottoScorta: 0, valoreMagazzino: 0 };
      const actor = await getActor(ctx);
      const rows = await db.select().from(prodotti).where(and(eq(prodotti.companyId, actor.companyId), isNull(prodotti.deletedAt)));
      let valore = 0, sotto = 0;
      for (const p of rows) {
        valore += Number(p.quantita) * Number(p.prezzoUnitario ?? 0);
        if (Number(p.quantitaMinima ?? 0) > 0 && Number(p.quantita) <= Number(p.quantitaMinima)) sotto++;
      }
      return { totaleProdotti: rows.length, sottoScorta: sotto, valoreMagazzino: valore };
    }),
    movimenti: protectedProcedure
      .input(z.object({ prodottoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        return db.select().from(movimentiMagazzino)
          .where(and(eq(movimentiMagazzino.prodottoId, input.prodottoId), eq(movimentiMagazzino.companyId, actor.companyId), isNull(movimentiMagazzino.deletedAt)))
          .orderBy(desc(movimentiMagazzino.data));
      }),
    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        codice: z.string().optional(),
        categoria: z.string().optional(),
        unitaMisura: z.string().optional(),
        quantita: z.number().default(0),
        quantitaMinima: z.number().default(0),
        prezzoUnitario: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(prodotti).values(withCreate(actor, {
          ...input,
          quantita: String(input.quantita),
          quantitaMinima: String(input.quantitaMinima),
          prezzoUnitario: input.prezzoUnitario != null ? String(input.prezzoUnitario) : null,
        }) as any);
        return { success: true };
      }),
    movimento: protectedProcedure
      .input(z.object({
        prodottoId: z.string(),
        tipo: z.enum(["carico", "scarico"]),
        quantita: z.number().positive(),
        data: z.string(),
        descrizione: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(movimentiMagazzino).values(withCreate(actor, { ...input, quantita: String(input.quantita) }) as any);
        const [p] = await db.select().from(prodotti).where(eq(prodotti.id, input.prodottoId)).limit(1);
        if (p) {
          const nuova = input.tipo === "carico"
            ? Number(p.quantita) + input.quantita
            : Number(p.quantita) - input.quantita;
          await db.update(prodotti).set(withUpdate(actor, { quantita: String(Math.max(0, nuova)) }) as any).where(eq(prodotti.id, input.prodottoId));
        }
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(prodotti).set(softDeletePayload(actor) as any)
          .where(and(eq(prodotti.id, input.id), eq(prodotti.companyId, actor.companyId)));
        return { success: true };
      }),
  }),

  // ─── OFFICINA ────────────────────────────────────────────────────────────────
  officina: router({
    macchine: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        return db.select().from(macchine).where(and(eq(macchine.companyId, actor.companyId), isNull(macchine.deletedAt))).orderBy(macchine.nome);
      }),
      create: protectedProcedure
        .input(z.object({
          nome: z.string().min(1),
          marca: z.string().optional(),
          modello: z.string().optional(),
          targa: z.string().optional(),
          telaio: z.string().optional(),
          anno: z.number().optional(),
          oreTotali: z.number().optional(),
          stato: z.enum(["operativo", "manutenzione", "fermo"]).default("operativo"),
          note: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          const actor = await getActor(ctx);
          await db.insert(macchine).values(withCreate(actor, {
            ...input, oreTotali: input.oreTotali != null ? String(input.oreTotali) : "0",
          }) as any);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          const actor = await getActor(ctx);
          await db.update(macchine).set(softDeletePayload(actor) as any)
            .where(and(eq(macchine.id, input.id), eq(macchine.companyId, actor.companyId)));
          return { success: true };
        }),
    }),
    interventi: router({
      list: protectedProcedure
        .input(z.object({ macchinaId: z.string().optional() }).optional())
        .query(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) return [];
          const actor = await getActor(ctx);
          const conds = [eq(interventi.companyId, actor.companyId), isNull(interventi.deletedAt)];
          if (input?.macchinaId) conds.push(eq(interventi.macchinaId, input.macchinaId));
          return db.select().from(interventi).where(and(...conds)).orderBy(desc(interventi.data)).limit(50);
        }),
      create: protectedProcedure
        .input(z.object({
          macchinaId: z.string(),
          tipo: z.enum(["manutenzione", "riparazione", "revisione"]),
          descrizione: z.string().min(1),
          data: z.string(),
          priorita: z.enum(["alta", "media", "bassa"]).default("media"),
          stato: z.enum(["pianificato", "in_corso", "completato"]).default("pianificato"),
          costoManodopera: z.number().optional(),
          costoRicambi: z.number().optional(),
          operatore: z.string().optional(),
          note: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          const actor = await getActor(ctx);
          await db.insert(interventi).values(withCreate(actor, {
            ...input,
            costoManodopera: input.costoManodopera != null ? String(input.costoManodopera) : null,
            costoRicambi: input.costoRicambi != null ? String(input.costoRicambi) : null,
          }) as any);
          return { success: true };
        }),
      updateStato: protectedProcedure
        .input(z.object({ id: z.string(), stato: z.enum(["pianificato", "in_corso", "completato"]) }))
        .mutation(async ({ ctx, input }) => {
          const db = await getDb();
          if (!db) throw new Error("DB not available");
          const actor = await getActor(ctx);
          await db.update(interventi).set(withUpdate(actor, { stato: input.stato }) as any)
            .where(and(eq(interventi.id, input.id), eq(interventi.companyId, actor.companyId)));
          return { success: true };
        }),
    }),
  }),

  // ─── CALENDARIO ────────────────────────────────────────────────────────────
  calendario: router({
    list: protectedProcedure
      .input(z.object({ anno: z.number().optional(), mese: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        if (input?.anno && input?.mese) {
          const rows = (await db.execute(
            sql`SELECT * FROM eventi WHERE companyId=${actor.companyId} AND deletedAt IS NULL
                AND YEAR(dataInizio)=${input.anno} AND MONTH(dataInizio)=${input.mese} ORDER BY dataInizio LIMIT 200`
          ) as any[]);
          return (rows as any[])[0] as any[] ?? [];
        }
        return db.select().from(eventi).where(and(eq(eventi.companyId, actor.companyId), isNull(eventi.deletedAt))).orderBy(eventi.dataInizio).limit(100);
      }),
    create: protectedProcedure
      .input(z.object({
        titolo: z.string().min(1),
        descrizione: z.string().optional(),
        tipo: z.enum(["lavorazione", "manutenzione", "scadenza", "altro"]).default("altro"),
        data: z.string(),
        ora: z.string().optional(),
        priorita: z.enum(["bassa", "normale", "alta"]).default("normale"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(eventi).values(withCreate(actor, {
          titolo: input.titolo,
          descrizione: input.descrizione,
          tipo: input.tipo,
          dataInizio: new Date(input.data),
          tuttoIlGiorno: !input.ora,
          colore: input.priorita === "alta" ? "#f87171" : input.priorita === "normale" ? "#d4a843" : "#4ade80",
        }) as any);
        return { success: true };
      }),
    toggleCompletato: protectedProcedure
      .input(z.object({ id: z.string(), completato: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(eventi).set(withUpdate(actor, { completato: input.completato }) as any)
          .where(and(eq(eventi.id, input.id), eq(eventi.companyId, actor.companyId)));
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(eventi).set(softDeletePayload(actor) as any)
          .where(and(eq(eventi.id, input.id), eq(eventi.companyId, actor.companyId)));
        return { success: true };
      }),
  }),

  // ─── REPORT (Enterprise Metrics) ─────────────────────────────────────────────
  report: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { entrateTotali: 0, usciteTotali: 0, utileNetto: 0, roi: 0 };
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as e,
            COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as u
            FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL`
      ) as any[]);
      const r = (rows as any[])[0]?.[0] ?? {};
      const e = Number(r.e ?? 0), u = Number(r.u ?? 0);
      return { entrateTotali: e, usciteTotali: u, utileNetto: e - u, roi: u > 0 ? ((e - u) / u * 100) : 0 };
    }),
    finanza: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { mensile: [], categorieSpese: [] };
      const actor = await getActor(ctx);
      const mensile = (await db.execute(
        sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
            SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
            SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
            FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b') ORDER BY y, m`
      ) as any[]);
      const categorie = (await db.execute(
        sql`SELECT categoria as name, SUM(importo) as value FROM transazioni WHERE tipo='uscita' AND companyId=${actor.companyId} AND deletedAt IS NULL GROUP BY categoria ORDER BY value DESC LIMIT 5`
      ) as any[]);
      return { mensile: (mensile as any[])[0] as any[] ?? [], categorieSpese: (categorie as any[])[0] as any[] ?? [] };
    }),
    operativo: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return {};
      const actor = await getActor(ctx);
      const cid = actor.companyId;
      const count = async (table: string, extra = "") => {
        const r = (await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${table} WHERE companyId='${cid}' AND deletedAt IS NULL ${extra}`)) as any[]);
        return Number((r[0] as any[])[0]?.cnt ?? 0);
      };
      return {
        campiAttivi: await count("campi", "AND stato='attivo'"),
        macchineOperative: await count("macchine", "AND stato='operativo'"),
        interventiAperti: await count("interventi", "AND stato != 'completato'"),
        prodottiSottoScorta: await count("prodotti", "AND quantita <= quantitaMinima AND quantitaMinima > 0"),
        dataQuality: { completezza: 87, accuratezza: 94, tempestivita: 78, coerenza: 91 },
      };
    }),
  }),

  // ─── STALLA ────────────────────────────────────────────────────────────────
  stalla: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      return db.select().from(animali).where(and(eq(animali.companyId, actor.companyId), isNull(animali.deletedAt))).orderBy(animali.matricola);
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { sincronizzazioniOggi: 0, zoppieAperte: 0, trattamentiPianificati: 0, partiMese: 0 };
      const actor = await getActor(ctx);
      const cid = actor.companyId;
      const scalar = async (q: string) => {
        const r = (await db.execute(sql.raw(q)) as any[]);
        return Number((r[0] as any[])[0]?.cnt ?? 0);
      };
      return {
        sincronizzazioniOggi: await scalar(`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId='${cid}' AND deletedAt IS NULL AND tipo='sincronizzazione' AND stato='pianificato' AND DATE(dataTrattamento)=CURDATE()`),
        zoppieAperte: await scalar(`SELECT COUNT(*) as cnt FROM zoppie WHERE companyId='${cid}' AND deletedAt IS NULL AND stato!='risolta'`),
        trattamentiPianificati: await scalar(`SELECT COUNT(*) as cnt FROM trattamentiAnimali WHERE companyId='${cid}' AND deletedAt IS NULL AND stato='pianificato'`),
        partiMese: await scalar(`SELECT COUNT(*) as cnt FROM gravidanze WHERE companyId='${cid}' AND deletedAt IS NULL AND stato='in_corso' AND MONTH(dataPartoPrevisto)=MONTH(NOW()) AND YEAR(dataPartoPrevisto)=YEAR(NOW())`),
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
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(animali).values(withCreate(actor, input) as any);
        return { success: true };
      }),
    eseguiTrattamento: protectedProcedure
      .input(z.object({ animaleId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(trattamentiAnimali).set(withUpdate(actor, { stato: "eseguito" }) as any)
          .where(and(eq(trattamentiAnimali.animaleId, input.animaleId), eq(trattamentiAnimali.stato, "pianificato"), eq(trattamentiAnimali.companyId, actor.companyId)));
        return { success: true };
      }),
    zoppie: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      return db.select().from(zoppie).where(and(eq(zoppie.companyId, actor.companyId), isNull(zoppie.deletedAt))).orderBy(desc(zoppie.createdAt));
    }),
    addZoppia: protectedProcedure
      .input(z.object({
        animaleId: z.string(),
        dataRilevazione: z.string(),
        score: z.number().min(1).max(5).default(1),
        zampa: z.string().optional(),
        diagnosi: z.string().optional(),
        trattamento: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(zoppie).values(withCreate(actor, input) as any);
        return { success: true };
      }),
  }),

  // ─── REINTEGRAZIONE ──────────────────────────────────────────────────────────
  reintegrazione: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      const fondi = await db.select().from(fondiReintegrazione)
        .where(and(eq(fondiReintegrazione.companyId, actor.companyId), eq(fondiReintegrazione.attivo, true), isNull(fondiReintegrazione.deletedAt)))
        .orderBy(fondiReintegrazione.nomeDisplay);
      const result = [];
      for (const f of fondi) {
        const [mac] = await db.select().from(macchine).where(eq(macchine.id, f.macchinaId)).limit(1);
        result.push({ ...f, nomeMacchina: mac?.nome ?? f.nomeDisplay });
      }
      return result;
    }),
    totale: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { totale: 0, interessi: 0, fondiCount: 0 };
      const actor = await getActor(ctx);
      const rows = (await db.execute(
        sql`SELECT COALESCE(SUM(fondoAttuale),0) as totale, COALESCE(SUM(fondoAttuale*tassoInteresse),0) as interessi, COUNT(*) as cnt
            FROM fondiReintegrazione WHERE companyId=${actor.companyId} AND attivo=1 AND deletedAt IS NULL`
      ) as any[]);
      const r = (rows as any[])[0]?.[0] ?? {};
      return { totale: Number(r.totale ?? 0), interessi: Number(r.interessi ?? 0), fondiCount: Number(r.cnt ?? 0) };
    }),
    add: protectedProcedure
      .input(z.object({
        macchinaId: z.string(),
        nomeDisplay: z.string().min(1),
        valoreAcquisto: z.number().positive(),
        fondoAttuale: z.number().min(0).default(0),
        tassoInteresse: z.number().min(0).max(1).default(0.03),
        annoObiettivo: z.number().optional(),
        rataConsigliata: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.insert(fondiReintegrazione).values(withCreate(actor, {
          ...input,
          valoreAcquisto: String(input.valoreAcquisto),
          fondoAttuale: String(input.fondoAttuale),
          tassoInteresse: String(input.tassoInteresse),
          rataConsigliata: input.rataConsigliata != null ? String(input.rataConsigliata) : null,
        }) as any);
        return { success: true };
      }),
    pagaRata: protectedProcedure
      .input(z.object({ fondoId: z.string(), importo: z.number().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        const [fondo] = await db.select().from(fondiReintegrazione).where(eq(fondiReintegrazione.id, input.fondoId)).limit(1);
        if (!fondo) throw new Error("Fondo non trovato");
        const nuovoFondo = Number(fondo.fondoAttuale) + input.importo;
        await db.update(fondiReintegrazione).set(withUpdate(actor, { fondoAttuale: String(nuovoFondo) }) as any).where(eq(fondiReintegrazione.id, input.fondoId));
        await db.insert(rateReintegrazione).values(withCreate(actor, {
          fondoId: input.fondoId, importo: String(input.importo), data: new Date().toISOString().split("T")[0], pagata: true,
        }) as any);
        return { success: true };
      }),
    rate: protectedProcedure
      .input(z.object({ fondoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        return db.select().from(rateReintegrazione)
          .where(and(eq(rateReintegrazione.fondoId, input.fondoId), eq(rateReintegrazione.companyId, actor.companyId), isNull(rateReintegrazione.deletedAt)))
          .orderBy(desc(rateReintegrazione.data));
      }),
  }),

  // ─── AI COPILOT ──────────────────────────────────────────────────────────────
  ai: router({
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const actor = await getActor(ctx);
      return db.select().from(chatSessions)
        .where(and(eq(chatSessions.companyId, actor.companyId), eq(chatSessions.userId, ctx.user.id), isNull(chatSessions.deletedAt)))
        .orderBy(desc(chatSessions.createdAt)).limit(20);
    }),
    messages: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const actor = await getActor(ctx);
        return db.select().from(chatMessages)
          .where(and(eq(chatMessages.sessionId, input.sessionId), eq(chatMessages.companyId, actor.companyId), isNull(chatMessages.deletedAt)))
          .orderBy(chatMessages.createdAt);
      }),
    newSession: protectedProcedure
      .input(z.object({ titolo: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        const id = crypto.randomUUID();
        await db.insert(chatSessions).values(withCreate(actor, {
          id, userId: ctx.user.id, titolo: input.titolo ?? "Nuova conversazione",
        }) as any);
        return { sessionId: id };
      }),
    chat: protectedProcedure
      .input(z.object({ sessionId: z.string(), message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);

        await db.insert(chatMessages).values(withCreate(actor, { id: crypto.randomUUID(), sessionId: input.sessionId, ruolo: "user", contenuto: input.message }) as any);

        const kpiRows = (await db.execute(
          sql`SELECT COALESCE(SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END),0) as entrate,
              COALESCE(SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END),0) as uscite
              FROM transazioni WHERE companyId=${actor.companyId} AND deletedAt IS NULL AND MONTH(data)=MONTH(CURDATE()) AND YEAR(data)=YEAR(CURDATE())`
        ) as any[]);
        const kpi = (kpiRows as any[])[0]?.[0] ?? {};

        const systemPrompt = `Sei il Copilot AI di Fallinity FEOS, il sistema operativo per aziende agricole.
Rispondi SEMPRE in italiano con approccio "Explainable AI": ogni suggerimento deve essere motivato e trasparente, spiegando il ragionamento.

CONTESTO AZIENDALE (mese corrente):
- Entrate: €${Number(kpi.entrate ?? 0).toLocaleString('it-IT')}
- Uscite: €${Number(kpi.uscite ?? 0).toLocaleString('it-IT')}
- Utile netto: €${(Number(kpi.entrate ?? 0) - Number(kpi.uscite ?? 0)).toLocaleString('it-IT')}

Principi Fallinity DNA: Entity First, Event Driven, Decision First, Explainable AI, Enterprise Memory.`;

        const history = await db.select().from(chatMessages)
          .where(and(eq(chatMessages.sessionId, input.sessionId), eq(chatMessages.companyId, actor.companyId), isNull(chatMessages.deletedAt)))
          .orderBy(chatMessages.createdAt).limit(20);
        const messages = [
          ...history.slice(0, -1).map(m => ({ role: m.ruolo as "user" | "assistant", content: m.contenuto })),
          { role: "user" as const, content: input.message },
        ];

        const response = await invokeLLM({ messages: [{ role: "system", content: systemPrompt }, ...messages] });
        const rawContent = response.choices?.[0]?.message?.content;
        const assistantContent = typeof rawContent === 'string' ? rawContent : "Mi dispiace, non ho potuto elaborare la risposta.";

        await db.insert(chatMessages).values(withCreate(actor, { id: crypto.randomUUID(), sessionId: input.sessionId, ruolo: "assistant", contenuto: assistantContent }) as any);

        if (history.length <= 1) {
          const shortTitle = input.message.slice(0, 50) + (input.message.length > 50 ? "..." : "");
          await db.update(chatSessions).set(withUpdate(actor, { titolo: shortTitle }) as any)
            .where(and(eq(chatSessions.id, input.sessionId), eq(chatSessions.companyId, actor.companyId)));
        }
        return { content: assistantContent };
      }),
    deleteSession: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const actor = await getActor(ctx);
        await db.update(chatMessages).set(softDeletePayload(actor) as any)
          .where(and(eq(chatMessages.sessionId, input.id), eq(chatMessages.companyId, actor.companyId)));
        await db.update(chatSessions).set(softDeletePayload(actor) as any)
          .where(and(eq(chatSessions.id, input.id), eq(chatSessions.companyId, actor.companyId)));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
