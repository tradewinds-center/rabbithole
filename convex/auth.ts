import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      // New sign-up: extract username from synthetic email
      const email = args.profile.email as string | undefined;
      const username = email?.replace("@makawulu.local", "") ?? "";

      // Check if a seeded user with this email already exists
      // (seeded users have email = username@makawulu.local)
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), email))
        .unique();
      if (existing) {
        return existing._id;
      }

      // Create new user — default to scholar role
      return await ctx.db.insert("users", {
        email,
        username,
        name: username,
        role: "scholar",
      });
    },
  },
});
