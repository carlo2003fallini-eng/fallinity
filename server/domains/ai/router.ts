import { protectedProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { aiService } from "./service";
import { messagesInput, newSessionInput, chatInput, deleteSessionInput } from "./validators";

/** AI (Copilot) — Router */
export const aiRouter = router({
  sessions: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return aiService.listSessions(actor.companyId, ctx.user!.id);
  }),
  messages: protectedProcedure.input(messagesInput).query(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return aiService.listMessages(actor.companyId, input.sessionId);
  }),
  newSession: protectedProcedure.input(newSessionInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return aiService.newSession(actor, ctx.user!.id, input.titolo);
  }),
  chat: protectedProcedure.input(chatInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return aiService.chat(actor, input.sessionId, input.message);
  }),
  deleteSession: protectedProcedure.input(deleteSessionInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return aiService.deleteSession(actor, input.id);
  }),
});
