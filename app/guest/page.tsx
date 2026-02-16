"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Box, Container, Heading, Text, VStack, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useRef, Suspense } from "react";
import { api } from "@/convex/_generated/api";

function GuestLoginInner() {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const scholar = useQuery(
    api.users.resolveGuestToken,
    token ? { token } : "skip"
  );

  const [status, setStatus] = useState<"loading" | "signing-in" | "redirecting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const attemptedRef = useRef(false);

  // Step 1: Sign out any existing session first, then sign in as guest
  useEffect(() => {
    if (attemptedRef.current) return;
    if (isAuthLoading) return; // wait for auth state to resolve
    if (!token) {
      setStatus("error");
      setErrorMsg("No access token provided.");
      return;
    }
    if (scholar === undefined) return; // still loading
    if (scholar === null) {
      setStatus("error");
      setErrorMsg("This link is invalid or has been revoked.");
      return;
    }

    attemptedRef.current = true;

    const doGuestSignIn = async () => {
      // Sign out any existing session (e.g. teacher logged in on another tab)
      if (isAuthenticated) {
        await signOut().catch(() => {});
      }

      setStatus("signing-in");
      const email = `guest-${token}@makawulu.guest`;
      const password = token;

      try {
        // Try signUp first (first visit), fall back to signIn (repeat visits)
        await signIn("password", { email, password, flow: "signUp" })
          .catch(() => signIn("password", { email, password, flow: "signIn" }));
        setStatus("redirecting");
        window.location.href = "/scholar";
      } catch (err) {
        console.error("Guest sign-in error:", err);
        setStatus("error");
        setErrorMsg("Something went wrong signing in. Please try again.");
      }
    };

    doGuestSignIn();
  }, [token, scholar, isAuthenticated, isAuthLoading, signIn, signOut]);

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
          gap={6}
          bg="white"
          p={{ base: 8, md: 12 }}
          borderRadius="2xl"
          shadow="2xl"
          textAlign="center"
        >
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
            <Text fontSize="3xl" fontWeight="bold" color="white" fontFamily="heading">
              M
            </Text>
          </Box>

          {status === "error" ? (
            <>
              <Heading as="h1" size="xl" fontFamily="heading" color="navy.500">
                Oops
              </Heading>
              <Text color="charcoal.500" fontFamily="body">
                {errorMsg}
              </Text>
            </>
          ) : (
            <>
              <Heading as="h1" size="xl" fontFamily="heading" color="navy.500">
                {scholar ? `Welcome, ${scholar.name}!` : "Loading..."}
              </Heading>
              <Spinner size="lg" color="violet.500" />
              <Text color="charcoal.400" fontFamily="body" fontSize="sm">
                {status === "redirecting" ? "Taking you to your projects..." : "Signing you in..."}
              </Text>
            </>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

export default function GuestPage() {
  return (
    <Suspense
      fallback={
        <Box
          minH="100vh"
          bg="linear-gradient(135deg, #222656 0%, #1a1d42 50%, #364153 100%)"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="xl" color="white" />
        </Box>
      }
    >
      <GuestLoginInner />
    </Suspense>
  );
}
