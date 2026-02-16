"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
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
  Tabs,
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
  FiCopy,
  FiPlay,
} from "react-icons/fi";
import { TbFocusCentered } from "react-icons/tb";
import { Lectern } from "@phosphor-icons/react";
import { ScholarProfile, EntityManager } from "@/components";
import type { ScholarTabKey } from "@/components";
import { DimensionPicker } from "@/components/DimensionPicker";
import { DimensionEditModal } from "@/components/DimensionEditModal";
import type { DimensionType, DimensionEditData } from "@/components/DimensionEditModal";
import { AppLogo } from "@/components/AppLogo";
import { StatusOrb } from "@/components/StatusOrb";
import { buildDimensionParams } from "@/lib/dimensions";

type Tab = "scholars" | "live" | "curriculum";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ style?: React.CSSProperties; size?: number | string }> }[] = [
  { key: "live", label: "Conductor", icon: Lectern },
  { key: "scholars", label: "Scholars", icon: FiUsers },
  { key: "curriculum", label: "Curriculum", icon: FiBook },
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
  guestToken: string | null;
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
  const VALID_TABS: Tab[] = ["live", "scholars", "curriculum"];
  const VALID_SUB_TABS: CurriculumSubTab[] = ["units", "personas", "perspectives", "processes"];
  const VALID_SCHOLAR_TABS: ScholarTabKey[] = ["dossier", "mastery", "standards", "seeds", "strengths", "documents", "observations", "reports", "reading"];
  const rawTab = searchParams.get("tab");
  const rawSub = searchParams.get("sub");
  const rawScholar = searchParams.get("scholar");
  const rawStab = searchParams.get("stab");
  const activeTab: Tab = VALID_TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "live";
  const curriculumSubTab: CurriculumSubTab = VALID_SUB_TABS.includes(rawSub as CurriculumSubTab) ? (rawSub as CurriculumSubTab) : "units";
  const selectedScholarId: string | null = activeTab === "scholars" && rawScholar ? rawScholar : null;
  const scholarSubTab: ScholarTabKey = VALID_SCHOLAR_TABS.includes(rawStab as ScholarTabKey) ? (rawStab as ScholarTabKey) : "dossier";

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

        {/* Live View tab — real-time scholar cards */}
        {activeTab === "live" && (
          <LiveView
            scholars={scholars}
            currentFocus={currentFocus ?? null}
            units={units}
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
      </Flex>
    </Flex>
  );
}

// Live View — Conductor with optional Racetrack panel
function LiveView({
  scholars,
  currentFocus,
  units,
  onSetFocus,
  onClearFocus,
}: {
  scholars: Scholar[];
  currentFocus: FocusBarProps["currentFocus"];
  units: FocusEntity[];
  onSetFocus: FocusBarProps["onSet"];
  onClearFocus: FocusBarProps["onClear"];
}) {
  const isActive = currentFocus?.isActive ?? false;
  const focusUnitId = isActive ? currentFocus?.unitId : null;
  const focusedUnit = focusUnitId ? units.find((u) => u._id === String(focusUnitId)) : null;
  const focusProcessId = focusedUnit?.processId ? (focusedUnit.processId as Id<"processes">) : null;

  const racetrackData = useQuery(
    api.processState.getRacetrackData,
    focusProcessId ? { processId: focusProcessId } : "skip"
  );

  return (
    <Flex flex={1} direction="column" overflow="hidden">
      <FocusBar
        currentFocus={currentFocus}
        units={units}
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
  const [linkCopied, setLinkCopied] = useState(false);
  const generateGuestToken = useMutation(api.users.generateGuestToken);

  const handleCopyTestLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let token = scholar.guestToken;
    if (!token) {
      token = await generateGuestToken({ scholarId: scholar.id as Id<"users"> });
    }
    const guestUrl = `${window.location.origin}/guest?token=${token}`;
    await navigator.clipboard.writeText(guestUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <Card.Root
      bg="white"
      shadow="sm"
      _hover={{ shadow: "md", borderColor: "gray.300" }}
      borderWidth="1px"
      borderColor="gray.200"
      transition="all 0.15s"
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
                <HStack gap={1.5} fontSize="xs" color="charcoal.400" fontFamily="heading">
                  {scholar.dateOfBirth && (
                    <Text>Age {computeAge(scholar.dateOfBirth)}</Text>
                  )}
                  {scholar.dateOfBirth && scholar.readingLevel && (
                    <Text color="charcoal.300">·</Text>
                  )}
                  {scholar.readingLevel && (
                    <Text>RL {scholar.readingLevel}</Text>
                  )}
                </HStack>
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

          {/* Action buttons */}
          <HStack gap={2} pt={1}>
            <Button
              size="xs"
              bg="violet.500"
              color="white"
              fontFamily="heading"
              fontSize="xs"
              _hover={{ bg: "violet.600" }}
              onClick={() => window.open(remoteUrl, "_blank")}
            >
              <FiPlay style={{ marginRight: "4px" }} />
              Remote
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color="charcoal.400"
              fontFamily="heading"
              fontSize="xs"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              onClick={() => window.location.href = `/teacher?tab=scholars&scholar=${scholar.id}`}
            >
              <FiUser style={{ marginRight: "4px" }} />
              Profile
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color="charcoal.400"
              fontFamily="heading"
              fontSize="xs"
              _hover={{ color: "violet.500", bg: "violet.50" }}
              onClick={handleCopyTestLink}
            >
              <FiLink style={{ marginRight: "4px" }} />
              {linkCopied ? "Copied!" : "Copy test link"}
            </Button>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

// Focus Bar Component (Phase 1: unit-only focus)
interface FocusEntity {
  _id: string;
  title: string;
  slug?: string;
  emoji?: string;
  icon?: string | null;
  description?: string;
  systemPrompt?: string;
  rubric?: string;
  steps?: { key: string; title: string; description?: string }[];
  // Building block display info from units.list
  personaTitle?: string | null;
  personaEmoji?: string | null;
  perspectiveTitle?: string | null;
  perspectiveIcon?: string | null;
  processTitle?: string | null;
  processEmoji?: string | null;
  // Raw building block IDs
  personaId?: string | null;
  perspectiveId?: string | null;
  processId?: string | null;
}

interface FocusBarProps {
  currentFocus: {
    unitId?: string | null;
    isActive: boolean;
  } | null;
  units: FocusEntity[];
  onSet: (args: {
    unitId?: Id<"units">;
  }) => void;
  onClear: () => void;
}

function FocusBar({ currentFocus, units, onSet, onClear }: FocusBarProps) {
  const isActive = currentFocus?.isActive ?? false;
  const focusUnitId = isActive ? currentFocus?.unitId ?? null : null;
  const hasFocus = !!focusUnitId;
  const [linkCopied, setLinkCopied] = useState(false);

  // Building block lists for unit edit modal
  const personasList = useQuery(api.personas.list) ?? [];
  const perspectivesList = useQuery(api.perspectives.list) ?? [];
  const processesList = useQuery(api.processes.list) ?? [];

  // Get the focused unit's building block info
  const focusedUnit = focusUnitId ? units.find((u) => u._id === focusUnitId) : null;

  const handleCopyLink = () => {
    const dimParams = buildDimensionParams(
      { unitId: focusUnitId },
      { units }
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

  const openEdit = (id: string | null) => {
    if (!id) return;
    const item = units.find((e) => e._id === id);
    if (item) setEditModal({ type: "unit", data: {
      _id: item._id,
      title: item.title,
      description: item.description,
      systemPrompt: item.systemPrompt,
      emoji: item.emoji,
      rubric: item.rubric,
      personaId: item.personaId ? String(item.personaId) : undefined,
      perspectiveId: item.perspectiveId ? String(item.perspectiveId) : undefined,
      processId: item.processId ? String(item.processId) : undefined,
    }});
  };

  const unitOptions = units.map((p) => ({ id: p._id, title: p.title, emoji: p.emoji }));

  // Build building-block chips for display
  const buildingBlocks: { label: string; emoji: string }[] = [];
  if (focusedUnit?.personaTitle) buildingBlocks.push({ label: focusedUnit.personaTitle, emoji: focusedUnit.personaEmoji || "🤖" });
  if (focusedUnit?.perspectiveTitle) buildingBlocks.push({ label: focusedUnit.perspectiveTitle, emoji: focusedUnit.perspectiveIcon || "🔍" });
  if (focusedUnit?.processTitle) buildingBlocks.push({ label: focusedUnit.processTitle, emoji: focusedUnit.processEmoji || "📋" });

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
          Focus:
        </Text>
      </HStack>

      <DimensionPicker
        label="Unit"
        defaultLabel="Independent Study"
        activeId={focusUnitId}
        options={unitOptions}
        onChange={(id) => onSet({ unitId: (id as Id<"units">) ?? undefined })}
        renderOption={(p) => `${p.emoji || "📚"} ${p.title}`}
        renderActive={() => {
          const active = units.find((p) => p._id === focusUnitId);
          return active ? `${active.emoji || "📚"} ${active.title}` : null;
        }}
        onEdit={(id) => openEdit(id)}
      />

      {/* Read-only building block chips from focused unit */}
      {buildingBlocks.length > 0 && (
        <HStack gap={2} flexWrap="wrap">
          {buildingBlocks.map((bb) => (
            <HStack
              key={bb.label}
              gap={1}
              px={2}
              py={0.5}
              bg="violet.100"
              borderRadius="md"
              fontSize="xs"
              fontFamily="heading"
              color="violet.700"
            >
              <Text>{bb.emoji}</Text>
              <Text>{bb.label}</Text>
            </HStack>
          ))}
        </HStack>
      )}

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
          Clear
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
          personas={personasList as { _id: string; title: string; emoji: string }[]}
          perspectives={perspectivesList as { _id: string; title: string; icon?: string }[]}
          processes={processesList as { _id: string; title: string; emoji?: string }[]}
        />
      )}
    </Flex>
  );
}
