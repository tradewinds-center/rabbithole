"use client";

import { useConvexAuth } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box, Spinner, VStack, Text } from "@chakra-ui/react";

export default function Home() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { user, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (userLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    // Route based on user role
    if (user.role === "teacher" || user.role === "admin") {
      router.push("/teacher");
    } else {
      router.push("/scholar");
    }
  }, [authLoading, isAuthenticated, user, userLoading, router]);

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
          Loading...
        </Text>
      </VStack>
    </Box>
  );
}
