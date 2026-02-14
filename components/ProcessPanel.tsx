"use client";

import { Box, Flex, VStack, Text, IconButton } from "@chakra-ui/react";
import { FiX } from "react-icons/fi";

interface ProcessStep {
  key: string;
  status: "not_started" | "in_progress" | "completed";
  commentary?: string;
}

interface ProcessDefinition {
  title: string;
  emoji?: string | null;
  steps: { key: string; title: string; description?: string }[];
}

interface ProcessPanelProps {
  process: ProcessDefinition;
  currentStep: string;
  steps: ProcessStep[];
  collapsed?: boolean;
  onToggle?: () => void;
}

export function ProcessPanel({
  process,
  currentStep,
  steps,
  collapsed,
  onToggle,
}: ProcessPanelProps) {
  if (collapsed) return null;

  return (
    <Box
      bg="gray.50"
      overflow="auto"
      flexShrink={0}
    >
      <Flex
        px={3}
        py={2}
        borderBottom="1px solid"
        borderColor="gray.200"
        align="center"
        justify="space-between"
      >
        <Text
          fontSize="sm"
          fontWeight="600"
          fontFamily="heading"
          color="navy.500"
        >
          {process.emoji || "📋"} {process.title}
        </Text>
        {onToggle && (
          <IconButton
            aria-label="Close process panel"
            size="xs"
            variant="ghost"
            color="charcoal.400"
            onClick={onToggle}
          >
            <FiX />
          </IconButton>
        )}
      </Flex>

      <VStack gap={0} align="stretch" py={2}>
        {process.steps.map((stepDef) => {
          const stepState = steps.find((s) => s.key === stepDef.key);
          const status = stepState?.status ?? "not_started";
          const isCurrent = stepDef.key === currentStep;

          return (
            <Box
              key={stepDef.key}
              px={3}
              py={2}
              bg={isCurrent ? "violet.50" : "transparent"}
              borderLeft="3px solid"
              borderColor={isCurrent ? "violet.400" : "transparent"}
              transition="all 0.15s"
            >
              <Flex align="center" gap={2}>
                <Flex
                  w={6}
                  h={6}
                  borderRadius="full"
                  bg={
                    status === "completed"
                      ? "green.100"
                      : status === "in_progress"
                        ? "violet.100"
                        : "gray.100"
                  }
                  color={
                    status === "completed"
                      ? "green.600"
                      : status === "in_progress"
                        ? "violet.600"
                        : "charcoal.400"
                  }
                  align="center"
                  justify="center"
                  flexShrink={0}
                  fontSize="xs"
                  fontWeight="700"
                  fontFamily="heading"
                >
                  {status === "completed" ? "✓" : stepDef.key}
                </Flex>
                <Text
                  fontSize="sm"
                  fontWeight={isCurrent ? "600" : "400"}
                  fontFamily="heading"
                  color={
                    status === "completed"
                      ? "green.700"
                      : isCurrent
                        ? "navy.500"
                        : "charcoal.500"
                  }
                >
                  {stepDef.title}
                </Text>
              </Flex>

              {stepState?.commentary && status === "completed" && (
                <Text
                  fontSize="xs"
                  color="charcoal.400"
                  fontFamily="body"
                  mt={1}
                  ml={8}
                  lineHeight="1.3"
                >
                  {stepState.commentary}
                </Text>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
