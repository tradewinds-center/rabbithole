"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Box, Spinner, VStack, Text } from "@chakra-ui/react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    // Route based on user role
    if (session.user.role === "teacher" || session.user.role === "admin") {
      router.push("/teacher");
    } else {
      router.push("/scholar");
    }
  }, [session, status, router]);

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
