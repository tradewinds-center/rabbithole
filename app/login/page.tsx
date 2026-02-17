"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Box, Button, Container, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    const trimmed = username.trim();
    if (!trimmed || !password) return;
    setIsSubmitting(true);
    setError("");

    const email = `${trimmed}@makawulu.local`;

    try {
      if (mode === "signIn") {
        // Try sign-up first (creates auth account if none exists, links to seeded user);
        // if account already exists, fall back to sign-in
        try {
          await signIn("password", { email, password, flow: "signUp" });
        } catch (signUpErr) {
          console.log("Sign-up failed (expected if account exists):", signUpErr);
          await signIn("password", { email, password, flow: "signIn" });
        }
        window.location.href = "/";
      } else {
        await signIn("password", { email, password, flow: "signUp" });
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Auth failed:", err);
      setError(
        mode === "signIn"
          ? "Invalid username or password"
          : "Username already taken"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(135deg, #222656 0%, #1a1d42 50%, #364153 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Container maxW="lg">
        <VStack
          gap={6}
          bg="white"
          p={{ base: 8, md: 12 }}
          borderRadius="2xl"
          shadow="2xl"
          textAlign="center"
        >
          <VStack gap={2}>
            <Box w={20} h={20}>
              <img
                src="/tradewinds-seal.svg"
                alt="Rabbithole"
                style={{ width: "100%", height: "100%" }}
              />
            </Box>
            <Heading
              as="h1"
              size="2xl"
              fontFamily="heading"
              color="navy.500"
              letterSpacing="tight"
            >
              Rabbithole
            </Heading>
            <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
              {mode === "signIn" ? "Sign in to continue" : "Create your account to get started"}
            </Text>
          </VStack>

          <VStack gap={3} w="full">
            <Input
              placeholder={mode === "signIn" ? "Username" : "Choose a username"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              bg="gray.50"
              border="1px solid"
              borderColor="gray.300"
              borderRadius="lg"
              fontFamily="body"
              h={12}
              _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
              _focusVisible={{ boxShadow: "none", outline: "none" }}
              autoFocus
              autoComplete="username"
            />
            <Input
              type="password"
              placeholder={mode === "signIn" ? "Password" : "Choose a password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              bg="gray.50"
              border="1px solid"
              borderColor="gray.300"
              borderRadius="lg"
              fontFamily="body"
              h={12}
              _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
              _focusVisible={{ boxShadow: "none", outline: "none" }}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            />

            {error && (
              <Text fontSize="sm" color="red.500" fontFamily="body">
                {error}
              </Text>
            )}

            <Button
              size="lg"
              w="full"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              fontWeight="500"
              h={14}
              disabled={!username.trim() || !password || isSubmitting}
              onClick={handleSubmit}
            >
              {mode === "signIn" ? "Sign In" : "Create Account"}
            </Button>
          </VStack>

          <Text
            as="button"
            color="charcoal.400"
            fontSize="sm"
            fontFamily="heading"
            cursor="pointer"
            _hover={{ color: "violet.500", textDecoration: "underline" }}
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError("");
            }}
          >
            {mode === "signIn" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
