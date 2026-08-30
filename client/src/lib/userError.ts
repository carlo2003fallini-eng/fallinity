type ValidationIssue = {
  path?: Array<string | number>;
  message?: string;
};

const FIELD_MESSAGES: Record<string, string> = {
  vatRegime: "Seleziona un regime IVA valido.",
  settlementFrequency: "Seleziona una periodicità di liquidazione valida.",
  effectiveFrom: "Inserisci una data di decorrenza valida.",
  qualificationType: "Seleziona una qualifica agricola valida.",
};

function parseValidationIssues(message: string): ValidationIssue[] | null {
  try {
    const parsed = JSON.parse(message);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getUserErrorMessage(
  error: unknown,
  fallback = "Operazione non riuscita. Controlla i dati e riprova.",
): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : typeof error === "string"
          ? error
          : "";

  if (!rawMessage) return fallback;

  const issues = parseValidationIssues(rawMessage);
  if (issues?.length) {
    const field = String(issues[0]?.path?.[0] ?? "");
    return FIELD_MESSAGES[field] ?? fallback;
  }

  if (rawMessage.includes("invalid_value") || rawMessage.includes("Invalid option")) {
    return fallback;
  }

  return rawMessage.length <= 180 ? rawMessage : fallback;
}
