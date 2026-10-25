import { livestockRepository as repo } from "./repository";
import type { ActorContext } from "../_core";
import { proposalsService } from "../finance/proposals.service";
import type {
  CreateGruppoInput, UpdateGruppoInput, AddAnimaleInput, UpdateAnimaleInput,
  AddZoppiaInput, AddEventoAnimaleInput, FiltriGruppiInput, FiltriAnimaliInput,
  SpostaGruppoInput, SpostaMultiploInput, AnteprimaFattoriInput, CreateTrattamentoInput,
  DisponibiliPerAggiuntaInput, AnteprimaAggiuntaMultiplaInput, AggiungiMultiploInput,
  ReplaceGruppiPersonalizzatiInput, RegolaAutomaticaInput,
} from "./validators";
import { randomUUID as uuid } from "crypto";

/** Effetti potenziali dei fattori di un gruppo sulla singola anagrafica. */
type EffettoFattore = { campo: string; valoreAttuale: string | null; valoreNuovo: string | null; modalita: string };
type GruppoRecord = Record<string, any>;
type AnimaleRecord = Record<string, any>;

/** Calcola i fattori applicabili al momento dell'ingresso nel gruppo. */
function calcolaEffettiFattori(gruppo: GruppoRecord, animale: AnimaleRecord): EffettoFattore[] {
  const effetti: EffettoFattore[] = [];
  if (!gruppo.applicaFattoriPredefiniti) return effetti;
  if (gruppo.statoProduttivoPredefinito && gruppo.modalitaStatoProduttivo !== "non_applicare") {
    const valoreAttuale = animale.statoProduttivo ?? null;
    const valoreNuovo = gruppo.statoProduttivoPredefinito as string;
    if (valoreAttuale !== valoreNuovo) effetti.push({ campo: "statoProduttivo", valoreAttuale, valoreNuovo, modalita: gruppo.modalitaStatoProduttivo });
  }
  if (gruppo.statoRiproduttivoPredefinito && gruppo.modalitaStatoRiproduttivo !== "non_applicare") {
    const valoreAttuale = animale.statoRiproduttivo ?? null;
    const valoreNuovo = gruppo.statoRiproduttivoPredefinito as string;
    if (valoreAttuale !== valoreNuovo) effetti.push({ campo: "statoRiproduttivo", valoreAttuale, valoreNuovo, modalita: gruppo.modalitaStatoRiproduttivo });
  }
  return effetti;
}

/** Applica solo i fattori automatici e quelli confermati esplicitamente dall'utente. */
function buildPatchFromFattori(effetti: EffettoFattore[], conferma: boolean) {
  const patch: Record<string, unknown> = {};
  for (const effetto of effetti) {
    if (effetto.modalita === "automatico" || (effetto.modalita === "conferma" && conferma)) patch[effetto.campo] = effetto.valoreNuovo;
  }
  return patch;
}

function gestioneGruppo(gruppo: GruppoRecord) {
  return gruppo.tipoGestione === "automatico" ? "automatico" : "manuale";
}

function membriDelGruppo(
  gruppo: GruppoRecord,
  animali: AnimaleRecord[],
  associazioni: Array<Record<string, any>>,
  ultimoPartoByAnimale: Map<string, Date>,
) {
  if (gestioneGruppo(gruppo) === "automatico") {
    const regola = gruppo.regolaAutomatica as RegolaAutomaticaInput | null;
    if (!regola) return [];
    if (regola.tipo === "alta_produzione") {
      return animali.filter((animale) => animale.statoProduttivo === "in_lattazione" && Number(animale.produzioneOggi ?? 0) >= regola.sogliaLitriGiorno);
    }
    const limite = Date.now() - regola.giorniMassimi * 24 * 60 * 60 * 1000;
    return animali.filter((animale) => (ultimoPartoByAnimale.get(animale.id)?.getTime() ?? 0) >= limite);
  }
  if (gruppo.modalitaMembri === "personalizzato") {
    const ids = new Set(associazioni.filter((associazione) => associazione.gruppoId === gruppo.id).map((associazione) => associazione.animaleId));
    return animali.filter((animale) => ids.has(animale.id));
  }
  return animali.filter((animale) => animale.gruppoId === gruppo.id);
}

function statsGruppo(membri: AnimaleRecord[]) {
  const inLattazione = membri.filter((animale) => animale.statoProduttivo === "in_lattazione");
  const produzioneMedia = membri.length === 0
    ? null
    : inLattazione.length > 0
      ? Math.round((inLattazione.reduce((totale, animale) => totale + Number(animale.produzioneOggi ?? 0), 0) / inLattazione.length) * 10) / 10
      : 0;
  return {
    nAnimali: membri.length,
    inLattazione: inLattazione.length,
    gravide: membri.filter((animale) => animale.statoRiproduttivo === "gravida").length,
    manze: membri.filter((animale) => animale.statoProduttivo === "manza").length,
    produzioneMedia,
    hasAlert: membri.some((animale) => (animale.healthScore ?? 100) < 70),
    hasTrattamenti: false,
  };
}

function sourceLabel(gruppo: GruppoRecord | undefined) {
  if (!gruppo) return { key: "ungrouped", gruppoId: null, nome: "Senza gruppo", codice: null, tipologia: "senza_gruppo" };
  return { key: `group:${gruppo.id}`, gruppoId: gruppo.id, nome: gruppo.nome, codice: gruppo.codice ?? null, tipologia: gruppo.tipologia };
}

export const livestockService = {
  async list(companyId: string) { return repo.listAnimali(companyId); },
  async listAnimaliFiltrati(companyId: string, filtri?: FiltriAnimaliInput) { return repo.listAnimaliFiltrati(companyId, filtri); },
  async stats(companyId: string) { return repo.stats(companyId); },
  async zoppie(companyId: string) { return repo.listZoppie(companyId); },
  async addAnimale(actor: ActorContext, input: Record<string, unknown>) { return repo.insertAnimale(actor, input); },
  async addZoppia(actor: ActorContext, input: AddZoppiaInput) { return repo.insertZoppia(actor, { ...input, dataRilevazione: new Date(input.dataRilevazione) }); },
  async eseguiTrattamento(actor: ActorContext, animaleId: string) { return repo.eseguiTrattamento(actor, animaleId); },

  // ── Gruppi ──
  async listGruppi(companyId: string, filtri?: FiltriGruppiInput) {
    const [tuttiGruppi, tuttiAnimali, associazioni, parti] = await Promise.all([
      repo.listGruppi(companyId), repo.listAnimali(companyId), repo.listGruppiAnimali(companyId), repo.listUltimiParti(companyId),
    ]);
    const ultimoPartoByAnimale = new Map<string, Date>();
    for (const parto of parti) if (!ultimoPartoByAnimale.has(parto.animaleId)) ultimoPartoByAnimale.set(parto.animaleId, new Date(parto.data));
    let result = tuttiGruppi.map((gruppo) => ({
      ...gruppo,
      ...statsGruppo(membriDelGruppo(gruppo, tuttiAnimali, associazioni, ultimoPartoByAnimale)),
    }));
    if (!filtri) return result;
    if (filtri.tipologia) result = result.filter((gruppo) => gruppo.tipologia === filtri.tipologia);
    if (filtri.tipoGestione) result = result.filter((gruppo) => gestioneGruppo(gruppo) === filtri.tipoGestione);
    if (filtri.stato) result = result.filter((gruppo) => gruppo.stato === filtri.stato);
    if (filtri.conAlert) result = result.filter((gruppo) => gruppo.hasAlert);
    if (filtri.conGravide) result = result.filter((gruppo) => gruppo.gravide > 0);
    if (filtri.inLattazione) result = result.filter((gruppo) => gruppo.inLattazione > 0);
    if (filtri.ricerca) {
      const ricerca = filtri.ricerca.toLowerCase();
      result = result.filter((gruppo) => gruppo.nome.toLowerCase().includes(ricerca) || gruppo.codice?.toLowerCase().includes(ricerca));
    }
    return result;
  },

  async createGruppo(actor: ActorContext, input: CreateGruppoInput) {
    const count = await repo.countGruppi(actor.companyId);
    const modalitaMembri = input.modalitaMembri ?? (input.tipologia === "personalizzato" ? "personalizzato" : "esclusivo");
    if (input.tipoGestione === "automatico" && modalitaMembri !== "esclusivo") throw new Error("I gruppi automatici sono virtuali e non hanno appartenenze manuali");
    return repo.insertGruppo(actor, { ...input, modalitaMembri, codice: `GRP-${String(count + 1).padStart(3, "0")}` });
  },

  async updateGruppo(actor: ActorContext, input: UpdateGruppoInput) {
    const gruppo = await repo.getGruppo(actor.companyId, input.id);
    if (!gruppo) throw new Error("Gruppo non trovato");
    const cambiaModalita = input.modalitaMembri && input.modalitaMembri !== gruppo.modalitaMembri;
    if (cambiaModalita) {
      const detail = await this.getGruppoDetail(actor.companyId, input.id);
      if ((detail?.stats.totale ?? 0) > 0) throw new Error("Per cambiare il tipo di appartenenza, crea un nuovo gruppo e sposta prima gli animali");
    }
    if (input.tipoGestione === "automatico" && !input.regolaAutomatica && !gruppo.regolaAutomatica) throw new Error("Configura una regola per il gruppo automatico");
    const { id, ...data } = input;
    return repo.updateGruppo(actor, id, data);
  },

  async archiveGruppo(actor: ActorContext, id: string) { return repo.archiveGruppo(actor, id); },

  async getGruppoDetail(companyId: string, id: string) {
    const [gruppo, tuttiAnimali, associazioni, parti] = await Promise.all([
      repo.getGruppo(companyId, id), repo.listAnimali(companyId), repo.listGruppiAnimali(companyId), repo.listUltimiParti(companyId),
    ]);
    if (!gruppo) return null;
    const ultimoPartoByAnimale = new Map<string, Date>();
    for (const parto of parti) if (!ultimoPartoByAnimale.has(parto.animaleId)) ultimoPartoByAnimale.set(parto.animaleId, new Date(parto.data));
    const membri = membriDelGruppo(gruppo, tuttiAnimali, associazioni, ultimoPartoByAnimale);
    const stats = statsGruppo(membri);
    const movimenti = await repo.listMovimentiGruppo(companyId, id, 30);
    return { ...gruppo, membri, stats: { totale: stats.nAnimali, inLattazione: stats.inLattazione, gravide: stats.gravide, manze: stats.manze }, produzioneMedia: stats.produzioneMedia, movimenti };
  },

  async listMovimentiGruppo(companyId: string, id: string, limit: number) { return repo.listMovimentiGruppo(companyId, id, limit); },

  // ── Origini, anteprima e conferma del wizard ──
  async disponibiliPerAggiunta(companyId: string, input: DisponibiliPerAggiuntaInput) {
    const [destinazione, tuttiGruppi, tuttiAnimali] = await Promise.all([
      repo.getGruppo(companyId, input.gruppoDestinazioneId), repo.listGruppi(companyId), repo.listAnimali(companyId),
    ]);
    if (!destinazione) throw new Error("Gruppo destinazione non trovato");
    if (gestioneGruppo(destinazione) === "automatico") throw new Error("Questo gruppo non accetta movimenti manuali");
    const ricerca = input.ricerca?.trim().toLowerCase();
    const accettaRicerca = (animale: AnimaleRecord) => !ricerca || [animale.matricola, animale.numeroAziendale, animale.nome, animale.rfid]
      .filter(Boolean).some((valore) => String(valore).toLowerCase().includes(ricerca));
    const origini = tuttiGruppi.filter((gruppo) => gruppo.id !== destinazione.id && gruppo.tipoGestione === "manuale" && gruppo.modalitaMembri === "esclusivo" && input.origineIds.includes(gruppo.id));
    const buckets = origini.map((gruppo) => {
      const animali = tuttiAnimali.filter((animale) => animale.gruppoId === gruppo.id && accettaRicerca(animale));
      return { source: { ...sourceLabel(gruppo), nDisponibili: animali.length }, animali };
    });
    if (input.includiSenzaGruppo) {
      const animali = tuttiAnimali.filter((animale) => !animale.gruppoId && accettaRicerca(animale));
      buckets.push({ source: { ...sourceLabel(undefined), nDisponibili: animali.length }, animali });
    }
    return buckets;
  },

  async anteprimaAggiuntaMultipla(companyId: string, input: AnteprimaAggiuntaMultiplaInput) {
    const [gruppo, tuttiGruppi, tuttiAnimali] = await Promise.all([
      repo.getGruppo(companyId, input.nuovoGruppoId), repo.listGruppi(companyId), repo.listAnimali(companyId),
    ]);
    if (!gruppo) throw new Error("Gruppo destinazione non trovato");
    if (gestioneGruppo(gruppo) === "automatico") throw new Error("Il gruppo selezionato non accetta spostamenti manuali");
    const requested = Array.from(new Set(input.animaleIds));
    const animali = tuttiAnimali.filter((animale) => requested.includes(animale.id));
    const gruppoById = new Map(tuttiGruppi.map((item) => [item.id, item]));
    const associazioni = gruppo.modalitaMembri === "personalizzato" ? await repo.listGruppiAnimali(companyId) : [];
    const membriAttuali = gruppo.modalitaMembri === "personalizzato"
      ? associazioni.filter((associazione) => associazione.gruppoId === gruppo.id).length
      : tuttiAnimali.filter((animale) => animale.gruppoId === gruppo.id).length;
    const dettagli = animali.map((animale) => {
      const effetti = calcolaEffettiFattori(gruppo, animale);
      return { animaleId: animale.id, matricola: animale.matricola, nome: animale.nome, origine: sourceLabel(gruppoById.get(animale.gruppoId ?? "")), effetti };
    });
    const perOrigine = dettagli.reduce<Record<string, { source: ReturnType<typeof sourceLabel>; totale: number }>>((acc, dettaglio) => {
      const key = dettaglio.origine.key;
      if (!acc[key]) acc[key] = { source: dettaglio.origine, totale: 0 };
      acc[key].totale += 1;
      return acc;
    }, {});
    const membriPersonali = new Set(associazioni.filter((associazione) => associazione.gruppoId === gruppo.id).map((associazione) => associazione.animaleId));
    const nonGiaNelGruppo = gruppo.modalitaMembri === "personalizzato"
      ? animali.filter((animale) => !membriPersonali.has(animale.id))
      : animali.filter((animale) => animale.gruppoId !== gruppo.id);
    const automatismi = dettagli.flatMap((dettaglio) => dettaglio.effetti.filter((effetto) => effetto.modalita === "automatico"));
    const conferme = dettagli.flatMap((dettaglio) => dettaglio.effetti.filter((effetto) => effetto.modalita === "conferma"));
    const suggerimenti = dettagli.flatMap((dettaglio) => dettaglio.effetti.filter((effetto) => effetto.modalita === "suggerimento"));
    const capacitaDopo = membriAttuali + nonGiaNelGruppo.length;
    return {
      gruppo: { id: gruppo.id, nome: gruppo.nome, codice: gruppo.codice, capacitaMax: gruppo.capacitaMax },
      riepilogo: {
        richiesti: requested.length, trovati: animali.length, giaNelGruppo: animali.length - nonGiaNelGruppo.length,
        cambierannoStato: dettagli.filter((dettaglio) => dettaglio.effetti.length > 0).length,
        invariati: dettagli.filter((dettaglio) => dettaglio.effetti.length === 0).length,
        automatici: automatismi.length, conferme: conferme.length, suggerimenti: suggerimenti.length,
        capacitaAttuale: membriAttuali, capacitaDopo, capacitaMax: gruppo.capacitaMax,
        superaCapacita: gruppo.capacitaMax != null && capacitaDopo > gruppo.capacitaMax,
      },
      perOrigine: Object.values(perOrigine), dettagli,
    };
  },

  async aggiungiMultiplo(actor: ActorContext, input: AggiungiMultiploInput) {
    const preview = await this.anteprimaAggiuntaMultipla(actor.companyId, input);
    if (preview.riepilogo.trovati !== input.animaleIds.length) throw new Error("Uno o più animali non sono disponibili");
    if (preview.riepilogo.superaCapacita) throw new Error(`Capacità massima superata: ${preview.riepilogo.capacitaDopo}/${preview.riepilogo.capacitaMax}`);
    const gruppo = await repo.getGruppo(actor.companyId, input.nuovoGruppoId);
    if (!gruppo) throw new Error("Gruppo destinazione non trovato");
    if (gruppo.modalitaMembri === "personalizzato") {
      return repo.associaAnimaliPersonaleAtomico(actor, { idempotencyKey: input.idempotencyKey, gruppoId: gruppo.id, animaleIds: input.animaleIds, motivo: input.motivo });
    }
    const animali = await repo.listAnimali(companyIdOrActor(actor));
    const byId = new Map(animali.map((animale) => [animale.id, animale]));
    const movimenti = input.animaleIds.map((animaleId) => {
      const animale = byId.get(animaleId);
      if (!animale) throw new Error("Animale non disponibile");
      const effetti = calcolaEffettiFattori(gruppo, animale);
      return {
        animaleId, gruppoPrecedenteId: animale.gruppoId ?? null,
        statoProduttivoPrecedente: animale.statoProduttivo ?? null,
        statoRiproduttivoPrecedente: animale.statoRiproduttivo ?? null,
        patch: buildPatchFromFattori(effetti, input.confermaFattori), fattoriApplicati: effetti,
      };
    });
    return repo.spostaAnimaliAtomico(actor, { ...input, movimenti });
  },

  async replaceGruppiPersonalizzati(actor: ActorContext, input: ReplaceGruppiPersonalizzatiInput) {
    return repo.replaceGruppiPersonalizzati(actor, input.animaleId, input.gruppoIds);
  },

  // ── Anteprima fattori legacy ──
  async anteprimaFattori(companyId: string, input: AnteprimaFattoriInput) {
    const gruppo = await repo.getGruppo(companyId, input.gruppoDestinazioneId);
    if (!gruppo) return { effetti: [], gruppoNome: "", applicaFattori: false };
    if (!gruppo.applicaFattoriPredefiniti) return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: false, capacitaMax: gruppo.capacitaMax, nAnimaliAttuali: 0 };
    if (input.animaleId) {
      const animale = await repo.getAnimale(companyId, input.animaleId);
      if (!animale) return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: true };
      return { effetti: calcolaEffettiFattori(gruppo, animale), gruppoNome: gruppo.nome, applicaFattori: true, capacitaMax: gruppo.capacitaMax };
    }
    if (input.animaleIds?.length) {
      const preview = await this.anteprimaAggiuntaMultipla(companyId, { nuovoGruppoId: input.gruppoDestinazioneId, animaleIds: input.animaleIds, confermaFattori: false });
      return {
        gruppoNome: gruppo.nome,
        applicaFattori: Boolean(gruppo.applicaFattoriPredefiniti),
        riepilogo: preview.riepilogo,
        dettagli: preview.dettagli,
        effetti: [],
      };
    }
    return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: true };
  },

  // ── Animali ──
  async createAnimale(actor: ActorContext, input: AddAnimaleInput) {
    const { confermaFattori, ...data } = input;
    const gruppo = await repo.getGruppo(actor.companyId, input.gruppoId);
    if (!gruppo || gestioneGruppo(gruppo) === "automatico" || gruppo.modalitaMembri !== "esclusivo") throw new Error("Seleziona un gruppo operativo dell’azienda attiva");
    const effetti = confermaFattori ? calcolaEffettiFattori(gruppo, data) : [];
    return repo.insertAnimale(actor, { ...data, gruppo: gruppo.nome, ...buildPatchFromFattori(effetti, confermaFattori) });
  },

  async updateAnimale(actor: ActorContext, input: UpdateAnimaleInput) {
    const { id, gruppoId: _gruppoId, ...data } = input;
    if (_gruppoId !== undefined) throw new Error("Per modificare il gruppo usa il flusso di spostamento, così lo storico resta completo");
    return repo.updateAnimale(actor, id, data);
  },

  async spostaGruppo(actor: ActorContext, input: SpostaGruppoInput) {
    return this.aggiungiMultiplo(actor, {
      idempotencyKey: uuid(), nuovoGruppoId: input.nuovoGruppoId, animaleIds: [input.animaleId], confermaFattori: input.confermaFattori,
      motivo: input.motivo, origineAttese: [{ animaleId: input.animaleId, gruppoId: (await repo.getAnimale(actor.companyId, input.animaleId))?.gruppoId ?? null }],
    });
  },

  async spostaMultiplo(actor: ActorContext, input: SpostaMultiploInput) {
    const animali = await repo.listAnimali(actor.companyId);
    return this.aggiungiMultiplo(actor, {
      idempotencyKey: uuid(), nuovoGruppoId: input.nuovoGruppoId, animaleIds: input.animaleIds, confermaFattori: input.confermaFattori, motivo: input.motivo,
      origineAttese: input.animaleIds.map((animaleId) => ({ animaleId, gruppoId: animali.find((animale) => animale.id === animaleId)?.gruppoId ?? null })),
    });
  },

  async createTrattamento(actor: ActorContext, input: CreateTrattamentoInput) {
    const trattamento = await repo.insertTrattamento(actor, {
      animaleId: input.animaleId, tipo: input.tipo, tipologia: input.tipologia ?? null, motivo: input.motivo ?? null,
      farmaco: input.farmaco ?? null, prodotto: input.prodotto ?? null, dose: input.dose ?? null,
      unitaMisura: input.unitaMisura ?? null, viaSomministrazione: input.viaSomministrazione ?? null,
      dataTrattamento: new Date(input.dataTrattamento), dataFine: input.dataFine ? new Date(input.dataFine) : null,
      tempiSospensione: input.tempiSospensione ?? null, prossimoTrattamento: input.prossimoTrattamento ? new Date(input.prossimoTrattamento) : null,
      operatore: input.operatore ?? null, veterinario: input.veterinario ?? null, note: input.note ?? null, stato: "eseguito",
    });
    await repo.insertEventoAnimale(actor, { animaleId: input.animaleId, tipo: "trattamento", data: new Date(), descrizione: `Trattamento ${input.tipo}: ${input.farmaco || input.prodotto || input.tipologia || ""}`.trim(), operatore: input.operatore ?? null });
    if (input.veterinario) {
      try {
        const costo = (input as any).costoVeterinario ?? 0;
        if (costo > 0) await proposalsService.createOrGetProposal(actor, { tipo: "uscita", importo: Math.round(costo * 100), descrizione: `Servizio veterinario: ${input.farmaco || input.tipologia || input.tipo} — ${input.veterinario}`, dataOrigine: input.dataTrattamento, originModule: "livestock", originEntityType: "trattamento", originEntityId: (trattamento as any).id, originEventType: "servizio_veterinario", originReference: input.veterinario });
      } catch { /* Una proposta finanziaria non deve bloccare la cura registrata. */ }
    }
    return trattamento;
  },

  async listTrattamenti(companyId: string, animaleId: string) { return repo.listTrattamenti(companyId, animaleId); },

  async ricerca(companyId: string, query: string) {
    const results = await repo.ricercaAnimali(companyId, query);
    return results.map((animale) => ({ id: animale.id, numeroAziendale: animale.numeroAziendale, matricola: animale.matricola, nome: animale.nome, gruppo: animale.gruppo, gruppoId: animale.gruppoId, statoProduttivo: animale.statoProduttivo, statoRiproduttivo: animale.statoRiproduttivo, produzioneOggi: animale.produzioneOggi, healthScore: animale.healthScore, hasAlert: (animale.healthScore ?? 100) < 70 }));
  },

  async schedaAnimale(companyId: string, id: string) {
    const animale = await repo.getAnimale(companyId, id);
    if (!animale) return null;
    const [eventi, trattamenti] = await Promise.all([repo.listEventiAnimale(companyId, id), repo.listTrattamenti(companyId, id)]);
    return { ...animale, eventi, trattamenti };
  },

  async venditaAnimale(actor: ActorContext, animaleId: string, data: { importo: number; acquirente?: string; data: string }) {
    await repo.insertEventoAnimale(actor, { animaleId, tipo: "vendita", data: new Date(data.data), descrizione: `Vendita animale${data.acquirente ? ` a ${data.acquirente}` : ""}`, operatore: null });
    try {
      if (data.importo > 0) await proposalsService.createOrGetProposal(actor, { tipo: "entrata", importo: Math.round(data.importo * 100), descrizione: `Vendita animale${data.acquirente ? ` a ${data.acquirente}` : ""}`, dataOrigine: data.data, originModule: "livestock", originEntityType: "animale", originEntityId: animaleId, originEventType: "vendita", soggettoId: undefined, originReference: data.acquirente });
    } catch { /* non bloccare la registrazione zootecnica */ }
    return { success: true };
  },

  async venditaLatte(actor: ActorContext, data: { importo: number; quantitaLitri: number; acquirente?: string; data: string; riferimento?: string }) {
    try {
      if (data.importo > 0) await proposalsService.createOrGetProposal(actor, { tipo: "entrata", importo: Math.round(data.importo * 100), descrizione: `Vendita latte (${data.quantitaLitri} L)${data.acquirente ? ` a ${data.acquirente}` : ""}`, dataOrigine: data.data, originModule: "livestock", originEntityType: "vendita_latte", originEntityId: data.riferimento ?? `latte_${data.data}`, originEventType: "vendita_latte", originReference: data.riferimento });
    } catch { /* non bloccare */ }
    return { success: true };
  },

  async addEvento(actor: ActorContext, input: AddEventoAnimaleInput) { return repo.insertEventoAnimale(actor, { ...input, data: new Date(input.data) }); },
};

function companyIdOrActor(actor: ActorContext) { return actor.companyId; }

export { calcolaEffettiFattori, buildPatchFromFattori, membriDelGruppo, statsGruppo };
