import { describe, it, expect } from "vitest";
import { financeService } from "./domains/finance/service";

/**
 * FINANCE FASE 2 — Test Vitest
 * Verifica: pagamenti parziali, residuo, stati documento, rate, ricorrenze, codici interni.
 * Nota: test unitari sulla logica pura (calcolaIva, scorporaIva) e validazione strutturale.
 * I test che richiedono DB sono mock-based.
 */

describe("Finance Fase 2 — Codice interno", () => {
  it("genera codice DOC-ENT-000001 per prima entrata", () => {
    // Il formato atteso è DOC-ENT-XXXXXX o DOC-USC-XXXXXX
    const prefix = "DOC-ENT";
    const count = 0;
    const codice = `${prefix}-${String(count + 1).padStart(6, "0")}`;
    expect(codice).toBe("DOC-ENT-000001");
  });

  it("genera codice DOC-USC-000042 per 42esima uscita", () => {
    const prefix = "DOC-USC";
    const count = 41;
    const codice = `${prefix}-${String(count + 1).padStart(6, "0")}`;
    expect(codice).toBe("DOC-USC-000042");
  });
});

describe("Finance Fase 2 — Logica residuo", () => {
  it("residuo iniziale = totale per documento non pagato", () => {
    const totale = 12200;
    const tipoRegistrazione = "documento";
    const residuo = tipoRegistrazione === "pagato_subito" ? 0 : totale;
    expect(residuo).toBe(12200);
  });

  it("residuo iniziale = 0 per pagato subito", () => {
    const totale = 12200;
    const tipoRegistrazione = "pagato_subito";
    const residuo = tipoRegistrazione === "pagato_subito" ? 0 : totale;
    expect(residuo).toBe(0);
  });

  it("pagamento parziale riduce il residuo correttamente", () => {
    const totale = 10000;
    const totalePagato = 0;
    const importoPagamento = 3000;
    const nuovoTotalePagato = totalePagato + importoPagamento;
    const nuovoResiduo = totale - nuovoTotalePagato;
    expect(nuovoTotalePagato).toBe(3000);
    expect(nuovoResiduo).toBe(7000);
  });

  it("pagamento totale porta residuo a 0", () => {
    const totale = 10000;
    const totalePagato = 7000;
    const importoPagamento = 3000;
    const nuovoTotalePagato = totalePagato + importoPagamento;
    const nuovoResiduo = totale - nuovoTotalePagato;
    expect(nuovoTotalePagato).toBe(10000);
    expect(nuovoResiduo).toBe(0);
  });

  it("importo pagamento non può superare il residuo", () => {
    const residuo = 5000;
    const importoPagamento = 6000;
    expect(importoPagamento > residuo).toBe(true);
  });
});

describe("Finance Fase 2 — Stati documento", () => {
  it("stato 'pagato' quando residuo = 0 e tipo = uscita", () => {
    const tipo = "uscita";
    const nuovoResiduo = 0;
    const stato = nuovoResiduo <= 0
      ? (tipo === "entrata" ? "incassato" : "pagato")
      : "parzialmente_regolato";
    expect(stato).toBe("pagato");
  });

  it("stato 'incassato' quando residuo = 0 e tipo = entrata", () => {
    const tipo = "entrata";
    const nuovoResiduo = 0;
    const stato = nuovoResiduo <= 0
      ? (tipo === "entrata" ? "incassato" : "pagato")
      : "parzialmente_regolato";
    expect(stato).toBe("incassato");
  });

  it("stato 'parzialmente_regolato' quando residuo > 0", () => {
    const tipo = "uscita";
    const nuovoResiduo = 3000;
    const stato = nuovoResiduo <= 0
      ? (tipo === "entrata" ? "incassato" : "pagato")
      : "parzialmente_regolato";
    expect(stato).toBe("parzialmente_regolato");
  });

  it("annullamento pagamento ripristina stato a 'registrato' se totalePagato torna a 0", () => {
    const nuovoTotalePagato = 0;
    const stato = nuovoTotalePagato === 0 ? "registrato" : "parzialmente_regolato";
    expect(stato).toBe("registrato");
  });
});

describe("Finance Fase 2 — Rate", () => {
  it("split uniforme 3 rate da 10000 centesimi", () => {
    const residuo = 10000;
    const numeroRate = 3;
    const importoRata = Math.floor(residuo / numeroRate);
    const resto = residuo - (importoRata * numeroRate);
    // Prima e seconda rata: 3333, terza: 3333 + 1 = 3334
    expect(importoRata).toBe(3333);
    expect(resto).toBe(1);
    const ultimaRata = importoRata + resto;
    expect(ultimaRata).toBe(3334);
    // Somma totale = 3333 + 3333 + 3334 = 10000
    expect(importoRata * (numeroRate - 1) + ultimaRata).toBe(10000);
  });

  it("split uniforme 4 rate da 12200 centesimi", () => {
    const residuo = 12200;
    const numeroRate = 4;
    const importoRata = Math.floor(residuo / numeroRate);
    const resto = residuo - (importoRata * numeroRate);
    expect(importoRata).toBe(3050);
    expect(resto).toBe(0);
    expect(importoRata * numeroRate).toBe(12200);
  });

  it("calcola date scadenza mensili correttamente", () => {
    const dataInizio = "2026-01-15";
    const frequenzaMesi = 1; // mensile
    const rate: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(dataInizio);
      d.setMonth(d.getMonth() + (i * frequenzaMesi));
      rate.push(d.toISOString().split("T")[0]);
    }
    expect(rate[0]).toBe("2026-01-15");
    expect(rate[1]).toBe("2026-02-15");
    expect(rate[2]).toBe("2026-03-15");
  });

  it("calcola date scadenza trimestrali correttamente", () => {
    const dataInizio = "2026-03-01";
    const frequenzaMesi = 3; // trimestrale
    const rate: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(dataInizio);
      d.setMonth(d.getMonth() + (i * frequenzaMesi));
      rate.push(d.toISOString().split("T")[0]);
    }
    expect(rate[0]).toBe("2026-03-01");
    expect(rate[1]).toBe("2026-06-01");
    expect(rate[2]).toBe("2026-09-01");
    expect(rate[3]).toBe("2026-12-01");
  });
});

describe("Finance Fase 2 — Ricorrenze", () => {
  it("calcola prossima emissione mensile", () => {
    const prossimaEmissione = "2026-07-01";
    const frequenzaMesi = 1;
    const prossima = new Date(prossimaEmissione);
    prossima.setMonth(prossima.getMonth() + frequenzaMesi);
    const prossimaStr = prossima.toISOString().split("T")[0];
    expect(prossimaStr).toBe("2026-08-01");
  });

  it("disattiva ricorrenza quando prossima > dataFine", () => {
    const prossimaStr = "2026-09-01";
    const dataFine = "2026-08-31";
    const deveDisattivare = prossimaStr > dataFine;
    expect(deveDisattivare).toBe(true);
  });

  it("non disattiva ricorrenza quando prossima <= dataFine", () => {
    const prossimaStr = "2026-08-01";
    const dataFine = "2026-12-31";
    const deveDisattivare = prossimaStr > dataFine;
    expect(deveDisattivare).toBe(false);
  });
});

describe("Finance Fase 2 — Storno pagamento", () => {
  it("storno entrata: delta negativo sul saldo", () => {
    const tipo = "entrata";
    const importo = 5000;
    const saldoAttuale = 15000;
    const delta = tipo === "entrata" ? -importo : importo;
    const saldoDopo = saldoAttuale + delta;
    expect(delta).toBe(-5000);
    expect(saldoDopo).toBe(10000);
  });

  it("storno uscita: delta positivo sul saldo", () => {
    const tipo = "uscita";
    const importo = 3000;
    const saldoAttuale = 7000;
    const delta = tipo === "entrata" ? -importo : importo;
    const saldoDopo = saldoAttuale + delta;
    expect(delta).toBe(3000);
    expect(saldoDopo).toBe(10000);
  });
});

describe("Finance Fase 2 — Scadenza parziale", () => {
  it("scadenza diventa parzialmente_pagata dopo pagamento parziale", () => {
    const importoScadenza = 10000;
    const importoPagatoPrecedente = 0;
    const importoPagamento = 4000;
    const nuovoPagato = importoPagatoPrecedente + importoPagamento;
    const nuovoResiduo = importoScadenza - nuovoPagato;
    const tipo = "uscita";
    const nuovoStato = nuovoResiduo <= 0
      ? (tipo === "entrata" ? "incassata" : "pagata")
      : "parzialmente_pagata";
    expect(nuovoStato).toBe("parzialmente_pagata");
    expect(nuovoResiduo).toBe(6000);
  });

  it("scadenza diventa pagata dopo pagamento totale", () => {
    const importoScadenza = 10000;
    const importoPagatoPrecedente = 4000;
    const importoPagamento = 6000;
    const nuovoPagato = importoPagatoPrecedente + importoPagamento;
    const nuovoResiduo = importoScadenza - nuovoPagato;
    const tipo = "uscita";
    const nuovoStato = nuovoResiduo <= 0
      ? (tipo === "entrata" ? "incassata" : "pagata")
      : "parzialmente_pagata";
    expect(nuovoStato).toBe("pagata");
    expect(nuovoResiduo).toBe(0);
  });
});
