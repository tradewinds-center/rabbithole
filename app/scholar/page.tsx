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
  Breadcrumb,
  Flex,
  HStack,
  Text,
  Spinner,
  SimpleGrid,
} from "@chakra-ui/react";
import { AppLogo } from "@/components/AppLogo";
import { AppHeader } from "@/components/AppHeader";
import { AccountMenu } from "@/components/AccountMenu";
import { Avatar } from "@/components/Avatar";
import { UnitPickerDialog } from "@/components/UnitPickerDialog";
import { toaster } from "@/lib/toaster";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import { FiPlus, FiMessageSquare, FiClock, FiLock, FiCompass, FiHeart } from "react-icons/fi";
import { SidekickAvatar } from "@/components/SidekickAvatar";
import { SidekickSetupFlow } from "@/components/SidekickSetupFlow";

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

  const remoteUser = useQuery(
    api.users.getUser,
    isRemoteMode && remoteUserId ? { userId: remoteUserId as Id<"users"> } : "skip"
  );

  const projects = useQuery(
    api.projects.list,
    user ? (isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}) : "skip"
  );

  const units = useQuery(api.units.list, user ? {} : "skip") ?? [];
  const currentFocus = useQuery(api.focus.getCurrent, user ? {} : "skip");
  const focusLock = !isTestMode && currentFocus?.isActive
    ? {
        unitId: currentFocus.unitId ? String(currentFocus.unitId) : null,
        lessonId: currentFocus.lessonId ? String(currentFocus.lessonId) : null,
        lessonTitle: currentFocus.lessonTitle ?? null,
      }
    : null;

  const seeds = useQuery(api.seeds.activeForSelf, user ? {} : "skip") ?? [];
  const sidekick = useQuery(api.sidekicks.getForScholar, user && !isRemoteMode ? {} : "skip");
  const portrait = useQuery(api.scholarPortraits.getForScholar, user && !isRemoteMode ? {} : "skip");
  const createProject = useMutation(api.projects.create);
  const createFromSeed = useMutation(api.projects.createFromSeed);

  // Unit picker dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [exploringSeedId, setExploringSeedId] = useState<string | null>(null);
  const [sidekickSetupOpen, setSidekickSetupOpen] = useState(false);

  // Profile edit modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const needsSetup = !!(user && user.role === "scholar" && !user.profileSetupComplete);

  // Auth redirects
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    if ((user.role === "teacher" || user.role === "admin") && !remoteUserId) {
      router.replace("/teacher");
      return;
    }
  }, [user, isUserLoading, router, remoteUserId]);

  const handleUnitSelected = useCallback(async (unitId: string | null, lessonId: string | null) => {
    setIsCreating(true);
    const createArgs: Record<string, unknown> = {};
    if (isRemoteMode && remoteUserId) {
      createArgs.userId = remoteUserId as Id<"users">;
    }
    if (unitId) {
      createArgs.unitId = unitId as Id<"units">;
    }
    if (lessonId) {
      createArgs.lessonId = lessonId as Id<"lessons">;
    }
    try {
      const result = await createProject(createArgs as Parameters<typeof createProject>[0]);
      if (result) {
        const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
        router.push(`/scholar/${result.id}${remoteParam}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toaster.error({ title: "Failed to create project", description: "Please try again." });
    } finally {
      setIsCreating(false);
      setDialogOpen(false);
    }
  }, [createProject, router, remoteUserId, isRemoteMode]);

  const handleOpenProject = useCallback((projectId: string) => {
    const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
    router.push(`/scholar/${projectId}${remoteParam}`);
  }, [router, remoteUserId]);

  const handleExploreSeed = useCallback(async (seedId: Id<"seeds">) => {
    setExploringSeedId(seedId);
    try {
      const result = await createFromSeed({ seedId });
      if (result) {
        const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
        router.push(`/scholar/${result.id}${remoteParam}`);
      }
    } catch (error) {
      console.error("Error creating project from seed:", error);
      toaster.error({ title: "Failed to start exploration", description: "Please try again." });
    } finally {
      setExploringSeedId(null);
    }
  }, [createFromSeed, router, remoteUserId]);

  if (isUserLoading || projects === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }


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
        isRemoteMode={isRemoteMode}
        scholarName={isRemoteMode ? remoteUser?.name ?? null : null}
        scholarImage={isRemoteMode ? remoteUser?.image ?? null : null}
        onSignOut={() => signOut()}
        onOpenProfile={() => setProfileModalOpen(true)}
        pulseScore={pulseScore}
        lastMessageAt={lastMessageAt}
      />
      <Box flex={1} overflow="auto" p={{ base: 4, md: 6 }} maxW="1000px" mx="auto" w="full">
        {/* Sidekick banner */}
        {!isRemoteMode && user?.role === "scholar" && user.profileSetupComplete && (
          sidekick?.setupComplete ? (
            <Box
              bg="white"
              borderRadius="xl"
              p={4}
              mb={4}
              shadow="xs"
              cursor="pointer"
              _hover={{ shadow: "md" }}
              transition="all 0.15s"
              onClick={() => router.push("/scholar/interview")}
            >
              <HStack gap={3}>
                <SidekickAvatar size={48} showName={false} />
                <Box flex={1}>
                  <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
                    {sidekick.name ?? "Your Sidekick"}
                  </Text>
                  <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                    {portrait?.status ?? "Just getting started"}
                    {portrait?.completeness != null && ` · ${portrait.completeness}% portrait`}
                  </Text>
                </Box>
                <HStack
                  gap={1.5}
                  px={3}
                  py={1.5}
                  borderRadius="full"
                  bg="violet.50"
                  color="violet.600"
                  fontFamily="heading"
                  fontWeight="600"
                  fontSize="sm"
                >
                  <FiHeart size={14} />
                  <Text>Chat</Text>
                </HStack>
              </HStack>
            </Box>
          ) : sidekick !== undefined ? (
            <Box
              bg="violet.50"
              borderRadius="xl"
              p={4}
              mb={4}
              border="2px dashed"
              borderColor="violet.200"
              cursor="pointer"
              _hover={{ borderColor: "violet.400" }}
              transition="all 0.15s"
              onClick={() => setSidekickSetupOpen(true)}
            >
              <HStack gap={3}>
                <Box w="48px" h="48px" borderRadius="full" bg="violet.200" display="flex" alignItems="center" justifyContent="center">
                  <Text fontSize="xl">✨</Text>
                </Box>
                <Box flex={1}>
                  <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="violet.700">
                    Meet your Sidekick
                  </Text>
                  <Text fontSize="xs" color="violet.500" fontFamily="body">
                    Design an AI companion who will get to know you
                  </Text>
                </Box>
              </HStack>
            </Box>
          ) : null
        )}

        {/* Compact new project button */}
        <Flex justify="flex-end" mb={3}>
          <HStack
            as="button"
            gap={1.5}
            px={3}
            py={1.5}
            borderRadius="full"
            bg="violet.50"
            color="violet.600"
            fontFamily="heading"
            fontWeight="600"
            fontSize="sm"
            cursor="pointer"
            transition="all 0.15s"
            _hover={{ bg: "violet.100" }}
            onClick={() => setDialogOpen(true)}
          >
            <FiPlus size={14} />
            <Text>New Project</Text>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
          {/* Seed cards */}
          {seeds.map((seed) => (
            <Box
              key={seed._id}
              bg="white"
              borderRadius="xl"
              p={5}
              shadow="xs"
              cursor={exploringSeedId ? "default" : "pointer"}
              border="2px dashed"
              borderColor="violet.200"
              opacity={exploringSeedId && exploringSeedId !== seed._id ? 0.5 : 1}
              _hover={exploringSeedId ? {} : { shadow: "md", borderColor: "violet.400" }}
              transition="all 0.15s"
              minH="140px"
              display="flex"
              flexDir="column"
              onClick={() => !exploringSeedId && handleExploreSeed(seed._id)}
            >
              <HStack mb={1} gap={2}>
                <Box color="violet.500" flexShrink={0}>
                  <FiCompass size={14} />
                </Box>
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
                  {seed.topic}
                </Text>
              </HStack>
              {seed.domain && (
                <Text fontSize="2xs" color="violet.600" fontFamily="heading" fontWeight="500" mb={1}>
                  {seed.domain}
                </Text>
              )}
              <Text
                fontSize="xs"
                color="charcoal.400"
                fontFamily="body"
                lineHeight="1.4"
                flex={1}
                overflow="hidden"
                css={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {seed.rationale}
              </Text>
              <Text
                fontSize="xs"
                fontFamily="heading"
                fontWeight="600"
                color="violet.500"
                mt={2}
              >
                {exploringSeedId === seed._id ? "Starting..." : "Explore this \u2192"}
              </Text>
            </Box>
          ))}

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
                cursor="pointer"
                opacity={isMismatch ? 0.5 : 1}
                _hover={{ shadow: "md" }}
                transition="all 0.15s"
                minH="140px"
                display="flex"
                flexDir="column"
                position="relative"
                onClick={() => handleOpenProject(project._id)}
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

      {/* Profile setup / edit modal */}
      {user && (
        <ProfileEditModal
          open={needsSetup || profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          isSetup={needsSetup}
          user={user}
        />
      )}

      {/* Sidekick setup flow */}
      <SidekickSetupFlow
        open={sidekickSetupOpen}
        onClose={() => setSidekickSetupOpen(false)}
      />
    </Flex>
  );
}

function TopBar({
  isRemoteMode,
  scholarName,
  scholarImage,
  onSignOut,
  onOpenProfile,
  pulseScore,
  lastMessageAt,
}: {
  isRemoteMode: boolean;
  scholarName?: string | null;
  scholarImage?: string | null;
  onSignOut: () => void;
  onOpenProfile: () => void;
  pulseScore?: number | null;
  lastMessageAt?: number | null;
}) {
  return (
    <AppHeader>
      {isRemoteMode && scholarName ? (
        <Breadcrumb.Root>
          <Breadcrumb.List fontFamily="heading" fontSize="sm" gap={2.5}>
            <Breadcrumb.Item>
              <Breadcrumb.Link href="/teacher" css={{ display: "flex", alignItems: "center" }}>
                <AppLogo variant="dark" size={24} />
              </Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator color="charcoal.300" />
            <Breadcrumb.Item>
              <Breadcrumb.CurrentLink
                css={{ display: "flex", alignItems: "center", gap: "6px" }}
                fontWeight="600"
                color="charcoal.500"
              >
                <Avatar size="xs" name={scholarName} src={scholarImage || undefined} />
                {scholarName}
              </Breadcrumb.CurrentLink>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      ) : (
        <AppLogo variant="dark" />
      )}
      <Box flex={1} />
      {isRemoteMode ? (
        <AccountMenu onSignOut={onSignOut} />
      ) : (
        <AccountMenu
          onSignOut={onSignOut}
          onOpenProfile={onOpenProfile}
          pulseScore={pulseScore}
          lastMessageAt={lastMessageAt}
        />
      )}
    </AppHeader>
  );
}
