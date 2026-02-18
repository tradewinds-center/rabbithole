"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Spinner,
  Badge,
  Portal,
  Tooltip,
  Timeline,
  Input,
  Tabs,
  Dialog,
  ProgressCircle,
  AbsoluteCenter,
  Popover,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import { AccountMenu } from "@/components/AccountMenu";
import {
  FiUsers,
  FiUser,
  FiBook,
  FiSmile,
  FiEye,
  FiLayers,
  FiX,
  FiCheck,
  FiLink,
  FiLock,
  FiUnlock,
  FiPlus,
  FiCopy,
  FiCpu,
  FiCompass,
  FiExternalLink,
} from "react-icons/fi";
import dynamic from "next/dynamic";

const CurriculumAssistant = dynamic(() => import("@/components/CurriculumAssistant"), { ssr: false });
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";
import type { ScholarTabKey } from "@/components";
import { AppLogo } from "@/components/AppLogo";
import { StatusOrb } from "@/components/StatusOrb";
import { buildDimensionParams } from "@/lib/dimensions";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

type Tab = "scholars" | "live" | "curriculum" | "assistant";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
  { key: "live", label: "Classroom", icon: Lectern },
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "curriculum", label: "Curriculum", icon: FiBook },
  { key: "assistant", label: "Assistant", icon: FiCpu },
];

type CurriculumSubTab = "units" | "personas" | "perspectives" | "processes";

const CURRICULUM_SUB_TABS: { key: CurriculumSubTab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
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
  readingLevel: string | null;
  dateOfBirth: string | null;
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

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function TeacherDashboardInner() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const scholars = useQuery(api.users.listScholars) ?? [];
  const searchParams = useSearchParams();

  // Derive tab state from URL
  const VALID_TABS: Tab[] = ["live", "scholars", "curriculum", "assistant"];
  const VALID_SUB_TABS: CurriculumSubTab[] = ["units", "personas", "perspectives", "processes"];
  const VALID_SCHOLAR_TABS: ScholarTabKey[] = ["dossier", "mastery", "standards", "seeds", "strengths", "documents", "observations", "reports", "reading"];
  const rawTab = searchParams.get("tab");
  const rawSub = searchParams.get("sub");
  const rawScholar = searchParams.get("scholar");
  const rawStab = searchParams.get("stab");
  const rawUnit = searchParams.get("unit");
  const activeTab: Tab = VALID_TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "live";
  const curriculumSubTab: CurriculumSubTab = VALID_SUB_TABS.includes(rawSub as CurriculumSubTab) ? (rawSub as CurriculumSubTab) : "units";
  const selectedScholarId: string | null = activeTab === "scholars" && rawScholar ? rawScholar : null;
  const scholarSubTab: ScholarTabKey = VALID_SCHOLAR_TABS.includes(rawStab as ScholarTabKey) ? (rawStab as ScholarTabKey) : "dossier";
  const selectedUnitId: string | null = activeTab === "live" ? rawUnit : null;

  const pushUrl = useCallback((params: URLSearchParams) => {
    const qs = params.toString();
    router.push(`/teacher${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  const setActiveTab = useCallback((tab: Tab) => {
    const params = new URLSearchParams();
    if (tab !== "live") params.set("tab", tab);
    if (tab === "curriculum") params.set("sub", "units");
    pushUrl(params);
  }, [pushUrl]);

  const setCurriculumSubTab = useCallback((sub: CurriculumSubTab) => {
    const params = new URLSearchParams();
    params.set("tab", "curriculum");
    if (sub !== "units") params.set("sub", sub);
    pushUrl(params);
  }, [pushUrl]);

  const setSelectedScholarId = useCallback((id: string | null) => {
    const params = new URLSearchParams();
    params.set("tab", "scholars");
    if (id) params.set("scholar", id);
    pushUrl(params);
  }, [pushUrl]);

  const setScholarSubTab = useCallback((stab: ScholarTabKey) => {
    const params = new URLSearchParams();
    params.set("tab", "scholars");
    if (selectedScholarId) params.set("scholar", selectedScholarId);
    if (stab !== "dossier") params.set("stab", stab);
    pushUrl(params);
  }, [pushUrl, selectedScholarId]);

  const setSelectedUnitId = useCallback((unitId: string | null) => {
    const params = new URLSearchParams();
    // tab=live is default so no need to set it
    if (unitId) params.set("unit", unitId);
    pushUrl(params);
  }, [pushUrl]);

  const [isAddingScholar, setIsAddingScholar] = useState(false);
  const [newScholarName, setNewScholarName] = useState("");
  const createScholar = useMutation(api.users.createScholar);

  // Focus mode data & curriculum counts
  const units = useQuery(api.units.list) ?? [];
  const personas = useQuery(api.personas.list) ?? [];
  const perspectives = useQuery(api.perspectives.list) ?? [];
  const processes = useQuery(api.processes.list) ?? [];
  const curriculumCounts: Record<CurriculumSubTab, number> = {
    units: units.length,
    personas: personas.length,
    perspectives: perspectives.length,
    processes: processes.length,
  };
  const currentFocus = useQuery(api.focus.getCurrent);
  const setFocus = useMutation(api.focus.set);
  const clearFocus = useMutation(api.focus.clear);

  // Activity view data
  const activityData = useQuery(api.projects.listActiveByUnit);

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
        <Tabs.Root
          value={activeTab}
          onValueChange={(e) => setActiveTab(e.value as Tab)}
          variant="plain"
          fitted={false}
          size="lg"
        >
          <Tabs.List borderBottom="none" gap={0}>
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <Tabs.Trigger
                  key={tab.key}
                  value={tab.key}
                  fontFamily="heading"
                  fontSize="sm"
                  px={5}
                  py={3}
                  color="charcoal.400"
                  _selected={{ color: "violet.600", fontWeight: "600" }}
                >
                  <TabIcon style={{ marginRight: "6px" }} size={16} />
                  {tab.label}
                </Tabs.Trigger>
              );
            })}
            <Tabs.Indicator rounded="none" bg="violet.500" h="2px" bottom="0" />
          </Tabs.List>
        </Tabs.Root>

        {/* Account menu */}
        <Box ml="auto">
          <AccountMenu
            userName={user?.name || "Teacher"}
            userImage={user?.image || undefined}
            isAdmin={user?.role === "admin"}
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
                    <HStack flex={1} gap={0}>
                      <Button
                        size="sm"
                        variant="ghost"
                        color="violet.500"
                        fontFamily="heading"
                        fontSize="xs"
                        _hover={{ bg: "violet.50" }}
                        onClick={() => setIsAddingScholar(true)}
                        flex={1}
                        justifyContent="flex-start"
                      >
                        <FiPlus style={{ marginRight: "6px" }} />
                        New Scholar
                      </Button>
                      <Tooltip.Root openDelay={300} closeDelay={0}>
                        <Tooltip.Trigger asChild>
                          <IconButton
                            aria-label="Copy Test Link"
                            size="xs"
                            variant="ghost"
                            color="charcoal.400"
                            _hover={{ color: "violet.500", bg: "violet.50" }}
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/login`);
                            }}
                          >
                            <FiCopy />
                          </IconButton>
                        </Tooltip.Trigger>
                        <Portal>
                          <Tooltip.Positioner>
                            <Tooltip.Content>Copy Test Link</Tooltip.Content>
                          </Tooltip.Positioner>
                        </Portal>
                      </Tooltip.Root>
                    </HStack>
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
                <ScholarProfile
                  scholarId={selectedScholarId}
                  activeTab={scholarSubTab}
                  onTabChange={setScholarSubTab}
                  onDelete={() => setSelectedScholarId(null)}
                />
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

        {/* Activity View tab — unit-organized conductor */}
        {activeTab === "live" && (
          <ActivityView
            activityData={activityData ?? null}
            units={units}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
            currentFocus={currentFocus ?? null}
            onSetFocus={async (args) => { await setFocus(args); }}
            onClearFocus={async () => { await clearFocus(); }}
          />
        )}

        {/* Curriculum tab — sub-tabs for Units, Personas, Perspectives, Processes */}
        {activeTab === "curriculum" && (
          <Flex flex={1} direction="column" overflow="hidden">
            <Tabs.Root
              mt={3}
              value={curriculumSubTab}
              onValueChange={(e) => setCurriculumSubTab(e.value as CurriculumSubTab)}
              variant="subtle"
              fitted={false}
              size="lg"
            >
              <Tabs.List
                px={6}
                gap={0}
              >
                {CURRICULUM_SUB_TABS.map((sub) => {
                  const SubIcon = sub.icon;
                  return (
                    <Tabs.Trigger
                      key={sub.key}
                      value={sub.key}
                      fontFamily="heading"
                      fontSize="xs"
                      px={4}
                      py={2}
                      color="charcoal.400"
                    >
                      <SubIcon style={{ marginRight: "5px" }} size={14} />
                      {sub.label}
                      <Badge
                        ml={1.5}
                        bg="gray.100"
                        color="charcoal.500"
                        fontFamily="heading"
                        fontSize="2xs"
                        px={1.5}
                        minW="20px"
                        textAlign="center"
                      >
                        {curriculumCounts[sub.key]}
                      </Badge>
                    </Tabs.Trigger>
                  );
                })}
              </Tabs.List>
            </Tabs.Root>
            <Box flex={1} overflow="auto" px={6} py={4}>
              <EntityManager entityType={curriculumSubTab === "units" ? "unit" : curriculumSubTab === "personas" ? "persona" : curriculumSubTab === "perspectives" ? "perspective" : "process"} hideHeader />
            </Box>
          </Flex>
        )}

        {/* Assistant tab — AI curriculum design chat */}
        {activeTab === "assistant" && (
          <CurriculumAssistant />
        )}
      </Flex>
    </Flex>
  );
}

// ── Activity View ─────────────────────────────────────────────────────

type ActivityData = {
  unitGroups: {
    unitId: Id<"units">;
    unitTitle: string;
    unitEmoji: string | null;
    unitDescription: string | null;
    processId: Id<"processes"> | null;
    process: {
      title: string;
      emoji: string | null;
      steps: { key: string; title: string; description?: string }[];
    } | null;
    durationMinutes: number | null;
    scholars: ScholarInActivity[];
  }[];
  unassigned: { scholars: ScholarInActivity[] };
};

type ScholarInActivity = {
  scholarId: Id<"users">;
  projectId: Id<"projects">;
  projectCreatedAt: number;
  name: string | null;
  image: string | null;
  readingLevel: string | null;
  dateOfBirth: string | null;
  pulseScore: number | null;
  lastMessageAt: number | null;
  lastMessageContent: string | null;
  lastMessageRole: string | null;
  processStep: string | null;
  projectTitle: string;
  analysisSummary: string | null;
};

type UnitInfo = {
  _id: string;
  title: string;
  slug?: string;
  emoji?: string;
  description?: string;
  processId?: string | null;
  durationMinutes?: number;
};

function ActivityView({
  activityData,
  units,
  selectedUnitId,
  onSelectUnit,
  currentFocus,
  onSetFocus,
  onClearFocus,
}: {
  activityData: ActivityData | null;
  units: UnitInfo[];
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
  currentFocus: {
    unitId?: string | null;
    scholarIds?: string[] | null;
    endsAt?: number | null;
    _creationTime?: number;
    isActive: boolean;
  } | null;
  onSetFocus: (args: { unitId?: Id<"units">; scholarIds?: Id<"users">[]; endsAt?: number }) => void;
  onClearFocus: () => void;
}) {
  const isActive = currentFocus?.isActive ?? false;
  const focusUnitId = isActive ? currentFocus?.unitId ?? null : null;

  // Mutations for drag-and-drop
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const moveStep = useMutation(api.processState.teacherMoveStep);

  // The focused unit's data (if any), filtered to only scholars assigned during this activity
  const activityStartedAt = currentFocus?._creationTime ?? 0;
  const focusedGroup = useMemo(() => {
    if (!activityData || !focusUnitId) return null;
    const group = activityData.unitGroups.find(
      (g) => String(g.unitId) === focusUnitId
    );
    if (!group) return null;
    // Only include scholars whose projects were created after the activity started
    return {
      ...group,
      scholars: group.scholars.filter(
        (s) => s.projectCreatedAt >= activityStartedAt
      ),
    };
  }, [activityData, focusUnitId, activityStartedAt]);

  // "Unassigned" = all active scholars NOT in the focused unit
  const unassignedScholars = useMemo(() => {
    if (!activityData) return [];
    const focusedScholarIds = new Set(
      focusedGroup?.scholars.map((s) => String(s.scholarId)) ?? []
    );
    const all: ScholarInActivity[] = [];
    for (const group of activityData.unitGroups) {
      if (focusUnitId && String(group.unitId) === focusUnitId) continue;
      all.push(...group.scholars);
    }
    all.push(...activityData.unassigned.scholars);
    const seen = new Set<string>();
    return all.filter((s) => {
      const id = String(s.scholarId);
      if (seen.has(id) || focusedScholarIds.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [activityData, focusedGroup, focusUnitId]);

  // Find selected group for detail panel
  const selectedGroup = useMemo(() => {
    if (!selectedUnitId) return null;
    if (selectedUnitId === "__unassigned") {
      return { type: "unassigned" as const, scholars: unassignedScholars };
    }
    if (focusedGroup && selectedUnitId === focusUnitId) {
      return { type: "unit" as const, data: focusedGroup };
    }
    return null;
  }, [selectedUnitId, focusedGroup, focusUnitId, unassignedScholars]);

  // ── Drag and Drop ──
  const [activeScholar, setActiveScholar] = useState<ScholarInActivity | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  // Track scholars that were just dropped so we can hide them until Convex re-renders
  const [droppedIds, setDroppedIds] = useState<Set<string>>(new Set());
  // Clear droppedIds whenever activityData changes (mutation result arrived)
  const prevActivityRef = useRef(activityData);
  useEffect(() => {
    if (activityData !== prevActivityRef.current) {
      prevActivityRef.current = activityData;
      setDroppedIds(new Set());
    }
  }, [activityData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { scholar: ScholarInActivity; source: string } | undefined;
    if (data) {
      setActiveScholar(data.scholar);
      setDragSource(data.source);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { over } = event;
    const scholar = activeScholar;
    const src = dragSource;
    setActiveScholar(null);
    setDragSource(null);

    if (!over || !scholar) return;
    const dropTarget = over.id as string;

    // Dragging from unassigned → focused activity
    if (src === "__unassigned" && dropTarget === focusUnitId) {
      setDroppedIds((prev) => new Set(prev).add(String(scholar.scholarId)));
      await createProject({
        userId: scholar.scholarId,
        unitId: focusUnitId as Id<"units">,
      });
    }
    // Dragging from focused activity → unassigned
    else if (src === focusUnitId && dropTarget === "__unassigned") {
      setDroppedIds((prev) => new Set(prev).add(String(scholar.scholarId)));
      await updateProject({
        id: scholar.projectId,
        unitId: null,
      });
    }
    // Dragging between process steps
    else if (dropTarget.startsWith("step-")) {
      const stepKey = dropTarget.slice(5);
      setDroppedIds((prev) => new Set(prev).add(String(scholar.scholarId)));
      await moveStep({
        projectId: scholar.projectId,
        stepKey,
      });
    }
  }, [activeScholar, dragSource, focusUnitId, createProject, updateProject, moveStep]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Flex flex={1} overflow="hidden">
        {/* Sidebar */}
        <ActivitySidebar
          units={units}
          focusedGroup={focusedGroup}
          focusUnitId={focusUnitId}
          unassignedCount={unassignedScholars.length}
          selectedUnitId={selectedUnitId}
          onSelectUnit={onSelectUnit}
          currentFocus={currentFocus}
          onStartActivity={(unitId, durationMin) => {
            const endsAt = durationMin ? Date.now() + durationMin * 60_000 : undefined;
            onSetFocus({ unitId: unitId as Id<"units">, endsAt });
            onSelectUnit(unitId);
          }}
          onStopActivity={() => {
            onClearFocus();
            onSelectUnit(null);
          }}
          isDragging={!!activeScholar}
          dragSource={dragSource}
        />

        {/* Detail Panel */}
        <Box flex={1} overflow="auto">
          {!selectedGroup ? (
            <Flex align="center" justify="center" h="full" color="charcoal.300">
              <VStack gap={3}>
                <Lectern size={48} />
                <Text fontFamily="heading" fontSize="md">
                  {focusUnitId ? "Select an activity to see scholar progress" : "Start an activity to begin"}
                </Text>
              </VStack>
            </Flex>
          ) : selectedGroup.type === "unassigned" ? (
            <Box p={6}>
              <HStack mb={4} pb={4} borderBottom="1px solid" borderColor="gray.200" gap={3}>
                <Box color="charcoal.400"><FiCompass size={24} /></Box>
                <Text fontFamily="heading" fontWeight="700" fontSize="lg" color="navy.500">
                  Unassigned
                </Text>
              </HStack>
              {selectedGroup.scholars.length > 0 ? (
                <ScholarCardGrid scholars={selectedGroup.scholars} source="__unassigned" droppedIds={droppedIds} />
              ) : (
                <Flex align="center" justify="center" py={12} color="charcoal.300">
                  <Text fontFamily="heading" fontSize="sm">
                    All scholars are in the current activity
                  </Text>
                </Flex>
              )}
            </Box>
          ) : selectedGroup.type === "unit" ? (
            <Box p={6}>
              <ActivityHeader
                title={selectedGroup.data.unitTitle}
                emoji={selectedGroup.data.unitEmoji}
                description={selectedGroup.data.unitDescription}
                unitId={String(selectedGroup.data.unitId)}
                units={units}
                currentFocus={currentFocus}
                onSetFocus={onSetFocus}
                onClearFocus={onClearFocus}
                durationMinutes={selectedGroup.data.durationMinutes}
              />
              {selectedGroup.data.scholars.length > 0 ? (
                <>
                  {selectedGroup.data.process ? (
                    <RacetrackPanel
                      process={selectedGroup.data.process}
                      scholars={selectedGroup.data.scholars}
                      source={String(selectedGroup.data.unitId)}
                      droppedIds={droppedIds}
                      onRelease={undefined}
                      fullWidth
                    />
                  ) : (
                    <ScholarCardGrid scholars={selectedGroup.data.scholars} source={String(selectedGroup.data.unitId)} droppedIds={droppedIds} />
                  )}
                </>
              ) : (
                <Flex align="center" justify="center" py={12} color="charcoal.300">
                  <Text fontFamily="heading" fontSize="sm">
                    No scholars are working on this activity yet
                  </Text>
                </Flex>
              )}
            </Box>
          ) : null}
        </Box>
      </Flex>

      {/* Drag overlay — floating scholar chip */}
      <DragOverlay>
        {activeScholar && (
          <HStack
            gap={2}
            px={3}
            py={2}
            bg="white"
            border="2px solid"
            borderColor="violet.400"
            borderRadius="lg"
            shadow="lg"
            opacity={0.95}
          >
            <Avatar
              size="sm"
              name={activeScholar.name || undefined}
              src={activeScholar.image || undefined}
            />
            <Text fontFamily="heading" fontSize="sm" fontWeight="500" color="navy.500">
              {(activeScholar.name ?? "Scholar").split(" ")[0]}
            </Text>
          </HStack>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Activity Sidebar ──────────────────────────────────────────────────

function ActivitySidebar({
  units,
  focusedGroup,
  focusUnitId,
  unassignedCount,
  selectedUnitId,
  onSelectUnit,
  currentFocus,
  onStartActivity,
  onStopActivity,
  isDragging,
  dragSource,
}: {
  units: UnitInfo[];
  focusedGroup: ActivityData["unitGroups"][number] | null;
  focusUnitId: string | null;
  unassignedCount: number;
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
  currentFocus: {
    unitId?: string | null;
    scholarIds?: string[] | null;
    endsAt?: number | null;
    _creationTime?: number;
    isActive: boolean;
  } | null;
  onStartActivity: (unitId: string, durationMinutes?: number) => void;
  onStopActivity: () => void;
  isDragging: boolean;
  dragSource: string | null;
}) {
  const focusedUnit = focusUnitId ? units.find((u) => u._id === focusUnitId) : null;
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [startDuration, setStartDuration] = useState<string>("");

  // Sidebar timer countdown
  const [sidebarProgress, setSidebarProgress] = useState(100);
  useEffect(() => {
    const endsAt = currentFocus?.endsAt;
    const createdAt = currentFocus?._creationTime;
    if (!currentFocus?.isActive || !endsAt) { setSidebarProgress(100); return; }
    const totalMs = endsAt - (createdAt ?? endsAt);
    const update = () => {
      const remainingMs = Math.max(0, endsAt - Date.now());
      if (remainingMs <= 0) { setSidebarProgress(0); return; }
      setSidebarProgress(totalMs > 0 ? (remainingMs / totalMs) * 100 : 0);
    };
    update();
    const id = setInterval(update, 5_000);
    return () => clearInterval(id);
  }, [currentFocus?.isActive, currentFocus?.endsAt, currentFocus?._creationTime]);

  return (
    <Box
      w="280px"
      minW="280px"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      overflow="auto"
    >
      <VStack gap={0} align="stretch">
        {/* Header with Start Activity button */}
        <HStack px={4} py={3} borderBottom="1px solid" borderColor="gray.100">
          <Text fontFamily="heading" fontSize="xs" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="0.05em" flex={1}>
            Activities
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="violet.500"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "violet.50" }}
            onClick={() => { setSelectedStart(null); setStartDuration(""); setStartDialogOpen(true); }}
          >
            <FiPlus style={{ marginRight: "4px" }} />
            Start
          </Button>
        </HStack>

        {/* Start Activity Dialog */}
        <Dialog.Root
          open={startDialogOpen}
          onOpenChange={(e) => { if (!e.open) setStartDialogOpen(false); }}
          placement="center"
          motionPreset="slide-in-bottom"
        >
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content maxW="xl" mx={4} borderRadius="xl" overflow="hidden">
                <Dialog.Header px={6} pt={5} pb={2}>
                  <Dialog.Title fontFamily="heading" fontWeight="700" color="navy.500" fontSize="lg" flex={1}>
                    Start an Activity
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <IconButton aria-label="Close" size="sm" variant="ghost" color="charcoal.400" _hover={{ bg: "gray.100" }}>
                      <FiX />
                    </IconButton>
                  </Dialog.CloseTrigger>
                </Dialog.Header>
                <Dialog.Body px={6} py={3}>
                  {units.length === 0 ? (
                    <VStack py={8} gap={3}>
                      <Text fontSize="sm" color="charcoal.400" fontFamily="heading">
                        No units created yet. Create one in the Curriculum tab.
                      </Text>
                    </VStack>
                  ) : (
                    <VStack gap={2} align="stretch" maxH="400px" overflowY="auto">
                      {units.map((unit) => {
                        const isSelected = selectedStart === unit._id;
                        const isCurrentlyActive = focusUnitId === unit._id;
                        return (
                          <Box
                            key={unit._id}
                            px={3}
                            py={2.5}
                            borderRadius="lg"
                            cursor="pointer"
                            bg={isSelected ? "violet.50" : "transparent"}
                            _hover={{ bg: isSelected ? "violet.50" : "gray.50" }}
                            transition="all 0.12s"
                            onClick={() => {
                              setSelectedStart(unit._id);
                              if (unit.durationMinutes) setStartDuration(String(unit.durationMinutes));
                              else setStartDuration("");
                            }}
                          >
                            <HStack gap={2.5} align="start">
                              <Text fontSize="lg" lineHeight="1.3" flexShrink={0}>{unit.emoji || "📚"}</Text>
                              <Box flex={1} minW={0}>
                                <HStack gap={1.5}>
                                  <Text fontFamily="heading" fontWeight="600" color="navy.500" fontSize="sm">
                                    {unit.title}
                                  </Text>
                                  {isCurrentlyActive && (
                                    <Badge bg="violet.100" color="violet.600" fontSize="2xs" fontFamily="heading">Active</Badge>
                                  )}
                                </HStack>
                                {unit.description && (
                                  <Text
                                    fontSize="xs"
                                    color="charcoal.400"
                                    fontFamily="body"
                                    lineHeight="1.4"
                                    overflow="hidden"
                                    css={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                                  >
                                    {unit.description}
                                  </Text>
                                )}
                                {unit.durationMinutes && (
                                  <Text fontSize="xs" color="charcoal.300" fontFamily="heading" mt={0.5}>
                                    {unit.durationMinutes} min
                                  </Text>
                                )}
                              </Box>
                            </HStack>
                          </Box>
                        );
                      })}
                    </VStack>
                  )}
                </Dialog.Body>
                <Dialog.Footer px={6} pb={5} pt={3}>
                  <VStack gap={3} w="full" align="stretch">
                    <HStack gap={2}>
                      <Text fontFamily="heading" fontSize="xs" color="charcoal.500" whiteSpace="nowrap">
                        Duration (min):
                      </Text>
                      <Input
                        size="sm"
                        type="number"
                        placeholder="No limit"
                        fontFamily="heading"
                        fontSize="sm"
                        value={startDuration}
                        onChange={(e) => setStartDuration(e.target.value)}
                        min={1}
                        max={480}
                        w="100px"
                      />
                    </HStack>
                    <Button
                      bg="violet.500"
                      color="white"
                      _hover={{ bg: "violet.700" }}
                      fontFamily="heading"
                      size="sm"
                      w="full"
                      disabled={!selectedStart}
                      onClick={() => {
                        if (selectedStart) {
                          const dur = startDuration ? parseInt(startDuration, 10) : undefined;
                          onStartActivity(selectedStart, dur && dur > 0 ? dur : undefined);
                          setStartDialogOpen(false);
                        }
                      }}
                    >
                      Start Activity
                    </Button>
                  </VStack>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>

        {/* The focused activity (droppable target) */}
        {focusedUnit && (
          <DroppableSidebarRow
            dropId={focusUnitId!}
            isSelected={selectedUnitId === focusUnitId}
            isDragTarget={isDragging && dragSource === "__unassigned"}
            onClick={() => onSelectUnit(focusUnitId)}
          >
            <Text fontSize="lg" flexShrink={0}>
              {focusedUnit.emoji || "📚"}
            </Text>
            <VStack gap={0} align="start" flex={1} minW={0}>
              <Text
                fontWeight={selectedUnitId === focusUnitId ? "600" : "500"}
                fontFamily="heading"
                color={selectedUnitId === focusUnitId ? "violet.700" : "navy.500"}
                fontSize="sm"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {focusedUnit.title}
              </Text>
              {focusedGroup && focusedGroup.scholars.length > 0 && (
                <HStack gap={0} mt={0.5}>
                  {focusedGroup.scholars.slice(0, 4).map((s, i) => (
                    <Box key={String(s.scholarId)} ml={i > 0 ? "-6px" : "0"} zIndex={4 - i}>
                      <Avatar
                        size="xs"
                        name={s.name || undefined}
                        src={s.image || undefined}
                      />
                    </Box>
                  ))}
                  {focusedGroup.scholars.length > 4 && (
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading" ml={1}>
                      +{focusedGroup.scholars.length - 4}
                    </Text>
                  )}
                </HStack>
              )}
            </VStack>
            {currentFocus?.endsAt ? (
              <Box border="1px solid" borderColor="gray.400" borderRadius="sm" p={1} display="inline-flex" flexShrink={0} ml="auto">
                <ProgressCircle.Root value={sidebarProgress} colorPalette="red" size="xs">
                  <ProgressCircle.Circle css={{ "--thickness": "12px" }}>
                    <ProgressCircle.Track stroke="white" />
                    <ProgressCircle.Range />
                  </ProgressCircle.Circle>
                </ProgressCircle.Root>
              </Box>
            ) : (
              <FiLock size={10} color="var(--chakra-colors-violet-500)" style={{ flexShrink: 0, marginLeft: "auto" }} />
            )}
          </DroppableSidebarRow>
        )}

        {/* Unassigned — everyone not in the focused activity (droppable target) */}
        <DroppableSidebarRow
          dropId="__unassigned"
          isSelected={selectedUnitId === "__unassigned"}
          isDragTarget={isDragging && dragSource !== "__unassigned"}
          onClick={() => onSelectUnit("__unassigned")}
          borderTop={focusedUnit ? "1px solid" : undefined}
          borderTopColor="gray.100"
        >
          <Box flexShrink={0} color="charcoal.400">
            <FiCompass size={20} />
          </Box>
          <Text
            fontWeight={selectedUnitId === "__unassigned" ? "600" : "500"}
            fontFamily="heading"
            color={selectedUnitId === "__unassigned" ? "violet.700" : "navy.500"}
            fontSize="sm"
            flex={1}
          >
            Unassigned
          </Text>
          <Badge
            bg="gray.100"
            color="charcoal.400"
            fontFamily="heading"
            fontSize="xs"
            px={2}
            minW="24px"
            textAlign="center"
            flexShrink={0}
          >
            {unassignedCount}
          </Badge>
        </DroppableSidebarRow>

        {!focusedUnit && (
          <VStack py={8} gap={3} px={4}>
            <Text color="charcoal.300" fontFamily="heading" fontSize="sm" textAlign="center">
              Click Start to begin an activity
            </Text>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

// ── Droppable Sidebar Row ────────────────────────────────────────────

function DroppableSidebarRow({
  dropId,
  isSelected,
  isDragTarget,
  onClick,
  children,
  ...rest
}: {
  dropId: string;
  isSelected: boolean;
  isDragTarget: boolean;
  onClick: () => void;
  children: React.ReactNode;
  borderTop?: string;
  borderTopColor?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const showDropHighlight = isDragTarget && isOver;

  return (
    <HStack
      ref={setNodeRef}
      px={4}
      py={3}
      gap={3}
      cursor="pointer"
      bg={showDropHighlight ? "violet.100" : isSelected ? "violet.50" : "transparent"}
      borderLeft="3px solid"
      borderColor={showDropHighlight ? "violet.500" : isSelected ? "violet.500" : "transparent"}
      _hover={{ bg: isSelected ? "violet.50" : "gray.50" }}
      transition="all 0.15s"
      onClick={onClick}
      outline={showDropHighlight ? "2px dashed" : undefined}
      outlineColor={showDropHighlight ? "violet.400" : undefined}
      outlineOffset="-2px"
      {...rest}
    >
      {children}
    </HStack>
  );
}

// ── Activity Header ───────────────────────────────────────────────────

function ActivityHeader({
  title,
  emoji,
  description,
  unitId,
  units,
  currentFocus,
  onSetFocus,
  onClearFocus,
  durationMinutes,
}: {
  title: string;
  emoji: string | null;
  description: string | null;
  unitId: string | null;
  units: UnitInfo[];
  currentFocus: {
    unitId?: string | null;
    scholarIds?: string[] | null;
    endsAt?: number | null;
    _creationTime?: number;
    isActive: boolean;
  } | null;
  onSetFocus: (args: { unitId?: Id<"units">; scholarIds?: Id<"users">[]; endsAt?: number }) => void;
  onClearFocus: () => void;
  durationMinutes: number | null;
}) {
  const isActive = currentFocus?.isActive ?? false;
  const isLocked = isActive && unitId && currentFocus?.unitId === unitId;
  const [linkCopied, setLinkCopied] = useState(false);
  const [timerInput, setTimerInput] = useState("");
  const [showTimerInput, setShowTimerInput] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState("");
  const [timerProgress, setTimerProgress] = useState(100);
  useEffect(() => {
    if (!isLocked || !currentFocus?.endsAt) { setTimeLeft(""); setTimerProgress(100); return; }
    const totalMs = currentFocus.endsAt - (currentFocus._creationTime ?? currentFocus.endsAt);
    const update = () => {
      const remainingMs = Math.max(0, currentFocus.endsAt! - Date.now());
      const remaining = Math.floor(remainingMs / 1000);
      if (remaining <= 0) { setTimeLeft("0:00"); setTimerProgress(0); return; }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setTimeLeft(m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`);
      setTimerProgress(totalMs > 0 ? (remainingMs / totalMs) * 100 : 0);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isLocked, currentFocus?.endsAt, currentFocus?._creationTime]);

  const handleCopyLink = () => {
    if (!unitId) return;
    const dimParams = buildDimensionParams(
      { unitId },
      { units }
    );
    const url = `${window.location.origin}/scholar/new${dimParams ? `?${dimParams}` : ""}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSetTimer = () => {
    if (!unitId) return;
    const mins = parseInt(timerInput, 10);
    if (!mins || mins < 1) return;
    const endsAt = Date.now() + mins * 60_000;
    onSetFocus({ unitId: unitId as Id<"units">, endsAt });
    setShowTimerInput(false);
    setTimerInput("");
  };

  return (
    <Flex
      mb={4}
      pb={4}
      borderBottom="1px solid"
      borderColor="gray.200"
      align="center"
      gap={3}
      flexWrap="wrap"
    >
      {emoji && <Text fontSize="2xl">{emoji}</Text>}
      <VStack gap={0} align="start" flex={1} minW={0}>
        <Text fontFamily="heading" fontWeight="700" fontSize="lg" color="navy.500">
          {title}
        </Text>
        {description && (
          <Text
            fontSize="sm"
            color="charcoal.400"
            fontFamily="heading"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            maxW="100%"
          >
            {description}
          </Text>
        )}
      </VStack>

      {/* Timer display + setter */}
      {isLocked && (
        <>
          <Popover.Root open={showTimerInput} onOpenChange={(e) => setShowTimerInput(e.open)}>
            <Popover.Trigger asChild>
              {timeLeft ? (
                <Box
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="md"
                  p={1}
                  display="inline-flex"
                  cursor="pointer"
                  flexShrink={0}
                >
                  <ProgressCircle.Root value={timerProgress} bg="white" colorPalette="red" size="xs">
                    <ProgressCircle.Circle css={{ "--thickness": "12px" }}>
                      <ProgressCircle.Track stroke="white" />
                      <ProgressCircle.Range />
                    </ProgressCircle.Circle>
                  </ProgressCircle.Root>
                </Box>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  color="charcoal.400"
                  fontFamily="heading"
                  fontSize="xs"
                  _hover={{ color: "red.500", bg: "red.50" }}
                >
                  Set Timer
                </Button>
              )}
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content w="180px" p={4} borderRadius="lg" shadow="lg">
                  <VStack gap={3} align="stretch">
                    <HStack gap={2} align="center">
                      <Input
                        size="sm"
                        type="number"
                        w="80px"
                        fontFamily="heading"
                        fontSize="sm"
                        value={timerInput}
                        onChange={(e) => setTimerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { handleSetTimer(); setShowTimerInput(false); } }}
                        autoFocus
                        min={1}
                        max={480}
                      />
                      <Text fontSize="sm" color="charcoal.500" fontFamily="heading">min</Text>
                    </HStack>
                    <Button
                      size="sm"
                      bg="red.500"
                      color="white"
                      fontFamily="heading"
                      fontSize="sm"
                      _hover={{ bg: "red.600" }}
                      w="full"
                      onClick={() => { handleSetTimer(); setShowTimerInput(false); }}
                    >
                      Set
                    </Button>
                  </VStack>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        </>
      )}

      {/* Release All */}
      {unitId && isLocked && (
        <Button
          size="sm"
          variant="solid"
          bg="violet.500"
          color="white"
          fontFamily="heading"
          fontSize="xs"
          _hover={{ bg: "red.500" }}
          onClick={onClearFocus}
        >
          <FiUnlock style={{ marginRight: "4px" }} /> Release All
        </Button>
      )}

      {/* Copy Link */}
      {unitId && (
        <Button
          size="sm"
          variant="ghost"
          color="charcoal.400"
          fontFamily="heading"
          fontSize="xs"
          _hover={{ bg: "violet.50", color: "violet.500" }}
          onClick={handleCopyLink}
        >
          {linkCopied ? (
            <><FiCheck style={{ marginRight: "4px" }} />Copied!</>
          ) : (
            <><FiLink style={{ marginRight: "4px" }} />Copy Link</>
          )}
        </Button>
      )}
    </Flex>
  );
}

// ── Scholar Cards Grid ────────────────────────────────────────────────

function ScholarCardGrid({ scholars, source, droppedIds, onRelease }: { scholars: ScholarInActivity[]; source: string; droppedIds: Set<string>; onRelease?: (scholar: ScholarInActivity) => void }) {
  return (
    <Flex wrap="wrap" gap={3} mb={2}>
      {scholars
        .filter((s) => !droppedIds.has(String(s.scholarId)))
        .map((s) => (
          <DraggableScholarCard key={String(s.projectId)} scholar={s} source={source} onRelease={onRelease} />
        ))}
    </Flex>
  );
}

function DraggableScholarCard({ scholar, source, onRelease }: { scholar: ScholarInActivity; source: string; onRelease?: (scholar: ScholarInActivity) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scholar-${String(scholar.scholarId)}-${source}`,
    data: { scholar, source },
  });

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      opacity={isDragging ? 0.4 : 1}
      transition="opacity 0.15s"
    >
      <ScholarCard scholar={scholar} />
    </Box>
  );
}

function ScholarCard({ scholar: s }: { scholar: ScholarInActivity }) {
  const firstName = (s.name ?? "Scholar").split(" ")[0];

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      w="280px"
      cursor="grab"
      _hover={{ borderColor: "violet.300", shadow: "sm" }}
      transition="all 0.1s"
      p={3}
    >
      {/* Header row: avatar, name, orb, time, action buttons */}
      <HStack gap={2} mb={1.5}>
        <Avatar
          size="sm"
          name={s.name || undefined}
          src={s.image || undefined}
        />
        <VStack gap={0} align="start" flex={1} minW={0}>
          <HStack gap={1.5}>
            <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
              {firstName}
            </Text>
            <StatusOrb pulseScore={s.pulseScore} lastMessageAt={s.lastMessageAt} size="sm" />
          </HStack>
        </VStack>
        {s.lastMessageAt && (
          <Text fontSize="xs" color="charcoal.300" fontFamily="heading" whiteSpace="nowrap" flexShrink={0}>
            {timeAgo(s.lastMessageAt)}
          </Text>
        )}
      </HStack>

      {/* Project title */}
      <Text fontSize="xs" color="charcoal.500" fontFamily="heading" fontWeight="500" mb={0.5} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {s.projectTitle}
      </Text>

      {/* Last message preview */}
      {s.lastMessageContent && (
        <Text
          fontSize="xs"
          color="charcoal.400"
          fontFamily="heading"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          mb={0.5}
          fontStyle={s.lastMessageRole === "assistant" ? "italic" : undefined}
        >
          {s.lastMessageRole === "assistant" ? "AI: " : ""}{s.lastMessageContent}
        </Text>
      )}

      {/* AI status commentary */}
      {s.analysisSummary && (
        <Text
          fontSize="xs"
          color="charcoal.400"
          fontFamily="heading"
          fontStyle="italic"
          lineHeight="1.3"
          overflow="hidden"
          css={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
          mb={0.5}
        >
          {s.analysisSummary}
        </Text>
      )}

      {/* Footer: action buttons */}
      <HStack gap={1} mt={1.5} borderTop="1px solid" borderColor="gray.100" pt={1.5}>
        <Box flex={1} />
        <Tooltip.Root openDelay={200} closeDelay={0}>
          <Tooltip.Trigger asChild>
            <IconButton
              aria-label="View profile"
              size="2xs"
              variant="ghost"
              color="charcoal.300"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/teacher?tab=scholars&scholar=${String(s.scholarId)}`, "_self");
              }}
            >
              <FiUser />
            </IconButton>
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content>Profile</Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip.Root>
        <Tooltip.Root openDelay={200} closeDelay={0}>
          <Tooltip.Trigger asChild>
            <IconButton
              aria-label="Open remote view"
              size="2xs"
              variant="ghost"
              color="charcoal.300"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/scholar/${String(s.projectId)}?remote=${String(s.scholarId)}`, "_blank");
              }}
            >
              <FiExternalLink />
            </IconButton>
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content>Remote view</Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip.Root>
      </HStack>
    </Box>
  );
}

// ── Droppable Timeline Content ───────────────────────────────────────

function DroppableTimelineContent({ stepKey, children, ...rest }: { stepKey: string; children: React.ReactNode; [key: string]: unknown }) {
  const { setNodeRef, isOver } = useDroppable({ id: `step-${stepKey}` });
  return (
    <Timeline.Content
      ref={setNodeRef}
      bg={isOver ? "violet.50" : undefined}
      borderRadius="md"
      transition="background 0.15s"
      minH="32px"
      outline={isOver ? "2px dashed" : undefined}
      outlineColor={isOver ? "violet.400" : undefined}
      outlineOffset="-2px"
      mx={-2}
      px={2}
      py={2}
      {...rest}
    >
      {children}
    </Timeline.Content>
  );
}

// ── Racetrack Panel ───────────────────────────────────────────────────

function RacetrackPanel({
  process,
  scholars,
  source,
  droppedIds,
  onRelease,
  fullWidth,
}: {
  process: {
    title: string;
    emoji: string | null;
    steps: { key: string; title: string; description?: string }[];
  };
  scholars: ScholarInActivity[];
  source: string;
  droppedIds: Set<string>;
  onRelease?: (scholar: ScholarInActivity) => void;
  fullWidth?: boolean;
}) {
  // Group scholars by their current step
  const scholarsByStep: Record<string, ScholarInActivity[]> = {};
  const noStep: ScholarInActivity[] = [];
  for (const s of scholars) {
    if (droppedIds.has(String(s.scholarId))) continue;
    const step = s.processStep;
    if (step && process.steps.some((ps) => ps.key === step)) {
      if (!scholarsByStep[step]) scholarsByStep[step] = [];
      scholarsByStep[step].push(s);
    } else {
      noStep.push(s);
    }
  }

  return (
    <Box>
      {/* Header */}
      <HStack gap={2} mb={4}>
        <Text fontSize="lg">{process.emoji || "📋"}</Text>
        <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500">
          {process.title}
        </Text>
      </HStack>

      {/* Steps as timeline with embedded scholar cards */}
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
              <DroppableTimelineContent stepKey={step.key} pb={hasScholars ? 4 : 2}>
                <Timeline.Title
                  fontFamily="heading"
                  fontSize="sm"
                  fontWeight={hasScholars ? "600" : "400"}
                  color={hasScholars ? "navy.500" : "charcoal.300"}
                >
                  {step.title}
                </Timeline.Title>
                {step.description && (
                  <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mt={0.5}>
                    {step.description}
                  </Text>
                )}
                {hasScholars && (
                  <Flex wrap="wrap" gap={3} mt={2}>
                    {scholarsAtStep.map((s) => (
                      <DraggableScholarCard key={String(s.projectId)} scholar={s} source={source} onRelease={onRelease} />
                    ))}
                  </Flex>
                )}
              </DroppableTimelineContent>
            </Timeline.Item>
          );
        })}
      </Timeline.Root>

      {/* Scholars with no matching step */}
      {noStep.length > 0 && (
        <Box mt={4} pt={3} borderTop="1px solid" borderColor="gray.100">
          <Text fontSize="xs" fontFamily="heading" color="charcoal.400" mb={2}>
            Not started
          </Text>
          <Flex wrap="wrap" gap={3}>
            {noStep.map((s) => (
              <DraggableScholarCard key={String(s.projectId)} scholar={s} source={source} onRelease={onRelease} />
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}

