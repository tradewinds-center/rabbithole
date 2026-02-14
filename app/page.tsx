"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box, Spinner, VStack, Text } from "@chakra-ui/react";

export default function Home() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // No user even with dev fallback — go to login
      router.push("/login");
      return;
    }

    // Route based on user role
    if (user.role === "teacher" || user.role === "admin") {
      router.push("/teacher");
    } else {
      router.push("/scholar");
    }
  }, [user, isLoading, router]);

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
