"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook to get the current authenticated user from Convex.
 * Returns { user, isLoading, isAuthenticated }.
 */
export function useCurrentUser() {
  const user = useQuery(api.users.currentUser);

  return {
    user: user ?? null,
    isLoading: user === undefined,
    isAuthenticated: user !== null && user !== undefined,
  };
}
