import { completaInterventoAtomico } from "./completion";
import { listRicambiCondivisi } from "./parts";
import { sharedPartsService } from "./sharedParts";
import { validateFotoReference } from "./photos";
import type { ActorContext } from "../_core";
import { fleetRepository as repo } from "./repository";
import { inventoryRepository } from "../inventory/repository";
import { proposalsService } from "../finance/proposals.service";
import { calendarRepository } from "../calendar/repository";
import type {
  CreateMacchinaInput,
  UpdateMacchinaInput,
  AddDocumentoInput,
  CreateInterventoInput,
  CompletaInterventoInput,
  CreateRicambioInput,
  UpdateRicambioInput,
} from "./validators";

const COSTO_ORARIO_DEFAULT = 35; // €/h manodopera di default

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

/** Stato esteso di un ricambio nel magazzino officina. */
export function statoScortaRicambio(
  disponibile: number,
  soglia: number,
  statoOrdine?: string | null,
): "disponibile" | "sotto_scorta" | "non_disponibile" | "da_ordinare" | "ordinato" {
  if (statoOrdine === "ordinato") return "ordinato";
  if (disponibile <= 0) return statoOrdine === "da_ordinare" ? "da_ordinare" : "non_disponibile";
  if (soglia > 0 && disponibile <= soglia) return statoOrdine === "da_ordinare" ? "da_ordinare" : "sotto_scorta";
  return "disponibile";
}

function toDateOrNull(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Stato disponibilità di un ricambio rispetto a quanto richiesto. */
export function statoDisponibilita(disponibile: number, richiesta: number, soglia: number) {
  if (disponibile <= 0) return "non_disponibile" as const;
  if (disponibile < richiesta) return "insufficiente" as const;
  if (soglia > 0 && disponibile <= soglia) return "sotto_scorta" as const;
  return "disponibile" as const;
}

/**
 * Health Score 0-100 calcolato dai segnali disponibili: interventi aperti,
 * urgenze, manutenzione scaduta. Deterministico e spiegabile.
 */
export function calcolaHealthScore(macchina: any, interventiMacchina: any[]): number {
  if (macchina.stato === "fermo") return Math.min(Number(macchina.healthScore ?? 100), 35);
  let score = 100;
  const aperti = interventiMacchina.filter((i) => i.stato !== "completato");
  score -= aperti.length * 8;
  score -= aperti.filter((i) => i.priorita === "urgente").length * 12;
  score -= aperti.filter((i) => i.priorita === "alta").length * 6;
  if (macchina.stato === "manutenzione") score -= 15;
  // Manutenzione scaduta.
  const pm = toDateOrNull(macchina.prossimaManutenzione);
  if (pm && pm.getTime() < Date.now()) score -= 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** FLEET (Officina) — Service */
export const fleetService = {
  // ── Macchine ────────────────────────────────────────────────────────────────
  async listMacchine(companyId: string) {
    const [mezzi, interventiAll] = await Promise.all([
      repo.listMacchine(companyId),
      repo.listInterventi(companyId),
    ]);
    return mezzi.map((m) => {
      const suoi = interventiAll.filter((i) => i.macchinaId === m.id);
      const aperti = suoi.filter((i) => i.stato !== "completato");
      const ultimo = suoi
        .filter((i) => i.stato === "completato")
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
      return {
        ...m,
        healthScore: calcolaHealthScore(m, suoi),
        interventiAperti: aperti.length,
        ultimoIntervento: ultimo ? ultimo.data : null,
      };
    });
  },

  async macchinaDetail(companyId: string, id: string) {
    const [macchina, interventiAll, documenti] = await Promise.all([
      repo.getMacchina(companyId, id),
      repo.listInterventi(companyId, { macchinaId: id }),
      repo.listDocumenti(companyId, id),
    ]);
    if (!macchina) return null;
    return {
      ...macchina,
      healthScore: calcolaHealthScore(macchina, interventiAll),
      storico: interventiAll,
      documenti,
    };
  },

  async createMacchina(actor: ActorContext, input: CreateMacchinaInput) {
    const n = (await repo.countMacchine(actor.companyId)) + 1;
    const codice = `MEZ-${pad(n, 4)}`;
    return repo.insertMacchina(actor, {
      codice,
      nome: input.nome,
      categoria: input.categoria ?? null,
      marca: input.marca ?? null,
      modello: input.modello ?? null,
      targa: input.targa ?? null,
      telaio: input.telaio ?? null,
      anno: input.anno ?? null,
      foto: input.foto ? validateFotoReference(actor.companyId, input.foto) : null,
      oreTotali: input.oreTotali != null ? String(input.oreTotali) : "0",
      oreMotore: input.oreMotore != null ? String(input.oreMotore) : "0",
      chilometri: input.chilometri != null ? String(input.chilometri) : null,
      healthScore: input.healthScore ?? 100,
      ultimoTagliando: toDateOrNull(input.ultimoTagliando),
      prossimaManutenzione: toDateOrNull(input.prossimaManutenzione),
      stato: input.stato,
      note: input.note ?? null,
    });
  },

  updateMacchina(actor: ActorContext, input: UpdateMacchinaInput) {
    const { id, ...rest } = input;
    const data: Record<string, unknown> = {};
    if (rest.nome !== undefined) data.nome = rest.nome;
    if (rest.categoria !== undefined) data.categoria = rest.categoria;
    if (rest.marca !== undefined) data.marca = rest.marca;
    if (rest.modello !== undefined) data.modello = rest.modello;
    if (rest.targa !== undefined) data.targa = rest.targa;
    if (rest.telaio !== undefined) data.telaio = rest.telaio;
    if (rest.anno !== undefined) data.anno = rest.anno;
    if (rest.foto !== undefined) data.foto = validateFotoReference(actor.companyId, rest.foto) || null;
    if (rest.oreTotali !== undefined) data.oreTotali = String(rest.oreTotali);
    if (rest.oreMotore !== undefined) data.oreMotore = String(rest.oreMotore);
    if (rest.chilometri !== undefined) data.chilometri = rest.chilometri != null ? String(rest.chilometri) : null;
    if (rest.healthScore !== undefined) data.healthScore = rest.healthScore;
    if (rest.ultimoTagliando !== undefined) data.ultimoTagliando = toDateOrNull(rest.ultimoTagliando);
    if (rest.prossimaManutenzione !== undefined) data.prossimaManutenzione = toDateOrNull(rest.prossimaManutenzione);
    if (rest.stato !== undefined) data.stato = rest.stato;
    if (rest.note !== undefined) data.note = rest.note;
    return repo.updateMacchina(actor, id, data);
  },

  removeMacchina(actor: ActorContext, id: string) {
    return repo.softDeleteMacchina(actor, id);
  },

  // ── Documenti ──────────────────────────────────────────────────────────────────
  listDocumenti(companyId: string, macchinaId: string) {
    return repo.listDocumenti(companyId, macchinaId);
  },
  addDocumento(actor: ActorContext, input: AddDocumentoInput) {
    return repo.insertDocumento(actor, {
      macchinaId: input.macchinaId,
      nome: input.nome,
      tipo: input.tipo ?? null,
      url: input.url,
      fileKey: input.fileKey ?? null,
    });
  },
  removeDocumento(actor: ActorContext, id: string) {
    return repo.softDeleteDocumento(actor, id);
  },

  // ── Interventi ──────────────────────────────────────────────────────────────
  async listInterventi(
    companyId: string,
    filters?: {
      macchinaId?: string;
      stato?: string;
      priorita?: string;
      tipo?: string;
      operatore?: string;
      categoria?: string;
      costoMin?: number;
      costoMax?: number;
      conRicambi?: boolean;
      ricerca?: string;
    },
  ) {
    const rows = await repo.listInterventi(companyId, {
      macchinaId: filters?.macchinaId,
      stato: filters?.stato,
      priorita: filters?.priorita,
      tipo: filters?.tipo,
    });
    let out = rows as any[];
    if (filters?.operatore) out = out.filter((i) => (i.operatore ?? "") === filters.operatore);
    if (filters?.categoria) out = out.filter((i) => (i.categoria ?? "") === filters.categoria);
    if (filters?.costoMin != null) out = out.filter((i) => Number(i.costoPrevisto ?? i.costoFinale ?? 0) >= filters.costoMin!);
    if (filters?.costoMax != null) out = out.filter((i) => Number(i.costoFinale ?? i.costoPrevisto ?? 0) <= filters.costoMax!);
    if (filters?.ricerca) {
      const q = filters.ricerca.toLowerCase();
      out = out.filter(
        (i) =>
          (i.codice ?? "").toLowerCase().includes(q) ||
          (i.descrizione ?? "").toLowerCase().includes(q) ||
          (i.operatore ?? "").toLowerCase().includes(q),
      );
    }
    return out;
  },

  /** Dettaglio intervento con i ricambi necessari (sempre mostrati). */
  async interventoDetail(companyId: string, id: string) {
    const [intervento, righe, ricambiAll, prodottiAll] = await Promise.all([
      repo.getIntervento(companyId, id),
      repo.listInterventoRicambi(companyId, id),
      repo.listRicambi(companyId),
      inventoryRepository.listProdotti(companyId),
    ]);
    if (!intervento) return null;
    const ricambiNecessari = righe.map((r) => {
      const cat = ricambiAll.find((rc) => rc.id === r.ricambioId);
      const prodotto = prodottiAll.find((item) => item.id === r.prodottoId);
      const disponibile = prodotto ? Number(prodotto.quantita) : cat ? Number(cat.quantitaDisponibile) : 0;
      const soglia = prodotto ? Number(prodotto.quantitaMinima ?? 0) : cat ? Number(cat.sogliaMinima) : 0;
      const richiesta = Number(r.quantitaRichiesta);
      const stato = Number(r.quantitaUtilizzata) > 0 ? "usato" : statoDisponibilita(disponibile, richiesta, soglia);
      return {
        ...r,
        codice: r.codiceRicambio ?? cat?.codice ?? prodotto?.codice ?? null,
        fornitore: cat?.fornitore ?? null,
        categoria: cat?.categoria ?? prodotto?.categoria ?? null,
        costoUnitario: r.costoUnitario ?? cat?.costoMedio ?? prodotto?.prezzoUnitario ?? null,
        disponibile,
        soglia,
        statoDisponibilita: stato,
      };
    });
    // Un intervento non e' pronto se manca anche solo un ricambio obbligatorio.
    const ricambiObbligatoriMancanti = ricambiNecessari.filter(
      (r) => r.obbligatorio && (r.statoDisponibilita === "non_disponibile" || r.statoDisponibilita === "insufficiente"),
    );
    return {
      ...intervento,
      ricambiNecessari,
      ricambiObbligatoriMancanti,
      prontoPerCompletamento: ricambiObbligatoriMancanti.length === 0,
    };
  },

  async createIntervento(actor: ActorContext, input: CreateInterventoInput) {
    if (!await repo.getMacchina(actor.companyId, input.macchinaId)) throw new Error("Mezzo non trovato nell’azienda attiva");
    const catalogoRicambi = input.ricambi?.length ? await listRicambiCondivisi(actor.companyId) : [];
    for (const r of input.ricambi ?? []) {
      const partId = r.prodottoId || r.ricambioId;
      if (partId && !catalogoRicambi.some((part) => part.id === partId)) throw new Error("Ricambio non trovato nell’azienda attiva");
    }
    const n = (await repo.countInterventi(actor.companyId)) + 1;
    const codice = `INT-${new Date().getFullYear()}-${pad(n, 4)}`;
    const costoOrario = input.costoOrario ?? COSTO_ORARIO_DEFAULT;
    const tempoStimato = input.tempoStimato ?? null;
    const costoPrevisto =
      input.costoPrevisto != null
        ? input.costoPrevisto
        : tempoStimato != null
          ? Number(tempoStimato) * costoOrario
          : null;
    const { id } = await repo.insertIntervento(actor, {
      macchinaId: input.macchinaId,
      codice,
      tipo: input.tipo,
      categoria: input.categoria ?? null,
      descrizione: input.descrizione,
      data: toDateOrNull(input.data) ?? new Date(),
      dataPianificata: toDateOrNull(input.dataPianificata),
      priorita: input.priorita,
      stato: input.stato,
      operatore: input.operatore ?? null,
      tempoStimato: tempoStimato != null ? String(tempoStimato) : null,
      costoOrario: String(costoOrario),
      costoPrevisto: costoPrevisto != null ? String(costoPrevisto) : null,
      note: input.note ?? null,
    });
    // Ricambi necessari dalla fonte condivisa: sempre mostrati anche se esauriti.
    if (input.ricambi?.length) {
      for (const r of input.ricambi) {
        const partId = r.prodottoId || r.ricambioId;
        const part = partId ? catalogoRicambi.find((p) => p.id === partId) : null;
        await repo.insertInterventoRicambio(actor, {
          interventoId: id,
          ricambioId: part?.source === "legacy" ? part.id : null,
          prodottoId: part?.source === "magazzino" ? part.id : null,
          codiceRicambio: r.codiceRicambio ?? null,
          nomeRicambio: r.nomeRicambio ?? null,
          quantitaRichiesta: String(r.quantitaRichiesta),
          quantitaUtilizzata: "0",
          obbligatorio: r.obbligatorio,
        });
      }
    }
    return { id, success: true };
  },

  updateStatoIntervento(actor: ActorContext, id: string, stato: string) {
    return repo.updateIntervento(actor, id, { stato });
  },

  removeIntervento(actor: ActorContext, id: string) {
    return repo.softDeleteIntervento(actor, id);
  },

  /**
   * Workflow completamento: scala magazzino ricambi, registra costo in Finanza,
   * aggiorna macchina (costo totale, ultimo tagliando) e crea evento Calendario.
   */
  async completaIntervento(actor: ActorContext, input: CompletaInterventoInput) {
    return completaInterventoAtomico(actor, input);
  },

  // ── Ricambi (magazzino officina) ────────────────────────────────────────────────
  async listRicambi(
    companyId: string,
    opts?: {
      categoria?: string;
      filtro?: string;
      fornitore?: string;
      posizione?: string;
      prezzoMin?: number;
      prezzoMax?: number;
      ricerca?: string;
    },
  ) {
    const rows = await listRicambiCondivisi(companyId);
    const arricchiti = rows.map((r) => {
      const disp = Number(r.quantitaDisponibile);
      const soglia = Number(r.sogliaMinima);
      return { ...r, statoScorta: disp <= 0 ? "non_disponibile" : soglia > 0 && disp <= soglia ? "sotto_scorta" : "disponibile" };
    });
    let filtrati = arricchiti;
    if (opts?.categoria) filtrati = filtrati.filter((r) => r.categoria === opts.categoria);
    if (opts?.fornitore) filtrati = filtrati.filter((r) => r.fornitore === opts.fornitore);
    if (opts?.posizione) filtrati = filtrati.filter((r) => r.posizione === opts.posizione);
    if (opts?.prezzoMin != null) filtrati = filtrati.filter((r) => Number(r.costoMedio ?? 0) >= opts.prezzoMin!);
    if (opts?.prezzoMax != null) filtrati = filtrati.filter((r) => Number(r.costoMedio ?? 0) <= opts.prezzoMax!);
    if (opts?.ricerca) {
      const q = opts.ricerca.toLowerCase();
      filtrati = filtrati.filter(
        (r) =>
          r.nome.toLowerCase().includes(q) ||
          (r.codice ?? "").toLowerCase().includes(q) ||
          (r.compatibilita ?? "").toLowerCase().includes(q),
      );
    }
    switch (opts?.filtro) {
      case "disponibili":
        filtrati = filtrati.filter((r) => r.statoScorta === "disponibile");
        break;
      case "sotto_scorta":
        filtrati = filtrati.filter((r) => r.statoScorta === "sotto_scorta");
        break;
      case "non_disponibili":
        filtrati = filtrati.filter((r) => r.statoScorta === "non_disponibile");
        break;
      case "ordinati":
        filtrati = filtrati.filter((r) => r.statoScorta === "ordinato");
        break;
      case "da_ordinare":
        filtrati = filtrati.filter((r) => r.statoScorta === "sotto_scorta" || r.statoScorta === "non_disponibile" || r.statoScorta === "da_ordinare");
        break;
      default:
        break;
    }
    return filtrati;
  },

  /** Riepilogo per la lista ordine: ricambi sotto scorta o esauriti. */
  async preparaOrdine(companyId: string) {
    const rows = await listRicambiCondivisi(companyId);
    return rows
      .filter((r) => {
        const disp = Number(r.quantitaDisponibile);
        const soglia = Number(r.sogliaMinima);
        return disp <= 0 || (soglia > 0 && disp <= soglia);
      })
      .map((r) => {
        const disp = Number(r.quantitaDisponibile);
        const soglia = Number(r.sogliaMinima);
        const daOrdinare = Math.max(soglia * 2 - disp, soglia - disp, 1);
        return {
          id: r.id,
          codice: r.codice,
          nome: r.nome,
          categoria: r.categoria,
          fornitore: r.fornitore,
          quantitaDisponibile: disp,
          sogliaMinima: soglia,
          quantitaConsigliata: Math.ceil(daOrdinare),
          costoStimato: Math.ceil(daOrdinare) * Number(r.costoMedio ?? 0),
        };
      });
  },

  async createRicambio(actor: ActorContext, input: CreateRicambioInput) {
    return sharedPartsService.create(actor, input);
  },

  updateRicambio(actor: ActorContext, input: UpdateRicambioInput) {
    return sharedPartsService.update(actor, input);
  },

  setStatoOrdineRicambio(actor: ActorContext, id: string, statoOrdine: string) {
    return sharedPartsService.order(actor, id, statoOrdine);
  },

  async adjustRicambio(actor: ActorContext, id: string, delta: number) {
    return sharedPartsService.adjust(actor, id, delta);
  },

  removeRicambio(actor: ActorContext, id: string) {
    return sharedPartsService.remove(actor, id);
  },

  // ── Dashboard KPI premium ──────────────────────────────────────────────────────
  async dashboard(companyId: string) {
    const [mezzi, interventiAll, ricambiAll, prodottiAll] = await Promise.all([
      repo.listMacchine(companyId),
      repo.listInterventi(companyId),
      repo.listRicambi(companyId),
      inventoryRepository.listProdotti(companyId),
    ]);
    const oggi = new Date();
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);

    const mezziOperativi = mezzi.filter((m) => m.stato === "operativo").length;
    const mezziFermi = mezzi.filter((m) => m.stato === "fermo").length;
    const inManutenzione = mezzi.filter((m) => m.stato === "manutenzione").length;

    const aperti = interventiAll.filter((i) => i.stato !== "completato");
    const manutenzioniOggi = interventiAll.filter((i) => {
      const d = i.dataPianificata ?? i.data;
      return d && new Date(d).toDateString() === oggi.toDateString() && i.stato !== "completato";
    }).length;
    const interventiInRitardo = aperti.filter((i) => {
      const d = i.dataPianificata ?? i.data;
      return d && new Date(d).getTime() < oggi.setHours(0, 0, 0, 0);
    }).length;
    const interventiUrgenti = aperti.filter((i) => i.priorita === "urgente").length;

    const ricambiCondivisi = await listRicambiCondivisi(companyId);
    const ricambiSottoScorta = ricambiCondivisi.filter((r) => Number(r.quantitaDisponibile) <= 0 || (Number(r.sogliaMinima) > 0 && Number(r.quantitaDisponibile) <= Number(r.sogliaMinima))).length;

    const costoManutenzioneMese = interventiAll
      .filter((i) => i.stato === "completato" && i.dataCompletamento && new Date(i.dataCompletamento) >= inizioMese)
      .reduce((sum, i) => sum + Number(i.costoFinale ?? 0), 0);

    return {
      totaleMezzi: mezzi.length,
      mezziOperativi,
      mezziFermi,
      inManutenzione,
      manutenzioniOggi,
      interventiAperti: aperti.length,
      interventiInRitardo,
      interventiUrgenti,
      ricambiSottoScorta,
      costoManutenzioneMese,
    };
  },

  // ── Macchinari: acquisto/vendita/leasing ──────────────────────────────────────
  /** Acquisto macchina → proposta uscita/investimento */
  async acquistoMacchina(actor: ActorContext, macchinaId: string, data: { importo: number; data: string; fornitore?: string }) {
    const macchina = await repo.getMacchina(actor.companyId, macchinaId);
    if (!macchina) throw new Error("Macchina non trovata");
    try {
      if (data.importo > 0) {
        await proposalsService.createOrGetProposal(actor, {
          tipo: "uscita",
          importo: Math.round(data.importo * 100),
          descrizione: `Acquisto ${macchina.nome} (${macchina.codice ?? ""})`,
          dataOrigine: data.data,
          originModule: "machinery",
          originEntityType: "macchina",
          originEntityId: macchinaId,
          originEventType: "acquisto",
          originReference: macchina.codice ?? macchina.nome,
        });
      }
    } catch { /* non bloccare */ }
    return { success: true };
  },

  /** Vendita macchina → proposta entrata */
  async venditaMacchina(actor: ActorContext, macchinaId: string, data: { importo: number; data: string; acquirente?: string }) {
    const macchina = await repo.getMacchina(actor.companyId, macchinaId);
    if (!macchina) throw new Error("Macchina non trovata");
    try {
      if (data.importo > 0) {
        await proposalsService.createOrGetProposal(actor, {
          tipo: "entrata",
          importo: Math.round(data.importo * 100),
          descrizione: `Vendita ${macchina.nome} (${macchina.codice ?? ""})${data.acquirente ? ` a ${data.acquirente}` : ""}`,
          dataOrigine: data.data,
          originModule: "machinery",
          originEntityType: "macchina",
          originEntityId: macchinaId,
          originEventType: "vendita",
          originReference: macchina.codice ?? macchina.nome,
        });
      }
    } catch { /* non bloccare */ }
    return { success: true };
  },

  /** Leasing macchina → genera scadenze periodiche (usa il sistema scadenze di Fase 2, no pagamento immediato) */
  async leasingMacchina(actor: ActorContext, macchinaId: string, data: {
    importoRata: number;
    numeroRate: number;
    dataInizio: string;
    frequenzaMesi: number;
    fornitore?: string;
  }) {
    const macchina = await repo.getMacchina(actor.companyId, macchinaId);
    if (!macchina) throw new Error("Macchina non trovata");
    // Genera una proposta per ogni rata (con idempotenza per rata)
    const proposte: string[] = [];
    for (let i = 0; i < data.numeroRate; i++) {
      const dataRata = new Date(data.dataInizio);
      dataRata.setMonth(dataRata.getMonth() + i * data.frequenzaMesi);
      const dataStr = dataRata.toISOString().slice(0, 10);
      try {
        const result = await proposalsService.createOrGetProposal(actor, {
          tipo: "uscita",
          importo: Math.round(data.importoRata * 100),
          descrizione: `Leasing ${macchina.nome} — Rata ${i + 1}/${data.numeroRate}`,
          dataOrigine: dataStr,
          originModule: "machinery",
          originEntityType: "leasing",
          originEntityId: macchinaId,
          originEventType: `leasing_rata_${i + 1}`,
          originReference: macchina.codice ?? macchina.nome,
        });
        if (result.id) proposte.push(result.id);
      } catch { /* continua con le altre rate */ }
    }
    return { success: true, proposteCreate: proposte.length };
  },
};
