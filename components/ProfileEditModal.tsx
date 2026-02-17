"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  HStack,
  Input,
  Portal,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import { FiCamera } from "react-icons/fi";

const READING_LEVELS = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college"];

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  /** When true, shows "Welcome" heading and "Skip for now" instead of "Cancel" */
  isSetup?: boolean;
  user: {
    name?: string;
    username?: string;
    email?: string;
    image?: string;
    dateOfBirth?: string;
    readingLevel?: string;
  };
}

export function ProfileEditModal({ open, onClose, isSetup, user }: ProfileEditModalProps) {
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();
  const [pendingStorageId, setPendingStorageId] = useState<Id<"_storage"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Populate form from user data when modal opens
  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      setName(isSetup ? "" : (user.name ?? ""));
      setEmail(isSetup ? "" : (user.email ?? ""));
      setDateOfBirth(user.dateOfBirth ?? "");
      setReadingLevel(user.readingLevel ?? "");
      setAvatarPreview(user.image ?? undefined);
    }
    if (!open) {
      initialized.current = false;
    }
  }, [open, user]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const localUrl = URL.createObjectURL(file);
        setAvatarPreview(localUrl);
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
        email?: string;
        dateOfBirth?: string;
        readingLevel?: string;
        imageStorageId?: Id<"_storage">;
        profileSetupComplete?: boolean;
      } = {};
      if (name) args.name = name;
      if (email) args.email = email;
      if (dateOfBirth) args.dateOfBirth = dateOfBirth;
      if (readingLevel) args.readingLevel = readingLevel;
      if (pendingStorageId) args.imageStorageId = pendingStorageId;
      if (isSetup) args.profileSetupComplete = true;

      await updateProfile(args);
      setPendingStorageId(null);
      if (isSetup) {
        onClose();
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [updateProfile, name, email, dateOfBirth, readingLevel, pendingStorageId, isSetup, onClose]);

  const handleSkipOrCancel = useCallback(async () => {
    if (isSetup) {
      await updateProfile({ profileSetupComplete: true });
    }
    onClose();
  }, [isSetup, updateProfile, onClose]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        // Only allow closing via our buttons in setup mode
        if (!e.open && !isSetup) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="lg"
            w="90vw"
            borderRadius="2xl"
            overflow="hidden"
          >
            <Dialog.Header px={6} pt={6} pb={0}>
              <HStack gap={4} w="full">
                {/* Avatar upload */}
                <Box position="relative" cursor="pointer" flexShrink={0} onClick={() => fileRef.current?.click()}>
                  <Avatar size="lg" name={name || user.name} src={avatarPreview} />
                  <Box
                    position="absolute"
                    bottom={0}
                    right={0}
                    bg="violet.500"
                    borderRadius="full"
                    w={6}
                    h={6}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="2px solid white"
                  >
                    {isUploading ? (
                      <Spinner size="xs" color="white" />
                    ) : (
                      <FiCamera size={12} color="white" />
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
                <Dialog.Title asChild>
                  <Heading
                    size="lg"
                    fontFamily="heading"
                    color="navy.500"
                    fontWeight="600"
                  >
                    {isSetup ? "Welcome! Set up your profile" : "Account Details"}
                  </Heading>
                </Dialog.Title>
              </HStack>
            </Dialog.Header>

            <Dialog.Body px={6} py={5}>
              <VStack gap={4} w="full">
                {/* Label-left, input-right rows */}
                <Flex gap={3} w="full" align="center">
                  <Text fontSize="sm" fontFamily="heading" color="charcoal.400" fontWeight="500" w="120px" flexShrink={0}>
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
                    h={10}
                    _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                  />
                </Flex>

                <Flex gap={3} w="full" align="center">
                  <Text fontSize="sm" fontFamily="heading" color="charcoal.400" fontWeight="500" w="120px" flexShrink={0}>
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
                    h={10}
                    color="charcoal.400"
                    cursor="not-allowed"
                  />
                </Flex>

                <Flex gap={3} w="full" align="center">
                  <Text fontSize="sm" fontFamily="heading" color="charcoal.400" fontWeight="500" w="120px" flexShrink={0}>
                    Email
                  </Text>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="lg"
                    fontFamily="body"
                    h={10}
                    _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                  />
                </Flex>

                <Flex gap={3} w="full" align="center">
                  <Text fontSize="sm" fontFamily="heading" color="charcoal.400" fontWeight="500" w="120px" flexShrink={0}>
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
                    h={10}
                    _focus={{ borderColor: "violet.400", boxShadow: "none", outline: "none" }}
                    _focusVisible={{ boxShadow: "none", outline: "none" }}
                  />
                </Flex>

                {/* Reading Level (emphasized) */}
                <Box
                  w="full"
                  bg="violet.50"
                  border="1px solid"
                  borderColor="violet.200"
                  borderRadius="xl"
                  p={4}
                >
                  <HStack gap={4} align="flex-end">
                    <Box flex={1}>
                      <Text fontSize="sm" fontFamily="heading" color="navy.500" fontWeight="600" mb={0.5}>
                        Estimated Reading Level
                      </Text>
                      <Text fontSize="xs" fontFamily="body" color="charcoal.400" lineHeight="1.4" mb={2}>
                        The AI will use this as a starting point. It adjusts over time, but a good estimate helps from day one.
                      </Text>
                      <select
                        value={readingLevel}
                        onChange={(e) => setReadingLevel(e.target.value)}
                        style={{
                          width: "100%",
                          maxWidth: "220px",
                          height: "40px",
                          padding: "0 16px",
                          backgroundColor: "white",
                          border: "1px solid var(--chakra-colors-violet-300)",
                          borderRadius: "var(--chakra-radii-lg)",
                          fontFamily: "var(--chakra-fonts-body)",
                          fontSize: "var(--chakra-fontSizes-md)",
                          color: "var(--chakra-colors-charcoal-500, #333)",
                          appearance: "auto",
                        }}
                      >
                        <option value="">Select level</option>
                        {READING_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level === "K" ? "Kindergarten" : level === "college" ? "College" : `Grade ${level}`}
                          </option>
                        ))}
                      </select>
                    </Box>
                  </HStack>
                </Box>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer px={6} py={4} borderTop="1px solid" borderColor="gray.100">
              <HStack gap={3} w="full" justify="flex-end">
                <Button
                  variant="ghost"
                  size="sm"
                  color="charcoal.400"
                  fontFamily="heading"
                  _hover={{ color: "violet.500" }}
                  onClick={handleSkipOrCancel}
                >
                  {isSetup ? "Skip for now" : "Cancel"}
                </Button>
                <Button
                  bg="violet.500"
                  color="white"
                  _hover={{ bg: "violet.600" }}
                  fontFamily="heading"
                  fontWeight="500"
                  px={8}
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? "Saving..." : saved ? "Saved!" : "Save"}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
