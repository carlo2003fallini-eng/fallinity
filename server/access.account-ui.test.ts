import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("UI Account mobile-first", () => {
  it("offre invito via email, ruoli e gestione puntuale dei moduli", () => {
    const page = read("client/src/pages/UtentiAccessi.tsx");
    expect(page).toContain("+ AGGIUNGI UTENTE");
    expect(page).toContain("Invita per email");
    expect(page).toContain("Gestisci accessi");
    expect(page).toContain("ModuleSelector");
    expect(page).toContain("Registra invito");
    expect(page).toContain("Accesso riservato");
  });

  it("espone creazione, modifica e accesso assistenza delle aziende", () => {
    const page = read("client/src/pages/SuperAdmin.tsx");
    expect(page).toContain("CREA AZIENDA");
    expect(page).toContain("Apri assistenza");
    expect(page).toContain("Modalità Super Admin");
    expect(page).toContain("Salva azienda");
  });
});
