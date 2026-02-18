"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Box,
  Drawer,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Portal,
  Spinner,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiPlus,
  FiLogOut,
  FiTrash2,
  FiX,
  FiHome,
} from "react-icons/fi";
import { ProjectInterface } from "@/components/ProjectInterface";
import { AppLogo } from "@/components/AppLogo";
import { UnitPickerDialog } from "@/components/UnitPickerDialog";

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

export default function ScholarProjectPage() {
  return (
    <Suspense fallback={<Flex minH="100vh" bg="gray.50" align="center" justify="center"><Spinner size="xl" color="violet.500" /></Flex>}>
      <ScholarProjectInner />
    </Suspense>
  );
}

function ScholarProjectInner() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const newProjectCreatedRef = useRef(false);

  const projectId = params.projectId as string; // Convex ID or "new"
  const isNewProject = projectId === "new";

  // Remote mode: teacher viewing as a scholar
  const remoteUserId = searchParams.get("remote");
  const isRemoteMode = !!(remoteUserId && user && (user.role === "teacher" || user.role === "admin"));

  // Unit param from URL (for pre-setting unit on new projects)
  const urlUnit = searchParams.get("unit");
  const hasDimensionParams = !!urlUnit;

  // Fetch projects reactively via Convex
  const projects = useQuery(
    api.projects.list,
    isRemoteMode ? { userId: remoteUserId as Id<"users"> } : {}
  ) ?? [];

  // Fetch unit list for resolving URL param slug to ID
  const units = useQuery(api.units.list) ?? [];

  // Fetch scholar info for remote mode banner
  const remoteUser = useQuery(
    api.users.getUser,
    isRemoteMode && remoteUserId ? { userId: remoteUserId as Id<"users"> } : "skip"
  );

  const createProject = useMutation(api.projects.create);
  const archiveProject = useMutation(api.projects.archive);

  // Focus lock from teacher
  const currentFocus = useQuery(api.focus.getCurrent);

  // Resolve URL param slug to unit ID
  const resolvedUnitId = (() => {
    if (urlUnit) {
      const match = units.find((u) => u.slug === urlUnit);
      if (match) return match._id;
    }
    return undefined;
  })();

  const isDemoMode = searchParams.get("demo") === "1";

  // Test mode: any time a teacher is using the scholar interface
  const isTestMode = !!(
    user &&
    (user.role === "teacher" || user.role === "admin")
  );

  const focusLock = !isTestMode && currentFocus?.isActive
    ? { unitId: currentFocus.unitId ? String(currentFocus.unitId) : null }
    : null;

  // Unit picker dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreatingViaDialog, setIsCreatingViaDialog] = useState(false);

  // Redirect logic
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Let teachers through if they have dimension params (preview/demo), remote mode, or demo flag
    if ((user.role === "teacher" || user.role === "admin") && !remoteUserId && !hasDimensionParams && !isDemoMode) {
      router.replace("/teacher");
      return;
    }
  }, [user, isUserLoading, router, remoteUserId, hasDimensionParams, isDemoMode]);

  // Auto-create project when projectId is "new" (URL-based creation from teacher links)
  useEffect(() => {
    if (!isNewProject || newProjectCreatedRef.current) return;
    // Wait for unit list to load if we have a unit param
    if (urlUnit && units.length === 0) return;

    // Check if scholar already has a project for this unit (join, don't duplicate)
    if (resolvedUnitId && projects.length > 0) {
      const existing = projects.find((p) => p.unitId === resolvedUnitId);
      if (existing) {
        newProjectCreatedRef.current = true;
        const queryParts: string[] = [];
        if (remoteUserId) queryParts.push(`remote=${remoteUserId}`);
        const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
        router.replace(`/scholar/${existing.id}${query}`);
        return;
      }
    }

    newProjectCreatedRef.current = true;

    const createArgs: Record<string, unknown> = {};
    if (isRemoteMode && remoteUserId) {
      createArgs.userId = remoteUserId as Id<"users">;
    }
    if (resolvedUnitId) createArgs.unitId = resolvedUnitId;

    createProject(createArgs as Parameters<typeof createProject>[0])
      .then((result) => {
        if (result) {
          const queryParts: string[] = [];
          if (remoteUserId) queryParts.push(`remote=${remoteUserId}`);
          if (hasDimensionParams) queryParts.push("demo=1");
          const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
          router.replace(`/scholar/${result.id}${query}`);
        }
      })
      .catch((error) => {
        console.error("Error creating project:", error);
        newProjectCreatedRef.current = false;
      });
  }, [isNewProject, hasDimensionParams, units, resolvedUnitId, createProject, router, remoteUserId, isRemoteMode, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open unit picker dialog for new project
  const handleNewProject = useCallback(() => {
    setDialogOpen(true);
  }, []);

  // Create project after unit selection from dialog
  const handleUnitSelected = useCallback(async (unitId: string | null) => {
    setIsCreatingViaDialog(true);
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
      setIsCreatingViaDialog(false);
      setDialogOpen(false);
    }
  }, [createProject, router, remoteUserId, isRemoteMode]);

  // Archive project
  const handleArchiveProject = async (id: string) => {
    try {
      await archiveProject({ id: id as Id<"projects"> });
      if (projectId === id) {
        // Navigate to another project or welcome
        const remaining = projects.filter((c) => c._id !== id);
        const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
        if (remaining.length > 0) {
          router.replace(`/scholar/${remaining[0]._id}${remoteParam}`);
        } else {
          router.replace(`/scholar/new${remoteParam}`);
        }
      }
    } catch (error) {
      console.error("Error archiving project:", error);
    }
  };

  if (isUserLoading || projects === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  // Header always shows the logged-in user, not the remote scholar
  const displayName = user?.name || "Scholar";
  const displayImage = user?.image || undefined;

  // Show spinner while "new" project is being created
  const showProject = !isNewProject && projectId;

  return (
    <Flex h="100vh" bg="gray.50">
      {/* Sidebar Drawer */}
      <Drawer.Root
        open={isSidebarOpen}
        onOpenChange={(e) => setIsSidebarOpen(e.open)}
        placement="start"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg="white" maxW="300px">
              {/* Sidebar Header */}
              <Flex
                p={4}
                borderBottom="1px solid"
                borderColor="gray.200"
                justify="space-between"
                align="center"
              >
                <AppLogo variant="dark" />
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close sidebar"
                    size="sm"
                    variant="ghost"
                    color="charcoal.500"
                    _hover={{ bg: "gray.100" }}
                  >
                    <FiX />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>

              {/* Home */}
              <Box px={3} pt={3}>
                <Button
                  w="full"
                  size="md"
                  variant="ghost"
                  color="navy.500"
                  fontFamily="heading"
                  justifyContent="flex-start"
                  _hover={{ bg: "gray.100" }}
                  onClick={() => {
                    const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
                    router.push(`/scholar${remoteParam}`);
                    setIsSidebarOpen(false);
                  }}
                >
                  <FiHome style={{ marginRight: "8px" }} />
                  Home
                </Button>
              </Box>

              {/* Projects header + New Project */}
              <HStack px={4} pt={4} pb={1} justify="space-between" align="center">
                <Text fontSize="xs" fontWeight="600" fontFamily="heading" color="charcoal.400" textTransform="uppercase" letterSpacing="wider">
                  Projects
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  color="violet.500"
                  borderColor="violet.300"
                  fontFamily="heading"
                  _hover={{ bg: "violet.50" }}
                  onClick={() => {
                    handleNewProject();
                    setIsSidebarOpen(false);
                  }}
                >
                  <FiPlus style={{ marginRight: "4px" }} />
                  New Project
                </Button>
              </HStack>

              {/* Projects List */}
              <VStack
                flex={1}
                overflowY="auto"
                p={2}
                gap={1}
                align="stretch"
              >
                {projects.map((conv) => (
                  <HStack
                    key={conv._id}
                    p={3}
                    borderRadius="lg"
                    cursor="pointer"
                    bg={projectId === conv._id ? "violet.50" : "transparent"}
                    _hover={{ bg: projectId === conv._id ? "violet.50" : "gray.100" }}
                    css={{ "& .archive-btn": { opacity: 0 }, "&:hover .archive-btn": { opacity: 0.5 } }}
                    onClick={() => {
                      const remoteParam = remoteUserId ? `?remote=${remoteUserId}` : "";
                      router.push(`/scholar/${conv._id}${remoteParam}`);
                      setIsSidebarOpen(false);
                    }}
                    justify="space-between"
                  >
                    <VStack gap={0} flex={1} overflow="hidden" align="start">
                      <Text
                        color="navy.500"
                        fontSize="sm"
                        fontFamily="heading"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        w="full"
                      >
                        {conv.title}
                      </Text>
                      <Text
                        color="charcoal.300"
                        fontSize="xs"
                        fontFamily="heading"
                      >
                        {timeAgo(conv.updatedAt)}
                      </Text>
                    </VStack>
                    <IconButton
                      className="archive-btn"
                      aria-label="Archive"
                      size="xs"
                      variant="ghost"
                      color="charcoal.400"
                      _hover={{ opacity: 1, bg: "gray.200" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveProject(conv._id);
                      }}
                    >
                      <FiTrash2 />
                    </IconButton>
                  </HStack>
                ))}
                {projects.length === 0 && (
                  <Text
                    color="charcoal.300"
                    fontSize="sm"
                    fontFamily="heading"
                    textAlign="center"
                    py={4}
                  >
                    No projects yet
                  </Text>
                )}
              </VStack>

              {/* User Section */}
              <Box p={3} borderTop="1px solid" borderColor="gray.200">
                <HStack justify="space-between">
                  <HStack gap={3}>
                    <Avatar
                      size="sm"
                      name={displayName}
                      src={displayImage}
                    />
                    <VStack gap={0} align="start">
                      <Text
                        color="navy.500"
                        fontSize="sm"
                        fontFamily="heading"
                        fontWeight="500"
                      >
                        {displayName}
                      </Text>
                      <Text color="charcoal.400" fontSize="xs" fontFamily="heading">
                        {isRemoteMode ? "Scholar (Remote)" : "Scholar"}
                      </Text>
                    </VStack>
                  </HStack>
                  {!isRemoteMode && (
                    <IconButton
                      aria-label="Sign out"
                      size="sm"
                      variant="ghost"
                      color="charcoal.500"
                      _hover={{ bg: "gray.100" }}
                      onClick={() => signOut()}
                    >
                      <FiLogOut />
                    </IconButton>
                  )}
                </HStack>
              </Box>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Main Project Area */}
      <Flex flex={1} flexDir="column" overflow="hidden">
        {showProject ? (
          <ProjectInterface
            projectId={projectId}
            onProjectUpdate={() => {}}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onSignOut={isRemoteMode ? undefined : () => signOut()}
            userName={displayName}
            userImage={displayImage}
            isTestMode={isTestMode}
            isAdmin={user?.role === "admin"}
            isRemoteMode={isRemoteMode}
          />
        ) : (
          <Flex
            flex={1}
            align="center"
            justify="center"
            flexDir="column"
            gap={4}
            p={8}
          >
            <Box
              w={24}
              h={24}
              borderRadius="full"
              bg="linear-gradient(135deg, #AD60BF 0%, #222656 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text
                fontSize="4xl"
                fontWeight="bold"
                color="white"
                fontFamily="heading"
              >
                M
              </Text>
            </Box>
            <VStack gap={2}>
              <Text
                fontSize="2xl"
                fontWeight="600"
                fontFamily="heading"
                color="navy.500"
              >
                {isNewProject ? "Creating project..." : "Welcome"}
              </Text>
              {isNewProject ? (
                <Spinner size="lg" color="violet.500" mt={4} />
              ) : (
                <>
                  <Text
                    color="charcoal.400"
                    fontFamily="body"
                    textAlign="center"
                    maxW="md"
                  >
                    Your AI learning companion. Start a new project to explore
                    ideas, ask questions, and dive deep into any topic that sparks
                    your curiosity.
                  </Text>
                  <Button
                    size="lg"
                    bg="violet.500"
                    color="white"
                    _hover={{ bg: "violet.700" }}
                    fontFamily="heading"
                    onClick={handleNewProject}
                    mt={2}
                  >
                    <FiPlus style={{ marginRight: "8px" }} />
                    Start a Project
                  </Button>
                </>
              )}
            </VStack>
          </Flex>
        )}
      </Flex>

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
        isCreating={isCreatingViaDialog}
      />
    </Flex>
  );
}
