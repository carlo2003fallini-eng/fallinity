import type { ActorContext } from "../_core";
import { coreRepository as repo } from "./repository";
import { financeRepository } from "../finance/repository";
import { proposalsRepository } from "../finance/proposals.repository";
import type { CreateContattoInput, UpdateCompanyAreasOrderInput } from "./validators";

const COMPANY_AREAS_DEFAULT_ORDER = ["stalla", "magazzino", "officina", "campi"] as const;

function normalizzaOrdineAree(value: unknown) {
  const ordine = Array.isArray(value)
    ? value.filter((item): item is (typeof COMPANY_AREAS_DEFAULT_ORDER)[number] => typeof item === "string" && COMPANY_AREAS_DEFAULT_ORDER.includes(item as any))
    : [];
  const unico = ordine.filter((item, index) => ordine.indexOf(item) === index);
  return [...unico, ...COMPANY_AREAS_DEFAULT_ORDER.filter((item) => !unico.includes(item))];
}

/** CORE — Service (company, contatti/azienda, dashboard) */
export const coreService = {
  currentCompany(companyId: string) {
    return repo.currentCompany(companyId);
  },

  listContatti(companyId: string, tipo?: "dipendente" | "fornitore" | "cliente") {
    return repo.listContatti(companyId, tipo);
  },

  async contattiStats(companyId: string) {
    const rows = await repo.allContatti(companyId);
    return {
      totale: rows.length,
      dipendenti: rows.filter((r) => r.tipo === "dipendente").length,
      fornitori: rows.filter((r) => r.tipo === "fornitore").length,
      clienti: rows.filter((r) => r.tipo === "cliente").length,
    };
  },

  createContatto(actor: ActorContext, input: CreateContattoInput) {
    return repo.insertContatto(actor, input);
  },

  removeContatto(actor: ActorContext, id: string) {
    return repo.softDeleteContatto(actor, id);
  },

  async companyAreasOrder(actor: ActorContext) {
    const preference = await repo.getCompanyAreasOrder(actor);
    return {
      ordine: normalizzaOrdineAree(preference?.ordine),
      salvato: Boolean(preference),
    };
  },

  async saveCompanyAreasOrder(actor: ActorContext, input: UpdateCompanyAreasOrderInput) {
    await repo.saveCompanyAreasOrder(actor, input.ordine);
    return { ordine: input.ordine, salvato: true as const };
  },

  /** KPI globali per la dashboard Home (con dati finanziari reali + proposte). */
  async dashboardKpi(companyId: string) {
    const { entrate, uscite } = await financeRepository.sumEntrateUscite(companyId);
    const [campi, macchine, animali, interventiAperti, prodottiSottoScorta, zoppieAttive] = await Promise.all([
      repo.count(companyId, "campi", "AND stato='attivo'"),
      repo.count(companyId, "macchine"),
      repo.count(companyId, "animali", "AND stato NOT IN ('venduta','morta')"),
      repo.count(companyId, "interventi", "AND stato != 'completato'"),
      repo.count(companyId, "prodotti", "AND quantita <= quantitaMinima AND quantitaMinima > 0"),
      repo.count(companyId, "zoppie", "AND stato != 'risolta'"),
    ]);

    // Proposte da esaminare
    let proposteDaEsaminare = 0;
    try {
      const counts = await proposalsRepository.countByStato(companyId);
      const daEsaminare = counts.find((c: any) => c.stato === "da_esaminare");
      proposteDaEsaminare = daEsaminare ? Number(daEsaminare.count) : 0;
    } catch { /* non bloccare */ }

    return {
      entrate, uscite, utile: entrate - uscite,
      campi, macchine, animali, interventiAperti, prodottiSottoScorta, zoppieAttive,
      proposteDaEsaminare,
    };
  },

  chartData(companyId: string) {
    return financeRepository.monthlySeries(companyId);
  },

  recentActivity(companyId: string) {
    return financeRepository.recentActivity(companyId);
  },
};
