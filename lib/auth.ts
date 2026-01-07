import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

// Tradewinds school domain for automatic teacher role
const TEACHER_DOMAIN = "tradewinds.school";

// Admin emails
const ADMIN_EMAILS = ["andy@tradewinds.school", "carl@tradewinds.school"];

// Test users for dev/testing (credentials login)
export const TEST_USERS = {
  teacher: {
    id: "test-teacher-001",
    email: "test.teacher@tradewinds.school",
    name: "Test Teacher",
    role: "teacher" as const,
  },
  scholar1: {
    id: "test-scholar-001",
    email: "kai@example.com",
    name: "Kai Nakamura",
    role: "scholar" as const,
  },
  scholar2: {
    id: "test-scholar-002",
    email: "lani@example.com",
    name: "Lani Kealoha",
    role: "scholar" as const,
  },
  scholar3: {
    id: "test-scholar-003",
    email: "noah@example.com",
    name: "Noah Takahashi",
    role: "scholar" as const,
  },
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Credentials provider for test/dev login
    CredentialsProvider({
      id: "test-login",
      name: "Test Login",
      credentials: {
        testUserId: { label: "Test User ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.testUserId) return null;

        // Find test user by ID
        const testUser = Object.values(TEST_USERS).find(
          (u) => u.id === credentials.testUserId
        );

        if (!testUser) return null;

        // Ensure test user exists in database
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.id, testUser.id))
          .limit(1);

        if (existingUser.length === 0) {
          // Create test user in database
          await db.insert(users).values({
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
            role: testUser.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          // Check if user exists
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (existingUser.length === 0) {
            // Determine role based on email domain
            let role: "scholar" | "teacher" | "admin" = "scholar";

            if (ADMIN_EMAILS.includes(user.email)) {
              role = "admin";
            } else if (user.email.endsWith(`@${TEACHER_DOMAIN}`)) {
              role = "teacher";
            }

            // Create new user
            await db.insert(users).values({
              id: user.id!,
              email: user.email,
              name: user.name || "Unknown",
              image: user.image,
              role,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            // Update existing user
            await db
              .update(users)
              .set({
                name: user.name || existingUser[0].name,
                image: user.image,
                updatedAt: new Date(),
              })
              .where(eq(users.id, existingUser[0].id));
          }
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Fetch user from database to get role
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);

        if (dbUser.length > 0) {
          session.user.id = dbUser[0].id;
          session.user.role = dbUser[0].role;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

// Type augmentation for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "scholar" | "teacher" | "admin";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
  }
}
