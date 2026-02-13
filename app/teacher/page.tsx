"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Spinner,
  Card,
  SimpleGrid,
  Menu,
  Portal,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiLogOut,
  FiUsers,
  FiMessageSquare,
  FiUser,
  FiBook,
  FiSmile,
  FiEye,
  FiChevronDown,
  FiX,
} from "react-icons/fi";
import { TbFocusCentered } from "react-icons/tb";
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";

type Tab = "scholars" | "live" | "projects" | "personas" | "perspectives";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
  { key: "live", label: "Conductor View", icon: Lectern },
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "projects", label: "Projects", icon: FiBook },
  { key: "personas", label: "Personas", icon: FiSmile },
  { key: "perspectives", label: "Perspectives", icon: FiEye },
];

interface Scholar {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  conversationCount: number;
  messageCount: number;
  overallStatus: "green" | "yellow" | "red";
  lastActive: number;
  statusSummary: string | null;
  progressScore: number | null;
  lastMessage: string | null;
}

export default function TeacherDashboard() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const scholars = useQuery(api.users.listScholars) ?? [];
  const [activeTab, setActiveTab] = useState<Tab>("live");
  const [selectedScholarId, setSelectedScholarId] = useState<string | null>(
    null
  );

  // Focus mode data
  const personas = useQuery(api.personas.list) ?? [];
  const projects = useQuery(api.projects.list) ?? [];
  const perspectives = useQuery(api.perspectives.list) ?? [];
  const currentFocus = useQuery(api.focus.getCurrent);
  const setFocus = useMutation(api.focus.set);
  const clearFocus = useMutation(api.focus.clear);

  // Auth redirect
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "teacher" && user.role !== "admin") {
      router.push("/scholar");
      return;
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || scholars === undefined) {
    return (
      <Flex minH="100vh" bg="gray.50" align="center" justify="center">
        <Spinner size="xl" color="violet.500" />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" bg="gray.50" direction="column">
      {/* Tab Bar with logo + account */}
      <Flex bg="white" borderBottom="1px solid" borderColor="gray.200" px={6} align="center">
        {/* Logo */}
        <HStack gap={2} mr={6}>
          <Box
            w={7}
            h={7}
            borderRadius="full"
            bg="linear-gradient(135deg, #AD60BF 0%, #222656 100%)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize="sm" fontWeight="bold" color="white" fontFamily="heading">
              M
            </Text>
          </Box>
          <Text fontSize="md" fontWeight="600" fontFamily="heading" color="navy.500" whiteSpace="nowrap">
            Makawulu
          </Text>
        </HStack>

        {/* Tabs */}
        <HStack gap={0}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <Button
                key={tab.key}
                variant="ghost"
                borderRadius={0}
                borderBottom="2px solid"
                borderColor={isActive ? "violet.500" : "transparent"}
                color={isActive ? "violet.600" : "charcoal.400"}
                fontFamily="heading"
                fontWeight={isActive ? "600" : "500"}
                fontSize="sm"
                px={5}
                py={3}
                h="auto"
                _hover={{ color: "violet.500", bg: "violet.50" }}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedScholarId(null);
                }}
              >
                <TabIcon style={{ marginRight: "6px" }} />
                {tab.label}
              </Button>
            );
          })}
        </HStack>

        {/* Account menu */}
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              ml="auto"
              px={2}
              _hover={{ bg: "gray.100" }}
            >
              <HStack gap={2}>
                <Avatar
                  size="sm"
                  name={user?.name || "Teacher"}
                  src={user?.image || undefined}
                />
                <Text fontFamily="heading" fontSize="xs" fontWeight="500" color="charcoal.500">
                  {user?.name}
                </Text>
              </HStack>
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="160px">
              <Menu.Item
                value="sign-out"
                cursor="pointer"
                onClick={() => {
                  signOut();
                  router.push("/login");
                }}
              >
                <FiLogOut />
                Sign Out
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Flex>

      {/* Content */}
      <Flex flex={1} overflow="hidden">
        {/* Scholars dossier tab — list + detail layout */}
        {activeTab === "scholars" && (
          <>
            <Box
              w="280px"
              minW="280px"
              bg="white"
              borderRight="1px solid"
              borderColor="gray.200"
              overflow="auto"
            >
              <VStack gap={0} align="stretch">
                {scholars.map((scholar) => {
                  const isSelected = selectedScholarId === scholar.id;
                  return (
                    <HStack
                      key={scholar.id}
                      px={4}
                      py={3}
                      gap={3}
                      cursor="pointer"
                      bg={isSelected ? "violet.50" : "transparent"}
                      borderLeft="3px solid"
                      borderColor={isSelected ? "violet.500" : "transparent"}
                      _hover={{ bg: isSelected ? "violet.50" : "gray.50" }}
                      transition="all 0.1s"
                      onClick={() => setSelectedScholarId(scholar.id)}
                    >
                      <Avatar
                        size="sm"
                        name={scholar.name}
                        src={scholar.image || undefined}
                      />
                      <VStack gap={0} align="start" flex={1}>
                        <Text
                          fontWeight={isSelected ? "600" : "500"}
                          fontFamily="heading"
                          color={isSelected ? "violet.700" : "navy.500"}
                          fontSize="sm"
                        >
                          {scholar.name}
                        </Text>
                        <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                          {scholar.conversationCount} chats
                        </Text>
                      </VStack>
                    </HStack>
                  );
                })}
                {scholars.length === 0 && (
                  <VStack py={12} gap={4}>
                    <FiUsers size={32} color="#c1c1c1" />
                    <Text color="charcoal.400" fontFamily="heading" fontSize="sm">
                      No scholars enrolled yet
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Box>
            <Box flex={1} overflow="auto">
              {selectedScholarId ? (
                <ScholarProfile scholarId={selectedScholarId} />
              ) : (
                <Flex align="center" justify="center" h="full" color="charcoal.300">
                  <VStack gap={3}>
                    <FiUser size={48} />
                    <Text fontFamily="heading" fontSize="md">
                      Select a scholar to view their profile
                    </Text>
                  </VStack>
                </Flex>
              )}
            </Box>
          </>
        )}

        {/* Live View tab — real-time scholar cards */}
        {activeTab === "live" && (
          <Box flex={1} overflow="auto">
            {/* Focus Bar */}
            <FocusBar
              currentFocus={currentFocus ?? null}
              personas={personas}
              projects={projects}
              perspectives={perspectives}
              onSet={async (args) => { await setFocus(args); }}
              onClear={async () => { await clearFocus(); }}
            />

            <Box px={6} py={4}>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {scholars.map((scholar) => (
                  <ScholarCard key={scholar.id} scholar={scholar} />
                ))}
              </SimpleGrid>

              {scholars.length === 0 && (
                <VStack py={12} gap={4}>
                  <FiUsers size={48} color="#c1c1c1" />
                  <Text color="charcoal.400" fontFamily="heading">
                    No scholars enrolled yet
                  </Text>
                </VStack>
              )}
            </Box>
          </Box>
        )}

        {/* Entity management tabs */}
        {(activeTab === "projects" || activeTab === "personas" || activeTab === "perspectives") && (
          <Box flex={1} overflow="auto" px={6} py={4}>
            {activeTab === "projects" && <EntityManager entityType="project" />}
            {activeTab === "personas" && <EntityManager entityType="persona" />}
            {activeTab === "perspectives" && <EntityManager entityType="perspective" />}
          </Box>
        )}
      </Flex>
    </Flex>
  );
}

// Scholar Card Component
function ScholarCard({ scholar }: { scholar: Scholar }) {
  const remoteUrl = `/scholar?remote=${scholar.id}`;
  const score = scholar.progressScore;
  const cardBg = score === null
    ? "white"
    : score <= 1
      ? "red.50"
      : score <= 2
        ? "yellow.50"
        : score <= 3
          ? "white"
          : score <= 4
            ? "green.50"
            : "violet.50";
  const cardBorder = score === null
    ? "transparent"
    : score <= 1
      ? "red.200"
      : score <= 2
        ? "yellow.200"
        : score <= 3
          ? "transparent"
          : score <= 4
            ? "green.200"
            : "violet.200";

  return (
    <Card.Root
      bg={cardBg}
      shadow="sm"
      cursor="pointer"
      _hover={{ shadow: "md", borderColor: "violet.300" }}
      borderWidth="1px"
      borderColor={cardBorder}
      transition="all 0.15s"
      onClick={() => window.open(remoteUrl, "_blank")}
    >
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack gap={3}>
              <Avatar
                size="md"
                name={scholar.name}
                src={scholar.image || undefined}
              />
              <VStack gap={0} align="start" flex={1}>
                <HStack gap={1}>
                  <Text
                    fontWeight="600"
                    fontFamily="heading"
                    color="navy.500"
                    fontSize="md"
                  >
                    {scholar.name}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                  {scholar.email}
                </Text>
              </VStack>
          </HStack>

          <HStack
            gap={4}
            fontSize="sm"
            color="charcoal.400"
            fontFamily="heading"
          >
            <HStack gap={1}>
              <FiMessageSquare />
              <Text>{scholar.conversationCount} chats</Text>
            </HStack>
            <Text>{scholar.messageCount} messages</Text>
          </HStack>

          {scholar.lastMessage ? (
            <VStack align="stretch" gap={1}>
              <Text
                fontSize="sm"
                color="charcoal.600"
                fontFamily="heading"
                lineHeight="1.4"
              >
                {scholar.lastMessage}
              </Text>
              {scholar.statusSummary && (
                <Text
                  fontSize="xs"
                  color="charcoal.400"
                  fontFamily="heading"
                  fontStyle="italic"
                  lineHeight="1.3"
                >
                  {scholar.statusSummary}
                </Text>
              )}
            </VStack>
          ) : (
            <Text
              fontSize="sm"
              color="charcoal.300"
              fontFamily="heading"
              textAlign="center"
              py={2}
            >
              No activity yet
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

// Focus Bar Component
interface FocusEntity {
  _id: string;
  title: string;
  emoji?: string;
  icon?: string | null;
}

interface FocusBarProps {
  currentFocus: {
    personaId?: string | null;
    projectId?: string | null;
    perspectiveId?: string | null;
    isActive: boolean;
  } | null;
  personas: FocusEntity[];
  projects: FocusEntity[];
  perspectives: FocusEntity[];
  onSet: (args: {
    personaId?: Id<"personas">;
    projectId?: Id<"projects">;
    perspectiveId?: Id<"perspectives">;
  }) => void;
  onClear: () => void;
}

function FocusBar({ currentFocus, personas, projects, perspectives, onSet, onClear }: FocusBarProps) {
  const isActive = currentFocus?.isActive ?? false;
  const focusPersonaId = isActive ? currentFocus?.personaId ?? null : null;
  const focusProjectId = isActive ? currentFocus?.projectId ?? null : null;
  const focusPerspectiveId = isActive ? currentFocus?.perspectiveId ?? null : null;
  const hasFocus = focusPersonaId || focusProjectId || focusPerspectiveId;

  const activePersona = personas.find((p) => p._id === focusPersonaId);
  const activeProject = projects.find((p) => p._id === focusProjectId);
  const activePerspective = perspectives.find((p) => p._id === focusPerspectiveId);

  const handleSelect = (
    dim: "personaId" | "projectId" | "perspectiveId",
    value: string | null
  ) => {
    const args: Record<string, string | undefined> = {
      personaId: focusPersonaId ?? undefined,
      projectId: focusProjectId ?? undefined,
      perspectiveId: focusPerspectiveId ?? undefined,
    };
    args[dim] = value ?? undefined;
    onSet(args as {
      personaId?: Id<"personas">;
      projectId?: Id<"projects">;
      perspectiveId?: Id<"perspectives">;
    });
  };

  return (
    <Flex
      px={6}
      py={2}
      bg={hasFocus ? "violet.50" : "gray.50"}
      borderBottom="1px solid"
      borderColor={hasFocus ? "violet.200" : "gray.200"}
      align="center"
      gap={3}
      transition="all 0.15s"
    >
      <HStack gap={2} color={hasFocus ? "violet.600" : "charcoal.400"}>
        <TbFocusCentered size={18} />
        <Text fontFamily="heading" fontSize="sm" fontWeight="600" whiteSpace="nowrap">
          Current Focus:
        </Text>
      </HStack>

      {/* Persona dropdown */}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            size="xs"
            variant="outline"
            borderColor={focusPersonaId ? "violet.300" : "gray.300"}
            bg={focusPersonaId ? "violet.100" : "white"}
            color={focusPersonaId ? "violet.700" : "charcoal.500"}
            fontFamily="heading"
            fontSize="xs"
            fontWeight="500"
            _hover={{ bg: focusPersonaId ? "violet.200" : "gray.100" }}
          >
            {activePersona ? `${activePersona.emoji} ${activePersona.title}` : "Persona"}
            <FiChevronDown size={12} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="10rem">
              <Menu.RadioItemGroup
                value={focusPersonaId ?? "none"}
                onValueChange={(e) =>
                  handleSelect("personaId", e.value === "none" ? null : e.value)
                }
              >
                <Menu.RadioItem value="none">
                  <Box w="1.2em" display="inline-block" flexShrink={0} />
                  Free Choice
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
                {personas.map((p) => (
                  <Menu.RadioItem key={p._id} value={p._id}>
                    <Box w="1.2em" display="inline-block" flexShrink={0} textAlign="center">{p.emoji}</Box>
                    {p.title}
                    <Menu.ItemIndicator />
                  </Menu.RadioItem>
                ))}
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* Project dropdown */}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            size="xs"
            variant="outline"
            borderColor={focusProjectId ? "violet.300" : "gray.300"}
            bg={focusProjectId ? "violet.100" : "white"}
            color={focusProjectId ? "violet.700" : "charcoal.500"}
            fontFamily="heading"
            fontSize="xs"
            fontWeight="500"
            _hover={{ bg: focusProjectId ? "violet.200" : "gray.100" }}
          >
            {activeProject ? activeProject.title : "Project"}
            <FiChevronDown size={12} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="10rem">
              <Menu.RadioItemGroup
                value={focusProjectId ?? "none"}
                onValueChange={(e) =>
                  handleSelect("projectId", e.value === "none" ? null : e.value)
                }
              >
                <Menu.RadioItem value="none">
                  Free Choice
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
                {projects.map((p) => (
                  <Menu.RadioItem key={p._id} value={p._id}>
                    {p.title}
                    <Menu.ItemIndicator />
                  </Menu.RadioItem>
                ))}
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* Perspective dropdown */}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            size="xs"
            variant="outline"
            borderColor={focusPerspectiveId ? "violet.300" : "gray.300"}
            bg={focusPerspectiveId ? "violet.100" : "white"}
            color={focusPerspectiveId ? "violet.700" : "charcoal.500"}
            fontFamily="heading"
            fontSize="xs"
            fontWeight="500"
            _hover={{ bg: focusPerspectiveId ? "violet.200" : "gray.100" }}
          >
            {activePerspective
              ? `${activePerspective.icon || "🔍"} ${activePerspective.title}`
              : "Perspective"}
            <FiChevronDown size={12} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="12rem">
              <Menu.RadioItemGroup
                value={focusPerspectiveId ?? "none"}
                onValueChange={(e) =>
                  handleSelect("perspectiveId", e.value === "none" ? null : e.value)
                }
              >
                <Menu.RadioItem value="none">
                  <Box w="1.2em" display="inline-block" flexShrink={0} />
                  Free Choice
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
                {perspectives.map((p) => (
                  <Menu.RadioItem key={p._id} value={p._id}>
                    <Box w="1.2em" display="inline-block" flexShrink={0} textAlign="center">{p.icon || "🔍"}</Box>
                    {p.title}
                    <Menu.ItemIndicator />
                  </Menu.RadioItem>
                ))}
              </Menu.RadioItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* Clear Focus button */}
      {hasFocus && (
        <Button
          size="xs"
          variant="ghost"
          color="charcoal.400"
          fontFamily="heading"
          fontSize="xs"
          _hover={{ color: "red.500", bg: "red.50" }}
          onClick={() => onClear()}
        >
          <FiX style={{ marginRight: "4px" }} />
          Clear Focus
        </Button>
      )}
    </Flex>
  );
}
