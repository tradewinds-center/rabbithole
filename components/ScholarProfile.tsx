"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Textarea,
  Spinner,
  Badge,
  Input,
  Tabs,
  Dialog,
  Portal,
  Switch,
  Separator,
  Menu,
} from "@chakra-ui/react";
import { Avatar } from "@/components/Avatar";
import {
  FiPlus,
  FiTrash2,
  FiBookOpen,
  FiFileText,
  FiUser,
  FiFolder,
  FiEdit3,
  FiClipboard,
  FiShare2,
  FiClock,
  FiMessageSquare,
  FiHome,
  FiTrendingUp,
  FiVolume2,
  FiKey,
  FiFlag,
  FiMoreHorizontal,
} from "react-icons/fi";
import { ParentAccessDialog } from "@/components/ParentAccessDialog";
import { Notebook, Plant, ShootingStar } from "@phosphor-icons/react";
import { MasteryTab } from "@/components/MasteryTab";
import { SeedsTab } from "@/components/SeedsTab";
import { DirectivesTab } from "@/components/DirectivesTab";
import { DocumentsTab } from "@/components/DocumentsTab";
import { SignalsTab } from "@/components/SignalsTab";
import { StandardsTab } from "@/components/StandardsTab";
import { StyledDialogContent } from "@/components/ui/StyledDialogContent";
import { fleschKincaid, type FKResult } from "@/lib/readability";

export type ScholarTabKey = "overview" | "progress" | "guidance" | "records" | "profile" | "ai-chat";
type TabKey = ScholarTabKey;
type ProgressSection = "mastery" | "standards" | "strengths" | "connections";

interface ScholarProfileProps {
  scholarId: string;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  onDelete?: () => void;
  /** "teacher" (default) shows all controls; "parent" hides teacher-only buttons */
  mode?: "teacher" | "parent";
}

const READING_LEVELS = [
  { value: "", label: "Not set" },
  { value: "K", label: "K - Kindergarten" },
  { value: "1", label: "1st Grade" },
  { value: "2", label: "2nd Grade" },
  { value: "3", label: "3rd Grade" },
  { value: "4", label: "4th Grade" },
  { value: "5", label: "5th Grade" },
  { value: "6", label: "6th Grade" },
  { value: "7", label: "7th Grade" },
  { value: "8", label: "8th Grade" },
  { value: "9", label: "9th Grade" },
  { value: "10", label: "10th Grade" },
  { value: "11", label: "11th Grade" },
  { value: "12", label: "12th Grade" },
  { value: "college", label: "College" },
];

const ALL_TABS: { key: TabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { key: "overview", label: "Overview", icon: FiHome },
  { key: "progress", label: "Progress", icon: FiTrendingUp },
  { key: "guidance", label: "Guidance", icon: Plant },
  { key: "records", label: "Records", icon: FiFileText },
  { key: "profile", label: "Profile", icon: FiUser },
  { key: "ai-chat", label: "AI Chat", icon: FiMessageSquare },
];

// Tabs visible to parents (ai-chat is teacher-only)
const PARENT_TABS: TabKey[] = ["overview", "progress", "guidance", "records", "profile"];

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
  return `${months}mo ago`;
}

export function ScholarProfile({ scholarId, activeTab: controlledTab, onTabChange, onDelete, mode = "teacher" }: ScholarProfileProps) {
  const isParentMode = mode === "parent";
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const deleteUser = useMutation(api.users.deleteUser);
  const createChatSession = useMutation(api.curriculumAssistant.createSession);
  const chatSessions = useQuery(api.curriculumAssistant.listSessionsForScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  const resetPassword = useMutation(api.users.resetScholarPassword);
  const profile = useQuery(api.scholars.getProfile, { scholarId: scholarId as Id<"users"> });
  const observations = useQuery(api.observations.listByScholar, { scholarId: scholarId as Id<"users"> }) ?? [];
  const dossierContent = useQuery(api.dossier.getForTeacher, { scholarId: scholarId as Id<"users"> });
  const artifacts = useQuery(api.artifacts.getByScholar, { scholarId: scholarId as Id<"users"> });
  const scholarProjects = useQuery(api.projects.list, { userId: scholarId as Id<"users"> });
  const recentMessages = useQuery(api.messages.getRecentByScholar, { scholarId: scholarId as Id<"users"> });
  const reports = useQuery(api.reports.list, { scholarId: scholarId as Id<"users"> }) ?? [];
  const createReport = useMutation(api.reports.create);
  const removeReport = useMutation(api.reports.remove);
  const updateDossier = useMutation(api.dossier.updateByTeacher);
  const updateReadingLevel = useMutation(api.scholars.updateReadingLevel);
  const updateAudioSettings = useMutation(api.scholars.updateAudioSettings);
  const acceptReadingLevelSuggestion = useMutation(api.scholars.acceptReadingLevelSuggestion);
  const dismissReadingLevelSuggestion = useMutation(api.scholars.dismissReadingLevelSuggestion);
  const runAIAnalysis = useAction(api.readingLevelAnalysis.analyzeReadingLevelAI);
  const addObservation = useMutation(api.observations.add);
  const removeObservation = useMutation(api.observations.remove);
  const { scholar, stats } = profile ?? {
    scholar: null,
    stats: { projectCount: 0, messageCount: 0, observationCount: 0 },
  };

  const isLoading = profile === undefined;

  const [internalTab, setInternalTab] = useState<TabKey>("overview");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [progressSection, setProgressSection] = useState<ProgressSection>("mastery");
  const [dossierDraft, setDossierDraft] = useState<string | null>(null);
  const [isSavingReadingLevel, setIsSavingReadingLevel] = useState(false);
  const [analyzeTriggered, setAnalyzeTriggered] = useState(false);
  const [fkResult, setFkResult] = useState<FKResult | null | "no-data">(null);
  const [aiLoading, setAiLoading] = useState(false);
  const messages30d = useQuery(
    api.messages.getScholarUserMessages30d,
    analyzeTriggered && !isParentMode
      ? { scholarId: scholarId as Id<"users"> }
      : "skip"
  );
  const [newObservation, setNewObservation] = useState({ type: "praise" as "praise" | "concern" | "suggestion" | "intervention", note: "" });
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [newReport, setNewReport] = useState({ title: "", content: "" });
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showParentAccess, setShowParentAccess] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleReadingLevelChange = async (newLevel: string) => {
    setIsSavingReadingLevel(true);
    try {
      await updateReadingLevel({
        scholarId: scholarId as Id<"users">,
        readingLevel: newLevel || null,
      });
    } catch (error) {
      console.error("Error updating reading level:", error);
    } finally {
      setIsSavingReadingLevel(false);
    }
  };

  useEffect(() => {
    if (analyzeTriggered && messages30d !== undefined) {
      setFkResult(fleschKincaid(messages30d) ?? "no-data");
      setAnalyzeTriggered(false);
    }
  }, [messages30d, analyzeTriggered]);

  useEffect(() => {
    setFkResult(null);
    setAnalyzeTriggered(false);
    setAiLoading(false);
  }, [scholarId]);

  const handleFKAnalyze = () => {
    setFkResult(null);
    setAnalyzeTriggered(true);
  };

  const handleAIRerun = async () => {
    setAiLoading(true);
    try {
      await runAIAnalysis({ scholarId: scholarId as Id<"users"> });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddObservation = async () => {
    if (!newObservation.note.trim()) return;
    setIsAddingObservation(true);
    try {
      await addObservation({
        scholarId: scholarId as Id<"users">,
        type: newObservation.type,
        note: newObservation.note,
      });
      setNewObservation({ type: "praise", note: "" });
    } catch (error) {
      console.error("Error adding observation:", error);
    } finally {
      setIsAddingObservation(false);
    }
  };

  const handleDeleteObservation = async (observationId: string) => {
    try {
      await removeObservation({ observationId: observationId as Id<"observations"> });
    } catch (error) {
      console.error("Error deleting observation:", error);
    }
  };

  const handleAddReport = async () => {
    if (!newReport.title.trim() || !newReport.content.trim()) return;
    setIsAddingReport(true);
    try {
      await createReport({
        scholarId: scholarId as Id<"users">,
        title: newReport.title,
        content: newReport.content,
      });
      setNewReport({ title: "", content: "" });
    } catch (error) {
      console.error("Error adding report:", error);
    } finally {
      setIsAddingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await removeReport({ reportId: reportId as Id<"reports"> });
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  if (isLoading) {
    return (
      <Box
        w="full"
        bg="white"
        h="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color="violet.500" />
      </Box>
    );
  }

  const visibleTabs = isParentMode
    ? ALL_TABS.filter((t) => PARENT_TABS.includes(t.key))
    : ALL_TABS;

  return (
    <Box w="full" bg="gray.50" h="full" display="flex" flexDir="column">

      {/* Tab bar */}
      <Tabs.Root
        value={activeTab}
        onValueChange={(e) => setActiveTab(e.value as TabKey)}
        variant="subtle"
        fitted={false}
        size="lg"
      >
        <Tabs.List px={5} gap={0}>
          {visibleTabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <Tabs.Trigger
                key={tab.key}
                value={tab.key}
                fontFamily="heading"
                fontSize="xs"
                px={4}
                py={4}
                color="charcoal.400"
              >
                <TabIcon style={{ marginRight: "6px" }} />
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </Tabs.Root>

      {/* Tab content */}
      <Box flex={1} overflow="auto" p={4}>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={4} alignItems="start">

            {/* Left: Scholar identity card */}
            <Box bg="white" borderRadius="xl" p={5} shadow="xs">
              <VStack gap={3} align="center" mb={4}>
                <Avatar
                  size="xl"
                  name={scholar?.name || "Scholar"}
                  src={scholar?.image || undefined}
                />
                <VStack gap={0} align="center">
                  <Text fontWeight="700" fontFamily="heading" color="navy.500" fontSize="xl" textAlign="center">
                    {scholar?.name}
                  </Text>
                  {scholar?.username && (
                    <Text color="charcoal.300" fontSize="xs" fontFamily="heading">
                      @{scholar.username}
                    </Text>
                  )}
                </VStack>
              </VStack>

              <VStack gap={3} align="stretch" divideY="1px">
                {/* Stats + reading level */}
                <VStack gap={2} align="stretch" pb={3}>
                  {scholar?.readingLevel && (
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="charcoal.400" fontFamily="heading">Reading Level</Text>
                      <Badge bg="violet.100" color="violet.700" fontSize="xs" fontFamily="heading">
                        {scholar.readingLevel === "college" ? "College" : `Grade ${scholar.readingLevel}`}
                      </Badge>
                    </HStack>
                  )}
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading">Projects</Text>
                    <Text fontSize="xs" color="charcoal.600" fontFamily="heading" fontWeight="600">{stats.projectCount}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading">Messages</Text>
                    <Text fontSize="xs" color="charcoal.600" fontFamily="heading" fontWeight="600">{stats.messageCount}</Text>
                  </HStack>
                  {!isParentMode && stats.observationCount > 0 && (
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="charcoal.400" fontFamily="heading">Observations</Text>
                      <Text fontSize="xs" color="charcoal.600" fontFamily="heading" fontWeight="600">{stats.observationCount}</Text>
                    </HStack>
                  )}
                </VStack>

                {/* Most recent observation */}
                {!isParentMode && observations.length > 0 && (
                  <Box pt={3}>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={2}>Latest Observation</Text>
                    <Box>
                      <Badge
                        bg={
                          observations[0].type === "praise" ? "green.100" :
                          observations[0].type === "concern" ? "red.100" :
                          observations[0].type === "suggestion" ? "blue.100" : "orange.100"
                        }
                        color={
                          observations[0].type === "praise" ? "green.700" :
                          observations[0].type === "concern" ? "red.700" :
                          observations[0].type === "suggestion" ? "blue.700" : "orange.700"
                        }
                        fontSize="2xs"
                        mb={1}
                      >
                        {observations[0].type}
                      </Badge>
                      <Text fontSize="xs" color="charcoal.500" fontFamily="body" lineHeight="1.4" lineClamp={3}>
                        {observations[0].note}
                      </Text>
                    </Box>
                  </Box>
                )}

                {/* Dossier snippet */}
                {dossierContent && (
                  <Box pt={3}>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="heading" mb={2}>Learner Profile</Text>
                    <Text fontSize="xs" color="charcoal.500" fontFamily="body" lineHeight="1.5" lineClamp={5} fontStyle="italic">
                      {dossierContent}
                    </Text>
                  </Box>
                )}
              </VStack>
            </Box>

            {/* Right: Recent activity */}
            <VStack gap={4} align="stretch">
              {/* Projects */}
              <Box>
                <HStack mb={3} justify="space-between">
                  <HStack>
                    <FiFolder color="#AD60BF" />
                    <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                      Projects ({stats.projectCount})
                    </Text>
                  </HStack>
                  {!isParentMode && (
                    <a href={`/scholar?remote=${scholarId}`} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                      <Text fontSize="xs" color="violet.500" fontFamily="heading" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                        Open scholar view
                      </Text>
                    </a>
                  )}
                </HStack>
                {scholarProjects === undefined ? (
                  <Flex justify="center" py={4}><Spinner size="sm" color="violet.500" /></Flex>
                ) : scholarProjects.length === 0 ? (
                  <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>No projects yet.</Text>
                ) : (
                  <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(260px, 1fr))" gap={3}>
                    {scholarProjects.slice(0, 9).map((project) => (
                      <a
                        key={project._id}
                        href={`/scholar/${String(project._id)}?remote=${scholarId}`}
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: "none", color: "inherit", display: "contents" }}
                      >
                        <Box
                          bg="white"
                          borderRadius="lg"
                          p={3}
                          shadow="xs"
                          cursor="pointer"
                          _hover={{ shadow: "sm", borderColor: "violet.200" }}
                          border="1px solid"
                          borderColor="gray.100"
                        >
                          <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500" lineClamp={1}>
                            {project.title}
                          </Text>
                          {project.unitTitle && (
                            <Text fontSize="xs" color="violet.500" fontFamily="heading" mt={0.5}>
                              {project.unitEmoji ? `${project.unitEmoji} ` : ""}{project.unitTitle}
                            </Text>
                          )}
                          <HStack mt={2} gap={3}>
                            <HStack gap={1}>
                              <FiMessageSquare size={11} color="#888" />
                              <Text fontSize="xs" color="charcoal.400" fontFamily="heading">{project.messageCount}</Text>
                            </HStack>
                            <Text fontSize="xs" color="charcoal.400" fontFamily="heading">{timeAgo(project._creationTime)}</Text>
                          </HStack>
                          {project.analysisSummary && (
                            <Text fontSize="xs" color="charcoal.500" fontFamily="body" mt={1.5} lineClamp={2}>
                              {project.analysisSummary}
                            </Text>
                          )}
                        </Box>
                      </a>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Recent messages */}
              <Box>
                <HStack mb={3}>
                  <FiClock color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Recent Messages ({stats.messageCount})
                  </Text>
                </HStack>
                {recentMessages === undefined ? (
                  <Flex justify="center" py={4}><Spinner size="sm" color="violet.500" /></Flex>
                ) : recentMessages.length === 0 ? (
                  <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>No messages yet.</Text>
                ) : (
                  <VStack gap={2} align="stretch">
                    {recentMessages.filter((m) => !(m.role === "user" && m.content === "<start>")).map((msg) => (
                      <a
                        key={msg._id}
                        href={`/scholar/${String(msg.projectId)}?remote=${scholarId}`}
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <Box bg="white" borderRadius="md" p={3} shadow="xs" cursor="pointer" _hover={{ shadow: "sm" }}>
                          <HStack justify="space-between" mb={1}>
                            <HStack gap={2}>
                              <Badge
                                bg={msg.role === "user" ? "cyan.100" : "violet.100"}
                                color={msg.role === "user" ? "cyan.700" : "violet.700"}
                                fontSize="xs"
                              >
                                {msg.role === "user" ? "scholar" : "ai"}
                              </Badge>
                              <Text fontSize="xs" color="violet.500" fontFamily="heading">{msg.projectTitle}</Text>
                            </HStack>
                            <Text fontSize="xs" color="charcoal.400" fontFamily="heading">{timeAgo(msg._creationTime)}</Text>
                          </HStack>
                          <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineClamp={2}>
                            {msg.content.slice(0, 200)}
                          </Text>
                        </Box>
                      </a>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </Box>
        )}

        {/* ── Progress (Mastery + Standards + Strengths + Connections) ── */}
        {activeTab === "progress" && (
          <Box>
            <HStack mb={4} gap={1}>
              {(["mastery", "standards", "strengths", "connections"] as ProgressSection[]).map((section) => (
                <Button
                  key={section}
                  size="sm"
                  variant={progressSection === section ? "solid" : "ghost"}
                  bg={progressSection === section ? "violet.500" : undefined}
                  color={progressSection === section ? "white" : "charcoal.400"}
                  _hover={progressSection === section ? { bg: "violet.600" } : { bg: "violet.50", color: "violet.600" }}
                  fontFamily="heading"
                  fontSize="xs"
                  px={4}
                  onClick={() => setProgressSection(section)}
                  textTransform="capitalize"
                >
                  {section}
                </Button>
              ))}
            </HStack>
            {progressSection === "mastery" && <MasteryTab scholarId={scholarId} />}
            {progressSection === "standards" && <StandardsTab scholarId={scholarId} readingLevel={scholar?.readingLevel} />}
            {progressSection === "strengths" && <SignalsTab scholarId={scholarId} view="strengths" />}
            {progressSection === "connections" && <SignalsTab scholarId={scholarId} view="connections" />}
          </Box>
        )}

        {/* ── Guidance (Seeds + Directives) ── */}
        {activeTab === "guidance" && (
          <VStack gap={0} align="stretch">
            <SeedsTab scholarId={scholarId} />
            {!isParentMode && (
              <>
                <Separator my={6} borderColor="gray.200" />
                <Box>
                  <HStack mb={3}>
                    <FiFlag color="#AD60BF" />
                    <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                      Directives
                    </Text>
                    <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                      — standing rules injected into the AI tutor's system prompt
                    </Text>
                  </HStack>
                  <DirectivesTab scholarId={scholarId} />
                </Box>
              </>
            )}
          </VStack>
        )}

        {/* ── Records (Notes + Documents) ── */}
        {activeTab === "records" && (
          <Box
            display="grid"
            gridTemplateColumns={!isParentMode ? { base: "1fr", lg: "2fr 1fr" } : "1fr"}
            gap={4}
            alignItems="start"
          >
            {/* Left: Notes + Reports */}
            <Box>
              <Box bg="white" borderRadius="lg" p={4} shadow="xs">
                <HStack mb={3}>
                  <FiFileText color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Observations
                  </Text>
                </HStack>

                {!isParentMode && (
                  <Box p={3} bg="gray.50" borderRadius="md" mb={3}>
                    <select
                      value={newObservation.type}
                      onChange={(e) => setNewObservation((prev) => ({ ...prev, type: e.target.value as typeof prev.type }))}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        width: "140px",
                        marginBottom: "8px",
                      }}
                    >
                      <option value="praise">Praise</option>
                      <option value="concern">Concern</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="intervention">Intervention</option>
                    </select>
                    <Textarea
                      size="sm"
                      placeholder="Record an observation..."
                      value={newObservation.note}
                      onChange={(e) => setNewObservation((prev) => ({ ...prev, note: e.target.value }))}
                      rows={2}
                      bg="white"
                      fontFamily="body"
                      mb={2}
                    />
                    <Flex justify="flex-end">
                      <Button
                        size="sm"
                        bg="violet.500"
                        color="white"
                        _hover={{ bg: "violet.600" }}
                        fontFamily="heading"
                        onClick={handleAddObservation}
                        disabled={isAddingObservation || !newObservation.note.trim()}
                      >
                        Save
                      </Button>
                    </Flex>
                  </Box>
                )}

                {observations.length > 0 ? (
                  <VStack gap={2} align="stretch">
                    {observations.map((obs) => (
                      <Box key={obs._id} p={3} bg="gray.50" borderRadius="md">
                        <HStack justify="space-between" align="start">
                          <VStack gap={1} align="start" flex={1}>
                            <HStack>
                              <Badge
                                bg={
                                  obs.type === "praise" ? "green.100" :
                                  obs.type === "concern" ? "red.100" :
                                  obs.type === "suggestion" ? "blue.100" :
                                  "orange.100"
                                }
                                color={
                                  obs.type === "praise" ? "green.700" :
                                  obs.type === "concern" ? "red.700" :
                                  obs.type === "suggestion" ? "blue.700" :
                                  "orange.700"
                                }
                                fontSize="xs"
                              >
                                {obs.type}
                              </Badge>
                              <Text fontSize="xs" color="charcoal.400" fontFamily="heading">
                                {new Date(obs._creationTime).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </Text>
                            </HStack>
                            <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.4">
                              {obs.note}
                            </Text>
                          </VStack>
                          {!isParentMode && (
                            <IconButton
                              aria-label="Delete"
                              size="xs"
                              variant="ghost"
                              color="red.400"
                              _hover={{ bg: "red.50", color: "red.600" }}
                              onClick={() => handleDeleteObservation(obs._id)}
                            >
                              <FiTrash2 />
                            </IconButton>
                          )}
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={2}>
                    No observations yet.
                  </Text>
                )}
              </Box>

              {/* Reports */}
              <Box mt={4}>
                {!isParentMode && (
                  <Box bg="white" borderRadius="lg" p={4} shadow="xs" mb={4}>
                    <HStack mb={3}>
                      <Notebook size={16} color="#AD60BF" />
                      <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                        New Report
                      </Text>
                    </HStack>
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Input
                        size="sm"
                        placeholder="Report title"
                        value={newReport.title}
                        onChange={(e) => setNewReport((prev) => ({ ...prev, title: e.target.value }))}
                        bg="white"
                        fontFamily="heading"
                        mb={2}
                      />
                      <Textarea
                        size="sm"
                        placeholder="Write your report..."
                        value={newReport.content}
                        onChange={(e) => setNewReport((prev) => ({ ...prev, content: e.target.value }))}
                        rows={8}
                        bg="white"
                        fontFamily="body"
                        mb={2}
                      />
                      <Flex justify="space-between" align="center">
                        <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                          Reports auto-append to the AI dossier.
                        </Text>
                        <Button
                          size="sm"
                          bg="violet.500"
                          color="white"
                          _hover={{ bg: "violet.600" }}
                          fontFamily="heading"
                          onClick={handleAddReport}
                          disabled={isAddingReport || !newReport.title.trim() || !newReport.content.trim()}
                        >
                          Save
                        </Button>
                      </Flex>
                    </Box>
                  </Box>
                )}

                {reports.length > 0 ? (
                  <VStack gap={3} align="stretch">
                    {reports.map((report) => (
                      <Box
                        key={report._id}
                        bg="white"
                        borderRadius="lg"
                        p={4}
                        shadow="xs"
                        borderLeft="3px solid"
                        borderColor="violet.400"
                      >
                        <HStack justify="space-between" align="start" mb={1}>
                          <Text fontFamily="heading" fontSize="sm" fontWeight="600" color="navy.500">
                            {report.title}
                          </Text>
                          <HStack gap={2}>
                            <Text fontSize="xs" color="charcoal.400" fontFamily="heading" whiteSpace="nowrap">
                              {new Date(report._creationTime).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </Text>
                            {!isParentMode && (
                              <IconButton
                                aria-label="Delete report"
                                size="xs"
                                variant="ghost"
                                color="red.400"
                                _hover={{ bg: "red.50", color: "red.600" }}
                                onClick={() => handleDeleteReport(report._id)}
                              >
                                <FiTrash2 />
                              </IconButton>
                            )}
                          </HStack>
                        </HStack>
                        <Text fontSize="sm" color="charcoal.600" fontFamily="body" lineHeight="1.5" whiteSpace="pre-wrap">
                          {report.content}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="sm" color="charcoal.300" fontFamily="heading" textAlign="center" py={4}>
                    No reports yet.
                  </Text>
                )}
              </Box>
            </Box>

            {/* Right: Documents — teacher only */}
            {!isParentMode && (
              <Box>
                <HStack mb={3}>
                  <FiFolder color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Documents
                  </Text>
                </HStack>
                <DocumentsTab scholarId={scholarId} />
              </Box>
            )}
          </Box>
        )}

        {/* ── Profile (Dossier + Reading & Audio + Account) ── */}
        {activeTab === "profile" && (
          <Box
            display="grid"
            gridTemplateColumns={{ base: "1fr", lg: "2fr 1fr" }}
            gap={4}
            alignItems="start"
          >
            {/* Left: Learner Profile (Dossier) */}
            <Box bg="white" borderRadius="lg" p={5} shadow="xs">
              <HStack mb={3}>
                <FiUser color="#AD60BF" />
                <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                  Learner Profile
                </Text>
              </HStack>
              <Textarea
                size="sm"
                placeholder="No dossier yet — the AI will build one during conversations."
                value={dossierDraft ?? dossierContent ?? ""}
                onChange={(e) => setDossierDraft(e.target.value)}
                onBlur={async () => {
                  if (dossierDraft !== null && dossierDraft !== (dossierContent ?? "")) {
                    await updateDossier({
                      scholarId: scholarId as Id<"users">,
                      content: dossierDraft,
                    });
                  }
                  setDossierDraft(null);
                }}
                rows={20}
                bg="gray.50"
                fontFamily="body"
                fontSize="sm"
                lineHeight="1.6"
                readOnly={isParentMode}
              />
              <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={2}>
                AI-maintained learning profile. {!isParentMode && "You can also edit manually."}
              </Text>
            </Box>

            {/* Right: Settings + Account */}
            <VStack gap={4} align="stretch">
              {isParentMode && (
                <Text fontSize="sm" color="charcoal.400" fontFamily="body" fontStyle="italic">
                  These settings can only be edited by teacher
                </Text>
              )}

              {/* Reading Level */}
              <Box bg="white" borderRadius="lg" p={5} shadow="xs" opacity={isParentMode ? 0.7 : 1}>
                <HStack mb={3}>
                  <FiBookOpen color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Output Reading Level
                  </Text>
                  {isSavingReadingLevel && <Spinner size="xs" color="violet.500" />}
                </HStack>
                <select
                  value={scholar?.readingLevel || ""}
                  onChange={(e) => handleReadingLevelChange(e.target.value)}
                  disabled={isSavingReadingLevel || isParentMode}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    backgroundColor: isSavingReadingLevel || isParentMode ? "#f7f7f7" : "white",
                    cursor: isParentMode ? "not-allowed" : undefined,
                  }}
                >
                  {READING_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <Text fontSize="xs" color="charcoal.400" fontFamily="body" mt={2}>
                  Adjusts vocabulary and complexity in conversations
                </Text>

                {/* Analysis table */}
                {!isParentMode && (
                  <Box mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
                    {/* Column headers */}
                    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} pb={1} mb={1} borderBottom="1px solid" borderColor="gray.100">
                      {["Method", "Grade"].map((h) => (
                        <Text key={h} fontSize="2xs" color="charcoal.300" fontFamily="heading" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
                          {h}
                        </Text>
                      ))}
                    </Box>

                    {/* Observer AI row */}
                    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} alignItems="center" py={1.5}>
                      <Text fontSize="xs" fontFamily="heading" color="charcoal.500">Observer AI</Text>
                      <HStack gap={1}>
                        {aiLoading ? (
                          <Spinner size="xs" color="violet.500" />
                        ) : (
                          <>
                            <Text
                              fontSize="xs"
                              fontFamily="heading"
                              fontWeight={scholar?.readingLevelSuggestion ? "600" : "400"}
                              color={scholar?.readingLevelSuggestion ? "navy.500" : "charcoal.300"}
                            >
                              {scholar?.readingLevelSuggestion
                                ? scholar.readingLevelSuggestion === "K" ? "K"
                                  : scholar.readingLevelSuggestion === "college" ? "College"
                                  : `Grade ${scholar.readingLevelSuggestion}`
                                : "—"}
                            </Text>
                            <Menu.Root positioning={{ placement: "bottom-end" }}>
                              <Menu.Trigger asChild>
                                <IconButton aria-label="AI actions" variant="ghost" size="2xs" color="charcoal.300" _hover={{ color: "charcoal.500" }}>
                                  <FiMoreHorizontal />
                                </IconButton>
                              </Menu.Trigger>
                              <Menu.Positioner>
                                <Menu.Content minW="140px">
                                  {scholar?.readingLevelSuggestion && (
                                    <>
                                      <Menu.Item value="accept" cursor="pointer"
                                        onClick={() => acceptReadingLevelSuggestion({ scholarId: scholarId as Id<"users"> })}>
                                        Accept suggestion
                                      </Menu.Item>
                                      <Menu.Item value="dismiss" cursor="pointer"
                                        onClick={() => dismissReadingLevelSuggestion({ scholarId: scholarId as Id<"users"> })}>
                                        Dismiss
                                      </Menu.Item>
                                    </>
                                  )}
                                  <Menu.Item value="rerun" cursor="pointer" onClick={handleAIRerun}>
                                    {scholar?.readingLevelSuggestion ? "Re-analyze" : "Analyze"}
                                  </Menu.Item>
                                </Menu.Content>
                              </Menu.Positioner>
                            </Menu.Root>
                          </>
                        )}
                      </HStack>
                    </Box>

                    {/* Flesch-Kincaid row */}
                    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} alignItems="center" py={1.5} borderTop="1px solid" borderColor="gray.50">
                      <Text fontSize="xs" fontFamily="heading" color="charcoal.500">Flesch-Kincaid</Text>
                      <HStack gap={1}>
                        {analyzeTriggered && messages30d === undefined ? (
                          <Spinner size="xs" color="violet.500" />
                        ) : (
                          <>
                            <Text
                              fontSize="xs"
                              fontFamily="heading"
                              fontWeight={fkResult && fkResult !== "no-data" ? "600" : "400"}
                              color={fkResult && fkResult !== "no-data" ? "navy.500" : "charcoal.300"}
                              title={fkResult && fkResult !== "no-data" ? `${fkResult.wordCount.toLocaleString()} words · last 30 days` : undefined}
                            >
                              {fkResult && fkResult !== "no-data"
                                ? `Grade ${fkResult.gradeLevel}`
                                : fkResult === "no-data" ? "n/a" : "—"}
                            </Text>
                            <Menu.Root positioning={{ placement: "bottom-end" }}>
                              <Menu.Trigger asChild>
                                <IconButton aria-label="FK actions" variant="ghost" size="2xs" color="charcoal.300" _hover={{ color: "charcoal.500" }}>
                                  <FiMoreHorizontal />
                                </IconButton>
                              </Menu.Trigger>
                              <Menu.Positioner>
                                <Menu.Content minW="140px">
                                  {fkResult && fkResult !== "no-data" && (
                                    <Menu.Item value="apply" cursor="pointer"
                                      onClick={async () => { await handleReadingLevelChange(fkResult.level); setFkResult(null); }}>
                                      Apply to level
                                    </Menu.Item>
                                  )}
                                  <Menu.Item value="analyze" cursor="pointer" onClick={handleFKAnalyze}>
                                    {fkResult === "no-data" ? "Retry" : fkResult ? "Re-analyze" : "Analyze"}
                                  </Menu.Item>
                                  {fkResult && (
                                    <Menu.Item value="clear" cursor="pointer" onClick={() => setFkResult(null)}>
                                      Clear
                                    </Menu.Item>
                                  )}
                                </Menu.Content>
                              </Menu.Positioner>
                            </Menu.Root>
                          </>
                        )}
                      </HStack>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Audio Controls */}
              <Box bg="white" borderRadius="lg" p={5} shadow="xs" opacity={isParentMode ? 0.7 : 1}>
                <HStack mb={3}>
                  <FiVolume2 color="#AD60BF" />
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm">
                    Audio
                  </Text>
                </HStack>
                <VStack gap={4} align="stretch">
                  <HStack justify="space-between">
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontFamily="heading" color="charcoal.500" fontWeight="500">
                        Text-to-Speech
                      </Text>
                      <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                        Read AI responses aloud
                      </Text>
                    </VStack>
                    <Switch.Root
                      checked={scholar?.ttsEnabled !== false}
                      disabled={isParentMode}
                      onCheckedChange={(e) =>
                        updateAudioSettings({
                          scholarId: scholarId as Id<"users">,
                          ttsEnabled: e.checked,
                        })
                      }
                    >
                      <Switch.HiddenInput />
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Root>
                  </HStack>
                  <HStack justify="space-between">
                    <VStack align="start" gap={0}>
                      <Text fontSize="sm" fontFamily="heading" color="charcoal.500" fontWeight="500">
                        Voice Dictation
                      </Text>
                      <Text fontSize="xs" color="charcoal.400" fontFamily="body">
                        Speech-to-text input
                      </Text>
                    </VStack>
                    <Switch.Root
                      checked={scholar?.sttEnabled !== false}
                      disabled={isParentMode}
                      onCheckedChange={(e) =>
                        updateAudioSettings({
                          scholarId: scholarId as Id<"users">,
                          sttEnabled: e.checked,
                        })
                      }
                    >
                      <Switch.HiddenInput />
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Root>
                  </HStack>
                </VStack>
              </Box>

              {/* Account — teacher only */}
              {!isParentMode && (
                <Box bg="white" borderRadius="lg" p={5} shadow="xs">
                  <Text fontWeight="600" fontFamily="heading" color="navy.500" fontSize="sm" mb={3}>
                    Account
                  </Text>
                  <VStack gap={2} align="stretch">
                    <Button
                      size="sm"
                      variant="outline"
                      color="charcoal.500"
                      fontFamily="heading"
                      fontSize="xs"
                      borderColor="gray.200"
                      _hover={{ bg: "gray.50" }}
                      justifyContent="flex-start"
                      onClick={() => setShowResetPassword(true)}
                    >
                      <FiKey style={{ marginRight: "6px" }} />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      color="charcoal.500"
                      fontFamily="heading"
                      fontSize="xs"
                      borderColor="gray.200"
                      _hover={{ bg: "gray.50" }}
                      justifyContent="flex-start"
                      onClick={() => setShowParentAccess(true)}
                    >
                      <FiShare2 style={{ marginRight: "6px" }} />
                      Parent Access
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        color="red.500"
                        fontFamily="heading"
                        fontSize="xs"
                        borderColor="red.100"
                        _hover={{ bg: "red.50" }}
                        justifyContent="flex-start"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <FiTrash2 style={{ marginRight: "6px" }} />
                        Delete Scholar
                      </Button>
                    )}
                  </VStack>
                </Box>
              )}

              {/* Parent mode: MCP Access */}
              {isParentMode && (
                <Box bg="white" borderRadius="lg" p={5} shadow="xs">
                  <Button
                    size="sm"
                    variant="outline"
                    color="charcoal.500"
                    fontFamily="heading"
                    fontSize="xs"
                    borderColor="gray.200"
                    _hover={{ bg: "gray.50" }}
                    w="full"
                    justifyContent="flex-start"
                    onClick={() => setShowParentAccess(true)}
                  >
                    <FiShare2 style={{ marginRight: "6px" }} />
                    MCP Access
                  </Button>
                </Box>
              )}
            </VStack>
          </Box>
        )}

        {/* ── AI Chat — teacher only ── */}
        {activeTab === "ai-chat" && !isParentMode && (
          <VStack gap={6} align="stretch" maxW="600px">
            {/* Start a new chat — primary CTA */}
            <Box>
              <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500" mb={2}>
                Start a new AI chat about {scholar?.name}
              </Text>
              <QuickChatBox
                scholarId={scholarId}
                createSession={createChatSession}
                onNavigate={(id) => router.push(`/teacher?tab=assistant&session=${id}`)}
              />
            </Box>

            {/* Recent chats */}
            {chatSessions.length > 0 && (
              <Box>
                <Text fontFamily="heading" fontWeight="600" fontSize="sm" color="navy.500" mb={2}>
                  Recent chats
                </Text>
                <VStack gap={1} align="stretch">
                  {chatSessions.map((s) => (
                    <Button
                      key={String(s._id)}
                      variant="ghost"
                      size="sm"
                      justifyContent="flex-start"
                      fontFamily="heading"
                      fontSize="xs"
                      color="violet.600"
                      _hover={{ bg: "violet.50" }}
                      onClick={() => router.push(`/teacher?tab=assistant&session=${String(s._id)}`)}
                    >
                      <FiMessageSquare style={{ marginRight: "6px", flexShrink: 0 }} />
                      <Text as="span" overflow="hidden" style={{ textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </Text>
                    </Button>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        )}
      </Box>

      {/* Reset Password dialog */}
      <Dialog.Root
        open={showResetPassword}
        onOpenChange={(e) => {
          if (!e.open) {
            setShowResetPassword(false);
            setTempPassword(null);
          }
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <StyledDialogContent>
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                  {tempPassword ? "Password Reset" : "Reset Password"}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                {tempPassword ? (
                  <VStack gap={2} align="start">
                    <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                      The temporary password for <strong>{scholar?.name ?? "this scholar"}</strong> is:
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontFamily="heading"
                      fontWeight="700"
                      color="violet.600"
                      letterSpacing="widest"
                      textAlign="center"
                      w="full"
                      py={2}
                    >
                      {tempPassword}
                    </Text>
                    <Text fontSize="xs" fontFamily="body" color="charcoal.400">
                      Give this to {scholar?.name ?? "the scholar"} to log in. They will be asked to set a new password.
                    </Text>
                  </VStack>
                ) : (
                  <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                    Reset password for <strong>{scholar?.name ?? "this scholar"}</strong>? They will need a temporary password to log back in.
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
                {tempPassword ? (
                  <Button
                    size="sm"
                    bg="violet.500"
                    color="white"
                    _hover={{ bg: "violet.600" }}
                    fontFamily="heading"
                    onClick={() => {
                      setShowResetPassword(false);
                      setTempPassword(null);
                    }}
                  >
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      fontFamily="heading"
                      onClick={() => setShowResetPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      bg="violet.500"
                      color="white"
                      _hover={{ bg: "violet.600" }}
                      fontFamily="heading"
                      onClick={async () => {
                        const result = await resetPassword({ scholarId: scholarId as Id<"users"> });
                        setTempPassword(result.tempPassword);
                      }}
                    >
                      Reset Password
                    </Button>
                  </>
                )}
              </Dialog.Footer>
            </StyledDialogContent>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={showDeleteConfirm}
        onOpenChange={(e) => setShowDeleteConfirm(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <StyledDialogContent>
              <Dialog.Header px={6} pt={5} pb={2}>
                <Dialog.Title fontFamily="heading" fontSize="lg" color="navy.500">
                  Delete Scholar
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px={6} py={3}>
                <Text fontSize="sm" fontFamily="body" color="charcoal.500">
                  Delete <strong>{scholar?.name ?? "this scholar"}</strong> and ALL their data? This cannot be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer px={6} pb={5} pt={2} gap={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  fontFamily="heading"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  bg="red.500"
                  color="white"
                  _hover={{ bg: "red.600" }}
                  fontFamily="heading"
                  onClick={async () => {
                    setShowDeleteConfirm(false);
                    onDelete?.();
                    await deleteUser({ userId: scholarId as Id<"users"> });
                  }}
                >
                  Delete
                </Button>
              </Dialog.Footer>
            </StyledDialogContent>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Parent Access Dialog */}
      <ParentAccessDialog
        scholarId={scholarId}
        scholarName={scholar?.name ?? "Scholar"}
        open={showParentAccess}
        onClose={() => setShowParentAccess(false)}
        mode={isParentMode ? "self" : "teacher"}
      />
    </Box>
  );
}

// ── QuickChatBox ─────────────────────────────────────────────────────

function QuickChatBox({
  scholarId,
  createSession,
  onNavigate,
}: {
  scholarId: string;
  createSession: (args: { scholarId: Id<"users"> }) => Promise<Id<"chatSessions">>;
  onNavigate: (sessionId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sendSessionMessage = useMutation(api.curriculumAssistant.sendSessionMessage);
  const { user } = useCurrentUser();

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || isLoading) return;
    setIsLoading(true);
    try {
      const sessionId = await createSession({ scholarId: scholarId as Id<"users"> });
      await sendSessionMessage({ sessionId, message: text });
      onNavigate(String(sessionId));
    } catch (e) {
      console.error("QuickChatBox error:", e);
      setIsLoading(false);
    }
  };

  return (
    <VStack gap={2} align="stretch">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder="Ask something about this scholar…"
        rows={2}
        resize="none"
        bg="white"
        border="1px solid"
        borderColor="gray.300"
        borderRadius="lg"
        fontFamily="body"
        fontSize="sm"
        disabled={isLoading || !user}
      />
      <Button
        size="sm"
        bg="violet.500"
        color="white"
        fontFamily="heading"
        fontSize="xs"
        _hover={{ bg: "violet.600" }}
        _disabled={{ opacity: 0.4 }}
        disabled={!value.trim() || isLoading || !user}
        onClick={handleSubmit}
        alignSelf="flex-end"
      >
        {isLoading ? <Spinner size="xs" /> : <><FiMessageSquare style={{ marginRight: "4px" }} />Start chat</>}
      </Button>
    </VStack>
  );
}
