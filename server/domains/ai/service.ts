import { randomUUID } from "crypto";
import { invokeLLM } from "../../_core/llm";
import type { ActorContext } from "../_core";
import { aiRepository as repo } from "./repository";

/** AI (Copilot) — Service */
export const aiService = {
  listSessions(companyId: string, userId: number) {
    return repo.listSessions(companyId, userId);
  },

  listMessages(companyId: string, sessionId: string) {
    return repo.listMessages(companyId, sessionId);
  },

  async newSession(actor: ActorContext, userId: number, titolo?: string) {
    const id = randomUUID();
    await repo.insertSession(actor, { id, userId, titolo: titolo ?? "Nuova conversazione" });
    return { sessionId: id };
  },

  deleteSession(actor: ActorContext, id: string) {
    return repo.softDeleteSession(actor, id);
  },

  /** Genera la risposta del Copilot con contesto aziendale (Explainable AI). */
  async chat(actor: ActorContext, sessionId: string, message: string) {
    await repo.insertMessage(actor, { id: randomUUID(), sessionId, ruolo: "user", contenuto: message });

    const kpi = await repo.monthlyKpi(actor.companyId);
    const utile = kpi.entrate - kpi.uscite;
    const systemPrompt = `Sei il Copilot AI di Fallinity FEOS, il sistema operativo per aziende agricole.
Rispondi SEMPRE in italiano con approccio "Explainable AI": ogni suggerimento deve essere motivato e trasparente, spiegando il ragionamento.

CONTESTO AZIENDALE (mese corrente):
- Entrate: €${kpi.entrate.toLocaleString("it-IT")}
- Uscite: €${kpi.uscite.toLocaleString("it-IT")}
- Utile netto: €${utile.toLocaleString("it-IT")}

Principi Fallinity DNA: Entity First, Event Driven, Decision First, Explainable AI, Enterprise Memory.`;

    const history = await repo.listMessages(actor.companyId, sessionId, 20);
    const ordered = [...history].reverse();
    const messages = [
      ...ordered.slice(0, -1).map((m: any) => ({ role: m.ruolo as "user" | "assistant", content: m.contenuto })),
      { role: "user" as const, content: message },
    ];

    const response = await invokeLLM({ messages: [{ role: "system", content: systemPrompt }, ...messages] });
    const rawContent = response.choices?.[0]?.message?.content;
    const assistantContent = typeof rawContent === "string" ? rawContent : "Mi dispiace, non ho potuto elaborare la risposta.";

    await repo.insertMessage(actor, { id: randomUUID(), sessionId, ruolo: "assistant", contenuto: assistantContent });

    if (ordered.length <= 1) {
      const shortTitle = message.slice(0, 50) + (message.length > 50 ? "..." : "");
      await repo.renameSession(actor, sessionId, shortTitle);
    }
    return { content: assistantContent };
  },
};
