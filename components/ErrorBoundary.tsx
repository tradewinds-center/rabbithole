"use client";

import React from "react";
import { Box, Button, Text, VStack } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    // An auth error here almost always means the session expired — bounce to sign-in
    if (typeof window !== "undefined" && /not authenticated/i.test(error.message)) {
      window.location.replace("/sign-in");
    }
  }

  render() {
    if (this.state.hasError) {
      const raw = this.state.error?.message ?? "";
      // Auth errors are handled in componentDidCatch by redirecting; show a brief stub while that happens
      if (/not authenticated/i.test(raw)) {
        return (
          <Box p={8} textAlign="center">
            <Text fontSize="sm" color="gray.500">Signing out…</Text>
          </Box>
        );
      }
      return (
        <Box p={8} textAlign="center">
          <VStack gap={4}>
            <Text fontSize="lg" fontWeight="bold" color="red.600">
              {this.props.fallbackMessage || "Something went wrong"}
            </Text>
            <Text fontSize="sm" color="gray.500">
              Please try again. If this keeps happening, reload the page.
            </Text>
            <Button
              size="sm"
              colorPalette="violet"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}
