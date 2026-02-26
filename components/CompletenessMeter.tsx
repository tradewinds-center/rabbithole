"use client";

import { Box, Flex, Text, Progress } from "@chakra-ui/react";
import type { Doc } from "@/convex/_generated/dataModel";

interface CompletenessMeterProps {
  unit: Doc<"units">;
  lessons: { strand?: string | null; systemPrompt?: string | null }[];
}

export function CompletenessMeter({ unit, lessons }: CompletenessMeterProps) {
  let score = 0;

  // Has Big Idea? +15%
  if (unit.bigIdea?.trim()) score += 15;

  // Has ≥1 EQ? +10%
  if (unit.essentialQuestions && unit.essentialQuestions.length > 0) score += 10;

  // Has ≥1 EU? +10%
  if (unit.enduringUnderstandings && unit.enduringUnderstandings.length > 0) score += 10;

  // Core has ≥1 lesson with process? +15%
  const coreLessons = lessons.filter((l) => l.strand === "core");
  if (coreLessons.length > 0) score += 15;

  // Connections has ≥1 lesson? +15%
  const connLessons = lessons.filter((l) => l.strand === "connections");
  if (connLessons.length > 0) score += 15;

  // Practice has ≥1 lesson? +15%
  const pracLessons = lessons.filter((l) => l.strand === "practice");
  if (pracLessons.length > 0) score += 15;

  // All lessons have system prompts generated? +20%
  if (lessons.length > 0 && lessons.every((l) => l.systemPrompt?.trim())) score += 20;

  const color = score >= 80 ? "green" : score >= 50 ? "yellow" : score >= 25 ? "orange" : "red";

  return (
    <Flex align="center" gap={3}>
      <Box w="120px">
        <Progress.Root
          value={score}
          size="sm"
          colorPalette={color}
        >
          <Progress.Track borderRadius="full">
            <Progress.Range borderRadius="full" />
          </Progress.Track>
        </Progress.Root>
      </Box>
      <Text fontSize="sm" fontFamily="heading" fontWeight="600" color={`${color}.600`}>
        {score}%
      </Text>
    </Flex>
  );
}
