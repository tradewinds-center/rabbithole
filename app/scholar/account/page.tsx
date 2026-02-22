"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import { FiCamera } from "react-icons/fi";

const READING_LEVELS = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college"];

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <Flex minH="100vh" bg="gray.50" align="center" justify="center">
          <Spinner size="xl" color="violet.500" />
        </Flex>
      }
    >
      <AccountForm />
    </Suspense>
  );
}

function AccountForm() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "true";

  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [pendingStorageId, setPendingStorageId] = useState<Id<"_storage"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Populate form from user data (once)
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      setName(user.name ?? "");
      setDateOfBirth(user.dateOfBirth ?? "");
      setReadingLevel(user.readingLevel ?? "");
      setAvatarPreview(user.image ?? undefined);
    }
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/sign-in");
    }
  }, [isLoading, user, router]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        // Show local preview immediately
        const localUrl = URL.createObjectURL(file);
        setAvatarPreview(localUrl);

        // Upload to Convex storage
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await res.json();
        setPendingStorageId(storageId as Id<"_storage">);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [generateUploadUrl]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const args: {
        name?: string;
        dateOfBirth?: string;
        readingLevel?: string;
        imageStorageId?: Id<"_storage">;
        profileSetupComplete?: boolean;
      } = {};
      if (name) args.name = name;
      if (dateOfBirth) args.dateOfBirth = dateOfBirth;
      if (readingLevel) args.readingLevel = readingLevel;
      if (pendingStorageId) args.imageStorageId = pendingStorageId;
      if (isSetup) args.profileSetupComplete = true;

      await updateProfile(args);
      setPendingStorageId(null);
      if (isSetup) {
        router.push("/scholar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [updateProfile, name, dateOfBirth, readingLevel, pendingStorageId, isSetup, router]);

  if (isLoading || !user) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

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
        >
          <VStack gap={2} textAlign="center">
            <Heading
              as="h1"
              size="xl"
              fontFamily="heading"
              color="navy.500"
              letterSpacing="tight"
            >
              {isSetup ? "Welcome! Set up your profile" : "Account Details"}
            </Heading>
          </VStack>

          {/* Avatar upload */}
          <Box position="relative" cursor="pointer" onClick={() => fileRef.current?.click()}>
            <Avatar size="lg" name={name || user.name} src={avatarPreview} />
            <Box
              position="absolute"
              bottom={0}
              right={0}
              bg="violet.500"
              borderRadius="full"
              w={7}
              h={7}
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid white"
            >
              {isUploading ? (
                <Spinner size="xs" color="white" />
              ) : (
                <FiCamera size={14} color="white" />
              )}
            </Box>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarUpload}
            />
          </Box>

          <VStack gap={3} w="full">
            <Box w="full">
              <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                Name
              </Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                bg="gray.50"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="lg"
                fontFamily="body"
                h={12}
                _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
              />
            </Box>

            <Box w="full">
              <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                Username
              </Text>
              <Input
                value={user.username ?? ""}
                readOnly
                bg="gray.100"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="lg"
                fontFamily="body"
                h={12}
                color="charcoal.400"
                cursor="not-allowed"
              />
            </Box>

            <Box w="full">
              <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                Date of Birth
              </Text>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                bg="gray.50"
                border="1px solid"
                borderColor="gray.300"
                borderRadius="lg"
                fontFamily="body"
                h={12}
                _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                _focusVisible={{ boxShadow: "none", outline: "none" }}
              />
            </Box>

            <Box w="full">
              <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={1} fontWeight="500">
                Reading Level
              </Text>
              <select
                value={readingLevel}
                onChange={(e) => setReadingLevel(e.target.value)}
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 16px",
                  backgroundColor: "var(--chakra-colors-gray-50)",
                  border: "1px solid var(--chakra-colors-gray-300)",
                  borderRadius: "var(--chakra-radii-lg)",
                  fontFamily: "var(--chakra-fonts-body)",
                  fontSize: "var(--chakra-fontSizes-md)",
                  color: "var(--chakra-colors-charcoal-500, #333)",
                  appearance: "auto",
                }}
              >
                <option value="">Not set</option>
                {READING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level === "K" ? "Kindergarten" : level === "college" ? "College" : `Grade ${level}`}
                  </option>
                ))}
              </select>
            </Box>

            <Button
              size="lg"
              w="full"
              bg="violet.500"
              color="white"
              _hover={{ bg: "violet.600" }}
              fontFamily="heading"
              fontWeight="500"
              h={14}
              mt={2}
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : saved ? "Saved!" : "Save"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              color="charcoal.400"
              fontFamily="heading"
              _hover={{ color: "violet.500" }}
              onClick={async () => {
                if (isSetup) {
                  await updateProfile({ profileSetupComplete: true });
                  router.push("/scholar");
                } else {
                  router.back();
                }
              }}
            >
              {isSetup ? "Skip for now" : "Back"}
            </Button>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
