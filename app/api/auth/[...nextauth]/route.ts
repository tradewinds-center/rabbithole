import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { initializeDatabase } from "@/db";

// Initialize database on first request
initializeDatabase();

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
