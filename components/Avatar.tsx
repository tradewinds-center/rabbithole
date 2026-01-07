"use client";

import { Box, Text } from "@chakra-ui/react";

interface AvatarProps {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { container: 8, text: "sm" },
  md: { container: 12, text: "lg" },
  lg: { container: 16, text: "xl" },
};

export function Avatar({ name, src, size = "md" }: AvatarProps) {
  const dimensions = sizeMap[size];

  // Get initials from name
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Generate a consistent color based on name
  const colors = [
    "violet.500",
    "cyan.500",
    "orange.500",
    "green.500",
    "navy.500",
  ];
  const colorIndex = name
    ? name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length
    : 0;

  if (src) {
    return (
      <Box
        w={dimensions.container}
        h={dimensions.container}
        borderRadius="full"
        overflow="hidden"
        flexShrink={0}
      >
        <img
          src={src}
          alt={name || "Avatar"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      w={dimensions.container}
      h={dimensions.container}
      borderRadius="full"
      bg={colors[colorIndex]}
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Text
        color="white"
        fontWeight="600"
        fontFamily="heading"
        fontSize={dimensions.text}
      >
        {initials}
      </Text>
    </Box>
  );
}
