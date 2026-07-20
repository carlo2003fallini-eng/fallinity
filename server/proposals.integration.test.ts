import { describe, it, expect } from "vitest";
import { proposalsService } from "./domains/finance/proposals.service";
import { proposalsRepository } from "./domains/finance/proposals.repository";
import type { ActorContext } from "./domains/_core";

const COMPANY_ID = "test-company-proposals";
const actor: ActorContext = {
  companyId: COMPANY_ID,
  userId: 1,
  userUuid: "test-user-uuid",
  userRole: "admin",
};

const oggi = new Date().toISOString().slice(0, 10);
const RUN_ID = Date.now().toString(36); // unique per run per evitare collisioni

describe("Proposals Service — Idempotenza", () => {
  it("createOrGetProposal crea una nuova proposta", async () => {
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 15000,
      descrizione: "Test intervento officina",
      dataOrigine: oggi,
      originModule: "fleet",
      originEntityType: "intervento",
      originEntityId: `test-intervento-${RUN_ID}-001`,
      originEventType: "completamento",
      originReference: "INT-001",
    });
    expect(result.created).toBe(true);
    expect(result.id).toBeTruthy();
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.stato).toBe("da_esaminare");
  });

  it("createOrGetProposal è idempotente (non duplica)", async () => {
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 15000,
      descrizione: "Test intervento officina",
      dataOrigine: oggi,
      originModule: "fleet",
      originEntityType: "intervento",
      originEntityId: `test-intervento-${RUN_ID}-001`,
      originEventType: "completamento",
      originReference: "INT-001",
    });
    expect(result.created).toBe(false);
    expect(result.id).toBeTruthy();
  });

  it("chiave diversa genera proposta separata", async () => {
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 5000,
      descrizione: "Test intervento 2",
      dataOrigine: oggi,
      originModule: "fleet",
      originEntityType: "intervento",
      originEntityId: `test-intervento-${RUN_ID}-002`,
      originEventType: "completamento",
      originReference: "INT-002",
    });
    expect(result.created).toBe(true);
    expect(result.id).toBeTruthy();
  });
});

describe("Proposals Service — Workflow", () => {
  let proposalId: string;

  it("crea proposta per test workflow", async () => {
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 25000,
      descrizione: "Proposta workflow test",
      dataOrigine: oggi,
      originModule: "inventory",
      originEntityType: "movimento",
      originEntityId: `test-mov-workflow-${RUN_ID}`,
      originEventType: "carico_test",
      originReference: "MOV-WF",
    });
    expect(result.created).toBe(true);
    proposalId = result.id!;
  });

  it("ignore segna la proposta come ignorata", async () => {
    const result = await proposalsService.ignore(actor, {
      proposalId,
      motivo: "Già contabilizzato manualmente",
    });
    expect(result.success).toBe(true);

    const detail = await proposalsService.detail(COMPANY_ID, proposalId);
    expect(detail?.stato).toBe("ignorata");
    expect(detail?.motivoIgnorato).toBe("Già contabilizzato manualmente");
  });

  it("proposta ignorata non può essere ignorata di nuovo", async () => {
    await expect(
      proposalsService.ignore(actor, { proposalId, motivo: "Doppio" })
    ).rejects.toThrow();
  });
});

describe("Proposals Service — Lista e Conteggi", () => {
  it("list restituisce le proposte con paginazione", async () => {
    const result = await proposalsService.list(COMPANY_ID, { limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("countByStato restituisce i conteggi raggruppati", async () => {
    const counts = await proposalsService.countByStato(COMPANY_ID);
    expect(Array.isArray(counts)).toBe(true);
    // Dovrebbe avere almeno 'da_esaminare' e 'ignorata' dai test precedenti
    const stati = counts.map((c: any) => c.stato);
    expect(stati).toContain("da_esaminare");
  });

  it("list con filtro stato", async () => {
    const result = await proposalsService.list(COMPANY_ID, { stato: "da_esaminare", limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.stato).toBe("da_esaminare");
    }
  });

  it("list con filtro modulo", async () => {
    const result = await proposalsService.list(COMPANY_ID, { originModule: "fleet", limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p.originModule).toBe("fleet");
    }
  });
});

describe("Proposals Service — Stato origine (per moduli)", () => {
  it("getOriginStatus restituisce le proposte di un'entità", async () => {
    const result = await proposalsService.getOriginStatus(COMPANY_ID, {
      originModule: "fleet",
      originEntityId: `test-intervento-${RUN_ID}-001`,
    });
    expect(result.hasProposals).toBe(true);
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.proposals[0].originEventType).toBe("completamento");
  });

  it("getOriginStatus per entità senza proposte", async () => {
    const result = await proposalsService.getOriginStatus(COMPANY_ID, {
      originModule: "fleet",
      originEntityId: "non-esiste",
    });
    expect(result.hasProposals).toBe(false);
    expect(result.proposals.length).toBe(0);
  });
});

describe("Proposals Service — Impostazioni", () => {
  it("updateSettings crea/aggiorna impostazioni per modulo", async () => {
    const result = await proposalsService.updateSettings(actor, {
      modulo: "fleet",
      automazione: "proposta_auto",
      manodoperaInternaMode: "finanziario",
    });
    expect(result).toBeTruthy();
  });

  it("getSettings restituisce le impostazioni salvate", async () => {
    const settings = await proposalsService.getSettings(COMPANY_ID, "fleet");
    expect(settings).not.toBeNull();
    expect(settings!.automazione).toBe("proposta_auto");
    expect(settings!.manodoperaInternaMode).toBe("finanziario");
  });

  it("isManodoperaFinanziaria restituisce true se mode=finanziario", async () => {
    const result = await proposalsService.isManodoperaFinanziaria(COMPANY_ID, "fleet");
    expect(result).toBe(true);
  });

  it("isAutomationEnabled restituisce true se automazione != nessuna", async () => {
    const result = await proposalsService.isAutomationEnabled(COMPANY_ID, "fleet");
    expect(result).toBe(true);
  });

  it("automazione 'nessuna' blocca la creazione di proposte", async () => {
    await proposalsService.updateSettings(actor, {
      modulo: "test_nessuna",
      automazione: "nessuna",
    });
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 1000,
      descrizione: "Non dovrebbe essere creata",
      dataOrigine: oggi,
      originModule: "test_nessuna",
      originEntityType: "test",
      originEntityId: "skip-001",
      originEventType: "test_skip",
    });
    expect(result.skipped).toBe(true);
    expect(result.id).toBeNull();
  });
});

describe("Proposals Service — Retry", () => {
  let errorProposalId: string;

  it("crea proposta e la mette in errore", async () => {
    const result = await proposalsService.createOrGetProposal(actor, {
      tipo: "uscita",
      importo: 9900,
      descrizione: "Proposta per retry test",
      dataOrigine: oggi,
      originModule: "crop",
      originEntityType: "lavorazione",
      originEntityId: `retry-test-${RUN_ID}`,
      originEventType: "lavorazione_retry",
    });
    errorProposalId = result.id!;
    // Simula errore manualmente
    await proposalsRepository.update(actor, errorProposalId, { stato: "errore", errore: "Simulated error" });
  });

  it("retry riporta la proposta a da_esaminare", async () => {
    const result = await proposalsService.retry(actor, errorProposalId);
    expect(result.success).toBe(true);
    const detail = await proposalsService.detail(COMPANY_ID, errorProposalId);
    expect(detail?.stato).toBe("da_esaminare");
  });
});
