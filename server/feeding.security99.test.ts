import { intelligenceContext } from "./domains/feeding/nutrition";
import { describe, it, expect, vi } from "vitest";
import { registerStorageProxy } from "./_core/storageProxy";
import { observedFrequency } from "./domains/feeding/data";
import { stripFeedingCosts } from "./domains/feeding/permissions";
describe("F99 — privacy documenti e date distribuzioni", () => {
  it("applica il filtro lattazione al contesto IA, non soltanto alla domanda", () => {
    const group = (id: string, tipologia: string, n: number) => ({
      id,
      nome: id,
      tipologia,
      inLattazione: n,
      nAnimali: 2,
      animalIds: [],
      frequency: 1,
      activeRecipeId: null,
      overlaps: [],
    });
    const data: any = {
      groups: [group("lat", "lattazione", 2), group("asc", "asciutta", 0)],
      products: [],
      recipes: [],
      runs: [],
      distributions: [],
      leftovers: [],
      nirAnalyses: [],
      milkRecords: [],
      comparisons: [],
      settings: [],
      containers: [],
      summary: { warnings: [] },
      permissions: {
        canView: true,
        canSeeCosts: true,
        companyId: "c",
        userId: 1,
      },
    };
    const r: any = intelligenceContext(data, {
      question: "Controlla dati mancanti",
      from: Date.now() - 86400000,
      to: Date.now(),
      lactatingOnly: true,
    });
    const groups = r.context?.groups ?? r.groups;
    expect(groups.map((g: any) => g.id)).toEqual(["lat"]);
  });

  it("nega il proxy pubblico ai referti NIR prima di firmare o scaricare dati", async () => {
    let handler: any;
    registerStorageProxy({
      get: vi.fn((_path: string, h: any) => (handler = h)),
    } as any);
    const res: any = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      redirect: vi.fn(),
    };
    const fetcher = vi.spyOn(globalThis, "fetch");
    await handler(
      { params: { 0: "companies/test-company/feeding/nir/product/doc.pdf" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.redirect).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
  it("usa l’ultima parziale reale, ma non conta due parziali come due carri", () => {
    const now = Date.now();
    const d: any[] = [0, 1, 2, 3].flatMap(n => [
      {
        id: `a${n}`,
        runId: `r${n}`,
        groupId: "g",
        at: now - (3 - n) * 86400000 - 2000,
        kg: 10,
        annulled: false,
      },
      {
        id: `b${n}`,
        runId: `r${n}`,
        groupId: "g",
        at: now - (3 - n) * 86400000,
        kg: 10,
        annulled: false,
      },
    ]);
    const o = observedFrequency(d, "g", 1, now);
    expect(o.frequency).toBeCloseTo(1);
    expect(o.lastDistributionAt).toBe(now);
    expect(o.nextDistributionAt).toBe(now + 86400000);
  });
  it("rimuove testo IA salvato ed equivalenza economica dai confronti non autorizzati", () => {
    const source = {
      permissions: { canSeeCosts: false },
      comparisons: [
        {
          ai: "Il prezzo è 12 €/q",
          results: { economic: [{ left: 1, right: 2 }], equivalentPrice: 10 },
          left: { pricePerQuintal: 12, params: { ss: { value: 34 } } },
        },
      ],
    };
    const r = stripFeedingCosts(source);
    expect(r.comparisons[0].ai).toBeNull();
    expect(r.comparisons[0].results.economic).toBeNull();
    expect(r.comparisons[0].left.pricePerQuintal).toBeNull();
    expect(r.comparisons[0].left.params.ss.value).toBe(34);
    expect(source.comparisons[0].ai).toContain("12");
  });
});
