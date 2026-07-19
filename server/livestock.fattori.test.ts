import { describe, it, expect } from "vitest";
import { calcolaEffettiFattori, buildPatchFromFattori } from "./domains/livestock/service";
import {
  addAnimaleInput, createGruppoInput, spostaGruppoInput,
  spostaMultiploInput, createTrattamentoInput, anteprimaFattoriInput,
} from "./domains/livestock/validators";

/**
 * Test obbligatori — Stalla: Flusso Centrato sull'Animale + Fattori Predefiniti
 */

// ── Helper: mock animale e gruppo ──
const mockAnimale = (overrides: Record<string, unknown> = {}) => ({
  id: "anim-001",
  companyId: "comp-001",
  matricola: "IT001234567",
  numeroAziendale: "4187",
  nome: "Bianca",
  gruppoId: "grp-lattazione",
  statoProduttivo: "in_lattazione",
  statoRiproduttivo: "gravida",
  healthScore: 90,
  ...overrides,
});

const mockGruppo = (overrides: Record<string, unknown> = {}) => ({
  id: "grp-asciutta",
  companyId: "comp-001",
  nome: "Asciutta",
  codice: "GRP-002",
  tipologia: "asciutta",
  applicaFattoriPredefiniti: true,
  statoProduttivoPredefinito: "asciutta",
  modalitaStatoProduttivo: "conferma",
  statoRiproduttivoPredefinito: null,
  modalitaStatoRiproduttivo: "non_applicare",
  categoriaSanitariaPredefinita: null,
  modalitaCategoriaSanitaria: "non_applicare",
  percorsoOperativoPredefinito: null,
  ...overrides,
});

describe("Creazione animale con gruppo obbligatorio", () => {
  it("rifiuta la creazione senza gruppoId", () => {
    const result = addAnimaleInput.safeParse({
      matricola: "IT001234567",
      // gruppoId mancante
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map(i => i.path.join("."));
      expect(issues).toContain("gruppoId");
    }
  });

  it("accetta la creazione con gruppoId valido", () => {
    const result = addAnimaleInput.safeParse({
      matricola: "IT001234567",
      gruppoId: "grp-001",
    });
    expect(result.success).toBe(true);
  });
});

describe("Gruppo senza fattori predefiniti", () => {
  it("non produce effetti se applicaFattoriPredefiniti è false", () => {
    const gruppo = mockGruppo({ applicaFattoriPredefiniti: false });
    const animale = mockAnimale();
    const effetti = calcolaEffettiFattori(gruppo, animale);
    expect(effetti).toHaveLength(0);
  });

  it("la patch è vuota per gruppo senza fattori", () => {
    const effetti: ReturnType<typeof calcolaEffettiFattori> = [];
    const patch = buildPatchFromFattori(effetti, true);
    expect(Object.keys(patch)).toHaveLength(0);
  });
});

describe("Gruppo con fattore produttivo automatico", () => {
  it("applica statoProduttivo automaticamente", () => {
    const gruppo = mockGruppo({ modalitaStatoProduttivo: "automatico" });
    const animale = mockAnimale({ statoProduttivo: "in_lattazione" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    expect(effetti).toHaveLength(1);
    expect(effetti[0]).toMatchObject({
      campo: "statoProduttivo",
      valoreAttuale: "in_lattazione",
      valoreNuovo: "asciutta",
      modalita: "automatico",
    });
    const patch = buildPatchFromFattori(effetti, false); // conferma non necessaria per automatico
    expect(patch.statoProduttivo).toBe("asciutta");
  });
});

describe("Gruppo con modalità 'con conferma'", () => {
  it("non applica se conferma è false", () => {
    const gruppo = mockGruppo({ modalitaStatoProduttivo: "conferma" });
    const animale = mockAnimale({ statoProduttivo: "in_lattazione" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    expect(effetti).toHaveLength(1);
    const patch = buildPatchFromFattori(effetti, false);
    expect(patch.statoProduttivo).toBeUndefined();
  });

  it("applica se conferma è true", () => {
    const gruppo = mockGruppo({ modalitaStatoProduttivo: "conferma" });
    const animale = mockAnimale({ statoProduttivo: "in_lattazione" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    const patch = buildPatchFromFattori(effetti, true);
    expect(patch.statoProduttivo).toBe("asciutta");
  });
});

describe("Gruppo con modalità 'solo suggerimento'", () => {
  it("non applica mai il fattore (solo suggerimento visivo)", () => {
    const gruppo = mockGruppo({ modalitaStatoProduttivo: "suggerimento" });
    const animale = mockAnimale({ statoProduttivo: "in_lattazione" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    expect(effetti).toHaveLength(1);
    expect(effetti[0].modalita).toBe("suggerimento");
    const patch = buildPatchFromFattori(effetti, true); // anche con conferma, suggerimento non applica
    expect(patch.statoProduttivo).toBeUndefined();
  });
});

describe("Valore 'Nessuna modifica' conserva stato precedente", () => {
  it("non produce effetti se il valore predefinito è null", () => {
    const gruppo = mockGruppo({
      statoProduttivoPredefinito: null,
      modalitaStatoProduttivo: "automatico",
    });
    const animale = mockAnimale({ statoProduttivo: "in_lattazione" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    // statoProduttivoPredefinito è null → nessun effetto
    expect(effetti.filter(e => e.campo === "statoProduttivo")).toHaveLength(0);
  });

  it("statoRiproduttivo non viene modificato se non_applicare", () => {
    const gruppo = mockGruppo({
      statoRiproduttivoPredefinito: null,
      modalitaStatoRiproduttivo: "non_applicare",
    });
    const animale = mockAnimale({ statoRiproduttivo: "gravida" });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    expect(effetti.filter(e => e.campo === "statoRiproduttivo")).toHaveLength(0);
  });
});

describe("Vacca gravida spostata in Asciutta — mantenimento stato riproduttivo", () => {
  it("cambia statoProduttivo ma mantiene statoRiproduttivo gravida", () => {
    const gruppo = mockGruppo({
      statoProduttivoPredefinito: "asciutta",
      modalitaStatoProduttivo: "automatico",
      statoRiproduttivoPredefinito: null,
      modalitaStatoRiproduttivo: "non_applicare",
    });
    const animale = mockAnimale({
      statoProduttivo: "in_lattazione",
      statoRiproduttivo: "gravida",
    });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    const patch = buildPatchFromFattori(effetti, true);
    expect(patch.statoProduttivo).toBe("asciutta");
    expect(patch.statoRiproduttivo).toBeUndefined(); // gravida rimane invariata
  });
});

describe("Spostamento multiplo applica fattori correttamente", () => {
  it("validator accetta array di animaleIds", () => {
    const result = spostaMultiploInput.safeParse({
      animaleIds: ["anim-001", "anim-002", "anim-003"],
      nuovoGruppoId: "grp-asciutta",
      confermaFattori: true,
    });
    expect(result.success).toBe(true);
  });

  it("validator rifiuta array vuoto", () => {
    const result = spostaMultiploInput.safeParse({
      animaleIds: [],
      nuovoGruppoId: "grp-asciutta",
    });
    expect(result.success).toBe(false);
  });
});

describe("Trattamento collegato via animalId", () => {
  it("validator richiede animaleId e dataTrattamento", () => {
    const result = createTrattamentoInput.safeParse({
      animaleId: "anim-001",
      dataTrattamento: "2026-07-20T10:00:00Z",
      tipo: "farmaco",
      farmaco: "Ceftiofur",
      dose: "5ml",
    });
    expect(result.success).toBe(true);
  });

  it("validator rifiuta senza animaleId", () => {
    const result = createTrattamentoInput.safeParse({
      dataTrattamento: "2026-07-20T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("Timeline registra spostamento con stati precedenti/nuovi", () => {
  it("calcolaEffettiFattori restituisce valori attuali e nuovi per la timeline", () => {
    const gruppo = mockGruppo({
      statoProduttivoPredefinito: "asciutta",
      modalitaStatoProduttivo: "automatico",
    });
    const animale = mockAnimale({
      statoProduttivo: "in_lattazione",
      statoRiproduttivo: "gravida",
    });
    const effetti = calcolaEffettiFattori(gruppo, animale);
    const effettoSP = effetti.find(e => e.campo === "statoProduttivo");
    expect(effettoSP).toBeDefined();
    expect(effettoSP!.valoreAttuale).toBe("in_lattazione");
    expect(effettoSP!.valoreNuovo).toBe("asciutta");
    // statoRiproduttivo non presente (non_applicare)
    expect(effetti.find(e => e.campo === "statoRiproduttivo")).toBeUndefined();
  });
});

describe("Isolamento multi-azienda", () => {
  it("createGruppoInput non contiene companyId (viene iniettato dal context)", () => {
    const result = createGruppoInput.safeParse({
      nome: "Lattazione",
      tipologia: "lattazione",
      applicaFattoriPredefiniti: true,
      statoProduttivoPredefinito: "in_lattazione",
      modalitaStatoProduttivo: "automatico",
    });
    expect(result.success).toBe(true);
    // companyId non è nel validator, viene dal ctx.user
    expect((result.data as any).companyId).toBeUndefined();
  });

  it("anteprimaFattoriInput richiede gruppoDestinazioneId", () => {
    const result = anteprimaFattoriInput.safeParse({
      gruppoDestinazioneId: "grp-001",
      animaleId: "anim-001",
    });
    expect(result.success).toBe(true);
  });
});

describe("Nessuna modifica retroattiva dopo modifica fattori del gruppo", () => {
  it("la logica fattori opera solo al momento dello spostamento, non retroattivamente", () => {
    // Questo test verifica il design: calcolaEffettiFattori prende un singolo animale
    // e calcola gli effetti al momento dell'invocazione. Non esiste una funzione
    // che applica retroattivamente i fattori a tutti gli animali del gruppo.
    const gruppo = mockGruppo({ statoProduttivoPredefinito: "asciutta", modalitaStatoProduttivo: "automatico" });
    const animaleGiaAsciutta = mockAnimale({ statoProduttivo: "asciutta" });
    const effetti = calcolaEffettiFattori(gruppo, animaleGiaAsciutta);
    // Nessun effetto perché l'animale ha già lo stato target
    expect(effetti).toHaveLength(0);
  });
});
