"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Flex,
  HStack,
  Text,
  Spinner,
  SimpleGrid,
} from "@chakra-ui/react";
import { AppLogo } from "@/components/AppLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { UnitPickerDialog } from "@/components/UnitPickerDialog";
import { FiPlus, FiMessageSquare, FiClock, FiLock } from "react-icons/fi";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * /scholar — Home view with project cards.
 * If ?remote=userId is set, shows that scholar's projects (teacher remote mode).
 */
export default function ScholarPage() {
  return (
    <Suspense fallback={<Flex minH="100vh" bg="gray.50" align="center" justify="center"><Spinner size="xl" color="violet.500" /></Flex>}>
      <ScholarHome />
    </Suspense>
  );
}

function ScholarHome() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const remoteUserId = searchParams.get("remote");
  const isRemoteMode = !!(remoteUserId && user && (user.role === "teacher" || user.role === "admin"));
  const isTestMode = !!(user && (user.role === "teacher" || user.role === "admin"));

  const projects = useQuery(
    api.projects.list,
    user ? (isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}) : "skip"
  );

  const units = useQuery(api.units.list, user ? {} : "skip") ?? [];
  const currentFocus = useQuery(api.focus.getCurrent, user ? {} : "skip");
  const focusLock = !isTestMode && currentFocus?.isActive
    ? { unitId: currentFocus.unitId ? String(currentFocus.unitId) : null }
    : null;

  const createProject = useMutation(api.projects.create);

  // Unit picker dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Auth redirects
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if ((user.role === "teacher" || user.role === "admin") && !remoteUserId) {
      router.replace("/teacher");
      return;
    }
    // New account → setup flow
    if (user.role === "scholar" && !user.profileSetupComplete) {
      router.replace("/scholar/account?setup=true");
      return;
    }
  }, [user, isUserLoading, router, remoteUserId]);

  const handleUnitSelected = useCallback(async (unitId: string | null) => {
    setIsCreating(true);
    const createArgs: Record<string, unknown> = {};
    if (isRemoteMode && remoteUserId) {
      createArgs.userId = remoteUserId as Id<"users">;
    }
    if (unitId) {
      createArgs.unitId = unitId as Id<"units">;
    }
    try {
      const result = await createProject(createArgs as Parameters<typeof createProject>[0]);
      if (result) {
        const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
        router.push(`/scholar/${result.id}${remoteParam}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
      setDialogOpen(false);
    }
  }, [createProject, router, remoteUserId, isRemoteMode]);

  const handleOpenProject = useCallback((projectId: string) => {
    const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
    router.push(`/scholar/${projectId}${remoteParam}`);
  }, [router, remoteUserId]);

  if (isUserLoading || projects === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  const displayName = user?.name || "Scholar";
  const displayImage = user?.image || undefined;

  // Derive scholar-level pulse from most recent project
  const mostRecent = projects?.[0];
  const pulseScore = mostRecent?.pulseScore ?? null;
  // Get last user message time from the most recent project
  const lastMessageAt = mostRecent?._creationTime ?? null;

  // Focus lock: which unitId is locked (if any)
  const lockedUnitId = focusLock?.unitId ?? null;

  return (
    <Flex minH="100vh" bg="gray.50" flexDir="column">
      <TopBar
        displayName={displayName}
        displayImage={displayImage}
        isRemoteMode={isRemoteMode}
        isAdmin={user?.role === "admin"}
        onSignOut={() => signOut()}
        pulseScore={pulseScore}
        lastMessageAt={lastMessageAt}
      />
      <Box flex={1} overflow="auto" p={{ base: 4, md: 6 }} maxW="1000px" mx="auto" w="full">
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
          {/* New Project card */}
          <Box
            bg="white"
            borderRadius="xl"
            p={5}
            shadow="xs"
            cursor="pointer"
            border="2px dashed"
            borderColor="violet.200"
            _hover={{ borderColor: "violet.400", shadow: "md" }}
            display="flex"
            flexDir="column"
            alignItems="center"
            justifyContent="center"
            minH="140px"
            transition="all 0.15s"
            onClick={() => setDialogOpen(true)}
          >
            <Box
              w={12}
              h={12}
              borderRadius="full"
              bg="violet.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={2}
            >
              <FiPlus size={24} color="#AD60BF" />
            </Box>
            <Text fontFamily="heading" fontWeight="600" color="violet.600" fontSize="sm">
              New Project
            </Text>
          </Box>

          {/* Project cards */}
          {projects.map((project) => {
            // Gray out projects that don't match the focus-locked unit
            const isMismatch = lockedUnitId != null &&
              String(project.unitId ?? "") !== lockedUnitId;

            return (
              <Box
                key={project._id}
                bg="white"
                borderRadius="xl"
                p={5}
                shadow="xs"
                cursor={isMismatch ? "default" : "pointer"}
                opacity={isMismatch ? 0.4 : 1}
                pointerEvents={isMismatch ? "none" : "auto"}
                _hover={isMismatch ? undefined : { shadow: "md" }}
                transition="all 0.15s"
                minH="140px"
                display="flex"
                flexDir="column"
                position="relative"
                onClick={isMismatch ? undefined : () => handleOpenProject(project._id)}
              >
                {isMismatch && (
                  <Box position="absolute" top={3} right={3} color="charcoal.300">
                    <FiLock size={14} />
                  </Box>
                )}
                <HStack mb={2} gap={2}>
                  {project.personaEmoji && (
                    <Text fontSize="lg">{project.personaEmoji}</Text>
                  )}
                  <Text
                    fontFamily="heading"
                    fontWeight="600"
                    color="navy.500"
                    fontSize="sm"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    flex={1}
                  >
                    {project.title}
                  </Text>
                </HStack>

                {project.unitTitle && (
                  <HStack gap={1} mb={2}>
                    {project.unitEmoji && <Text fontSize="xs">{project.unitEmoji}</Text>}
                    <Text fontSize="xs" color="violet.600" fontFamily="heading" fontWeight="500">
                      {project.unitTitle}
                    </Text>
                  </HStack>
                )}

                {project.analysisSummary && (
                  <Text
                    fontSize="xs"
                    color="charcoal.400"
                    fontFamily="body"
                    lineHeight="1.4"
                    mb={2}
                    overflow="hidden"
                    css={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {project.analysisSummary}
                  </Text>
                )}

                <HStack mt="auto" gap={3} pt={2}>
                  <HStack gap={1} color="charcoal.300">
                    <FiMessageSquare size={12} />
                    <Text fontSize="xs" fontFamily="heading">
                      {project.messageCount}
                    </Text>
                  </HStack>
                  <HStack gap={1} color="charcoal.300">
                    <FiClock size={12} />
                    <Text fontSize="xs" fontFamily="heading">
                      {timeAgo(project.updatedAt)}
                    </Text>
                  </HStack>
                </HStack>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>

      {/* Unit Picker Dialog */}
      <UnitPickerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleUnitSelected}
        units={units.map((u) => ({
          id: u._id,
          title: u.title,
          emoji: u.emoji,
          description: u.description,
        }))}
        focusLock={focusLock}
        isCreating={isCreating}
      />
    </Flex>
  );
}

function TopBar({
  displayName,
  displayImage,
  isRemoteMode,
  isAdmin,
  onSignOut,
  pulseScore,
  lastMessageAt,
}: {
  displayName: string;
  displayImage?: string;
  isRemoteMode: boolean;
  isAdmin?: boolean;
  onSignOut: () => void;
  pulseScore?: number | null;
  lastMessageAt?: number | null;
}) {
  return (
    <Flex
      px={{ base: 4, md: 6 }}
      py={3}
      borderBottom="1px solid"
      borderColor="gray.200"
      bg="white"
      align="center"
      justify="space-between"
      flexShrink={0}
    >
      <AppLogo variant="dark" />
      {!isRemoteMode && (
        <AccountMenu
          userName={displayName}
          userImage={displayImage}
          onSignOut={onSignOut}
          pulseScore={pulseScore}
          lastMessageAt={lastMessageAt}
          isAdmin={isAdmin}
        />
      )}
    </Flex>
  );
}
