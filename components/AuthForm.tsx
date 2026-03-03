"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Box, Button, Container, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

interface AuthFormProps {
  mode: "signIn" | "signUp";
}

const config = {
  signIn: {
    heading: "Welcome back",
    subtext: "Enter your username to continue",
    button: "Sign In",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    autoComplete: "current-password" as const,
    linkText: "Need an account? Create one",
    linkHref: "/sign-up",
    errorMessage: "Invalid username or password",
  },
  signUp: {
    heading: "Join Rabbithole",
    subtext: "Create your account to start learning",
    button: "Create Account",
    usernamePlaceholder: "Choose a username",
    passwordPlaceholder: "Choose a password",
    autoComplete: "new-password" as const,
    linkText: "Already have an account? Sign in",
    linkHref: "/sign-in",
    errorMessage: "Invalid invite code or username already taken",
  },
};

export function AuthForm({ mode }: AuthFormProps) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const { user, isLoading: userLoading } = useCurrentUser();
  const registerWithCode = useMutation(api.users.registerWithCode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const c = config[mode];

  useEffect(() => {
    // Only redirect if both authenticated AND a user doc exists
    if (isAuthenticated && !userLoading && user) {
      window.location.href = "/";
    }
  }, [isAuthenticated, userLoading, user]);

  const handleSubmit = async () => {
    const trimmed = username.trim();
    if (!trimmed || !password) return;
    setIsSubmitting(true);
    setError("");

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      setIsSubmitting(false);
      return;
    }

    if (trimmed.includes("@")) {
      setError("Pick a username, not an email address");
      setIsSubmitting(false);
      return;
    }

    // Password provider requires an email — use synthetic one internally
    const email = `${trimmed}@local`;

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
        // Pre-register with invite code, then create auth account
        await registerWithCode({ username: trimmed, code: inviteCode });
        await signIn("password", { email, password, flow: "signUp" });
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Auth failed:", err);
      setError(c.errorMessage);
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      minH="100dvh"
      bg="linear-gradient(135deg, #222656 0%, #1a1d42 50%, #364153 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      p={4}
      position="fixed"
      inset={0}
      overflowY="auto"
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
              {c.heading}
            </Heading>
            <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
              {c.subtext}
            </Text>
          </VStack>

          <VStack gap={3} w="full">
            <Input
              placeholder={c.usernamePlaceholder}
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
              placeholder={c.passwordPlaceholder}
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
              autoComplete={c.autoComplete}
            />
            {mode === "signUp" && (
              <Input
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                bg="gray.50"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="lg"
                fontFamily="body"
                h={12}
                _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
                autoComplete="off"
              />
            )}

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
              {c.button}
            </Button>
          </VStack>

          <Link href={c.linkHref}>
            <Text
              color="charcoal.400"
              fontSize="sm"
              fontFamily="heading"
              cursor="pointer"
              _hover={{ color: "violet.500", textDecoration: "underline" }}
            >
              {c.linkText}
            </Text>
          </Link>
        </VStack>
      </Container>

      <Text
        color="whiteAlpha.500"
        fontSize="xs"
        fontFamily="heading"
        mt={6}
        textAlign="center"
      >
        A project of{" "}
        <a
          href="https://tradewinds.school/center"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Tradewinds Center for Advanced Learning
        </a>
      </Text>
    </Box>
  );
}
