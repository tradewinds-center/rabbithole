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
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={8} textAlign="center">
          <VStack gap={4}>
            <Text fontSize="lg" fontWeight="bold" color="red.600">
              {this.props.fallbackMessage || "Something went wrong"}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {this.state.error?.message}
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
