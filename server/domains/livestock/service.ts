import type { ActorContext } from "../_core";
import { livestockRepository as repo } from "./repository";
import type {
  AddAnimaleInput, AddZoppiaInput, CreateGruppoInput,
  UpdateGruppoInput, UpdateAnimaleInput, AddEventoAnimaleInput,
  FiltriGruppiInput,
} from "./validators";

/** LIVESTOCK (Stalla) — Service */
export const livestockService = {
  // ── Legacy (retrocompatibilità Azienda.tsx / vecchia Stalla.tsx) ──
  list(companyId: string) {
    return repo.listAnimali(companyId);
  },
  stats(companyId: string) {
    return repo.stats(companyId);
  },
  zoppie(companyId: string) {
    return repo.listZoppie(companyId);
  },
  addAnimale(actor: ActorContext, input: AddAnimaleInput) {
    return repo.insertAnimale(actor, input);
  },
  addZoppia(actor: ActorContext, input: AddZoppiaInput) {
    return repo.insertZoppia(actor, input);
  },
  eseguiTrattamento(actor: ActorContext, animaleId: string) {
    return repo.eseguiTrattamento(actor, animaleId);
  },

  // ── Gruppi ──
  async listGruppi(companyId: string, filtri?: FiltriGruppiInput) {
    const allGruppi = await repo.listGruppi(companyId);
    const allAnimali = await repo.listAnimali(companyId);

    // Arricchisci ogni gruppo con contatori e produzione media
    const enriched = allGruppi.map(g => {
      const membri = allAnimali.filter(a => a.gruppoId === g.id);
      const inLattazione = membri.filter(a => a.statoProduttivo === "in_lattazione").length;
      const gravide = membri.filter(a => a.statoRiproduttivo === "gravida").length;
      const manze = membri.filter(a => a.statoProduttivo === "manza").length;
      const produzioneMedia = inLattazione > 0
        ? membri.filter(a => a.statoProduttivo === "in_lattazione")
            .reduce((sum, a) => sum + Number(a.produzioneOggi ?? 0), 0) / inLattazione
        : 0;
      const hasAlert = membri.some(a => (a.healthScore ?? 100) < 70);
      const hasTrattamenti = false; // TODO: join trattamenti se necessario
      return {
        ...g,
        nAnimali: membri.length,
        inLattazione,
        gravide,
        manze,
        produzioneMedia: Math.round(produzioneMedia * 10) / 10,
        hasAlert,
        hasTrattamenti,
      };
    });

    // Applica filtri
    if (!filtri) return enriched;
    let result = enriched;
    if (filtri.tipologia) result = result.filter(g => g.tipologia === filtri.tipologia);
    if (filtri.stato) result = result.filter(g => g.stato === filtri.stato);
    if (filtri.conAlert) result = result.filter(g => g.hasAlert);
    if (filtri.conGravide) result = result.filter(g => g.gravide > 0);
    if (filtri.inLattazione) result = result.filter(g => g.inLattazione > 0);
    if (filtri.conTrattamenti) result = result.filter(g => g.hasTrattamenti);
    if (filtri.produzioneSottoMedia) {
      const mediaGlobale = enriched.reduce((s, g) => s + g.produzioneMedia, 0) / (enriched.length || 1);
      result = result.filter(g => g.produzioneMedia > 0 && g.produzioneMedia < mediaGlobale);
    }
    if (filtri.ricerca) {
      const q = filtri.ricerca.toLowerCase();
      result = result.filter(g => g.nome.toLowerCase().includes(q) || g.codice?.toLowerCase().includes(q));
    }
    return result;
  },

  async createGruppo(actor: ActorContext, input: CreateGruppoInput) {
    const count = await repo.countGruppi(actor.companyId);
    const codice = `GRP-${String(count + 1).padStart(3, "0")}`;
    return repo.insertGruppo(actor, { ...input, codice });
  },

  async updateGruppo(actor: ActorContext, input: UpdateGruppoInput) {
    const { id, ...data } = input;
    return repo.updateGruppo(actor, id, data);
  },

  async archiveGruppo(actor: ActorContext, id: string) {
    return repo.archiveGruppo(actor, id);
  },

  async getGruppoDetail(companyId: string, id: string) {
    const gruppo = await repo.getGruppo(companyId, id);
    if (!gruppo) return null;
    const membri = await repo.listAnimaliByGruppo(companyId, id);
    const stats = await repo.countAnimaliByGruppo(companyId, id);
    const produzioneMedia = await repo.produzioneMediaGruppo(companyId, id);
    return { ...gruppo, membri, stats, produzioneMedia };
  },

  // ── Animali ──
  async createAnimale(actor: ActorContext, input: AddAnimaleInput) {
    return repo.insertAnimale(actor, input);
  },

  async updateAnimale(actor: ActorContext, input: UpdateAnimaleInput) {
    const { id, ...data } = input;
    return repo.updateAnimale(actor, id, data);
  },

  async spostaGruppo(actor: ActorContext, animaleId: string, nuovoGruppoId: string) {
    // Aggiorna il gruppoId dell'animale
    await repo.updateAnimale(actor, animaleId, { gruppoId: nuovoGruppoId });
    // Registra evento spostamento
    await repo.insertEventoAnimale(actor, {
      animaleId,
      tipo: "spostamento_gruppo",
      data: new Date(),
      descrizione: `Spostato al gruppo ${nuovoGruppoId}`,
    });
    return { success: true };
  },

  // ── Ricerca universale ──
  async ricerca(companyId: string, query: string) {
    const results = await repo.ricercaAnimali(companyId, query);
    return results.map(a => ({
      id: a.id,
      numeroAziendale: a.numeroAziendale,
      matricola: a.matricola,
      nome: a.nome,
      gruppo: a.gruppo,
      gruppoId: a.gruppoId,
      statoProduttivo: a.statoProduttivo,
      statoRiproduttivo: a.statoRiproduttivo,
      produzioneOggi: a.produzioneOggi,
      healthScore: a.healthScore,
      hasAlert: (a.healthScore ?? 100) < 70,
    }));
  },

  // ── Scheda Animale ──
  async schedaAnimale(companyId: string, id: string) {
    const animale = await repo.getAnimale(companyId, id);
    if (!animale) return null;
    const eventi = await repo.listEventiAnimale(companyId, id);
    return { ...animale, eventi };
  },

  // ── Eventi ──
  async addEvento(actor: ActorContext, input: AddEventoAnimaleInput) {
    return repo.insertEventoAnimale(actor, { ...input, data: new Date(input.data) });
  },
};
