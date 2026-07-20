import { livestockRepository as repo } from "./repository";
import type { ActorContext } from "../_core";
import { proposalsService } from "../finance/proposals.service";
import type {
  CreateGruppoInput, UpdateGruppoInput, AddAnimaleInput, UpdateAnimaleInput,
  AddZoppiaInput, AddEventoAnimaleInput, FiltriGruppiInput,
  SpostaGruppoInput, SpostaMultiploInput, AnteprimaFattoriInput, CreateTrattamentoInput,
} from "./validators";
import { randomUUID as uuid } from "crypto";

/** Calcola i fattori che verranno applicati dato un gruppo destinazione e un animale */
function calcolaEffettiFattori(gruppo: Record<string, unknown>, animale: Record<string, unknown>) {
  const effetti: Array<{ campo: string; valoreAttuale: string | null; valoreNuovo: string | null; modalita: string }> = [];
  if (!gruppo.applicaFattoriPredefiniti) return effetti;
  // Stato produttivo
  if (gruppo.statoProduttivoPredefinito && gruppo.modalitaStatoProduttivo !== "non_applicare") {
    const valoreAttuale = (animale.statoProduttivo as string) ?? null;
    const valoreNuovo = gruppo.statoProduttivoPredefinito as string;
    if (valoreAttuale !== valoreNuovo) {
      effetti.push({ campo: "statoProduttivo", valoreAttuale, valoreNuovo, modalita: gruppo.modalitaStatoProduttivo as string });
    }
  }
  // Stato riproduttivo
  if (gruppo.statoRiproduttivoPredefinito && gruppo.modalitaStatoRiproduttivo !== "non_applicare") {
    const valoreAttuale = (animale.statoRiproduttivo as string) ?? null;
    const valoreNuovo = gruppo.statoRiproduttivoPredefinito as string;
    if (valoreAttuale !== valoreNuovo) {
      effetti.push({ campo: "statoRiproduttivo", valoreAttuale, valoreNuovo, modalita: gruppo.modalitaStatoRiproduttivo as string });
    }
  }
  return effetti;
}

/** Applica i fattori automatici (modalità "automatico") all'animale */
function buildPatchFromFattori(effetti: ReturnType<typeof calcolaEffettiFattori>, conferma: boolean) {
  const patch: Record<string, unknown> = {};
  for (const e of effetti) {
    if (e.modalita === "automatico" || (e.modalita === "conferma" && conferma)) {
      patch[e.campo] = e.valoreNuovo;
    }
    // "suggerimento" e "non_applicare" non modificano l'animale
  }
  return patch;
}

export const livestockService = {
  // ── Legacy ──
  async list(companyId: string) { return repo.listAnimali(companyId); },
  async stats(companyId: string) { return repo.stats(companyId); },
  async zoppie(companyId: string) { return repo.listZoppie(companyId); },
  async addAnimale(actor: ActorContext, input: Record<string, unknown>) { return repo.insertAnimale(actor, input); },
  async addZoppia(actor: ActorContext, input: AddZoppiaInput) { return repo.insertZoppia(actor, { ...input, dataRilevazione: new Date(input.dataRilevazione) }); },
  async eseguiTrattamento(actor: ActorContext, animaleId: string) { return repo.eseguiTrattamento(actor, animaleId); },

  // ── Gruppi ──
  async listGruppi(companyId: string, filtri?: FiltriGruppiInput) {
    const allGruppi = await repo.listGruppi(companyId);
    const allAnimali = await repo.listAnimali(companyId);
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
      return { ...g, nAnimali: membri.length, inLattazione, gravide, manze, produzioneMedia: Math.round(produzioneMedia * 10) / 10, hasAlert, hasTrattamenti: false };
    });
    if (!filtri) return enriched;
    let result = enriched;
    if (filtri.tipologia) result = result.filter(g => g.tipologia === filtri.tipologia);
    if (filtri.stato) result = result.filter(g => g.stato === filtri.stato);
    if (filtri.conAlert) result = result.filter(g => g.hasAlert);
    if (filtri.conGravide) result = result.filter(g => g.gravide > 0);
    if (filtri.inLattazione) result = result.filter(g => g.inLattazione > 0);
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

  // ── Anteprima fattori predefiniti ──
  async anteprimaFattori(companyId: string, input: AnteprimaFattoriInput) {
    const gruppo = await repo.getGruppo(companyId, input.gruppoDestinazioneId);
    if (!gruppo) return { effetti: [], gruppoNome: "", applicaFattori: false };
    if (!gruppo.applicaFattoriPredefiniti) {
      return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: false, capacitaMax: gruppo.capacitaMax, nAnimaliAttuali: 0 };
    }
    // Singolo animale
    if (input.animaleId) {
      const animale = await repo.getAnimale(companyId, input.animaleId);
      if (!animale) return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: true };
      const effetti = calcolaEffettiFattori(gruppo, animale);
      return { effetti, gruppoNome: gruppo.nome, applicaFattori: true, capacitaMax: gruppo.capacitaMax };
    }
    // Multipli animali
    if (input.animaleIds && input.animaleIds.length > 0) {
      const animaliAll = await repo.listAnimali(companyId);
      const animali = animaliAll.filter(a => input.animaleIds!.includes(a.id));
      const membriAttuali = await repo.listAnimaliByGruppo(companyId, input.gruppoDestinazioneId);
      const riepilogo = {
        totale: animali.length,
        cambierannoStato: 0,
        invariati: 0,
        incompatibili: 0,
        capacitaDopo: membriAttuali.length + animali.length,
        capacitaMax: gruppo.capacitaMax,
      };
      const dettagli: Array<{ animaleId: string; matricola: string; effetti: ReturnType<typeof calcolaEffettiFattori> }> = [];
      for (const a of animali) {
        const eff = calcolaEffettiFattori(gruppo, a);
        if (eff.length > 0) riepilogo.cambierannoStato++;
        else riepilogo.invariati++;
        dettagli.push({ animaleId: a.id, matricola: a.matricola, effetti: eff });
      }
      return { gruppoNome: gruppo.nome, applicaFattori: true, riepilogo, dettagli };
    }
    return { effetti: [], gruppoNome: gruppo.nome, applicaFattori: true };
  },

  // ── Animali ──
  async createAnimale(actor: ActorContext, input: AddAnimaleInput) {
    // Se confermaFattori è true, applica i fattori del gruppo selezionato
    const { confermaFattori, ...data } = input;
    let finalData: Record<string, unknown> = { ...data };
    if (confermaFattori && input.gruppoId) {
      const gruppo = await repo.getGruppo(actor.companyId, input.gruppoId);
      if (gruppo && gruppo.applicaFattoriPredefiniti) {
        const effetti = calcolaEffettiFattori(gruppo, data);
        const patch = buildPatchFromFattori(effetti, true);
        finalData = { ...finalData, ...patch };
      }
    }
    return repo.insertAnimale(actor, finalData);
  },

  async updateAnimale(actor: ActorContext, input: UpdateAnimaleInput) {
    const { id, ...data } = input;
    return repo.updateAnimale(actor, id, data);
  },

  // ── Spostamento singolo con fattori ──
  async spostaGruppo(actor: ActorContext, input: SpostaGruppoInput) {
    const animale = await repo.getAnimale(actor.companyId, input.animaleId);
    if (!animale) throw new Error("Animale non trovato");
    const gruppo = await repo.getGruppo(actor.companyId, input.nuovoGruppoId);
    if (!gruppo) throw new Error("Gruppo non trovato");

    const gruppoPrecedenteId = animale.gruppoId ?? null;
    const statoProduttivoPrecedente = animale.statoProduttivo ?? null;
    const statoRiproduttivoPrecedente = animale.statoRiproduttivo ?? null;

    // Calcola e applica fattori
    const effetti = calcolaEffettiFattori(gruppo, animale);
    const patch = buildPatchFromFattori(effetti, input.confermaFattori);
    // Aggiorna animale: gruppoId + eventuali fattori
    await repo.updateAnimale(actor, input.animaleId, { gruppoId: input.nuovoGruppoId, ...patch });

    // Registra evento timeline con storico completo
    await repo.insertEventoAnimale(actor, {
      animaleId: input.animaleId,
      tipo: "spostamento_gruppo",
      data: new Date(),
      descrizione: `Spostato da ${gruppoPrecedenteId ?? "nessuno"} a ${gruppo.nome} (${gruppo.codice})`,
      gruppoPrecedenteId,
      gruppoNuovoId: input.nuovoGruppoId,
      statoProduttivoPrecedente,
      statoProduttivoNuovo: (patch.statoProduttivo as string) ?? statoProduttivoPrecedente,
      statoRiproduttivoPrecedente,
      statoRiproduttivoNuovo: (patch.statoRiproduttivo as string) ?? statoRiproduttivoPrecedente,
      fattoriApplicati: effetti.length > 0 ? JSON.stringify(effetti) : null,
      modalitaApplicazione: effetti.length > 0 ? (input.confermaFattori ? "conferma" : "automatico") : null,
      motivo: input.motivo ?? null,
    });
    return { success: true, effettiApplicati: effetti, patch };
  },

  // ── Spostamento multiplo ──
  async spostaMultiplo(actor: ActorContext, input: SpostaMultiploInput) {
    const gruppo = await repo.getGruppo(actor.companyId, input.nuovoGruppoId);
    if (!gruppo) throw new Error("Gruppo non trovato");
    const operazioneMultiplaId = uuid();
    const risultati: Array<{ animaleId: string; success: boolean; effetti: unknown[] }> = [];

    for (const animaleId of input.animaleIds) {
      try {
        const r = await this.spostaGruppo(actor, {
          animaleId,
          nuovoGruppoId: input.nuovoGruppoId,
          confermaFattori: input.confermaFattori,
          motivo: input.motivo,
        });
        // Aggiorna l'evento appena creato con operazioneMultiplaId
        risultati.push({ animaleId, success: true, effetti: r.effettiApplicati });
      } catch {
        risultati.push({ animaleId, success: false, effetti: [] });
      }
    }
    return { operazioneMultiplaId, totale: input.animaleIds.length, successi: risultati.filter(r => r.success).length, risultati };
  },

  // ── Trattamenti ──
  async createTrattamento(actor: ActorContext, input: CreateTrattamentoInput) {
    const trattamento = await repo.insertTrattamento(actor, {
      animaleId: input.animaleId,
      tipo: input.tipo,
      tipologia: input.tipologia ?? null,
      motivo: input.motivo ?? null,
      farmaco: input.farmaco ?? null,
      prodotto: input.prodotto ?? null,
      dose: input.dose ?? null,
      unitaMisura: input.unitaMisura ?? null,
      viaSomministrazione: input.viaSomministrazione ?? null,
      dataTrattamento: new Date(input.dataTrattamento),
      dataFine: input.dataFine ? new Date(input.dataFine) : null,
      tempiSospensione: input.tempiSospensione ?? null,
      prossimoTrattamento: input.prossimoTrattamento ? new Date(input.prossimoTrattamento) : null,
      operatore: input.operatore ?? null,
      veterinario: input.veterinario ?? null,
      note: input.note ?? null,
      stato: "eseguito",
    });
    // Registra evento timeline
    await repo.insertEventoAnimale(actor, {
      animaleId: input.animaleId,
      tipo: "trattamento",
      data: new Date(),
      descrizione: `Trattamento ${input.tipo}: ${input.farmaco || input.prodotto || input.tipologia || ""}`.trim(),
      operatore: input.operatore ?? null,
    });

    // Proposta finanziaria: solo servizio veterinario esterno genera uscita.
    // Farmaco da magazzino = solo scarico (costo gestionale, no nuova uscita).
    if (input.veterinario && (input.tipo === "visita" || input.tipo === "altro")) {
      try {
        const costo = (input as any).costoVeterinario ?? 0;
        if (costo > 0) {
          await proposalsService.createOrGetProposal(actor, {
            tipo: "uscita",
            importo: Math.round(costo * 100),
            descrizione: `Servizio veterinario: ${input.farmaco || input.tipologia || input.tipo} — ${input.veterinario}`,
            dataOrigine: input.dataTrattamento,
            originModule: "livestock",
            originEntityType: "trattamento",
            originEntityId: (trattamento as any).id,
            originEventType: "servizio_veterinario",
            originReference: input.veterinario,
          });
        }
      } catch { /* non bloccare */ }
    }

    return trattamento;
  },

  async listTrattamenti(companyId: string, animaleId: string) {
    return repo.listTrattamenti(companyId, animaleId);
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
    const trattamenti = await repo.listTrattamenti(companyId, id);
    return { ...animale, eventi, trattamenti };
  },

  // ── Vendita animale ──
  async venditaAnimale(actor: ActorContext, animaleId: string, data: { importo: number; acquirente?: string; data: string }) {
    // Registra evento timeline
    await repo.insertEventoAnimale(actor, {
      animaleId,
      tipo: "vendita",
      data: new Date(data.data),
      descrizione: `Vendita animale${data.acquirente ? ` a ${data.acquirente}` : ""}`,
      operatore: null,
    });
    // Proposta finanziaria: entrata
    try {
      if (data.importo > 0) {
        await proposalsService.createOrGetProposal(actor, {
          tipo: "entrata",
          importo: Math.round(data.importo * 100),
          descrizione: `Vendita animale${data.acquirente ? ` a ${data.acquirente}` : ""}`,
          dataOrigine: data.data,
          originModule: "livestock",
          originEntityType: "animale",
          originEntityId: animaleId,
          originEventType: "vendita",
          soggettoId: undefined,
          originReference: data.acquirente,
        });
      }
    } catch { /* non bloccare */ }
    return { success: true };
  },

  // ── Vendita latte ──
  async venditaLatte(actor: ActorContext, data: { importo: number; quantitaLitri: number; acquirente?: string; data: string; riferimento?: string }) {
    // Proposta finanziaria: entrata con documento da incassare
    try {
      if (data.importo > 0) {
        await proposalsService.createOrGetProposal(actor, {
          tipo: "entrata",
          importo: Math.round(data.importo * 100),
          descrizione: `Vendita latte (${data.quantitaLitri} L)${data.acquirente ? ` a ${data.acquirente}` : ""}`,
          dataOrigine: data.data,
          originModule: "livestock",
          originEntityType: "vendita_latte",
          originEntityId: data.riferimento ?? `latte_${data.data}`,
          originEventType: "vendita_latte",
          originReference: data.riferimento,
        });
      }
    } catch { /* non bloccare */ }
    return { success: true };
  },

  // ── Eventi ──
  async addEvento(actor: ActorContext, input: AddEventoAnimaleInput) {
    return repo.insertEventoAnimale(actor, { ...input, data: new Date(input.data) });
  },
};

// Esporta le funzioni helper per i test
export { calcolaEffettiFattori, buildPatchFromFattori };
