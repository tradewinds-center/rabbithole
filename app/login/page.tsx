"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { Box, Button, Container, Heading, Text, VStack, HStack } from "@chakra-ui/react";
import { FiUser } from "react-icons/fi";
import { useState, useEffect } from "react";

// Test users for dev sign-in
const TEST_USERS = [
  { id: "test-teacher-001", name: "Test Teacher", role: "teacher" },
  { id: "test-scholar-001", name: "Kai Nakamura", role: "scholar" },
  { id: "test-scholar-002", name: "Lani Kealoha", role: "scholar" },
  { id: "test-scholar-003", name: "Noah Takahashi", role: "scholar" },
];

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Redirect to home when authenticated (home page routes by role)
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn("google");
    } catch (error) {
      console.error("Google sign-in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleTestSignIn = async (testUser: (typeof TEST_USERS)[number]) => {
    setIsSigningIn(true);
    try {
      await signIn("password", {
        email: `${testUser.id}@test.makawulu.dev`,
        password: testUser.id,
        flow: "signUp",
      }).catch(() => {
        // If signup fails (already exists), try sign in
        return signIn("password", {
          email: `${testUser.id}@test.makawulu.dev`,
          password: testUser.id,
          flow: "signIn",
        });
      });
      // signIn resolved — token stored. Hard navigate so ConvexAuthProvider
      // initializes fresh with the stored token on page load.
      window.location.href = "/";
    } catch (error) {
      console.error("Test sign-in error:", error);
      setIsSigningIn(false);
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
      <Container maxW="md">
        <VStack
          gap={8}
          bg="white"
          p={{ base: 8, md: 12 }}
          borderRadius="2xl"
          shadow="2xl"
          textAlign="center"
        >
          {/* Logo / Brand */}
          <VStack gap={2}>
            <Box
              w={20}
              h={20}
              borderRadius="full"
              bg="linear-gradient(135deg, #AD60BF 0%, #222656 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              shadow="lg"
            >
              <Text
                fontSize="3xl"
                fontWeight="bold"
                color="white"
                fontFamily="heading"
              >
                M
              </Text>
            </Box>
            <Heading
              as="h1"
              size="2xl"
              fontFamily="heading"
              color="navy.500"
              letterSpacing="tight"
            >
              Makawulu
            </Heading>
          </VStack>

          {/* Primary CTA */}
          <Button
            size="lg"
            w="full"
            bg="violet.500"
            color="white"
            _hover={{ bg: "violet.600" }}
            fontFamily="heading"
            fontWeight="500"
            h={14}
            disabled={isSigningIn}
            onClick={() => handleTestSignIn(TEST_USERS[0])}
          >
            <FiUser style={{ marginRight: "8px" }} />
            Sign in as Teacher
          </Button>

          {/* Footer links */}
          <VStack gap={2} pt={2}>
            <HStack gap={4} flexWrap="wrap" justifyContent="center">
              {TEST_USERS.slice(1).map((scholar) => (
                <Text
                  key={scholar.id}
                  as="button"
                  color="charcoal.300"
                  fontSize="xs"
                  fontFamily="heading"
                  cursor="pointer"
                  _hover={{ color: "charcoal.500", textDecoration: "underline" }}
                  onClick={() => !isSigningIn && handleTestSignIn(scholar)}
                >
                  {scholar.name}
                </Text>
              ))}
            </HStack>
            <Text
              as="button"
              color="charcoal.300"
              fontSize="xs"
              fontFamily="heading"
              cursor="pointer"
              _hover={{ color: "charcoal.500", textDecoration: "underline" }}
              onClick={() => !isSigningIn && handleGoogleSignIn()}
            >
              Sign in with Google
            </Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
