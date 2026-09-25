import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  new URL("../client/src/pages/Finanza.tsx", import.meta.url),
  "utf8",
);

describe("Dashboard Finanza — contratto dati", () => {
  it("formatta tutti gli importi ricevuti dal backend come centesimi", () => {
    expect(dashboardSource).toContain("Number(cents ?? 0) / 100");
    expect(dashboardSource).not.toContain("currency: \"EUR\", maximumFractionDigits: 0 }).format(n)");
  });

  it("passa il periodo selezionato anche al grafico dell’andamento", () => {
    expect(dashboardSource).toContain("dashboard.trend.useQuery({ ...dateRange, mesi: mesiTrend, modalita })");
    expect(dashboardSource).toContain("Periodo selezionato");
  });

  it("usa date locali YYYY-MM-DD per i filtri della dashboard", () => {
    expect(dashboardSource).toContain("function localIsoDate(date: Date)");
    expect(dashboardSource).toContain("const dataFine = localIsoDate(oggi)");
  });
});
