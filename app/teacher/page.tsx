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
  Portal,
  Tooltip,
  Timeline,
  Input,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import { AccountMenu } from "@/components/AccountMenu";
import {
  FiUsers,
  FiMessageSquare,
  FiUser,
  FiBook,
  FiSmile,
  FiEye,
  FiLayers,
  FiX,
  FiCheck,
  FiLink,
  FiPlus,
} from "react-icons/fi";
import { TbFocusCentered } from "react-icons/tb";
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";
import { DimensionPicker } from "@/components/DimensionPicker";
import { DimensionEditModal } from "@/components/DimensionEditModal";
import type { DimensionType, DimensionEditData } from "@/components/DimensionEditModal";
import { AppLogo } from "@/components/AppLogo";
import { StatusOrb } from "@/components/StatusOrb";
import { buildDimensionParams } from "@/lib/dimensions";

type Tab = "scholars" | "live" | "units" | "personas" | "perspectives" | "processes";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
  { key: "live", label: "Conductor", icon: Lectern },
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "units", label: "Units", icon: FiBook },
  { key: "personas", label: "Personas", icon: FiSmile },
  { key: "perspectives", label: "Perspectives", icon: FiEye },
  { key: "processes", label: "Processes", icon: FiLayers },
];

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

interface Scholar {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  projectCount: number;
  messageCount: number;
  lastActive: number;
  statusSummary: string | null;
  pulseScore: number | null;
  lastMessage: string | null;
  lastMessageAt: number | null;
  lastProjectTitle: string | null;
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
  const [isAddingScholar, setIsAddingScholar] = useState(false);
  const [newScholarName, setNewScholarName] = useState("");
  const createScholar = useMutation(api.users.createScholar);

  // Focus mode data
  const personas = useQuery(api.personas.list) ?? [];
  const units = useQuery(api.units.list) ?? [];
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
        <Box ml="auto">
          <AccountMenu
            userName={user?.name || "Teacher"}
            userImage={user?.image || undefined}
            onSignOut={() => {
              signOut();
              router.push("/login");
            }}
          />
        </Box>
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
                {/* Add Scholar */}
                <HStack px={4} py={2} borderBottom="1px solid" borderColor="gray.100">
                  {isAddingScholar ? (
                    <HStack flex={1} gap={1}>
                      <Input
                        size="sm"
                        placeholder="Scholar name"
                        value={newScholarName}
                        onChange={(e) => setNewScholarName(e.target.value)}
                        fontFamily="heading"
                        fontSize="sm"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newScholarName.trim()) {
                            const result = await createScholar({ name: newScholarName.trim() });
                            setNewScholarName("");
                            setIsAddingScholar(false);
                            setSelectedScholarId(result.userId);
                          }
                          if (e.key === "Escape") {
                            setNewScholarName("");
                            setIsAddingScholar(false);
                          }
                        }}
                      />
                      <IconButton
                        aria-label="Create scholar"
                        size="xs"
                        variant="ghost"
                        color="violet.500"
                        _hover={{ bg: "violet.50" }}
                        disabled={!newScholarName.trim()}
                        onClick={async () => {
                          if (!newScholarName.trim()) return;
                          const result = await createScholar({ name: newScholarName.trim() });
                          setNewScholarName("");
                          setIsAddingScholar(false);
                          setSelectedScholarId(result.userId);
                        }}
                      >
                        <FiCheck />
                      </IconButton>
                      <IconButton
                        aria-label="Cancel"
                        size="xs"
                        variant="ghost"
                        color="charcoal.400"
                        _hover={{ bg: "gray.100" }}
                        onClick={() => {
                          setNewScholarName("");
                          setIsAddingScholar(false);
                        }}
                      >
                        <FiX />
                      </IconButton>
                    </HStack>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      color="violet.500"
                      fontFamily="heading"
                      fontSize="xs"
                      _hover={{ bg: "violet.50" }}
                      onClick={() => setIsAddingScholar(true)}
                      w="full"
                      justifyContent="flex-start"
                    >
                      <FiPlus style={{ marginRight: "6px" }} />
                      New Scholar
                    </Button>
                  )}
                </HStack>

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
                          {scholar.projectCount} projects
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
            units={units}
            perspectives={perspectives}
            processes={processes}
            onSetFocus={async (args) => { await setFocus(args); }}
            onClearFocus={async () => { await clearFocus(); }}
          />
        )}

        {/* Entity management tabs */}
        {(activeTab === "units" || activeTab === "personas" || activeTab === "perspectives" || activeTab === "processes") && (
          <Box flex={1} overflow="auto" px={6} py={4}>
            {activeTab === "units" && <EntityManager entityType="unit" />}
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
  units,
  perspectives,
  processes,
  onSetFocus,
  onClearFocus,
}: {
  scholars: Scholar[];
  currentFocus: FocusBarProps["currentFocus"];
  personas: FocusEntity[];
  units: FocusEntity[];
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
        units={units}
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

  return (
    <Card.Root
      bg="white"
      shadow="sm"
      cursor="pointer"
      _hover={{ shadow: "md", borderColor: "violet.300" }}
      borderWidth="1px"
      borderColor="transparent"
      transition="all 0.15s"
      onClick={() => window.open(remoteUrl, "_blank")}
    >
      <Card.Body p={4} position="relative">
        <Box position="absolute" top={3} right={3}>
          <StatusOrb
            pulseScore={scholar.pulseScore}
            lastMessageAt={scholar.lastMessageAt}
            size="lg"
          />
        </Box>
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

          {scholar.lastMessage ? (
            <VStack align="stretch" gap={1.5}>
              {scholar.lastProjectTitle && (
                <HStack gap={1.5}>
                  <FiMessageSquare size={12} color="var(--chakra-colors-charcoal-300)" />
                  <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                    {scholar.lastProjectTitle}
                    {scholar.lastMessageAt && (
                      <Text as="span" color="charcoal.300"> · {timeAgo(scholar.lastMessageAt)}</Text>
                    )}
                  </Text>
                </HStack>
              )}
              <Text
                fontSize="sm"
                color="charcoal.600"
                fontFamily="body"
                lineHeight="1.4"
                overflow="hidden"
                css={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
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
  slug?: string;
  emoji?: string;
  icon?: string | null;
  description?: string;
  systemPrompt?: string;
  rubric?: string;
  targetBloomLevel?: string;
  steps?: { key: string; title: string; description?: string }[];
}

interface FocusBarProps {
  currentFocus: {
    personaId?: string | null;
    unitId?: string | null;
    perspectiveId?: string | null;
    processId?: string | null;
    isActive: boolean;
  } | null;
  personas: FocusEntity[];
  units: FocusEntity[];
  perspectives: FocusEntity[];
  processes: FocusEntity[];
  onSet: (args: {
    personaId?: Id<"personas">;
    unitId?: Id<"units">;
    perspectiveId?: Id<"perspectives">;
    processId?: Id<"processes">;
  }) => void;
  onClear: () => void;
}

function FocusBar({ currentFocus, personas, units, perspectives, processes, onSet, onClear }: FocusBarProps) {
  const isActive = currentFocus?.isActive ?? false;
  const focusPersonaId = isActive ? currentFocus?.personaId ?? null : null;
  const focusUnitId = isActive ? currentFocus?.unitId ?? null : null;
  const focusPerspectiveId = isActive ? currentFocus?.perspectiveId ?? null : null;
  const focusProcessId = isActive ? currentFocus?.processId ?? null : null;
  const hasFocus = focusPersonaId || focusUnitId || focusPerspectiveId || focusProcessId;
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    const dimParams = buildDimensionParams(
      { personaId: focusPersonaId, unitId: focusUnitId, perspectiveId: focusPerspectiveId, processId: focusProcessId },
      { personas, units, perspectives, processes }
    );
    const url = `${window.location.origin}/scholar/new${dimParams ? `?${dimParams}` : ""}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    type: DimensionType;
    data: DimensionEditData | null;
  } | null>(null);

  const openEdit = (type: DimensionType, id: string | null, entities: FocusEntity[]) => {
    if (!id) return;
    const item = entities.find((e) => e._id === id);
    if (item) setEditModal({ type, data: item as DimensionEditData });
  };

  const handleSelect = (
    dim: "personaId" | "unitId" | "perspectiveId" | "processId",
    value: string | null
  ) => {
    const args: Record<string, string | undefined> = {
      personaId: focusPersonaId ?? undefined,
      unitId: focusUnitId ?? undefined,
      perspectiveId: focusPerspectiveId ?? undefined,
      processId: focusProcessId ?? undefined,
    };
    args[dim] = value ?? undefined;
    onSet(args as {
      personaId?: Id<"personas">;
      unitId?: Id<"units">;
      perspectiveId?: Id<"perspectives">;
      processId?: Id<"processes">;
    });
  };

  const personaOptions = personas.map((p) => ({ id: p._id, title: p.title, emoji: p.emoji }));
  const unitOptions = units.map((p) => ({ id: p._id, title: p.title }));
  const perspectiveOptions = perspectives.map((p) => ({ id: p._id, title: p.title, icon: p.icon }));
  const processOptions = processes.map((p) => ({ id: p._id, title: p.title, emoji: p.emoji }));

  return (
    <Flex
      px={6}
      py={2}
      bg="violet.50"
      borderTop="0.5px solid"
      borderBottom="0.5px solid"
      borderColor="violet.200"
      shadow="0 2px 4px rgba(0,0,0,0.06)"
      align="center"
      gap={3}
      transition="all 0.15s"
    >
      <HStack gap={2} color="violet.600" flexShrink={0}>
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
          onEdit={(id) => openEdit("persona", id, personas)}
        />
        <DimensionPicker
          label="Unit"
          defaultLabel="Free Choice"
          activeId={focusUnitId}
          options={unitOptions}
          onChange={(id) => handleSelect("unitId", id)}
          renderOption={(p) => `📚 ${p.title}`}
          renderActive={() => {
            const active = units.find((p) => p._id === focusUnitId);
            return active ? `📚 ${active.title}` : null;
          }}
          onEdit={(id) => openEdit("unit", id, units)}
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
          onEdit={(id) => openEdit("perspective", id, perspectives)}
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
          onEdit={(id) => openEdit("process", id, processes)}
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

      <Box flex={1} />

      {/* Copy Link button — right-aligned */}
      {hasFocus && (
        <Button
          size="xs"
          variant="ghost"
          color="violet.500"
          fontFamily="heading"
          fontSize="xs"
          _hover={{ bg: "violet.100" }}
          onClick={handleCopyLink}
          flexShrink={0}
        >
          {linkCopied ? (
            <><FiCheck style={{ marginRight: "4px" }} />Copied!</>
          ) : (
            <><FiLink style={{ marginRight: "4px" }} />Copy Link</>
          )}
        </Button>
      )}

      {editModal && (
        <DimensionEditModal
          open={!!editModal}
          onClose={() => setEditModal(null)}
          dimensionType={editModal.type}
          data={editModal.data}
        />
      )}
    </Flex>
  );
}
