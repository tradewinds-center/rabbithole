"use client";

import { Suspense, useCallback } from "react";
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
import { FiPlus, FiMessageSquare, FiClock } from "react-icons/fi";

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

  const projects = useQuery(
    api.projects.list,
    isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}
  );

  const createProject = useMutation(api.projects.create);

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
  }, [user, isUserLoading, router, remoteUserId]);

  const handleNewProject = useCallback(async () => {
    const createArgs: Record<string, unknown> = {};
    if (isRemoteMode && remoteUserId) {
      createArgs.userId = remoteUserId as Id<"users">;
    }
    try {
      const result = await createProject(createArgs as Parameters<typeof createProject>[0]);
      if (result) {
        const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
        router.push(`/scholar/${result.id}${remoteParam}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
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

  return (
    <Flex minH="100vh" bg="gray.50" flexDir="column">
      <TopBar
        displayName={displayName}
        displayImage={displayImage}
        isRemoteMode={isRemoteMode}
        onSignOut={() => signOut()}
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
            onClick={handleNewProject}
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
          {projects.map((project) => (
            <Box
              key={project._id}
              bg="white"
              borderRadius="xl"
              p={5}
              shadow="xs"
              cursor="pointer"
              _hover={{ shadow: "md" }}
              transition="all 0.15s"
              minH="140px"
              display="flex"
              flexDir="column"
              onClick={() => handleOpenProject(project._id)}
            >
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
          ))}
        </SimpleGrid>
      </Box>
    </Flex>
  );
}

function TopBar({
  displayName,
  displayImage,
  isRemoteMode,
  onSignOut,
}: {
  displayName: string;
  displayImage?: string;
  isRemoteMode: boolean;
  onSignOut: () => void;
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
        />
      )}
    </Flex>
  );
}
