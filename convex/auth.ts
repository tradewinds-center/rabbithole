import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Test user profiles (Password provider doesn't forward name/image to profile)
const TEST_USER_PROFILES: Record<string, { name: string; image: string }> = {
  "test-teacher-001@test.makawulu.dev": { name: "Test Teacher", image: "/avatars/teacher.png" },
  "test-scholar-001@test.makawulu.dev": { name: "Kai Nakamura", image: "/avatars/kai-nakamura.png" },
  "test-scholar-002@test.makawulu.dev": { name: "Lani Kealoha", image: "/avatars/lani-kealoha.png" },
  "test-scholar-003@test.makawulu.dev": { name: "Noah Takahashi", image: "/avatars/noah-takahashi.png" },
};

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
      // Guest login: email is "guest-<token>@makawulu.guest"
      // Link auth account to existing scholar user instead of creating a new one
      const email = args.profile.email as string | undefined;
      if (email?.endsWith("@makawulu.guest")) {
        const token = email.replace("@makawulu.guest", "").replace("guest-", "");
        const scholar = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("guestToken"), token))
          .unique();
        if (scholar) {
          return scholar._id;
        }
        // Token invalid — fall through to create a new (orphan) user
        // The guest page validates tokens first, so this shouldn't happen
      }

      if (args.existingUserId) {
        // Update existing user with latest profile info
        const existingUser = await ctx.db.get(args.existingUserId);
        const existingEmail = email ?? existingUser?.email;
        const testProfile = TEST_USER_PROFILES[existingEmail ?? ""];
        const updates: Record<string, unknown> = {};
        const profileName = (args.profile.name as string) || testProfile?.name;
        if (profileName) updates.name = profileName;
        const profileImage = (args.profile.image as string) || testProfile?.image;
        if (profileImage) updates.image = profileImage;
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(args.existingUserId, updates);
        }
        return args.existingUserId;
      }
      // Create new user with role based on email
      const role = roleFromEmail(email);
      const testProfile = TEST_USER_PROFILES[email ?? ""];
      const name = (args.profile.name as string) || testProfile?.name || email?.split("@")[0] || "User";
      const image = (args.profile.image as string | undefined) || testProfile?.image;
      return await ctx.db.insert("users", {
        email,
        name,
        image,
        role,
      });
    },
  },
});
