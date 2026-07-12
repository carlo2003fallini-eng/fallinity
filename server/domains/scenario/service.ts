import { type ActorContext } from "../_core";
import * as repo from "./repository";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * SCENARIO FUTURO — SERVICE
 * ──────────────────────────────────────────────────────────────────────────────
 * Logica di simulazione what-if: crea scenari, definisci ipotesi (variabili
 * economiche/produttive), calcola l'impatto stimato, confronta scenari.
 */

// ─── VARIABILI: metadata per UI ─────────────────────────────────────────────
export const VARIABILI_META: Record<string, { label: string; unita: string; categoria: string }> = {
  investimento_iniziale: { label: "Investimento iniziale", unita: "€", categoria: "investimenti" },
  costo_manodopera: { label: "Costo manodopera", unita: "€/mese", categoria: "costi" },
  costo_mangimi: { label: "Costo mangimi", unita: "€/mese", categoria: "costi" },
  costo_energia: { label: "Costo energia", unita: "€/mese", categoria: "costi" },
  costo_manutenzione: { label: "Costo manutenzione", unita: "€/mese", categoria: "costi" },
  prezzo_latte: { label: "Prezzo latte", unita: "€/litro", categoria: "prezzi" },
  prezzo_carne: { label: "Prezzo carne", unita: "€/kg", categoria: "prezzi" },
  produzione_latte_giorno: { label: "Produzione latte/giorno", unita: "litri", categoria: "produzione" },
  numero_capi: { label: "Numero capi", unita: "capi", categoria: "produzione" },
  ettari_coltivati: { label: "Ettari coltivati", unita: "ha", categoria: "produzione" },
  resa_ettaro: { label: "Resa per ettaro", unita: "q/ha", categoria: "produzione" },
  prezzo_vendita_colture: { label: "Prezzo vendita colture", unita: "€/q", categoria: "prezzi" },
};

// ─── LIST ────────────────────────────────────────────────────────────────────
export async function listScenari(actor: ActorContext, stato?: string) {
  const rows = await repo.listScenari(actor.companyId, stato);
  return rows.map(r => ({
    ...r,
    risultato: r.risultatoJson ? JSON.parse(r.risultatoJson) : null,
  }));
}

// ─── DETAIL ──────────────────────────────────────────────────────────────────
export async function detailScenario(actor: ActorContext, id: string) {
  const scenario = await repo.getScenario(actor.companyId, id);
  if (!scenario) throw new Error("Scenario non trovato");
  const ipotesi = await repo.getIpotesiByScenario(actor.companyId, id);
  return {
    ...scenario,
    risultato: scenario.risultatoJson ? JSON.parse(scenario.risultatoJson) : null,
    ipotesi: ipotesi.map(ip => ({
      ...ip,
      valoreAttuale: Number(ip.valoreAttuale),
      valoreIpotesi: Number(ip.valoreIpotesi),
      meta: VARIABILI_META[ip.variabile] ?? { label: ip.variabile, unita: ip.unita, categoria: "altro" },
    })),
  };
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
export async function createScenario(actor: ActorContext, data: { nome: string; descrizione?: string; modello: string }) {
  return repo.insertScenario(actor, data);
}

// ─── IPOTESI ─────────────────────────────────────────────────────────────────
export async function addIpotesi(actor: ActorContext, data: {
  scenarioId: string;
  variabile: string;
  valoreAttuale: number;
  valoreIpotesi: number;
  unita: string;
  note?: string;
}) {
  return repo.insertIpotesi(actor, data);
}

export async function addIpotesiBatch(actor: ActorContext, scenarioId: string, ipotesi: Array<{
  variabile: string;
  valoreAttuale: number;
  valoreIpotesi: number;
  unita: string;
  note?: string;
}>) {
  return repo.insertIpotesiBatch(actor, scenarioId, ipotesi);
}

export async function updateIpotesi(actor: ActorContext, id: string, data: { valoreIpotesi: number; note?: string }) {
  return repo.updateIpotesi(actor, id, data);
}

export async function removeIpotesi(actor: ActorContext, id: string) {
  return repo.removeIpotesi(actor, id);
}

// ─── CALCOLA IMPATTO ─────────────────────────────────────────────────────────
/**
 * Motore di simulazione semplificato:
 * - Calcola variazione % per ogni ipotesi
 * - Stima impatto su ricavi/costi/utile annuale
 * - Calcola ROI e payback period se c'è investimento
 */
export async function calcolaImpatto(actor: ActorContext, scenarioId: string) {
  const scenario = await repo.getScenario(actor.companyId, scenarioId);
  if (!scenario) throw new Error("Scenario non trovato");

  const ipotesi = await repo.getIpotesiByScenario(actor.companyId, scenarioId);
  if (ipotesi.length === 0) throw new Error("Nessuna ipotesi definita");

  // Calcolo variazioni
  let deltaRicaviAnnuo = 0;
  let deltaCostiAnnuo = 0;
  let investimentoTotale = 0;

  for (const ip of ipotesi) {
    const attuale = Number(ip.valoreAttuale);
    const ipotizzato = Number(ip.valoreIpotesi);
    const diff = ipotizzato - attuale;
    const variazione = attuale !== 0 ? ((ipotizzato - attuale) / attuale) * 100 : 0;

    switch (ip.variabile) {
      case "investimento_iniziale":
        investimentoTotale += ipotizzato;
        break;
      case "costo_manodopera":
      case "costo_mangimi":
      case "costo_energia":
      case "costo_manutenzione":
        deltaCostiAnnuo += diff * 12; // mensile → annuo
        break;
      case "prezzo_latte":
        // Impatto: diff prezzo * produzione stimata * 365
        const prodGiorno = ipotesi.find(i => i.variabile === "produzione_latte_giorno");
        const capi = ipotesi.find(i => i.variabile === "numero_capi");
        const litriGiorno = Number(prodGiorno?.valoreIpotesi ?? prodGiorno?.valoreAttuale ?? 30);
        const nCapi = Number(capi?.valoreIpotesi ?? capi?.valoreAttuale ?? 50);
        deltaRicaviAnnuo += diff * litriGiorno * nCapi * 365;
        break;
      case "prezzo_carne":
        deltaRicaviAnnuo += diff * 500 * 12; // stima semplificata: 500kg/mese venduti
        break;
      case "produzione_latte_giorno":
        const prezzoLatte = ipotesi.find(i => i.variabile === "prezzo_latte");
        const capiProd = ipotesi.find(i => i.variabile === "numero_capi");
        const prezzo = Number(prezzoLatte?.valoreIpotesi ?? prezzoLatte?.valoreAttuale ?? 0.45);
        const nc = Number(capiProd?.valoreIpotesi ?? capiProd?.valoreAttuale ?? 50);
        deltaRicaviAnnuo += diff * prezzo * nc * 365;
        break;
      case "numero_capi":
        const pl = ipotesi.find(i => i.variabile === "prezzo_latte");
        const pg = ipotesi.find(i => i.variabile === "produzione_latte_giorno");
        const prezzoL = Number(pl?.valoreIpotesi ?? pl?.valoreAttuale ?? 0.45);
        const litri = Number(pg?.valoreIpotesi ?? pg?.valoreAttuale ?? 30);
        deltaRicaviAnnuo += diff * prezzoL * litri * 365;
        // Più capi = più costi mangimi stimati
        deltaCostiAnnuo += diff * 150 * 12; // 150€/capo/mese stima
        break;
      case "ettari_coltivati":
        const resa = ipotesi.find(i => i.variabile === "resa_ettaro");
        const pvColture = ipotesi.find(i => i.variabile === "prezzo_vendita_colture");
        const r = Number(resa?.valoreIpotesi ?? resa?.valoreAttuale ?? 60);
        const pv = Number(pvColture?.valoreIpotesi ?? pvColture?.valoreAttuale ?? 25);
        deltaRicaviAnnuo += diff * r * pv;
        deltaCostiAnnuo += diff * 800; // 800€/ha costi colturali stima
        break;
      case "resa_ettaro":
        const ha = ipotesi.find(i => i.variabile === "ettari_coltivati");
        const pvC = ipotesi.find(i => i.variabile === "prezzo_vendita_colture");
        const ettari = Number(ha?.valoreIpotesi ?? ha?.valoreAttuale ?? 20);
        const pvColt = Number(pvC?.valoreIpotesi ?? pvC?.valoreAttuale ?? 25);
        deltaRicaviAnnuo += diff * ettari * pvColt;
        break;
      case "prezzo_vendita_colture":
        const haC = ipotesi.find(i => i.variabile === "ettari_coltivati");
        const resaC = ipotesi.find(i => i.variabile === "resa_ettaro");
        const ettariC = Number(haC?.valoreIpotesi ?? haC?.valoreAttuale ?? 20);
        const resaV = Number(resaC?.valoreIpotesi ?? resaC?.valoreAttuale ?? 60);
        deltaRicaviAnnuo += diff * ettariC * resaV;
        break;
    }
  }

  const deltaUtileAnnuo = deltaRicaviAnnuo - deltaCostiAnnuo;
  const roi = investimentoTotale > 0 ? (deltaUtileAnnuo / investimentoTotale) * 100 : null;
  const paybackMesi = investimentoTotale > 0 && deltaUtileAnnuo > 0
    ? Math.ceil((investimentoTotale / deltaUtileAnnuo) * 12)
    : null;

  const risultato = {
    deltaRicaviAnnuo: Math.round(deltaRicaviAnnuo),
    deltaCostiAnnuo: Math.round(deltaCostiAnnuo),
    deltaUtileAnnuo: Math.round(deltaUtileAnnuo),
    investimentoTotale: Math.round(investimentoTotale),
    roi: roi !== null ? Math.round(roi * 10) / 10 : null,
    paybackMesi,
    variazioni: ipotesi.map(ip => ({
      variabile: ip.variabile,
      attuale: Number(ip.valoreAttuale),
      ipotesi: Number(ip.valoreIpotesi),
      variazione: Number(ip.valoreAttuale) !== 0
        ? Math.round(((Number(ip.valoreIpotesi) - Number(ip.valoreAttuale)) / Number(ip.valoreAttuale)) * 1000) / 10
        : 0,
    })),
    calcolatoIl: new Date().toISOString(),
  };

  await repo.updateScenarioRisultato(actor, scenarioId, JSON.stringify(risultato));
  return risultato;
}

// ─── CONFRONTA ───────────────────────────────────────────────────────────────
export async function confrontaScenari(actor: ActorContext, scenarioIds: string[]) {
  const rows = await repo.getScenariByIds(actor.companyId, scenarioIds);
  return rows
    .filter(r => r.risultatoJson)
    .map(r => ({
      id: r.id,
      nome: r.nome,
      modello: r.modello,
      stato: r.stato,
      risultato: JSON.parse(r.risultatoJson!),
    }));
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function deleteScenario(actor: ActorContext, id: string) {
  return repo.deleteScenario(actor, id);
}

// ─── ARCHIVIA ────────────────────────────────────────────────────────────────
export async function archiviaScenario(actor: ActorContext, id: string) {
  return repo.archiviaScenario(actor, id);
}

// ─── VARIABILI META (per UI) ─────────────────────────────────────────────────
export function getVariabiliMeta() {
  return VARIABILI_META;
}
