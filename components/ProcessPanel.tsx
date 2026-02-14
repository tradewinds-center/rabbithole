"use client";

import { Box, Text, Timeline } from "@chakra-ui/react";
import { FiCheck } from "react-icons/fi";

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
}

export type { ProcessDefinition, ProcessStep };

export function ProcessPanel({
  process,
  currentStep,
  steps,
}: ProcessPanelProps) {
  return (
    <Box overflow="auto" flexShrink={0} px={4} py={3}>
      <Timeline.Root size="md">
        {process.steps.map((stepDef) => {
          const stepState = steps.find((s) => s.key === stepDef.key);
          const status = stepState?.status ?? "not_started";
          const isCurrent = stepDef.key === currentStep;

          return (
            <Timeline.Item key={stepDef.key}>
              <Timeline.Connector>
                <Timeline.Separator
                  css={{
                    borderColor: status === "completed" ? "var(--chakra-colors-violet-300)" : undefined,
                  }}
                />
                <Timeline.Indicator
                  bg={
                    status === "completed"
                      ? "violet.500"
                      : isCurrent
                        ? "violet.500"
                        : "gray.200"
                  }
                  borderColor={
                    status === "completed"
                      ? "violet.500"
                      : isCurrent
                        ? "violet.500"
                        : "gray.200"
                  }
                  color={
                    status === "completed" || isCurrent
                      ? "white"
                      : "charcoal.400"
                  }
                >
                  {status === "completed" ? (
                    <FiCheck size={12} />
                  ) : (
                    <Text
                      fontSize="10px"
                      fontWeight="700"
                      fontFamily="heading"
                      color={isCurrent ? "white" : "charcoal.400"}
                      lineHeight="1"
                    >
                      {stepDef.key}
                    </Text>
                  )}
                </Timeline.Indicator>
              </Timeline.Connector>
              <Timeline.Content>
                <Timeline.Title
                  fontSize="sm"
                  fontWeight={isCurrent ? "600" : "400"}
                  fontFamily="heading"
                  color={
                    isCurrent
                      ? "navy.500"
                      : status === "completed"
                        ? "charcoal.500"
                        : "charcoal.300"
                  }
                >
                  {stepDef.title}
                </Timeline.Title>
                {isCurrent && stepDef.description && (
                  <Timeline.Description
                    fontSize="xs"
                    color="charcoal.400"
                    fontFamily="body"
                  >
                    {stepDef.description}
                  </Timeline.Description>
                )}
                {stepState?.commentary && status === "completed" && (
                  <Timeline.Description
                    fontSize="xs"
                    color="charcoal.400"
                    fontFamily="body"
                  >
                    {stepState.commentary}
                  </Timeline.Description>
                )}
              </Timeline.Content>
            </Timeline.Item>
          );
        })}
      </Timeline.Root>
    </Box>
  );
}
