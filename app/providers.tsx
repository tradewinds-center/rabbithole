"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { system } from "@/lib/theme";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ConvexAuthProvider>
  );
}
