"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, Container, Heading, Text, VStack, Spinner, Input, Button } from "@chakra-ui/react";
import { useState, useEffect, useRef, Suspense } from "react";
import { api } from "@/convex/_generated/api";

/**
 * Inner component for token-based guest login (existing flow).
 */
function GuestLoginWithToken({ token }: { token: string }) {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const scholar = useQuery(
    api.users.resolveGuestToken,
    { token }
  );

  const [status, setStatus] = useState<"loading" | "signing-in" | "redirecting" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (isAuthLoading) return;
    if (scholar === undefined) return;
    if (scholar === null) {
      setStatus("error");
      setErrorMsg("This link is invalid or has been revoked.");
      return;
    }

    attemptedRef.current = true;

    const doGuestSignIn = async () => {
      if (isAuthenticated) {
        await signOut().catch(() => {});
      }

      setStatus("signing-in");
      const email = `guest-${token}@makawulu.guest`;
      const password = token;

      try {
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
    <>
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
            {scholar ? `Welcome back, ${scholar.name}!` : "Loading..."}
          </Heading>
          <Spinner size="lg" color="violet.500" />
          <Text color="charcoal.400" fontFamily="body" fontSize="sm">
            {status === "redirecting" ? "Taking you to your projects..." : "Signing you in..."}
          </Text>
        </>
      )}
    </>
  );
}

/**
 * Self-serve registration form: visitor enters name, gets a unique link.
 */
function SelfServeGuestForm() {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const createGuest = useMutation(api.users.createSelfServeGuest);
  const router = useRouter();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setError("");
    try {
      const result = await createGuest({ name: trimmed });
      setGuestToken(result.guestToken);
      // Auto-redirect after a short delay so they can see/bookmark the link
      setTimeout(() => {
        router.push(`/guest?token=${result.guestToken}`);
      }, 3000);
    } catch (err) {
      console.error("Guest creation error:", err);
      setError("Something went wrong. Please try again.");
      setIsCreating(false);
    }
  };

  if (guestToken) {
    const guestUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/guest?token=${guestToken}`;
    return (
      <>
        <Heading as="h1" size="xl" fontFamily="heading" color="navy.500">
          You're all set!
        </Heading>
        <Text color="charcoal.500" fontFamily="body" textAlign="center">
          Bookmark this link to come back anytime:
        </Text>
        <Box
          bg="gray.100"
          px={4}
          py={3}
          borderRadius="lg"
          w="full"
          textAlign="center"
          cursor="pointer"
          _hover={{ bg: "gray.200" }}
          onClick={() => {
            navigator.clipboard?.writeText(guestUrl);
          }}
        >
          <Text fontSize="sm" fontFamily="body" color="violet.600" wordBreak="break-all">
            {guestUrl}
          </Text>
          <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mt={1}>
            Click to copy
          </Text>
        </Box>
        <Spinner size="sm" color="violet.500" />
        <Text color="charcoal.400" fontFamily="body" fontSize="sm">
          Redirecting you in a moment...
        </Text>
      </>
    );
  }

  return (
    <>
      <Heading as="h1" size="xl" fontFamily="heading" color="navy.500">
        Try Makawulu
      </Heading>
      <Text color="charcoal.500" fontFamily="body" textAlign="center">
        Enter your name to get started with your own AI learning companion.
      </Text>
      <VStack gap={3} w="full">
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          bg="gray.50"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="lg"
          fontFamily="body"
          fontSize="lg"
          h={14}
          textAlign="center"
          _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
          _focusVisible={{ boxShadow: "none", outline: "none" }}
          autoFocus
        />
        <Button
          size="lg"
          w="full"
          bg="violet.500"
          color="white"
          _hover={{ bg: "violet.600" }}
          fontFamily="heading"
          fontWeight="500"
          h={14}
          disabled={!name.trim() || isCreating}
          onClick={handleCreate}
        >
          {isCreating ? <Spinner size="sm" /> : "Start Learning"}
        </Button>
        {error && (
          <Text fontSize="sm" color="red.500" fontFamily="body">
            {error}
          </Text>
        )}
      </VStack>
    </>
  );
}

function GuestLoginInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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

          {token ? (
            <GuestLoginWithToken token={token} />
          ) : (
            <SelfServeGuestForm />
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
