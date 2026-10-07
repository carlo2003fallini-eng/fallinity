import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMPANY_AREA_DEFAULT_ORDER,
  normalizeCompanyAreaOrder,
  reorderCompanyAreas,
} from "../client/src/lib/companyAreaOrder";

const pageSource = readFileSync(new URL("../client/src/pages/Azienda.tsx", import.meta.url), "utf8");
const gridSource = readFileSync(new URL("../client/src/components/azienda/CompanyAreasGrid.tsx", import.meta.url), "utf8");

describe("Home Azienda — accesso operativo essenziale", () => {
  it("mostra esclusivamente la griglia delle quattro aree e non carica KPI o anagrafiche", () => {
    expect(pageSource).toContain("CompanyAreasGrid");
    expect(pageSource).not.toContain("trpc.");
    expect(pageSource).not.toContain("FAL_IMAGES");
    expect(pageSource).not.toContain("Dati Latte");
    expect(pageSource).not.toContain("Dati Vitelli");
    expect(pageSource).not.toContain("Anagrafica");
    expect(pageSource).not.toContain("Dipendenti");
    expect(pageSource).not.toContain("Fornitori");
    expect(pageSource).not.toContain("Clienti");
  });

  it("mantiene una griglia 2×2 con le quattro route operative richieste", () => {
    expect(gridSource).toContain('className="grid grid-cols-2 gap-3"');
    expect(gridSource).toContain('path: "/stalla"');
    expect(gridSource).toContain('path: "/magazzino"');
    expect(gridSource).toContain('path: "/officina"');
    expect(gridSource).toContain('path: "/campi"');
    expect(gridSource).not.toContain("GripVertical");
    expect(gridSource).not.toContain("Ripristina");
  });

  it("attiva il trascinamento soltanto dopo una pressione prolungata e salva per utente", () => {
    expect(gridSource).toContain("const LONG_PRESS_MS = 320");
    expect(gridSource).toContain("window.setTimeout(() => activateDrag(id), LONG_PRESS_MS)");
    expect(gridSource).toContain("fallinity:azienda:aree-ordine:v1:");
    expect(gridSource).toContain("persistOrder(orderRef.current)");
    expect(gridSource).toContain("transform: isDragging");
    expect(gridSource).toContain("trpc.azienda.salvaOrdineAree.useMutation");
  });
});

describe("Home Azienda — ordine personalizzato", () => {
  it("normalizza preferenze incomplete o duplicate", () => {
    expect(normalizeCompanyAreaOrder(["campi", "campi", "stalla", "non-valida"])).toEqual([
      "campi",
      "stalla",
      "magazzino",
      "officina",
    ]);
    expect(normalizeCompanyAreaOrder(null)).toEqual([...COMPANY_AREA_DEFAULT_ORDER]);
  });

  it("riordina le card senza perderne alcuna", () => {
    expect(reorderCompanyAreas([...COMPANY_AREA_DEFAULT_ORDER], "stalla", "officina")).toEqual([
      "magazzino",
      "officina",
      "stalla",
      "campi",
    ]);
  });
});
