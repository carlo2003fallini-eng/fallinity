import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { reportConfigs, reportHistory } from "../../../drizzle/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { getActor } from "../_core";

// ─── VALIDATORS ─────────────────────────────────────────────────────────────────

const reportFiltersSchema = z.object({
  dataInizio: z.string(),
  dataFine: z.string(),
  tipo: z.enum(["cassa", "competenza"]).default("cassa"),
  centroCostoId: z.string().optional(),
  categoriaId: z.string().optional(),
  modulo: z.string().optional(),
  soggettoId: z.string().optional(),
});

export const generateReportInput = z.object({
  tipo: z.enum(["economico", "cashflow", "budget", "reintegrazione", "fornitori", "clienti", "centri_costo", "completo"]),
  filtri: reportFiltersSchema,
  formato: z.enum(["json", "csv"]).default("json"),
});

export const createReportConfigInput = z.object({
  nome: z.string().min(1).max(255),
  tipo: z.enum(["economico", "cashflow", "budget", "reintegrazione", "fornitori", "clienti", "centri_costo", "completo"]),
  filtri: reportFiltersSchema,
  periodicita: z.enum(["giornaliero", "settimanale", "mensile", "trimestrale"]).optional(),
});

export const updateReportConfigInput = z.object({
  id: z.string(),
  nome: z.string().min(1).max(255).optional(),
  filtri: reportFiltersSchema.optional(),
  periodicita: z.enum(["giornaliero", "settimanale", "mensile", "trimestrale"]).nullish(),
  stato: z.enum(["attivo", "disattivato"]).optional(),
});

// ─── SERVICE ────────────────────────────────────────────────────────────────────

async function generateReport(companyId: string, input: z.infer<typeof generateReportInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { tipo, filtri } = input;
  let risultati: any = {};

  switch (tipo) {
    case "economico":
      risultati = await generateEconomicoReport(companyId, filtri);
      break;
    case "cashflow":
      risultati = await generateCashflowReport(companyId, filtri);
      break;
    case "budget":
      risultati = await generateBudgetReport(companyId, filtri);
      break;
    case "reintegrazione":
      risultati = await generateReintegrazioneReport(companyId);
      break;
    case "fornitori":
      risultati = await generateFornitoriReport(companyId, filtri);
      break;
    case "clienti":
      risultati = await generateClientiReport(companyId, filtri);
      break;
    case "centri_costo":
      risultati = await generateCentriCostoReport(companyId, filtri);
      break;
    case "completo":
      risultati = {
        economico: await generateEconomicoReport(companyId, filtri),
        cashflow: await generateCashflowReport(companyId, filtri),
        budget: await generateBudgetReport(companyId, filtri),
        reintegrazione: await generateReintegrazioneReport(companyId),
      };
      break;
  }

  // Salva nello storico
  const historyId = crypto.randomUUID();
  await db.insert(reportHistory).values({
    id: historyId,
    companyId,
    dataGenerazione: new Date().toISOString().split("T")[0],
    operatore: userId,
    filtri: JSON.stringify(filtri),
    risultati: JSON.stringify(risultati),
  } as any);

  // Se formato CSV, converti
  if (input.formato === "csv") {
    return { id: historyId, csv: convertToCsv(risultati, tipo), risultati };
  }

  return { id: historyId, risultati };
}

async function generateEconomicoReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};
  
  let whereExtra = "";
  if (filtri.centroCostoId) whereExtra += ` AND centroCostoId='${filtri.centroCostoId}'`;
  if (filtri.categoriaId) whereExtra += ` AND categoriaId='${filtri.categoriaId}'`;
  if (filtri.soggettoId) whereExtra += ` AND soggettoId='${filtri.soggettoId}'`;

  const rows = (await db.execute(
    sql.raw(`SELECT 
      COALESCE(SUM(CASE WHEN tipo='entrata' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as entrate,
      COALESCE(SUM(CASE WHEN tipo='uscita' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as uscite,
      COUNT(*) as movimenti
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= '${filtri.dataInizio}' AND data <= '${filtri.dataFine}'${whereExtra}`),
  ) as any[]);
  const r = (rows as any[])[0]?.[0] ?? {};
  
  // Dettaglio per categoria
  const catRows = (await db.execute(
    sql.raw(`SELECT 
      categoriaId, tipo,
      COALESCE(SUM(CAST(importo AS DECIMAL(14,2))),0) as totale,
      COUNT(*) as movimenti
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= '${filtri.dataInizio}' AND data <= '${filtri.dataFine}'${whereExtra}
    GROUP BY categoriaId, tipo
    ORDER BY totale DESC`),
  ) as any[]);

  return {
    periodo: { da: filtri.dataInizio, a: filtri.dataFine },
    entrate: Number(r.entrate ?? 0),
    uscite: Number(r.uscite ?? 0),
    utile: Number(r.entrate ?? 0) - Number(r.uscite ?? 0),
    movimenti: Number(r.movimenti ?? 0),
    dettaglioCategorie: ((catRows as any[])[0] ?? []).map((c: any) => ({
      categoriaId: c.categoriaId,
      tipo: c.tipo,
      totale: Number(c.totale),
      movimenti: Number(c.movimenti),
    })),
  };
}

async function generateCashflowReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT 
      DATE_FORMAT(data, '%Y-%m') as mese,
      COALESCE(SUM(CASE WHEN tipo='entrata' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as entrate,
      COALESCE(SUM(CASE WHEN tipo='uscita' THEN CAST(importo AS DECIMAL(14,2)) ELSE 0 END),0) as uscite
    FROM movimentiFinanziari 
    WHERE companyId='${companyId}' AND deletedAt IS NULL 
    AND data >= '${filtri.dataInizio}' AND data <= '${filtri.dataFine}'
    GROUP BY DATE_FORMAT(data, '%Y-%m')
    ORDER BY mese`),
  ) as any[]);

  return {
    periodo: { da: filtri.dataInizio, a: filtri.dataFine },
    mesi: ((rows as any[])[0] ?? []).map((r: any) => ({
      mese: r.mese,
      entrate: Number(r.entrate),
      uscite: Number(r.uscite),
      netto: Number(r.entrate) - Number(r.uscite),
    })),
  };
}

async function generateBudgetReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT id, nome, tipo, importoPrevisto, stato FROM budgets 
    WHERE companyId='${companyId}' AND deletedAt IS NULL AND stato='attivo'`),
  ) as any[]);

  return {
    budgets: ((rows as any[])[0] ?? []).map((b: any) => ({
      id: b.id,
      nome: b.nome,
      tipo: b.tipo,
      importoPrevisto: Number(b.importoPrevisto),
      stato: b.stato,
    })),
  };
}

async function generateReintegrazioneReport(companyId: string) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT id, nome, valoreSostituzione, dataSostituzione, capitaleNecessario, capitaleAccantonato, percentualeCopertura, stato, priorita
    FROM replacementPlans WHERE companyId='${companyId}' AND deletedAt IS NULL`),
  ) as any[]);

  return {
    piani: ((rows as any[])[0] ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      valoreSostituzione: Number(p.valoreSostituzione),
      dataSostituzione: p.dataSostituzione,
      capitaleNecessario: Number(p.capitaleNecessario),
      capitaleAccantonato: Number(p.capitaleAccantonato),
      percentualeCopertura: Number(p.percentualeCopertura),
      stato: p.stato,
      priorita: p.priorita,
    })),
  };
}

async function generateFornitoriReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT 
      c.id, c.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as spesa,
      COUNT(m.id) as movimenti
    FROM contatti c
    LEFT JOIN movimentiFinanziari m ON m.soggettoId=c.id AND m.tipo='uscita' AND m.deletedAt IS NULL 
      AND m.data >= '${filtri.dataInizio}' AND m.data <= '${filtri.dataFine}'
    WHERE c.companyId='${companyId}' AND c.deletedAt IS NULL AND c.tipo IN ('fornitore','entrambi')
    GROUP BY c.id, c.nome
    ORDER BY spesa DESC`),
  ) as any[]);

  return {
    periodo: { da: filtri.dataInizio, a: filtri.dataFine },
    fornitori: ((rows as any[])[0] ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      spesa: Number(r.spesa),
      movimenti: Number(r.movimenti),
    })),
  };
}

async function generateClientiReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT 
      c.id, c.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as ricavi,
      COUNT(m.id) as movimenti
    FROM contatti c
    LEFT JOIN movimentiFinanziari m ON m.soggettoId=c.id AND m.tipo='entrata' AND m.deletedAt IS NULL 
      AND m.data >= '${filtri.dataInizio}' AND m.data <= '${filtri.dataFine}'
    WHERE c.companyId='${companyId}' AND c.deletedAt IS NULL AND c.tipo IN ('cliente','entrambi')
    GROUP BY c.id, c.nome
    ORDER BY ricavi DESC`),
  ) as any[]);

  return {
    periodo: { da: filtri.dataInizio, a: filtri.dataFine },
    clienti: ((rows as any[])[0] ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      ricavi: Number(r.ricavi),
      movimenti: Number(r.movimenti),
    })),
  };
}

async function generateCentriCostoReport(companyId: string, filtri: z.infer<typeof reportFiltersSchema>) {
  const db = await getDb();
  if (!db) return {};

  const rows = (await db.execute(
    sql.raw(`SELECT 
      cc.id, cc.nome,
      COALESCE(SUM(CAST(m.importo AS DECIMAL(14,2))),0) as spesa,
      COUNT(m.id) as movimenti
    FROM centriCosto cc
    LEFT JOIN movimentiFinanziari m ON m.centroCostoId=cc.id AND m.tipo='uscita' AND m.deletedAt IS NULL 
      AND m.data >= '${filtri.dataInizio}' AND m.data <= '${filtri.dataFine}'
    WHERE cc.companyId='${companyId}' AND cc.deletedAt IS NULL
    GROUP BY cc.id, cc.nome
    ORDER BY spesa DESC`),
  ) as any[]);

  return {
    periodo: { da: filtri.dataInizio, a: filtri.dataFine },
    centri: ((rows as any[])[0] ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      spesa: Number(r.spesa),
      movimenti: Number(r.movimenti),
    })),
  };
}

function convertToCsv(data: any, tipo: string): string {
  let rows: string[] = [];
  if (tipo === "economico" && data.dettaglioCategorie) {
    rows.push("categoriaId,tipo,totale,movimenti");
    for (const c of data.dettaglioCategorie) {
      rows.push(`${c.categoriaId || ""},${c.tipo},${c.totale},${c.movimenti}`);
    }
  } else if (tipo === "cashflow" && data.mesi) {
    rows.push("mese,entrate,uscite,netto");
    for (const m of data.mesi) {
      rows.push(`${m.mese},${m.entrate},${m.uscite},${m.netto}`);
    }
  } else if (tipo === "fornitori" && data.fornitori) {
    rows.push("id,nome,spesa,movimenti");
    for (const f of data.fornitori) {
      rows.push(`${f.id},"${f.nome}",${f.spesa},${f.movimenti}`);
    }
  } else if (tipo === "clienti" && data.clienti) {
    rows.push("id,nome,ricavi,movimenti");
    for (const c of data.clienti) {
      rows.push(`${c.id},"${c.nome}",${c.ricavi},${c.movimenti}`);
    }
  }
  return rows.join("\n");
}

// ─── CONFIGS ────────────────────────────────────────────────────────────────────

async function createConfig(companyId: string, input: z.infer<typeof createReportConfigInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = crypto.randomUUID();
  await db.insert(reportConfigs).values({
    id,
    companyId,
    nome: input.nome,
    tipo: input.tipo,
    filtri: JSON.stringify(input.filtri),
    periodicita: input.periodicita,
    stato: "attivo",
    createdBy: userId,
    updatedBy: userId,
  } as any);
  return { id };
}

async function updateConfig(companyId: string, input: z.infer<typeof updateReportConfigInput>, userId?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: Record<string, any> = { updatedBy: userId };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.filtri !== undefined) updates.filtri = JSON.stringify(input.filtri);
  if (input.periodicita !== undefined) updates.periodicita = input.periodicita;
  if (input.stato !== undefined) updates.stato = input.stato;
  await db.update(reportConfigs).set(updates)
    .where(and(eq(reportConfigs.id, input.id), eq(reportConfigs.companyId, companyId)));
}

async function listConfigs(companyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportConfigs).where(eq(reportConfigs.companyId, companyId));
}

async function getHistory(companyId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportHistory)
    .where(eq(reportHistory.companyId, companyId))
    .orderBy(desc(reportHistory.dataGenerazione))
    .limit(limit);
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────────

export const reportsRouter = router({
  generate: protectedProcedure
    .input(generateReportInput)
    .mutation(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return generateReport(actor.companyId, input, actor.userUuid);
    }),

  configs: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const actor = await getActor(ctx);
        return listConfigs(actor.companyId);
      }),

    create: protectedProcedure
      .input(createReportConfigInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return createConfig(actor.companyId, input, actor.userUuid);
      }),

    update: protectedProcedure
      .input(updateReportConfigInput)
      .mutation(async ({ ctx, input }) => {
        const actor = await getActor(ctx);
        return updateConfig(actor.companyId, input, actor.userUuid);
      }),
  }),

  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const actor = await getActor(ctx);
      return getHistory(actor.companyId, input?.limit ?? 20);
    }),
});
