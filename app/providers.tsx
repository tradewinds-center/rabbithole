"use client";

import { ChakraProvider, Toaster, Toast } from "@chakra-ui/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { system } from "@/lib/theme";
import { toaster } from "@/lib/toaster";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ChakraProvider value={system}>
        {children}
        <Toaster toaster={toaster}>
          {(toast) => (
            <Toast.Root key={toast.id}>
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
              <Toast.CloseTrigger />
            </Toast.Root>
          )}
        </Toaster>
      </ChakraProvider>
    </ConvexAuthProvider>
  );
}
