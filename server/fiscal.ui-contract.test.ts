import { describe, expect, it } from "vitest";
import { createTaxProfileInput } from "./domains/fiscal/validators";
import { getUserErrorMessage } from "../client/src/lib/userError";

const baseProfile = {
  settlementFrequency: "trimestrale" as const,
  effectiveFrom: "2026-01-01",
};

describe("Contratto UI cambio regime IVA", () => {
  it("accetta il valore speciale_agricolo usato da UI e dati esistenti", () => {
    const result = createTaxProfileInput.safeParse({
      ...baseProfile,
      vatRegime: "speciale_agricolo",
    });

    expect(result.success).toBe(true);
  });

  it("accetta il regime misto mostrato nel selettore", () => {
    const result = createTaxProfileInput.safeParse({
      ...baseProfile,
      vatRegime: "misto",
    });

    expect(result.success).toBe(true);
  });

  it("trasforma l’errore tecnico sul regime in un messaggio leggibile", () => {
    const technicalMessage = JSON.stringify([
      {
        code: "invalid_value",
        values: ["speciale_agricolo", "ordinario"],
        path: ["vatRegime"],
        message: "Invalid option",
      },
    ]);

    expect(getUserErrorMessage(new Error(technicalMessage))).toBe(
      "Seleziona un regime IVA valido.",
    );
  });
});
