"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box, Spinner, VStack, Text } from "@chakra-ui/react";
import { useConvexAuth } from "convex/react";

export default function Home() {
  const { isAuthenticated: isConvexAuthed, isLoading: isAuthLoading } =
    useConvexAuth();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const router = useRouter();

  // Debug: log auth state to understand redirect loop
  useEffect(() => {
    console.log("[Home] auth state:", { isAuthLoading, isConvexAuthed, isUserLoading, user: user ? { role: user.role, name: user.name } : user });
  }, [isAuthLoading, isConvexAuthed, isUserLoading, user]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isConvexAuthed) {
      console.log("[Home] Not authed, redirecting to /login");
      router.push("/login");
      return;
    }

    // Auth confirmed but user doc still loading — wait
    if (isUserLoading) return;

    // Auth confirmed but user doc is null — could be brief race condition,
    // the reactive query will re-fire soon. Don't redirect to /login.
    if (!user) {
      console.log("[Home] Authed but user is null — waiting for query...");
      return;
    }

    // Route based on user role
    console.log("[Home] Routing to", user.role === "teacher" || user.role === "admin" ? "/teacher" : "/scholar");
    if (user.role === "teacher" || user.role === "admin") {
      router.push("/teacher");
    } else {
      router.push("/scholar");
    }
  }, [isConvexAuthed, isAuthLoading, user, isUserLoading, router]);

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(135deg, #222656 0%, #1a1d42 50%, #364153 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <VStack gap={4}>
        <Spinner size="xl" color="violet.500" borderWidth="4px" />
        <Text color="white" fontFamily="heading" fontSize="lg">
          Loading Makawulu...
        </Text>
      </VStack>
    </Box>
  );
}
