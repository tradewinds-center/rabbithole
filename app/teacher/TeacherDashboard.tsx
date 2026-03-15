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
  Checkbox,
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
  FiUnlock,
  FiPlus,
  FiCopy,
  FiCpu,
  FiCompass,
  FiExternalLink,
  FiUserPlus,
} from "react-icons/fi";
import dynamic from "next/dynamic";

const CurriculumAssistant = dynamic(() => import("@/components/CurriculumAssistant"), { ssr: false });
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";
import type { ScholarTabKey } from "@/components";
import { AppLogo } from "@/components/AppLogo";
import { AppHeader } from "@/components/AppHeader";
import { StatusOrb } from "@/components/StatusOrb";
import { SidekickAvatar } from "@/components/SidekickAvatar";
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
  { key: "live", label: "Activities", icon: Lectern },
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
  username?: string | null;
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
  const isCurriculumDesigner = user?.role === "curriculum_designer";
  const VALID_TABS: Tab[] = isCurriculumDesigner
    ? ["curriculum", "assistant"]
    : ["live", "scholars", "curriculum", "assistant"];
  const VALID_SUB_TABS: CurriculumSubTab[] = ["units", "personas", "perspectives", "processes"];
  const VALID_SCHOLAR_TABS: ScholarTabKey[] = ["activity", "mastery", "seeds", "standards", "strengths", "documents", "notes", "dossier", "reading"];
  const rawTab = searchParams.get("tab");
  const rawSub = searchParams.get("sub");
  const rawScholar = searchParams.get("scholar");
  const rawStab = searchParams.get("stab");
  const rawUnit = searchParams.get("unit");
  const defaultTab: Tab = isCurriculumDesigner ? "curriculum" : "live";
  const activeTab: Tab = VALID_TABS.includes(rawTab as Tab) ? (rawTab as Tab) : defaultTab;
  const curriculumSubTab: CurriculumSubTab = VALID_SUB_TABS.includes(rawSub as CurriculumSubTab) ? (rawSub as CurriculumSubTab) : "units";
  const selectedScholarId: string | null = activeTab === "scholars" && rawScholar ? rawScholar : null;
  const scholarSubTab: ScholarTabKey = VALID_SCHOLAR_TABS.includes(rawStab as ScholarTabKey) ? (rawStab as ScholarTabKey) : "activity";
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
  const addScholarsToFocus = useMutation(api.focus.addScholars);

  // Activity view data
  const activityData = useQuery(api.projects.listActiveByUnit);
  const completedActivities = useQuery(api.focus.listCompleted) ?? [];

  // Auth redirect
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push("/sign-in");
      return;
    }
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "curriculum_designer") {
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
    <Flex h="100dvh" bg="gray.50" direction="column">
      {/* Tab Bar with logo + account */}
      <AppHeader>
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
            {TABS.filter((tab) => VALID_TABS.includes(tab.key)).map((tab) => {
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
            onSignOut={() => {
              signOut();
              router.push("/sign-in");
            }}
          />
        </Box>
      </AppHeader>

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
                              navigator.clipboard.writeText(`${window.location.origin}/sign-in`);
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
                        {scholar.lastMessageAt && (
                          <Text fontSize="xs" color="charcoal.300" fontFamily="heading">
                            {timeAgo(scholar.lastMessageAt)}
                          </Text>
                        )}
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
            onAddScholarsToFocus={addScholarsToFocus}
            completedActivities={completedActivities}
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
  activityId?: string | null;
  activityCompletedAt?: number | null;
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

type CompletedActivity = {
  _id: string;
  unitId?: string | null;
  lessonId?: string | null;
  unitTitle: string;
  unitEmoji: string | null;
  lessonTitle?: string | null;
  startedAt: number;
  completedAt: number;
  endsAt?: number | null;
  scholarCount: number;
};

type FocusInfo = {
  _id?: string;
  unitId?: string | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  scholarIds?: string[] | null;
  endsAt?: number | null;
  _creationTime?: number;
  isActive: boolean;
};

function ActivityView({
  activityData,
  units,
  selectedUnitId,
  onSelectUnit,
  currentFocus,
  onSetFocus,
  onClearFocus,
  onAddScholarsToFocus,
  completedActivities,
}: {
  activityData: ActivityData | null;
  units: UnitInfo[];
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
  currentFocus: FocusInfo | null;
  onSetFocus: (args: { unitId?: Id<"units">; lessonId?: Id<"lessons">; scholarIds?: Id<"users">[]; endsAt?: number }) => void;
  onClearFocus: () => void;
  onAddScholarsToFocus: (args: { focusId: Id<"focusSettings">; scholarIds: Id<"users">[] }) => Promise<unknown>;
  completedActivities: CompletedActivity[];
}) {
  const isActive = currentFocus?.isActive ?? false;
  const focusUnitId = isActive ? currentFocus?.unitId ?? null : null;

  // Mutations for drag-and-drop
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const moveStep = useMutation(api.processState.teacherMoveStep);
  const markComplete = useMutation(api.projects.markActivityComplete);

  // The focused unit's data (if any), filtered to only scholars assigned to this activity
  const currentFocusId = currentFocus?._id ?? null;
  const focusedGroup = useMemo(() => {
    if (!activityData || !focusUnitId) return null;
    const group = activityData.unitGroups.find(
      (g) => String(g.unitId) === focusUnitId
    );
    if (!group) return null;
    // Only include scholars whose projects are linked to the current activity
    return {
      ...group,
      scholars: currentFocusId
        ? group.scholars.filter(
            (s) => s.activityId === currentFocusId
          )
        : group.scholars,
    };
  }, [activityData, focusUnitId, currentFocusId]);

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
    if (selectedUnitId.startsWith("completed-")) {
      const focusId = selectedUnitId.slice("completed-".length);
      return { type: "completed" as const, focusId };
    }
    if (selectedUnitId === focusUnitId) {
      if (focusedGroup) {
        return { type: "unit" as const, data: focusedGroup };
      }
      // No scholars assigned yet — build a synthetic group from unit metadata
      const unit = units.find((u) => u._id === focusUnitId);
      if (unit) {
        return {
          type: "unit" as const,
          data: {
            unitId: unit._id as Id<"units">,
            unitTitle: unit.title,
            unitEmoji: unit.emoji ?? null,
            unitDescription: unit.description ?? null,
            processId: (unit.processId ?? null) as Id<"processes"> | null,
            process: null,
            durationMinutes: unit.durationMinutes ?? null,
            scholars: [] as ScholarInActivity[],
          },
        };
      }
    }
    return null;
  }, [selectedUnitId, focusedGroup, focusUnitId, unassignedScholars, units]);

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
      const focusLessonId = currentFocus?.lessonId ? (currentFocus.lessonId as Id<"lessons">) : undefined;
      await createProject({
        userId: scholar.scholarId,
        unitId: focusUnitId as Id<"units">,
        ...(focusLessonId ? { lessonId: focusLessonId } : {}),
        activityId: currentFocusId as Id<"focusSettings">,
      });
      // Update focus lock to include this scholar
      if (currentFocusId) {
        await onAddScholarsToFocus({
          focusId: currentFocusId as Id<"focusSettings">,
          scholarIds: [scholar.scholarId],
        });
      }
    }
    // Dragging from focused activity → unassigned
    else if (src === focusUnitId && dropTarget === "__unassigned") {
      setDroppedIds((prev) => new Set(prev).add(String(scholar.scholarId)));
      await updateProject({
        id: scholar.projectId,
        unitId: null,
        activityId: null,
      });
    }
    // Dragging between process steps
    else if (dropTarget.startsWith("step-")) {
      const stepKey = dropTarget.slice(5);
      // Determine scholar's current effective step to avoid no-op drops
      let currentStep: string;
      if (scholar.activityCompletedAt) {
        currentStep = "__complete";
      } else if (scholar.processStep) {
        currentStep = scholar.processStep;
      } else if (!focusedGroup?.process && scholar.lastMessageAt) {
        currentStep = "__in_progress";
      } else {
        currentStep = "__not_started";
      }
      if (stepKey === currentStep) return; // same step — no-op
      setDroppedIds((prev) => new Set(prev).add(String(scholar.scholarId)));
      await moveStep({
        projectId: scholar.projectId,
        stepKey,
      });
    }
  }, [activeScholar, dragSource, focusUnitId, currentFocusId, currentFocus, createProject, updateProject, moveStep]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Flex flex={1} overflow="hidden">
        {/* Sidebar */}
        <ActivitySidebar
          units={units}
          focusedGroup={focusedGroup}
          focusUnitId={focusUnitId}
          selectedUnitId={selectedUnitId}
          onSelectUnit={onSelectUnit}
          currentFocus={currentFocus}
          onStartActivity={(unitId, lessonId, durationMin) => {
            const endsAt = durationMin ? Date.now() + durationMin * 60_000 : undefined;
            onSetFocus({
              unitId: unitId as Id<"units">,
              ...(lessonId ? { lessonId: lessonId as Id<"lessons"> } : {}),
              endsAt,
            });
            onSelectUnit(unitId);
          }}
          onStopActivity={() => {
            onClearFocus();
            onSelectUnit(null);
          }}
          isDragging={!!activeScholar}
          dragSource={dragSource}
          completedActivities={completedActivities}
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
          ) : selectedGroup.type === "completed" ? (
            <CompletedActivityDetail focusId={selectedGroup.focusId as Id<"focusSettings">} />
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
                unassignedScholars={unassignedScholars}
                onAddScholars={async (scholarIds) => {
                  const unitIdTyped = selectedGroup.data.unitId as Id<"units">;
                  await Promise.all([
                    // Create projects for each scholar
                    ...scholarIds.map((sid) =>
                      createProject({
                        userId: sid,
                        unitId: unitIdTyped,
                        activityId: currentFocusId as Id<"focusSettings">,
                      })
                    ),
                    // Update focus lock to include these scholars
                    currentFocusId
                      ? onAddScholarsToFocus({
                          focusId: currentFocusId as Id<"focusSettings">,
                          scholarIds,
                        })
                      : Promise.resolve(),
                  ]);
                }}
              />
              {selectedGroup.data.scholars.length > 0 ? (
                <RacetrackPanel
                  process={selectedGroup.data.process}
                  scholars={selectedGroup.data.scholars}
                  source={String(selectedGroup.data.unitId)}
                  droppedIds={droppedIds}
                  onRelease={undefined}
                  fullWidth
                />
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
  selectedUnitId,
  onSelectUnit,
  currentFocus,
  onStartActivity,
  onStopActivity,
  isDragging,
  dragSource,
  completedActivities,
}: {
  units: UnitInfo[];
  focusedGroup: ActivityData["unitGroups"][number] | null;
  focusUnitId: string | null;
  selectedUnitId: string | null;
  onSelectUnit: (id: string | null) => void;
  currentFocus: FocusInfo | null;
  onStartActivity: (unitId: string, lessonId?: string, durationMinutes?: number) => void;
  onStopActivity: () => void;
  isDragging: boolean;
  dragSource: string | null;
  completedActivities: CompletedActivity[];
}) {
  const focusedUnit = focusUnitId ? units.find((u) => u._id === focusUnitId) : null;
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedStartLesson, setSelectedStartLesson] = useState<string | null>(null);
  const [startDuration, setStartDuration] = useState<string>("");

  // Query lessons for the selected unit in Start Activity dialog
  const startDialogLessons = useQuery(
    api.lessons.listByUnitPublic,
    selectedStart ? { unitId: selectedStart as Id<"units"> } : "skip"
  );

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
            onClick={() => { setSelectedStart(null); setSelectedStartLesson(null); setStartDuration(""); setStartDialogOpen(true); }}
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
                              setSelectedStartLesson(null);
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

                  {/* Lesson list for the selected unit */}
                  {selectedStart && startDialogLessons && startDialogLessons.length > 0 && (
                    <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
                      <Text fontSize="xs" fontFamily="heading" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="wider" mb={2}>
                        Lesson (optional)
                      </Text>
                      <VStack gap={1} align="stretch" maxH="200px" overflowY="auto">
                        {startDialogLessons.map((lesson) => {
                          const isLessonSelected = selectedStartLesson === lesson._id;
                          return (
                            <HStack
                              key={lesson._id}
                              px={2}
                              py={1.5}
                              borderRadius="md"
                              cursor="pointer"
                              bg={isLessonSelected ? "violet.100" : "transparent"}
                              _hover={{ bg: isLessonSelected ? "violet.100" : "gray.50" }}
                              transition="all 0.1s"
                              onClick={() => {
                                setSelectedStartLesson(isLessonSelected ? null : lesson._id);
                                if (lesson.durationMinutes && !isLessonSelected) {
                                  setStartDuration(String(lesson.durationMinutes));
                                }
                              }}
                              gap={2}
                            >
                              <Text fontSize="xs" fontFamily="heading" fontWeight="500" color="navy.500" flex={1}>
                                {lesson.title}
                              </Text>
                              {lesson.processEmoji && (
                                <Text fontSize="2xs" color="charcoal.300">{lesson.processEmoji}</Text>
                              )}
                              {lesson.durationMinutes && (
                                <Badge bg="gray.100" color="charcoal.400" fontSize="2xs" px={1}>
                                  {lesson.durationMinutes}m
                                </Badge>
                              )}
                            </HStack>
                          );
                        })}
                      </VStack>
                    </Box>
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
                          onStartActivity(selectedStart, selectedStartLesson ?? undefined, dur && dur > 0 ? dur : undefined);
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

        {/* ── IN PROGRESS section ── */}
        {focusedUnit && (
          <>
            <Text px={4} pt={3} pb={1} fontFamily="heading" fontSize="2xs" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="0.05em">
              In Progress
            </Text>
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
                {currentFocus?.lessonTitle && (
                  <Text fontSize="2xs" color="charcoal.400" fontFamily="heading" truncate>
                    {currentFocus.lessonTitle}
                  </Text>
                )}
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
              {currentFocus?.endsAt && (
                <Box border="1px solid" borderColor="gray.400" borderRadius="sm" p={1} display="inline-flex" flexShrink={0} ml="auto">
                  <ProgressCircle.Root value={sidebarProgress} colorPalette="red" size="xs">
                    <ProgressCircle.Circle css={{ "--thickness": "12px" }}>
                      <ProgressCircle.Track stroke="white" />
                      <ProgressCircle.Range />
                    </ProgressCircle.Circle>
                  </ProgressCircle.Root>
                </Box>
              )}
            </DroppableSidebarRow>
          </>
        )}

        {/* ── COMPLETED section ── */}
        {completedActivities.length > 0 && (
          <>
            <Text px={4} pt={3} pb={1} fontFamily="heading" fontSize="2xs" fontWeight="600" color="charcoal.400" textTransform="uppercase" letterSpacing="0.05em">
              Completed
            </Text>
            {completedActivities.map((ca) => {
              const key = `completed-${ca._id}`;
              const isSelected = selectedUnitId === key;
              const startTime = new Date(ca.startedAt);
              const endTime = new Date(ca.completedAt);
              const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              return (
                <HStack
                  key={ca._id}
                  px={4}
                  py={2.5}
                  gap={2.5}
                  cursor="pointer"
                  bg={isSelected ? "violet.50" : "transparent"}
                  borderLeft="3px solid"
                  borderColor={isSelected ? "violet.500" : "transparent"}
                  _hover={{ bg: isSelected ? "violet.50" : "gray.50" }}
                  transition="all 0.1s"
                  opacity={0.7}
                  onClick={() => onSelectUnit(key)}
                >
                  <Text fontSize="lg" flexShrink={0}>
                    {ca.unitEmoji || "📚"}
                  </Text>
                  <VStack gap={0} align="start" flex={1} minW={0}>
                    <Text
                      fontWeight={isSelected ? "600" : "500"}
                      fontFamily="heading"
                      color={isSelected ? "violet.700" : "navy.500"}
                      fontSize="sm"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {ca.unitTitle}
                    </Text>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                      {fmt(startTime)}–{fmt(endTime)} · {ca.scholarCount} scholar{ca.scholarCount !== 1 ? "s" : ""}
                    </Text>
                  </VStack>
                </HStack>
              );
            })}
          </>
        )}

        {!focusedUnit && completedActivities.length === 0 && (
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

// ── Add Scholars Button ──────────────────────────────────────────────

function AddScholarsButton({
  unassignedScholars,
  onAddScholars,
}: {
  unassignedScholars: ScholarInActivity[];
  onAddScholars: (scholarIds: Id<"users">[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () => [...unassignedScholars].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [unassignedScholars]
  );

  if (sorted.length === 0) return null;

  const allSelected = selected.size === sorted.length;

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((s) => String(s.scholarId))));
    }
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      await onAddScholars(
        Array.from(selected).map((id) => id as Id<"users">)
      );
      setSelected(new Set());
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Button
        size="xs"
        bg="violet.500"
        color="white"
        fontFamily="heading"
        fontSize="xs"
        _hover={{ bg: "violet.600" }}
        onClick={() => { setOpen(true); setSelected(new Set()); }}
      >
        <FiUserPlus style={{ marginRight: "4px" }} />
        Add Scholars
      </Button>

      <Dialog.Root
        open={open}
        onOpenChange={(e) => { if (!e.open) setOpen(false); }}
        placement="center"
        motionPreset="slide-in-bottom"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="sm" mx={4} borderRadius="xl" overflow="hidden">
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontWeight="700" color="navy.500">
                  Add Scholars
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label="Close"
                    position="absolute"
                    top={3}
                    right={3}
                  >
                    <FiX />
                  </IconButton>
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body px={6} py={3}>
                <Flex justify="flex-end" mb={3}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="violet.500"
                    fontFamily="heading"
                    fontSize="xs"
                    _hover={{ bg: "violet.50" }}
                    onClick={handleSelectAll}
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </Flex>

                <VStack gap={1} align="stretch" maxH="300px" overflowY="auto">
                  {sorted.map((s) => {
                    const id = String(s.scholarId);
                    return (
                      <Flex
                        key={id}
                        align="center"
                        gap={3}
                        px={3}
                        py={2}
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: "violet.50" }}
                        onClick={() => handleToggle(id)}
                      >
                        <Checkbox.Root
                          checked={selected.has(id)}
                          onCheckedChange={() => handleToggle(id)}
                          colorPalette="violet"
                          size="sm"
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Root>
                        <Avatar
                          name={s.name ?? "Scholar"}
                          src={s.image ?? undefined}
                          size="xs"
                        />
                        <Text fontFamily="heading" fontSize="sm" color="charcoal.500">
                          {s.name ?? "Unknown Scholar"}
                        </Text>
                      </Flex>
                    );
                  })}
                </VStack>
              </Dialog.Body>

              <Dialog.Footer px={6} pb={5} pt={3}>
                <Button
                  size="sm"
                  bg="violet.500"
                  color="white"
                  fontFamily="heading"
                  fontSize="sm"
                  _hover={{ bg: "violet.600" }}
                  w="full"
                  disabled={selected.size === 0 || adding}
                  onClick={handleAdd}
                >
                  {adding
                    ? "Adding..."
                    : `Add ${selected.size} Scholar${selected.size !== 1 ? "s" : ""}`}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
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
  unassignedScholars,
  onAddScholars,
}: {
  title: string;
  emoji: string | null;
  description: string | null;
  unitId: string | null;
  units: UnitInfo[];
  currentFocus: FocusInfo | null;
  onSetFocus: (args: { unitId?: Id<"units">; lessonId?: Id<"lessons">; scholarIds?: Id<"users">[]; endsAt?: number }) => void;
  onClearFocus: () => void;
  durationMinutes: number | null;
  unassignedScholars: ScholarInActivity[];
  onAddScholars: (scholarIds: Id<"users">[]) => Promise<void>;
}) {
  const isActive = currentFocus?.isActive ?? false;
  const isLocked = isActive && unitId && currentFocus?.unitId === unitId;
  const [linkCopied, setLinkCopied] = useState(false);
  const [timerInput, setTimerInput] = useState("");
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [timerEditing, setTimerEditing] = useState(false);

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
    <VStack
      mb={4}
      pb={4}
      borderBottom="1px solid"
      borderColor="gray.200"
      align="stretch"
      gap={3}
    >
      {/* Title row */}
      <HStack gap={3} align="center">
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

        {/* Timer circle (inline with title when active) */}
        {isLocked && timeLeft && (
          <Popover.Root open={showTimerInput} onOpenChange={(e) => { setShowTimerInput(e.open); if (!e.open) setTimerEditing(false); }}>
            <Popover.Trigger asChild>
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
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content w="200px" p={4} borderRadius="lg" shadow="lg">
                  {!timerEditing ? (
                    <VStack gap={3} align="stretch">
                      <VStack gap={0}>
                        <Text fontFamily="heading" fontSize="2xl" fontWeight="700" color="red.500" textAlign="center">
                          {timeLeft}
                        </Text>
                        <Text fontFamily="heading" fontSize="xs" color="charcoal.400" textAlign="center">
                          remaining
                        </Text>
                      </VStack>
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="charcoal.300"
                        color="charcoal.500"
                        fontFamily="heading"
                        fontSize="sm"
                        _hover={{ bg: "gray.50", borderColor: "charcoal.400" }}
                        w="full"
                        onClick={() => setTimerEditing(true)}
                      >
                        Edit
                      </Button>
                    </VStack>
                  ) : (
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
                          onKeyDown={(e) => { if (e.key === "Enter") { handleSetTimer(); setShowTimerInput(false); setTimerEditing(false); } }}
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
                        onClick={() => { handleSetTimer(); setShowTimerInput(false); setTimerEditing(false); }}
                      >
                        Set
                      </Button>
                    </VStack>
                  )}
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        )}
      </HStack>

      {/* Action buttons row */}
      <HStack gap={2} flexWrap="wrap">
        {/* Add Scholars (primary) */}
        <AddScholarsButton
          unassignedScholars={unassignedScholars}
          onAddScholars={onAddScholars}
        />

        {/* Set Timer */}
        {isLocked && !timeLeft && (
          <Popover.Root open={showTimerInput} onOpenChange={(e) => { setShowTimerInput(e.open); if (!e.open) setTimerEditing(false); }}>
            <Popover.Trigger asChild>
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
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content w="200px" p={4} borderRadius="lg" shadow="lg">
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
                        onKeyDown={(e) => { if (e.key === "Enter") { handleSetTimer(); setShowTimerInput(false); setTimerEditing(false); } }}
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
                      onClick={() => { handleSetTimer(); setShowTimerInput(false); setTimerEditing(false); }}
                    >
                      Set
                    </Button>
                  </VStack>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        )}

        {/* Copy Link */}
        {unitId && (
          <Button
            size="xs"
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

        {/* End Activity */}
        {unitId && isLocked && (
          <Button
            size="xs"
            variant="ghost"
            color="charcoal.400"
            fontFamily="heading"
            fontSize="xs"
            _hover={{ bg: "red.50", color: "red.500" }}
            onClick={onClearFocus}
          >
            <FiCheck style={{ marginRight: "4px" }} /> End Activity
          </Button>
        )}
      </HStack>
    </VStack>
  );
}

// ── Scholar Cards Grid ────────────────────────────────────────────────

// ── Completed Activity Detail ───────────────────────────────────────

function CompletedActivityDetail({ focusId }: { focusId: Id<"focusSettings"> }) {
  const data = useQuery(api.focus.getWithProjects, { focusId });

  if (!data) {
    return (
      <Flex align="center" justify="center" h="full">
        <Spinner size="lg" color="violet.500" />
      </Flex>
    );
  }

  const startTime = new Date(data.startedAt);
  const endTime = data.completedAt ? new Date(data.completedAt) : null;
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <Box p={6}>
      {/* Header */}
      <Flex mb={4} pb={4} borderBottom="1px solid" borderColor="gray.200" align="center" gap={3}>
        {data.unitEmoji && <Text fontSize="2xl">{data.unitEmoji}</Text>}
        <VStack gap={0} align="start" flex={1} minW={0}>
          <Text fontFamily="heading" fontWeight="700" fontSize="lg" color="navy.500">
            {data.unitTitle}
          </Text>
          <Text fontSize="sm" color="charcoal.400" fontFamily="heading">
            {fmt(startTime)}{endTime ? `–${fmt(endTime)}` : ""} · {data.scholars.length} scholar{data.scholars.length !== 1 ? "s" : ""}
          </Text>
          {data.unitDescription && (
            <Text fontSize="sm" color="charcoal.400" fontFamily="heading" mt={0.5}>
              {data.unitDescription}
            </Text>
          )}
        </VStack>
        <Badge bg="gray.100" color="charcoal.500" fontFamily="heading" fontSize="xs">
          Completed
        </Badge>
      </Flex>

      {/* Scholar cards (read-only, no drag) */}
      {data.scholars.length > 0 ? (
        <RacetrackPanel
          process={data.process}
          scholars={data.scholars}
          source={`completed-${focusId}`}
          droppedIds={new Set()}
          onRelease={undefined}
          fullWidth
          readOnly
        />
      ) : (
        <Flex align="center" justify="center" py={12} color="charcoal.300">
          <Text fontFamily="heading" fontSize="sm">
            No scholars participated in this activity
          </Text>
        </Flex>
      )}
    </Box>
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

function DraggableScholarCard({ scholar, source, onRelease, disabled }: { scholar: ScholarInActivity; source: string; onRelease?: (scholar: ScholarInActivity) => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scholar-${String(scholar.scholarId)}-${source}`,
    data: { scholar, source },
    disabled,
  });

  return (
    <Box
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...attributes}
      opacity={isDragging ? 0.4 : 1}
      cursor={disabled ? "default" : "grab"}
      transition="opacity 0.15s"
    >
      <ScholarCard scholar={scholar} />
    </Box>
  );
}

function ScholarCard({ scholar: s }: { scholar: ScholarInActivity }) {
  const firstName = (s.name ?? "Scholar").split(" ")[0];
  const isComplete = !!s.activityCompletedAt;
  const markComplete = useMutation(api.projects.markActivityComplete);

  return (
    <Box
      bg={isComplete ? "green.50" : "white"}
      border="1px solid"
      borderColor={isComplete ? "green.200" : "gray.200"}
      borderRadius="lg"
      w="280px"
      cursor="grab"
      _hover={{ borderColor: isComplete ? "green.300" : "violet.300", shadow: "sm" }}
      transition="all 0.1s"
      p={3}
    >
      {/* Header row: avatar, sidekick, name, orb, time */}
      <HStack gap={2} mb={1.5}>
        <Avatar
          size="sm"
          name={s.name || undefined}
          src={s.image || undefined}
        />
        <SidekickAvatar scholarId={s.scholarId} size={20} />
        <VStack gap={0} align="start" flex={1} minW={0}>
          <HStack gap={1.5}>
            <Text fontFamily="heading" fontSize="sm" fontWeight="600" color={isComplete ? "green.700" : "navy.500"}>
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
      <HStack gap={1} mt={1.5} borderTop="1px solid" borderColor={isComplete ? "green.100" : "gray.100"} pt={1.5}>
        {/* Mark Complete / Undo */}
        {s.activityId && (
          <Tooltip.Root openDelay={200} closeDelay={0}>
            <Tooltip.Trigger asChild>
              <IconButton
                aria-label={isComplete ? "Undo complete" : "Mark complete"}
                size="2xs"
                variant="ghost"
                color={isComplete ? "green.500" : "charcoal.300"}
                _hover={{ color: isComplete ? "charcoal.400" : "green.500", bg: isComplete ? "gray.100" : "green.50" }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  markComplete({ projectId: s.projectId, complete: !isComplete });
                }}
              >
                <FiCheck />
              </IconButton>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>{isComplete ? "Undo complete" : "Mark complete"}</Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        )}
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
  const isCompleteStep = stepKey === "__complete";
  const hoverColor = isCompleteStep ? "green.50" : "violet.50";
  const outlineClr = isCompleteStep ? "green.400" : "violet.400";
  return (
    <Timeline.Content
      ref={setNodeRef}
      bg={isOver ? hoverColor : undefined}
      borderRadius="md"
      transition="background 0.15s"
      minH="32px"
      outline={isOver ? "2px dashed" : undefined}
      outlineColor={isOver ? outlineClr : undefined}
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
  readOnly,
}: {
  process?: {
    title: string;
    emoji: string | null;
    steps: { key: string; title: string; description?: string }[];
  } | null;
  scholars: ScholarInActivity[];
  source: string;
  droppedIds: Set<string>;
  onRelease?: (scholar: ScholarInActivity) => void;
  fullWidth?: boolean;
  readOnly?: boolean;
}) {
  // Build the unified step list: Not Started → [process steps] → Complete
  const processSteps = process?.steps ?? [];
  const allSteps: { key: string; title: string; description?: string; indicator?: string }[] = [
    { key: "__not_started", title: "Not Started", indicator: "—" },
    // For process-less activities, add a single "In Progress" step
    ...(processSteps.length === 0
      ? [{ key: "__in_progress", title: "In Progress", indicator: "●" }]
      : processSteps),
    { key: "__complete", title: "Complete", indicator: "✓" },
  ];

  // Group scholars by their current step
  const hasProcess = processSteps.length > 0;
  const scholarsByStep: Record<string, ScholarInActivity[]> = {};
  for (const s of scholars) {
    if (droppedIds.has(String(s.scholarId))) continue;
    // Completed scholars go to __complete
    if (s.activityCompletedAt) {
      if (!scholarsByStep["__complete"]) scholarsByStep["__complete"] = [];
      scholarsByStep["__complete"].push(s);
      continue;
    }
    const step = s.processStep;
    if (step && allSteps.some((ps) => ps.key === step)) {
      if (!scholarsByStep[step]) scholarsByStep[step] = [];
      scholarsByStep[step].push(s);
    } else if (!hasProcess && s.lastMessageAt) {
      // Process-less: scholars with messages are "In Progress"
      if (!scholarsByStep["__in_progress"]) scholarsByStep["__in_progress"] = [];
      scholarsByStep["__in_progress"].push(s);
    } else {
      // No step or unrecognized step → Not Started
      if (!scholarsByStep["__not_started"]) scholarsByStep["__not_started"] = [];
      scholarsByStep["__not_started"].push(s);
    }
  }

  return (
    <Box>
      {/* Header (only for processes) */}
      {process && (
        <HStack gap={2} mb={4}>
          <Text fontSize="lg">{process.emoji || "📋"}</Text>
          <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500">
            {process.title}
          </Text>
        </HStack>
      )}

      {/* Steps as timeline with embedded scholar cards */}
      <Timeline.Root size="md">
        {allSteps.map((step) => {
          const scholarsAtStep = scholarsByStep[step.key] || [];
          const hasScholars = scholarsAtStep.length > 0;
          const isComplete = step.key === "__complete";
          const isNotStarted = step.key === "__not_started";
          const stepContent = (
            <>
              <Timeline.Title
                fontFamily="heading"
                fontSize="sm"
                fontWeight={hasScholars ? "600" : "400"}
                color={hasScholars ? (isComplete ? "green.600" : "navy.500") : "charcoal.300"}
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
                  {scholarsAtStep.map((s) =>
                    readOnly ? (
                      <ScholarCard key={String(s.projectId)} scholar={s} />
                    ) : (
                      <DraggableScholarCard key={String(s.projectId)} scholar={s} source={source} onRelease={onRelease} disabled={isNotStarted} />
                    )
                  )}
                </Flex>
              )}
            </>
          );

          const indicatorBg = isComplete && hasScholars
            ? "green.500"
            : hasScholars ? "violet.500" : "gray.200";

          return (
            <Timeline.Item key={step.key}>
              <Timeline.Connector>
                <Timeline.Separator />
                <Timeline.Indicator
                  bg={indicatorBg}
                  borderColor={indicatorBg}
                  color={hasScholars ? "white" : "charcoal.400"}
                >
                  <Text
                    fontSize="10px"
                    fontWeight="700"
                    fontFamily="heading"
                    lineHeight="1"
                    color={hasScholars ? "white" : "charcoal.400"}
                  >
                    {step.indicator ?? step.key}
                  </Text>
                </Timeline.Indicator>
              </Timeline.Connector>
              {readOnly ? (
                <Timeline.Content pb={hasScholars ? 4 : 2}>
                  {stepContent}
                </Timeline.Content>
              ) : (
                <DroppableTimelineContent stepKey={step.key} pb={hasScholars ? 4 : 2}>
                  {stepContent}
                </DroppableTimelineContent>
              )}
            </Timeline.Item>
          );
        })}
      </Timeline.Root>
    </Box>
  );
}

