import { z } from "zod";

/** AI (Copilot) — Validators */

export const messagesInput = z.object({ sessionId: z.string() });
export const newSessionInput = z.object({ titolo: z.string().optional() });
export const chatInput = z.object({ sessionId: z.string(), message: z.string().min(1) });
export const deleteSessionInput = z.object({ id: z.string() });
