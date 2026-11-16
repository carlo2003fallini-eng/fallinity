import { inventoryRepository } from "../inventory/repository";
import { fleetRepository } from "./repository";

/** Unica regola condivisa tra Ricambi, Operatore e KPI. */
export function eRicambio(product: any) {
  const value = [product.categoria, product.reparto, product.famiglia, product.sottocategoria, product.nome]
    .filter(Boolean).join(" ").toLowerCase();
  return Boolean(product.reparto || product.famiglia || /ricamb|pezzi di ricambio/.test(value));
}

export function statoGiacenza(disponibile: number, soglia: number) {
  if (disponibile <= 0) return "non_disponibile";
  if (soglia > 0 && disponibile <= soglia) return "sotto_scorta";
  return "disponibile";
}

export function normalizzaProdottoRicambio(p: any) {
  return {
    ...p,
    source: "magazzino" as const,
    quantitaDisponibile: String(p.quantita ?? 0),
    sogliaMinima: String(p.quantitaMinima ?? 0),
    costoMedio: p.prezzoUnitario ?? null,
    categoria: p.categoria || "Ricambi",
    fornitore: p.fornitore || null,
    statoOrdine: p.statoOrdine || "nessuno",
    statoScorta: statoGiacenza(Number(p.quantita), Number(p.quantitaMinima ?? 0)),
  };
}

export async function listRicambiCondivisi(companyId: string) {
  const [products, legacy] = await Promise.all([
    inventoryRepository.listProdotti(companyId), fleetRepository.listRicambi(companyId),
  ]);
  // I vecchi record restano accessibili, ma tutte le nuove creazioni usano prodotti.
  return [
    ...products.filter(eRicambio).map(normalizzaProdottoRicambio),
    ...legacy.map((r) => ({ ...r, source: "legacy" as const,
      statoScorta: statoGiacenza(Number(r.quantitaDisponibile), Number(r.sogliaMinima)) })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}
