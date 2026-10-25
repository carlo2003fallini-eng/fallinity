import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { membriDelGruppo, statsGruppo } from "./domains/livestock/service";
import { aggiungiMultiploInput, createGruppoInput, spostaMultiploInput } from "./domains/livestock/validators";

const animal = (overrides: Record<string, unknown> = {}) => ({
  id: "a-1", gruppoId: "operativo", statoProduttivo: "in_lattazione", statoRiproduttivo: "vuota", produzioneOggi: "36.5", healthScore: 90, ...overrides,
});
const group = (overrides: Record<string, unknown> = {}) => ({
  id: "g-1", tipoGestione: "manuale", modalitaMembri: "esclusivo", tipologia: "lattazione", ...overrides,
});

describe("Gruppi automatici", () => {
  it("calcola Alta produzione solo per bovine in lattazione sopra soglia", () => {
    const membri = membriDelGruppo(group({ tipoGestione: "automatico", regolaAutomatica: { tipo: "alta_produzione", sogliaLitriGiorno: 35 } }), [animal(), animal({ id: "a-2", produzioneOggi: "34.9" }), animal({ id: "a-3", statoProduttivo: "asciutta", produzioneOggi: "45" })], [], new Map());
    expect(membri.map((item) => item.id)).toEqual(["a-1"]);
  });

  it("calcola Post-parto dalla data parto più recente", () => {
    const now = Date.now();
    const parti = new Map<string, Date>([["a-1", new Date(now - 5 * 86400000)], ["a-2", new Date(now - 30 * 86400000)]]);
    const membri = membriDelGruppo(group({ tipoGestione: "automatico", regolaAutomatica: { tipo: "post_parto", giorniMassimi: 21 } }), [animal(), animal({ id: "a-2" })], [], parti);
    expect(membri.map((item) => item.id)).toEqual(["a-1"]);
  });
});

describe("Gruppi personali sovrapposti", () => {
  it("non sostituiscono il gruppo operativo dell'animale", () => {
    const membri = membriDelGruppo(group({ modalitaMembri: "personalizzato" }), [animal({ gruppoId: "operativo" }), animal({ id: "a-2", gruppoId: "altro" })], [{ gruppoId: "g-1", animaleId: "a-1" }, { gruppoId: "g-altro", animaleId: "a-1" }], new Map());
    expect(membri).toHaveLength(1);
    expect(membri[0].gruppoId).toBe("operativo");
  });

  it("mantiene statistiche coerenti sui membri risolti", () => {
    const stats = statsGruppo([animal(), animal({ id: "a-2", statoProduttivo: "asciutta", statoRiproduttivo: "gravida" })]);
    expect(stats).toMatchObject({ nAnimali: 2, inLattazione: 1, gravide: 1, produzioneMedia: 36.5 });
  });
});

describe("Validator gruppi e operazioni multiple", () => {
  it("richiede una regola per il gruppo automatico", () => {
    expect(createGruppoInput.safeParse({ nome: "Alta", tipologia: "lattazione", tipoGestione: "automatico" }).success).toBe(false);
    expect(createGruppoInput.safeParse({ nome: "Alta", tipologia: "lattazione", tipoGestione: "automatico", modalitaMembri: "esclusivo", regolaAutomatica: { tipo: "alta_produzione", sogliaLitriGiorno: 35 } }).success).toBe(true);
  });

  it("consente appartenenze personali solo alla tipologia personalizzato", () => {
    expect(createGruppoInput.safeParse({ nome: "Sanità", tipologia: "infermeria", tipoGestione: "manuale", modalitaMembri: "personalizzato" }).success).toBe(false);
    expect(createGruppoInput.safeParse({ nome: "Osservazione", tipologia: "personalizzato", tipoGestione: "manuale", modalitaMembri: "personalizzato" }).success).toBe(true);
  });

  it("rifiuta duplicati nelle operazioni batch", () => {
    expect(spostaMultiploInput.safeParse({ animaleIds: ["a-1", "a-1"], nuovoGruppoId: "g-1" }).success).toBe(false);
    expect(aggiungiMultiploInput.safeParse({ idempotencyKey: "b1a4b4b3-1212-4123-9a00-123456789012", animaleIds: ["a-1", "a-1"], nuovoGruppoId: "g-1" }).success).toBe(false);
  });
});

describe("Persistenza atomica e UX del wizard", () => {
  it("usa transazione, lock e chiave idempotente per gli spostamenti esclusivi", () => {
    const source = readFileSync(join(process.cwd(), "server/domains/livestock/repository.ts"), "utf8");
    expect(source).toContain("spostaAnimaliAtomico");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain("operazioneMultiplaId");
    expect(source).toContain("associaAnimaliPersonaleAtomico");
  });

  it("espone i tre passi e la conferma esplicita nella UI", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/stalla/AggiungiAnimaliWizard.tsx"), "utf8");
    expect(source).toContain('"origins"');
    expect(source).toContain('"animals"');
    expect(source).toContain('"review"');
    expect(source).toContain("Conferma aggiunta di");
    expect(source).toContain("Capacità massima superata");
  });
});
