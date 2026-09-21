import type { ActorContext } from "../_core";
import { inventoryRepository as repo } from "./repository";
import { proposalsService } from "../finance/proposals.service";
import type { CreateProdottoInput, MovimentoInput, ScaricoRapidoInput } from "./validators";

function italianBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (part: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** INVENTORY (Magazzino) — Service */
export const inventoryService = {
  list(companyId: string) {
    return repo.listProdotti(companyId);
  },

  async stats(companyId: string) {
    const rows = await repo.listProdotti(companyId);
    let valoreMagazzino = 0;
    let sottoScorta = 0;
    for (const prodotto of rows) {
      valoreMagazzino += Number(prodotto.quantita) * Number(prodotto.prezzoUnitario ?? 0);
      if (Number(prodotto.quantitaMinima ?? 0) > 0 && Number(prodotto.quantita) <= Number(prodotto.quantitaMinima)) sottoScorta++;
    }
    return { totaleProdotti: rows.length, sottoScorta, valoreMagazzino };
  },

  movimenti(companyId: string, prodottoId: string) {
    return repo.listMovimenti(companyId, prodottoId);
  },

  create(actor: ActorContext, input: CreateProdottoInput) {
    return repo.insertProdotto(actor, {
      ...input,
      quantita: String(input.quantita),
      quantitaMinima: String(input.quantitaMinima),
      prezzoUnitario: input.prezzoUnitario != null ? String(input.prezzoUnitario) : null,
      ultimoScaricoQuantita: null,
      ultimoScaricoAt: null,
    });
  },

  /**
   * Movimento generico per integrazioni esistenti. Carichi manuali restano possibili,
   * ma la UI operativa privilegia il flusso `scaricaRapido`.
   */
  async registraMovimento(actor: ActorContext, input: MovimentoInput) {
    const result = await repo.registraMovimentoAtomico(actor, {
      ...input,
      quantita: String(input.quantita),
      descrizione: input.descrizione || (input.tipo === "carico" ? "Carico manuale" : "Scarico manuale"),
      causale: input.causale,
      note: input.note,
    });

    // Proposta finanziaria: carico = acquisto (uscita), scarico = consumo gestionale (no proposta)
    if (input.tipo === "carico") {
      try {
        const prezzoUnitario = Number(result.prodotto.prezzoUnitario ?? 0);
        const importo = Math.round(prezzoUnitario * input.quantita * 100); // centesimi
        if (importo > 0) {
          await proposalsService.createOrGetProposal(actor, {
            tipo: "uscita",
            importo,
            descrizione: `Acquisto ${result.prodotto.nome} (${input.quantita} ${result.prodotto.unitaMisura ?? "pz"})`,
            dataOrigine: input.data,
            originModule: "inventory",
            originEntityType: "movimento",
            originEntityId: result.movimentoId,
            originEventType: `carico_${input.data}`,
            originReference: result.prodotto.codice ?? result.prodotto.nome,
          });
        }
      } catch {
        /* non bloccare il movimento se la proposta fallisce */
      }
    }

    return result;
  },

  /** Scarico mobile in un gesto: validazione, audit e saldo aggiornato sono atomici. */
  scaricaRapido(actor: ActorContext, input: ScaricoRapidoInput) {
    const causale = input.causale?.trim();
    return repo.registraMovimentoAtomico(actor, {
      prodottoId: input.prodottoId,
      tipo: "scarico",
      quantita: String(input.quantita),
      data: italianBusinessDate(),
      descrizione: causale ? `Scarico rapido — ${causale}` : "Scarico rapido",
      causale,
      note: input.note?.trim(),
    });
  },

  remove(actor: ActorContext, id: string) {
    return repo.softDeleteProdotto(actor, id);
  },
};
