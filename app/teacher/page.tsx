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
  Badge,
  Menu,
  Portal,
  Tooltip,
  Timeline,
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
  FiLayers,
  FiX,
  FiCheck,
} from "react-icons/fi";
import { TbFocusCentered } from "react-icons/tb";
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";
import { DimensionPicker } from "@/components/DimensionPicker";
import { AppLogo } from "@/components/AppLogo";

type Tab = "scholars" | "live" | "projects" | "personas" | "perspectives" | "processes";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
  { key: "live", label: "Conductor", icon: Lectern },
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "projects", label: "Projects", icon: FiBook },
  { key: "personas", label: "Personas", icon: FiSmile },
  { key: "perspectives", label: "Perspectives", icon: FiEye },
  { key: "processes", label: "Processes", icon: FiLayers },
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
  processStep: string | null;
  processTitle: string | null;
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
  const processes = useQuery(api.processes.list) ?? [];
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
      <Flex bg="white" borderBottom="1px solid" borderColor="gray.200" shadow="0 1px 3px rgba(0,0,0,0.06)" px={6} align="center">
        {/* Logo */}
        <Box mr={6}>
          <AppLogo variant="dark" size={28} />
        </Box>

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
          <LiveView
            scholars={scholars}
            currentFocus={currentFocus ?? null}
            personas={personas}
            projects={projects}
            perspectives={perspectives}
            processes={processes}
            onSetFocus={async (args) => { await setFocus(args); }}
            onClearFocus={async () => { await clearFocus(); }}
          />
        )}

        {/* Entity management tabs */}
        {(activeTab === "projects" || activeTab === "personas" || activeTab === "perspectives" || activeTab === "processes") && (
          <Box flex={1} overflow="auto" px={6} py={4}>
            {activeTab === "projects" && <EntityManager entityType="project" />}
            {activeTab === "personas" && <EntityManager entityType="persona" />}
            {activeTab === "perspectives" && <EntityManager entityType="perspective" />}
            {activeTab === "processes" && <EntityManager entityType="process" />}
          </Box>
        )}
      </Flex>
    </Flex>
  );
}

// Live View — Conductor with optional Racetrack panel
function LiveView({
  scholars,
  currentFocus,
  personas,
  projects,
  perspectives,
  processes,
  onSetFocus,
  onClearFocus,
}: {
  scholars: Scholar[];
  currentFocus: FocusBarProps["currentFocus"];
  personas: FocusEntity[];
  projects: FocusEntity[];
  perspectives: FocusEntity[];
  processes: FocusEntity[];
  onSetFocus: FocusBarProps["onSet"];
  onClearFocus: FocusBarProps["onClear"];
}) {
  const isActive = currentFocus?.isActive ?? false;
  const focusProcessId = isActive ? (currentFocus?.processId as Id<"processes"> | null) ?? null : null;

  const racetrackData = useQuery(
    api.processState.getRacetrackData,
    focusProcessId ? { processId: focusProcessId } : "skip"
  );

  return (
    <Flex flex={1} direction="column" overflow="hidden">
      <FocusBar
        currentFocus={currentFocus}
        personas={personas}
        projects={projects}
        perspectives={perspectives}
        processes={processes}
        onSet={onSetFocus}
        onClear={onClearFocus}
      />

      <Flex flex={1} overflow="hidden">
        <Box flex={1} overflow="auto" px={6} py={4}>
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

        {racetrackData && <RacetrackPanel data={racetrackData} />}
      </Flex>
    </Flex>
  );
}

// Racetrack Panel — shows scholar progress on focused process steps
function RacetrackPanel({
  data,
}: {
  data: {
    process: {
      title: string;
      emoji: string | null;
      steps: { key: string; title: string; description?: string }[];
    };
    scholars: { id: string; name: string | null; image: string | null; currentStep: string }[];
  };
}) {
  const { process, scholars } = data;

  // Group scholars by their current step
  const scholarsByStep: Record<string, typeof scholars> = {};
  for (const scholar of scholars) {
    if (!scholarsByStep[scholar.currentStep]) {
      scholarsByStep[scholar.currentStep] = [];
    }
    scholarsByStep[scholar.currentStep].push(scholar);
  }

  return (
    <Box
      w="260px"
      minW="260px"
      bg="white"
      borderLeft="1px solid"
      borderColor="gray.200"
      overflow="auto"
    >
      {/* Header */}
      <HStack px={4} py={3} gap={2}>
        <Text fontSize="lg">{process.emoji || "📋"}</Text>
        <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500">
          {process.title}
        </Text>
      </HStack>

      {/* Steps */}
      <Box px={4} pb={3}>
        <Timeline.Root size="md">
          {process.steps.map((step) => {
            const scholarsAtStep = scholarsByStep[step.key] || [];
            const hasScholars = scholarsAtStep.length > 0;
            return (
              <Timeline.Item key={step.key}>
                <Timeline.Connector>
                  <Timeline.Separator />
                  <Timeline.Indicator
                    bg={hasScholars ? "violet.500" : "gray.200"}
                    borderColor={hasScholars ? "violet.500" : "gray.200"}
                    color={hasScholars ? "white" : "charcoal.400"}
                  >
                    <Text
                      fontSize="10px"
                      fontWeight="700"
                      fontFamily="heading"
                      lineHeight="1"
                      color={hasScholars ? "white" : "charcoal.400"}
                    >
                      {step.key}
                    </Text>
                  </Timeline.Indicator>
                </Timeline.Connector>
                <Timeline.Content>
                  <Timeline.Title
                    fontFamily="heading"
                    fontSize="sm"
                    fontWeight={hasScholars ? "600" : "400"}
                    color={hasScholars ? "navy.500" : "charcoal.300"}
                  >
                    {step.title}
                  </Timeline.Title>
                  {hasScholars && (
                    <Flex wrap="wrap" gap={1} mt={1}>
                      {scholarsAtStep.map((s) => (
                        <Tooltip.Root key={s.id} openDelay={200} closeDelay={0}>
                          <Tooltip.Trigger asChild>
                            <a
                              href={`/scholar?remote=${s.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ cursor: "pointer" }}
                            >
                              <Avatar
                                size="xs"
                                name={s.name || undefined}
                                src={s.image || undefined}
                              />
                            </a>
                          </Tooltip.Trigger>
                          <Portal>
                            <Tooltip.Positioner>
                              <Tooltip.Content>
                                {s.name || "Scholar"}
                              </Tooltip.Content>
                            </Tooltip.Positioner>
                          </Portal>
                        </Tooltip.Root>
                      ))}
                    </Flex>
                  )}
                </Timeline.Content>
              </Timeline.Item>
            );
          })}
        </Timeline.Root>
      </Box>
    </Box>
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
              {scholar.processTitle && scholar.processStep && (
                <Badge bg="violet.100" color="violet.700" fontFamily="heading" fontSize="xs" flexShrink={0}>
                  {scholar.processTitle}: {scholar.processStep}
                </Badge>
              )}
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
    processId?: string | null;
    isActive: boolean;
  } | null;
  personas: FocusEntity[];
  projects: FocusEntity[];
  perspectives: FocusEntity[];
  processes: FocusEntity[];
  onSet: (args: {
    personaId?: Id<"personas">;
    projectId?: Id<"projects">;
    perspectiveId?: Id<"perspectives">;
    processId?: Id<"processes">;
  }) => void;
  onClear: () => void;
}

function FocusBar({ currentFocus, personas, projects, perspectives, processes, onSet, onClear }: FocusBarProps) {
  const isActive = currentFocus?.isActive ?? false;
  const focusPersonaId = isActive ? currentFocus?.personaId ?? null : null;
  const focusProjectId = isActive ? currentFocus?.projectId ?? null : null;
  const focusPerspectiveId = isActive ? currentFocus?.perspectiveId ?? null : null;
  const focusProcessId = isActive ? currentFocus?.processId ?? null : null;
  const hasFocus = focusPersonaId || focusProjectId || focusPerspectiveId || focusProcessId;

  const handleSelect = (
    dim: "personaId" | "projectId" | "perspectiveId" | "processId",
    value: string | null
  ) => {
    const args: Record<string, string | undefined> = {
      personaId: focusPersonaId ?? undefined,
      projectId: focusProjectId ?? undefined,
      perspectiveId: focusPerspectiveId ?? undefined,
      processId: focusProcessId ?? undefined,
    };
    args[dim] = value ?? undefined;
    onSet(args as {
      personaId?: Id<"personas">;
      projectId?: Id<"projects">;
      perspectiveId?: Id<"perspectives">;
      processId?: Id<"processes">;
    });
  };

  const personaOptions = personas.map((p) => ({ id: p._id, title: p.title, emoji: p.emoji }));
  const projectOptions = projects.map((p) => ({ id: p._id, title: p.title }));
  const perspectiveOptions = perspectives.map((p) => ({ id: p._id, title: p.title, icon: p.icon }));
  const processOptions = processes.map((p) => ({ id: p._id, title: p.title, emoji: p.emoji }));

  return (
    <Flex
      px={6}
      py={2}
      bg={hasFocus ? "violet.50" : "gray.50"}
      borderBottom="1px solid"
      borderColor={hasFocus ? "violet.200" : "gray.200"}
      shadow="0 1px 3px rgba(0,0,0,0.04)"
      align="center"
      gap={3}
      transition="all 0.15s"
    >
      <HStack gap={2} color={hasFocus ? "violet.600" : "charcoal.400"} flexShrink={0}>
        <TbFocusCentered size={18} />
        <Text fontFamily="heading" fontSize="sm" fontWeight="600" whiteSpace="nowrap">
          Current Focus:
        </Text>
      </HStack>

      <Flex gap={7} align="center" flexWrap="wrap">
        <DimensionPicker
          label="Persona"
          defaultLabel="Free Choice"
          activeId={focusPersonaId}
          options={personaOptions}
          onChange={(id) => handleSelect("personaId", id)}
          renderOption={(p) => `${p.emoji || "🤖"} ${p.title}`}
          renderActive={() => {
            const active = personas.find((p) => p._id === focusPersonaId);
            return active ? `${active.emoji} ${active.title}` : null;
          }}
        />
        <DimensionPicker
          label="Project"
          defaultLabel="Free Choice"
          activeId={focusProjectId}
          options={projectOptions}
          onChange={(id) => handleSelect("projectId", id)}
          renderOption={(p) => `📚 ${p.title}`}
          renderActive={() => {
            const active = projects.find((p) => p._id === focusProjectId);
            return active ? `📚 ${active.title}` : null;
          }}
        />
        <DimensionPicker
          label="Lens"
          defaultLabel="Free Choice"
          activeId={focusPerspectiveId}
          options={perspectiveOptions}
          onChange={(id) => handleSelect("perspectiveId", id)}
          renderOption={(p) => `${p.icon || "🔍"} ${p.title}`}
          renderActive={() => {
            const active = perspectives.find((p) => p._id === focusPerspectiveId);
            return active ? `${active.icon || "🔍"} ${active.title}` : null;
          }}
        />
        <DimensionPicker
          label="Process"
          defaultLabel="Free Choice"
          activeId={focusProcessId}
          options={processOptions}
          onChange={(id) => handleSelect("processId", id)}
          renderOption={(p) => `${p.emoji || "📋"} ${p.title}`}
          renderActive={() => {
            const active = processes.find((p) => p._id === focusProcessId);
            return active ? `${active.emoji || "📋"} ${active.title}` : null;
          }}
        />
      </Flex>

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
          flexShrink={0}
        >
          <FiX style={{ marginRight: "4px" }} />
          Clear Focus
        </Button>
      )}
    </Flex>
  );
}
