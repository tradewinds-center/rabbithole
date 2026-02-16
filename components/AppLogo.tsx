"use client";

import { HStack, Text } from "@chakra-ui/react";

interface AppLogoProps {
  /** "light" for dark backgrounds (white text), "dark" for light backgrounds (navy text) */
  variant?: "light" | "dark";
  /** Logo image size in px (default 40) */
  size?: number;
}

export function AppLogo({ variant = "dark", size = 40 }: AppLogoProps) {
  const textColor = variant === "light" ? "gray.100" : "charcoal.400";

  return (
    <HStack gap={3}>
      <img
        src="/tradewinds-seal.svg"
        alt="Tradewinds"
        style={{ width: size, height: size, flexShrink: 0 }}
      />
      <Text
        color={textColor}
        fontSize="xs"
        fontFamily="heading"
        lineHeight="1.3"
      >
        Rabbithole
      </Text>
    </HStack>
  );
}
