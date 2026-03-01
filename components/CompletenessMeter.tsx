"use client";

import { Box, Flex, Text, Progress, Popover, Portal, Icon } from "@chakra-ui/react";
import { FiCheck, FiCircle } from "react-icons/fi";
import type { Doc } from "@/convex/_generated/dataModel";

interface CompletenessMeterProps {
  unit: Doc<"units">;
  lessons: { strand?: string | null; systemPrompt?: string | null }[];
}

interface Criterion {
  label: string;
  met: boolean;
  weight: number;
}

function buildCriteria(
  unit: Doc<"units">,
  lessons: CompletenessMeterProps["lessons"]
): Criterion[] {
  return [
    { label: "Big Idea", met: !!unit.bigIdea?.trim(), weight: 15 },
    { label: "Essential Questions", met: (unit.essentialQuestions?.length ?? 0) > 0, weight: 10 },
    { label: "Enduring Understandings", met: (unit.enduringUnderstandings?.length ?? 0) > 0, weight: 10 },
    { label: "Core lesson", met: lessons.some((l) => l.strand === "core"), weight: 15 },
    { label: "Connections lesson", met: lessons.some((l) => l.strand === "connections"), weight: 15 },
    { label: "Practice lesson", met: lessons.some((l) => l.strand === "practice"), weight: 15 },
    { label: "All prompts generated", met: lessons.length > 0 && lessons.every((l) => l.systemPrompt?.trim()), weight: 20 },
  ];
}

export function CompletenessMeter({ unit, lessons }: CompletenessMeterProps) {
  const criteria = buildCriteria(unit, lessons);
  const score = criteria.reduce((sum, c) => sum + (c.met ? c.weight : 0), 0);
  const color = score >= 80 ? "green" : score >= 50 ? "yellow" : score >= 25 ? "orange" : "red";

  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <Flex align="center" gap={3} cursor="pointer" _hover={{ opacity: 0.8 }} role="button" tabIndex={0}>
          <Box w="120px">
            <Progress.Root value={score} size="sm" colorPalette={color}>
              <Progress.Track borderRadius="full">
                <Progress.Range borderRadius="full" />
              </Progress.Track>
            </Progress.Root>
          </Box>
          <Text fontSize="sm" fontFamily="heading" fontWeight="600" color={`${color}.600`}>
            {score}%
          </Text>
        </Flex>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="260px" shadow="lg" borderRadius="lg">
            <Popover.Body p={3}>
              <Text fontSize="xs" fontWeight="700" fontFamily="heading" color="charcoal.400" mb={2}>
                Unit Completeness
              </Text>
              <Flex direction="column" gap={1}>
                {criteria.map((c) => (
                  <Flex key={c.label} align="center" gap={2}>
                    <Icon
                      as={c.met ? FiCheck : FiCircle}
                      boxSize="14px"
                      color={c.met ? "green.500" : "gray.300"}
                    />
                    <Text fontSize="xs" color={c.met ? "charcoal.500" : "gray.400"} flex={1}>
                      {c.label}
                    </Text>
                    <Text fontSize="2xs" color="gray.400" fontFamily="heading">
                      {c.weight}%
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
