import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Usernames that should get admin role
const ADMIN_USERNAMES = ["andyszy", "andy", "carl"];
// Usernames that should get teacher role
const TEACHER_USERNAMES = ["test-teacher-001"];

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

      // Assign role based on known usernames
      const role = ADMIN_USERNAMES.includes(username)
        ? "admin" as const
        : TEACHER_USERNAMES.includes(username)
          ? "teacher" as const
          : "scholar" as const;

      return await ctx.db.insert("users", {
        email,
        username,
        name: username,
        role,
      });
    },
  },
});
