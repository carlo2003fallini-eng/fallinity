import type { ActorContext } from "../_core";
import { inventoryRepository as repo } from "./repository";
import { proposalsService } from "../finance/proposals.service";
import type { CreateProdottoInput, MovimentoInput } from "./validators";

/** INVENTORY (Magazzino) — Service */
export const inventoryService = {
  list(companyId: string) {
    return repo.listProdotti(companyId);
  },

  async stats(companyId: string) {
    const rows = await repo.listProdotti(companyId);
    let valoreMagazzino = 0;
    let sottoScorta = 0;
    for (const p of rows) {
      valoreMagazzino += Number(p.quantita) * Number(p.prezzoUnitario ?? 0);
      if (Number(p.quantitaMinima ?? 0) > 0 && Number(p.quantita) <= Number(p.quantitaMinima)) sottoScorta++;
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
    });
  },

  /** Registra un movimento e aggiorna la giacenza del prodotto. */
  async registraMovimento(actor: ActorContext, input: MovimentoInput) {
    await repo.insertMovimento(actor, { ...input, quantita: String(input.quantita) });
    const p = await repo.getProdotto(input.prodottoId);
    if (p) {
      const nuova = input.tipo === "carico"
        ? Number(p.quantita) + input.quantita
        : Number(p.quantita) - input.quantita;
      await repo.updateQuantita(actor, input.prodottoId, String(Math.max(0, nuova)));
    }

    // Proposta finanziaria: carico = acquisto (uscita), scarico = consumo gestionale (no proposta)
    if (input.tipo === "carico" && p) {
      try {
        const prezzoUnitario = Number(p.prezzoUnitario ?? 0);
        const importo = Math.round(prezzoUnitario * input.quantita * 100); // centesimi
        if (importo > 0) {
          await proposalsService.createOrGetProposal(actor, {
            tipo: "uscita",
            importo,
            descrizione: `Acquisto ${p.nome} (${input.quantita} ${p.unitaMisura ?? "pz"})`,
            dataOrigine: input.data,
            originModule: "inventory",
            originEntityType: "movimento",
            originEntityId: input.prodottoId, // idempotenza per prodotto+evento
            originEventType: `carico_${input.data}`,
            originReference: p.codice ?? p.nome,
          });
        }
      } catch {
        /* non bloccare il movimento se la proposta fallisce */
      }
    }

    return { success: true };
  },

  remove(actor: ActorContext, id: string) {
    return repo.softDeleteProdotto(actor, id);
  },
};
