"use client";

import { Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { FiPlus, FiMessageSquare, FiClock, FiArrowLeft } from "react-icons/fi";
import { SidekickAvatar } from "@/components/SidekickAvatar";
import { AppHeader } from "@/components/AppHeader";
import { AppLogo } from "@/components/AppLogo";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function InterviewHomePage() {
  return (
    <Suspense fallback={<Flex minH="100vh" bg="gray.50" align="center" justify="center"><Spinner size="xl" color="violet.500" /></Flex>}>
      <InterviewHome />
    </Suspense>
  );
}

function InterviewHome() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();
  const sidekick = useQuery(api.sidekicks.getForScholar, user ? {} : "skip");
  const interviews = useQuery(api.interviews.listInterviews, user ? {} : "skip");
  const createInterview = useMutation(api.interviews.createInterview);

  const handleNewChat = useCallback(async () => {
    const result = await createInterview({});
    if (result) {
      router.push(`/scholar/interview/${result.id}`);
    }
  }, [createInterview, router]);

  if (isLoading || interviews === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  const sidekickName = sidekick?.name ?? "your Sidekick";

  return (
    <Flex minH="100vh" bg="gray.50" flexDir="column">
      <AppHeader>
        <HStack
          as="button"
          gap={1.5}
          color="charcoal.400"
          cursor="pointer"
          _hover={{ color: "navy.500" }}
          onClick={() => router.push("/scholar")}
        >
          <FiArrowLeft size={16} />
          <AppLogo variant="dark" size={24} />
        </HStack>
        <Box flex={1} />
      </AppHeader>

      <Box flex={1} overflow="auto" p={{ base: 4, md: 6 }} maxW="600px" mx="auto" w="full">
        {/* Sidekick header */}
        <VStack gap={3} mb={6} align="center">
          <SidekickAvatar size={80} showName />
          <Text fontFamily="body" fontSize="sm" color="charcoal.400" textAlign="center">
            Chat with {sidekickName} to help them understand who you are as a learner
          </Text>
        </VStack>

        {/* New chat button */}
        <Box
          as="button"
          w="full"
          bg="violet.500"
          color="white"
          borderRadius="xl"
          p={4}
          mb={4}
          fontFamily="heading"
          fontWeight="600"
          fontSize="sm"
          cursor="pointer"
          _hover={{ bg: "violet.600" }}
          transition="all 0.15s"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={2}
          onClick={handleNewChat}
        >
          <FiPlus size={16} />
          Start a new conversation
        </Box>

        {/* Past interviews */}
        {interviews.length > 0 && (
          <VStack gap={2} align="stretch">
            <Text fontFamily="heading" fontSize="xs" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="wider" mb={1}>
              Past Conversations
            </Text>
            {interviews.map((interview: { _id: string; title: string; messageCount: number; lastMessageAt: number }) => (
              <Box
                key={interview._id}
                bg="white"
                borderRadius="lg"
                p={3}
                shadow="xs"
                cursor="pointer"
                _hover={{ shadow: "sm" }}
                transition="all 0.15s"
                onClick={() => router.push(`/scholar/interview/${interview._id}`)}
              >
                <HStack justify="space-between">
                  <HStack gap={2}>
                    <FiMessageSquare size={14} color="var(--chakra-colors-charcoal-300)" />
                    <Text fontFamily="heading" fontSize="sm" color="navy.500">
                      {interview.title}
                    </Text>
                  </HStack>
                  <HStack gap={3}>
                    <Text fontSize="xs" color="charcoal.300" fontFamily="heading">
                      {interview.messageCount} msgs
                    </Text>
                    <HStack gap={1} color="charcoal.300">
                      <FiClock size={12} />
                      <Text fontSize="xs" fontFamily="heading">
                        {timeAgo(interview.lastMessageAt)}
                      </Text>
                    </HStack>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </Flex>
  );
}
