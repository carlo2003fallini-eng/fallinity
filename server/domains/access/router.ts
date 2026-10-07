import { protectedProcedure, publicProcedure, router } from "../../_core/trpc";
import { getActor } from "../_core";
import { accessService } from "./service";
import { createCompanyInput, enterCompanyInput, invitationTokenInput, inviteUserInput, setCompanyHiddenInput, updateCompanyInput, updateUserAccessInput } from "./validators";

export const accessRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    const profile = await accessService.profile(actor, ctx.user!);
    return { ...profile, user: ctx.user };
  }),
  companyUsers: protectedProcedure.query(async ({ ctx }) => {
    const actor = await getActor(ctx);
    return accessService.listUsers(actor, ctx.user!);
  }),
  inviteUser: protectedProcedure.input(inviteUserInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return accessService.inviteUser(actor, ctx.user!, input);
  }),
  invitationPreview: publicProcedure.input(invitationTokenInput).query(({ input }) => accessService.previewInvitation(input.token)),
  acceptInvitation: protectedProcedure.input(invitationTokenInput).mutation(({ ctx, input }) => accessService.acceptInvitation(ctx.user!, input.token)),
  updateUser: protectedProcedure.input(updateUserAccessInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return accessService.updateUser(actor, ctx.user!, input);
  }),
  myCompanies: protectedProcedure.query(async ({ ctx }) => accessService.listMyCompanies(ctx.user!.id)),
  superAdminCompanies: protectedProcedure.query(async ({ ctx }) => accessService.listAllCompanies(ctx.user!)),
  createCompany: protectedProcedure.input(createCompanyInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return accessService.createCompany(actor, ctx.user!, input);
  }),
  updateCompany: protectedProcedure.input(updateCompanyInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return accessService.updateCompany(actor, ctx.user!, input);
  }),
  enterCompany: protectedProcedure.input(enterCompanyInput).mutation(async ({ ctx, input }) => {
    const actor = await getActor(ctx);
    return accessService.enterCompany(actor, ctx.user!, input.companyId);
  }),
  switchCompany: protectedProcedure.input(enterCompanyInput).mutation(({ ctx, input }) => {
    return accessService.switchCompany(ctx.user!, input.companyId);
  }),
  setCompanyHidden: protectedProcedure.input(setCompanyHiddenInput).mutation(({ ctx, input }) => {
    return accessService.setCompanyHidden(ctx.user!, input);
  }),
});
