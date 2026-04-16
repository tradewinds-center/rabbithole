import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ROLES } from "./lib/roles";

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

      // Extract bare username from the synthetic email the frontend sends
      const rawEmail = args.profile.email as string | undefined;
      const username = rawEmail?.replace(/@.*$/, "") ?? "";

      // Check if a seeded user with this username already exists
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("username"), username))
        .unique();
      if (existing) {
        return existing._id;
      }

      // Block new user creation when invite code is required.
      // Users must be pre-created via registerWithCode mutation or by a teacher.
      if (process.env.SIGNUP_CODE) {
        throw new Error("Registration requires an invite code");
      }

      // First user to sign up gets admin role; everyone else is a scholar.
      // Admins can promote others to teacher/admin via /admin.
      const userCount = (await ctx.db.query("users").collect()).length;
      const role = userCount === 0 ? ROLES.ADMIN : ROLES.SCHOLAR;

      return await ctx.db.insert("users", {
        username,
        name: username,
        role,
      });
    },
  },
});
