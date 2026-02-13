"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { Box, Button, Container, Heading, Text, VStack, HStack, Separator } from "@chakra-ui/react";
import { FcGoogle } from "react-icons/fc";
import { FiUser, FiBook } from "react-icons/fi";
import { useState, useEffect } from "react";

// Test users for dev login
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

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await signIn("google");
    } catch (error) {
      console.error("Google sign-in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleTestLogin = async (testUser: (typeof TEST_USERS)[number]) => {
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
      console.error("Test login error:", error);
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
            <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
              Learning AI Network
            </Text>
          </VStack>

          {/* Tagline */}
          <VStack gap={2}>
            <Text
              color="charcoal.500"
              fontSize="lg"
              fontFamily="body"
              lineHeight="tall"
            >
              See with eight eyes.
            </Text>
            <Text
              color="charcoal.400"
              fontSize="md"
              fontFamily="body"
              maxW="sm"
            >
              A personalized AI tutor for scholars, with real-time oversight for
              teachers.
            </Text>
          </VStack>

          {/* Tradewinds attribution */}
          <Box
            py={3}
            px={5}
            bg="yellow.200"
            borderRadius="lg"
            w="full"
          >
            <Text
              color="charcoal.600"
              fontSize="sm"
              fontFamily="heading"
              fontWeight="500"
            >
              Designed for extraordinary minds at{" "}
              <Text as="span" color="navy.500" fontWeight="600">
                Tradewinds School
              </Text>
            </Text>
          </Box>

          {/* Sign In Button */}
          <Button
            size="lg"
            w="full"
            bg="white"
            color="charcoal.600"
            border="2px solid"
            borderColor="gray.200"
            _hover={{
              bg: "gray.50",
              borderColor: "gray.300",
            }}
            fontFamily="heading"
            fontWeight="500"
            h={14}
            disabled={isSigningIn}
            onClick={handleGoogleLogin}
          >
            <FcGoogle style={{ marginRight: "12px", fontSize: "24px" }} />
            Sign in with Google
          </Button>

          {/* Footer note */}
          <Text color="charcoal.300" fontSize="xs" fontFamily="heading">
            Scholars and teachers sign in with their school Google account
          </Text>

          {/* Dev/Test Login Section */}
          <VStack gap={4} w="full" pt={4}>
            <HStack w="full" gap={4}>
              <Separator flex={1} />
              <Text
                color="charcoal.300"
                fontSize="xs"
                fontFamily="heading"
                whiteSpace="nowrap"
              >
                DEV / TEST ACCOUNTS
              </Text>
              <Separator flex={1} />
            </HStack>

            {/* Teacher Test Login */}
            <Button
              size="md"
              w="full"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              fontWeight="500"
              disabled={isSigningIn}
              onClick={() => handleTestLogin(TEST_USERS[0])}
            >
              <FiUser style={{ marginRight: "8px" }} />
              Login as Teacher
            </Button>

            {/* Scholar Test Logins */}
            <VStack gap={2} w="full">
              <Text
                color="charcoal.400"
                fontSize="xs"
                fontFamily="heading"
                alignSelf="start"
              >
                Test Scholars:
              </Text>
              <HStack gap={2} w="full" flexWrap="wrap">
                {TEST_USERS.slice(1).map((scholar) => (
                  <Button
                    key={scholar.id}
                    size="sm"
                    flex={1}
                    minW="120px"
                    bg="navy.500"
                    color="white"
                    _hover={{ bg: "navy.600" }}
                    fontFamily="heading"
                    fontWeight="400"
                    fontSize="xs"
                    disabled={isSigningIn}
                    onClick={() => handleTestLogin(scholar)}
                  >
                    <FiBook style={{ marginRight: "4px" }} />
                    {scholar.name.split(" ")[0]}
                  </Button>
                ))}
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
