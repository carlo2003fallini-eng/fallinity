import { describe, it, expect } from "vitest";
import { statoDisponibilita, calcolaHealthScore, statoScortaRicambio } from "./domains/fleet/service";

describe("statoDisponibilita", () => {
  it("ritorna non_disponibile quando la scorta è zero o negativa", () => {
    expect(statoDisponibilita(0, 3, 2)).toBe("non_disponibile");
    expect(statoDisponibilita(-1, 1, 0)).toBe("non_disponibile");
  });

  it("ritorna insufficiente quando la disponibilità è minore del richiesto", () => {
    expect(statoDisponibilita(2, 5, 1)).toBe("insufficiente");
  });

  it("ritorna sotto_scorta quando disponibile <= soglia ma copre il richiesto", () => {
    expect(statoDisponibilita(2, 1, 3)).toBe("sotto_scorta");
    expect(statoDisponibilita(3, 2, 3)).toBe("sotto_scorta");
  });

  it("ritorna disponibile quando la scorta è sopra soglia e copre il richiesto", () => {
    expect(statoDisponibilita(10, 2, 3)).toBe("disponibile");
  });

  it("ignora la soglia quando è zero", () => {
    expect(statoDisponibilita(1, 1, 0)).toBe("disponibile");
  });
});

describe("calcolaHealthScore", () => {
  it("ritorna 100 per una macchina operativa senza interventi", () => {
    expect(calcolaHealthScore({ stato: "operativo" }, [])).toBe(100);
  });

  it("cappa a 35 una macchina ferma", () => {
    const score = calcolaHealthScore({ stato: "fermo", healthScore: 100 }, []);
    expect(score).toBeLessThanOrEqual(35);
  });

  it("penalizza per interventi aperti e urgenze", () => {
    const score = calcolaHealthScore({ stato: "operativo" }, [
      { stato: "pianificato", priorita: "urgente" },
      { stato: "in_corso", priorita: "media" },
    ]);
    // 100 - 8*2 (aperti) - 12 (urgente) = 72
    expect(score).toBe(72);
  });

  it("penalizza per manutenzione scaduta", () => {
    const ieri = new Date(Date.now() - 86_400_000).toISOString();
    const score = calcolaHealthScore({ stato: "operativo", prossimaManutenzione: ieri }, []);
    // 100 - 20 = 80
    expect(score).toBe(80);
  });

  it("non scende mai sotto zero", () => {
    const aperti = Array.from({ length: 30 }, () => ({ stato: "pianificato", priorita: "urgente" }));
    expect(calcolaHealthScore({ stato: "operativo" }, aperti)).toBe(0);
  });

  it("non supera mai 100", () => {
    expect(calcolaHealthScore({ stato: "operativo", healthScore: 100 }, [])).toBeLessThanOrEqual(100);
  });
});

describe("statoScortaRicambio (stati estesi)", () => {
  it("ritorna 'ordinato' quando statoOrdine è ordinato, a prescindere dalla scorta", () => {
    expect(statoScortaRicambio(0, 2, "ordinato")).toBe("ordinato");
    expect(statoScortaRicambio(100, 2, "ordinato")).toBe("ordinato");
  });

  it("ritorna 'non_disponibile' quando la scorta è zero senza stato ordine", () => {
    expect(statoScortaRicambio(0, 2, null)).toBe("non_disponibile");
  });

  it("ritorna 'da_ordinare' quando esaurito e marcato da_ordinare", () => {
    expect(statoScortaRicambio(0, 2, "da_ordinare")).toBe("da_ordinare");
  });

  it("ritorna 'sotto_scorta' quando disponibile <= soglia senza stato ordine", () => {
    expect(statoScortaRicambio(2, 3, null)).toBe("sotto_scorta");
  });

  it("ritorna 'da_ordinare' quando sotto scorta e marcato da_ordinare", () => {
    expect(statoScortaRicambio(2, 3, "da_ordinare")).toBe("da_ordinare");
  });

  it("ritorna 'disponibile' quando la scorta è sopra soglia", () => {
    expect(statoScortaRicambio(10, 3, null)).toBe("disponibile");
    expect(statoScortaRicambio(10, 3, "nessuno")).toBe("disponibile");
  });
});
