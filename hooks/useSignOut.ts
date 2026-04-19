"use client";

import { useCallback } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Sign out and reliably land on /sign-in.
 *
 * The raw `signOut()` from @convex-dev/auth is async but many call sites
 * fire-and-forget it — the UI is left showing the authenticated view until
 * a query errors or the user refreshes. This hook awaits the signOut and
 * then does a full-document navigation to /sign-in so nothing from the
 * previous session's Convex subscriptions lingers.
 */
export function useSignOut() {
  const { signOut } = useAuthActions();
  return useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      }
    }
  }, [signOut]);
}
