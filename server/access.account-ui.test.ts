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
    expect(page).toContain("Rivedi invito e permessi");
    expect(page).toContain("Accesso riservato");
  });

  it("richiede la revisione di destinatario, ruolo e permessi prima dell’invio", () => {
    const page = read("client/src/pages/UtentiAccessi.tsx");
    expect(page).toContain("Rivedi invito e permessi");
    expect(page).toContain("Controlla l’invito");
    expect(page).toContain("Destinatario");
    expect(page).toContain("Ruolo assegnato");
    expect(page).toContain("Permessi operativi");
    expect(page).toContain("Accesso amministrativo completo");
    expect(page).toContain("Conferma e invia invito");
    expect(page).toContain("setReviewOpen(true)");
  });

  it("espone la copia del link per inviti appena creati e ancora in attesa", () => {
    const page = read("client/src/pages/UtentiAccessi.tsx");
    const invite = read("client/src/pages/Invito.tsx");
    expect(page).toContain("Copia link invito");
    expect(page).toContain("navigator.clipboard?.writeText");
    expect(page).toContain("/invito/${token}");
    expect(invite).toContain("Accedi con l’email invitata");
    expect(invite).toContain("invitationPreview");
    expect(invite).toContain("Accetta invito e apri Fallinity");
    expect(invite).toContain("email_mismatch");
  });

  it("espone creazione, modifica e accesso assistenza delle aziende", () => {
    const page = read("client/src/pages/SuperAdmin.tsx");
    expect(page).toContain("CREA AZIENDA");
    expect(page).toContain("Apri assistenza");
    expect(page).toContain("Modalità Super Admin");
    expect(page).toContain("Salva azienda");
  });

  it("rende il cambio azienda disponibile dall’account", () => {
    const account = read("client/src/pages/Account.tsx");
    const selector = read("client/src/pages/SelezionaAzienda.tsx");
    expect(account).toContain("Cambia azienda");
    expect(selector).toContain("Cambia azienda");
    expect(selector).toContain("Azienda attiva:");
    expect(selector).toContain("Accessi personali");
    expect(selector).toContain("Nascondi dal mio elenco");
    expect(selector).toContain("Ripristina nel mio elenco");
  });
});
