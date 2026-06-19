import { reportRepository as repo } from "./repository";
import { financeService } from "../finance/service";
import { coreRepository } from "../core/repository";

/** REPORT (Enterprise Metrics) — Service */
export const reportService = {
  summary(companyId: string) {
    return financeService.reportSummary(companyId);
  },

  async finanza(companyId: string) {
    const [mensile, categorieSpese] = await Promise.all([
      repo.monthlySeries(companyId),
      repo.categorieSpese(companyId),
    ]);
    return { mensile, categorieSpese };
  },

  async operativo(companyId: string) {
    const [campiAttivi, macchineOperative, interventiAperti, prodottiSottoScorta] = await Promise.all([
      coreRepository.count(companyId, "campi", "AND stato='attivo'"),
      coreRepository.count(companyId, "macchine", "AND stato='operativo'"),
      coreRepository.count(companyId, "interventi", "AND stato != 'completato'"),
      coreRepository.count(companyId, "prodotti", "AND quantita <= quantitaMinima AND quantitaMinima > 0"),
    ]);
    return {
      campiAttivi, macchineOperative, interventiAperti, prodottiSottoScorta,
      dataQuality: { completezza: 87, accuratezza: 94, tempestivita: 78, coerenza: 91 },
    };
  },
};
