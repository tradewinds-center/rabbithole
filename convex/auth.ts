import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

function roleFromEmail(email: string | undefined): "scholar" | "teacher" | "admin" {
  if (!email) return "scholar";
  const adminEmails = ["andy@tradewinds.school", "carl@tradewinds.school"];
  if (adminEmails.includes(email.toLowerCase())) return "admin";
  if (email.toLowerCase().endsWith("@tradewinds.school")) return "teacher";
  // Test teacher account
  if (email.toLowerCase().includes("test-teacher")) return "teacher";
  return "scholar";
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
    Password,
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        // Update existing user with latest profile info
        const updates: Record<string, unknown> = {};
        if (args.profile.name) updates.name = args.profile.name;
        if (args.profile.image) updates.image = args.profile.image;
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(args.existingUserId, updates);
        }
        return args.existingUserId;
      }
      // Create new user with role based on email
      const email = args.profile.email as string | undefined;
      const role = roleFromEmail(email);
      const name = (args.profile.name as string) || email?.split("@")[0] || "User";
      return await ctx.db.insert("users", {
        email,
        name,
        image: args.profile.image as string | undefined,
        role,
      });
    },
  },
});
