import { sql } from "drizzle-orm";
import { getDb } from "../../db";

/** REPORT (Enterprise Metrics) — Repository */
export const reportRepository = {
  async monthlySeries(companyId: string) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT DATE_FORMAT(data,'%b') as mese, MONTH(data) as m, YEAR(data) as y,
          SUM(CASE WHEN tipo='entrata' THEN importo ELSE 0 END) as entrate,
          SUM(CASE WHEN tipo='uscita' THEN importo ELSE 0 END) as uscite
          FROM transazioni WHERE companyId=${companyId} AND deletedAt IS NULL AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY YEAR(data), MONTH(data), DATE_FORMAT(data,'%b') ORDER BY y, m`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },

  async categorieSpese(companyId: string) {
    const db = await getDb();
    if (!db) return [] as any[];
    const rows = (await db.execute(
      sql`SELECT categoria as name, SUM(importo) as value FROM transazioni
          WHERE tipo='uscita' AND companyId=${companyId} AND deletedAt IS NULL GROUP BY categoria ORDER BY value DESC LIMIT 5`,
    ) as any[]);
    return (rows as any[])[0] as any[] ?? [];
  },
};
