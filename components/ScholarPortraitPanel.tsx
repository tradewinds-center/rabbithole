"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
} from "@chakra-ui/react";
import { SidekickAvatar } from "./SidekickAvatar";

interface ScholarPortraitPanelProps {
  scholarId: Id<"users">;
}

function completenessLabel(completeness: number | undefined | null): string {
  if (!completeness || completeness < 15) return "Just Getting Started";
  if (completeness < 40) return "Emerging";
  if (completeness < 70) return "Well Understood";
  return "Deeply Known";
}

function completenessColor(completeness: number | undefined | null): string {
  if (!completeness || completeness < 15) return "gray";
  if (completeness < 40) return "blue";
  if (completeness < 70) return "green";
  return "purple";
}

function ScoreBar({ score, maxScore = 5 }: { score: number; maxScore?: number }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  return (
    <Box w="full" h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
      <Box h="full" bg="violet.400" borderRadius="full" w={`${pct}%`} transition="width 0.3s" />
    </Box>
  );
}

export function ScholarPortraitPanel({ scholarId }: ScholarPortraitPanelProps) {
  const portrait = useQuery(api.scholarPortraits.getForScholar, { scholarId });
  const sidekick = useQuery(api.sidekicks.getForScholar, { scholarId });
  const interviewStats = useQuery(api.interviews.getInterviewStats, { scholarId });

  if (!portrait) {
    return (
      <Box p={3} bg="gray.50" borderRadius="lg">
        <Text fontSize="xs" color="charcoal.400" fontFamily="body" fontStyle="italic">
          No portrait yet — {sidekick?.name ?? "this scholar"} hasn&apos;t had an interview with their Sidekick yet.
        </Text>
      </Box>
    );
  }

  const interviewCount = interviewStats?.count ?? 0;
  const lastInterviewAt = interviewStats?.lastMessageAt ?? null;
  const daysSinceInterview = lastInterviewAt
    ? Math.floor((Date.now() - lastInterviewAt) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <VStack gap={3} align="stretch">
      {/* Sidekick + status header */}
      <HStack gap={2}>
        <SidekickAvatar scholarId={scholarId} size={32} />
        <VStack gap={0} align="start" flex={1}>
          {sidekick?.name && (
            <Text fontFamily="heading" fontSize="xs" fontWeight="600" color="navy.500">
              {sidekick.name}
            </Text>
          )}
          {portrait.statusDetailed && (
            <Text fontSize="xs" color="charcoal.400" fontFamily="body" lineHeight="1.3">
              {portrait.statusDetailed}
            </Text>
          )}
        </VStack>
        <Badge
          size="sm"
          colorPalette={completenessColor(portrait.completeness)}
          fontFamily="heading"
          fontSize="2xs"
        >
          {completenessLabel(portrait.completeness)}
        </Badge>
      </HStack>

      {/* Dimensions */}
      {portrait.dimensions && portrait.dimensions.length > 0 && (
        <VStack gap={2} align="stretch">
          {portrait.dimensions.map((dim: { name: string; score: number }) => (
            <Box key={dim.name}>
              <HStack justify="space-between" mb={0.5}>
                <Text fontSize="xs" fontFamily="heading" fontWeight="500" color="charcoal.500">
                  {dim.name}
                </Text>
                <Text fontSize="2xs" fontFamily="heading" color="charcoal.300">
                  {dim.score.toFixed(1)}/5
                </Text>
              </HStack>
              <ScoreBar score={dim.score} />
            </Box>
          ))}
        </VStack>
      )}

      {/* Icebreakers */}
      {portrait.icebreakers && portrait.icebreakers.length > 0 && (
        <Box>
          <Text fontSize="2xs" fontFamily="heading" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="wider" mb={1}>
            Suggested conversation starters
          </Text>
          <VStack gap={1} align="stretch">
            {portrait.icebreakers.map((topic: string, i: number) => (
              <Text key={i} fontSize="xs" color="charcoal.500" fontFamily="body">
                &bull; {topic}
              </Text>
            ))}
          </VStack>
        </Box>
      )}

      {/* Meta info */}
      <HStack gap={3} pt={1}>
        {daysSinceInterview !== null && (
          <Text fontSize="2xs" color="charcoal.300" fontFamily="heading">
            Last interview: {daysSinceInterview === 0 ? "today" : `${daysSinceInterview}d ago`}
          </Text>
        )}
        {interviewCount > 0 && (
          <Text fontSize="2xs" color="charcoal.300" fontFamily="heading">
            {interviewCount} session{interviewCount !== 1 ? "s" : ""}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}
