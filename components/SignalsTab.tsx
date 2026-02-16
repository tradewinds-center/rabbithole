"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Badge,
  Spinner,
} from "@chakra-ui/react";

interface SignalsTabProps {
  scholarId: string;
}

// Human-readable labels and descriptions for signal types
const SIGNAL_META: Record<string, { label: string; emoji: string; description: string }> = {
  task_commitment: {
    label: "Task Commitment",
    emoji: "🎯",
    description: "Sustained focus, persistence, returning to hard problems",
  },
  creative_approach: {
    label: "Creative Approach",
    emoji: "💡",
    description: "Novel methods, inventions, original solutions",
  },
  self_direction: {
    label: "Self-Direction",
    emoji: "🧭",
    description: "Student-initiated investigations, choosing own path",
  },
  intellectual_intensity: {
    label: "Intellectual Intensity",
    emoji: "🔥",
    description: "Rapid-fire questions, deep diving, can't let go",
  },
  emotional_engagement: {
    label: "Emotional Engagement",
    emoji: "💜",
    description: "Strong reactions to ideas, empathy, moral reasoning",
  },
  cross_domain_thinking: {
    label: "Cross-Domain Thinking",
    emoji: "🔗",
    description: "Connecting ideas across subjects unprompted",
  },
  productive_struggle: {
    label: "Productive Struggle",
    emoji: "⛰️",
    description: "Wrestling with difficulty constructively",
  },
  metacognition: {
    label: "Metacognition",
    emoji: "🪞",
    description: "Thinking about own thinking, noticing own confusion",
  },
};

function SignalBar({ count, highCount, maxCount }: { count: number; highCount: number; maxCount: number }) {
  const totalPct = maxCount > 0 ? Math.min((count / maxCount) * 100, 100) : 0;
  const highPct = maxCount > 0 ? Math.min((highCount / maxCount) * 100, 100) : 0;

  return (
    <Box w="120px" h="8px" bg="gray.100" borderRadius="full" overflow="hidden" position="relative" flexShrink={0}>
      {/* Total count bar */}
      <Box h="full" w={`${totalPct}%`} bg="violet.200" borderRadius="full" position="absolute" />
      {/* High-intensity portion */}
      <Box h="full" w={`${highPct}%`} bg="violet.500" borderRadius="full" position="absolute" />
    </Box>
  );
}

export function SignalsTab({ scholarId }: SignalsTabProps) {
  const signalProfile = useQuery(api.sessionSignals.signalProfile, {
    scholarId: scholarId as Id<"users">,
  });
  const connections = useQuery(api.crossDomainConnections.listByScholar, {
    scholarId: scholarId as Id<"users">,
  });

  if (signalProfile === undefined) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="violet.500" />
      </Flex>
    );
  }

  const signalEntries = Object.entries(signalProfile);
  const maxCount = signalEntries.reduce(
    (max, [, data]) => Math.max(max, (data as any).count),
    1
  );

  const hasSignals = signalEntries.length > 0;
  const hasConnections = connections && connections.length > 0;

  return (
    <VStack gap={4} align="stretch" maxW="700px">
      {/* Signals profile */}
      <Box bg="white" borderRadius="lg" p={4} shadow="xs">
        <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm" mb={3}>
          Learner Profile
        </Text>

        {!hasSignals ? (
          <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
            No learner signals yet. These build up as the scholar works with the AI tutor.
          </Text>
        ) : (
          <VStack gap={3} align="stretch">
            {/* Sort by count descending to show strongest signals first */}
            {signalEntries
              .sort(([, a], [, b]) => (b as any).count - (a as any).count)
              .map(([type, data]) => {
                const meta = SIGNAL_META[type] || {
                  label: type,
                  emoji: "📊",
                  description: "",
                };
                const { count, highCount, recent } = data as {
                  count: number;
                  highCount: number;
                  recent: any;
                };
                return (
                  <Box key={type}>
                    <Box
                      display="grid"
                      gridTemplateColumns="20px 1fr 120px 28px 52px"
                      gap={3}
                      alignItems="center"
                      mb={1}
                    >
                      <Text fontSize="sm" textAlign="center">
                        {meta.emoji}
                      </Text>
                      <Text
                        fontSize="sm"
                        fontWeight="500"
                        fontFamily="heading"
                        color="navy.500"
                        truncate
                      >
                        {meta.label}
                      </Text>
                      <SignalBar count={count} highCount={highCount} maxCount={maxCount} />
                      <Text fontSize="xs" color="charcoal.500" fontFamily="heading" textAlign="right">
                        {count}
                      </Text>
                      <Box>
                        {highCount > 0 && (
                          <Badge bg="violet.100" color="violet.700" fontSize="2xs">
                            {highCount} high
                          </Badge>
                        )}
                      </Box>
                    </Box>
                    {/* Most recent instance */}
                    {recent && (
                      <Text fontSize="xs" color="charcoal.400" fontFamily="body" pl="32px" lineHeight="1.3">
                        {recent.description}
                      </Text>
                    )}
                  </Box>
                );
              })}
          </VStack>
        )}
      </Box>

      {/* Cross-domain connections */}
      {hasConnections && (
        <Box bg="white" borderRadius="lg" p={4} shadow="xs">
          <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm" mb={3}>
            Cross-Domain Connections ({connections.length})
          </Text>
          <VStack gap={2} align="stretch">
            {connections.slice(0, 10).map((conn: any) => (
              <Box
                key={conn._id}
                p={2}
                bg="gray.50"
                borderRadius="md"
                borderLeft="2px solid"
                borderColor="cyan.400"
              >
                <HStack gap={1} mb={1} flexWrap="wrap">
                  {conn.domains.map((d: string) => (
                    <Badge key={d} bg="cyan.50" color="cyan.700" fontSize="2xs">
                      {d}
                    </Badge>
                  ))}
                  {conn.studentInitiated && (
                    <Badge bg="teal.50" color="teal.600" fontSize="2xs">
                      student-initiated
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="xs" color="charcoal.600" fontFamily="body" lineHeight="1.3">
                  {conn.description}
                </Text>
              </Box>
            ))}
            {connections.length > 10 && (
              <Text fontSize="xs" color="charcoal.400" fontFamily="heading" textAlign="center">
                +{connections.length - 10} more
              </Text>
            )}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
