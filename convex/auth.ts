import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      validatePasswordRequirements: (password: string) => {
        if (!password || password.length < 4) {
          throw new Error("Password must be at least 4 characters");
        }
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      // New sign-up: extract username from synthetic email
      const email = args.profile.email as string | undefined;
      const username = email?.replace("@rabbithole.local", "")
        .replace("@test.rabbithole.dev", "") ?? "";

      // Check if a seeded user with this email already exists
      // (seeded users have email = username@rabbithole.local)
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), email))
        .unique();
      if (existing) {
        return existing._id;
      }

      // First user to sign up gets admin role; everyone else is a scholar.
      // Admins can promote others to teacher/admin via /admin.
      const userCount = (await ctx.db.query("users").collect()).length;
      const role = userCount === 0 ? "admin" as const : "scholar" as const;

      return await ctx.db.insert("users", {
        email,
        username,
        name: username,
        role,
      });
    },
  },
});
