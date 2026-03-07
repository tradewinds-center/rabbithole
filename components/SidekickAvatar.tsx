"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Box, Text, VStack, Image } from "@chakra-ui/react";

interface SidekickAvatarProps {
  scholarId?: Id<"users">;
  size?: number;
  showName?: boolean;
}

export function SidekickAvatar({ scholarId, size = 48, showName = false }: SidekickAvatarProps) {
  const sidekick = useQuery(api.sidekicks.getForScholar, scholarId ? { scholarId } : {});
  const urls = useQuery(
    api.sidekicks.getAvatarUrl,
    scholarId ? { scholarId } : {}
  );

  if (!sidekick) {
    return (
      <Box
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        bg="gray.200"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={size > 32 ? "lg" : "sm"} color="gray.400">?</Text>
      </Box>
    );
  }

  const isGenerating = sidekick.generationStatus === "pending" || sidekick.generationStatus === "generating";

  if (urls?.avatarUrl) {
    return (
      <VStack gap={1}>
        <Image
          src={urls.avatarUrl}
          alt={sidekick.name ?? "Sidekick"}
          w={`${size}px`}
          h={`${size}px`}
          borderRadius="full"
          objectFit="cover"
        />
        {showName && sidekick.name && (
          <Text fontSize="xs" fontFamily="heading" fontWeight="600" color="navy.500">
            {sidekick.name}
          </Text>
        )}
      </VStack>
    );
  }

  if (isGenerating) {
    return (
      <VStack gap={1}>
        <Box
          w={`${size}px`}
          h={`${size}px`}
          borderRadius="full"
          bg={sidekick.color ? `${sidekick.color}` : "violet.200"}
          bgGradient="linear(to-br, violet.200, violet.400)"
          animation="pulse 2s ease-in-out infinite"
          css={{
            "@keyframes pulse": {
              "0%, 100%": { opacity: 0.6 },
              "50%": { opacity: 1 },
            },
          }}
        />
        {showName && sidekick.name && (
          <Text fontSize="xs" fontFamily="heading" fontWeight="600" color="navy.500">
            {sidekick.name}
          </Text>
        )}
      </VStack>
    );
  }

  // Fallback: has sidekick but no image yet
  return (
    <VStack gap={1}>
      <Box
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        bg="violet.100"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={size > 32 ? "xl" : "md"}>
          {sidekick.animal === "fox" ? "🦊" :
           sidekick.animal === "owl" ? "🦉" :
           sidekick.animal === "dolphin" ? "🐬" :
           sidekick.animal === "cat" ? "🐱" :
           sidekick.animal === "dog" ? "🐕" :
           sidekick.animal === "rabbit" ? "🐰" :
           sidekick.animal === "bear" ? "🐻" :
           sidekick.animal === "seahorse" ? "🐴" :
           "🌟"}
        </Text>
      </Box>
      {showName && sidekick.name && (
        <Text fontSize="xs" fontFamily="heading" fontWeight="600" color="navy.500">
          {sidekick.name}
        </Text>
      )}
    </VStack>
  );
}
