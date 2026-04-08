"use client";

import { Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Flex,
  HStack,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { FiArrowLeft } from "react-icons/fi";
import { ProjectInterface } from "@/components/ProjectInterface";
import { SidekickAvatar } from "@/components/SidekickAvatar";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function InterviewSessionPage() {
  return (
    <Suspense fallback={<Flex minH="100vh" bg="gray.50" align="center" justify="center"><Spinner size="xl" color="violet.500" /></Flex>}>
      <InterviewSession />
    </Suspense>
  );
}

function InterviewSession() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const sidekick = useQuery(api.sidekicks.getForScholar, user ? {} : "skip");

  if (isLoading) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" bg="gray.50" flexDir="column">
      <AppHeader>
        <HStack
          as="button"
          gap={1.5}
          color="charcoal.400"
          cursor="pointer"
          _hover={{ color: "navy.500" }}
          onClick={() => router.push("/scholar/interview")}
        >
          <FiArrowLeft size={16} />
        </HStack>
        <HStack gap={2} flex={1} justify="center">
          <SidekickAvatar size={28} />
          <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
            {sidekick?.name ?? "Sidekick"}
          </Text>
        </HStack>
        <Box w="16px" /> {/* Spacer to balance the back button */}
      </AppHeader>

      <Box flex={1} overflow="hidden">
        <ErrorBoundary fallbackMessage="Something went wrong in the interview">
          <ProjectInterface
            projectId={projectId}
          />
        </ErrorBoundary>
      </Box>
    </Flex>
  );
}
