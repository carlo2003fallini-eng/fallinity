import type { ActorContext } from "../_core";
import { reinvestmentRepository as repo } from "./repository";
import type { AddFondoInput } from "./validators";

/** REINVESTMENT (Reintegrazione) — Service */
export const reinvestmentService = {
  async list(companyId: string) {
    const fondi = await repo.listFondi(companyId);
    const result = [];
    for (const f of fondi) {
      const mac = await repo.getMacchina(f.macchinaId);
      result.push({ ...f, nomeMacchina: mac?.nome ?? f.nomeDisplay });
    }
    return result;
  },

  totale(companyId: string) {
    return repo.totale(companyId);
  },

  rate(companyId: string, fondoId: string) {
    return repo.rate(companyId, fondoId);
  },

  add(actor: ActorContext, input: AddFondoInput) {
    return repo.insertFondo(actor, {
      ...input,
      valoreAcquisto: String(input.valoreAcquisto),
      fondoAttuale: String(input.fondoAttuale),
      tassoInteresse: String(input.tassoInteresse),
      rataConsigliata: input.rataConsigliata != null ? String(input.rataConsigliata) : null,
    });
  },

  /** Versa una rata: aggiorna il fondo e registra la rata pagata. */
  async pagaRata(actor: ActorContext, fondoId: string, importo: number) {
    const fondo = await repo.getFondo(fondoId);
    if (!fondo) throw new Error("Fondo non trovato");
    const nuovoFondo = Number(fondo.fondoAttuale) + importo;
    await repo.updateFondoAttuale(actor, fondoId, String(nuovoFondo));
    await repo.insertRata(actor, {
      fondoId, importo: String(importo), data: new Date().toISOString().split("T")[0], pagata: true,
    });
    return { success: true };
  },
};
