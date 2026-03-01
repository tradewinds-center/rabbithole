"use client";

import { Flex, Spinner, Text } from "@chakra-ui/react";
import { friendlyToolName } from "@/lib/toolLabels";
import type { ToolActivity } from "@/hooks/useAgentStream";

export function ToolActivityIndicator({ toolActivity }: { toolActivity: ToolActivity }) {
  if (toolActivity.status === "running") {
    return (
      <Flex align="center" gap={2} px={4} py={2} alignSelf="flex-start">
        <Spinner size="xs" color="violet.400" />
        <Text fontSize="xs" fontFamily="heading" color="charcoal.400">
          {friendlyToolName(toolActivity.name)}...
        </Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap={2} px={4} py={1.5} alignSelf="flex-start">
      <Text fontSize="xs" color="green.500">&#10003;</Text>
      <Text fontSize="xs" fontFamily="heading" color="charcoal.300">
        {toolActivity.result ?? friendlyToolName(toolActivity.name)}
      </Text>
    </Flex>
  );
}
