import { describe, expect, it } from "vitest";
import {
  normalizeQuickActionOrder,
  QUICK_ACTION_DEFAULT_ORDER,
  reorderQuickActions,
} from "../client/src/lib/financeQuickActions";

describe("Azioni rapide Finanza — ordine personalizzato", () => {
  it("normalizza preferenze danneggiate, duplicate o incomplete", () => {
    expect(normalizeQuickActionOrder(["report", "report", "sconosciuto", "movimenti"])).toEqual([
      "report",
      "movimenti",
      "proposte",
      "analisi",
      "impostazioni",
    ]);
    expect(normalizeQuickActionOrder("ordine non valido")).toEqual([...QUICK_ACTION_DEFAULT_ORDER]);
  });

  it("riordina un’azione nella posizione di destinazione senza perderne alcuna", () => {
    expect(reorderQuickActions([...QUICK_ACTION_DEFAULT_ORDER], "movimenti", "report")).toEqual([
      "proposte",
      "analisi",
      "report",
      "movimenti",
      "impostazioni",
    ]);
  });
});
